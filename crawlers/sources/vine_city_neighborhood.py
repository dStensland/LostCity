"""
Crawler for Vine City Neighborhood.
Historic Westside neighborhood adjacent to Mercedes-Benz Stadium and the HBCU campuses.
Rich civil rights heritage - home to many civil rights leaders.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

VENUE_DATA = {
    "name": "Vine City",
    "slug": "vine-city-neighborhood",
    "address": "Vine City",
    "neighborhood": "Vine City",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30314",
    "lat": 33.7580,
    "lng": -84.4180,
    "venue_type": "neighborhood",
    "spot_type": "neighborhood",
    "website": None,
    "description": "Historic Westside neighborhood with rich civil rights heritage, adjacent to Mercedes-Benz Stadium.",
}


def get_third_tuesday(year: int, month: int) -> datetime:
    """Get the third Tuesday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_tuesday = (1 - first_day.weekday()) % 7
    first_tuesday = first_day + timedelta(days=days_until_tuesday)
    third_tuesday = first_tuesday + timedelta(days=14)
    return third_tuesday


def create_monthly_meetings(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create recurring NPU-L monthly meeting events (covers Vine City)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    for i in range(4):
        month = now.month + i
        year = now.year
        if month > 12:
            month -= 12
            year += 1

        meeting_date = get_third_tuesday(year, month)

        if meeting_date.date() < now.date():
            continue

        title = "NPU-L Monthly Meeting"
        start_date = meeting_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Vine City", start_date)


        description = (
            "NPU-L (Neighborhood Planning Unit L) monthly meeting. "
            "Covers Vine City, English Avenue, and surrounding Westside neighborhoods. "
            "Discuss zoning, development, public safety, and community issues."
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "19:00",
            "end_date": None,
            "end_time": "21:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": None,
            "tags": ["vine-city", "npu", "civic", "neighborhood-meeting", "westside"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://www.atlantaga.gov/government/departments/city-planning/office-of-zoning-development/neighborhood-planning-unit-npu",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.85,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=3TU",
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        series_hint = {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "monthly",
            "day_of_week": "Tuesday",
            "description": description,
        }

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert meeting: {e}")

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Vine City Neighborhood events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # NPU meetings
    meeting_new, meeting_updated = create_monthly_meetings(source_id, venue_id)
    events_found += 4
    events_new += meeting_new
    events_updated += meeting_updated

    # Note: Vine City is adjacent to Mercedes-Benz Stadium
    # Stadium events are covered by mercedes_benz_stadium.py

    logger.info(f"Vine City crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
