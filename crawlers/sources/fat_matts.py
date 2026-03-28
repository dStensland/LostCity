"""
Crawler for Fat Matt's Rib Shack (fatmattsribshack.net).
Morningside-Lenox Park blues and BBQ institution since 1990.

Generates recurring nightly live blues events (Tue-Sun).
Fat Matt's is closed Mondays.
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

BASE_URL = "https://www.fatmattsribshack.net"
WEEKS_AHEAD = 6

PLACE_DATA = {
    "name": "Fat Matt's Rib Shack",
    "slug": "fat-matts-rib-shack",
    "address": "1811 Piedmont Ave NE",
    "neighborhood": "Morningside-Lenox Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.8004,
    "lng": -84.3651,
    "place_type": "restaurant",
    "spot_type": "restaurant",
    "website": BASE_URL,
    "vibes": ["blues", "live-music", "bbq", "institution", "no-frills"],
}

WEEKLY_SCHEDULE = [
    {
        "day": 1,  # Tuesday
        "title": "Live Blues at Fat Matt's Rib Shack",
        "description": (
            "Tuesday night live blues at Fat Matt's Rib Shack on Piedmont Ave. "
            "Atlanta's iconic BBQ and blues joint since 1990 — cold beer, ribs, and blues every night."
        ),
        "start_time": "19:30",
        "category": "music",
        "tags": ["blues", "live-music", "bbq", "weekly"],
    },
    {
        "day": 2,  # Wednesday
        "title": "Live Blues at Fat Matt's Rib Shack",
        "description": (
            "Wednesday night live blues at Fat Matt's Rib Shack. "
            "No cover. Rotating blues acts pair with Atlanta's best ribs."
        ),
        "start_time": "19:30",
        "category": "music",
        "tags": ["blues", "live-music", "bbq", "weekly"],
    },
    {
        "day": 3,  # Thursday
        "title": "Live Blues at Fat Matt's Rib Shack",
        "description": (
            "Thursday night live blues at Fat Matt's Rib Shack on Piedmont Ave. "
            "No cover. Blues, brews, and BBQ in Morningside since 1990."
        ),
        "start_time": "19:30",
        "category": "music",
        "tags": ["blues", "live-music", "bbq", "weekly"],
    },
    {
        "day": 4,  # Friday
        "title": "Live Blues at Fat Matt's Rib Shack",
        "description": (
            "Friday night live blues at Fat Matt's Rib Shack. "
            "Two sets of blues starting at 7:30. Atlanta's best ribs and coldest beer."
        ),
        "start_time": "19:30",
        "category": "music",
        "tags": ["blues", "live-music", "bbq", "weekly"],
    },
    {
        "day": 5,  # Saturday
        "title": "Live Blues at Fat Matt's Rib Shack",
        "description": (
            "Saturday night live blues at Fat Matt's Rib Shack on Piedmont Ave. "
            "Atlanta's legendary BBQ and blues institution packs the house every weekend."
        ),
        "start_time": "19:30",
        "category": "music",
        "tags": ["blues", "live-music", "bbq", "weekly"],
    },
    {
        "day": 6,  # Sunday
        "title": "Sunday Blues at Fat Matt's Rib Shack",
        "description": (
            "Sunday evening live blues at Fat Matt's Rib Shack. "
            "Wind down the weekend with ribs and blues on Piedmont Ave."
        ),
        "start_time": "19:00",
        "category": "music",
        "tags": ["blues", "live-music", "bbq", "weekly"],
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
    """Ensure Fat Matt's venue and generate recurring blues events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    logger.info(f"Fat Matt's Rib Shack venue record ensured (ID: {venue_id})")

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
        f"Fat Matt's crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
