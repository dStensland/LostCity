"""
Crawler for Painted Park (paintedpark.com).
BeltLine bar in Inman Park, opened October 2024.

Generates recurring Wednesday trivia events.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import (
    get_or_create_place,
    insert_event,
    find_existing_event_for_insert,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.paintedpark.com"
WEEKS_AHEAD = 6

PLACE_DATA = {
    "name": "Painted Park",
    "slug": "painted-park",
    "address": "240 N Highland Ave NE Suite A",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7610,
    "lng": -84.3577,
    "place_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["beltline", "inman-park", "patio", "cocktails", "new-spot"],
}

WEEKLY_SCHEDULE = [
    {
        "day": 2,  # Wednesday
        "title": "Trivia at Painted Park",
        "description": (
            "Wednesday trivia night at Painted Park on the BeltLine in Inman Park. "
            "Pub trivia with craft cocktails at one of the BeltLine's newest bars."
        ),
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "nightlife", "weekly", "beltline", "inman-park"],
    },
]

DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Painted Park venue and generate recurring trivia events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    logger.info(f"Painted Park venue record ensured (ID: {venue_id})")

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in WEEKLY_SCHEDULE:
        next_date = get_next_weekday(today, template["day"])
        day_code = DAY_CODES[template["day"]]
        day_name = DAY_NAMES[template["day"]]

        series_hint = {
            "series_type": "recurring_show",
            "series_title": template["title"],
            "frequency": "weekly",
            "day_of_week": day_name.lower(),
            "description": template["description"],
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(
                template["title"], PLACE_DATA["name"], start_date
            )

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": template["title"],
                "description": template["description"],
                "start_date": start_date,
                "start_time": template["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": template["category"],
                "subcategory": template.get("subcategory"),
                "tags": template["tags"],
                "is_free": True,
                "price_min": None,
                "price_max": None,
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} - {start_date}",
                "extraction_confidence": 0.90,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={day_code}",
                "content_hash": content_hash,
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
            except Exception as exc:
                logger.error(f"Failed to insert {template['title']} on {start_date}: {exc}")

    logger.info(
        f"Painted Park crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
