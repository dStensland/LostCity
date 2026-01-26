"""
Crawler for Spruill Center for the Arts classes and workshops.
https://www.spruillarts.org/
One of the largest ceramics programs in Georgia.
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

WEBSITE_URL = "https://www.spruillarts.org/"
CLASSES_URL = "https://registration.spruillarts.org/wconnect/subGroup.awp?Group=ADT&Title=Adult+Classes+and+Workshops"
VENUE_NAME = "Spruill Center for the Arts"
VENUE_ADDRESS = "5339 Chamblee Dunwoody Rd"
VENUE_CITY = "Dunwoody"
VENUE_STATE = "GA"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Spruill Center for classes and workshops."""
    if not source.get("is_active"):
        logger.info("Spruill Center source is not active, skipping")
        return 0, 0, 0

    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_data = {
        "name": VENUE_NAME,
        "slug": "spruill-center",
        "address": VENUE_ADDRESS,
        "city": VENUE_CITY,
        "state": VENUE_STATE,
        "spot_type": "gallery",
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

            logger.info(f"Fetching Spruill Center classes: {CLASSES_URL}")
            page.goto(CLASSES_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(3000)

            # Scroll to load content
            for _ in range(3):
                page.keyboard.press("End")
                page.wait_for_timeout(1000)

            # Look for class listings in their registration system
            # Common patterns for class registration sites
            class_rows = page.query_selector_all('tr[class*="class"], tr[class*="course"], .class-row, .course-item, [class*="listing"]')

            if not class_rows:
                # Try finding table rows or list items
                class_rows = page.query_selector_all('table tr, .list-item, article')

            logger.info(f"Found {len(class_rows)} potential class rows")

            for elem in class_rows[:50]:
                try:
                    text = elem.inner_text().strip()
                    if not text or len(text) < 10:
                        continue

                    # Look for date patterns
                    date_patterns = [
                        r'(\d{1,2}/\d{1,2}/\d{4})',
                        r'(\d{1,2}/\d{1,2}/\d{2})',
                        r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:, \d{4})?)',
                    ]

                    start_date = None
                    for pattern in date_patterns:
                        match = re.search(pattern, text, re.IGNORECASE)
                        if match:
                            date_str = match.group(1)
                            try:
                                if "/" in date_str:
                                    # Handle 2-digit year
                                    if len(date_str.split('/')[-1]) == 2:
                                        dt = datetime.strptime(date_str, "%m/%d/%y")
                                    else:
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

                    # Extract title - look for course name
                    lines = [l.strip() for l in text.split('\n') if l.strip()]
                    title = None
                    for line in lines:
                        # Skip lines that are just dates, times, prices
                        if re.match(r'^[\d\$\s/,:.%-]+$', line):
                            continue
                        if len(line) > 5 and len(line) < 100:
                            title = line
                            break

                    if not title:
                        continue

                    events_found += 1

                    # Try to get link
                    link = elem.query_selector("a")
                    event_url = CLASSES_URL
                    if link:
                        href = link.get_attribute("href")
                        if href:
                            event_url = href if href.startswith("http") else f"https://registration.spruillarts.org{href}"

                    content_hash = generate_content_hash(title, VENUE_NAME, start_date)

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Determine category based on title
                    title_lower = title.lower()
                    if any(w in title_lower for w in ["ceramic", "pottery", "clay", "wheel", "glaze"]):
                        tags = ["pottery", "ceramics", "art-class"]
                    elif any(w in title_lower for w in ["paint", "drawing", "sketch"]):
                        tags = ["painting", "drawing", "art-class"]
                    elif any(w in title_lower for w in ["jewelry", "metal", "silver"]):
                        tags = ["jewelry", "metalwork", "art-class"]
                    elif any(w in title_lower for w in ["photo"]):
                        tags = ["photography", "art-class"]
                    else:
                        tags = ["art-class", "workshop"]

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
                        "tags": tags,
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

        logger.info(f"Spruill Center crawl complete: {events_found} found, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Spruill Center: {e}")
        raise

    return events_found, events_new, events_updated
