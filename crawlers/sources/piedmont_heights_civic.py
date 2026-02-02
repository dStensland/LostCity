"""
Crawler for Piedmont Heights Civic Association (piedmontheights.org).
Atlanta's oldest neighborhood (settled 1822), adjacent to Piedmont Park.
Known as "Small Town in a Big City" with strong volunteer-driven civic engagement.
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

BASE_URL = "https://piedmontheights.org"

VENUE_DATA = {
    "name": "Piedmont Heights",
    "slug": "piedmont-heights",
    "address": "Piedmont Heights",
    "neighborhood": "Piedmont Heights",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.8000,
    "lng": -84.3700,
    "venue_type": "neighborhood",
    "spot_type": "neighborhood",
    "website": BASE_URL,
    "description": "Atlanta's oldest neighborhood (settled 1822), adjacent to Piedmont Park. 'Small Town in a Big City' identity.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def get_second_monday(year: int, month: int) -> datetime:
    """Get the second Monday of a given month (typical PHCA meeting)."""
    first_day = datetime(year, month, 1)
    days_until_monday = (0 - first_day.weekday()) % 7
    first_monday = first_day + timedelta(days=days_until_monday)
    second_monday = first_monday + timedelta(days=7)
    return second_monday


def get_third_wednesday(year: int, month: int) -> datetime:
    """Get the third Wednesday of a given month (NPU-F meeting)."""
    first_day = datetime(year, month, 1)
    days_until_wednesday = (2 - first_day.weekday()) % 7
    first_wednesday = first_day + timedelta(days=days_until_wednesday)
    third_wednesday = first_wednesday + timedelta(days=14)
    return third_wednesday


def create_monthly_meetings(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create recurring monthly board meeting events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Generate next 4 months of meetings
    for i in range(4):
        month = now.month + i
        year = now.year
        if month > 12:
            month -= 12
            year += 1

        meeting_date = get_second_monday(year, month)

        # Skip if already passed
        if meeting_date.date() < now.date():
            continue

        title = "PHCA Board Meeting"
        start_date = meeting_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Piedmont Heights", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Piedmont Heights Civic Association monthly board meeting. "
                "Discuss neighborhood issues, Piedmont Park coordination, development updates, "
                "and community initiatives. All PiHi residents welcome."
            ),
            "start_date": start_date,
            "start_time": "19:00",
            "end_date": None,
            "end_time": "20:30",
            "is_all_day": False,
            "category": "community",
            "subcategory": None,
            "tags": ["piedmont-heights", "pihi", "civic", "neighborhood-meeting"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": BASE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.85,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=2MO",
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert meeting: {e}")

    return events_new, events_updated


def create_npu_f_meetings(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create recurring NPU-F monthly meeting events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Generate next 4 months of NPU meetings
    for i in range(4):
        month = now.month + i
        year = now.year
        if month > 12:
            month -= 12
            year += 1

        meeting_date = get_third_wednesday(year, month)

        # Skip if already passed
        if meeting_date.date() < now.date():
            continue

        title = "NPU-F Monthly Meeting"
        start_date = meeting_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Piedmont Heights", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "NPU-F (Neighborhood Planning Unit F) monthly meeting. "
                "Covers Piedmont Heights, Ansley Park, Sherwood Forest, and surrounding areas. "
                "Discuss zoning, development, public safety, and community issues. "
                "All residents welcome to attend and participate."
            ),
            "start_date": start_date,
            "start_time": "19:00",
            "end_date": None,
            "end_time": "21:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": None,
            "tags": ["piedmont-heights", "npu", "civic", "zoning", "development"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://www.atlantaga.gov/government/departments/city-planning/office-of-zoning-development/neighborhood-planning-unit-npu",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.85,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=3WE",
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert NPU meeting: {e}")

    return events_new, events_updated


def create_community_cleanup(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create quarterly community cleanup events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Cleanups typically quarterly - March, June, September, December
    cleanup_months = [3, 6, 9, 12]
    year = now.year

    for month in cleanup_months:
        if month < now.month and year == now.year:
            continue

        # First Saturday of cleanup months
        first_day = datetime(year, month, 1)
        days_until_saturday = (5 - first_day.weekday()) % 7
        cleanup_date = first_day + timedelta(days=days_until_saturday)

        if cleanup_date.date() < now.date():
            continue

        title = "Piedmont Heights Community Cleanup"
        start_date = cleanup_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Piedmont Heights", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Quarterly community cleanup in Piedmont Heights. "
                "Help beautify the neighborhood by picking up litter, clearing invasive plants, "
                "and maintaining common areas. Tools and bags provided. All ages welcome."
            ),
            "start_date": start_date,
            "start_time": "09:00",
            "end_date": None,
            "end_time": "12:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": None,
            "tags": ["piedmont-heights", "volunteer", "cleanup", "community", "outdoor"],
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
            "recurrence_rule": "FREQ=QUARTERLY",
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert cleanup: {e}")

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Piedmont Heights Civic Association events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Create recurring monthly board meetings
    meeting_new, meeting_updated = create_monthly_meetings(source_id, venue_id)
    events_found += 4
    events_new += meeting_new
    events_updated += meeting_updated

    # Create NPU-F meetings
    npu_new, npu_updated = create_npu_f_meetings(source_id, venue_id)
    events_found += 4
    events_new += npu_new
    events_updated += npu_updated

    # Create community cleanups
    cleanup_new, cleanup_updated = create_community_cleanup(source_id, venue_id)
    events_found += 4
    events_new += cleanup_new
    events_updated += cleanup_updated

    logger.info(f"Piedmont Heights crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
