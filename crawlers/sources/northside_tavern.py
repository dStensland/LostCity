"""
Crawler for Northside Tavern (northsidetavern.com).
West Midtown iconic blues bar — live blues 7 nights a week since 1973.

Generates recurring nightly blues events.
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

BASE_URL = "https://northsidetavern.com"
WEEKS_AHEAD = 6
PLANNING_NOTE = (
    "Use the venue site for nightly cover and lineup details before heading over. "
    "Northside Tavern is a long-running small-room blues bar, so arrival timing matters more "
    "than formal seat selection and nearby street parking is usually part of the plan."
)

PLACE_DATA = {
    "name": "Northside Tavern",
    "slug": "northside-tavern",
    "address": "1058 Howell Mill Rd NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7833,
    "lng": -84.4101,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["blues", "live-music", "dive-bar", "legendary", "west-midtown"],
}

WEEKLY_SCHEDULE = [
    {
        "day": 0,  # Monday
        "title": "Monday Blues Jam at Northside Tavern",
        "description": (
            "Monday blues jam at Northside Tavern on Howell Mill. "
            "Atlanta's iconic blues bar since 1973 — open jam session, all players welcome."
        ),
        "start_time": "21:00",
        "category": "music",
        "tags": ["blues", "jam-session", "live-music", "weekly"],
    },
    {
        "day": 1,  # Tuesday
        "title": "Live Blues Tuesday at Northside Tavern",
        "description": (
            "Tuesday night live blues at Northside Tavern. "
            "No cover. Atlanta's longest-running blues bar keeps the tradition alive seven nights a week."
        ),
        "start_time": "21:00",
        "category": "music",
        "tags": ["blues", "live-music", "free", "weekly"],
        "is_free": True,
    },
    {
        "day": 2,  # Wednesday
        "title": "Live Blues Wednesday at Northside Tavern",
        "description": (
            "Wednesday night live blues at Northside Tavern on Howell Mill. "
            "No cover. Rotating blues acts in Atlanta's most legendary dive bar."
        ),
        "start_time": "21:00",
        "category": "music",
        "tags": ["blues", "live-music", "free", "weekly"],
        "is_free": True,
    },
    {
        "day": 3,  # Thursday
        "title": "Live Blues Thursday at Northside Tavern",
        "description": (
            "Thursday night live blues at Northside Tavern. "
            "No cover. Cold beer and hot blues in West Midtown since 1973."
        ),
        "start_time": "21:00",
        "category": "music",
        "tags": ["blues", "live-music", "free", "weekly"],
        "is_free": True,
    },
    {
        "day": 4,  # Friday
        "title": "Live Blues Friday at Northside Tavern",
        "description": (
            "Friday night live blues at Northside Tavern. "
            "Cover charge. Two sets of blues on Howell Mill — Atlanta's best dive bar stage."
        ),
        "start_time": "21:00",
        "category": "music",
        "tags": ["blues", "live-music", "weekly"],
    },
    {
        "day": 5,  # Saturday
        "title": "Live Blues Saturday at Northside Tavern",
        "description": (
            "Saturday night live blues at Northside Tavern. "
            "Cover charge. The heart of Atlanta's blues scene since 1973."
        ),
        "start_time": "21:00",
        "category": "music",
        "tags": ["blues", "live-music", "weekly"],
    },
    {
        "day": 6,  # Sunday
        "title": "Sunday Blues at Northside Tavern",
        "description": (
            "Sunday afternoon and evening blues at Northside Tavern. "
            "No cover. The week winds down with live blues on Howell Mill."
        ),
        "start_time": "16:00",
        "category": "music",
        "tags": ["blues", "live-music", "free", "weekly"],
        "is_free": True,
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
    """Ensure Northside Tavern venue and generate recurring blues events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    logger.info(f"Northside Tavern venue record ensured (ID: {venue_id})")
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
                "venue_id": venue_id,
                "title": template["title"],
                "description": template["description"],
                "start_date": start_date,
                "start_time": template["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": template["category"],
                "tags": template["tags"],
                "is_free": template.get("is_free", False),
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
        f"Northside Tavern crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
