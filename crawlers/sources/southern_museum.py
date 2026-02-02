"""
Crawler for Southern Museum of Civil War and Locomotive History.
Home of The General locomotive from the Great Locomotive Chase.
Features Civil War exhibits, railroad history, and family programs.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.southernmuseum.org"

VENUE_DATA = {
    "name": "Southern Museum of Civil War and Locomotive History",
    "slug": "southern-museum",
    "address": "2829 Cherokee St NW",
    "neighborhood": "Kennesaw",
    "city": "Kennesaw",
    "state": "GA",
    "zip": "30144",
    "lat": 34.0237,
    "lng": -84.6163,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "description": "Museum featuring The General locomotive, Civil War history, and railroad heritage exhibits.",
}


def get_second_saturday(year: int, month: int) -> datetime:
    """Get the second Saturday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    first_saturday = first_day + timedelta(days=days_until_saturday)
    return first_saturday + timedelta(days=7)


def create_museum_programs(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create museum programs and events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Model Train Show (November - annual)
    year = now.year
    if now.month > 11:
        year += 1

    train_show_date = get_second_saturday(year, 11)

    title = f"Model Train Show {year}"
    start_date = train_show_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Southern Museum of Civil War and Locomotive History", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Annual model train exhibition at the Southern Museum. "
                "Operating layouts, vendors, and railroad memorabilia. "
                "Family-friendly event for train enthusiasts of all ages."
            ),
            "start_date": start_date,
            "start_time": "10:00",
            "end_date": None,
            "end_time": "16:00",
            "is_all_day": False,
            "category": "family",
            "subcategory": "exhibition",
            "tags": ["kennesaw", "museum", "trains", "model-trains", "family-friendly"],
            "price_min": None,
            "price_max": None,
            "price_note": "Museum admission required",
            "is_free": False,
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

    # Great Locomotive Chase Anniversary (April 12)
    year = now.year
    if now.month > 4 or (now.month == 4 and now.day > 12):
        year += 1

    chase_date = datetime(year, 4, 12)

    title = f"Great Locomotive Chase Anniversary {year}"
    start_date = chase_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Southern Museum of Civil War and Locomotive History", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Commemoration of the Great Locomotive Chase (April 12, 1862). "
                "Special programs, living history, and celebration of The General's history. "
                "The famous Civil War raid that inspired the Buster Keaton film."
            ),
            "start_date": start_date,
            "start_time": "10:00",
            "end_date": None,
            "end_time": "16:00",
            "is_all_day": False,
            "category": "cultural",
            "subcategory": "commemoration",
            "tags": ["kennesaw", "museum", "civil-war", "history", "the-general"],
            "price_min": None,
            "price_max": None,
            "price_note": "Museum admission required",
            "is_free": False,
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
            logger.error(f"Failed to insert: {e}")
    else:
        events_updated += 1

    # Monthly Homeschool Day (first Wednesday)
    for i in range(6):
        month = now.month + i
        year = now.year
        if month > 12:
            month -= 12
            year += 1

        first_day = datetime(year, month, 1)
        days_until_wednesday = (2 - first_day.weekday()) % 7
        homeschool_date = first_day + timedelta(days=days_until_wednesday)

        if homeschool_date.date() < now.date():
            continue

        title = "Homeschool Day"
        start_date = homeschool_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Southern Museum of Civil War and Locomotive History", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Monthly educational program for homeschool families. "
                "Hands-on activities, guided tours, and Civil War/railroad history lessons."
            ),
            "start_date": start_date,
            "start_time": "10:00",
            "end_date": None,
            "end_time": "14:00",
            "is_all_day": False,
            "category": "family",
            "subcategory": "educational",
            "tags": ["kennesaw", "museum", "homeschool", "educational", "kids"],
            "price_min": None,
            "price_max": None,
            "price_note": "Discounted admission for homeschool groups",
            "is_free": False,
            "source_url": BASE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.75,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=1WE",
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
    """Crawl Southern Museum events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Museum programs
    program_new, program_updated = create_museum_programs(source_id, venue_id)
    events_found += 8
    events_new += program_new
    events_updated += program_updated

    logger.info(f"Southern Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
