"""
Crawler for Snellville Farmers Market.
Weekly Saturday market at Towne Green, June through September.
Local produce, meats, baked goods, and artisan products.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://snellvillefarmersmarket.com"

VENUE_DATA = {
    "name": "Snellville Towne Green",
    "slug": "snellville-towne-green",
    "address": "2342 Oak Road",
    "neighborhood": "Snellville",
    "city": "Snellville",
    "state": "GA",
    "zip": "30078",
    "lat": 33.8612,
    "lng": -84.0168,
    "venue_type": "outdoor_space",
    "spot_type": "outdoor_space",
    "website": BASE_URL,
    "description": "Community green space in downtown Snellville hosting farmers market and events.",
}


def create_farmers_market_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create weekly farmers market events for current season."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Market runs Saturdays, June through September
    # Generate for current/upcoming season
    year = now.year

    # If we're past September, look at next year
    if now.month > 9:
        year += 1

    # Market months: June (6), July (7), August (8), September (9)
    market_months = [6, 7, 8, 9]

    for month in market_months:
        # Skip past months in current year
        if year == now.year and month < now.month:
            continue

        # Get all Saturdays in this month
        first_day = datetime(year, month, 1)

        # Find first Saturday
        days_until_saturday = (5 - first_day.weekday()) % 7
        saturday = first_day + timedelta(days=days_until_saturday)

        # Generate for each Saturday in the month
        while saturday.month == month:
            if saturday.date() < now.date():
                saturday += timedelta(days=7)
                continue

            title = "Snellville Farmers Market"
            start_date = saturday.strftime("%Y-%m-%d")

            content_hash = generate_content_hash(title, "Snellville Towne Green", start_date)

            if find_event_by_hash(content_hash):
                events_updated += 1
                saturday += timedelta(days=7)
                continue

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": (
                    "Weekly farmers market at Snellville Towne Green. "
                    "Fresh local produce, farm-raised meats, baked goods, "
                    "honey, artisan products, and more from local vendors."
                ),
                "start_date": start_date,
                "start_time": "08:30",
                "end_date": None,
                "end_time": "12:30",
                "is_all_day": False,
                "category": "community",
                "subcategory": "market",
                "tags": ["snellville", "farmers-market", "local", "produce", "saturday"],
                "price_min": None,
                "price_max": None,
                "price_note": "Free admission",
                "is_free": True,
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": None,
                "extraction_confidence": 0.90,
                "is_recurring": True,
                "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA",
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert: {e}")

            saturday += timedelta(days=7)

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Snellville Farmers Market events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Weekly farmers market (June-September)
    market_new, market_updated = create_farmers_market_events(source_id, venue_id)
    events_found += market_new + market_updated
    events_new += market_new
    events_updated += market_updated

    logger.info(f"Snellville Farmers Market crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
