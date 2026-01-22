"""
Crawler for Access Atlanta (events.accessatlanta.com).
AJC's events calendar - comprehensive local coverage.
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
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://events.accessatlanta.com"

CATEGORY_MAP = {
    "music": "music",
    "concerts": "music",
    "festivals": "community",
    "theater": "theater",
    "theatre": "theater",
    "comedy": "comedy",
    "film": "film",
    "movies": "film",
    "sports": "sports",
    "food": "food_drink",
    "drink": "food_drink",
    "nightlife": "nightlife",
    "family": "family",
    "kids": "family",
    "art": "art",
    "museum": "art",
    "gallery": "art",
    "community": "community",
    "fitness": "fitness",
}


def parse_date(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date from formats like:
    - "Jan 15 @ 8:00pm"
    - "Dec 11 - Feb 7 @ 12:00am"
    - "Nov 21 - Jan 18"
    """
    try:
        date_text = date_text.strip()
        current_year = datetime.now().year

        # Range: "Dec 11 - Feb 7 @ 12:00am" or "Nov 21 - Jan 18"
        range_match = re.match(r"(\w+)\s+(\d+)\s*[-–]\s*(\w+)\s+(\d+)", date_text)
        if range_match:
            m1, d1, m2, d2 = range_match.groups()
            for fmt in ["%b %d %Y", "%B %d %Y"]:
                try:
                    # Guess year - if end month < start month, end is next year
                    start = datetime.strptime(f"{m1} {d1} {current_year}", fmt)
                    end_year = current_year
                    if (
                        datetime.strptime(m2, "%b").month
                        < datetime.strptime(m1, "%b").month
                    ):
                        end_year = current_year + 1
                    end = datetime.strptime(f"{m2} {d2} {end_year}", fmt)
                    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
                except ValueError:
                    continue

        # Single: "Jan 15 @ 8:00pm" or "Apr 4 @ 10:00am"
        single_match = re.match(r"(\w+)\s+(\d+)", date_text)
        if single_match:
            month, day = single_match.groups()
            for fmt in ["%b %d %Y", "%B %d %Y"]:
                try:
                    dt = datetime.strptime(f"{month} {day} {current_year}", fmt)
                    # If date is in the past, assume next year
                    if dt < datetime.now():
                        dt = datetime.strptime(f"{month} {day} {current_year + 1}", fmt)
                    return dt.strftime("%Y-%m-%d"), None
                except ValueError:
                    continue

        return None, None
    except Exception as e:
        logger.debug(f"Failed to parse date '{date_text}': {e}")
        return None, None


def parse_time(date_text: str) -> Optional[str]:
    """Extract time from date text like 'Jan 15 @ 8:00pm'."""
    try:
        match = re.search(r"@\s*(\d{1,2}):(\d{2})\s*(am|pm)", date_text, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
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
    Crawl Access Atlanta events using Playwright.
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

            logger.info(f"Fetching Access Atlanta events: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load more events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Find event cards - they use home-card--event class
            event_cards = page.query_selector_all(".home-card--event")
            logger.info(f"Found {len(event_cards)} event cards")

            seen_titles = set()

            for card in event_cards:
                try:
                    # Get full text of card
                    text = card.inner_text().strip()
                    lines = [l.strip() for l in text.split("\n") if l.strip()]

                    if len(lines) < 2:
                        continue

                    # Get link for event URL
                    link = card.query_selector("a[href*='/cal/']")
                    href = link.get_attribute("href") if link else None

                    # Title is usually the first substantial line
                    title = None
                    date_text = None
                    venue_name = None

                    for line in lines:
                        # Skip very short lines
                        if len(line) < 3:
                            continue

                        # Date pattern: "Jan 15 @ 8:00pm" or "Nov 21 - Jan 18"
                        if re.search(r"\w{3}\s+\d+\s*[@-]", line) or re.search(
                            r"\w{3}\s+\d+$", line
                        ):
                            date_text = line
                            continue

                        # First substantial non-date line is title
                        if not title and len(line) > 5:
                            title = line
                            continue

                        # Line after title is venue
                        if title and not venue_name and len(line) > 2:
                            venue_name = line

                    if not title or title in seen_titles:
                        continue
                    seen_titles.add(title)

                    start_date, end_date = parse_date(date_text or "")
                    if not start_date:
                        continue

                    start_time = parse_time(date_text or "")
                    venue_name = venue_name or "Atlanta"

                    events_found += 1

                    # Category
                    category = determine_category(f"{title} {venue_name}")

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

                    if href:
                        source_url = (
                            f"https:{href}"
                            if href.startswith("//")
                            else (
                                href if href.startswith("http") else f"{BASE_URL}{href}"
                            )
                        )
                    else:
                        source_url = BASE_URL

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": start_time is None,
                        "category": category,
                        "subcategory": None,
                        "tags": ["access-atlanta", "ajc"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": source_url,
                        "ticket_url": None,
                        "image_url": image_map.get(title),
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
                    logger.debug(f"Failed to parse event: {e}")
                    continue

            browser.close()

        logger.info(
            f"Access Atlanta crawl complete: {events_found} found, {events_new} new"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Access Atlanta: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Access Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
