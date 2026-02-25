"""
Crawler for Dirty South Trivia (dirtysouthtrivia.com).

Weekly pub quiz nights at bars and restaurants across Atlanta.
DST has been voted Atlanta's best trivia multiple times.

Schedule sourced from venue pages and web research (Feb 2026).
WEEKS_AHEAD = 6
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

WEEKS_AHEAD = 6
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# ============================================================================
# VENUE + SCHEDULE DATA
# Verified from venue websites and web search results, Feb 2026.
# ============================================================================

VENUES = {
    "hotel-clermont": {
        "name": "Hotel Clermont",
        "slug": "hotel-clermont",
        "address": "789 Ponce De Leon Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
        "website": "https://hotelclermont.com",
    },
    "wild-heaven-decatur": {
        "name": "Wild Heaven Beer",
        "slug": "wild-heaven-beer-decatur",
        "address": "135B Sams St",
        "neighborhood": "Avondale Estates",
        "city": "Avondale Estates",
        "state": "GA",
        "zip": "30002",
        "venue_type": "brewery",
        "website": "https://wildheavenbeer.com",
    },
    "round-trip-brewing": {
        "name": "Round Trip Brewing Co.",
        "slug": "round-trip-brewing",
        "address": "1279 Seaboard Industrial Blvd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "brewery",
        "website": "https://roundtripbrewing.com",
    },
    "sweet-auburn-bbq": {
        "name": "Sweet Auburn BBQ",
        "slug": "sweet-auburn-bbq",
        "address": "656 N Highland Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "restaurant",
        "website": "https://sweetauburnbbq.com",
    },
    "eventide-brewing": {
        "name": "Eventide Brewing",
        "slug": "eventide-brewing",
        "address": "1015 Grant St SE",
        "neighborhood": "Grant Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30315",
        "venue_type": "brewery",
        "website": "https://eventidebrewing.com",
    },
    "midtown-tavern": {
        "name": "Midtown Tavern",
        "slug": "midtown-tavern",
        "address": "554 Piedmont Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "bar",
    },
}

WEEKLY_SCHEDULE = [
    {
        "venue_key": "sweet-auburn-bbq",
        "day": 0,  # Monday
        "start_time": "19:00",
    },
    {
        "venue_key": "hotel-clermont",
        "day": 1,  # Tuesday
        "start_time": "19:00",
    },
    {
        "venue_key": "wild-heaven-decatur",
        "day": 1,  # Tuesday
        "start_time": "19:00",
    },
    {
        "venue_key": "round-trip-brewing",
        "day": 2,  # Wednesday
        "start_time": "19:00",
    },
    {
        "venue_key": "midtown-tavern",
        "day": 2,  # Wednesday
        "start_time": "20:00",
    },
    {
        "venue_key": "eventide-brewing",
        "day": 3,  # Thursday
        "start_time": "19:00",
    },
]


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate Dirty South Trivia events for Atlanta venues."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    venue_ids = {}

    logger.info(f"Generating Dirty South Trivia events for {len(WEEKLY_SCHEDULE)} venue slots")

    for slot in WEEKLY_SCHEDULE:
        venue_key = slot["venue_key"]
        venue_data = VENUES.get(venue_key)
        if not venue_data:
            logger.warning(f"Unknown venue key: {venue_key}")
            continue

        if venue_key not in venue_ids:
            venue_ids[venue_key] = get_or_create_venue(venue_data)

        venue_id = venue_ids[venue_key]
        venue_name = venue_data["name"]
        day_int = slot["day"]
        start_time = slot["start_time"]
        day_code = DAY_CODES[day_int]
        day_name = DAY_NAMES[day_int]

        next_date = get_next_weekday(today, day_int)

        series_hint = {
            "series_type": "recurring_show",
            "series_title": "Dirty South Trivia",
            "frequency": "weekly",
            "day_of_week": day_name,
            "description": f"Weekly Dirty South Trivia at {venue_name}. Free to play.",
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(
                "Dirty South Trivia", venue_name, start_date
            )

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": "Dirty South Trivia",
                "description": (
                    f"Weekly Dirty South Trivia at {venue_name}. "
                    f"Voted Atlanta's best trivia by Creative Loafing readers. "
                    f"Free to play — grab a team and test your knowledge."
                ),
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "nightlife",
                "subcategory": "nightlife.trivia",
                "tags": ["trivia", "games", "nightlife", "weekly", "dirty-south-trivia"],
                "is_free": True,
                "price_min": None,
                "price_max": None,
                "price_note": "Free to play",
                "source_url": venue_data.get("website", "https://dirtysouthtrivia.com"),
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"Dirty South Trivia at {venue_name} - {start_date}",
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
                logger.error(f"Failed to insert DST at {venue_name} on {start_date}: {exc}")

    logger.info(
        f"Dirty South Trivia crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
