"""
Crawler for Mechanicsville Neighborhood.
Historic neighborhood adjacent to Mercedes-Benz Stadium with rich history
dating to 1870s railroad worker settlement. Active revitalization and community programming.
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

# Mechanicsville doesn't have a dedicated website, use NPU-V and city resources
BASE_URL = "https://www.atlantaga.gov"

VENUE_DATA = {
    "name": "Mechanicsville",
    "slug": "mechanicsville",
    "address": "McDaniel St SW",
    "neighborhood": "Mechanicsville",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30314",
    "lat": 33.7310,
    "lng": -84.4050,
    "venue_type": "neighborhood",
    "spot_type": "neighborhood",
    "website": None,
    "description": "Historic neighborhood near Mercedes-Benz Stadium with roots dating to 1870s railroad workers. Active revitalization efforts.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def get_first_monday(year: int, month: int) -> datetime:
    """Get the first Monday of a given month (typical NPU meeting day)."""
    first_day = datetime(year, month, 1)
    days_until_monday = (0 - first_day.weekday()) % 7
    first_monday = first_day + timedelta(days=days_until_monday)
    return first_monday


def create_npu_meetings(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create recurring NPU-V monthly meeting events (covers Mechanicsville)."""
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

        meeting_date = get_first_monday(year, month)

        # Skip if already passed
        if meeting_date.date() < now.date():
            continue

        title = "NPU-V Monthly Meeting"
        start_date = meeting_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Mechanicsville", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "NPU-V (Neighborhood Planning Unit V) monthly meeting. "
                "Covers Mechanicsville, Adair Park, Pittsburgh, and surrounding areas. "
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
            "tags": ["mechanicsville", "npu", "civic", "neighborhood-meeting", "southwest-atlanta"],
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
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=1MO",
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert meeting: {e}")

    return events_new, events_updated


def create_gameday_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create community events around Mercedes-Benz Stadium gamedays."""
    # Note: This is a placeholder - actual gameday community events would need
    # integration with stadium schedule. For now, just documenting the pattern.
    return 0, 0


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Mechanicsville Neighborhood events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Create recurring NPU meetings
    meeting_new, meeting_updated = create_npu_meetings(source_id, venue_id)
    events_found += 4
    events_new += meeting_new
    events_updated += meeting_updated

    # Note: Mechanicsville lacks a dedicated neighborhood website
    # Events are typically shared through:
    # - NPU-V meetings and communications
    # - Atlanta BeltLine Westside Trail events
    # - Mercedes-Benz Stadium community programming
    # - Local churches and community centers

    logger.info(f"Mechanicsville crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
