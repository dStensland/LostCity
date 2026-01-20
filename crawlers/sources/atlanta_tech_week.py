"""
Crawler for Atlanta Tech Week (atlantatechweek.com).
Annual week-long celebration of Atlanta's tech ecosystem - October.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantatechweek.com"

VENUE_DATA = {
    "name": "Atlanta Tech Village",
    "slug": "atlanta-tech-village",
    "address": "3423 Piedmont Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8508,
    "lng": -84.3669,
    "venue_type": "coworking",
    "spot_type": "coworking",
    "website": "https://www.atlantatechvillage.com",
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Tech Week - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Atlanta Tech Week is typically third week of October
    october_1 = datetime(year, 10, 1)
    # Find third Monday
    days_until_monday = (0 - october_1.weekday()) % 7
    first_monday = october_1 + __import__("datetime").timedelta(days=days_until_monday)
    third_monday = first_monday + __import__("datetime").timedelta(days=14)
    start_date = third_monday
    end_date = third_monday + __import__("datetime").timedelta(days=4)  # Monday-Friday

    # If past, use next year
    if end_date < now:
        year += 1
        october_1 = datetime(year, 10, 1)
        days_until_monday = (0 - october_1.weekday()) % 7
        first_monday = october_1 + __import__("datetime").timedelta(
            days=days_until_monday
        )
        third_monday = first_monday + __import__("datetime").timedelta(days=14)
        start_date = third_monday
        end_date = third_monday + __import__("datetime").timedelta(days=4)

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Atlanta Tech Week {year}"
    content_hash = generate_content_hash(
        title, "Atlanta Tech Village", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Atlanta Tech Week {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "A week-long celebration of Atlanta's thriving tech ecosystem featuring 100+ events, networking, demos, and conversations about innovation.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "09:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "21:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "conference",
        "tags": ["atlanta-tech-week", "tech", "startup", "networking", "innovation"],
        "price_min": None,
        "price_max": None,
        "price_note": "Most events free, some ticketed",
        "is_free": True,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.95,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=10",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Atlanta Tech Week: {e}")

    return events_found, events_new, events_updated
