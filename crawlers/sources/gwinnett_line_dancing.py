"""
Crawler for Gwinnett County adult line dancing classes.

Targets public adult and active-adult line dancing sessions in Gwinnett's Rec1
catalog and emits recurring or one-off class instances with class metadata.
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
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from sources._rec1_base import (
    _get_checkout_key,
    _get_groups_for_tab,
    _get_sessions_for_group,
    _get_tabs,
    _parse_date_range,
    _parse_time_range,
)

logger = logging.getLogger(__name__)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

TENANT_SLUG = "gwinnett-county-parks-recreation"
CATALOG_URL = f"https://secure.rec1.com/GA/{TENANT_SLUG}/catalog"
TARGET_TABS = {"Active Adults 50+", "Classes & Activities"}
TARGET_GROUP = "Line Dancing"
WEEKS_AHEAD = 14
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

DAY_INDEX = {
    "tu": 1,
    "tue": 1,
    "tuesday": 1,
    "fr": 4,
    "fri": 4,
    "friday": 4,
}

ADULT_AGE_PATTERNS = (
    re.compile(r"\b18\s*/\s*up\b", re.I),
    re.compile(r"\b18\s*\+\b", re.I),
    re.compile(r"\b50\s*/\s*up\b", re.I),
    re.compile(r"\b50\s*\+\b", re.I),
)

VENUE_DATA_BY_LOCATION = {
    "george pierce park community recreation center": {
        "name": "George Pierce Park Community Recreation Center",
        "slug": "george-pierce-park-crc",
        "address": "55 Buford Hwy NE",
        "neighborhood": "Suwanee",
        "city": "Suwanee",
        "state": "GA",
        "zip": "30024",
        "lat": 34.0443,
        "lng": -84.0678,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": CATALOG_URL,
        "description": "Gwinnett County recreation center hosting public adult line dancing classes.",
    },
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
        "description": "Gwinnett County senior center hosting public line dancing classes.",
    },
    "shorty howell park activity building": {
        "name": "Shorty Howell Park Activity Building",
        "slug": "shorty-howell-park-activity-building",
        "address": "2750 Pleasant Hill Rd",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9796,
        "lng": -84.1245,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": CATALOG_URL,
        "description": "Gwinnett County activity building hosting public adult line dancing classes.",
    },
}


def _build_destination_envelope(venue_id: int, place_data: dict) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "community_recreation_center",
            "commitment_tier": "halfday",
            "primary_activity": "community center class or recreation visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "indoor-option", "rainy-day", "heat-day", "family-daytrip"],
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "practical_notes": (
                f"{place_data['name']} works best for families as a planned activity-building or community-center stop tied to a class, rec program, or other scheduled visit rather than as a roamable attraction."
            ),
            "accessibility_notes": (
                "Indoor community-center circulation makes these Gwinnett rec venues lower-friction options for weather-flex family plans, especially when paired with a registered activity."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Classes, drop-in recreation, and building access vary by program; check the county catalog for current details.",
            "source_url": CATALOG_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": place_data["venue_type"],
                "county": "gwinnett",
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
            "description": f"{place_data['name']} gives families a weather-flex indoor recreation option inside Gwinnett's public rec system.",
            "url": CATALOG_URL,
            "price_note": "Drop-in access and specific amenities vary by center.",
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "planned-class-and-activity-building",
            "title": "Planned class and activity building",
            "feature_type": "experience",
            "description": f"{place_data['name']} is strongest as a planned rec-building stop for classes, community programs, and other scheduled county activities.",
            "url": CATALOG_URL,
            "price_note": "Program pricing varies by activity.",
            "is_free": False,
            "sort_order": 20,
        },
    )
    return envelope


def _is_adult_age_value(value: str) -> bool:
    return any(pattern.search(value or "") for pattern in ADULT_AGE_PATTERNS)


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
    if "line danc" not in raw_title.lower():
        return None

    features = {feature.get("name"): feature.get("value") for feature in session.get("features") or []}
    age_value = (features.get("ageGender") or "").strip()
    if not _is_adult_age_value(age_value):
        return None

    place_data = VENUE_DATA_BY_LOCATION.get((features.get("location") or "").strip().lower())
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

    price = session.get("price")
    price_value = float(price) if price is not None else None
    title = f"{raw_title} at {place_data['name']}"
    description = (
        f"Public adult line dancing class at {place_data['name']} through Gwinnett County Parks & Recreation. "
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
            f"{raw_title} | {age_value} | {features.get('days','')} | "
            f"{features.get('dates','')} | {features.get('times','')} | {place_data['name']}"
        ),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()
    seen_session_ids: set[int] = set()
    venue_ids = {}
    for data in VENUE_DATA_BY_LOCATION.values():
        venue_id = get_or_create_place(data)
        persist_typed_entity_envelope(_build_destination_envelope(venue_id, data))
        venue_ids[data["slug"]] = venue_id
    today = datetime.now().date()

    checkout_key = _get_checkout_key(TENANT_SLUG)
    if not checkout_key:
        logger.error("Gwinnett line dancing crawl aborted: missing checkout key")
        return 0, 0, 0

    tabs = _get_tabs(TENANT_SLUG, checkout_key)

    for tab_label in TARGET_TABS:
        tab_id = next((str(tab["id"]) for tab in tabs if tab.get("label") == tab_label), None)
        if not tab_id:
            continue

        groups = _get_groups_for_tab(TENANT_SLUG, checkout_key, tab_id)
        target_group = next((group for _, group in groups if group.get("name") == TARGET_GROUP), None)
        if not target_group:
            continue

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
                    "subcategory": "fitness.dance",
                    "tags": [
                        "dance",
                        "line-dancing",
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
                    "is_class": True,
                    "class_category": "fitness",
                    "content_hash": content_hash,
                    "is_recurring": len(parsed["occurrences"]) > 1,
                    "recurrence_rule": f"FREQ=WEEKLY;BYDAY={DAY_CODES[weekday]}" if len(parsed["occurrences"]) > 1 else None,
                }

                existing = find_existing_event_for_insert(event_record)
                if existing:
                    if smart_update_existing_event(existing, event_record):
                        events_updated += 1
                    continue

                if len(parsed["occurrences"]) > 1:
                    series_hint = {
                        "series_type": "class_series",
                        "series_title": build_series_title(parsed["title"], weekday),
                    }
                    insert_event(event_record, series_hint=series_hint)
                else:
                    insert_event(event_record)
                events_new += 1

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Gwinnett line dancing removed %d stale rows", stale_removed)

    return events_found, events_new, events_updated
