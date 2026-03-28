"""
Crawler for City of Atlanta natatorium open swim and lap swim sessions.

Uses the official City of Atlanta aquatics pages, which publish weekly Saturday
open-swim and lap-swim windows at the city's indoor natatoriums.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SOURCE_URL = (
    "https://www.atlantaga.gov/government/departments/department-parks-recreation/"
    "office-of-recreation/aquatics/pools-indoor-outdoor"
)
WEEKS_AHEAD = 8
SATURDAY_INDEX = 5

SCHEDULES = [
    {
        "title": "Open Swim & Lap Swim at CT Martin Recreation & Aquatic Center",
        "start_time": "13:00",
        "end_time": "16:00",
        "source_url": (
            "https://www.atlantaga.gov/government/departments/department-parks-recreation/"
            "office-of-recreation/aquatics/pools-indoor-outdoor"
        ),
        "description": (
            "Public Saturday lap swim and open swim at CT Martin Recreation & Aquatic Center. "
            "The official City of Atlanta pools page lists Saturday natatorium hours from "
            "1:00 p.m. to 4:00 p.m. for lap swim and open swim."
        ),
        "venue_data": {
            "name": "CT Martin Recreation & Aquatic Center",
            "slug": "ct-martin-recreation-center",
            "address": "3201 M. L. King Jr. Dr. SW",
            "neighborhood": "Adamsville",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30311",
            "lat": 33.7549,
            "lng": -84.4967,
            "venue_type": "community_center",
            "spot_type": "community_center",
            "website": SOURCE_URL,
            "description": "City of Atlanta natatorium with published Saturday open-swim hours.",
        },
        "tags": ["swimming", "lap-swim", "open-swim", "public-play", "atlanta-dpr", "westside"],
    },
    {
        "title": "Open Swim & Lap Swim at MLK Jr. Recreation & Aquatic Center",
        "start_time": "12:00",
        "end_time": "15:00",
        "source_url": (
            "https://www.atlantaga.gov/government/departments/department-parks-recreation/"
            "office-of-recreation/aquatics/m-l-king-jr-recreation-and-aquatic-center"
        ),
        "description": (
            "Public Saturday lap swim and open swim at MLK Jr. Recreation & Aquatic Center. "
            "The official City of Atlanta natatorium page lists Saturday pool hours from "
            "12:00 p.m. to 3:00 p.m."
        ),
        "venue_data": {
            "name": "MLK Jr. Recreation & Aquatic Center",
            "slug": "mlk-recreation-center",
            "address": "110 Hilliard St NE",
            "neighborhood": "Old Fourth Ward",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30312",
            "lat": 33.7638,
            "lng": -84.3759,
            "venue_type": "community_center",
            "spot_type": "community_center",
            "website": (
                "https://www.atlantaga.gov/government/departments/department-parks-recreation/"
                "office-of-recreation/aquatics/m-l-king-jr-recreation-and-aquatic-center"
            ),
            "description": "City of Atlanta natatorium with published Saturday open-swim hours.",
        },
        "tags": ["swimming", "lap-swim", "open-swim", "public-play", "atlanta-dpr", "downtown"],
    },
    {
        "title": "Open Swim & Lap Swim at Rosel Fann Recreation & Aquatic Center",
        "start_time": "10:00",
        "end_time": "16:00",
        "source_url": (
            "https://www.atlantaga.gov/government/departments/department-parks-recreation/"
            "office-of-recreation/aquatics/rosel-fann-natatorium"
        ),
        "description": (
            "Public Saturday lap swim and open swim at Rosel Fann Recreation & Aquatic Center. "
            "The official City of Atlanta natatorium page lists Saturday pool hours from "
            "10:00 a.m. to 4:00 p.m."
        ),
        "venue_data": {
            "name": "Rosel Fann Recreation & Aquatic Center",
            "slug": "rosel-fann-recreation-center",
            "address": "365 Cleveland Ave SE",
            "neighborhood": "Lakewood Heights",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30354",
            "lat": 33.6807,
            "lng": -84.3806,
            "venue_type": "community_center",
            "spot_type": "community_center",
            "website": (
                "https://www.atlantaga.gov/government/departments/department-parks-recreation/"
                "office-of-recreation/aquatics/rosel-fann-natatorium"
            ),
            "description": "City of Atlanta natatorium with published Saturday open-swim hours.",
        },
        "tags": ["swimming", "lap-swim", "open-swim", "public-play", "atlanta-dpr", "southside"],
    },
    {
        "title": "Open Swim & Lap Swim at Washington Park Aquatic Center",
        "start_time": "12:00",
        "end_time": "16:00",
        "source_url": (
            "https://www.atlantaga.gov/government/departments/department-parks-recreation/"
            "office-of-recreation/aquatics/washington-park-natatorium"
        ),
        "description": (
            "Public Saturday lap swim and open swim at Washington Park Aquatic Center. "
            "The official City of Atlanta natatorium page lists Saturday pool hours from "
            "12:00 p.m. to 4:00 p.m."
        ),
        "venue_data": {
            "name": "Washington Park Aquatic Center",
            "slug": "washington-park-aquatic-center",
            "address": "102 Ollie St NW",
            "neighborhood": "Vine City",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30314",
            "lat": 33.7561,
            "lng": -84.4153,
            "venue_type": "community_center",
            "spot_type": "community_center",
            "website": (
                "https://www.atlantaga.gov/government/departments/department-parks-recreation/"
                "office-of-recreation/aquatics/washington-park-natatorium"
            ),
            "description": "City of Atlanta natatorium with published Saturday open-swim hours.",
        },
        "tags": ["swimming", "lap-swim", "open-swim", "public-play", "atlanta-dpr", "westside"],
    },
]


def _next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    first_saturday = _next_weekday(today, SATURDAY_INDEX)

    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    for template in SCHEDULES:
        venue_id = get_or_create_place(template["venue_data"])
        series_hint = {
            "series_type": "recurring_show",
            "series_title": template["title"],
            "frequency": "weekly",
            "day_of_week": "saturday",
            "description": template["description"],
        }

        for week in range(WEEKS_AHEAD):
            event_date = first_saturday + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            content_hash = generate_content_hash(
                template["title"],
                template["venue_data"]["name"],
                start_date,
            )
            current_hashes.add(content_hash)
            events_found += 1

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": template["title"],
                "description": template["description"],
                "start_date": start_date,
                "start_time": template["start_time"],
                "end_date": None,
                "end_time": template["end_time"],
                "is_all_day": False,
                "category": "fitness",
                "subcategory": "fitness.aquatics",
                "tags": template["tags"],
                "is_class": False,
                "is_free": False,
                "price_min": None,
                "price_max": None,
                "price_note": (
                    "Check the natatorium for current admission or membership details. "
                    "The City of Atlanta lists these as public lap-swim and open-swim hours."
                ),
                "source_url": template["source_url"],
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} - {start_date}",
                "extraction_confidence": 0.9,
                "is_recurring": True,
                "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA",
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
                logger.error("Failed to insert %s on %s: %s", template["title"], start_date, exc)

    remove_stale_source_events(source_id, current_hashes)

    logger.info(
        "Atlanta natatorium open swim crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
