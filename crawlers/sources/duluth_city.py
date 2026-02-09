"""
Crawler for City of Duluth events.
Diverse suburban hub with significant Korean community and Gas South District.
Hosts festivals, cultural celebrations, and community programming.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.duluthga.gov"

VENUE_DATA = {
    "name": "Duluth",
    "slug": "duluth-city",
    "address": "Downtown Duluth",
    "neighborhood": "Duluth",
    "city": "Duluth",
    "state": "GA",
    "zip": "30096",
    "lat": 34.0029,
    "lng": -84.1446,
    "venue_type": "city",
    "spot_type": "city",
    "website": BASE_URL,
    "description": "City of Duluth - diverse Gwinnett suburb with vibrant Korean community, Gas South District, and family programming.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def get_first_saturday(year: int, month: int) -> datetime:
    """Get the first Saturday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    return first_day + timedelta(days=days_until_saturday)


def create_recurring_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create known recurring Duluth events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Duluth Fall Festival (September)
    year = now.year
    if now.month > 9:
        year += 1

    sept_1 = datetime(year, 9, 1)
    days_until_saturday = (5 - sept_1.weekday()) % 7
    first_saturday = sept_1 + timedelta(days=days_until_saturday)
    festival_date = first_saturday + timedelta(days=14)  # Third Saturday

    title = f"Duluth Fall Festival {year}"
    start_date = festival_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Duluth", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Annual Duluth Fall Festival in downtown featuring live music, "
                "food vendors, arts and crafts, kids activities, and community celebration. "
                "Showcasing Duluth's diverse cultural heritage."
            ),
            "start_date": start_date,
            "start_time": "10:00",
            "end_date": None,
            "end_time": "18:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "festival",
            "tags": ["duluth", "festival", "fall", "family-friendly", "outdoor"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": BASE_URL,
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
            logger.error(f"Failed to insert festival: {e}")
    else:
        events_updated += 1

    # Lunar New Year Celebration (January/February)
    # Lunar New Year varies - approximate late January/early February
    lunar_year = now.year
    if now.month > 2:
        lunar_year += 1

    lunar_date = datetime(lunar_year, 2, 1) + timedelta(days=get_first_saturday(lunar_year, 2).day - 1)

    title = f"Duluth Lunar New Year Celebration {lunar_year}"
    start_date = lunar_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Duluth", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Lunar New Year celebration honoring Duluth's vibrant Korean and Asian communities. "
                "Traditional performances, cultural demonstrations, food, and family activities. "
                "A celebration of heritage and community diversity."
            ),
            "start_date": start_date,
            "start_time": "11:00",
            "end_date": None,
            "end_time": "17:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "celebration",
            "tags": ["duluth", "lunar-new-year", "korean", "asian", "cultural", "family-friendly"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": BASE_URL,
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

    # Summer Concert Series (June-August)
    summer_months = [6, 7, 8]
    for month in summer_months:
        if month < now.month and now.year == year:
            continue

        concert_date = get_first_saturday(now.year if month >= now.month else now.year + 1, month)

        if concert_date.date() < now.date():
            continue

        title = "Duluth Summer Concert Series"
        start_date = concert_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Duluth", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        description = (
            "Free outdoor concert in downtown Duluth. "
            "Bring chairs and blankets, enjoy live music and community atmosphere."
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "19:00",
            "end_date": None,
            "end_time": "21:00",
            "is_all_day": False,
            "category": "music",
            "subcategory": "live",
            "tags": ["duluth", "concert", "outdoor", "free", "family-friendly"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": BASE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.75,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY",
            "content_hash": content_hash,
        }

        series_hint = {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "monthly",
            "day_of_week": "Saturday",
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
    """Crawl City of Duluth events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Create recurring events
    recurring_new, recurring_updated = create_recurring_events(source_id, venue_id)
    events_found += 6
    events_new += recurring_new
    events_updated += recurring_updated

    logger.info(f"Duluth City crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
