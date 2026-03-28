"""
Crawler for Cobb County public pickleball classes.

Targets official Rec1 pickleball class groups and expands the county's
published weekday/date-range schedule into recurring class instances.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from sources._rec1_base import (
    _extract_feature,
    _get_checkout_key,
    _get_groups_for_tab,
    _get_sessions_for_group,
    _get_tabs,
    _parse_date_range,
    _parse_time_range,
)

logger = logging.getLogger(__name__)

TENANT_SLUG = "cobb-county-ga"
CATALOG_URL = f"https://secure.rec1.com/GA/{TENANT_SLUG}/catalog"
WEEKS_AHEAD = 10
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]

TARGET_GROUPS = {
    "8572": {"Indoor Pickleball Classes"},
    "4318": {"Tennis - Pickleball Classes"},
}

DAY_INDEX = {
    "m": 0,
    "mo": 0,
    "mon": 0,
    "monday": 0,
    "t": 1,
    "tu": 1,
    "tue": 1,
    "tues": 1,
    "tuesday": 1,
    "w": 2,
    "we": 2,
    "wed": 2,
    "wednesday": 2,
    "r": 3,
    "th": 3,
    "thu": 3,
    "thur": 3,
    "thurs": 3,
    "thursday": 3,
    "f": 4,
    "fr": 4,
    "fri": 4,
    "friday": 4,
    "sa": 5,
    "sat": 5,
    "saturday": 5,
    "su": 6,
    "sun": 6,
    "sunday": 6,
}

VENUE_DATA_BY_LOCATION = {
    "ward recreation center": {
        "name": "Boots Ward Recreation Center",
        "slug": "boots-ward-recreation-center",
        "address": "4845 Dallas Hwy",
        "neighborhood": "Powder Springs",
        "city": "Powder Springs",
        "state": "GA",
        "zip": "30127",
        "place_type": "community_center",
        "spot_type": "community_center",
        "website": CATALOG_URL,
        "description": "Cobb County recreation center hosting public pickleball classes.",
    },
    "fair oaks tennis center": {
        "name": "Fair Oaks Tennis Center",
        "slug": "fair-oaks-tennis-center",
        "address": "1460 W Booth Road Extension SW",
        "neighborhood": "Marietta",
        "city": "Marietta",
        "state": "GA",
        "zip": "30008",
        "place_type": "sports_complex",
        "spot_type": "sports_complex",
        "website": CATALOG_URL,
        "description": "Cobb County tennis center hosting public pickleball classes.",
    },
    "harrison tennis center": {
        "name": "Harrison Tennis Center",
        "slug": "harrison-tennis-center",
        "address": "3900 S Main St",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "place_type": "sports_complex",
        "spot_type": "sports_complex",
        "website": CATALOG_URL,
        "description": "Cobb County tennis center hosting public pickleball classes.",
    },
}


def parse_days_value(raw_value: str) -> list[int]:
    tokens = [
        part.strip().lower()
        for part in re.split(r"[,/&]|\band\b", raw_value or "")
        if part.strip()
    ]
    weekdays: list[int] = []
    for token in tokens:
        normalized = token.rstrip("s.")
        weekday = DAY_INDEX.get(normalized)
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

    features = {
        feature.get("name"): feature.get("value")
        for feature in session.get("features") or []
    }
    location = (features.get("location") or "").strip().lower()
    place_data = VENUE_DATA_BY_LOCATION.get(location)
    if not place_data:
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

    raw_title = (session.get("text") or "").strip()
    title_core = re.sub(r"\s*\(\d+\)\s*$", "", raw_title).strip()
    if not title_core:
        return None

    price = session.get("price")
    price_value = float(price) if price is not None else None
    title = f"{title_core} at {place_data['name']}"
    description = (
        f"Public pickleball class at {place_data['name']} through Cobb County Parks. "
        "Reserve through the official county catalog for current availability."
    )

    return {
        "title": title,
        "description": description,
        "start_time": start_time,
        "end_time": end_time,
        "venue_data": place_data,
        "occurrences": occurrences,
        "price_min": price_value,
        "price_max": price_value,
        "is_free": price_value == 0,
        "price_note": (
            "Cobb County currently lists this class as free."
            if price_value == 0
            else f"Cobb County currently lists this class at ${price_value:.2f}."
            if price_value is not None
            else "Check Cobb County for current class pricing."
        ),
        "ticket_url": CATALOG_URL,
        "source_url": CATALOG_URL,
        "raw_text": (
            f"{title_core} | {features.get('days', '')} | {features.get('dates', '')} | "
            f"{features.get('times', '')} | {place_data['name']}"
        ),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()
    seen_session_ids: set[int] = set()
    today = datetime.now().date()

    checkout_key = _get_checkout_key(TENANT_SLUG)
    if not checkout_key:
        logger.error("Cobb pickleball classes crawl aborted: missing checkout key")
        return 0, 0, 0

    tabs = _get_tabs(TENANT_SLUG, checkout_key)
    tab_ids = {
        str(tab["id"])
        for tab in tabs
        if str(tab.get("id")) in TARGET_GROUPS
    }
    if not tab_ids:
        logger.error("Cobb pickleball classes crawl aborted: target tabs missing")
        return 0, 0, 0

    for tab_id in sorted(tab_ids):
        groups = _get_groups_for_tab(TENANT_SLUG, checkout_key, tab_id)
        for _, group in groups:
            group_name = (group.get("name") or "").strip()
            if group_name not in TARGET_GROUPS[tab_id]:
                continue

            sessions = _get_sessions_for_group(
                TENANT_SLUG,
                checkout_key,
                tab_id,
                str(group.get("id")),
                group.get("type", ""),
            )

            for session in sessions:
                session_id = session.get("id")
                if session_id in seen_session_ids:
                    continue
                seen_session_ids.add(session_id)

                parsed = parse_session(session, today)
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
                        "place_id": venue_id,
                        "title": parsed["title"],
                        "description": parsed["description"],
                        "start_date": start_date,
                        "start_time": parsed["start_time"],
                        "end_date": None,
                        "end_time": parsed["end_time"],
                        "is_all_day": False,
                        "category": "sports",
                        "subcategory": "sports.pickleball",
                        "tags": [
                            "pickleball",
                            "sports-class",
                            "public-play",
                            "cobb",
                        ],
                        "price_min": parsed["price_min"],
                        "price_max": parsed["price_max"],
                        "price_note": parsed["price_note"],
                        "is_free": parsed["is_free"],
                        "source_url": parsed["source_url"],
                        "ticket_url": parsed["ticket_url"],
                        "image_url": None,
                        "raw_text": parsed["raw_text"],
                        "extraction_confidence": 0.94,
                        "is_recurring": True,
                        "recurrence_rule": f"FREQ=WEEKLY;BYDAY={DAY_CODES[weekday]}",
                        "content_hash": content_hash,
                        "is_class": True,
                        "class_category": "sports",
                    }

                    existing_event = find_existing_event_for_insert(event_record)
                    if existing_event:
                        if smart_update_existing_event(existing_event, event_record):
                            events_updated += 1
                    else:
                        series_hint = {
                            "series_type": "class_series",
                            "series_title": build_series_title(
                                parsed["title"], weekday
                            ),
                            "frequency": "weekly",
                            "day_of_week": DAY_NAMES[weekday].lower(),
                            "description": parsed["description"],
                        }
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1

    remove_stale_source_events(source_id, current_hashes)

    logger.info(
        "Cobb pickleball classes crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
