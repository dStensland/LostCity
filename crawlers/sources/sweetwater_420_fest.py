"""
Crawler for SweetWater 420 Fest (sweetwater420fest.com).
Annual music festival presented by SweetWater Brewing.
Moving to Westside Park in 2026.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://sweetwater420fest.com"

VENUE_DATA = {
    "name": "Westside Park at Bellwood Quarry",
    "slug": "westside-park",
    "address": "1660 Johnson Rd NW",
    "neighborhood": "Westside",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "venue_type": "park",
    "spot_type": "park",
    "website": None,
}

# Known dates
KNOWN_DATES = {
    2026: ("2026-04-17", "2026-04-18"),  # Confirmed: April 17-18, 2026
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl SweetWater 420 Fest - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Use known dates or estimate April 20th weekend
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
        # Weekend closest to April 20
        april_20 = datetime(year, 4, 20)
        # Find nearest Saturday
        days_to_sat = (5 - april_20.weekday()) % 7
        if days_to_sat > 3:
            days_to_sat -= 7
        saturday = april_20.replace(day=april_20.day + days_to_sat)
        start_date = saturday
        end_date = saturday.replace(day=saturday.day + 1)

    # If past, use next year
    if end_date < now:
        year += 1
        if year in KNOWN_DATES:
            start_str, end_str = KNOWN_DATES[year]
            start_date = datetime.strptime(start_str, "%Y-%m-%d")
            end_date = datetime.strptime(end_str, "%Y-%m-%d")

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"SweetWater 420 Fest {year}"
    content_hash = generate_content_hash(
        title, "Westside Park", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"SweetWater 420 Fest {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "Annual music festival presented by SweetWater Brewing featuring live music, craft beer, and good vibes. 2026 marks the 21st year and a new home at Westside Park.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "12:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "22:00",
        "is_all_day": False,
        "category": "music",
        "subcategory": "festival",
        "tags": ["420-fest", "sweetwater", "music-festival", "craft-beer", "westside"],
        "price_min": 50.0,
        "price_max": 150.0,
        "price_note": "Single day and weekend passes available",
        "is_free": False,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
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
        logger.error(f"Failed to insert SweetWater 420 Fest: {e}")

    return events_found, events_new, events_updated
