"""
Crawler for East Atlanta Village Farmers Market.
Weekly community farmers market - Thursdays 4-8pm, March through November.

Part of Community Farmers Markets (CFM Atlanta).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://cfmatl.org/eav/"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "East Atlanta Village Farmers Market",
    "slug": "eav-farmers-market",
    "address": "572 Stokeswood Ave SE",
    "neighborhood": "East Atlanta Village",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "market",
    "website": BASE_URL,
}


def generate_market_dates(year: int, start_month: int, start_day: int, end_month: int, end_day: int, weekday: int) -> list[datetime]:
    """Generate all market dates for a season.

    Args:
        year: The year
        start_month, start_day: Season start date
        end_month, end_day: Season end date
        weekday: Day of week (0=Monday, 3=Thursday, etc.)

    Returns:
        List of datetime objects for each market day
    """
    start_date = datetime(year, start_month, start_day)
    end_date = datetime(year, end_month, end_day)

    dates = []
    current = start_date

    # Find first occurrence of weekday
    while current.weekday() != weekday:
        current += timedelta(days=1)

    # Generate all dates
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

            logger.info(f"Fetching EAV Farmers Market: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            # EAV Market: Thursdays 4-8pm, March 26 - Nov 19, 2026
            # Generate dates for current and next year's season
            current_year = datetime.now().year

            for year in [current_year, current_year + 1]:
                # Season runs late March to mid November
                market_dates = generate_market_dates(
                    year=year,
                    start_month=3, start_day=26,  # March 26
                    end_month=11, end_day=19,     # November 19
                    weekday=3  # Thursday
                )

                for market_date in market_dates:
                    # Skip past dates
                    if market_date.date() < datetime.now().date():
                        continue

                    # Limit to next 6 months of events
                    if market_date > datetime.now() + timedelta(days=180):
                        continue

                    events_found += 1
                    start_date_str = market_date.strftime("%Y-%m-%d")
                    title = "EAV Farmers Market"

                    content_hash = generate_content_hash(title, "East Atlanta Village Farmers Market", start_date_str)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": "Weekly farmers market featuring local produce, artisan goods, prepared foods, and live cooking demonstrations. Georgia Fresh For Less: EBT dollars get double the value!",
                        "start_date": start_date_str,
                        "start_time": "16:00",  # 4pm
                        "end_date": start_date_str,
                        "end_time": "20:00",    # 8pm
                        "is_all_day": False,
                        "category": "food_drink",
                        "subcategory": "farmers_market",
                        "tags": ["farmers-market", "local-food", "east-atlanta", "outdoor", "family-friendly", "dog-friendly"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Free admission",
                        "is_free": True,
                        "source_url": EVENTS_URL,
                        "ticket_url": None,
                        "image_url": None,
                        "raw_text": f"EAV Farmers Market - {start_date_str} 4-8pm",
                        "extraction_confidence": 0.95,
                        "is_recurring": True,
                        "recurrence_rule": "FREQ=WEEKLY;BYDAY=TH",
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date_str}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

            browser.close()

        logger.info(f"EAV Farmers Market crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl EAV Farmers Market: {e}")
        raise

    return events_found, events_new, events_updated
