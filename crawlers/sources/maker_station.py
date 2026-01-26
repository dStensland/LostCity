"""
Crawler for The Maker Station events.
https://www.themakerstation.com/
Cobb County makerspace in Smyrna area.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

CALENDAR_URL = "https://www.themakerstation.com/calendar"
VENUE_NAME = "The Maker Station"
VENUE_ADDRESS = "2985 Gordy Pkwy"
VENUE_CITY = "Marietta"
VENUE_STATE = "GA"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Maker Station for events."""
    if not source.get("is_active"):
        logger.info("The Maker Station source is not active, skipping")
        return 0, 0, 0

    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_data = {
        "name": VENUE_NAME,
        "slug": "the-maker-station",
        "address": VENUE_ADDRESS,
        "city": VENUE_CITY,
        "state": VENUE_STATE,
        "spot_type": "community_center",
        "vibes": ["artsy", "chill", "family-friendly"],
    }

    try:
        venue_id = get_or_create_venue(venue_data)
    except Exception as e:
        logger.error(f"Failed to create venue: {e}")
        venue_id = None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching The Maker Station events: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(3000)

            # Look for event elements - common calendar patterns
            # Try multiple selectors for different calendar implementations
            event_elements = page.query_selector_all('[class*="event"], [class*="calendar-item"], .fc-event, [data-event]')

            if not event_elements:
                # Try finding links that look like events
                event_elements = page.query_selector_all('a[href*="event"], a[href*="class"], a[href*="workshop"]')

            logger.info(f"Found {len(event_elements)} potential events")

            for elem in event_elements[:30]:
                try:
                    # Try to get event details
                    title = elem.inner_text().strip()
                    if not title or len(title) < 3 or len(title) > 200:
                        continue

                    # Skip navigation/header text
                    skip_words = ["menu", "home", "about", "contact", "login", "sign"]
                    if any(sw in title.lower() for sw in skip_words):
                        continue

                    href = elem.get_attribute("href")
                    event_url = href if href and href.startswith("http") else f"https://www.themakerstation.com{href}" if href else CALENDAR_URL

                    # Try to extract date from the element or nearby
                    date_text = None
                    time_el = elem.query_selector("time, [class*='date'], [class*='time']")
                    if time_el:
                        date_text = time_el.get_attribute("datetime") or time_el.inner_text()

                    start_date = None
                    start_time = None

                    if date_text:
                        # Try to parse various date formats
                        try:
                            if "T" in str(date_text):
                                dt = datetime.fromisoformat(date_text.replace("Z", "+00:00"))
                                start_date = dt.strftime("%Y-%m-%d")
                                start_time = dt.strftime("%H:%M")
                        except Exception:
                            pass

                    # If no date found, skip (we need dates for events)
                    if not start_date:
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, VENUE_NAME, start_date)

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "community",
                        "subcategory": "meetup.tech",
                        "tags": ["makerspace", "diy", "workshops"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "See website for details",
                        "is_free": None,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": None,
                        "raw_text": None,
                        "extraction_confidence": 0.7,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing event element: {e}")
                    continue

            browser.close()

        logger.info(f"The Maker Station crawl complete: {events_found} found, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl The Maker Station: {e}")
        raise

    return events_found, events_new, events_updated
