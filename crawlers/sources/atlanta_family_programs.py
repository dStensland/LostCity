"""
Hooky family-focused public-program layer for Atlanta Department of Parks & Recreation.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional

from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_venue, insert_event, smart_update_existing_event
from dedupe import generate_content_hash
from sources._activecommunities_family_filter import is_family_relevant_activity
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

_BLOCKED_KEYWORDS = [
    "adult swim lessons",
    "open gym",
    "pickleball",
]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl family-relevant public programs from Atlanta DPR's ACTIVENet catalog."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    today = date.today()
    venue_cache: dict[str, int] = {}

    session, csrf = _init_session()
    if not session or not csrf:
        return 0, 0, 0

    first = _fetch_page(session, csrf, 1)
    if first is None:
        logger.error("Atlanta family programs: failed to fetch page 1")
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
                    venue_cache[venue_key] = get_or_create_venue(_resolve_venue_data(location_label))
                venue_id = venue_cache[venue_key]

                price_min, price_max, is_free = _extract_prices(desc_html)
                detail_url = item.get("detail_url") or ACTIVITY_SEARCH_URL
                description = desc_text[:1000] if desc_text else None
                venue_name = _resolve_venue_data(location_label).get("name", "Atlanta DPR")
                hash_key = start_raw if start_raw else str(item.get("id"))
                content_hash = generate_content_hash(name, venue_name, hash_key)

                event_record: dict = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": name,
                    "description": description,
                    "start_date": start_raw or today.strftime("%Y-%m-%d"),
                    "start_time": None,
                    "end_date": end_raw,
                    "end_time": None,
                    "is_all_day": True if not start_raw else False,
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
            except Exception as exc:
                logger.error("Atlanta family programs: error processing item %s: %s", item.get("id"), exc)
                continue

    logger.info(
        "Atlanta family programs crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
