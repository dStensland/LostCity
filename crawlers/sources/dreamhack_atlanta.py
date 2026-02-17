"""
Crawler for DreamHack Atlanta (dreamhack.com/atlanta).
Gaming lifestyle festival featuring esports, LAN parties, and gaming culture.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://dreamhack.com/atlanta"

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

# Known dates - DreamHack Atlanta varies (was Oct/Nov 2025, May 2026)
KNOWN_DATES = {
    2025: ("2025-10-31", "2025-11-02"),  # Oct 31 - Nov 2, 2025
    2026: ("2026-05-15", "2026-05-17"),  # May 15-17, 2026
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl DreamHack Atlanta - generates annual event."""
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
        # Can't estimate - DreamHack dates vary significantly
        logger.warning(f"No known dates for DreamHack Atlanta {year}")
        return 0, 0, 0

    # If past, use next year
    if end_date < now:
        year += 1
        if year in KNOWN_DATES:
            start_str, end_str = KNOWN_DATES[year]
            start_date = datetime.strptime(start_str, "%Y-%m-%d")
            end_date = datetime.strptime(end_str, "%Y-%m-%d")
        else:
            logger.warning(f"No known dates for DreamHack Atlanta {year}")
            return 0, 0, 0

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"DreamHack Atlanta {year}"
    content_hash = generate_content_hash(
        title, "Georgia World Congress Center", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"DreamHack Atlanta {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "Gaming lifestyle festival featuring esports tournaments, BYOC LAN party, cosplay, artist alley, and the latest in gaming culture. Part of Games Week Georgia.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "10:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "23:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "convention",
        "tags": ["dreamhack", "esports", "gaming", "convention", "lan-party", "cosplay"],
        "price_min": 30.0,
        "price_max": 200.0,
        "price_note": "Day passes and weekend passes available. BYOC seats extra.",
        "is_free": False,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.95,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert DreamHack Atlanta: {e}")

    return events_found, events_new, events_updated
