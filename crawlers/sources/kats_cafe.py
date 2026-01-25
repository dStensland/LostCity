"""
Crawler for Kat's Cafe - creative space with open mic and live music.
Thursday open mic nights and Saturday live bands in Midtown.
"""

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.katscafe.com"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Kat's Cafe",
    "slug": "kats-cafe",
    "address": "970 Piedmont Avenue NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "restaurant",
    "website": BASE_URL,
}

# Recurring events at Kat's Cafe
RECURRING_EVENTS = [
    {
        "title": "Open Mic Night",
        "weekday": 3,  # Thursday
        "time": "20:00",
        "category": "music",
        "subcategory": "open_mic",
        "tags": ["open-mic", "music", "poetry", "midtown"],
        "description": "Weekly open mic night at Kat's Cafe. Musicians, poets, comedians, and artists welcome to share their talents.",
    },
    {
        "title": "Live Music Saturday",
        "weekday": 5,  # Saturday
        "time": "21:00",
        "category": "music",
        "subcategory": "live_music",
        "tags": ["live-music", "bands", "midtown"],
        "description": "Live bands and performances every Saturday night at Kat's Cafe.",
    },
]


def generate_recurring_events(source_id: int, venue_id: int, weeks_ahead: int = 8) -> list[dict]:
    """Generate recurring events for the next N weeks."""
    events = []
    today = datetime.now()

    for recurring in RECURRING_EVENTS:
        for week in range(weeks_ahead):
            # Calculate the date for this weekday
            days_ahead = recurring["weekday"] - today.weekday()
            if days_ahead < 0:
                days_ahead += 7
            event_date = today + timedelta(days=days_ahead + (week * 7))

            # Skip if in the past
            if event_date.date() < today.date():
                continue

            start_date = event_date.strftime("%Y-%m-%d")
            content_hash = generate_content_hash(recurring["title"], VENUE_DATA["name"], start_date)

            events.append({
                "source_id": source_id,
                "venue_id": venue_id,
                "title": recurring["title"],
                "description": recurring["description"],
                "start_date": start_date,
                "start_time": recurring["time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": recurring["category"],
                "subcategory": recurring["subcategory"],
                "tags": recurring["tags"],
                "price_min": None,
                "price_max": None,
                "price_note": "Check venue for cover",
                "is_free": False,
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"Recurring: {recurring['title']}",
                "extraction_confidence": 0.85,
                "is_recurring": True,
                "recurrence_rule": None,
                "content_hash": content_hash,
            })

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Kat's Cafe events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Generate recurring events
        recurring_events = generate_recurring_events(source_id, venue_id)

        for event_record in recurring_events:
            events_found += 1
            existing = find_event_by_hash(event_record["content_hash"])
            if existing:
                events_updated += 1
                continue

            try:
                insert_event(event_record)
                events_new += 1
            except Exception as e:
                logger.error(f"Failed to insert {event_record['title']}: {e}")

        logger.info(f"Kat's Cafe: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Kat's Cafe: {e}")
        raise

    return events_found, events_new, events_updated
