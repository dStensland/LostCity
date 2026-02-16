"""
Crawler for Ten Atlanta (Midtown LGBTQ nightclub).

Ten Atlanta has recurring weekly events - this crawler generates them.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

VENUE_DATA = {
    "name": "Ten Atlanta",
    "slug": "ten-atlanta",
    "address": "990 Piedmont Ave NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7827,
    "lng": -84.3788,
    "venue_type": "nightclub",
    "spot_type": "nightclub",
    "website": "https://www.tenatlanta.com/",
    "vibes": ["nightclub", "dance", "lgbtq-friendly", "late-night", "dj"],
}

# Weekly schedule - day of week (0=Monday) to event info
WEEKLY_SCHEDULE = [
    {
        "day": 4,  # Friday
        "title": "Friday Night at Ten Atlanta",
        "description": "Friday night dance party at Ten Atlanta. Midtown's premier LGBTQ nightclub featuring top DJs, state-of-the-art sound and lighting, and multiple levels of dance floors.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["lgbtq", "dance", "dj", "nightlife", "club"],
    },
    {
        "day": 5,  # Saturday
        "title": "Saturday Night at Ten Atlanta",
        "description": "Saturday night dance party at Ten Atlanta. Midtown's premier LGBTQ nightclub featuring top DJs, state-of-the-art sound and lighting, and multiple levels of dance floors.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["lgbtq", "dance", "dj", "nightlife", "club"],
    },
]

WEEKS_AHEAD = 6


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a weekday (0=Monday, 6=Sunday)."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate recurring weekly events for Ten Atlanta."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    logger.info(f"Generating Ten Atlanta weekly events for next {WEEKS_AHEAD} weeks")

    for event_template in WEEKLY_SCHEDULE:
        next_date = get_next_weekday(today, event_template["day"])

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")

            events_found += 1

            content_hash = generate_content_hash(
                event_template["title"],
                "Ten Atlanta",
                start_date
            )

            if find_event_by_hash(content_hash):
                events_updated += 1
                continue

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": event_template["title"],
                "description": event_template["description"],
                "start_date": start_date,
                "start_time": event_template["start_time"],
                "end_date": None,
                "end_time": "03:00",
                "is_all_day": False,
                "category": event_template["category"],
                "subcategory": event_template["subcategory"],
                "tags": event_template["tags"],
                "price_min": 5,
                "price_max": 20,
                "price_note": "Cover charge varies by night",
                "is_free": False,
                "source_url": "https://www.tenatlanta.com/",
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{event_template['title']} - {start_date}",
                "extraction_confidence": 0.95,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={['MO','TU','WE','TH','FR','SA','SU'][event_template['day']]}",
                "content_hash": content_hash,
            }

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
        f"Ten Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
    )

    return events_found, events_new, events_updated
