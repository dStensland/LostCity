"""
Crawler for Discover Atlanta (discoveratlanta.com/events).
Official Atlanta tourism site - comprehensive events calendar.
Uses Playwright for JavaScript-rendered content.
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

BASE_URL = "https://discoveratlanta.com"
EVENTS_URL = f"{BASE_URL}/events"

# Category mapping based on Discover Atlanta's categories
CATEGORY_MAP = {
    "music": "music",
    "concerts": "music",
    "festivals": "community",
    "arts": "art",
    "culture": "art",
    "theatre": "theater",
    "theater": "theater",
    "comedy": "comedy",
    "sports": "sports",
    "food": "food_drink",
    "dining": "food_drink",
    "drinks": "food_drink",
    "nightlife": "nightlife",
    "family": "family",
    "kids": "family",
    "outdoor": "community",
    "film": "film",
    "movies": "film",
}


def parse_date(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date from various formats.
    Returns (start_date, end_date) in YYYY-MM-DD format.
    """
    try:
        date_text = date_text.strip()

        # "Jan 15, 2026" or "January 15, 2026"
        single_match = re.match(r"(\w{3,9})\.?\s+(\d{1,2}),?\s*(\d{4})", date_text)
        if single_match:
            month, day, year = single_match.groups()
            for fmt in ["%B %d, %Y", "%b %d, %Y"]:
                try:
                    dt = datetime.strptime(f"{month} {day}, {year}", fmt)
                    return dt.strftime("%Y-%m-%d"), None
                except ValueError:
                    continue

        # "Jan 15 - Jan 18, 2026"
        range_match = re.match(
            r"(\w{3,9})\.?\s+(\d{1,2})\s*[-–]\s*(\w{3,9})\.?\s+(\d{1,2}),?\s*(\d{4})",
            date_text,
        )
        if range_match:
            month1, day1, month2, day2, year = range_match.groups()
            for fmt in ["%B %d, %Y", "%b %d, %Y"]:
                try:
                    start = datetime.strptime(f"{month1} {day1}, {year}", fmt)
                    end = datetime.strptime(f"{month2} {day2}, {year}", fmt)
                    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
                except ValueError:
                    continue

        # "Jan 15-18, 2026" (same month)
        same_month_match = re.match(
            r"(\w{3,9})\.?\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(\d{4})", date_text
        )
        if same_month_match:
            month, day1, day2, year = same_month_match.groups()
            for fmt in ["%B %d, %Y", "%b %d, %Y"]:
                try:
                    start = datetime.strptime(f"{month} {day1}, {year}", fmt)
                    end = datetime.strptime(f"{month} {day2}, {year}", fmt)
                    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
                except ValueError:
                    continue

        # "01/15/2026"
        slash_match = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
        if slash_match:
            month, day, year = slash_match.groups()
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d"), None

        return None, None

    except Exception as e:
        logger.warning(f"Failed to parse date '{date_text}': {e}")
        return None, None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time to HH:MM format."""
    try:
        time_text = time_text.lower().strip()

        # "7:00 PM" or "7:00pm"
        match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"

        # "7 PM" or "7pm"
        match = re.search(r"(\d{1,2})\s*(am|pm)", time_text)
        if match:
            hour, period = match.groups()
            hour = int(hour)
            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:00"

        return None
    except Exception:
        return None


def determine_category(text: str) -> str:
    """Determine category from event text."""
    text_lower = text.lower()
    for keyword, category in CATEGORY_MAP.items():
        if keyword in text_lower:
            return category
    return "community"


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Discover Atlanta events using Playwright.

    Args:
        source: Source record from database

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            page = context.new_page()

            logger.info(f"Fetching Discover Atlanta events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)  # Wait for JS to render

            # Wait for events to load
            page.wait_for_selector("body", timeout=5000)

            # Scroll to load more events (lazy loading)
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get all articles which contain events
            cards = page.query_selector_all("article")

            logger.info(f"Found {len(cards)} event cards on Discover Atlanta")

            for card in cards:
                try:
                    # Title from h3
                    title_el = card.query_selector("h3")
                    title = title_el.inner_text().strip() if title_el else None

                    if not title or len(title) < 3:
                        continue

                    # Get all text lines
                    card_text = card.inner_text().strip()
                    lines = [l.strip() for l in card_text.split("\n") if l.strip()]

                    # Date is typically the last line in format "1/13/26" or "1/13/26 - 1/15/26"
                    start_date = None
                    end_date = None
                    category_text = ""

                    for line in lines:
                        # Check for short date format: 1/13/26
                        short_date = re.match(r"(\d{1,2})/(\d{1,2})/(\d{2})$", line)
                        if short_date:
                            month, day, year = short_date.groups()
                            year = f"20{year}"  # Convert 26 to 2026
                            start_date = f"{year}-{int(month):02d}-{int(day):02d}"
                            continue

                        # Check for date range: 1/13/26 - 1/15/26
                        date_range = re.match(
                            r"(\d{1,2})/(\d{1,2})/(\d{2})\s*[-–]\s*(\d{1,2})/(\d{1,2})/(\d{2})",
                            line,
                        )
                        if date_range:
                            m1, d1, y1, m2, d2, y2 = date_range.groups()
                            start_date = f"20{y1}-{int(m1):02d}-{int(d1):02d}"
                            end_date = f"20{y2}-{int(m2):02d}-{int(d2):02d}"
                            continue

                        # Category is usually uppercase
                        if line.isupper() and len(line) > 3:
                            category_text = line

                    if not start_date:
                        logger.debug(f"Skipping event without date: {title}")
                        continue

                    # Category
                    category = determine_category(f"{title} {category_text}")

                    # Venue - default to Atlanta Area since Discover Atlanta doesn't show venues on listing
                    venue_name = "Atlanta Area"

                    # URL
                    link = card.query_selector("a[href]")
                    href = link.get_attribute("href") if link else None
                    if href and not href.startswith("http"):
                        href = f"{BASE_URL}{href}"
                    source_url = href or EVENTS_URL

                    # Image
                    img = card.query_selector("img")
                    image_url = None
                    if img:
                        image_url = img.get_attribute("src") or img.get_attribute(
                            "data-src"
                        )
                        if image_url and not image_url.startswith("http"):
                            image_url = f"{BASE_URL}{image_url}"

                    # Description - just use category for now
                    description = category_text.title() if category_text else None

                    events_found += 1

                    # Create venue
                    venue_data = {
                        "name": venue_name,
                        "slug": slugify(venue_name),
                        "city": "Atlanta",
                        "state": "GA",
                        "venue_type": "venue",
                    }
                    venue_id = get_or_create_venue(venue_data)

                    # Content hash
                    content_hash = generate_content_hash(title, venue_name, start_date)

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": None,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": True,
                        "category": category,
                        "subcategory": None,
                        "tags": ["discover-atlanta"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": source_url,
                        "ticket_url": None,
                        "image_url": image_url,
                        "raw_text": None,
                        "extraction_confidence": 0.85,
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
                    logger.warning(f"Failed to parse event card: {e}")
                    continue

            browser.close()

        logger.info(
            f"Discover Atlanta crawl complete: {events_found} found, {events_new} new"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Discover Atlanta: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Discover Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
