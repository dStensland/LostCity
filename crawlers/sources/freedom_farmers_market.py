"""
Crawler for Freedom Farmers Market.
Year-round weekly farmers market - Saturdays 8:30am-12pm at Carter Center.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://freedomfarmersmkt.com"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Freedom Farmers Market",
    "slug": "freedom-farmers-market",
    "address": "453 John Lewis Freedom Parkway NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "venue_type": "market",
    "website": BASE_URL,
}


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Freedom Farmers Market: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            # Freedom Market: Year-round, Saturdays 8:30am-12pm
            # Generate next 6 months of Saturdays
            current_date = datetime.now()
            end_date = current_date + timedelta(days=180)

            # Find next Saturday
            current = current_date
            while current.weekday() != 5:  # Saturday
                current += timedelta(days=1)

            while current <= end_date:
                events_found += 1
                start_date_str = current.strftime("%Y-%m-%d")
                title = "Freedom Farmers Market"

                content_hash = generate_content_hash(title, "Freedom Farmers Market", start_date_str)

                if find_event_by_hash(content_hash):
                    events_updated += 1
                    current += timedelta(days=7)
                    continue

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": "Year-round organic farmers market at the Carter Center featuring local, sustainably grown produce, grass-fed meats, dairy, eggs, baked goods, and more. Live music and chef demos weekly.",
                    "start_date": start_date_str,
                    "start_time": "08:30",
                    "end_date": start_date_str,
                    "end_time": "12:00",
                    "is_all_day": False,
                    "category": "food_drink",
                    "subcategory": "farmers_market",
                    "tags": ["farmers-market", "organic", "local-food", "inman-park", "carter-center", "outdoor", "family-friendly"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Free admission",
                    "is_free": True,
                    "source_url": EVENTS_URL,
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": f"Freedom Farmers Market - {start_date_str} 8:30am-12pm",
                    "extraction_confidence": 0.95,
                    "is_recurring": True,
                    "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA",
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date_str}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

                current += timedelta(days=7)

            browser.close()

        logger.info(f"Freedom Farmers Market crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Freedom Farmers Market: {e}")
        raise

    return events_found, events_new, events_updated
