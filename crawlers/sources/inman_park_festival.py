"""
Crawler for Inman Park Festival (inmanparkfestival.org).
Popular annual neighborhood festival with arts, parade, and home tours - April.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://inmanparkfestival.org"

VENUE_DATA = {
    "name": "Inman Park",
    "slug": "inman-park-neighborhood",
    "address": "889 Edgewood Ave NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7594,
    "lng": -84.3535,
    "venue_type": "neighborhood",
    "spot_type": "park",
    "website": BASE_URL,
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Inman Park Festival - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Inman Park Festival is typically last weekend of April
    # 2026 dates are April 24-26 based on research
    if year == 2026:
        start_date = datetime(2026, 4, 24)
        end_date = datetime(2026, 4, 26)
    else:
        # Last Friday-Sunday of April
        april_30 = datetime(year, 4, 30)
        days_back = (april_30.weekday() + 3) % 7  # Days back to Friday
        last_friday = april_30 - __import__("datetime").timedelta(days=days_back)
        start_date = last_friday
        end_date = last_friday + __import__("datetime").timedelta(days=2)

    if end_date < now:
        year += 1
        if year == 2026:
            start_date = datetime(2026, 4, 24)
            end_date = datetime(2026, 4, 26)
        else:
            april_30 = datetime(year, 4, 30)
            days_back = (april_30.weekday() + 3) % 7
            last_friday = april_30 - __import__("datetime").timedelta(days=days_back)
            start_date = last_friday
            end_date = last_friday + __import__("datetime").timedelta(days=2)

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Inman Park Festival {year}"
    content_hash = generate_content_hash(
        title, "Inman Park", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Inman Park Festival {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "Atlanta's oldest neighborhood festival featuring arts and crafts, parade, Tour of Homes, live music, food, and more in historic Inman Park.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "10:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "18:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "festival",
        "tags": ["inman-park", "festival", "art", "parade", "neighborhood"],
        "price_min": None,
        "price_max": None,
        "price_note": "Free admission, Tour of Homes tickets separate",
        "is_free": True,
        "source_url": BASE_URL,
        "ticket_url": None,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.95,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=4",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Inman Park Festival: {e}")

    return events_found, events_new, events_updated
