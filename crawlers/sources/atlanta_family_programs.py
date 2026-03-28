"""
Hooky family-focused public-program layer for Atlanta Department of Parks & Recreation.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional

from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    infer_program_type,
    infer_season,
    infer_cost_period,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from sources._activecommunities_family_filter import (
    infer_activecommunities_registration_open,
    infer_activecommunities_schedule_days,
    infer_activecommunities_schedule_time_range,
    is_family_relevant_activity,
    normalize_activecommunities_age,
    normalize_activecommunities_session_title,
    parse_age_from_name,
)
from sources.atlanta_dpr import (
    ACTIVITY_SEARCH_URL,
    MAX_PAGES,
    REQUEST_DELAY,
    _classify,
    _extract_prices,
    _fetch_page,
    _init_session,
    _parse_date,
    _resolve_venue_data,
    _should_skip_dedicated_item,
)

logger = logging.getLogger(__name__)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    programs=True,
)

_BLOCKED_KEYWORDS = [
    "adult swim lessons",
    "open gym",
    "pickleball",
]


def _flush_program_envelope(program_envelope: TypedEntityEnvelope) -> TypedEntityEnvelope:
    if not program_envelope.programs:
        return program_envelope

    persist_result = persist_typed_entity_envelope(program_envelope)
    skipped_programs = persist_result.skipped.get("programs", 0)
    if skipped_programs:
        logger.warning(
            "Atlanta family programs: skipped %d structured program rows",
            skipped_programs,
        )
    return TypedEntityEnvelope()


def _build_program_record(
    event_record: dict,
    item: dict,
    desc_text: str,
    venue_name: str,
    source_id: int,
    portal_id: Optional[str],
    age_min: Optional[int],
    age_max: Optional[int],
) -> Optional[dict]:
    """Build the structured program record for the shared typed lane."""
    title = event_record.get("title", "")
    program_type = infer_program_type(title)
    if not title or not program_type:
        return None

    session_start_str = event_record.get("start_date")

    session_start = None
    if session_start_str:
        try:
            session_start = datetime.strptime(session_start_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            pass

    season = infer_season(title, session_start)
    price_val = event_record.get("price_min", 0) or 0
    cost_period = infer_cost_period(event_record.get("price_note"))
    schedule_days = infer_activecommunities_schedule_days(
        session_start=session_start_str,
        session_end=event_record.get("end_date"),
        date_range_description=item.get("date_range_description"),
        desc_text=desc_text,
    )
    schedule_start_time, schedule_end_time = infer_activecommunities_schedule_time_range(
        date_range_description=item.get("date_range_description"),
        desc_text=desc_text,
    )
    registration_opens = infer_activecommunities_registration_open(
        activity_online_start_time=item.get("activity_online_start_time"),
        desc_text=desc_text,
        session_start=session_start_str,
    )
    registration_status = "closed" if item.get("total_open") == 0 else "open"

    program_data: dict = {
        "source_id": source_id,
        "venue_id": event_record.get("venue_id"),
        "name": title,
        "description": event_record.get("description"),
        "program_type": program_type,
        "provider_name": "Atlanta Parks & Recreation",
        "age_min": age_min,
        "age_max": age_max,
        "season": season,
        "session_start": session_start_str,
        "session_end": event_record.get("end_date"),
        "schedule_days": schedule_days,
        "schedule_start_time": schedule_start_time,
        "schedule_end_time": schedule_end_time,
        "cost_amount": price_val if price_val > 0 else None,
        "cost_period": cost_period if price_val > 0 else None,
        "registration_status": registration_status,
        "registration_opens": registration_opens,
        "registration_url": event_record.get("source_url"),
        "tags": event_record.get("tags", []),
        "metadata": {
            "activity_id": item.get("id"),
            "activity_number": item.get("number"),
            "activity_online_start_time": item.get("activity_online_start_time"),
            "date_range": item.get("date_range"),
            "date_range_description": item.get("date_range_description"),
            "total_open": item.get("total_open"),
            "already_enrolled": item.get("already_enrolled"),
            "urgent_status": (item.get("urgent_message") or {}).get("status_description"),
            "location_label": (item.get("location") or {}).get("label"),
            "ages_label": item.get("ages"),
        },
        "_venue_name": venue_name,
    }

    if portal_id:
        program_data["portal_id"] = portal_id

    return program_data


def _consolidate_daily_sessions(raw_items: list[dict]) -> list[dict]:
    """
    Merge per-day ACTIVENet session records into single multi-day program records.

    ACTIVENet lists some multi-day camps as individual daily sessions where the
    date is embedded in the title, e.g.:
      "Gresham 2026 Spring Break Camp Apr. 6th"   (start=Apr 6, end=Apr 6)
      "Gresham 2026 Spring Break Camp Apr. 7th"   (start=Apr 7, end=Apr 7)
      ...
      "Gresham 2026 Spring Break Camp Apr. 10th"  (start=Apr 10, end=Apr 10)

    Groups by (normalized_title, location_label) and merges to a single record
    spanning the earliest start_date through the latest end_date.  The first
    item's metadata is kept; the title is set to the normalized (suffix-stripped)
    form.
    """
    from collections import defaultdict

    # Key: (normalized_title, location_label)
    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for item in raw_items:
        raw_name = (item.get("name") or "").strip()
        normalized = normalize_activecommunities_session_title(raw_name)
        location_label = (item.get("location") or {}).get("label") or ""
        key = (normalized.lower(), location_label.lower().strip())
        groups[key].append(item)

    consolidated: list[dict] = []
    for (_, _), group in groups.items():
        if len(group) == 1:
            consolidated.append(group[0])
            continue

        # Multiple daily sessions — merge into one record
        representative = dict(group[0])
        normalized_name = normalize_activecommunities_session_title(
            (representative.get("name") or "").strip()
        )
        # Find earliest start and latest end across all sessions
        starts = [
            item.get("date_range_start")
            for item in group
            if item.get("date_range_start")
        ]
        ends = [
            item.get("date_range_end") or item.get("date_range_start")
            for item in group
            if (item.get("date_range_end") or item.get("date_range_start"))
        ]
        if starts:
            representative["date_range_start"] = min(starts)
        if ends:
            representative["date_range_end"] = max(ends)
        representative["name"] = normalized_name
        # Mark how many sessions were merged (stored in metadata)
        representative["_merged_session_count"] = len(group)
        consolidated.append(representative)
        logger.debug(
            "Atlanta family programs: merged %d daily sessions into '%s'",
            len(group),
            normalized_name,
        )

    return consolidated


def _collect_all_items(session, csrf) -> list[dict]:
    """Fetch all pages from the ACTIVENet catalog and return the raw item list."""
    import time

    first = _fetch_page(session, csrf, 1)
    if first is None:
        return []

    _, _total_records, total_pages = first
    total_pages = min(total_pages, MAX_PAGES)

    all_items: list[dict] = []
    for page_num in range(1, total_pages + 1):
        if page_num == 1:
            result = first
        else:
            time.sleep(REQUEST_DELAY)
            result = _fetch_page(session, csrf, page_num)
            if result is None:
                break

        items, _, _ = result
        if not items:
            break
        all_items.extend(items)

    return all_items


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl family-relevant public programs from Atlanta DPR's ACTIVENet catalog."""
    from db.sources import get_source_info

    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    today = date.today()
    venue_cache: dict[str, int] = {}
    program_envelope = TypedEntityEnvelope()
    source_info = get_source_info(source_id) or {}
    portal_id = source_info.get("owner_portal_id")

    session, csrf = _init_session()
    if not session or not csrf:
        return 0, 0, 0

    # Collect all raw items first so we can consolidate per-day sessions
    raw_items = _collect_all_items(session, csrf)
    if not raw_items:
        logger.error("Atlanta family programs: failed to fetch any items")
        return 0, 0, 0

    items_to_process = _consolidate_daily_sessions(raw_items)
    logger.info(
        "Atlanta family programs: %d raw items → %d after session consolidation",
        len(raw_items),
        len(items_to_process),
    )

    for item in items_to_process:
        try:
            name: str = (item.get("name") or "").strip()
            if not name:
                continue

            desc_html: str = item.get("desc") or ""
            desc_text = BeautifulSoup(desc_html, "html.parser").get_text(" ", strip=True)

            if _should_skip_dedicated_item(name, desc_text):
                continue

            start_raw = _parse_date(item.get("date_range_start"))
            end_raw = _parse_date(item.get("date_range_end"))

            if start_raw:
                start_dt = datetime.strptime(start_raw, "%Y-%m-%d").date()
                if start_dt < today and not end_raw:
                    continue
            if end_raw:
                end_dt = datetime.strptime(end_raw, "%Y-%m-%d").date()
                if end_dt < today:
                    continue

            # ACTIVENet returns 0 (not None) when there is no age restriction.
            # normalize_activecommunities_age converts 0 and >90 to None.
            age_min: Optional[int] = normalize_activecommunities_age(item.get("age_min_year"))
            age_max: Optional[int] = normalize_activecommunities_age(item.get("age_max_year"))
            # Fallback: extract age range from the program name when the
            # API didn't supply structured age data.
            if age_min is None and age_max is None:
                age_min, age_max = parse_age_from_name(name)

            category, tags = _classify(name, desc_text, age_min, age_max)
            if not is_family_relevant_activity(
                name=name,
                desc_text=desc_text,
                age_min=age_min,
                age_max=age_max,
                category=category,
                tags=tags,
                blocked_keywords=_BLOCKED_KEYWORDS,
            ):
                continue

            location_label: str = item.get("location", {}).get("label") or ""
            venue_key = location_label.lower().strip()
            if venue_key not in venue_cache:
                venue_cache[venue_key] = get_or_create_place(_resolve_venue_data(location_label))
            venue_id = venue_cache[venue_key]

            price_min, price_max, is_free = _extract_prices(desc_html)
            detail_url = item.get("detail_url") or ACTIVITY_SEARCH_URL
            description = desc_text[:1000] if desc_text else None
            venue_name = _resolve_venue_data(location_label).get("name", "Atlanta DPR")
            # Hash on normalized name + venue + start_date so consolidated
            # sessions don't re-insert on next crawl.
            hash_key = start_raw if start_raw else str(item.get("id"))
            content_hash = generate_content_hash(name, venue_name, hash_key)
            schedule_start_time, schedule_end_time = infer_activecommunities_schedule_time_range(
                date_range_description=item.get("date_range_description"),
                desc_text=desc_text,
            )

            event_record: dict = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": name,
                "description": description,
                "start_date": start_raw or today.strftime("%Y-%m-%d"),
                "start_time": schedule_start_time,
                "end_date": end_raw,
                "end_time": schedule_end_time,
                "is_all_day": False if schedule_start_time else (True if not start_raw else False),
                "category": category,
                "subcategory": None,
                "tags": tags,
                "price_min": price_min,
                "price_max": price_max,
                "price_note": None,
                "is_free": is_free,
                "source_url": detail_url,
                "ticket_url": detail_url,
                "image_url": None,
                "raw_text": f"{name} | {location_label} | {item.get('ages', '')}",
                "extraction_confidence": 0.88,
                "is_recurring": bool(end_raw and start_raw and end_raw != start_raw),
                "recurrence_rule": None,
                "content_hash": content_hash,
            }
            if age_min is not None:
                event_record["age_min"] = age_min
            if age_max is not None:
                event_record["age_max"] = age_max

            events_found += 1
            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
            else:
                insert_event(event_record)
                events_new += 1

            program_record = _build_program_record(
                event_record=event_record,
                item=item,
                desc_text=desc_text,
                venue_name=venue_name,
                source_id=source_id,
                portal_id=portal_id,
                age_min=age_min,
                age_max=age_max,
            )
            if program_record:
                program_envelope.add("programs", program_record)
        except Exception as exc:
            logger.error("Atlanta family programs: error processing item %s: %s", item.get("id"), exc)
            continue

    program_envelope = _flush_program_envelope(program_envelope)

    logger.info(
        "Atlanta family programs crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
