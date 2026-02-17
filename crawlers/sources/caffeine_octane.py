"""
Crawler for Caffeine and Octane car show.
Massive monthly car show at Town Center at Cobb - 2,500+ vehicles, 30,000+ attendees.
First Sunday of every month, FREE admission.
One of the largest recurring car shows in the Southeast.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.caffeine-and-octane.com"

VENUE_DATA = {
    "name": "Town Center at Cobb",
    "slug": "town-center-cobb",
    "address": "400 Barrett Pkwy",
    "neighborhood": "Kennesaw",
    "city": "Kennesaw",
    "state": "GA",
    "zip": "30144",
    "lat": 33.9901,
    "lng": -84.5693,
    "venue_type": "shopping_center",
    "spot_type": "shopping_center",
    "website": BASE_URL,
    "description": "Major Cobb County shopping center hosting the legendary Caffeine and Octane car show.",
}


def get_first_sunday(year: int, month: int) -> datetime:
    """Get the first Sunday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_sunday = (6 - first_day.weekday()) % 7
    return first_day + timedelta(days=days_until_sunday)


def create_monthly_car_shows(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create monthly Caffeine and Octane events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Generate for next 6 months
    for i in range(6):
        month = now.month + i
        year = now.year
        if month > 12:
            month -= 12
            year += 1

        show_date = get_first_sunday(year, month)

        if show_date.date() < now.date():
            continue

        title = "Caffeine and Octane"
        start_date = show_date.strftime("%Y-%m-%d")
        description = (
            "One of the largest recurring car shows in the Southeast. "
            "2,500+ vehicles from classics to exotics, 30,000+ car enthusiasts. "
            "Free admission, free parking. First Sunday of every month."
        )

        content_hash = generate_content_hash(title, "Town Center at Cobb", start_date)


        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "09:00",
            "end_date": None,
            "end_time": "12:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "automotive",
            "tags": ["kennesaw", "car-show", "caffeine-octane", "free", "automotive", "monthly"],
            "price_min": None,
            "price_max": None,
            "price_note": "Free admission and parking",
            "is_free": True,
            "source_url": BASE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.95,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=1SU",
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
    """Crawl Caffeine and Octane events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Monthly car shows
    show_new, show_updated = create_monthly_car_shows(source_id, venue_id)
    events_found += 6
    events_new += show_new
    events_updated += show_updated

    logger.info(f"Caffeine and Octane crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
