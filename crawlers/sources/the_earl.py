"""
Crawler for The EARL (badearl.com).
East Atlanta Village live music dive bar.

Ensures venue record and generates recurring Monday open mic events.
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
from source_destination_sync import ensure_venue_destination_fields

logger = logging.getLogger(__name__)

BASE_URL = "https://badearl.com"
WEEKS_AHEAD = 6
PLANNING_NOTE = (
    "Use The EARL site for nightly doors, ticketing, and room details before heading over. "
    "The venue is a compact East Atlanta club attached to a bar and kitchen, so arriving early "
    "is the easiest way to handle dinner, parking, and a strong spot in the room."
)

PLACE_DATA = {
    "name": "The EARL",
    "slug": "the-earl",
    "address": "488 Flat Shoals Ave SE",
    "neighborhood": "East Atlanta Village",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7408,
    "lng": -84.3425,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["live-music", "dive-bar", "punk", "indie", "east-atlanta"],
}

WEEKLY_SCHEDULE = [
    {
        "day": 0,  # Monday
        "title": "Monday Open Mic",
        "description": (
            "Monday open mic night at The EARL in East Atlanta Village. "
            "One of Atlanta's longest-running open mics — musicians, comedians, "
            "and poets welcome. Sign-up starts at 8PM, show at 9PM."
        ),
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "live-music", "comedy", "weekly"],
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
    """Ensure The EARL venue and generate recurring open mic events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    logger.info(f"The EARL venue record ensured (ID: {venue_id})")
    ensure_venue_destination_fields(venue_id, planning_notes=PLANNING_NOTE)

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in WEEKLY_SCHEDULE:
        next_date = get_next_weekday(today, template["day"])
        day_code = DAY_CODES[template["day"]]
        day_name = DAY_NAMES[template["day"]]

        series_hint = {
            "series_type": "recurring_show",
            "series_title": template["title"],
            "frequency": "weekly",
            "day_of_week": day_name,
            "description": template["description"],
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            hash_key = f"{start_date}|{template['start_time']}"
            content_hash = generate_content_hash(
                template["title"], PLACE_DATA["name"], hash_key
            )

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
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
                "raw_text": f"{template['title']} at The EARL - {start_date}",
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
                insert_event(event_record, series_hint=series_hint, genres=["open-mic"])
                events_new += 1
            except Exception as exc:
                logger.error(f"Failed to insert {template['title']} on {start_date}: {exc}")

    logger.info(
        f"The EARL crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
