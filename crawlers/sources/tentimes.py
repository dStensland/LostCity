"""
Crawler for 10times.com Atlanta trade shows and events.
Uses Playwright due to anti-bot protection.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from utils import slugify
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://10times.com"
ATLANTA_URL = f"{BASE_URL}/atlanta-us/tradeshows"

CATEGORY_MAP = {
    "business": "community",
    "trade show": "community",
    "conference": "community",
    "education": "community",
    "technology": "community",
    "medical": "community",
    "food": "food_drink",
    "fashion": "art",
    "art": "art",
    "entertainment": "community",
    "sports": "sports",
}


def parse_date(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date from formats like:
    - "23 - 25 Jan 2026"
    - "15 Feb 2026"
    - "Jan 2026"
    """
    try:
        date_text = date_text.strip()
        current_year = datetime.now().year

        # Range: "23 - 25 Jan 2026"
        range_match = re.match(
            r"(\d+)\s*[-–]\s*(\d+)\s+(\w+)\s+(\d{4})",
            date_text
        )
        if range_match:
            day1, day2, month, year = range_match.groups()
            for fmt in ["%d %b %Y", "%d %B %Y"]:
                try:
                    start = datetime.strptime(f"{day1} {month} {year}", fmt)
                    end = datetime.strptime(f"{day2} {month} {year}", fmt)
                    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
                except ValueError:
                    continue

        # Single day: "15 Feb 2026"
        single_match = re.match(r"(\d+)\s+(\w+)\s+(\d{4})", date_text)
        if single_match:
            day, month, year = single_match.groups()
            for fmt in ["%d %b %Y", "%d %B %Y"]:
                try:
                    dt = datetime.strptime(f"{day} {month} {year}", fmt)
                    return dt.strftime("%Y-%m-%d"), None
                except ValueError:
                    continue

        # Month only: "Jan 2026"
        month_match = re.match(r"(\w+)\s+(\d{4})", date_text)
        if month_match:
            month, year = month_match.groups()
            for fmt in ["%b %Y", "%B %Y"]:
                try:
                    dt = datetime.strptime(f"{month} {year}", fmt)
                    return dt.strftime("%Y-%m-01"), None
                except ValueError:
                    continue

        return None, None
    except Exception as e:
        logger.debug(f"Failed to parse date '{date_text}': {e}")
        return None, None


def determine_category(text: str) -> str:
    """Determine category from event text."""
    text_lower = text.lower()
    for keyword, category in CATEGORY_MAP.items():
        if keyword in text_lower:
            return category
    return "community"


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl 10times Atlanta trade shows.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching 10times Atlanta: {ATLANTA_URL}")
            page.goto(ATLANTA_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load more
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Find event cards
            cards = page.query_selector_all("[class*='event-card'], [class*='card'], article")
            logger.info(f"Found {len(cards)} potential event cards")

            for card in cards:
                try:
                    text = card.inner_text().strip()
                    lines = [l.strip() for l in text.split("\n") if l.strip()]

                    if len(lines) < 2:
                        continue

                    # First line is usually title
                    title = None
                    date_text = None
                    venue_name = None

                    for line in lines:
                        # Date pattern
                        if re.search(r"\d+\s*[-–]?\s*\d*\s+\w+\s+\d{4}", line):
                            date_text = line
                            continue
                        if re.search(r"\w+\s+\d{4}$", line) and not title:
                            date_text = line
                            continue

                        # First substantial line is title
                        if not title and len(line) > 5 and not line.isupper():
                            title = line
                            continue

                        # Venue might be after title
                        if title and not venue_name and len(line) > 5:
                            venue_name = line

                    if not title or len(title) < 5:
                        continue

                    start_date, end_date = parse_date(date_text or "")
                    if not start_date:
                        continue

                    venue_name = venue_name or "Atlanta Trade Center"

                    events_found += 1

                    # Category
                    category = determine_category(f"{title} {text}")

                    # Create venue
                    venue_data = {
                        "name": venue_name,
                        "slug": slugify(venue_name),
                        "city": "Atlanta",
                        "state": "GA",
                        "venue_type": "convention_center",
                    }
                    venue_id = get_or_create_venue(venue_data)

                    # Content hash
                    content_hash = generate_content_hash(title, venue_name, start_date)

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Get link
                    link = card.query_selector("a[href]")
                    href = link.get_attribute("href") if link else None
                    source_url = href if href and href.startswith("http") else f"{BASE_URL}{href}" if href else ATLANTA_URL

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": None,
                        "start_date": start_date,
                        "start_time": None,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": True,
                        "category": category,
                        "subcategory": "trade_show",
                        "tags": ["trade-show", "10times", "business"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": source_url,
                        "ticket_url": None,
                        "image_url": None,
                        "raw_text": None,
                        "extraction_confidence": 0.80,
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
                    logger.debug(f"Failed to parse card: {e}")
                    continue

            browser.close()

        logger.info(f"10times crawl complete: {events_found} found, {events_new} new")

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching 10times: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl 10times: {e}")
        raise

    return events_found, events_new, events_updated
