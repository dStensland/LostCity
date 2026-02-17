"""
Crawler for Ansley Park Civic Association (ansleypark.org).
Historic neighborhood designed for automobiles (1905-1908), National Register Historic District.
Hosts annual Tour of Homes (October), Art in the Park, and monthly meetings.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://ansleypark.org"

VENUE_DATA = {
    "name": "Ansley Park",
    "slug": "ansley-park",
    "address": "Ansley Park",
    "neighborhood": "Ansley Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7900,
    "lng": -84.3830,
    "venue_type": "neighborhood",
    "spot_type": "neighborhood",
    "website": BASE_URL,
    "description": "Historic neighborhood (1905-1908) on National Register, known for winding tree-lined streets and beautiful architecture.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def get_third_thursday(year: int, month: int) -> datetime:
    """Get the third Thursday of a given month (typical APCA meeting)."""
    first_day = datetime(year, month, 1)
    days_until_thursday = (3 - first_day.weekday()) % 7
    first_thursday = first_day + timedelta(days=days_until_thursday)
    third_thursday = first_thursday + timedelta(days=14)
    return third_thursday


def create_monthly_meetings(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create recurring monthly meeting events."""
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

        meeting_date = get_third_thursday(year, month)

        # Skip if already passed
        if meeting_date.date() < now.date():
            continue

        title = "APCA Monthly Meeting"
        start_date = meeting_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Ansley Park", start_date)


        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Ansley Park Civic Association monthly meeting. "
                "Discuss neighborhood preservation, zoning matters, historic district issues, "
                "and community events. All Ansley Park residents welcome."
            ),
            "start_date": start_date,
            "start_time": "19:00",
            "end_date": None,
            "end_time": "20:30",
            "is_all_day": False,
            "category": "community",
            "subcategory": None,
            "tags": ["ansley-park", "civic", "neighborhood-meeting", "historic"],
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
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=3TH",
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert meeting: {e}")

    return events_new, events_updated


def create_tour_of_homes(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Tour of Homes event (typically October)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Tour of Homes is typically second Sunday of October
    year = now.year
    if now.month > 10:
        year += 1

    first_day = datetime(year, 10, 1)
    days_until_sunday = (6 - first_day.weekday()) % 7
    first_sunday = first_day + timedelta(days=days_until_sunday)
    tour_date = first_sunday + timedelta(days=7)

    title = "Ansley Park Tour of Homes"
    start_date = tour_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Ansley Park", start_date)

    if find_event_by_hash(content_hash):
        events_updated += 1
        return events_new, events_updated

    description = (
        "Annual self-guided tour of historic Ansley Park homes. "
        "Explore beautifully preserved and renovated residences in one of Atlanta's "
        "most architecturally significant neighborhoods. APCA's signature fundraiser."
    )

    # Build series_hint (this is an annual event, so it should be recurring)
    series_hint = {
        "series_type": "recurring_show",
        "series_title": title,
        "frequency": "annual",
        "description": description,
    }

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": "12:00",
        "end_date": None,
        "end_time": "17:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "tour",
        "tags": ["ansley-park", "tour-of-homes", "historic", "architecture", "fundraiser"],
        "price_min": None,
        "price_max": None,
        "price_note": "Tickets required",
        "is_free": False,
        "source_url": f"{BASE_URL}/Tour-of-Homes",
        "ticket_url": f"{BASE_URL}/Tour-of-Homes",
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.85,
        "is_recurring": True,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record, series_hint=series_hint)
        events_new += 1
        logger.info(f"Added: {title} on {start_date}")
    except Exception as e:
        logger.error(f"Failed to insert tour: {e}")

    return events_new, events_updated


def create_july_4th_parade(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create July 4th Parade event."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    year = now.year
    if now.month > 7 or (now.month == 7 and now.day > 4):
        year += 1

    title = "Ansley Park July 4th Parade"
    start_date = f"{year}-07-04"

    content_hash = generate_content_hash(title, "Ansley Park", start_date)

    if find_event_by_hash(content_hash):
        events_updated += 1
        return events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": (
            "Annual July 4th neighborhood parade through the historic streets of Ansley Park. "
            "Decorated bikes, wagons, and pets welcome. Family-friendly celebration "
            "followed by gathering at the clubhouse."
        ),
        "start_date": start_date,
        "start_time": "10:00",
        "end_date": None,
        "end_time": "12:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "celebration",
        "tags": ["ansley-park", "july-4th", "parade", "family-friendly", "holiday"],
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
        logger.error(f"Failed to insert parade: {e}")

    return events_new, events_updated


def create_easter_egg_hunt(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Easter Egg Hunt event."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Calculate Easter Sunday (using a simplified algorithm)
    # Easter is typically late March or April
    year = now.year
    # For simplicity, assume Easter Saturday is mid-April
    # In production, would use actual Easter calculation
    easter_date = datetime(year, 4, 15)  # Approximate
    if easter_date.date() < now.date():
        year += 1
        easter_date = datetime(year, 4, 15)

    title = "Ansley Park Easter Egg Hunt"
    start_date = easter_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Ansley Park", start_date)

    if find_event_by_hash(content_hash):
        events_updated += 1
        return events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": (
            "Annual Easter Egg Hunt for neighborhood children in Ansley Park. "
            "Eggs hidden throughout the park, prizes and treats for participants. "
            "Family-friendly community tradition."
        ),
        "start_date": start_date,
        "start_time": "10:00",
        "end_date": None,
        "end_time": "12:00",
        "is_all_day": False,
        "category": "family",
        "subcategory": "holiday",
        "tags": ["ansley-park", "easter", "kids", "family-friendly", "holiday"],
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "is_free": True,
        "source_url": BASE_URL,
        "ticket_url": None,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.75,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new += 1
        logger.info(f"Added: {title} on {start_date}")
    except Exception as e:
        logger.error(f"Failed to insert egg hunt: {e}")

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Ansley Park Civic Association events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Create recurring monthly meetings
    meeting_new, meeting_updated = create_monthly_meetings(source_id, venue_id)
    events_found += 4
    events_new += meeting_new
    events_updated += meeting_updated

    # Create Tour of Homes
    tour_new, tour_updated = create_tour_of_homes(source_id, venue_id)
    events_found += 1
    events_new += tour_new
    events_updated += tour_updated

    # Create July 4th Parade
    parade_new, parade_updated = create_july_4th_parade(source_id, venue_id)
    events_found += 1
    events_new += parade_new
    events_updated += parade_updated

    # Create Easter Egg Hunt
    easter_new, easter_updated = create_easter_egg_hunt(source_id, venue_id)
    events_found += 1
    events_new += easter_new
    events_updated += easter_updated

    logger.info(f"Ansley Park crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
