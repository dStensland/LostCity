"""
Crawler for Chomp & Stomp Chili Cookoff & Bluegrass Festival (chompandstomp.com).
Annual November festival in Cabbagetown with 30+ bands, chili competition, and art market.
All proceeds benefit the Cabbagetown Initiative.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://chompandstomp.com"

VENUE_DATA = {
    "name": "Cabbagetown Park",
    "slug": "cabbagetown-park",
    "address": "177 Carroll St SE",
    "neighborhood": "Cabbagetown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7495,
    "lng": -84.3535,
    "venue_type": "park",
    "spot_type": "park",
    "website": "https://cabbagetown.com",
}


def get_first_saturday_november(year: int) -> datetime:
    """Get the first Saturday of November for a given year."""
    nov_1 = datetime(year, 11, 1)
    # Days until Saturday (Saturday = 5)
    days_until_saturday = (5 - nov_1.weekday()) % 7
    return nov_1 + timedelta(days=days_until_saturday)


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Chomp & Stomp - generates annual festival event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Chomp & Stomp is the first Saturday of November
    event_date = get_first_saturday_november(year)

    # If this year's festival has passed, generate next year's
    if event_date < now:
        year += 1
        event_date = get_first_saturday_november(year)

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Chomp & Stomp Chili Cookoff & Bluegrass Festival {year}"
    start_date = event_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Cabbagetown Park", start_date)

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Chomp & Stomp {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": (
            "Atlanta's beloved Chomp & Stomp festival features 30+ bluegrass and Americana bands "
            "across 6 stages, a chili cookoff competition, beer garden, art market, and kids activities. "
            "Free admission - Red Spoon chili tasting passes available. All proceeds benefit the "
            "Cabbagetown Initiative community organization."
        ),
        "start_date": start_date,
        "start_time": "11:00",
        "end_date": start_date,
        "end_time": "19:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "festival",
        "tags": [
            "cabbagetown",
            "festival",
            "bluegrass",
            "chili-cookoff",
            "live-music",
            "family-friendly",
            "free",
        ],
        "price_min": None,
        "price_max": None,
        "price_note": "Free admission; Red Spoon tasting pass ~$10",
        "is_free": True,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.95,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=11;BYDAY=1SA",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Chomp & Stomp: {e}")

    return events_found, events_new, events_updated
