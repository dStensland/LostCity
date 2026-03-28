"""
Crawler for Decatur WatchFest '26 (decaturwatchfest26.com).

Modeled as a single multi-day tentpole event tied to FIFA World Cup 26.
"""

from __future__ import annotations

import logging
from datetime import date, datetime

from db import find_event_by_hash, get_or_create_place, insert_event, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://decaturwatchfest26.com/"

PLACE_DATA = {
    "name": "Decatur Square",
    "slug": "decatur-square",
    "address": "509 N McDonough St",
    "neighborhood": "Downtown Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7749,
    "lng": -84.2961,
    "place_type": "public_space",
    "spot_type": "public_space",
    "website": "https://www.decaturga.com/",
}

KNOWN_DATES = {
    2026: ("2026-06-11", "2026-07-19"),
}


def _resolve_window(today: date) -> tuple[date, date]:
    for year in (today.year, today.year + 1):
        if year in KNOWN_DATES:
            start, end = KNOWN_DATES[year]
            return date.fromisoformat(start), date.fromisoformat(end)
    # Conservative fallback: upcoming World Cup window.
    return date(today.year, 6, 11), date(today.year, 7, 19)


def crawl(source: dict) -> tuple[int, int, int]:
    """Upsert Decatur WatchFest annual tentpole event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().date()
    start_date, end_date = _resolve_window(today)
    event_year = start_date.year

    venue_id = get_or_create_place(PLACE_DATA)
    title = f"Decatur WatchFest {event_year}"
    content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date.isoformat())

    event_record = {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": (
            "Decatur WatchFest is a free citywide World Cup fan experience on and around "
            "Decatur Square with match watch parties, concerts, and community programming "
            "throughout the FIFA World Cup tournament window."
        ),
        "start_date": start_date.isoformat(),
        "start_time": None,
        "end_date": end_date.isoformat(),
        "end_time": None,
        "is_all_day": True,
        "category": "community",
        "subcategory": "fan_festival",
        "tags": ["decatur-watchfest", "world-cup", "soccer", "decatur", "fan-festival"],
        "price_min": None,
        "price_max": None,
        "price_note": "Free public programming",
        "is_free": True,
        "is_tentpole": True,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
        "image_url": None,
        "raw_text": f"Decatur WatchFest {start_date.isoformat()} to {end_date.isoformat()}",
        "extraction_confidence": 0.92,
        "is_recurring": True,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }

    events_found = 1
    existing = find_event_by_hash(content_hash)
    if existing:
        smart_update_existing_event(existing, event_record)
        events_updated = 1
        logger.info("Updated: %s", title)
    else:
        insert_event(event_record)
        events_new = 1
        logger.info("Added: %s", title)

    return events_found, events_new, events_updated
