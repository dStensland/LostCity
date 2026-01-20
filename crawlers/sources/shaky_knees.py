"""
Crawler for Shaky Knees Music Festival (shakykneesfestival.com).
Annual indie rock festival at Central Park - May.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.shakykneesfestival.com"

VENUE_DATA = {
    "name": "Central Park Atlanta",
    "slug": "central-park-atlanta",
    "address": "395 Piedmont Ave NE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7649,
    "lng": -84.3778,
    "venue_type": "park",
    "spot_type": "park",
    "website": "https://www.atldistrict.com/central-park",
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Shaky Knees Festival - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Shaky Knees is typically first weekend of May
    # 2026 dates estimated as May 1-3
    if year == 2026:
        start_date = datetime(2026, 5, 1)
        end_date = datetime(2026, 5, 3)
    else:
        # First Friday-Sunday of May
        may_1 = datetime(year, 5, 1)
        days_until_friday = (4 - may_1.weekday()) % 7
        first_friday = may_1 + __import__("datetime").timedelta(days=days_until_friday)
        start_date = first_friday
        end_date = first_friday + __import__("datetime").timedelta(days=2)

    # If past, use next year
    if end_date < now:
        year += 1
        if year == 2026:
            start_date = datetime(2026, 5, 1)
            end_date = datetime(2026, 5, 3)
        else:
            may_1 = datetime(year, 5, 1)
            days_until_friday = (4 - may_1.weekday()) % 7
            first_friday = may_1 + __import__("datetime").timedelta(
                days=days_until_friday
            )
            start_date = first_friday
            end_date = first_friday + __import__("datetime").timedelta(days=2)

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Shaky Knees Music Festival {year}"
    content_hash = generate_content_hash(
        title, "Central Park Atlanta", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Shaky Knees {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "Atlanta's premier indie rock festival featuring 60+ bands across multiple stages over three days in Central Park.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "12:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "23:00",
        "is_all_day": False,
        "category": "music",
        "subcategory": "festival",
        "tags": ["shaky-knees", "music-festival", "indie", "rock", "central-park"],
        "price_min": 150.0,
        "price_max": 400.0,
        "price_note": "Single day and 3-day passes available",
        "is_free": False,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
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
        logger.error(f"Failed to insert Shaky Knees Festival: {e}")

    return events_found, events_new, events_updated
