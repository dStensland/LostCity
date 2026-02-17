"""
Crawler for Atlanta Jazz Festival (atlantafestivals.com).
Free annual jazz festival in Piedmont Park - Memorial Day weekend.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantafestivals.com/atlanta-jazz-festival"

VENUE_DATA = {
    "name": "Piedmont Park",
    "slug": "piedmont-park",
    "address": "1320 Monroe Dr NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7879,
    "lng": -84.3742,
    "venue_type": "park",
    "spot_type": "park",
    "website": "https://piedmontpark.org",
}


def get_memorial_day(year: int) -> datetime:
    """Get Memorial Day (last Monday of May) for a given year."""
    may_31 = datetime(year, 5, 31)
    # Find last Monday
    days_back = (may_31.weekday() - 0) % 7  # 0 = Monday
    return may_31 - __import__("datetime").timedelta(days=days_back)


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Jazz Festival - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Atlanta Jazz Festival is Memorial Day weekend (Saturday-Monday)
    memorial_day = get_memorial_day(year)
    start_date = memorial_day - __import__("datetime").timedelta(days=2)  # Saturday
    end_date = memorial_day  # Monday

    # If past, use next year
    if end_date < now:
        year += 1
        memorial_day = get_memorial_day(year)
        start_date = memorial_day - __import__("datetime").timedelta(days=2)
        end_date = memorial_day

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Atlanta Jazz Festival {year}"
    content_hash = generate_content_hash(
        title, "Piedmont Park", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Atlanta Jazz Festival {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "The largest free jazz festival in the country, featuring world-class jazz artists over Memorial Day weekend in Piedmont Park.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "12:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "21:00",
        "is_all_day": False,
        "category": "music",
        "subcategory": "festival",
        "tags": ["jazz-festival", "jazz", "piedmont-park", "free", "memorial-day"],
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
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Atlanta Jazz Festival: {e}")

    return events_found, events_new, events_updated
