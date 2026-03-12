"""
Crawler for Wrecking Bar Brewpub (wreckingbarbrewpub.com).
Inman Park brewpub in historic home.

Generates recurring Tuesday trivia events.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import (
    get_or_create_venue,
    insert_event,
    find_existing_event_for_insert,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://wreckingbarbrewpub.com"
WEEKS_AHEAD = 6

VENUE_DATA = {
    "name": "Wrecking Bar Brewpub",
    "slug": "wrecking-bar-brewpub",
    "address": "292 Moreland Ave NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7608,
    "lng": -84.3537,
    "venue_type": "brewery",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["craft-beer", "brewery", "gastropub", "historic", "inman-park"],
}

WEEKLY_SCHEDULE = [
    {
        "day": 1,  # Tuesday
        "title": "Trivia at Wrecking Bar",
        "description": (
            "Tuesday trivia night at Wrecking Bar Brewpub in Inman Park. "
            "Award-winning house-brewed beers and pub trivia in a historic Victorian home."
        ),
        "start_time": "19:30",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "nightlife", "weekly", "craft-beer", "brewery"],
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
    """Ensure Wrecking Bar Brewpub venue and generate recurring trivia events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    logger.info(f"Wrecking Bar Brewpub venue record ensured (ID: {venue_id})")

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
                template["title"], VENUE_DATA["name"], start_date
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
                "raw_text": f"{template['title']} at Wrecking Bar Brewpub - {start_date}",
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
        f"Wrecking Bar crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
