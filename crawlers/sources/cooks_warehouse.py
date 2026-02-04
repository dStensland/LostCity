"""
Crawler for The Cook's Warehouse cooking classes (cookswarehouse.com).

Site uses SearchSpring (JavaScript-rendered) - must use Playwright.
Classes are paginated across 3 pages with ~30 classes per page.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, parse_price

logger = logging.getLogger(__name__)

BASE_URL = "https://cookswarehouse.com"
EVENTS_URL = f"{BASE_URL}/all-classes/"

VENUE_DATA = {
    "name": "The Cook's Warehouse",
    "slug": "cooks-warehouse",
    "address": "1544 Piedmont Ave NE, STE 403-R",
    "neighborhood": "Ansley Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.7993,
    "lng": -84.3733,
    "venue_type": "retail",
    "spot_type": "cooking_school",
    "website": BASE_URL,
}


def parse_class_title(line: str) -> Optional[dict]:
    """
    Parse class listing title format: "FEB 3 2026 6:30PM: Knife Skills 101 Hands On"

    Returns:
        Dict with date, time, and title, or None if not parseable
    """
    # Match format: "MMM DD YYYY HH:MMAM/PM: Class Title"
    match = re.match(
        r"([A-Z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}(?::\d{2})?(?:AM|PM)):\s*(.+)",
        line,
        re.IGNORECASE
    )

    if not match:
        return None

    month_abbr, day, year, time_str, title = match.groups()

    # Parse date
    try:
        dt = datetime.strptime(f"{month_abbr} {day} {year}", "%b %d %Y")
        start_date = dt.strftime("%Y-%m-%d")
    except ValueError:
        logger.warning(f"Failed to parse date from: {line}")
        return None

    # Parse time
    time_match = re.match(r"(\d{1,2})(?::(\d{2}))?(?:AM|PM)", time_str, re.IGNORECASE)
    if time_match:
        hour_str = time_match.group(1)
        minute_str = time_match.group(2) or "00"
        hour = int(hour_str)
        minute = int(minute_str)

        # Convert to 24-hour format
        if "PM" in time_str.upper() and hour != 12:
            hour += 12
        elif "AM" in time_str.upper() and hour == 12:
            hour = 0

        start_time = f"{hour:02d}:{minute:02d}"
    else:
        start_time = None

    return {
        "title": title.strip(),
        "start_date": start_date,
        "start_time": start_time,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Cook's Warehouse events using Playwright with pagination."""
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

            # Loop through 3 pages of classes
            for page_num in range(1, 4):
                url = f"{EVENTS_URL}?p={page_num}" if page_num > 1 else EVENTS_URL

                logger.info(f"Fetching The Cook's Warehouse page {page_num}: {url}")
                page.goto(url, wait_until="domcontentloaded", timeout=30000)

                # Wait for SearchSpring to render content
                page.wait_for_timeout(4000)

                # Scroll to ensure all lazy-loaded content appears
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1000)

                # Extract images from page
                image_map = extract_images_from_page(page)

                # Get page text and parse line by line
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                # Parse class listings
                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Skip short lines
                    if len(line) < 10:
                        i += 1
                        continue

                    # Try to parse as class title
                    parsed = parse_class_title(line)

                    if parsed:
                        title = parsed["title"]
                        start_date = parsed["start_date"]
                        start_time = parsed["start_time"]

                        # Look for price in surrounding lines
                        price_min = None
                        price_max = None
                        price_note = None

                        for offset in [1, 2, 3, 4]:
                            idx = i + offset
                            if idx < len(lines):
                                check_line = lines[idx]
                                # Look for price patterns ($99, $109, etc.)
                                if "$" in check_line and len(check_line) < 20:
                                    price_min, price_max, price_note = parse_price(check_line)
                                    if price_min:
                                        break

                        events_found += 1

                        content_hash = generate_content_hash(
                            title,
                            "The Cook's Warehouse",
                            start_date
                        )

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            i += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": "Cooking class at The Cook's Warehouse",
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "cooking",
                            "subcategory": None,
                            "tags": [
                                "cooks-warehouse",
                                "cooking-class",
                                "culinary",
                                "ansley-park",
                                "hands-on",
                            ],
                            "price_min": price_min,
                            "price_max": price_max,
                            "price_note": price_note,
                            "is_free": False,
                            "source_url": EVENTS_URL,
                            "ticket_url": EVENTS_URL,
                            "image_url": image_map.get(title),
                            "raw_text": line,
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                            "is_class": True,
                            "class_category": "cooking",
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    i += 1

                # Small delay between pages
                page.wait_for_timeout(1000)

            browser.close()

        logger.info(
            f"The Cook's Warehouse crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl The Cook's Warehouse: {e}")
        raise

    return events_found, events_new, events_updated
