"""
Hooky family-focused public-program layer for DeKalb County Recreation.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional

from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_venue,
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
)
from sources.dekalb_parks_rec import (
    ACTIVITY_SEARCH_URL,
    GENERIC_VENUE,
    MAX_PAGES,
    REQUEST_DELAY,
    _classify,
    _extract_prices,
    _fetch_page,
    _init_session,
    _parse_date,
    _resolve_venue_data,
    _should_skip_dedicated_source,
)

logger = logging.getLogger(__name__)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    programs=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

_BLOCKED_KEYWORDS = [
    "adult swim",
    "water fitness",
    "aqua fit",
    "line dance",
    "pickleball",
]


def _build_destination_envelope(venue_data: dict, venue_id: int) -> TypedEntityEnvelope | None:
    """Project touched DeKalb family venues into shared destination details."""
    slug = str(venue_data.get("slug") or "").strip()
    if not slug or slug == GENERIC_VENUE["slug"]:
        return None

    venue_type = str(venue_data.get("venue_type") or "").strip().lower()
    envelope = TypedEntityEnvelope()

    if venue_type in {"recreation", "community_center"}:
        envelope.add(
            "destination_details",
            {
                "venue_id": venue_id,
                "destination_type": "community_recreation_center",
                "commitment_tier": "halfday",
                "primary_activity": "family recreation center visit",
                "best_seasons": ["spring", "summer", "fall", "winter"],
                "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip"],
                "parking_type": "free_lot",
                "best_time_of_day": "afternoon",
                "practical_notes": (
                    "This DeKalb recreation center works best as a weather-proof family activity base, especially on afternoons when families want a class, gym, or community-center stop without committing to a long outing."
                ),
                "accessibility_notes": (
                    "Indoor community-center space keeps the visit lower-friction than park-only plans, with easier stroller handling, bathroom access, and shorter reset loops for mixed-age family outings."
                ),
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Drop-in access and classes vary by center; confirm current family programming and building hours through DeKalb Recreation.",
                "source_url": ACTIVITY_SEARCH_URL,
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "venue_type": venue_type,
                    "county": "dekalb",
                },
            },
        )
        envelope.add(
            "venue_features",
            {
                "venue_id": venue_id,
                "slug": "indoor-family-recreation-space",
                "title": "Indoor family recreation space",
                "feature_type": "amenity",
                "description": "This DeKalb recreation center gives families an indoor recreation option with weather-proof community-center space and youth programming.",
                "url": ACTIVITY_SEARCH_URL,
                "price_note": "Drop-in access and building amenities vary by center.",
                "is_free": False,
                "sort_order": 10,
            },
        )
        envelope.add(
            "venue_features",
            {
                "venue_id": venue_id,
                "slug": "family-classes-and-seasonal-camps",
                "title": "Family classes and seasonal camps",
                "feature_type": "experience",
                "description": "This DeKalb recreation center regularly hosts youth classes, family recreation programming, and seasonal camps.",
                "url": ACTIVITY_SEARCH_URL,
                "price_note": "Registration costs vary by program and season.",
                "is_free": False,
                "sort_order": 20,
            },
        )
        return envelope

    if venue_type == "park":
        envelope.add(
            "destination_details",
            {
                "venue_id": venue_id,
                "destination_type": "park",
                "commitment_tier": "halfday",
                "primary_activity": "family park visit",
                "best_seasons": ["spring", "summer", "fall"],
                "weather_fit_tags": ["outdoor", "free-option", "family-daytrip"],
                "parking_type": "free_lot",
                "best_time_of_day": "morning",
                "practical_notes": (
                    "This DeKalb park is best used as a flexible free outdoor family stop, especially for morning play, low-pressure wandering, or pairing with a structured class or camp pickup."
                ),
                "accessibility_notes": (
                    "Open park space is easier for looser family pacing than a formal attraction, but comfort, shade, and stroller smoothness vary more by site than at the county's indoor recreation centers."
                ),
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Open park access is free; classes, camps, and facility reservations vary by site.",
                "source_url": ACTIVITY_SEARCH_URL,
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "venue_type": venue_type,
                    "county": "dekalb",
                },
            },
        )
        envelope.add(
            "venue_features",
            {
                "venue_id": venue_id,
                "slug": "free-outdoor-play-space",
                "title": "Free outdoor play space",
                "feature_type": "amenity",
                "description": "This DeKalb park is a free family option for low-friction outdoor time, open-air play, and pairing with seasonal county programming.",
                "url": ACTIVITY_SEARCH_URL,
                "price_note": "Open park access is free.",
                "is_free": True,
                "sort_order": 10,
            },
        )
        return envelope

    return None


def _flush_program_envelope(program_envelope: TypedEntityEnvelope) -> TypedEntityEnvelope:
    if not program_envelope.programs:
        return program_envelope

    persist_result = persist_typed_entity_envelope(program_envelope)
    skipped_programs = persist_result.skipped.get("programs", 0)
    if skipped_programs:
        logger.warning(
            "DeKalb family programs: skipped %d structured program rows",
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
        "provider_name": "DeKalb County Recreation",
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


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl family-relevant public programs from DeKalb's ACTIVENet catalog."""
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

    first = _fetch_page(session, csrf, 1)
    if first is None:
        logger.error("DeKalb family programs: failed to fetch page 1")
        return 0, 0, 0

    _, _total_records, total_pages = first
    total_pages = min(total_pages, MAX_PAGES)

    for page_num in range(1, total_pages + 1):
        if page_num == 1:
            result = first
        else:
            import time

            time.sleep(REQUEST_DELAY)
            result = _fetch_page(session, csrf, page_num)
            if result is None:
                break

        items, _, _ = result
        if not items:
            break

        for item in items:
            try:
                name: str = (item.get("name") or "").strip()
                if not name:
                    continue

                desc_html: str = item.get("desc") or ""
                desc_soup = BeautifulSoup(desc_html, "html.parser")
                desc_text = desc_soup.get_text(" ", strip=True)

                # Extract inline image from description HTML if present.
                # The ACTIVENet API does not expose a dedicated image field; the
                # detail_url pages return a generic ActiveNet og:image, not a
                # program-specific one. Inline <img> tags in desc_html are the
                # only program-specific image source available from this API.
                desc_image_url: Optional[str] = None
                for img_tag in desc_soup.find_all("img", src=True):
                    src = str(img_tag.get("src", "")).strip()
                    if src and not src.startswith("data:"):
                        desc_image_url = src
                        break
                if _should_skip_dedicated_source(name, desc_text):
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

                age_min: Optional[int] = item.get("age_min_year")
                age_max: Optional[int] = item.get("age_max_year")
                if age_max is not None and age_max > 90:
                    age_max = None

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
                    venue_data = _resolve_venue_data(location_label)
                    venue_id = get_or_create_venue(venue_data)
                    destination_envelope = _build_destination_envelope(venue_data, venue_id)
                    if destination_envelope is not None:
                        persist_typed_entity_envelope(destination_envelope)
                    venue_cache[venue_key] = venue_id
                venue_id = venue_cache[venue_key]

                price_min, price_max, is_free = _extract_prices(desc_html)
                detail_url = item.get("detail_url") or ACTIVITY_SEARCH_URL
                description = desc_text[:1000] if desc_text else None
                venue_name = _resolve_venue_data(location_label).get("name", "DeKalb County Recreation")
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
                    "image_url": desc_image_url,
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
                logger.error("DeKalb family programs: error processing item %s: %s", item.get("id"), exc)
                continue

        program_envelope = _flush_program_envelope(program_envelope)

    program_envelope = _flush_program_envelope(program_envelope)

    logger.info(
        "DeKalb family programs crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
