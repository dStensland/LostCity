"""
Crawler for Canton Street District in Roswell.
Historic downtown district with restaurants, boutiques, galleries, and entertainment.
Known for walkable charm, antique shops, and vibrant dining scene.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

VENUE_DATA = {
    "name": "Canton Street",
    "slug": "canton-street-roswell",
    "address": "Canton St, Roswell",
    "neighborhood": "Roswell",
    "city": "Roswell",
    "state": "GA",
    "zip": "30075",
    "lat": 34.0230,
    "lng": -84.3580,
    "venue_type": "entertainment_district",
    "spot_type": "entertainment_district",
    "website": "https://www.visitroswellga.com/canton-street",
    "description": "Historic downtown Roswell's main street with restaurants, boutiques, galleries, and walkable charm.",
}


def get_third_thursday(year: int, month: int) -> datetime:
    """Get the third Thursday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_thursday = (3 - first_day.weekday()) % 7
    first_thursday = first_day + timedelta(days=days_until_thursday)
    return first_thursday + timedelta(days=14)


def create_alive_after_five(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Alive After 5 events (third Thursday, April-October)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    alive_months = [4, 5, 6, 7, 8, 9, 10]
    year = now.year

    for month in alive_months:
        if month < now.month and year == now.year:
            continue

        event_date = get_third_thursday(year, month)

        if event_date.date() < now.date():
            continue

        title = "Alive After 5 on Canton Street"
        start_date = event_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Canton Street", start_date)


        description = (
            "Monthly street festival on Canton Street featuring live music, "
            "outdoor dining, art vendors, and special promotions from local shops. "
            "The street comes alive with entertainment and community celebration."
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "17:00",
            "end_date": None,
            "end_time": "21:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "festival",
            "tags": ["canton-street", "roswell", "alive-after-5", "live-music", "outdoor", "dining"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://www.visitroswellga.com",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.85,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=3TH",
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
            "day_of_week": "Thursday",
            "description": description,
        }

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {e}")

    return events_new, events_updated


def create_holiday_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Canton Street holiday events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    year = now.year
    if now.month == 12 and now.day > 15:
        year += 1

    # Tree Lighting (first Friday of December)
    dec_1 = datetime(year, 12, 1)
    days_until_friday = (4 - dec_1.weekday()) % 7
    tree_lighting = dec_1 + timedelta(days=days_until_friday)

    title = "Canton Street Tree Lighting"
    start_date = tree_lighting.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Canton Street", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Annual holiday tree lighting ceremony on Canton Street. "
                "Live entertainment, Santa, hot cocoa, holiday shopping, "
                "and festive community celebration in historic downtown Roswell."
            ),
            "start_date": start_date,
            "start_time": "18:00",
            "end_date": None,
            "end_time": "21:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "celebration",
            "tags": ["canton-street", "roswell", "holiday", "tree-lighting", "family-friendly"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://www.visitroswellga.com",
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


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Canton Street District events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Alive After 5 events
    alive_new, alive_updated = create_alive_after_five(source_id, venue_id)
    events_found += 7
    events_new += alive_new
    events_updated += alive_updated

    # Holiday events
    holiday_new, holiday_updated = create_holiday_events(source_id, venue_id)
    events_found += 1
    events_new += holiday_new
    events_updated += holiday_updated

    logger.info(f"Canton Street crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
