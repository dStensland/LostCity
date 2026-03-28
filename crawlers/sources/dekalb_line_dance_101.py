"""
Crawler for DeKalb County Line Dance 101 classes.

Targets the official East Central Line Dance 101 listing in DeKalb's
ACTIVENet catalog and expands the published Tuesday schedule into recurring
class instances.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta

from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from sources.dekalb_parks_rec import _extract_prices, _fetch_page, _init_session

logger = logging.getLogger(__name__)

ACTIVITY_SEARCH_URL = (
    "https://apm.activecommunities.com/dekalbcountyrecreation/Activity_Search"
)
TARGET_NAME = "East Central - Line Dance 101 - Winter 2026 Session"
MAX_PAGES = 8
WEEKS_AHEAD = 8
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

DAY_INDEX = {
    "tuesday": 1,
    "tuesdays": 1,
}

SCHEDULE_RE = re.compile(
    r"Every\s+(?P<days>Tuesdays?)\s+from\s+(?P<start>\d{1,2}:\d{2}\s*(?:am|pm))\s*-\s*(?P<end>\d{1,2}:\d{2}\s*(?:am|pm))",
    re.IGNORECASE,
)

PLACE_DATA = {
    "east central dekalb cmty & senior ctr": {
        "name": "East Central DeKalb Community & Senior Center",
        "slug": "east-central-dekalb-community-senior-center",
        "address": "4885 Elam Rd",
        "neighborhood": "Stone Mountain",
        "city": "Stone Mountain",
        "state": "GA",
        "zip": "30083",
        "lat": 33.7945,
        "lng": -84.2057,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": ACTIVITY_SEARCH_URL,
        "description": "DeKalb County community center hosting public line dance classes.",
    }
}


def _to_24_hour(raw_value: str) -> str:
    normalized = raw_value.strip().lower().replace(" ", "")
    parsed = datetime.strptime(normalized, "%I:%M%p")
    return parsed.strftime("%H:%M")


def parse_schedule(desc_html: str) -> tuple[list[int], str, str] | None:
    text = BeautifulSoup(desc_html or "", "html.parser").get_text(" ")
    text = " ".join(text.split())
    match = SCHEDULE_RE.search(text)
    if not match:
        return None
    return (
        [DAY_INDEX["tuesday"]],
        _to_24_hour(match.group("start")),
        _to_24_hour(match.group("end")),
    )


def get_next_weekday(start_date: date, weekday: int) -> date:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def iter_occurrence_dates(
    start_date: date, end_date: date, weekdays: list[int], today: date
) -> list[tuple[date, int]]:
    horizon_end = min(end_date, today + timedelta(weeks=WEEKS_AHEAD))
    first_possible = max(start_date, today)
    occurrences: list[tuple[date, int]] = []

    for weekday in weekdays:
        current = get_next_weekday(first_possible, weekday)
        while current <= horizon_end:
            occurrences.append((current, weekday))
            current += timedelta(days=7)

    occurrences.sort(key=lambda item: (item[0], item[1]))
    return occurrences


def build_series_title(title: str, weekday: int) -> str:
    return f"{title} ({DAY_NAMES[weekday]})"


def parse_item(item: dict, today: date) -> dict | None:
    if (item.get("name") or "").strip() != TARGET_NAME:
        return None

    location_label = ((item.get("location") or {}).get("label") or "").strip().lower()
    place_data = PLACE_DATA.get(location_label)
    if not place_data:
        return None

    start_raw = item.get("date_range_start")
    end_raw = item.get("date_range_end")
    if not start_raw or not end_raw:
        return None

    start_date = datetime.strptime(start_raw, "%Y-%m-%d").date()
    end_date = datetime.strptime(end_raw, "%Y-%m-%d").date()
    if end_date < today:
        return None

    schedule = parse_schedule(item.get("desc") or "")
    if not schedule:
        return None

    weekdays, start_time, end_time = schedule
    occurrences = iter_occurrence_dates(start_date, end_date, weekdays, today)
    if not occurrences:
        return None

    price_min, price_max, is_free = _extract_prices(item.get("desc") or "")
    fee_label = ((item.get("fee") or {}).get("label") or "").strip().lower()
    if fee_label == "free":
        price_min = 0.0
        price_max = 0.0
        is_free = True

    title = f"Line Dance 101 at {place_data['name']}"
    description = (
        f"Public line dance class at {place_data['name']} through DeKalb County Recreation. "
        "Reserve through the official county catalog for current availability."
    )

    return {
        "title": title,
        "description": description,
        "venue_data": place_data,
        "start_time": start_time,
        "end_time": end_time,
        "occurrences": occurrences,
        "price_min": price_min,
        "price_max": price_max,
        "is_free": is_free,
        "price_note": (
            "DeKalb County currently lists this class as free."
            if is_free
            else f"DeKalb County currently lists this class from ${price_min:.2f} to ${price_max:.2f}."
            if price_min is not None and price_max is not None and price_min != price_max
            else f"DeKalb County currently lists this class at ${price_min:.2f}."
            if price_min is not None
            else "Check DeKalb County for current class pricing."
        ),
        "ticket_url": (item.get("action_link") or {}).get("href")
        or item.get("detail_url")
        or ACTIVITY_SEARCH_URL,
        "source_url": item.get("detail_url") or ACTIVITY_SEARCH_URL,
        "raw_text": f"{item.get('name','')} | {item.get('date_range','')} | {place_data['name']}",
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()
    today = date.today()

    session, csrf = _init_session()
    if not session or not csrf:
        logger.error("DeKalb line dance crawl aborted: session init failed")
        return 0, 0, 0

    first = _fetch_page(session, csrf, 1)
    if first is None:
        logger.error("DeKalb line dance crawl aborted: failed to fetch page 1")
        return 0, 0, 0

    _, _, total_pages = first
    total_pages = min(total_pages, MAX_PAGES)

    for page_num in range(1, total_pages + 1):
        result = first if page_num == 1 else _fetch_page(session, csrf, page_num)
        if result is None:
            break
        items, _, _ = result
        if not items:
            break

        for item in items:
            parsed = parse_item(item, today)
            if not parsed:
                continue

            venue_id = get_or_create_place(parsed["venue_data"])
            for event_date, weekday in parsed["occurrences"]:
                events_found += 1
                start_date = event_date.strftime("%Y-%m-%d")
                content_hash = generate_content_hash(
                    parsed["title"],
                    parsed["venue_data"]["name"],
                    start_date,
                )
                current_hashes.add(content_hash)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": parsed["title"],
                    "description": parsed["description"],
                    "start_date": start_date,
                    "start_time": parsed["start_time"],
                    "end_date": None,
                    "end_time": parsed["end_time"],
                    "is_all_day": False,
                    "category": "fitness",
                    "subcategory": "fitness.dance",
                    "tags": [
                        "dance",
                        "line-dance",
                        "fitness-class",
                        "public-fitness",
                        "dekalb",
                    ],
                    "price_min": parsed["price_min"],
                    "price_max": parsed["price_max"],
                    "price_note": parsed["price_note"],
                    "is_free": parsed["is_free"],
                    "source_url": parsed["source_url"],
                    "ticket_url": parsed["ticket_url"],
                    "image_url": None,
                    "raw_text": parsed["raw_text"],
                    "extraction_confidence": 0.95,
                    "is_recurring": True,
                    "recurrence_rule": f"FREQ=WEEKLY;BYDAY={DAY_CODES[weekday]}",
                    "content_hash": content_hash,
                    "is_class": True,
                    "class_category": "fitness",
                }

                existing = find_existing_event_for_insert(event_record)
                if existing:
                    if smart_update_existing_event(existing, event_record):
                        events_updated += 1
                    continue

                series_hint = {
                    "series_type": "class_series",
                    "series_title": build_series_title(parsed["title"], weekday),
                    "frequency": "weekly",
                    "day_of_week": DAY_NAMES[weekday].lower(),
                    "description": parsed["description"],
                }
                insert_event(event_record, series_hint=series_hint)
                events_new += 1

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale DeKalb line dance rows", stale_removed)

    logger.info(
        "DeKalb line dance crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
