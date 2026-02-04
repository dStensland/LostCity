"""
Crawler for Janke Studios glassblowing classes and events.
http://jankestudios.com/
Atlanta's first complete glassblowing center in Old Fourth Ward.
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

WEBSITE_URL = "http://jankestudios.com/"
CLASSES_URL = "http://jankestudios.com/classes/"
VENUE_NAME = "Janke Studios"
VENUE_ADDRESS = "659 Auburn Ave NE"
VENUE_CITY = "Atlanta"
VENUE_STATE = "GA"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Janke Studios for glassblowing classes and events."""
    if not source.get("is_active"):
        logger.info("Janke Studios source is not active, skipping")
        return 0, 0, 0

    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_data = {
        "name": VENUE_NAME,
        "slug": "janke-studios",
        "address": VENUE_ADDRESS,
        "city": VENUE_CITY,
        "state": VENUE_STATE,
        "neighborhood": "Old Fourth Ward",
        "spot_type": "gallery",
        "vibes": ["artsy", "date-spot", "intimate"],
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

            # Try to find their calendar or class schedule
            for url in [CLASSES_URL, WEBSITE_URL, "http://jankestudios.com/calendar/", "http://jankestudios.com/schedule/"]:
                try:
                    logger.info(f"Fetching Janke Studios: {url}")
                    page.goto(url, wait_until="networkidle", timeout=30000)
                    page.wait_for_timeout(2000)

                    # Check if page has useful content
                    content = page.inner_text("body")
                    if len(content) > 500:
                        break
                except Exception:
                    continue

            # Look for calendar widgets, class listings, or event sections
            # Common patterns: Calendly, Acuity, custom calendars

            # Check for embedded calendars
            iframes = page.query_selector_all('iframe[src*="calendly"], iframe[src*="acuity"], iframe[src*="calendar"]')
            if iframes:
                logger.info("Found embedded calendar - would need to parse iframe content")

            # Look for class/event listings on the page
            event_containers = page.query_selector_all('[class*="event"], [class*="class"], [class*="workshop"], .schedule-item, .booking-item')

            if not event_containers:
                # Try finding any dated content
                event_containers = page.query_selector_all('article, .post, [class*="listing"]')

            logger.info(f"Found {len(event_containers)} potential class/event elements")

            for elem in event_containers[:20]:
                try:
                    text = elem.inner_text().strip()
                    if not text or len(text) < 10:
                        continue

                    # Look for date patterns in the text
                    # Common formats: "January 15", "1/15/2026", "2026-01-15"
                    date_patterns = [
                        r'(\d{4}-\d{2}-\d{2})',  # ISO format
                        r'(\d{1,2}/\d{1,2}/\d{4})',  # US format
                        r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:, \d{4})?)',  # Month Day
                    ]

                    start_date = None
                    for pattern in date_patterns:
                        match = re.search(pattern, text, re.IGNORECASE)
                        if match:
                            date_str = match.group(1)
                            try:
                                if "-" in date_str and len(date_str) == 10:
                                    start_date = date_str
                                elif "/" in date_str:
                                    dt = datetime.strptime(date_str, "%m/%d/%Y")
                                    start_date = dt.strftime("%Y-%m-%d")
                                else:
                                    # Try parsing month name format
                                    for fmt in ["%B %d, %Y", "%B %d", "%b %d, %Y", "%b %d"]:
                                        try:
                                            dt = datetime.strptime(date_str, fmt)
                                            if dt.year == 1900:
                                                dt = dt.replace(year=datetime.now().year)
                                            start_date = dt.strftime("%Y-%m-%d")
                                            break
                                        except ValueError:
                                            continue
                            except Exception:
                                pass
                            if start_date:
                                break

                    if not start_date:
                        continue

                    # Extract title - first line or heading
                    lines = text.split('\n')
                    title = lines[0].strip()[:100]

                    if not title or len(title) < 3:
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
                        "description": text[:1000] if len(text) > len(title) else None,
                        "start_date": start_date,
                        "start_time": None,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "art",
                        "subcategory": "art.class",
                        "tags": ["glassblowing", "art-class", "workshop", "hands-on"],
                        "price_min": 80,  # Based on their pricing
                        "price_max": 150,
                        "price_note": "See website for class pricing",
                        "is_free": False,
                        "source_url": CLASSES_URL,
                        "ticket_url": CLASSES_URL,
                        "image_url": None,
                        "raw_text": None,
                        "extraction_confidence": 0.6,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                        "is_class": True,
                        "class_category": "mixed",
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing element: {e}")
                    continue

            browser.close()

        logger.info(f"Janke Studios crawl complete: {events_found} found, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Janke Studios: {e}")
        raise

    return events_found, events_new, events_updated
