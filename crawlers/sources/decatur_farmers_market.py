"""
Crawler for Decatur Farmers Market.
Weekly community farmers market - Wednesdays 4-7pm, March through November.

Part of Community Farmers Markets (CFM Atlanta).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://cfmatl.org/decatur/"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Decatur Farmers Market",
    "slug": "decatur-farmers-market",
    "address": "308 Clairemont Ave",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "venue_type": "market",
    "website": BASE_URL,
}


def generate_market_dates(year: int, start_month: int, start_day: int, end_month: int, end_day: int, weekday: int) -> list[datetime]:
    """Generate all market dates for a season."""
    start_date = datetime(year, start_month, start_day)
    end_date = datetime(year, end_month, end_day)

    dates = []
    current = start_date

    while current.weekday() != weekday:
        current += timedelta(days=1)

    while current <= end_date:
        dates.append(current)
        current += timedelta(days=7)

    return dates


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

            logger.info(f"Fetching Decatur Farmers Market: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Decatur Market: Wednesdays 4-7pm, late March - mid November
            current_year = datetime.now().year

            for year in [current_year, current_year + 1]:
                market_dates = generate_market_dates(
                    year=year,
                    start_month=3, start_day=25,
                    end_month=11, end_day=18,
                    weekday=2  # Wednesday
                )

                for market_date in market_dates:
                    if market_date.date() < datetime.now().date():
                        continue

                    if market_date > datetime.now() + timedelta(days=180):
                        continue

                    events_found += 1
                    start_date_str = market_date.strftime("%Y-%m-%d")
                    title = "Decatur Farmers Market"

                    content_hash = generate_content_hash(title, "Decatur Farmers Market", start_date_str)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": "Weekly farmers market in Decatur featuring local produce, prepared foods, and artisan goods. Georgia Fresh For Less: EBT dollars get double the value!",
                        "start_date": start_date_str,
                        "start_time": "16:00",
                        "end_date": start_date_str,
                        "end_time": "19:00",
                        "is_all_day": False,
                        "category": "food_drink",
                        "subcategory": "farmers_market",
                        "tags": ["farmers-market", "local-food", "decatur", "outdoor", "family-friendly"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Free admission",
                        "is_free": True,
                        "source_url": EVENTS_URL,
                        "ticket_url": None,
                        "image_url": image_map.get(title),
                        "raw_text": f"Decatur Farmers Market - {start_date_str} 4-7pm",
                        "extraction_confidence": 0.95,
                        "is_recurring": True,
                        "recurrence_rule": "FREQ=WEEKLY;BYDAY=WE",
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date_str}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

            browser.close()

        logger.info(f"Decatur Farmers Market crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Decatur Farmers Market: {e}")
        raise

    return events_found, events_new, events_updated
