"""
Crawler for Cheshire Bridge District events.
Atlanta's LGBTQ+ entertainment corridor with nightlife, dining, and unique businesses.
Individual venue crawlers exist (Atlanta Eagle, Lips, The Heretic, etc.) -
this crawler covers district-wide events and community programming.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

VENUE_DATA = {
    "name": "Cheshire Bridge",
    "slug": "cheshire-bridge",
    "address": "Cheshire Bridge Rd NE",
    "neighborhood": "Cheshire Bridge",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.8170,
    "lng": -84.3560,
    "venue_type": "entertainment_district",
    "spot_type": "entertainment_district",
    "website": None,
    "description": "Atlanta's LGBTQ+ entertainment corridor with nightlife venues, drag shows, and unique businesses.",
}


def create_pride_week_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Pride Week district events (October - Atlanta Pride is in October)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Atlanta Pride is typically second weekend of October
    year = now.year
    if now.month > 10:
        year += 1

    first_day = datetime(year, 10, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    first_saturday = first_day + timedelta(days=days_until_saturday)
    pride_saturday = first_saturday + timedelta(days=7)

    # Pride Friday kickoff
    pride_friday = pride_saturday - timedelta(days=1)

    events = [
        {
            "title": "Cheshire Bridge Pride Kickoff",
            "date": pride_friday,
            "time": "21:00",
            "description": (
                "Pride Weekend kicks off on Cheshire Bridge! "
                "Bar crawl through Atlanta's LGBTQ+ entertainment corridor. "
                "Special events at The Heretic, Atlanta Eagle, and Lips Atlanta."
            ),
            "category": "nightlife",
            "subcategory": "bar_crawl",
            "tags": ["cheshire-bridge", "pride", "lgbtq", "nightlife", "bar-crawl"],
        },
    ]

    for event in events:
        start_date = event["date"].strftime("%Y-%m-%d")

        if datetime.strptime(start_date, "%Y-%m-%d").date() < now.date():
            continue

        content_hash = generate_content_hash(event["title"], "Cheshire Bridge", start_date)


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
            "is_free": False,
            "source_url": None,
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.75,
            "is_recurring": False,
            "recurrence_rule": None,
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
            logger.info(f"Added: {event['title']} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {event['title']}: {e}")

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Cheshire Bridge District events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Create Pride Week events
    pride_new, pride_updated = create_pride_week_events(source_id, venue_id)
    events_found += 1
    events_new += pride_new
    events_updated += pride_updated

    # Note: Individual venue crawlers handle specific venue events:
    # - atlanta_eagle.py - Atlanta Eagle events
    # - lips_atlanta.py - Lips drag shows
    # - the_heretic.py - The Heretic events
    # - knock_music_house.py - Live music
    # - tara_theatre.py - Independent cinema
    #
    # This crawler focuses on district-wide events like Pride Weekend

    logger.info(f"Cheshire Bridge District crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
