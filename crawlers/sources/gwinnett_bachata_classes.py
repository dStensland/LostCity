"""
Crawler for Gwinnett County Bachata classes.

Targets the public Bachata and Bachata/Salsa sessions in Gwinnett's Rec1
catalog and expands them into recurring dance class instances.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

from db import (
    find_existing_event_for_insert,
    get_or_create_venue,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from sources._rec1_base import (
    _get_checkout_key,
    _get_groups_for_tab,
    _get_sessions_for_group,
    _get_tabs,
    _parse_date_range,
    _parse_time_range,
)

logger = logging.getLogger(__name__)

TENANT_SLUG = "gwinnett-county-parks-recreation"
CATALOG_URL = f"https://secure.rec1.com/GA/{TENANT_SLUG}/catalog"
TARGET_TAB = "Classes & Activities"
TARGET_GROUP = "Cultural Dances"
WEEKS_AHEAD = 10
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

DAY_INDEX = {
    "mon": 0,
    "monday": 0,
    "tue": 1,
    "tues": 1,
    "tuesday": 1,
}

VENUE_DATA = {
    "name": "Rhodes Jordan Park Community Recreation Center",
    "slug": "rhodes-jordan-park-crc",
    "address": "100 E Crogan St",
    "neighborhood": "Lawrenceville",
    "city": "Lawrenceville",
    "state": "GA",
    "zip": "30046",
    "lat": 33.9524,
    "lng": -83.9877,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": CATALOG_URL,
    "description": "Gwinnett County recreation center hosting public Bachata classes.",
}


def parse_days_value(raw_value: str) -> list[int]:
    weekdays: list[int] = []
    for token in [part.strip().lower() for part in (raw_value or "").split(",") if part.strip()]:
        weekday = DAY_INDEX.get(token)
        if weekday is not None and weekday not in weekdays:
            weekdays.append(weekday)
    return weekdays


def get_next_weekday(start_date: date, weekday: int) -> date:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def iter_occurrence_dates(
    start_date: date,
    end_date: date,
    weekdays: list[int],
    today: date,
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


def normalize_title(raw_title: str) -> str | None:
    title = raw_title.strip()
    if title not in {"Bachata", "Bachata/Salsa"}:
        return None
    return title


def parse_session(session: dict, today: date) -> dict | None:
    if (
        session.get("registrationOver")
        or session.get("sessionFull")
        or session.get("canceled")
    ):
        return None

    normalized_title = normalize_title(session.get("text") or "")
    if not normalized_title:
        return None

    features = {feature.get("name"): feature.get("value") for feature in session.get("features") or []}
    location = (features.get("location") or "").strip().lower()
    if location != "rhodes jordan park community recreation center":
        return None

    start_date, end_date = _parse_date_range(features.get("dates") or "", today)
    if not start_date or not end_date or end_date < today:
        return None

    weekdays = parse_days_value(features.get("days") or "")
    if not weekdays:
        weekdays = [start_date.weekday()]

    start_time, end_time = _parse_time_range(features.get("times") or "")
    if not start_time:
        return None

    occurrences = iter_occurrence_dates(start_date, end_date, weekdays, today)
    if not occurrences:
        return None

    price = session.get("price")
    price_value = float(price) if price is not None else None
    title = f"{normalized_title} at {VENUE_DATA['name']}"
    description = (
        f"Public Latin dance class at {VENUE_DATA['name']} through Gwinnett County Parks & Recreation. "
        "Reserve through the official county catalog for current availability."
    )

    return {
        "title": title,
        "description": description,
        "start_time": start_time,
        "end_time": end_time,
        "occurrences": occurrences,
        "price_min": price_value,
        "price_max": price_value,
        "is_free": price_value == 0 if price_value is not None else False,
        "price_note": (
            "Gwinnett Parks currently lists this class as free."
            if price_value == 0
            else f"Gwinnett Parks currently lists this class at ${price_value:.2f}."
            if price_value is not None
            else "Check Gwinnett Parks for current class pricing."
        ),
        "ticket_url": CATALOG_URL,
        "source_url": CATALOG_URL,
        "raw_text": (
            f"{normalized_title} | {features.get('ageGender','')} | {features.get('days','')} | "
            f"{features.get('dates','')} | {features.get('times','')} | {VENUE_DATA['name']}"
        ),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()
    seen_session_ids: set[int] = set()
    venue_id = get_or_create_venue(VENUE_DATA)
    today = datetime.now().date()

    checkout_key = _get_checkout_key(TENANT_SLUG)
    if not checkout_key:
        logger.error("Gwinnett Bachata crawl aborted: missing checkout key")
        return 0, 0, 0

    tabs = _get_tabs(TENANT_SLUG, checkout_key)
    tab_id = next((str(tab["id"]) for tab in tabs if tab.get("label") == TARGET_TAB), None)
    if not tab_id:
        logger.error("Gwinnett Bachata crawl aborted: Classes & Activities tab missing")
        return 0, 0, 0

    groups = _get_groups_for_tab(TENANT_SLUG, checkout_key, tab_id)
    target_group = next((group for _, group in groups if group.get("name") == TARGET_GROUP), None)
    if not target_group:
        logger.error("Gwinnett Bachata crawl aborted: Cultural Dances group missing")
        return 0, 0, 0

    sessions = _get_sessions_for_group(
        TENANT_SLUG,
        checkout_key,
        tab_id,
        str(target_group.get("id")),
        target_group.get("type", ""),
    )

    for session in sessions:
        session_id = session.get("id")
        if isinstance(session_id, int):
            if session_id in seen_session_ids:
                continue
            seen_session_ids.add(session_id)

        parsed = parse_session(session, today)
        if not parsed:
            continue

        for event_date, weekday in parsed["occurrences"]:
            events_found += 1
            start_date = event_date.strftime("%Y-%m-%d")
            content_hash = generate_content_hash(parsed["title"], VENUE_DATA["name"], start_date)
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
                    "latin-dance",
                    "bachata",
                    "fitness-class",
                    "public-fitness",
                    "gwinnett",
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
        logger.info("Removed %s stale Gwinnett Bachata rows", stale_removed)

    logger.info(
        "Gwinnett Bachata crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
