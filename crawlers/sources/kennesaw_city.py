"""
Crawler for City of Kennesaw events.
Northwest Cobb suburb with historic downtown, Kennesaw State University,
and signature Big Shanty Festival.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.kennesaw-ga.gov"

VENUE_DATA = {
    "name": "Downtown Kennesaw",
    "slug": "downtown-kennesaw",
    "address": "Main Street, Kennesaw",
    "neighborhood": "Kennesaw",
    "city": "Kennesaw",
    "state": "GA",
    "zip": "30144",
    "lat": 34.0234,
    "lng": -84.6155,
    "venue_type": "city",
    "spot_type": "city",
    "website": BASE_URL,
    "description": "Historic downtown Kennesaw with Civil War heritage, festivals, and community events.",
}


def get_third_saturday(year: int, month: int) -> datetime:
    """Get the third Saturday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    first_saturday = first_day + timedelta(days=days_until_saturday)
    return first_saturday + timedelta(days=14)


def get_first_friday(year: int, month: int) -> datetime:
    """Get the first Friday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_friday = (4 - first_day.weekday()) % 7
    return first_day + timedelta(days=days_until_friday)


def create_annual_festivals(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create annual Kennesaw festivals."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Big Shanty Festival (April - major event, 250+ vendors)
    year = now.year
    if now.month > 4:
        year += 1

    # Third weekend of April (Saturday)
    big_shanty_date = get_third_saturday(year, 4)

    title = f"Big Shanty Festival {year}"
    start_date = big_shanty_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Downtown Kennesaw", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Kennesaw's signature spring festival with 250+ arts and crafts booths, "
                "live entertainment, food vendors, parade, and family activities. "
                "Celebrating the city's Civil War heritage and community spirit."
            ),
            "start_date": start_date,
            "start_time": "09:00",
            "end_date": None,
            "end_time": "18:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "festival",
            "tags": ["kennesaw", "festival", "arts-crafts", "family-friendly", "spring"],
            "price_min": None,
            "price_max": None,
            "price_note": "Free admission",
            "is_free": True,
            "source_url": "https://www.kennesaw.com/big-shanty-festival/",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.90,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {e}")
    else:
        events_updated += 1

    # Big Shanty Festival Day 2 (Sunday)
    sunday = big_shanty_date + timedelta(days=1)
    title = f"Big Shanty Festival {year} - Day 2"
    start_date = sunday.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Downtown Kennesaw", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Day 2 of Big Shanty Festival - arts, crafts, entertainment, and food."
            ),
            "start_date": start_date,
            "start_time": "10:00",
            "end_date": None,
            "end_time": "17:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "festival",
            "tags": ["kennesaw", "festival", "arts-crafts", "family-friendly"],
            "price_min": None,
            "price_max": None,
            "price_note": "Free admission",
            "is_free": True,
            "source_url": "https://www.kennesaw.com/big-shanty-festival/",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.90,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {e}")
    else:
        events_updated += 1

    # Taste of Kennesaw (November)
    year = now.year
    if now.month > 11:
        year += 1

    # Second Saturday of November
    nov_1 = datetime(year, 11, 1)
    days_until_saturday = (5 - nov_1.weekday()) % 7
    taste_date = nov_1 + timedelta(days=days_until_saturday + 7)

    title = f"Taste of Kennesaw {year}"
    start_date = taste_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Downtown Kennesaw", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Culinary celebration featuring 30+ local restaurants. "
                "Sample dishes from Kennesaw's best eateries in downtown."
            ),
            "start_date": start_date,
            "start_time": "11:00",
            "end_date": None,
            "end_time": "16:00",
            "is_all_day": False,
            "category": "food_drink",
            "subcategory": "festival",
            "tags": ["kennesaw", "food-festival", "restaurants", "tasting"],
            "price_min": None,
            "price_max": None,
            "price_note": "Tasting tickets required",
            "is_free": False,
            "source_url": "https://www.kennesaw.com/",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.85,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {e}")
    else:
        events_updated += 1

    return events_new, events_updated


def create_first_friday_concerts(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create First Friday Concert Series (May-October)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    concert_months = [5, 6, 7, 8, 9, 10]

    for month in concert_months:
        year = now.year
        if month < now.month:
            year += 1

        concert_date = get_first_friday(year, month)

        if concert_date.date() < now.date():
            continue

        title = "First Friday Concert Series"
        start_date = concert_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Downtown Kennesaw", start_date)

        description = (
            "Free outdoor concert at Depot Park in downtown Kennesaw. "
            "Live music, food trucks, and community gathering."
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "19:00",
            "end_date": None,
            "end_time": "21:30",
            "is_all_day": False,
            "category": "music",
            "subcategory": "live",
            "tags": ["kennesaw", "concert", "outdoor", "free", "first-friday"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://www.kennesaw.com/first-friday-concert-series/",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.80,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=1FR",
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        series_hint = {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "monthly",
            "day_of_week": "Friday",
            "description": description,
        }

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {e}")

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City of Kennesaw events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Annual festivals
    festival_new, festival_updated = create_annual_festivals(source_id, venue_id)
    events_found += 3
    events_new += festival_new
    events_updated += festival_updated

    # First Friday concerts
    concert_new, concert_updated = create_first_friday_concerts(source_id, venue_id)
    events_found += 6
    events_new += concert_new
    events_updated += concert_updated

    logger.info(f"Kennesaw City crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
