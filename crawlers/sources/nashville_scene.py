"""
Crawler for Nashville Scene Events Calendar (nashvillescene.com/calendar).
Nashville's alternative weekly publication - comprehensive local events coverage.
Uses Playwright for JavaScript-rendered content.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from utils import slugify
from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event, get_portal_id_by_slug
from dedupe import generate_content_hash

PORTAL_SLUG = "nashville"

logger = logging.getLogger(__name__)

BASE_URL = "https://www.nashvillescene.com"
EVENTS_URL = f"{BASE_URL}/calendar"

# Category mapping based on Nashville Scene's categories
CATEGORY_MAP = {
    "music": "music",
    "concerts": "music",
    "live music": "music",
    "nightlife": "nightlife",
    "comedy": "comedy",
    "theater": "theater",
    "theatre": "theater",
    "arts": "art",
    "visual arts": "art",
    "film": "film",
    "movies": "film",
    "food": "food_drink",
    "drink": "food_drink",
    "dining": "food_drink",
    "family": "family",
    "kids": "family",
    "community": "community",
    "festival": "community",
    "sports": "sports",
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats to YYYY-MM-DD."""
    try:
        date_text = date_text.strip()

        # Try MM/DD/YYYY format
        match = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
        if match:
            month, day, year = match.groups()
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d")

        # Try "January 16, 2026" format
        for fmt in ["%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(date_text, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

        # Try finding date pattern in text
        match = re.search(
            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})?",
            date_text,
            re.IGNORECASE
        )
        if match:
            month, day, year = match.groups()
            if not year:
                year = str(datetime.now().year)
            dt = datetime.strptime(f"{month} {day}, {year}", "%B %d, %Y")
            if dt < datetime.now() - timedelta(days=7):
                dt = dt.replace(year=dt.year + 1)
            return dt.strftime("%Y-%m-%d")

        return None

    except Exception as e:
        logger.warning(f"Failed to parse date '{date_text}': {e}")
        return None


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
    Crawl Nashville Scene events using Playwright.

    Args:
        source: Source record from database

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    venue_cache = {}

    portal_id = get_portal_id_by_slug(PORTAL_SLUG)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            page = context.new_page()

            logger.info(f"Fetching Nashville Scene calendar: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)  # Wait for JS to render

            # Scroll to load more events (Vue.js app lazy loads)
            for i in range(10):
                before_count = len(page.query_selector_all(".csEventTile"))
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(2000)
                after_count = len(page.query_selector_all(".csEventTile"))
                if before_count == after_count:
                    logger.info(f"No more events loaded after scroll {i+1}")
                    break

            # Nashville Scene uses a Vue.js calendar with specific CSS classes
            cards = page.query_selector_all(".csEventTile")

            logger.info(f"Found {len(cards)} event tiles on Nashville Scene")

            for card in cards:
                try:
                    # Get the link element - entire tile is a link
                    link = card.query_selector("a")
                    if not link:
                        continue

                    href = link.get_attribute("href")

                    # Extract date and hour from URL hash: #/details/name/id/2026-02-02T10
                    date_match = re.search(r'/(\d{4}-\d{2}-\d{2})T(\d{2})', href or "")
                    if not date_match:
                        logger.warning(f"Could not extract date from URL: {href}")
                        continue

                    start_date, hour = date_match.groups()

                    # Title from .csOneLine span
                    title_el = card.query_selector(".csOneLine span")
                    title = title_el.inner_text().strip() if title_el else None

                    if not title or len(title) < 3:
                        logger.warning(f"No title found for event")
                        continue

                    # Venue from .cityVenue - get first span
                    venue_els = card.query_selector_all(".cityVenue span")
                    venue_name = venue_els[0].inner_text().strip() if venue_els else "Nashville Area"

                    # Clean up venue name
                    if venue_name and len(venue_name) > 2:
                        venue_name = venue_name.title() if venue_name.isupper() else venue_name
                    else:
                        venue_name = "Nashville Area"

                    # Get time from card text
                    card_text = card.inner_text().strip()
                    time_match = re.search(r'(\d{1,2}):(\d{2})\s*(am|pm)', card_text, re.IGNORECASE)
                    if time_match:
                        hour_12, minute, period = time_match.groups()
                        hour_int = int(hour_12)
                        if period.lower() == "pm" and hour_int != 12:
                            hour_int += 12
                        elif period.lower() == "am" and hour_int == 12:
                            hour_int = 0
                        start_time = f"{hour_int:02d}:{minute}"
                    else:
                        # Fall back to hour from URL
                        start_time = f"{int(hour):02d}:00"

                    # Full URL (hash-based, so use base URL)
                    source_url = f"{BASE_URL}/calendar{href}" if href else EVENTS_URL

                    # Image from background-image style in .csimg
                    image_url = None
                    img_el = card.query_selector(".csimg")
                    if img_el:
                        style = img_el.get_attribute("style") or ""
                        img_match = re.search(r'url\("([^"]+)"\)', style)
                        if img_match:
                            image_url = img_match.group(1)

                    # Category
                    category = determine_category(f"{title} {card_text}")

                    events_found += 1

                    # Get or create venue
                    if venue_name in venue_cache:
                        venue_id = venue_cache[venue_name]
                    else:
                        venue_data = {
                            "name": venue_name,
                            "slug": slugify(venue_name),
                            "city": "Nashville",
                            "state": "TN",
                            "venue_type": "venue",
                        }
                        venue_id = get_or_create_venue(venue_data)
                        venue_cache[venue_name] = venue_id

                    # Content hash
                    content_hash = generate_content_hash(title, venue_name, start_date)

                    # Check for existing

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "portal_id": portal_id,
                        "title": title,
                        "description": None,
                        "start_date": start_date,
                        "start_time": start_time if start_time else None,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": None,
                        "tags": ["nashville-scene"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": source_url,
                        "ticket_url": None,
                        "image_url": image_url,
                        "raw_text": None,
                        "extraction_confidence": 0.80,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date} at {venue_name}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Failed to parse event card: {e}")
                    continue

            browser.close()

        logger.info(
            f"Nashville Scene crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Nashville Scene: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Nashville Scene: {e}")
        raise

    return events_found, events_new, events_updated
