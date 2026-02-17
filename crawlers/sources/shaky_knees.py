"""
Crawler for Shaky Knees Music Festival (shakykneesfestival.com).
Annual indie rock festival at Piedmont Park - September (moved from May in 2026).
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.shakykneesfestival.com"

VENUE_DATA = {
    "name": "Piedmont Park",
    "slug": "piedmont-park",
    "address": "1320 Monroe Drive NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7879,
    "lng": -84.3732,
    "venue_type": "park",
    "spot_type": "park",
    "website": "https://piedmontpark.org",
}

# Known dates for upcoming years
KNOWN_DATES = {
    2026: ("2026-09-18", "2026-09-20"),  # Confirmed: Sept 18-20, 2026
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Shaky Knees Festival - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Check if we have known dates
    if year in KNOWN_DATES:
        start_str, end_str = KNOWN_DATES[year]
        start_date = datetime.strptime(start_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_str, "%Y-%m-%d")
    elif year + 1 in KNOWN_DATES:
        # If this year's dates are past, use next year
        year = year + 1
        start_str, end_str = KNOWN_DATES[year]
        start_date = datetime.strptime(start_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_str, "%Y-%m-%d")
    else:
        # Default to third weekend of September
        sept_1 = datetime(year, 9, 1)
        # Find third Friday
        days_until_friday = (4 - sept_1.weekday()) % 7
        first_friday = sept_1.replace(day=1 + days_until_friday)
        third_friday = first_friday.replace(day=first_friday.day + 14)
        start_date = third_friday
        end_date = third_friday.replace(day=third_friday.day + 2)

    # If past, use next year
    if end_date < now:
        year += 1
        if year in KNOWN_DATES:
            start_str, end_str = KNOWN_DATES[year]
            start_date = datetime.strptime(start_str, "%Y-%m-%d")
            end_date = datetime.strptime(end_str, "%Y-%m-%d")
        else:
            sept_1 = datetime(year, 9, 1)
            days_until_friday = (4 - sept_1.weekday()) % 7
            first_friday = sept_1.replace(day=1 + days_until_friday)
            third_friday = first_friday.replace(day=first_friday.day + 14)
            start_date = third_friday
            end_date = third_friday.replace(day=third_friday.day + 2)

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Shaky Knees Music Festival {year}"
    content_hash = generate_content_hash(
        title, "Piedmont Park", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Shaky Knees {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "Atlanta's premier indie rock festival featuring 60+ bands across multiple stages over three days at Piedmont Park.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "12:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "23:00",
        "is_all_day": False,
        "category": "music",
        "subcategory": "festival",
        "tags": ["shaky-knees", "music-festival", "indie", "rock", "piedmont-park"],
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
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=9",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Shaky Knees Festival: {e}")

    return events_found, events_new, events_updated
