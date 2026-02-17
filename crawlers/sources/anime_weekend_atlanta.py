"""
Crawler for Anime Weekend Atlanta (awa-con.com).
Annual 24-hour anime convention at Georgia World Congress Center.
Typically held in late October/early November.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://awa-con.com"

VENUE_DATA = {
    "name": "Georgia World Congress Center",
    "slug": "gwcc",
    "address": "285 Andrew Young International Blvd NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "venue_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://www.gwcca.org",
}

# Known dates - AWA is typically late October/early November
KNOWN_DATES = {
    2025: ("2025-10-30", "2025-11-02"),  # Estimated
    2026: ("2026-10-29", "2026-11-01"),  # Estimated
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Anime Weekend Atlanta - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Use known dates
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
        # Last Thursday-Sunday of October/first of November
        oct_31 = datetime(year, 10, 31)
        days_since_thu = (oct_31.weekday() + 4) % 7
        last_thursday = oct_31.replace(day=oct_31.day - days_since_thu)
        start_date = last_thursday
        end_date = last_thursday.replace(day=last_thursday.day + 3)

    # If past, use next year
    if end_date < now:
        year += 1
        if year in KNOWN_DATES:
            start_str, end_str = KNOWN_DATES[year]
            start_date = datetime.strptime(start_str, "%Y-%m-%d")
            end_date = datetime.strptime(end_str, "%Y-%m-%d")

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Anime Weekend Atlanta {year}"
    content_hash = generate_content_hash(
        title, "Georgia World Congress Center", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Anime Weekend Atlanta {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "Atlanta's premier 24-hour anime convention featuring Japanese animation, manga, cosplay, concerts, gaming, and late-night programming for adult fans.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "14:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "18:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "convention",
        "tags": ["awa", "anime", "convention", "cosplay", "gaming", "manga", "japan"],
        "price_min": 60.0,
        "price_max": 100.0,
        "price_note": "Weekend passes available, Friday-only badges also offered",
        "is_free": False,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.90,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=10",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Anime Weekend Atlanta: {e}")

    return events_found, events_new, events_updated
