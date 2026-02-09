"""
Crawler for Crafted Creations Candle Studio in Doraville.
https://craftedcreationsnorthatlanta.com/

A candle-making studio offering BYOB workshops where participants make custom candles.
Classes run regularly on Wednesdays, Saturdays, and Sundays.
"""

from __future__ import annotations

import logging
import httpx
from datetime import datetime, timedelta
from typing import Optional

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

WEBSITE_URL = "https://craftedcreationsnorthatlanta.com"
CLASSES_URL = f"{WEBSITE_URL}/collections/byob-candle-making-classes"

VENUE_DATA = {
    "name": "Crafted Creations Candle Studio",
    "slug": "crafted-creations-candle-studio",
    "address": "6035 Peachtree Rd, STE C-212",
    "neighborhood": "Doraville",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30360",
    "lat": 33.8986,
    "lng": -84.2834,
    "venue_type": "studio",
    "spot_type": "studio",
    "website": WEBSITE_URL,
    "vibes": ["date-spot", "hands-on", "byob", "craft", "doraville"],
}


async def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Crafted Creations candle-making classes.

    They offer regular recurring classes (Wed/Sat/Sun) without specific scheduled dates.
    We create recurring event stubs for the next few weeks based on their regular schedule.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Using venue ID: {venue_id}")
    except Exception as e:
        logger.error(f"Failed to create venue: {e}")
        return 0, 0, 0

    # Fetch products from Shopify API
    try:
        async with httpx.AsyncClient() as client:
            products_url = f"{WEBSITE_URL}/products.json"
            logger.info(f"Fetching products from: {products_url}")

            response = await client.get(products_url, timeout=15.0)
            response.raise_for_status()

            data = response.json()
            products = data.get("products", [])

            logger.info(f"Found {len(products)} total products")

            # Define recurring class schedule
            # Based on their product names and business hours
            recurring_classes = [
                {
                    "title": "90min BYOB Saturday Experience (2 Custom Candles)",
                    "day_of_week": 5,  # Saturday (0=Monday, 6=Sunday)
                    "start_time": "12:00",  # Saturday-Sunday 12pm-7pm
                    "price_min": 55,
                    "price_max": 55,
                    "description": "Make TWO custom candles to your liking. Choose from 30+ fragrances. BYOB (21+). Classes scheduled during studio hours. Must be 13+ (13-17 must be with adult).",
                },
                {
                    "title": "90min BYOB Sunday Experience (Candle + Room Spray)",
                    "day_of_week": 6,  # Sunday
                    "start_time": "12:00",
                    "price_min": 55,
                    "price_max": 55,
                    "description": "Make a custom candle AND room spray to your liking. Choose from 30+ fragrances. BYOB (21+). Classes scheduled during studio hours. Must be 13+ (13-17 must be with adult).",
                },
                {
                    "title": "Wine Down Wednesday Candle Making Class",
                    "day_of_week": 2,  # Wednesday
                    "start_time": "18:00",  # Tuesday-Friday 2pm-7pm, assume evening class
                    "price_min": 65,
                    "price_max": 65,
                    "description": "Looking for something different with great vibes? Make a custom candle, select from 30+ fragrances, name your candle and mix your custom scents. BYOB wine encouraged!",
                },
                {
                    "title": "Saturday Night Live Candle Making Class",
                    "day_of_week": 5,  # Saturday
                    "start_time": "19:00",  # Evening session
                    "price_min": 65,
                    "price_max": 65,
                    "description": "Evening candle-making experience with great vibes. Make a custom candle, select from 30+ fragrances, name your candle and mix your custom scents.",
                },
            ]

            # Generate events for the next 4 weeks
            today = datetime.now().date()
            weeks_ahead = 4

            for class_info in recurring_classes:
                # Find next occurrence of this day of week
                day_of_week = class_info["day_of_week"]
                days_ahead = (day_of_week - today.weekday()) % 7
                if days_ahead == 0:
                    days_ahead = 7  # Start from next week

                # Create events for each occurrence in the next N weeks
                for week in range(weeks_ahead):
                    event_date = today + timedelta(days=days_ahead + (week * 7))
                    start_date_str = event_date.strftime("%Y-%m-%d")

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        class_info["title"],
                        VENUE_DATA["name"],
                        start_date_str
                    )

                    # Check if event already exists
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Create event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": class_info["title"],
                        "description": class_info["description"],
                        "start_date": start_date_str,
                        "start_time": class_info["start_time"],
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "art",
                        "subcategory": "art.class",
                        "tags": [
                            "candle-making",
                            "craft",
                            "diy",
                            "workshop",
                            "doraville",
                            "byob",
                            "hands-on",
                        ],
                        "price_min": class_info["price_min"],
                        "price_max": class_info["price_max"],
                        "price_note": "Per person. Book by phone: (678) 620-3458",
                        "is_free": False,
                        "source_url": CLASSES_URL,
                        "ticket_url": CLASSES_URL,
                        "image_url": None,
                        "raw_text": None,
                        "extraction_confidence": 0.85,
                        "is_recurring": True,
                        "recurrence_rule": f"Weekly on {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day_of_week]}s",
                        "content_hash": content_hash,
                        "is_class": True,
                        "class_category": "crafts",
                    }

                    # Build series hint for class enrichment
                    series_hint = {
                        "series_type": "class_series",
                        "series_title": class_info["title"],
                    }
                    if class_info.get("description"):
                        series_hint["description"] = class_info["description"]

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(
                            f"Added: {class_info['title']} on {start_date_str}"
                        )
                    except Exception as e:
                        logger.error(
                            f"Failed to insert {class_info['title']}: {e}"
                        )

            logger.info(
                f"Crafted Creations crawl complete: {events_found} found, "
                f"{events_new} new, {events_updated} updated"
            )

    except Exception as e:
        logger.error(f"Failed to crawl Crafted Creations: {e}")
        raise

    return events_found, events_new, events_updated
