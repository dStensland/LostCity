"""
Crawler for AJC Peachtree Road Race (ajc.com/peachtree).
World's largest 10K race on July 4th.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.ajc.com/peachtree"

VENUE_DATA = {
    "name": "Lenox Square",
    "slug": "lenox-square",
    "address": "3393 Peachtree Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30326",
    "lat": 33.8465,
    "lng": -84.3619,
    "venue_type": "shopping",
    "spot_type": "shopping",
    "website": "https://www.simon.com/mall/lenox-square",
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Peachtree Road Race - generates annual event on July 4th."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Peachtree Road Race is always July 4th
    start_date = datetime(year, 7, 4)
    end_date = start_date

    # If past, use next year
    if end_date < now:
        year += 1
        start_date = datetime(year, 7, 4)
        end_date = start_date

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"AJC Peachtree Road Race {year}"
    content_hash = generate_content_hash(
        title, "Lenox Square", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Peachtree Road Race {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "The world's largest 10K race, held every July 4th from Lenox Square to Piedmont Park. An Atlanta tradition since 1970.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "06:30",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "12:00",
        "is_all_day": False,
        "category": "fitness",
        "subcategory": "race",
        "tags": ["peachtree-road-race", "10k", "running", "july-4th", "buckhead"],
        "price_min": 40.0,
        "price_max": 60.0,
        "price_note": "Registration required through lottery",
        "is_free": False,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.95,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=4",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Peachtree Road Race: {e}")

    return events_found, events_new, events_updated
