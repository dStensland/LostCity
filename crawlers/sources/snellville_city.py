"""
Crawler for City of Snellville events.
East Gwinnett suburb with Snellville Days Festival (30,000+ attendees).
Growing Towne Center development with The Grove mixed-use district.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.snellville.org"

VENUE_DATA = {
    "name": "Snellville",
    "slug": "snellville-city",
    "address": "T.W. Briscoe Park",
    "neighborhood": "Snellville",
    "city": "Snellville",
    "state": "GA",
    "zip": "30078",
    "lat": 33.8573,
    "lng": -84.0199,
    "venue_type": "city",
    "spot_type": "city",
    "website": BASE_URL,
    "description": "East Gwinnett suburb known for Snellville Days Festival, Briscoe Park, and growing Towne Center district.",
}


def get_first_saturday(year: int, month: int) -> datetime:
    """Get the first Saturday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    return first_day + timedelta(days=days_until_saturday)


def create_snellville_days(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Snellville Days Festival (major annual event)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Snellville Days Festival - First weekend of May
    year = now.year
    if now.month > 5:
        year += 1

    first_saturday = get_first_saturday(year, 5)

    # Day 1 - Saturday
    title = f"Snellville Days Festival {year} - Day 1"
    start_date = first_saturday.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Snellville", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Major annual arts and crafts festival at T.W. Briscoe Park. "
                "Over 30,000 visitors enjoy 200+ craft vendors, live entertainment, "
                "carnival rides, food, and family activities. "
                "Ranked Top 20 May tourism event by Southeastern Tourism Society."
            ),
            "start_date": start_date,
            "start_time": "10:00",
            "end_date": None,
            "end_time": "18:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "festival",
            "tags": ["snellville", "festival", "arts-crafts", "family-friendly", "outdoor"],
            "price_min": None,
            "price_max": None,
            "price_note": "Free admission",
            "is_free": True,
            "source_url": f"{BASE_URL}/snellville-days-festival",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.90,
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

    # Day 2 - Sunday
    sunday = first_saturday + timedelta(days=1)
    title = f"Snellville Days Festival {year} - Day 2"
    start_date = sunday.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Snellville", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Day 2 of Snellville Days Festival at T.W. Briscoe Park. "
                "Arts and crafts vendors, live entertainment, carnival rides, and family fun."
            ),
            "start_date": start_date,
            "start_time": "11:00",
            "end_date": None,
            "end_time": "17:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "festival",
            "tags": ["snellville", "festival", "arts-crafts", "family-friendly", "outdoor"],
            "price_min": None,
            "price_max": None,
            "price_note": "Free admission",
            "is_free": True,
            "source_url": f"{BASE_URL}/snellville-days-festival",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.90,
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


def create_seasonal_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create other seasonal Snellville events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Fall Festival (October)
    year = now.year
    if now.month > 10:
        year += 1

    # Third Saturday of October
    oct_1 = datetime(year, 10, 1)
    days_until_saturday = (5 - oct_1.weekday()) % 7
    fall_fest = oct_1 + timedelta(days=days_until_saturday + 14)

    title = f"Snellville Fall Festival {year}"
    start_date = fall_fest.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Snellville", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Fall celebration at Briscoe Park with pumpkin patches, "
                "hay rides, live music, and seasonal activities."
            ),
            "start_date": start_date,
            "start_time": "10:00",
            "end_date": None,
            "end_time": "16:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "festival",
            "tags": ["snellville", "fall", "festival", "family-friendly"],
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

    # Movies in the Park (Summer - June, July, August)
    summer_months = [6, 7, 8]
    for month in summer_months:
        year = now.year
        if month < now.month:
            year += 1

        # Last Friday of month
        if month in [6, 8]:
            last_day = 30
        else:
            last_day = 31

        month_end = datetime(year, month, last_day)
        days_back = (month_end.weekday() + 3) % 7  # Days back to Friday
        movie_date = month_end - timedelta(days=days_back)

        if movie_date.date() < now.date():
            continue

        title = "Movies in the Park"
        start_date = movie_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Snellville", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Free outdoor movie night at Briscoe Park. "
                "Bring blankets and chairs for family-friendly films under the stars."
            ),
            "start_date": start_date,
            "start_time": "20:00",
            "end_date": None,
            "end_time": "22:30",
            "is_all_day": False,
            "category": "film",
            "subcategory": "outdoor",
            "tags": ["snellville", "movies", "outdoor", "free", "family-friendly"],
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
    """Crawl City of Snellville events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Snellville Days Festival (major event)
    days_new, days_updated = create_snellville_days(source_id, venue_id)
    events_found += 2
    events_new += days_new
    events_updated += days_updated

    # Seasonal events
    seasonal_new, seasonal_updated = create_seasonal_events(source_id, venue_id)
    events_found += 4
    events_new += seasonal_new
    events_updated += seasonal_updated

    logger.info(f"Snellville City crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
