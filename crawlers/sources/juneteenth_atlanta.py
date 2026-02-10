"""
Crawler for Juneteenth Atlanta Parade & Music Festival.
Annual celebration in Piedmont Park - June 18-21.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://juneteenthatl.com"

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

# Juneteenth is June 19 - festival spans around it
KNOWN_DATES = {
    2026: ("2026-06-18", "2026-06-21"),  # June 18-21, 2026
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Juneteenth Atlanta Festival - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Use known dates or estimate around June 19
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
        # Festival spans June 18-21 typically
        start_date = datetime(year, 6, 18)
        end_date = datetime(year, 6, 21)

    # If past, use next year
    if end_date < now:
        year += 1
        if year in KNOWN_DATES:
            start_str, end_str = KNOWN_DATES[year]
            start_date = datetime.strptime(start_str, "%Y-%m-%d")
            end_date = datetime.strptime(end_str, "%Y-%m-%d")
        else:
            start_date = datetime(year, 6, 18)
            end_date = datetime(year, 6, 21)

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Juneteenth Atlanta Parade & Music Festival {year}"
    content_hash = generate_content_hash(
        title, "Piedmont Park", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Juneteenth Atlanta {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "Annual Juneteenth celebration featuring a televised parade, live performances, food vendors, handmade goods, and cultural activities at Piedmont Park. All are welcome.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "10:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "20:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "festival",
        "tags": ["juneteenth", "music-festival", "parade", "cultural", "piedmont-park", "black-history-month"],
        "price_min": None,
        "price_max": None,
        "price_note": "Free admission",
        "is_free": True,
        "source_url": BASE_URL,
        "ticket_url": None,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.90,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=6",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Juneteenth Atlanta: {e}")

    return events_found, events_new, events_updated
