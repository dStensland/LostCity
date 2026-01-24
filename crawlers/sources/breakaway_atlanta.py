"""
Crawler for Breakaway Music Festival Atlanta (breakawayfestival.com).
Multi-city EDM and pop music festival.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.breakawayfestival.com/festival/atlanta-2025"

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

# Breakaway varies by year - typically fall
KNOWN_DATES = {
    2025: ("2025-09-26", "2025-09-27"),  # Estimated
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Breakaway Music Festival Atlanta - generates annual event."""
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
        # Can't estimate - Breakaway dates vary
        logger.warning(f"No known dates for Breakaway Atlanta {year}")
        return 0, 0, 0

    # If past, use next year
    if end_date < now:
        year += 1
        if year in KNOWN_DATES:
            start_str, end_str = KNOWN_DATES[year]
            start_date = datetime.strptime(start_str, "%Y-%m-%d")
            end_date = datetime.strptime(end_str, "%Y-%m-%d")
        else:
            logger.warning(f"No known dates for Breakaway Atlanta {year}")
            return 0, 0, 0

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Breakaway Music Festival Atlanta {year}"
    content_hash = generate_content_hash(
        title, "Piedmont Park", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Breakaway Atlanta {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "Multi-genre music festival featuring EDM, pop, and hip-hop artists. Part of the Breakaway festival series touring multiple cities.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "14:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "23:00",
        "is_all_day": False,
        "category": "music",
        "subcategory": "festival",
        "tags": ["breakaway", "music-festival", "edm", "pop", "piedmont-park"],
        "price_min": 80.0,
        "price_max": 200.0,
        "price_note": "Single day and weekend passes available",
        "is_free": False,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.85,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Breakaway Atlanta: {e}")

    return events_found, events_new, events_updated
