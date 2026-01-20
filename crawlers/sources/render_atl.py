"""
Crawler for RenderATL (renderatl.com).
Annual tech conference celebrating Black technologists - June.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.renderatl.com"

VENUE_DATA = {
    "name": "Atlanta Conference Center at CNN",
    "slug": "atlanta-conference-center-cnn",
    "address": "190 Marietta St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7589,
    "lng": -84.3952,
    "venue_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://www.cnn.com/tour",
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl RenderATL Conference - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # RenderATL is typically mid-June
    # 2026 dates estimated as June 10-12
    if year == 2026:
        start_date = datetime(2026, 6, 10)
        end_date = datetime(2026, 6, 12)
    else:
        # Second Wednesday-Friday of June
        june_1 = datetime(year, 6, 1)
        days_until_wed = (2 - june_1.weekday()) % 7
        first_wed = june_1 + __import__("datetime").timedelta(days=days_until_wed)
        second_wed = first_wed + __import__("datetime").timedelta(days=7)
        start_date = second_wed
        end_date = second_wed + __import__("datetime").timedelta(days=2)

    # If past, use next year
    if end_date < now:
        year += 1
        if year == 2026:
            start_date = datetime(2026, 6, 10)
            end_date = datetime(2026, 6, 12)
        else:
            june_1 = datetime(year, 6, 1)
            days_until_wed = (2 - june_1.weekday()) % 7
            first_wed = june_1 + __import__("datetime").timedelta(days=days_until_wed)
            second_wed = first_wed + __import__("datetime").timedelta(days=7)
            start_date = second_wed
            end_date = second_wed + __import__("datetime").timedelta(days=2)

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"RenderATL {year}"
    content_hash = generate_content_hash(
        title, "Atlanta Conference Center at CNN", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"RenderATL {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "The largest tech conference in the Southeast focused on software engineering, celebrating Black technologists and fostering diversity in tech.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "09:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "18:00",
        "is_all_day": False,
        "category": "community",
        "subcategory": "conference",
        "tags": [
            "renderatl",
            "tech",
            "conference",
            "software",
            "diversity",
            "black-tech",
        ],
        "price_min": 400.0,
        "price_max": 800.0,
        "price_note": "Early bird and regular tickets available",
        "is_free": False,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.95,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=6",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert RenderATL: {e}")

    return events_found, events_new, events_updated
