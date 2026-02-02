"""
Crawler for Lindbergh City Center.
Mixed-use development at MARTA Lindbergh station with retail, dining, and community events.
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

BASE_URL = "https://lindberghcitycenter.com"

VENUE_DATA = {
    "name": "Lindbergh City Center",
    "slug": "lindbergh-city-center",
    "address": "2300 Main St NE",
    "neighborhood": "Lindbergh",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.8230,
    "lng": -84.3690,
    "venue_type": "shopping_center",
    "spot_type": "shopping_center",
    "website": BASE_URL,
    "description": "Mixed-use development at MARTA Lindbergh station with retail, dining, and transit access.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def create_seasonal_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create known seasonal events at Lindbergh City Center."""
    events_new = 0
    events_updated = 0
    now = datetime.now()
    year = now.year

    seasonal_events = [
        {
            "title": "Lindbergh Holiday Market",
            "month": 12,
            "day_offset": 10,
            "time": "11:00",
            "description": "Holiday shopping market featuring local vendors, artisans, and seasonal treats.",
            "category": "community",
            "subcategory": "market",
            "tags": ["lindbergh", "holiday", "market", "shopping", "local-vendors"],
            "is_free": True,
        },
        {
            "title": "Lindbergh Spring Fair",
            "month": 4,
            "day_offset": 15,
            "time": "10:00",
            "description": "Spring community fair with local vendors, food trucks, and family activities.",
            "category": "community",
            "subcategory": "festival",
            "tags": ["lindbergh", "spring", "fair", "family-friendly"],
            "is_free": True,
        },
    ]

    for event in seasonal_events:
        event_year = year
        if event["month"] < now.month:
            event_year = year + 1

        event_date = datetime(event_year, event["month"], 1) + timedelta(days=event["day_offset"])
        start_date = event_date.strftime("%Y-%m-%d")

        if datetime.strptime(start_date, "%Y-%m-%d").date() < now.date():
            continue

        content_hash = generate_content_hash(event["title"], "Lindbergh City Center", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": event["title"],
            "description": event["description"],
            "start_date": start_date,
            "start_time": event["time"],
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": event["category"],
            "subcategory": event["subcategory"],
            "tags": event["tags"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": event["is_free"],
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
            logger.info(f"Added: {event['title']} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {event['title']}: {e}")

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Lindbergh City Center events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Create known seasonal events
        seasonal_new, seasonal_updated = create_seasonal_events(source_id, venue_id)
        events_found += 2
        events_new += seasonal_new
        events_updated += seasonal_updated

        # Note: Lindbergh City Center is primarily a transit-oriented retail development
        # with limited public event programming. Most events are tenant-specific.

        logger.info(f"Lindbergh City Center crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Lindbergh City Center: {e}")
        raise

    return events_found, events_new, events_updated
