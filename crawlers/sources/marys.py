"""
Crawler for Mary's (East Atlanta queer bar).

Mary's has a recurring weekly schedule rather than one-off events.
This crawler generates weekly events based on their known programming.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

VENUE_DATA = {
    "name": "Mary's",
    "slug": "marys",
    "address": "1267 Glenwood Ave SE",
    "neighborhood": "East Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "bar",
    "website": "https://www.instagram.com/marysatl/",
}

# Weekly schedule - day of week (0=Monday) to event info
WEEKLY_SCHEDULE = [
    {
        "day": 2,  # Wednesday
        "title": "Mary-Oke",
        "description": "Weekly karaoke night at Mary's. Sing your heart out with East Atlanta's queerest crowd.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["karaoke", "lgbtq", "nightlife", "weekly"],
    },
    {
        "day": 3,  # Thursday
        "title": "Drag Nite",
        "description": "Weekly drag show at Mary's featuring local queens and performers.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.drag",
        "tags": ["drag", "lgbtq", "nightlife", "weekly", "drag-show"],
    },
    {
        "day": 4,  # Friday
        "title": "Queer Bait Videos",
        "description": "Friday night video party at Mary's. Queer cinema and music videos on the big screen.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["lgbtq", "nightlife", "weekly", "videos"],
    },
    {
        "day": 5,  # Saturday
        "title": "Saturday Night DJs",
        "description": "Rotating DJs every Saturday night at Mary's. Dance the night away in East Atlanta.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "lgbtq", "nightlife", "weekly", "dancing"],
    },
]

# How many weeks ahead to generate events
WEEKS_AHEAD = 6


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a weekday (0=Monday, 6=Sunday)."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:  # Target day already happened this week
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate recurring weekly events for Mary's."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    logger.info(f"Generating Mary's weekly events for next {WEEKS_AHEAD} weeks")

    for event_template in WEEKLY_SCHEDULE:
        # Find next occurrence of this day
        next_date = get_next_weekday(today, event_template["day"])

        # Generate events for the next N weeks
        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")

            events_found += 1

            content_hash = generate_content_hash(
                event_template["title"],
                "Mary's",
                start_date
            )


            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": event_template["title"],
                "description": event_template["description"],
                "start_date": start_date,
                "start_time": event_template["start_time"],
                "end_date": None,
                "end_time": "03:00",  # Mary's closes at 3AM
                "is_all_day": False,
                "category": event_template["category"],
                "subcategory": event_template["subcategory"],
                "tags": event_template["tags"],
                "price_min": 5.0,
                "price_max": 5.0,
                "price_note": "Free before 9PM, $5 after",
                "is_free": False,
                "source_url": "https://www.instagram.com/marysatl/",
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{event_template['title']} - {start_date}",
                "extraction_confidence": 0.95,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={['MO','TU','WE','TH','FR','SA','SU'][event_template['day']]}",
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            series_hint = {
                "series_type": "recurring_show",
                "series_title": event_template["title"],
                "frequency": "weekly",
                "day_of_week": day_names[event_template["day"]],
                "description": event_template["description"],
            }

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info(f"Added: {event_template['title']} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert {event_template['title']}: {e}")

    logger.info(
        f"Mary's crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
    )

    return events_found, events_new, events_updated
