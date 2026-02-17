"""
Crawler for Depression & Bipolar Support Alliance - Metropolitan Atlanta Chapter.

Generates recurring support group events from known static schedule:
- Dunwoody: 1st & 3rd Thursdays, 7:30-9:00 PM
- Emory: 2nd & 4th Thursdays, 7:30-9:00 PM
- Marietta: 1st & 3rd Thursdays, 7:00-8:30 PM
- Online: 2nd & 4th Mondays, 6:45-8:15 PM

Website: atlantamoodsupport.org
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantamoodsupport.org"

# Venue definitions
VENUES = {
    "dunwoody": {
        "name": "DBSA Dunwoody",
        "slug": "dbsa-dunwoody",
        "address": "1548 Mt Vernon Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "lat": 33.9346,
        "lng": -84.3346,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": BASE_URL,
        "vibes": ["mental-health", "support-group", "inclusive"],
    },
    "emory": {
        "name": "DBSA Emory",
        "slug": "dbsa-emory",
        "address": "1817 Clifton Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.7954,
        "lng": -84.3194,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": BASE_URL,
        "vibes": ["mental-health", "support-group", "inclusive"],
    },
    "marietta": {
        "name": "DBSA Marietta",
        "slug": "dbsa-marietta",
        "address": "4385 Lower Roswell Rd",
        "neighborhood": "East Cobb",
        "city": "Marietta",
        "state": "GA",
        "zip": "30068",
        "lat": 33.9729,
        "lng": -84.4434,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": BASE_URL,
        "vibes": ["mental-health", "support-group", "inclusive"],
    },
}

# Meeting schedule definition
SCHEDULE = [
    {
        "location": "dunwoody",
        "title": "DBSA Dunwoody Support Group",
        "day_of_week": 3,  # Thursday
        "weeks": [1, 3],  # 1st and 3rd
        "start_time": "19:30",
        "end_time": "21:00",
    },
    {
        "location": "emory",
        "title": "DBSA Emory Support Group",
        "day_of_week": 3,  # Thursday
        "weeks": [2, 4],  # 2nd and 4th
        "start_time": "19:30",
        "end_time": "21:00",
    },
    {
        "location": "marietta",
        "title": "DBSA Marietta Support Group",
        "day_of_week": 3,  # Thursday
        "weeks": [1, 3],  # 1st and 3rd
        "start_time": "19:00",
        "end_time": "20:30",
    },
    {
        "location": "dunwoody",  # Use dunwoody as fallback venue for online
        "title": "DBSA Online Support Group",
        "day_of_week": 0,  # Monday
        "weeks": [2, 4],  # 2nd and 4th
        "start_time": "18:45",
        "end_time": "20:15",
    },
]

DESCRIPTION = (
    "Free peer-led support group for people living with depression or bipolar disorder "
    "and their families. No registration required."
)

TAGS = ["mental-health", "support-group", "depression", "bipolar", "free", "peer-support"]


def get_week_of_month(date: datetime) -> int:
    """
    Get the week number of the month (1-5).
    Week 1 = days 1-7, Week 2 = days 8-14, etc.
    """
    return (date.day - 1) // 7 + 1


def get_next_occurrence(
    start_from: datetime, day_of_week: int, weeks: list[int]
) -> Optional[datetime]:
    """
    Find the next occurrence of a meeting based on day of week and week-of-month.

    Args:
        start_from: Date to start searching from
        day_of_week: 0=Monday, 1=Tuesday, ... 6=Sunday
        weeks: List of week numbers (1-5) when meetings occur

    Returns:
        Next meeting date or None
    """
    current = start_from

    # Search up to 60 days ahead to find next occurrence
    for _ in range(60):
        if current.weekday() == day_of_week:
            week_num = get_week_of_month(current)
            if week_num in weeks:
                return current
        current += timedelta(days=1)

    return None


def generate_events_for_schedule(
    schedule_item: dict, venue_id: int, num_weeks: int = 12
) -> list[dict]:
    """
    Generate event records for a schedule item over the next N weeks.
    """
    events = []
    today = datetime.now()
    current_date = today

    generated_count = 0
    attempts = 0
    max_attempts = num_weeks * 4  # Allow some buffer for finding enough occurrences

    while generated_count < num_weeks and attempts < max_attempts:
        attempts += 1

        next_date = get_next_occurrence(
            current_date, schedule_item["day_of_week"], schedule_item["weeks"]
        )

        if not next_date:
            break

        # Skip if in the past
        if next_date < today:
            current_date = next_date + timedelta(days=1)
            continue

        start_date = next_date.strftime("%Y-%m-%d")
        start_time = schedule_item["start_time"]
        end_time = schedule_item["end_time"]

        # Generate content hash
        content_hash = generate_content_hash(
            schedule_item["title"], VENUES[schedule_item["location"]]["name"], start_date
        )

        event_record = {
            "venue_id": venue_id,
            "title": schedule_item["title"],
            "description": DESCRIPTION,
            "start_date": start_date,
            "start_time": start_time,
            "end_time": end_time,
            "is_all_day": False,
            "category": "support_group",
            "subcategory": None,
            "tags": TAGS,
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": BASE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": f"{schedule_item['title']} {DESCRIPTION}",
            "extraction_confidence": 0.95,
            "is_recurring": True,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        events.append(event_record)
        generated_count += 1

        # Move to next day after this occurrence
        current_date = next_date + timedelta(days=1)

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate DBSA Atlanta support group events from known schedule."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create/fetch all venues
        venue_ids = {}
        for location_key, venue_data in VENUES.items():
            venue_ids[location_key] = get_or_create_venue(venue_data)

        # Generate events for each schedule item
        for schedule_item in SCHEDULE:
            location = schedule_item["location"]
            venue_id = venue_ids[location]

            logger.info(
                f"Generating events for {schedule_item['title']} (next 12 weeks)"
            )

            event_records = generate_events_for_schedule(schedule_item, venue_id, num_weeks=12)

            for event_record in event_records:
                events_found += 1

                # Add source_id
                event_record["source_id"] = source_id

                # Check if exists
                existing = find_event_by_hash(event_record["content_hash"])
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(
                        f"Added: {event_record['title']} on {event_record['start_date']}"
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to insert {event_record['title']} on {event_record['start_date']}: {e}"
                    )

        logger.info(
            f"DBSA Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl DBSA Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
