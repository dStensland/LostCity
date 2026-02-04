"""
Crawler for Atlanta Clay Works pottery classes.
https://www.atlclayworks.org/
Community pottery studio.
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

WEBSITE_URL = "https://www.atlclayworks.org/"
CLASSES_URL = "https://www.atlclayworks.org/classes"
VENUE_NAME = "Atlanta Clay Works"
VENUE_ADDRESS = "1401 Southland Cir NW"
VENUE_CITY = "Atlanta"
VENUE_STATE = "GA"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Clay Works for pottery classes."""
    if not source.get("is_active"):
        logger.info("Atlanta Clay Works source is not active, skipping")
        return 0, 0, 0

    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_data = {
        "name": VENUE_NAME,
        "slug": "atlanta-clay-works",
        "address": VENUE_ADDRESS,
        "city": VENUE_CITY,
        "state": VENUE_STATE,
        "spot_type": "gallery",
        "vibes": ["artsy", "chill"],
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

            logger.info(f"Fetching Atlanta Clay Works classes: {CLASSES_URL}")
            page.goto(CLASSES_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(3000)

            # Scroll to load content
            for _ in range(3):
                page.keyboard.press("End")
                page.wait_for_timeout(1000)

            # Look for class cards or listings
            class_elements = page.query_selector_all('[class*="class"], [class*="event"], [class*="workshop"], .product, .card, article')

            logger.info(f"Found {len(class_elements)} potential class elements")

            for elem in class_elements[:30]:
                try:
                    text = elem.inner_text().strip()
                    if not text or len(text) < 10:
                        continue

                    # Look for date patterns
                    date_patterns = [
                        r'(\d{4}-\d{2}-\d{2})',
                        r'(\d{1,2}/\d{1,2}/\d{4})',
                        r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:, \d{4})?)',
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
                                    for fmt in ["%B %d, %Y", "%B %d", "%b %d, %Y", "%b %d"]:
                                        try:
                                            dt = datetime.strptime(date_str.strip(), fmt)
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

                    # Extract title
                    lines = [l.strip() for l in text.split('\n') if l.strip()]
                    title = None
                    for line in lines:
                        if re.match(r'^[\d\$\s/,:.%-]+$', line):
                            continue
                        if len(line) > 5 and len(line) < 100:
                            title = line
                            break

                    if not title:
                        continue

                    events_found += 1

                    link = elem.query_selector("a")
                    event_url = CLASSES_URL
                    if link:
                        href = link.get_attribute("href")
                        if href:
                            event_url = href if href.startswith("http") else f"https://www.atlclayworks.org{href}"

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
                        "tags": ["pottery", "ceramics", "art-class", "workshop", "hands-on"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "See website for class pricing",
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": None,
                        "raw_text": None,
                        "extraction_confidence": 0.7,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                        "is_class": True,
                        "class_category": "pottery",
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

        logger.info(f"Atlanta Clay Works crawl complete: {events_found} found, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Clay Works: {e}")
        raise

    return events_found, events_new, events_updated
