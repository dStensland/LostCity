"""Crawler for Peachtree Road Farmers Market.

Weekly Saturday farmers market in Buckhead. The site is useful for venue and
image refreshes, but the event itself is recurring and should not depend on
fragile title/date scraping from page chrome.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

from playwright.sync_api import sync_playwright

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.peachtreeroadfarmersmarket.com"
EVENTS_URL = BASE_URL

PLACE_DATA = {
    "name": "Peachtree Road Farmers Market",
    "slug": "peachtree-road-farmers-market",
    "address": "2744 Peachtree Rd NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8199,
    "lng": -84.3732,
    "place_type": "market",
    "website": BASE_URL,
}
MARKET_TITLE = "Peachtree Road Farmers Market"
MARKET_DESCRIPTION = (
    "Weekly Saturday farmers market in Buckhead featuring local produce, "
    "prepared food, flowers, and community vendors."
)


def _next_market_date(now: datetime | None = None) -> date:
    """Return the next valid Saturday market date.

    If today is Saturday and it's still before noon, use today. Otherwise use
    the next Saturday.
    """
    current = now or datetime.now()
    today = current.date()
    days_ahead = (5 - today.weekday()) % 7
    if days_ahead == 0 and current.hour >= 12:
        days_ahead = 7
    return today + timedelta(days=days_ahead)


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

            venue_id = get_or_create_place(PLACE_DATA)

            logger.info(f"Fetching Peachtree Road Farmers Market: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            image_map = extract_images_from_page(page)
            market_image = next((url for url in image_map.values() if url), None)
            next_market = _next_market_date()
            start_date = next_market.isoformat()
            content_hash = generate_content_hash(
                MARKET_TITLE, PLACE_DATA["name"], start_date
            )

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": MARKET_TITLE,
                "description": MARKET_DESCRIPTION,
                "start_date": start_date,
                "start_time": "08:30",
                "end_date": None,
                "end_time": "12:00",
                "is_all_day": False,
                "category": "food_drink",
                "subcategory": "market",
                "tags": [
                    "farmers-market",
                    "local-produce",
                    "buckhead",
                    "community",
                ],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": market_image,
                "raw_text": f"{MARKET_TITLE} - {start_date}",
                "extraction_confidence": 0.95,
                "is_recurring": True,
                "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA",
                "content_hash": content_hash,
            }

            events_found = 1
            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated = 1
            else:
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": MARKET_TITLE,
                    "frequency": "weekly",
                    "day_of_week": "Saturday",
                    "description": MARKET_DESCRIPTION,
                }
                if market_image:
                    series_hint["image_url"] = market_image
                insert_event(event_record, series_hint=series_hint)
                events_new = 1
                logger.info("Added recurring market row for %s", start_date)

            browser.close()

        logger.info(f"Peachtree Road Farmers Market crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Peachtree Road Farmers Market: {e}")
        raise

    return events_found, events_new, events_updated
