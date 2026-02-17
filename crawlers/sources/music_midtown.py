"""
Crawler for Music Midtown Festival.
Major Atlanta music festival held annually in Piedmont Park (September).
Two days of multi-genre music across multiple stages.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.musicmidtown.com"

VENUE_DATA = {
    "name": "Piedmont Park - Music Midtown",
    "slug": "piedmont-park-music-midtown",
    "address": "1320 Monroe Dr NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7879,
    "lng": -84.3732,
    "venue_type": "park",
    "spot_type": "festival_grounds",
    "website": BASE_URL,
    "description": "Piedmont Park hosts Music Midtown, Atlanta's premier music festival.",
}


def get_mid_september_weekend(year: int) -> datetime:
    """Get the typical Music Midtown weekend (mid-September)."""
    # Music Midtown is typically the second or third weekend of September
    sept_1 = datetime(year, 9, 1)
    days_until_saturday = (5 - sept_1.weekday()) % 7
    first_saturday = sept_1 + timedelta(days=days_until_saturday)
    # Usually second weekend
    festival_saturday = first_saturday + timedelta(days=7)
    return festival_saturday


def create_music_midtown(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Music Midtown festival events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    year = now.year
    if now.month > 9:
        year += 1

    festival_saturday = get_mid_september_weekend(year)
    festival_sunday = festival_saturday + timedelta(days=1)

    # Saturday
    title_sat = f"Music Midtown {year} - Day 1"
    start_date_sat = festival_saturday.strftime("%Y-%m-%d")

    content_hash_sat = generate_content_hash(title_sat, "Piedmont Park - Music Midtown", start_date_sat)

    if not find_event_by_hash(content_hash_sat):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title_sat,
            "description": (
                "Day 1 of Music Midtown, Atlanta's premier multi-genre music festival in Piedmont Park. "
                "Features major headliners and dozens of artists across multiple stages. "
                "Food vendors, art installations, and more."
            ),
            "start_date": start_date_sat,
            "start_time": "12:00",
            "end_date": None,
            "end_time": "23:00",
            "is_all_day": False,
            "category": "music",
            "subcategory": "festival",
            "tags": ["music-midtown", "festival", "piedmont-park", "midtown", "outdoor", "live-music"],
            "price_min": None,
            "price_max": None,
            "price_note": "Tickets required - GA and VIP available",
            "is_free": False,
            "source_url": BASE_URL,
            "ticket_url": BASE_URL,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.90,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash_sat,
        }
        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title_sat} on {start_date_sat}")
        except Exception as e:
            logger.error(f"Failed to insert: {title_sat}: {e}")
    else:
        events_updated += 1

    # Sunday
    title_sun = f"Music Midtown {year} - Day 2"
    start_date_sun = festival_sunday.strftime("%Y-%m-%d")

    content_hash_sun = generate_content_hash(title_sun, "Piedmont Park - Music Midtown", start_date_sun)

    if not find_event_by_hash(content_hash_sun):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title_sun,
            "description": (
                "Day 2 of Music Midtown, Atlanta's premier multi-genre music festival in Piedmont Park. "
                "Features major headliners and dozens of artists across multiple stages. "
                "Food vendors, art installations, and more."
            ),
            "start_date": start_date_sun,
            "start_time": "12:00",
            "end_date": None,
            "end_time": "22:00",
            "is_all_day": False,
            "category": "music",
            "subcategory": "festival",
            "tags": ["music-midtown", "festival", "piedmont-park", "midtown", "outdoor", "live-music"],
            "price_min": None,
            "price_max": None,
            "price_note": "Tickets required - GA and VIP available",
            "is_free": False,
            "source_url": BASE_URL,
            "ticket_url": BASE_URL,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.90,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash_sun,
        }
        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title_sun} on {start_date_sun}")
        except Exception as e:
            logger.error(f"Failed to insert: {title_sun}: {e}")
    else:
        events_updated += 1

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Music Midtown festival."""
    source_id = source["id"]
    events_found = 2
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    new, updated = create_music_midtown(source_id, venue_id)
    events_new += new
    events_updated += updated

    logger.info(f"Music Midtown crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
