"""
Crawler for Gwinnett County Parks & Recreation aquatic fitness classes.

Targets the public aquatics-fitness sessions in the official Rec1 catalog and
expands them into recurring class instances for the near-term consumer horizon.
"""

from __future__ import annotations

import logging
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

TENANT_SLUG = "gwinnett-county-parks-recreation"
CATALOG_URL = f"https://secure.rec1.com/GA/{TENANT_SLUG}/catalog"
TARGET_TAB = "Aquatics"
TARGET_GROUP = "Aquatics Fitness"
WEEKS_AHEAD = 8
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

DAY_INDEX = {
    "mo": 0,
    "mon": 0,
    "monday": 0,
    "tu": 1,
    "tue": 1,
    "tues": 1,
    "tuesday": 1,
    "we": 2,
    "wed": 2,
    "wednesday": 2,
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
    "collins hill park aquatic center": {
        "name": "Collins Hill Park Aquatic Center",
        "slug": "collins-hill-park-aquatic-center",
        "address": "2200 Collins Hill Rd",
        "neighborhood": "Lawrenceville",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30043",
        "lat": 33.9941,
        "lng": -84.0045,
        "place_type": "community_center",
        "spot_type": "community_center",
        "website": CATALOG_URL,
        "description": "Gwinnett County aquatic center hosting public aquatics fitness classes.",
    },
    "mountain park aquatic center": {
        "name": "Mountain Park Aquatic Center",
        "slug": "mountain-park-aquatic-center",
        "address": "1063 Rockbridge Rd SW",
        "neighborhood": "Lilburn",
        "city": "Lilburn",
        "state": "GA",
        "zip": "30047",
        "lat": 33.8929,
        "lng": -84.0864,
        "place_type": "community_center",
        "spot_type": "community_center",
        "website": CATALOG_URL,
        "description": "Gwinnett County aquatic center hosting public aquatics fitness classes.",
    },
}


def _build_destination_envelope(place_data: dict, venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()

    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "aquatic_center",
            "commitment_tier": "halfday",
            "primary_activity": "family aquatic center visit",
            "best_seasons": ["spring", "summer"],
            "weather_fit_tags": ["indoor-option", "heat-day", "family-daytrip"],
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Public swim access and classes vary by site; confirm current pool hours and registration windows through Gwinnett Parks.",
            "source_url": CATALOG_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": place_data.get("place_type") or place_data.get("place_type"),
                "county": "gwinnett",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "public-pool-and-aquatics-programs",
            "title": "Public pool and aquatics programs",
            "feature_type": "amenity",
            "description": f"{place_data['name']} is one of Gwinnett's aquatic facilities with public swim and family aquatics programming.",
            "url": CATALOG_URL,
            "price_note": "Public access and registration vary by program and season.",
            "is_free": False,
            "sort_order": 10,
        },
    )
    return envelope


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
    if session.get("registrationOver") or session.get("sessionFull"):
        return None

    features = {feature.get("name"): feature.get("value") for feature in session.get("features") or []}
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

    price = session.get("price")
    price_value = float(price) if price is not None else None
    title = f"{(session.get('text') or '').strip()} at {place_data['name']}"
    if not title.strip() or title.startswith(" at "):
        return None

    occurrences = iter_occurrence_dates(start_date, end_date, weekdays, today)
    if not occurrences:
        return None

    description = (
        f"Aquatics fitness class at {place_data['name']} through Gwinnett County Parks & Recreation. "
        "Reserve through the official county catalog for current availability."
    )

    return {
        "title": title,
        "description": description,
        "start_time": start_time,
        "end_time": end_time,
        "venue_data": place_data,
        "weekdays": weekdays,
        "occurrences": occurrences,
        "price_min": price_value,
        "price_max": price_value,
        "price_note": (
            f"Gwinnett Parks currently lists this class at ${price_value:.2f}."
            if price_value is not None
            else "Check Gwinnett Parks for current class pricing."
        ),
        "ticket_url": CATALOG_URL,
        "source_url": CATALOG_URL,
        "raw_text": (
            f"{session.get('text','')} | {features.get('days','')} | {features.get('dates','')} | "
            f"{features.get('times','')} | {place_data['name']}"
        ),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()
    enriched_venue_ids: set[int] = set()
    today = datetime.now().date()

    checkout_key = _get_checkout_key(TENANT_SLUG)
    if not checkout_key:
        logger.error("Gwinnett aquatic fitness crawl aborted: missing checkout key")
        return 0, 0, 0

    tabs = _get_tabs(TENANT_SLUG, checkout_key)
    aquatics_tab_id = next((tab["id"] for tab in tabs if tab.get("label") == TARGET_TAB), None)
    if not aquatics_tab_id:
        logger.error("Gwinnett aquatic fitness crawl aborted: Aquatics tab missing")
        return 0, 0, 0

    groups = _get_groups_for_tab(TENANT_SLUG, checkout_key, str(aquatics_tab_id))
    target_group = next((group for section_name, group in groups if group.get("name") == TARGET_GROUP), None)
    if not target_group:
        logger.error("Gwinnett aquatic fitness crawl aborted: Aquatics Fitness group missing")
        return 0, 0, 0

    sessions = _get_sessions_for_group(
        TENANT_SLUG,
        checkout_key,
        str(aquatics_tab_id),
        str(target_group.get("id")),
        target_group.get("type", ""),
    )

    for session in sessions:
        parsed = parse_session(session, today)
        if not parsed:
            continue

        venue_id = get_or_create_place(parsed["venue_data"])
        if venue_id not in enriched_venue_ids:
            persist_typed_entity_envelope(
                _build_destination_envelope(parsed["venue_data"], venue_id)
            )
            enriched_venue_ids.add(venue_id)

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
                "category": "fitness",
                "subcategory": "fitness.aquatics",
                "tags": [
                    "aquatics",
                    "water-fitness",
                    "fitness-class",
                    "public-fitness",
                    "gwinnett",
                ],
                "price_min": parsed["price_min"],
                "price_max": parsed["price_max"],
                "price_note": parsed["price_note"],
                "is_free": parsed["price_min"] == 0 if parsed["price_min"] is not None else False,
                "source_url": parsed["source_url"],
                "ticket_url": parsed["ticket_url"],
                "image_url": None,
                "raw_text": parsed["raw_text"],
                "extraction_confidence": 0.93,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={DAY_CODES[weekday]}",
                "content_hash": content_hash,
                "is_class": True,
                "class_category": "fitness",
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
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
        logger.info("Removed %s stale Gwinnett aquatic fitness rows", stale_removed)

    logger.info(
        "Gwinnett aquatic fitness crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
