"""
Crawler for City of Atlanta indoor pickleball sessions at recreation centers.

The official City of Atlanta pickleball page publishes weekly indoor pickleball
hours for select recreation centers. The site is currently blocked from this
crawler runtime, so we model the published weekly schedule as recurring events
backed by the city's official page for source attribution.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SOURCE_URL = (
    "https://www.atlantaga.gov/government/departments/department-parks-recreation/"
    "office-of-parks/city-of-atlanta-pickleball"
)
WEEKS_AHEAD = 6
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

SCHEDULES = [
    {
        "day": 1,  # Tuesday
        "title": "Indoor Pickleball at Anderson Recreation Center",
        "start_time": "11:00",
        "end_time": "14:00",
        "description": (
            "Indoor pickleball at Anderson Recreation Center. The City of Atlanta "
            "pickleball schedule lists open indoor play on Tuesdays from 11:00 a.m. "
            "to 2:00 p.m. Equipment is available at no charge; check the center for "
            "current access requirements before attending."
        ),
        "tags": ["pickleball", "indoor", "recreation-center", "public-play", "weekly", "westside"],
        "venue_data": {
            "name": "Anderson Recreation Center",
            "slug": "anderson-recreation-center",
            "address": "120 Anderson Ave NW",
            "neighborhood": "Carey Park",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30314",
            "lat": 33.7584203,
            "lng": -84.4504772,
            "place_type": "community_center",
            "spot_type": "community_center",
            "website": "https://www.atlantaga.gov",
            "description": "City of Atlanta recreation center with published indoor pickleball hours.",
        },
    },
    {
        "day": 3,  # Thursday
        "title": "Indoor Pickleball at Anderson Recreation Center",
        "start_time": "11:00",
        "end_time": "14:00",
        "description": (
            "Indoor pickleball at Anderson Recreation Center. The City of Atlanta "
            "pickleball schedule lists open indoor play on Thursdays from 11:00 a.m. "
            "to 2:00 p.m. Equipment is available at no charge; check the center for "
            "current access requirements before attending."
        ),
        "tags": ["pickleball", "indoor", "recreation-center", "public-play", "weekly", "westside"],
        "venue_data": {
            "name": "Anderson Recreation Center",
            "slug": "anderson-recreation-center",
            "address": "120 Anderson Ave NW",
            "neighborhood": "Carey Park",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30314",
            "lat": 33.7584203,
            "lng": -84.4504772,
            "place_type": "community_center",
            "spot_type": "community_center",
            "website": "https://www.atlantaga.gov",
            "description": "City of Atlanta recreation center with published indoor pickleball hours.",
        },
    },
    {
        "day": 0,  # Monday
        "title": "Indoor Pickleball at Peachtree Hills Recreation Center",
        "start_time": "10:00",
        "end_time": "13:00",
        "description": (
            "Indoor pickleball at Peachtree Hills Recreation Center. The City of Atlanta "
            "pickleball schedule lists open indoor play on Mondays from 10:00 a.m. "
            "to 1:00 p.m. Equipment is available at no charge; check the center for "
            "current access requirements before attending."
        ),
        "tags": ["pickleball", "indoor", "recreation-center", "public-play", "weekly", "buckhead"],
        "venue_data": {
            "name": "Peachtree Hills Recreation Center",
            "slug": "peachtree-hills-recreation-center",
            "address": "308 Peachtree Hills Ave NE",
            "neighborhood": "Peachtree Hills",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30305",
            "lat": 33.8182644,
            "lng": -84.3777000,
            "place_type": "community_center",
            "spot_type": "community_center",
            "website": "https://www.atlantaga.gov",
            "description": "City of Atlanta recreation center with published indoor pickleball hours.",
        },
    },
    {
        "day": 2,  # Wednesday
        "title": "Indoor Pickleball at Peachtree Hills Recreation Center",
        "start_time": "10:00",
        "end_time": "13:00",
        "description": (
            "Indoor pickleball at Peachtree Hills Recreation Center. The City of Atlanta "
            "pickleball schedule lists open indoor play on Wednesdays from 10:00 a.m. "
            "to 1:00 p.m. Equipment is available at no charge; check the center for "
            "current access requirements before attending."
        ),
        "tags": ["pickleball", "indoor", "recreation-center", "public-play", "weekly", "buckhead"],
        "venue_data": {
            "name": "Peachtree Hills Recreation Center",
            "slug": "peachtree-hills-recreation-center",
            "address": "308 Peachtree Hills Ave NE",
            "neighborhood": "Peachtree Hills",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30305",
            "lat": 33.8182644,
            "lng": -84.3777000,
            "place_type": "community_center",
            "spot_type": "community_center",
            "website": "https://www.atlantaga.gov",
            "description": "City of Atlanta recreation center with published indoor pickleball hours.",
        },
    },
    {
        "day": 3,  # Thursday
        "title": "Indoor Pickleball at Peachtree Hills Recreation Center",
        "start_time": "10:00",
        "end_time": "13:00",
        "description": (
            "Indoor pickleball at Peachtree Hills Recreation Center. The City of Atlanta "
            "pickleball schedule lists open indoor play on Thursdays from 10:00 a.m. "
            "to 1:00 p.m. Equipment is available at no charge; check the center for "
            "current access requirements before attending."
        ),
        "tags": ["pickleball", "indoor", "recreation-center", "public-play", "weekly", "buckhead"],
        "venue_data": {
            "name": "Peachtree Hills Recreation Center",
            "slug": "peachtree-hills-recreation-center",
            "address": "308 Peachtree Hills Ave NE",
            "neighborhood": "Peachtree Hills",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30305",
            "lat": 33.8182644,
            "lng": -84.3777000,
            "place_type": "community_center",
            "spot_type": "community_center",
            "website": "https://www.atlantaga.gov",
            "description": "City of Atlanta recreation center with published indoor pickleball hours.",
        },
    },
]


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def build_series_title(title: str, weekday: int) -> str:
    return f"{title} ({DAY_NAMES[weekday]})"


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in SCHEDULES:
        venue_id = get_or_create_place(template["venue_data"])
        next_date = get_next_weekday(today, template["day"])
        day_code = DAY_CODES[template["day"]]
        day_name = DAY_NAMES[template["day"]].lower()
        series_title = build_series_title(template["title"], template["day"])

        series_hint = {
            "series_type": "recurring_show",
            "series_title": series_title,
            "frequency": "weekly",
            "day_of_week": day_name,
            "description": template["description"],
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(
                template["title"], template["venue_data"]["name"], start_date
            )

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": template["title"],
                "description": template["description"],
                "start_date": start_date,
                "start_time": template["start_time"],
                "end_date": None,
                "end_time": template["end_time"],
                "is_all_day": False,
                "category": "sports",
                "subcategory": "pickleball",
                "tags": template["tags"],
                "is_free": False,
                "price_min": None,
                "price_max": None,
                "price_note": "Check the recreation center for current access fees.",
                "source_url": SOURCE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} - {start_date}",
                "extraction_confidence": 0.84,
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
                logger.error("Failed to insert %s on %s: %s", template["title"], start_date, exc)

    logger.info(
        "Atlanta rec center pickleball crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
