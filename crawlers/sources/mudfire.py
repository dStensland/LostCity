"""
Crawler for MudFire pottery studio classes and events.
https://www.mudfire.com/
LGBTQ+ owned ceramics studio in Decatur.
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

WEBSITE_URL = "https://www.mudfire.com/"
CLASSES_URL = "https://www.mudfire.com/classes"
VENUE_NAME = "MudFire"
VENUE_ADDRESS = "175 Laredo Dr"
VENUE_CITY = "Decatur"
VENUE_STATE = "GA"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl MudFire for pottery classes and events."""
    if not source.get("is_active"):
        logger.info("MudFire source is not active, skipping")
        return 0, 0, 0

    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_data = {
        "name": VENUE_NAME,
        "slug": "mudfire",
        "address": VENUE_ADDRESS,
        "city": VENUE_CITY,
        "state": VENUE_STATE,
        "spot_type": "gallery",
        "vibes": ["artsy", "chill", "lgbtq-friendly"],
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

            logger.info(f"Fetching MudFire classes: {CLASSES_URL}")
            page.goto(CLASSES_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(3000)

            # Scroll to load content
            for _ in range(3):
                page.keyboard.press("End")
                page.wait_for_timeout(1000)

            # Look for class listings
            class_elements = page.query_selector_all('[class*="class"], [class*="event"], [class*="workshop"], [class*="course"], .product-item, .class-item')

            if not class_elements:
                # Try finding any cards or list items with dates
                class_elements = page.query_selector_all('article, .card, [class*="listing"], [class*="item"]')

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
                        r'((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),? (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2})',
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
                                    # Clean up day name if present
                                    date_str = re.sub(r'^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*', '', date_str, flags=re.IGNORECASE)
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
                    lines = text.split('\n')
                    title = lines[0].strip()[:100]

                    if not title or len(title) < 3:
                        continue

                    # Skip if it's just a date or price
                    if re.match(r'^[\d\$\s/,.-]+$', title):
                        continue

                    events_found += 1

                    # Try to get link
                    link = elem.query_selector("a")
                    event_url = CLASSES_URL
                    if link:
                        href = link.get_attribute("href")
                        if href:
                            event_url = href if href.startswith("http") else f"https://www.mudfire.com{href}"

                    content_hash = generate_content_hash(title, VENUE_NAME, start_date)

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    description = text[:1000] if len(text) > len(title) else None

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
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

                    # Build series hint for class enrichment
                    series_hint = {
                        "series_type": "class_series",
                        "series_title": title,
                    }
                    if description:
                        series_hint["description"] = description

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing element: {e}")
                    continue

            browser.close()

        logger.info(f"MudFire crawl complete: {events_found} found, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl MudFire: {e}")
        raise

    return events_found, events_new, events_updated
