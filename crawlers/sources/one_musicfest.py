"""
Crawler for ONE Musicfest (onemusicfest.com).
Annual multi-genre music festival at Piedmont Park - typically October.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://onemusicfest.com"

VENUE_DATA = {
    "name": "Piedmont Park",
    "slug": "piedmont-park",
    "address": "1320 Monroe Drive NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "venue_type": "park",
    "spot_type": "park",
    "website": "https://piedmontpark.org",
}

# Known dates
KNOWN_DATES = {
    2025: ("2025-10-25", "2025-10-26"),  # October 25-26, 2025
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl ONE Musicfest - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Use known dates or estimate last weekend of October
    if year in KNOWN_DATES:
        start_str, end_str = KNOWN_DATES[year]
        start_date = datetime.strptime(start_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_str, "%Y-%m-%d")
    elif year + 1 in KNOWN_DATES:
        year = year + 1
        start_str, end_str = KNOWN_DATES[year]
        start_date = datetime.strptime(start_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_str, "%Y-%m-%d")
    else:
        # Last weekend of October
        # Find last Saturday
        oct_31 = datetime(year, 10, 31)
        days_since_sat = (oct_31.weekday() + 2) % 7
        last_saturday = oct_31.replace(day=oct_31.day - days_since_sat)
        start_date = last_saturday
        end_date = last_saturday.replace(day=last_saturday.day + 1)

    # If past, use next year
    if end_date < now:
        year += 1
        if year in KNOWN_DATES:
            start_str, end_str = KNOWN_DATES[year]
            start_date = datetime.strptime(start_str, "%Y-%m-%d")
            end_date = datetime.strptime(end_str, "%Y-%m-%d")

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"ONE Musicfest {year}"
    content_hash = generate_content_hash(
        title, "Piedmont Park", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"ONE Musicfest {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "Atlanta's largest two-day urban progressive music festival celebrating hip-hop, R&B, soul, reggae, and more at Piedmont Park. Over 50,000 fans attend annually.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "12:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "23:00",
        "is_all_day": False,
        "category": "music",
        "subcategory": "festival",
        "tags": ["one-musicfest", "music-festival", "hip-hop", "r&b", "soul", "piedmont-park"],
        "price_min": 100.0,
        "price_max": 350.0,
        "price_note": "Single day and weekend passes available",
        "is_free": False,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.95,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=10",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert ONE Musicfest: {e}")

    return events_found, events_new, events_updated
