"""
Crawler for Sweet Auburn Springfest (sweetauburn.com).
Annual African-American heritage festival - May.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.sweetauburn.com"

VENUE_DATA = {
    "name": "Auburn Avenue",
    "slug": "auburn-avenue",
    "address": "Auburn Ave NE",
    "neighborhood": "Sweet Auburn",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7544,
    "lng": -84.3796,
    "venue_type": "street",
    "spot_type": "street",
    "website": None,
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Sweet Auburn Springfest - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Sweet Auburn Springfest is typically third weekend of May
    may_1 = datetime(year, 5, 1)
    days_until_sat = (5 - may_1.weekday()) % 7
    first_sat = may_1 + __import__("datetime").timedelta(days=days_until_sat)
    third_sat = first_sat + __import__("datetime").timedelta(days=14)
    start_date = third_sat
    end_date = third_sat + __import__("datetime").timedelta(days=1)  # Sat-Sun

    # If past, use next year
    if end_date < now:
        year += 1
        may_1 = datetime(year, 5, 1)
        days_until_sat = (5 - may_1.weekday()) % 7
        first_sat = may_1 + __import__("datetime").timedelta(days=days_until_sat)
        third_sat = first_sat + __import__("datetime").timedelta(days=14)
        start_date = third_sat
        end_date = third_sat + __import__("datetime").timedelta(days=1)

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Sweet Auburn Springfest {year}"
    content_hash = generate_content_hash(
        title, "Auburn Avenue", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Sweet Auburn Springfest {year} already exists")
        return events_found, events_new, events_updated

    description = "Atlanta's largest African-American street festival celebrating the historic Sweet Auburn district with live music, food, art, and cultural performances."

    # Build series_hint
    series_hint = {
        "series_type": "recurring_show",
        "series_title": title,
        "frequency": "annual",
        "description": description,
    }

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "12:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "20:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "festival",
        "tags": [
            "sweet-auburn",
            "springfest",
            "african-american",
            "heritage",
            "music",
            "food",
        ],
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
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=5",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record, series_hint=series_hint)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Sweet Auburn Springfest: {e}")

    return events_found, events_new, events_updated
