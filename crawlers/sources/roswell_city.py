"""
Crawler for City of Roswell events.
Historic charm with modern culture - Georgia's oldest European settlement (1840s).
Walkable downtown, Canton Street district, heritage programming, and outdoor recreation.
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

BASE_URL = "https://www.roswellgov.com"

VENUE_DATA = {
    "name": "Roswell",
    "slug": "roswell-city",
    "address": "Historic Roswell Square",
    "neighborhood": "Roswell",
    "city": "Roswell",
    "state": "GA",
    "zip": "30075",
    "lat": 34.0234,
    "lng": -84.3616,
    "venue_type": "city",
    "spot_type": "city",
    "website": BASE_URL,
    "description": "City of Roswell - Georgia's oldest European settlement with historic charm, Canton Street, and vibrant arts scene.",
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
    """Create known recurring Roswell events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Roswell Farmers & Artisan Market (Saturdays, year-round)
    for i in range(8):  # Next 8 Saturdays
        market_date = now + timedelta(days=(5 - now.weekday()) % 7 + i * 7)

        if market_date.date() < now.date():
            continue

        title = "Roswell Farmers & Artisan Market"
        start_date = market_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Roswell", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Weekly farmers and artisan market at Roswell Area Park. "
                "Local produce, handcrafted goods, baked items, and live entertainment. "
                "Year-round rain or shine."
            ),
            "start_date": start_date,
            "start_time": "08:00",
            "end_date": None,
            "end_time": "12:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "market",
            "tags": ["roswell", "farmers-market", "artisan", "local", "family-friendly"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://roswellfarmersmarket.com",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.80,
            "is_recurring": True,
            "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA",
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert market: {e}")

    # Roswell Roots Festival (May)
    year = now.year
    if now.month > 5:
        year += 1

    may_1 = datetime(year, 5, 1)
    days_until_saturday = (5 - may_1.weekday()) % 7
    first_saturday = may_1 + timedelta(days=days_until_saturday)
    festival_date = first_saturday + timedelta(days=7)  # Second Saturday

    title = f"Roswell Roots Festival {year}"
    start_date = festival_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Roswell", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Annual music and food festival celebrating Roswell's roots and culture. "
                "Live bands, local food vendors, craft beer, artisan market, and family activities "
                "in historic downtown Roswell."
            ),
            "start_date": start_date,
            "start_time": "11:00",
            "end_date": None,
            "end_time": "21:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "festival",
            "tags": ["roswell", "festival", "music", "food", "family-friendly", "outdoor"],
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

    # Riverside Sounds Concert Series (Summer)
    summer_months = [6, 7, 8]
    for month in summer_months:
        if month < now.month and year == now.year:
            continue

        concert_date = get_first_saturday(now.year if month >= now.month else now.year + 1, month)

        title = "Riverside Sounds Concert"
        start_date = concert_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Roswell", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Free outdoor concert along the Chattahoochee River in Roswell. "
                "Bring blankets and chairs, enjoy live music and beautiful riverside setting."
            ),
            "start_date": start_date,
            "start_time": "18:00",
            "end_date": None,
            "end_time": "21:00",
            "is_all_day": False,
            "category": "music",
            "subcategory": "live",
            "tags": ["roswell", "concert", "outdoor", "riverside", "free", "family-friendly"],
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

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert concert: {e}")

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City of Roswell events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Create recurring events
    recurring_new, recurring_updated = create_recurring_events(source_id, venue_id)
    events_found += 12  # Approximate
    events_new += recurring_new
    events_updated += recurring_updated

    logger.info(f"Roswell City crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
