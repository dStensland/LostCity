"""
Crawler for Ridgeview Institute Smyrna support groups.

Generates recurring support group events from known static weekly schedule.
All meetings are held at Ridgeview Institute in the Professional North Building.

Website: https://www.ridgeviewsmyrna.com/resources/support-groups/
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.ridgeviewsmyrna.com"
SOURCE_URL = f"{BASE_URL}/resources/support-groups/"

VENUE_DATA = {
    "name": "Ridgeview Institute",
    "slug": "ridgeview-institute",
    "address": "3995 South Cobb Dr SE",
    "neighborhood": "Smyrna",
    "city": "Smyrna",
    "state": "GA",
    "zip": "30080",
    "lat": 33.8567,
    "lng": -84.5179,
    "venue_type": "hospital",
    "spot_type": "hospital",
    "website": BASE_URL,
    "vibes": ["mental-health", "recovery", "support-group"],
}

# Weekly meeting schedule
# day_of_week: 0=Monday, 1=Tuesday, ... 6=Sunday
SCHEDULE = [
    # Monday
    {
        "title": "AA Big Book Study",
        "day_of_week": 0,
        "start_time": "20:00",
        "tags": ["aa", "12-step", "recovery", "support-group", "free", "mental-health"],
        "description": "Alcoholics Anonymous Big Book study group. Free community support at Ridgeview Institute Professional North Building. Open to all.",
    },
    {
        "title": "Al-Anon Meeting",
        "day_of_week": 0,
        "start_time": "20:00",
        "tags": ["al-anon", "family", "recovery", "support-group", "free", "mental-health"],
        "description": "Al-Anon family support group for loved ones of those affected by alcohol. Free community support at Ridgeview Institute Professional North Building. Open to all.",
    },
    # Tuesday
    {
        "title": "Overeaters Anonymous",
        "day_of_week": 1,
        "start_time": "18:30",
        "tags": ["oa", "12-step", "eating-disorder", "support-group", "free", "mental-health"],
        "description": "Overeaters Anonymous meeting. Free community support at Ridgeview Institute Professional North Building. Open to all.",
    },
    {
        "title": "Friends & Family Support Group (Virtual)",
        "day_of_week": 1,
        "start_time": "19:00",
        "tags": ["family", "virtual", "support-group", "free", "mental-health"],
        "description": "Virtual support group for friends and family members. Free community support at Ridgeview Institute. Open to all.",
    },
    {
        "title": "AA Meeting",
        "day_of_week": 1,
        "start_time": "20:00",
        "tags": ["aa", "12-step", "recovery", "support-group", "free", "mental-health"],
        "description": "Alcoholics Anonymous meeting. Free community support at Ridgeview Institute Professional North Building. Open to all.",
    },
    # Wednesday
    {
        "title": "12-Step Addiction Group",
        "day_of_week": 2,
        "start_time": "19:00",
        "tags": ["12-step", "recovery", "addiction", "support-group", "free", "mental-health"],
        "description": "12-step addiction recovery group. Free community support at Ridgeview Institute Professional North Building. Open to all.",
    },
    # Thursday
    {
        "title": "Codependents Anonymous",
        "day_of_week": 3,
        "start_time": "19:00",
        "tags": ["coda", "12-step", "codependency", "support-group", "free", "mental-health"],
        "description": "Codependents Anonymous meeting. Free community support at Ridgeview Institute Professional North Building. Open to all.",
    },
    {
        "title": "12-Step Group",
        "day_of_week": 3,
        "start_time": "20:00",
        "tags": ["12-step", "recovery", "support-group", "free", "mental-health"],
        "description": "12-step recovery group. Free community support at Ridgeview Institute Professional North Building. Open to all.",
    },
    # Friday
    {
        "title": "AA Finding the Balance",
        "day_of_week": 4,
        "start_time": "20:00",
        "tags": ["aa", "12-step", "recovery", "support-group", "free", "mental-health"],
        "description": "Alcoholics Anonymous 'Finding the Balance' meeting. Free community support at Ridgeview Institute Professional North Building. Open to all.",
    },
    # Saturday
    {
        "title": "AA Men's Group",
        "day_of_week": 5,
        "start_time": "18:00",
        "tags": ["aa", "12-step", "recovery", "mens", "support-group", "free", "mental-health"],
        "description": "Alcoholics Anonymous men's group. Free community support at Ridgeview Institute Professional North Building. Open to all.",
    },
    {
        "title": "AA Women's Group",
        "day_of_week": 5,
        "start_time": "18:00",
        "tags": ["aa", "12-step", "recovery", "womens", "support-group", "free", "mental-health"],
        "description": "Alcoholics Anonymous women's group. Free community support at Ridgeview Institute Professional North Building. Open to all.",
    },
    {
        "title": "Relationships in Recovery",
        "day_of_week": 5,
        "start_time": "19:30",
        "tags": ["recovery", "relationships", "support-group", "free", "mental-health"],
        "description": "Support group focused on relationships in recovery. Free community support at Ridgeview Institute Professional North Building. Open to all.",
    },
    # Sunday
    {
        "title": "Narcotics Anonymous",
        "day_of_week": 6,
        "start_time": "10:30",
        "tags": ["na", "12-step", "recovery", "support-group", "free", "mental-health"],
        "description": "Narcotics Anonymous meeting. Free community support at Ridgeview Institute Professional North Building. Open to all.",
    },
    {
        "title": "Adult Children of Alcoholics",
        "day_of_week": 6,
        "start_time": "14:00",
        "tags": ["acoa", "12-step", "family", "support-group", "free", "mental-health"],
        "description": "Adult Children of Alcoholics meeting. Free community support at Ridgeview Institute Professional North Building. Open to all.",
    },
]


def get_next_weekday(start_from: datetime, weekday: int) -> datetime:
    """
    Get the next occurrence of a given weekday.

    Args:
        start_from: Date to start searching from
        weekday: 0=Monday, 1=Tuesday, ... 6=Sunday

    Returns:
        Next date matching the weekday
    """
    days_ahead = weekday - start_from.weekday()
    if days_ahead <= 0:  # Target day already happened this week or is today
        days_ahead += 7
    return start_from + timedelta(days=days_ahead)


def generate_events_for_meeting(
    meeting: dict, venue_id: int, num_weeks: int = 8
) -> list[dict]:
    """
    Generate event records for a weekly meeting over the next N weeks.
    """
    events = []
    today = datetime.now()

    # Find first occurrence
    next_date = get_next_weekday(today, meeting["day_of_week"])

    for week in range(num_weeks):
        event_date = next_date + timedelta(weeks=week)
        start_date = event_date.strftime("%Y-%m-%d")

        # Generate content hash
        content_hash = generate_content_hash(
            meeting["title"], "Ridgeview Institute", start_date
        )

        event_record = {
            "venue_id": venue_id,
            "title": meeting["title"],
            "description": meeting["description"],
            "start_date": start_date,
            "start_time": meeting["start_time"],
            "end_time": None,  # Meetings don't have published end times
            "is_all_day": False,
            "category": "support_group",
            "subcategory": None,
            "tags": meeting["tags"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": SOURCE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": f"{meeting['title']} {meeting['description']}",
            "extraction_confidence": 0.95,
            "is_recurring": True,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        events.append(event_record)

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate Ridgeview Institute support group events from known schedule."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create/fetch venue
        venue_id = get_or_create_venue(VENUE_DATA)

        # Generate events for each meeting in schedule
        for meeting in SCHEDULE:
            logger.info(
                f"Generating events for {meeting['title']} (next 8 weeks)"
            )

            event_records = generate_events_for_meeting(meeting, venue_id, num_weeks=8)

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
            f"Ridgeview Institute crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Ridgeview Institute: {e}")
        raise

    return events_found, events_new, events_updated
