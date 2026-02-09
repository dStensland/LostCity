"""
Crawler for Side Saddle wine bar on the BeltLine.
Cozy wine bar with live jazz on Thursdays and Sundays.
Generates recurring jazz night events.
"""

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.sidesaddleatl.com"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Side Saddle",
    "slug": "side-saddle",
    "address": "1080 Memorial Drive SE",
    "neighborhood": "Boulevard Heights",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "wine_bar",
    "website": BASE_URL,
}

# Known recurring events
RECURRING_EVENTS = [
    {
        "title": "Thursday Jazz Night",
        "weekday": 3,  # Thursday
        "time": "19:00",
        "description": "Live jazz at Side Saddle wine bar on the BeltLine. Enjoy wine and small plates with live music.",
    },
    {
        "title": "Sunday Jazz Brunch",
        "weekday": 6,  # Sunday
        "time": "12:00",
        "description": "Jazz brunch on the patio at Side Saddle. Live music, wine, and brunch on the BeltLine.",
    },
]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Side Saddle events - generates recurring jazz nights."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    today = datetime.now().date()

    # Generate recurring events for the next 8 weeks
    for recurring in RECURRING_EVENTS:
        weekday = recurring["weekday"]

        # Find next occurrence of this weekday
        days_ahead = weekday - today.weekday()
        if days_ahead < 0:
            days_ahead += 7

        # Generate for 8 weeks
        for week in range(8):
            event_date = today + timedelta(days=days_ahead + (week * 7))
            date_str = event_date.strftime("%Y-%m-%d")

            events_found += 1

            content_hash = generate_content_hash(
                recurring["title"], VENUE_DATA["name"], date_str
            )

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": recurring["title"],
                "description": recurring["description"],
                "start_date": date_str,
                "start_time": recurring["time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "music",
                "subcategory": "jazz",
                "tags": ["music", "jazz", "wine-bar", "beltline", "live-music"],
                "price_min": None,
                "price_max": None,
                "price_note": "No cover",
                "is_free": False,
                "source_url": EVENTS_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": None,
                "extraction_confidence": 0.75,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={['MO','TU','WE','TH','FR','SA','SU'][weekday]}",
                "content_hash": content_hash,
            }

            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            series_hint = {
                "series_type": "recurring_show",
                "series_title": recurring["title"],
                "frequency": "weekly",
                "day_of_week": day_names[weekday],
                "description": recurring["description"],
            }

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.debug(f"Added: {recurring['title']} on {date_str}")
            except Exception as e:
                logger.error(f"Failed to insert {recurring['title']}: {e}")

    logger.info(f"Side Saddle: Found {events_found} events, {events_new} new, {events_updated} existing")
    return events_found, events_new, events_updated
