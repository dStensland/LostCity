"""
Crawler for Kirkwood Spring Fling (historickirkwood.org).
Annual May festival with Tour of Homes, live music, and community celebration.
Historic 1899 streetcar suburb experiencing revitalization.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.historickirkwood.org"
FESTIVAL_URL = f"{BASE_URL}/kirkwoodfling"

VENUE_DATA = {
    "name": "Bessie Branham Park",
    "slug": "bessie-branham-park",
    "address": "2051 Delano Dr NE",
    "neighborhood": "Kirkwood",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30317",
    "lat": 33.7560,
    "lng": -84.3180,
    "venue_type": "park",
    "spot_type": "park",
    "website": BASE_URL,
    "description": "7-acre community park and recreation center in historic Kirkwood neighborhood.",
}


def get_third_saturday_may(year: int) -> datetime:
    """Get the third Saturday of May (typical Spring Fling date)."""
    may_1 = datetime(year, 5, 1)
    days_until_saturday = (5 - may_1.weekday()) % 7
    first_saturday = may_1 + timedelta(days=days_until_saturday)
    third_saturday = first_saturday + timedelta(days=14)
    return third_saturday


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Kirkwood Spring Fling - generates annual festival event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Get typical Spring Fling date (third Saturday of May)
    event_date = get_third_saturday_may(year)

    # If this year's festival has passed, generate next year's
    if event_date < now:
        year += 1
        event_date = get_third_saturday_may(year)

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Kirkwood Spring Fling Festival & Tour of Homes {year}"
    start_date = event_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Bessie Branham Park", start_date)

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Kirkwood Spring Fling {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": (
            "Kirkwood's annual Spring Fling festival featuring the Tour of Homes, "
            "live music, kids activities, food trucks, local vendors, and Lanta Gras parade. "
            "Celebrating the historic 1899 streetcar suburb and its vibrant community."
        ),
        "start_date": start_date,
        "start_time": "10:00",
        "end_date": start_date,
        "end_time": "17:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "festival",
        "tags": [
            "kirkwood",
            "festival",
            "spring-fling",
            "tour-of-homes",
            "family-friendly",
            "live-music",
            "neighborhood",
        ],
        "price_min": None,
        "price_max": None,
        "price_note": "Free admission; Tour of Homes tickets separate",
        "is_free": True,
        "source_url": FESTIVAL_URL,
        "ticket_url": FESTIVAL_URL,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.90,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=5;BYDAY=3SA",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Kirkwood Spring Fling: {e}")

    return events_found, events_new, events_updated
