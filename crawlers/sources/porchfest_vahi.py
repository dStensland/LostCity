"""
Crawler for Porchfest Virginia-Highland (vahi.org/porchfest).
Annual music festival featuring 100+ performances on porches throughout the neighborhood.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.vahi.org/porchfest"

VENUE_DATA = {
    "name": "Virginia-Highland Neighborhood",
    "slug": "virginia-highland",
    "address": "Virginia Ave NE & N Highland Ave NE",
    "neighborhood": "Virginia-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "venue_type": "neighborhood",
    "website": "https://www.vahi.org",
}

# Porchfest is typically mid-May
KNOWN_DATES = {
    2026: "2026-05-16",  # May 16, 2026
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Porchfest Virginia-Highland - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Use known dates or estimate third Saturday of May
    if year in KNOWN_DATES:
        date_str = KNOWN_DATES[year]
        event_date = datetime.strptime(date_str, "%Y-%m-%d")
    elif year + 1 in KNOWN_DATES:
        year = year + 1
        date_str = KNOWN_DATES[year]
        event_date = datetime.strptime(date_str, "%Y-%m-%d")
    else:
        # Third Saturday of May
        may_1 = datetime(year, 5, 1)
        days_until_sat = (5 - may_1.weekday()) % 7
        first_saturday = may_1.replace(day=1 + days_until_sat)
        third_saturday = first_saturday.replace(day=first_saturday.day + 14)
        event_date = third_saturday

    # If past, use next year
    if event_date < now:
        year += 1
        if year in KNOWN_DATES:
            date_str = KNOWN_DATES[year]
            event_date = datetime.strptime(date_str, "%Y-%m-%d")
        else:
            may_1 = datetime(year, 5, 1)
            days_until_sat = (5 - may_1.weekday()) % 7
            first_saturday = may_1.replace(day=1 + days_until_sat)
            third_saturday = first_saturday.replace(day=first_saturday.day + 14)
            event_date = third_saturday

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Porchfest Virginia-Highland {year}"
    content_hash = generate_content_hash(
        title, "Virginia-Highland", event_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Porchfest {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "Annual neighborhood music festival featuring 100+ live performances on porches, driveways, and yards throughout Virginia-Highland. Food trucks, art vendors, and local businesses participate.",
        "start_date": event_date.strftime("%Y-%m-%d"),
        "start_time": "13:00",
        "end_date": None,
        "end_time": "19:00",
        "is_all_day": False,
        "category": "music",
        "subcategory": "festival",
        "tags": ["porchfest", "music-festival", "virginia-highland", "local-music", "neighborhood"],
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
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=5",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Porchfest: {e}")

    return events_found, events_new, events_updated
