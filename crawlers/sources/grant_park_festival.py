"""
Crawler for Grant Park Summer Shade Festival (summershadefestival.org).
Annual neighborhood arts festival - August.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.summershadefestival.org"

VENUE_DATA = {
    "name": "Grant Park",
    "slug": "grant-park",
    "address": "625 Park Ave SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7360,
    "lng": -84.3700,
    "venue_type": "park",
    "spot_type": "park",
    "website": "https://www.gpconservancy.org",
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Grant Park Summer Shade Festival - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Summer Shade Festival is typically fourth weekend of August
    aug_1 = datetime(year, 8, 1)
    days_until_sat = (5 - aug_1.weekday()) % 7
    first_sat = aug_1 + __import__("datetime").timedelta(days=days_until_sat)
    fourth_sat = first_sat + __import__("datetime").timedelta(days=21)
    start_date = fourth_sat
    end_date = fourth_sat + __import__("datetime").timedelta(days=1)  # Sat-Sun

    # If past, use next year
    if end_date < now:
        year += 1
        aug_1 = datetime(year, 8, 1)
        days_until_sat = (5 - aug_1.weekday()) % 7
        first_sat = aug_1 + __import__("datetime").timedelta(days=days_until_sat)
        fourth_sat = first_sat + __import__("datetime").timedelta(days=21)
        start_date = fourth_sat
        end_date = fourth_sat + __import__("datetime").timedelta(days=1)

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Grant Park Summer Shade Festival {year}"
    content_hash = generate_content_hash(
        title, "Grant Park", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Grant Park Summer Shade Festival {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "Atlanta's second-largest arts festival featuring over 175 artists, live music, food, and children's activities in historic Grant Park.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "10:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "18:00",
        "is_all_day": False,
        "category": "art",
        "subcategory": "festival",
        "tags": ["summer-shade-festival", "grant-park", "art", "family", "music"],
        "price_min": None,
        "price_max": None,
        "price_note": "Free admission",
        "is_free": True,
        "source_url": BASE_URL,
        "ticket_url": None,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.95,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=8",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Grant Park Summer Shade Festival: {e}")

    return events_found, events_new, events_updated
