"""
Crawler for Gwinnett County Waltz Workshop classes.

Targets the public Waltz Workshop sessions in Gwinnett's Rec1 catalog and
emits each dated workshop as a class event.
"""

from __future__ import annotations

import logging
from datetime import date, datetime

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
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
TARGET_GROUP = "Ballroom/Waltz"
TARGET_TITLE = "Waltz Workshop"
PLACE_DATA = {
    "name": "Gwinnett Historic Courthouse",
    "slug": "gwinnett-historic-courthouse",
    "address": "185 W Crogan St",
    "neighborhood": "Lawrenceville",
    "city": "Lawrenceville",
    "state": "GA",
    "zip": "30046",
    "lat": 33.9555,
    "lng": -83.9887,
    "place_type": "historic_site",
    "spot_type": "historic_site",
    "website": CATALOG_URL,
    "description": "Gwinnett County historic venue hosting public ballroom workshops.",
}


def parse_session(session: dict, today: date) -> dict | None:
    if (
        session.get("registrationOver")
        or session.get("sessionFull")
        or session.get("canceled")
    ):
        return None

    raw_title = (session.get("text") or "").strip()
    if raw_title != TARGET_TITLE:
        return None

    features = {feature.get("name"): feature.get("value") for feature in session.get("features") or []}
    location = (features.get("location") or "").strip().lower()
    if location != "gwinnett historic courthouse":
        return None

    start_date, _ = _parse_date_range(features.get("dates") or "", today)
    if not start_date or start_date < today:
        return None

    start_time, end_time = _parse_time_range(features.get("times") or "")
    if not start_time:
        return None

    price = session.get("price")
    price_value = float(price) if price is not None else None
    title = f"Waltz Workshop at {PLACE_DATA['name']}"
    description = (
        f"Public ballroom workshop at {PLACE_DATA['name']} through Gwinnett County Parks & Recreation. "
        "Reserve through the official county catalog for current availability."
    )

    return {
        "title": title,
        "description": description,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": start_time,
        "end_time": end_time,
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
            f"{raw_title} | {features.get('ageGender','')} | {features.get('dates','')} | "
            f"{features.get('times','')} | {PLACE_DATA['name']}"
        ),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()
    seen_session_ids: set[int] = set()
    venue_id = get_or_create_place(PLACE_DATA)
    today = datetime.now().date()

    checkout_key = _get_checkout_key(TENANT_SLUG)
    if not checkout_key:
        logger.error("Gwinnett Waltz Workshop crawl aborted: missing checkout key")
        return 0, 0, 0

    tabs = _get_tabs(TENANT_SLUG, checkout_key)
    tab_id = next((str(tab["id"]) for tab in tabs if tab.get("label") == TARGET_TAB), None)
    if not tab_id:
        logger.error("Gwinnett Waltz Workshop crawl aborted: Classes & Activities tab missing")
        return 0, 0, 0

    groups = _get_groups_for_tab(TENANT_SLUG, checkout_key, tab_id)
    target_group = next((group for _, group in groups if group.get("name") == TARGET_GROUP), None)
    if not target_group:
        logger.error("Gwinnett Waltz Workshop crawl aborted: Ballroom/Waltz group missing")
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

        events_found += 1
        content_hash = generate_content_hash(
            parsed["title"],
            PLACE_DATA["name"],
            parsed["start_date"],
        )
        current_hashes.add(content_hash)

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": parsed["title"],
            "description": parsed["description"],
            "start_date": parsed["start_date"],
            "start_time": parsed["start_time"],
            "end_date": None,
            "end_time": parsed["end_time"],
            "is_all_day": False,
            "category": "fitness",
            "subcategory": "fitness.dance",
            "tags": [
                "dance",
                "ballroom",
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
            "content_hash": content_hash,
            "is_class": True,
            "class_category": "fitness",
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            if smart_update_existing_event(existing, event_record):
                events_updated += 1
            continue

        insert_event(event_record)
        events_new += 1

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Gwinnett Waltz Workshop removed %d stale rows", stale_removed)

    return events_found, events_new, events_updated
