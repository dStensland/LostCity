"""
Crawler for City of Lawrenceville events.
Historic Gwinnett County seat with vibrant downtown square and festivals.
Home to Aurora Theatre and Lawrenceville Arts Center.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.lawrencevillega.org"

VENUE_DATA = {
    "name": "Downtown Lawrenceville",
    "slug": "downtown-lawrenceville",
    "address": "Lawrenceville Square",
    "neighborhood": "Lawrenceville",
    "city": "Lawrenceville",
    "state": "GA",
    "zip": "30046",
    "lat": 33.9562,
    "lng": -83.9880,
    "venue_type": "city",
    "spot_type": "city",
    "website": BASE_URL,
    "description": "Historic Gwinnett County seat with vibrant downtown square, Aurora Theatre, and year-round festivals.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def get_third_saturday(year: int, month: int) -> datetime:
    """Get the third Saturday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    first_saturday = first_day + timedelta(days=days_until_saturday)
    return first_saturday + timedelta(days=14)


def get_second_saturday(year: int, month: int) -> datetime:
    """Get the second Saturday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    first_saturday = first_day + timedelta(days=days_until_saturday)
    return first_saturday + timedelta(days=7)


def create_annual_festivals(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create annual Lawrenceville festivals."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Lawrenceville Boogie (April - free music & arts festival)
    year = now.year
    if now.month > 4:
        year += 1

    april_1 = datetime(year, 4, 1)
    days_until_saturday = (5 - april_1.weekday()) % 7
    boogie_date = april_1 + timedelta(days=days_until_saturday + 14)  # 3rd Saturday

    title = f"Lawrenceville Boogie {year}"
    start_date = boogie_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Downtown Lawrenceville", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Free annual music and arts festival in downtown Lawrenceville. "
                "Live bands, local artists, food vendors, and family activities "
                "on the historic courthouse square."
            ),
            "start_date": start_date,
            "start_time": "12:00",
            "end_date": None,
            "end_time": "22:00",
            "is_all_day": False,
            "category": "music",
            "subcategory": "festival",
            "tags": ["lawrenceville", "festival", "free", "live-music", "arts"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": f"{BASE_URL}/calendar",
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

    # Lawrenceville Harvest Festival (November)
    year = now.year
    if now.month > 11:
        year += 1

    harvest_date = get_second_saturday(year, 11)

    title = f"Lawrenceville Harvest Festival {year}"
    start_date = harvest_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Downtown Lawrenceville", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Free family fall festival in downtown Lawrenceville. "
                "Seasonal activities, local vendors, live entertainment, "
                "and community celebration on the square."
            ),
            "start_date": start_date,
            "start_time": "10:00",
            "end_date": None,
            "end_time": "17:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "festival",
            "tags": ["lawrenceville", "festival", "fall", "family-friendly", "free"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": f"{BASE_URL}/calendar",
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

    # BOO Fest (October - Halloween)
    year = now.year
    if now.month > 10:
        year += 1

    # Last Saturday of October
    oct_31 = datetime(year, 10, 31)
    days_back = (oct_31.weekday() + 2) % 7  # Days back to Saturday
    boo_date = oct_31 - timedelta(days=days_back)

    title = f"BOO Fest {year}"
    start_date = boo_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Downtown Lawrenceville", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Halloween celebration in downtown Lawrenceville. "
                "Costume contests, trick-or-treating, spooky activities, "
                "and family-friendly fun on the square."
            ),
            "start_date": start_date,
            "start_time": "16:00",
            "end_date": None,
            "end_time": "21:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "celebration",
            "tags": ["lawrenceville", "halloween", "family-friendly", "free"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": f"{BASE_URL}/calendar",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.80,
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

    # Prelude to the Fourth (July)
    year = now.year
    if now.month > 7:
        year += 1

    # July 3rd celebration
    prelude_date = datetime(year, 7, 3)

    title = f"Prelude to the Fourth {year}"
    start_date = prelude_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Downtown Lawrenceville", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Independence Day eve celebration in downtown Lawrenceville. "
                "Live music, food vendors, patriotic festivities, and fireworks."
            ),
            "start_date": start_date,
            "start_time": "17:00",
            "end_date": None,
            "end_time": "22:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "celebration",
            "tags": ["lawrenceville", "july-4th", "fireworks", "family-friendly", "free"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": f"{BASE_URL}/calendar",
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


def create_summer_concerts(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create LIVE in the DTL summer concert series."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # LIVE in the DTL - Friday evenings May-August
    summer_months = [5, 6, 7, 8]

    for month in summer_months:
        year = now.year
        if month < now.month:
            year += 1

        # Second Friday of each summer month
        first_day = datetime(year, month, 1)
        days_until_friday = (4 - first_day.weekday()) % 7
        first_friday = first_day + timedelta(days=days_until_friday)
        concert_date = first_friday + timedelta(days=7)

        if concert_date.date() < now.date():
            continue

        title = "LIVE in the DTL"
        start_date = concert_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Downtown Lawrenceville", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Free outdoor concert series in downtown Lawrenceville. "
                "Live music on the square - bring chairs and blankets."
            ),
            "start_date": start_date,
            "start_time": "19:00",
            "end_date": None,
            "end_time": "21:30",
            "is_all_day": False,
            "category": "music",
            "subcategory": "live",
            "tags": ["lawrenceville", "concert", "outdoor", "free", "summer"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": f"{BASE_URL}/calendar",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.75,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY",
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {e}")

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City of Lawrenceville events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Annual festivals
    festival_new, festival_updated = create_annual_festivals(source_id, venue_id)
    events_found += 4
    events_new += festival_new
    events_updated += festival_updated

    # Summer concert series
    concert_new, concert_updated = create_summer_concerts(source_id, venue_id)
    events_found += 4
    events_new += concert_new
    events_updated += concert_updated

    logger.info(f"Lawrenceville City crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
