"""
Crawler for Gwinnett County Parks & Recreation family sensory swim sessions.

Targets the public, dated sensory-friendly swim sessions in the official Rec1
catalog without pulling in the broader county classes and league inventory.
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
TARGET_TAB = "Aquatics"
TARGET_GROUP = "Sensory Swim"
TARGET_SESSION = "Family Sensory Swim"

VENUE_DATA_BY_LOCATION = {
    "bogan park aquatic center": {
        "name": "Bogan Park Aquatic Center",
        "slug": "bogan-park-aquatic-center",
        "address": "2723 N Bogan Rd",
        "neighborhood": "Buford",
        "city": "Buford",
        "state": "GA",
        "zip": "30519",
        "lat": 34.0979,
        "lng": -83.9948,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": CATALOG_URL,
        "description": "Gwinnett County aquatic center hosting public family sensory swim sessions.",
    },
    "bethesda park aquatic center": {
        "name": "Bethesda Park Aquatic Center",
        "slug": "bethesda-park-aquatic-center",
        "address": "225 Bethesda Church Rd",
        "neighborhood": "Lawrenceville",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30044",
        "lat": 33.9211,
        "lng": -84.0299,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": CATALOG_URL,
        "description": "Gwinnett County aquatic center hosting public family sensory swim sessions.",
    },
}


def parse_session(session: dict, today: date) -> dict | None:
    if (session.get("text") or "").strip() != TARGET_SESSION:
        return None
    if session.get("registrationOver"):
        return None

    features = {feature.get("name"): feature.get("value") for feature in session.get("features") or []}
    location = (features.get("location") or "").strip().lower()
    place_data = VENUE_DATA_BY_LOCATION.get(location)
    if not place_data:
        return None

    start_date, _end_date = _parse_date_range(features.get("dates") or "", today)
    if not start_date or start_date < today:
        return None

    start_time, end_time = _parse_time_range(features.get("times") or "")
    if not start_time:
        return None

    price = session.get("price")
    price_value = float(price) if price is not None else None
    title = f"Family Sensory Swim at {place_data['name']}"

    return {
        "title": title,
        "description": (
            f"Family sensory swim session at {place_data['name']} through Gwinnett County Parks & Recreation. "
            "Public low-stimulation pool time for all ages; reserve through the official county catalog."
        ),
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": start_time,
        "end_time": end_time,
        "venue_data": place_data,
        "price_min": price_value,
        "price_max": price_value,
        "price_note": (
            f"Gwinnett Parks currently lists admission at ${price_value:.2f}."
            if price_value is not None
            else "Check Gwinnett Parks for current admission."
        ),
        "ticket_url": CATALOG_URL,
        "source_url": CATALOG_URL,
        "raw_text": f"{TARGET_SESSION} | {features.get('dates','')} | {features.get('times','')} | {place_data['name']}",
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()
    today = datetime.now().date()

    checkout_key = _get_checkout_key(TENANT_SLUG)
    if not checkout_key:
        logger.error("Gwinnett family sensory swim crawl aborted: missing checkout key")
        return 0, 0, 0

    tabs = _get_tabs(TENANT_SLUG, checkout_key)
    aquatics_tab_id = next((tab["id"] for tab in tabs if tab.get("label") == TARGET_TAB), None)
    if not aquatics_tab_id:
        logger.error("Gwinnett family sensory swim crawl aborted: Aquatics tab missing")
        return 0, 0, 0

    groups = _get_groups_for_tab(TENANT_SLUG, checkout_key, str(aquatics_tab_id))
    target_group = next((group for section_name, group in groups if group.get("name") == TARGET_GROUP), None)
    if not target_group:
        logger.error("Gwinnett family sensory swim crawl aborted: Sensory Swim group missing")
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
        events_found += 1

        content_hash = generate_content_hash(
            parsed["title"],
            parsed["venue_data"]["name"],
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
            "category": "sports",
            "subcategory": "swimming",
            "tags": [
                "swimming",
                "aquatics",
                "public-play",
                "family-friendly",
                "sensory-friendly",
                "accessible",
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
            "extraction_confidence": 0.94,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        insert_event(event_record)
        events_new += 1

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale Gwinnett family sensory swim rows", stale_removed)

    logger.info(
        "Gwinnett family sensory swim crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
