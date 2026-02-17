"""
Crawler for Downtown Duluth district events.
Historic downtown with restaurants, shops, and community programming.
Growing entertainment district with diverse cultural influences.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

VENUE_DATA = {
    "name": "Downtown Duluth",
    "slug": "downtown-duluth",
    "address": "Main Street, Duluth",
    "neighborhood": "Duluth",
    "city": "Duluth",
    "state": "GA",
    "zip": "30096",
    "lat": 34.0029,
    "lng": -84.1446,
    "venue_type": "entertainment_district",
    "spot_type": "entertainment_district",
    "website": "https://exploreduluth.org",
    "description": "Historic downtown Duluth with restaurants, shops, and vibrant community events.",
}


def get_second_friday(year: int, month: int) -> datetime:
    """Get the second Friday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_friday = (4 - first_day.weekday()) % 7
    first_friday = first_day + timedelta(days=days_until_friday)
    return first_friday + timedelta(days=7)


def create_monthly_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create monthly First Friday/Second Friday events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Duluth Second Friday Art Walk (monthly)
    for i in range(6):
        month = now.month + i
        year = now.year
        if month > 12:
            month -= 12
            year += 1

        event_date = get_second_friday(year, month)

        if event_date.date() < now.date():
            continue

        title = "Duluth Second Friday Art Walk"
        start_date = event_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Downtown Duluth", start_date)


        description = (
            "Monthly art walk through downtown Duluth featuring local galleries, "
            "artists, live music, and special offerings from local shops and restaurants. "
            "Family-friendly evening exploring Duluth's growing arts scene."
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "18:00",
            "end_date": None,
            "end_time": "21:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "art_walk",
            "tags": ["downtown-duluth", "art-walk", "second-friday", "galleries", "free"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://exploreduluth.org",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.80,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=2FR",
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


def create_seasonal_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create seasonal downtown events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Holiday Tree Lighting (December)
    year = now.year
    if now.month == 12 and now.day > 10:
        year += 1

    dec_1 = datetime(year, 12, 1)
    days_until_saturday = (5 - dec_1.weekday()) % 7
    tree_lighting = dec_1 + timedelta(days=days_until_saturday)

    title = "Downtown Duluth Tree Lighting"
    start_date = tree_lighting.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Downtown Duluth", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Annual holiday tree lighting in downtown Duluth. "
                "Live entertainment, Santa, holiday vendors, and festive community celebration."
            ),
            "start_date": start_date,
            "start_time": "17:00",
            "end_date": None,
            "end_time": "20:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "celebration",
            "tags": ["downtown-duluth", "holiday", "tree-lighting", "family-friendly"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://exploreduluth.org",
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
    """Crawl Downtown Duluth events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Monthly art walks
    monthly_new, monthly_updated = create_monthly_events(source_id, venue_id)
    events_found += 6
    events_new += monthly_new
    events_updated += monthly_updated

    # Seasonal events
    seasonal_new, seasonal_updated = create_seasonal_events(source_id, venue_id)
    events_found += 1
    events_new += seasonal_new
    events_updated += seasonal_updated

    logger.info(f"Downtown Duluth crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
