"""
Crawler for Gwinnett County Basic Meditation workshops.

Targets the public Basic Meditation sessions in Gwinnett's Rec1 wellness
catalog and emits each dated workshop as a wellness class event.
"""

from __future__ import annotations

import logging
from datetime import date, datetime

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
TARGET_TAB = "Wellness"
TARGET_GROUP = "Flexibility/Focus"
TARGET_PREFIX = "Basic Meditation:"
VENUE_DATA = {
    "name": "Community Resource Center at Georgia Belle Court",
    "slug": "community-resource-center-georgia-belle-court",
    "address": "5030 Georgia Belle Ct",
    "neighborhood": "Norcross",
    "city": "Norcross",
    "state": "GA",
    "zip": "30093",
    "lat": 33.9397,
    "lng": -84.2016,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": CATALOG_URL,
    "description": "Gwinnett County community resource center hosting public meditation workshops.",
}


def parse_session(session: dict, today: date) -> dict | None:
    if (
        session.get("registrationOver")
        or session.get("sessionFull")
        or session.get("canceled")
    ):
        return None

    raw_title = (session.get("text") or "").strip()
    if not raw_title.startswith(TARGET_PREFIX):
        return None

    features = {feature.get("name"): feature.get("value") for feature in session.get("features") or []}
    location = (features.get("location") or "").strip().lower()
    if location != "community resource center at georgia belle court":
        return None

    start_date, _ = _parse_date_range(features.get("dates") or "", today)
    if not start_date or start_date < today:
        return None

    start_time, end_time = _parse_time_range(features.get("times") or "")
    if not start_time:
        return None

    price = session.get("price")
    price_value = float(price) if price is not None else None
    title = f"{raw_title} at {VENUE_DATA['name']}"
    description = (
        f"Public meditation workshop at {VENUE_DATA['name']} through Gwinnett County Parks & Recreation. "
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
            f"{features.get('times','')} | {VENUE_DATA['name']}"
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
        logger.error("Gwinnett basic meditation crawl aborted: missing checkout key")
        return 0, 0, 0

    tabs = _get_tabs(TENANT_SLUG, checkout_key)
    tab_id = next((str(tab["id"]) for tab in tabs if tab.get("label") == TARGET_TAB), None)
    if not tab_id:
        logger.error("Gwinnett basic meditation crawl aborted: Wellness tab missing")
        return 0, 0, 0

    groups = _get_groups_for_tab(TENANT_SLUG, checkout_key, tab_id)
    target_group = next((group for _, group in groups if group.get("name") == TARGET_GROUP), None)
    if not target_group:
        logger.error("Gwinnett basic meditation crawl aborted: Flexibility/Focus group missing")
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
            VENUE_DATA["name"],
            parsed["start_date"],
        )
        current_hashes.add(content_hash)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": parsed["title"],
            "description": parsed["description"],
            "start_date": parsed["start_date"],
            "start_time": parsed["start_time"],
            "end_date": None,
            "end_time": parsed["end_time"],
            "is_all_day": False,
            "category": "wellness",
            "subcategory": "wellness.meditation",
            "tags": [
                "meditation",
                "mindfulness",
                "public-wellness",
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
            "class_category": "wellness",
            "content_hash": content_hash,
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
        logger.info("Gwinnett basic meditation removed %d stale rows", stale_removed)

    return events_found, events_new, events_updated
