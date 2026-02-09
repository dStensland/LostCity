"""
Crawler for East Lake Neighborhood.
Growing neighborhood with parks, golf course, and emerging dining scene.
Home to the East Lake Golf Club (site of TOUR Championship) and East Lake Park.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

VENUE_DATA = {
    "name": "East Lake",
    "slug": "east-lake-neighborhood",
    "address": "East Lake Dr SE",
    "neighborhood": "East Lake",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30317",
    "lat": 33.7530,
    "lng": -84.3100,
    "venue_type": "neighborhood",
    "spot_type": "neighborhood",
    "website": None,
    "description": "Growing neighborhood with East Lake Golf Club (TOUR Championship), parks, and emerging dining scene.",
}


def get_second_thursday(year: int, month: int) -> datetime:
    """Get the second Thursday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_thursday = (3 - first_day.weekday()) % 7
    first_thursday = first_day + timedelta(days=days_until_thursday)
    second_thursday = first_thursday + timedelta(days=7)
    return second_thursday


def create_monthly_meetings(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create recurring monthly community meeting events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    for i in range(4):
        month = now.month + i
        year = now.year
        if month > 12:
            month -= 12
            year += 1

        meeting_date = get_second_thursday(year, month)

        if meeting_date.date() < now.date():
            continue

        title = "East Lake Neighbors Community Meeting"
        start_date = meeting_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "East Lake", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        description = (
            "East Lake Neighbors monthly community meeting. "
            "Discuss neighborhood issues, park improvements, and upcoming events. "
            "All East Lake residents welcome."
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "19:00",
            "end_date": None,
            "end_time": "20:30",
            "is_all_day": False,
            "category": "community",
            "subcategory": None,
            "tags": ["east-lake", "civic", "neighborhood-meeting"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": None,
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.80,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=2TH",
            "content_hash": content_hash,
        }

        series_hint = {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "monthly",
            "day_of_week": "Thursday",
            "description": description,
        }

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert meeting: {e}")

    return events_new, events_updated


def create_tour_championship(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create TOUR Championship event at East Lake Golf Club."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # TOUR Championship is typically late August/early September
    year = now.year
    if now.month > 9:
        year += 1

    # Labor Day weekend area
    sept_1 = datetime(year, 9, 1)
    days_until_thursday = (3 - sept_1.weekday()) % 7
    first_thursday = sept_1 + timedelta(days=days_until_thursday)

    title = f"TOUR Championship {year}"
    start_date = first_thursday.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "East Lake", start_date)

    if find_event_by_hash(content_hash):
        events_updated += 1
        return events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": (
            "The TOUR Championship at East Lake Golf Club - the finale of the PGA TOUR's FedExCup Playoffs. "
            "Top 30 golfers compete for the FedExCup trophy. "
            "Tickets include access to grounds, hospitality areas, and special events."
        ),
        "start_date": start_date,
        "start_time": "08:00",
        "end_date": (first_thursday + timedelta(days=3)).strftime("%Y-%m-%d"),
        "end_time": "18:00",
        "is_all_day": False,
        "category": "sports",
        "subcategory": "golf",
        "tags": ["east-lake", "pga-tour", "golf", "tour-championship", "fedexcup"],
        "price_min": None,
        "price_max": None,
        "price_note": "Tickets required",
        "is_free": False,
        "source_url": "https://www.tourchampionship.com",
        "ticket_url": "https://www.tourchampionship.com",
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.90,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new += 1
        logger.info(f"Added: {title} on {start_date}")
    except Exception as e:
        logger.error(f"Failed to insert TOUR Championship: {e}")

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl East Lake Neighborhood events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Monthly meetings
    meeting_new, meeting_updated = create_monthly_meetings(source_id, venue_id)
    events_found += 4
    events_new += meeting_new
    events_updated += meeting_updated

    # TOUR Championship
    tour_new, tour_updated = create_tour_championship(source_id, venue_id)
    events_found += 1
    events_new += tour_new
    events_updated += tour_updated

    logger.info(f"East Lake crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
