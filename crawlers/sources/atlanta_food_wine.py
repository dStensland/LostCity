"""
Crawler for Atlanta Food & Wine Festival (atlfoodandwinefestival.com).
Annual culinary celebration - typically May.
"""

from __future__ import annotations

import logging
from datetime import datetime

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlfoodandwinefestival.com"

VENUE_DATA = {
    "name": "Loews Atlanta Hotel",
    "slug": "loews-atlanta-hotel",
    "address": "1065 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7856,
    "lng": -84.3838,
    "venue_type": "hotel",
    "spot_type": "hotel",
    "website": "https://www.loewshotels.com/atlanta-hotel",
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Food & Wine Festival - generates annual event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    # Atlanta Food & Wine Festival is typically third weekend of May
    may_1 = datetime(year, 5, 1)
    # Find third Thursday
    days_until_thu = (3 - may_1.weekday()) % 7
    first_thu = may_1 + __import__("datetime").timedelta(days=days_until_thu)
    third_thu = first_thu + __import__("datetime").timedelta(days=14)
    start_date = third_thu
    end_date = third_thu + __import__("datetime").timedelta(days=3)  # Thu-Sun

    # If past, use next year
    if end_date < now:
        year += 1
        may_1 = datetime(year, 5, 1)
        days_until_thu = (3 - may_1.weekday()) % 7
        first_thu = may_1 + __import__("datetime").timedelta(days=days_until_thu)
        third_thu = first_thu + __import__("datetime").timedelta(days=14)
        start_date = third_thu
        end_date = third_thu + __import__("datetime").timedelta(days=3)

    venue_id = get_or_create_venue(VENUE_DATA)
    events_found = 1

    title = f"Atlanta Food & Wine Festival {year}"
    content_hash = generate_content_hash(
        title, "Loews Atlanta Hotel", start_date.strftime("%Y-%m-%d")
    )

    if find_event_by_hash(content_hash):
        events_updated = 1
        logger.info(f"Atlanta Food & Wine Festival {year} already exists")
        return events_found, events_new, events_updated

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": "Atlanta's premier food and wine event featuring top Southern chefs, wine tastings, cooking demonstrations, and culinary experiences.",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "11:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "22:00",
        "is_all_day": False,
        "category": "food_drink",
        "subcategory": "festival",
        "tags": ["food-wine-festival", "culinary", "wine", "southern-food", "midtown"],
        "price_min": 75.0,
        "price_max": 350.0,
        "price_note": "Individual events and all-access passes available",
        "is_free": False,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
        "image_url": None,
        "raw_text": None,
        "extraction_confidence": 0.95,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=5",
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        events_new = 1
        logger.info(f"Added: {title}")
    except Exception as e:
        logger.error(f"Failed to insert Atlanta Food & Wine Festival: {e}")

    return events_found, events_new, events_updated
