"""
Crawler for The Painted Duck (thepaintedduck.com).

West Midtown spot featuring bocce, darts, shuffleboard, and duckpin bowling.
Known for bar games leagues and events.
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

BASE_URL = "https://www.thepaintedduck.com"

VENUE_DATA = {
    "name": "The Painted Duck",
    "slug": "painted-duck",
    "address": "915 Howell Mill Rd NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7854,
    "lng": -84.4109,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["bar-games", "bocce", "shuffleboard", "darts", "bowling", "casual"],
}

# Weekly recurring events at The Painted Duck
# (day_of_week, title, time_24h, description, subcategory, genres, tags)
WEEKLY_SCHEDULE = [
    (
        1,  # Tuesday
        "Bocce League at The Painted Duck",
        "19:00",
        "Join our weekly bocce league! Teams compete on indoor bocce courts. All skill levels welcome. Sign up for the season or drop in for casual play. Full bar and menu available.",
        "nightlife.bar_games",
        ["bar-games"],
        ["bar-games", "bocce", "league", "21+", "team-sport"],
    ),
    (
        3,  # Thursday
        "Duckpin Bowling League",
        "19:30",
        "Weekly duckpin bowling league at Atlanta's only duckpin lanes. Fun retro bowling experience with smaller pins and balls. League play with prizes for top teams.",
        "nightlife.bar_games",
        ["bar-games"],
        ["bar-games", "bowling", "duckpin", "league", "21+", "retro"],
    ),
]


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a weekday from start_date."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate The Painted Duck events for upcoming weeks."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Generate events for next 8 weeks
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    weeks_ahead = 8

    try:
        # Get or create venue
        venue_id = get_or_create_venue(VENUE_DATA)

        for day_of_week, title, time_24h, description, subcategory, genres, tags in WEEKLY_SCHEDULE:
            # Generate events for each week
            for week in range(weeks_ahead):
                event_date = get_next_weekday(today + timedelta(weeks=week), day_of_week)

                # Skip if in the past
                if event_date < today:
                    continue

                start_date = event_date.strftime("%Y-%m-%d")
                events_found += 1

                content_hash = generate_content_hash(
                    title, VENUE_DATA["name"], start_date
                )


                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": time_24h,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "nightlife",
                    "subcategory": subcategory,
                    "genres": genres,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": BASE_URL,
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": f"{title} - {start_date}",
                    "extraction_confidence": 0.90,
                    "is_recurring": True,
                    "recurrence_rule": f"FREQ=WEEKLY;BYDAY={['MO','TU','WE','TH','FR','SA','SU'][day_of_week]}",
                    "content_hash": content_hash,
                }

                existing = find_existing_event_for_insert(event_record)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                day_names = [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                ]
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "frequency": "weekly",
                    "day_of_week": day_names[day_of_week],
                    "description": description,
                }

                try:
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

        logger.info(
            f"The Painted Duck crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl The Painted Duck: {e}")
        raise

    return events_found, events_new, events_updated
