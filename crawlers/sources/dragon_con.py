"""
Crawler for Dragon Con (dragoncon.org).
Largest multi-media pop culture convention - 80K+ attendance Labor Day weekend.
"""

from __future__ import annotations

import logging
from datetime import datetime


from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.dragoncon.org"

VENUE_DATA = {
    "name": "Dragon Con",
    "slug": "dragon-con",
    "address": "Downtown Atlanta Hotels",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7590,
    "lng": -84.3880,
    "venue_type": "convention",
    "spot_type": "convention_center",
    "website": BASE_URL,
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Dragon Con - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Dragon Con is always Labor Day weekend (first Monday in September)
    # Find next Labor Day
    now = datetime.now()
    year = now.year

    # Find first Monday of September
    sept_1 = datetime(year, 9, 1)
    days_until_monday = (7 - sept_1.weekday()) % 7
    if sept_1.weekday() == 0:
        labor_day = sept_1
    else:
        labor_day = sept_1.replace(day=1 + days_until_monday)

    # If Labor Day has passed, use next year
    if labor_day < now:
        year += 1
        sept_1 = datetime(year, 9, 1)
        days_until_monday = (7 - sept_1.weekday()) % 7
        if sept_1.weekday() == 0:
            labor_day = sept_1
        else:
            labor_day = sept_1.replace(day=1 + days_until_monday)

    # Dragon Con runs Thursday before Labor Day through Monday
    start_date = labor_day - __import__("datetime").timedelta(days=4)
    end_date = labor_day

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Dragon Con {year}"
    content_hash = generate_content_hash(
        title, "Dragon Con", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Dragon Con {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "The largest multi-media, popular culture convention focusing on science fiction & fantasy, gaming, comics, literature, art, music, and film. 80,000+ attendees across downtown Atlanta hotels.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "10:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "23:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "convention",
        "tags": ["dragon-con", "convention", "sci-fi", "fantasy", "gaming", "cosplay"],
        "price_min": 100,
        "price_max": 200,
        "price_note": "Multi-day passes available",
        "is_free": False,
        "source_url": BASE_URL,
        "ticket_url": f"{BASE_URL}/membership",
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.95,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=9",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Dragon Con: {e}")

    return events_found, events_new, events_updated
