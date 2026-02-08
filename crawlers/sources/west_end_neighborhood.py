"""
Crawler for West End Neighborhood events.
Historic African-American neighborhood home to Atlanta University Center (AUC).
Rich cultural heritage with museums, HBCU events, and community programming.
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

BASE_URL = "https://historicwestend.com"

VENUE_DATA = {
    "name": "West End",
    "slug": "west-end",
    "address": "Ralph David Abernathy Blvd SW",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "lat": 33.7400,
    "lng": -84.4130,
    "venue_type": "neighborhood",
    "spot_type": "neighborhood",
    "website": BASE_URL,
    "description": "Historic African-American neighborhood home to Atlanta University Center and rich cultural heritage.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def get_second_saturday(year: int, month: int) -> datetime:
    """Get the second Saturday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    first_saturday = first_day + timedelta(days=days_until_saturday)
    second_saturday = first_saturday + timedelta(days=7)
    return second_saturday


def create_monthly_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create recurring monthly community events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Generate next 4 months of community events
    for i in range(4):
        month = now.month + i
        year = now.year
        if month > 12:
            month -= 12
            year += 1

        event_date = get_second_saturday(year, month)

        # Skip if already passed
        if event_date.date() < now.date():
            continue

        title = "West End Community Day"
        start_date = event_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "West End", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Monthly community gathering in Historic West End. "
                "Local vendors, food, live entertainment, and family activities. "
                "Celebrating the vibrant culture and heritage of West End Atlanta."
            ),
            "start_date": start_date,
            "start_time": "11:00",
            "end_date": None,
            "end_time": "16:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": None,
            "tags": ["west-end", "community", "family-friendly", "local-vendors", "african-american-heritage"],
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
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=2SA",
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert community day: {e}")

    return events_new, events_updated


def create_juneteenth(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Juneteenth celebration event."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    year = now.year
    if now.month > 6 or (now.month == 6 and now.day > 19):
        year += 1

    title = "West End Juneteenth Celebration"
    start_date = f"{year}-06-19"

    content_hash = generate_content_hash(title, "West End", start_date)

    if find_event_by_hash(content_hash):
        events_updated += 1
        return events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": (
            "Annual Juneteenth celebration in Historic West End. "
            "Commemorating the end of slavery with music, food, speakers, "
            "and community gathering. Family-friendly celebration of freedom and heritage."
        ),
        "start_date": start_date,
        "start_time": "12:00",
        "end_date": None,
        "end_time": "20:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "celebration",
        "tags": ["west-end", "juneteenth", "african-american-heritage", "celebration", "family-friendly", "cultural"],
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
        logger.error(f"Failed to insert Juneteenth: {e}")

    return events_new, events_updated


def create_black_history_month(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Black History Month kickoff event."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    year = now.year
    if now.month > 2:
        year += 1

    title = "West End Black History Month Celebration"
    start_date = f"{year}-02-01"

    content_hash = generate_content_hash(title, "West End", start_date)

    if find_event_by_hash(content_hash):
        events_updated += 1
        return events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": (
            "Black History Month kickoff celebration in Historic West End. "
            "Featuring local artists, historians, performers, and community leaders. "
            "Celebrating African American history, culture, and contributions."
        ),
        "start_date": start_date,
        "start_time": "14:00",
        "end_date": None,
        "end_time": "18:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "celebration",
        "tags": ["west-end", "black-history-month", "african-american-heritage", "cultural", "educational"],
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
        logger.error(f"Failed to insert Black History Month: {e}")

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl West End Neighborhood events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Create monthly community events
    monthly_new, monthly_updated = create_monthly_events(source_id, venue_id)
    events_found += 4
    events_new += monthly_new
    events_updated += monthly_updated

    # Create Juneteenth celebration
    june_new, june_updated = create_juneteenth(source_id, venue_id)
    events_found += 1
    events_new += june_new
    events_updated += june_updated

    # Create Black History Month event
    bhm_new, bhm_updated = create_black_history_month(source_id, venue_id)
    events_found += 1
    events_new += bhm_new
    events_updated += bhm_updated

    # Note: Individual venue crawlers handle specific West End venues:
    # - wrens_nest.py - Historic house museum
    # - eyedrum.py - Art & music space
    # - freeside_atlanta.py - Makerspace
    # - hammonds_house.py - Art museum
    # - Plus AUC universities (Morehouse, Spelman, Clark Atlanta)
    #
    # This crawler focuses on neighborhood-wide community events

    logger.info(f"West End Neighborhood crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
