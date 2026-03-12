"""
Crawler for Gwinnett County yoga classes.

Targets the public Active Adults 50+ Yoga/Pilates sessions in Gwinnett's Rec1
catalog and expands them into recurring dated class instances.
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
TARGET_TAB = "Active Adults 50+"
TARGET_GROUP = "Yoga/Pilates"
TARGET_TITLES = {"Gentle Chair Goat Yoga", "Chair Yoga", "Yoga"}
WEEKS_AHEAD = 12
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

DAY_INDEX = {
    "m": 0,
    "mo": 0,
    "mon": 0,
    "monday": 0,
    "w": 2,
    "we": 2,
    "wed": 2,
    "wednesday": 2,
    "r": 3,
    "th": 3,
    "thu": 3,
    "thursday": 3,
}

VENUE_DATA_BY_LOCATION = {
    "bethesda park senior center": {
        "name": "Bethesda Park Senior Center",
        "slug": "bethesda-park-senior-center",
        "address": "225 Bethesda Church Rd",
        "neighborhood": "Lawrenceville",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30044",
        "lat": 33.9211,
        "lng": -84.0299,
        "venue_type": "community_center",
        "spot_type": "senior_center",
        "website": CATALOG_URL,
        "description": "Gwinnett County senior center hosting public yoga classes.",
    },
    "pinckneyville park community recreation center": {
        "name": "Pinckneyville Park Community Recreation Center",
        "slug": "pinckneyville-park-crc",
        "address": "4758 S Old Peachtree Rd",
        "neighborhood": "Norcross",
        "city": "Norcross",
        "state": "GA",
        "zip": "30071",
        "lat": 33.9551,
        "lng": -84.1867,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": CATALOG_URL,
        "description": "Gwinnett County recreation center hosting public yoga classes.",
    },
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


def parse_session(session: dict, today: date) -> dict | None:
    if (
        session.get("registrationOver")
        or session.get("sessionFull")
        or session.get("canceled")
    ):
        return None

    raw_title = (session.get("text") or "").strip()
    if raw_title not in TARGET_TITLES:
        return None

    features = {feature.get("name"): feature.get("value") for feature in session.get("features") or []}
    venue_data = VENUE_DATA_BY_LOCATION.get((features.get("location") or "").strip().lower())
    if not venue_data:
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
    title = f"{raw_title} at {venue_data['name']}"
    description = (
        f"Public yoga class at {venue_data['name']} through Gwinnett County Parks & Recreation. "
        "Reserve through the official county catalog for current availability."
    )

    return {
        "title": title,
        "description": description,
        "start_time": start_time,
        "end_time": end_time,
        "venue_data": venue_data,
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
            f"{raw_title} | {features.get('ageGender','')} | {features.get('days','')} | "
            f"{features.get('dates','')} | {features.get('times','')} | {venue_data['name']}"
        ),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()
    seen_session_ids: set[int] = set()
    venue_ids = {
        data["slug"]: get_or_create_venue(data)
        for data in VENUE_DATA_BY_LOCATION.values()
    }
    today = datetime.now().date()

    checkout_key = _get_checkout_key(TENANT_SLUG)
    if not checkout_key:
        logger.error("Gwinnett yoga crawl aborted: missing checkout key")
        return 0, 0, 0

    tabs = _get_tabs(TENANT_SLUG, checkout_key)
    tab_id = next((str(tab["id"]) for tab in tabs if tab.get("label") == TARGET_TAB), None)
    if not tab_id:
        logger.error("Gwinnett yoga crawl aborted: Active Adults 50+ tab missing")
        return 0, 0, 0

    groups = _get_groups_for_tab(TENANT_SLUG, checkout_key, tab_id)
    target_group = next((group for _, group in groups if group.get("name") == TARGET_GROUP), None)
    if not target_group:
        logger.error("Gwinnett yoga crawl aborted: Yoga/Pilates group missing")
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

        venue_id = venue_ids[parsed["venue_data"]["slug"]]

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
                "subcategory": "fitness.yoga",
                "tags": [
                    "yoga",
                    "public-fitness",
                    "adults",
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
            }
            insert_event(event_record, series_hint=series_hint)
            events_new += 1

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Gwinnett yoga removed %d stale rows", stale_removed)

    return events_found, events_new, events_updated
