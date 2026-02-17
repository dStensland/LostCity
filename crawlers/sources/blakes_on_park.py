"""
Crawler for Blake's on the Park (Midtown LGBTQ bar).

Blake's has recurring weekly events - this crawler generates them.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

VENUE_DATA = {
    "name": "Blake's on the Park",
    "slug": "blakes-on-park",
    "address": "227 10th St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7815,
    "lng": -84.3795,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": "https://www.blakesonthepark.com/",
    "vibes": ["lgbtq-friendly", "nightlife", "dance", "late-night"],
}

# Weekly schedule - day of week (0=Monday) to event info
WEEKLY_SCHEDULE = [
    {
        "day": 1,  # Tuesday
        "title": "Latino Tuesdays",
        "description": "Weekly Latin night at Blake's on the Park. Latin music, dancing, and drink specials in Midtown's gayborhood.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["lgbtq", "latin", "dancing", "nightlife", "weekly"],
    },
    {
        "day": 3,  # Thursday
        "title": "Atlanta's Angels",
        "description": "Weekly drag show at Blake's on the Park featuring Atlanta's finest queens. An Atlanta landmark since 1988.",
        "start_time": "23:00",
        "category": "nightlife",
        "subcategory": "nightlife.drag",
        "tags": ["lgbtq", "drag", "drag-show", "nightlife", "weekly"],
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
    """Generate recurring weekly events for Blake's on the Park."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    logger.info(f"Generating Blake's weekly events for next {WEEKS_AHEAD} weeks")

    for event_template in WEEKLY_SCHEDULE:
        next_date = get_next_weekday(today, event_template["day"])

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")

            events_found += 1

            content_hash = generate_content_hash(
                event_template["title"],
                "Blake's on the Park",
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
                "end_time": "03:00",
                "is_all_day": False,
                "category": event_template["category"],
                "subcategory": event_template["subcategory"],
                "tags": event_template["tags"],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": "https://www.instagram.com/blakesatl/",
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
        f"Blake's crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
    )

    return events_found, events_new, events_updated
