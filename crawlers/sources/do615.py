"""
Crawler for Do615 (do615.com/events).
Nashville's premier curated events platform - part of the DoStuff network.
Uses Playwright for JavaScript-rendered content.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from utils import slugify
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://do615.com"
EVENTS_URL = f"{BASE_URL}/events"

# URLs to scrape with different time ranges
SCRAPE_URLS = [
    f"{EVENTS_URL}/today",
    f"{EVENTS_URL}/tomorrow",
    f"{EVENTS_URL}/this-week",
    f"{EVENTS_URL}/this-weekend",
    f"{EVENTS_URL}/next-week",
]

# Category mapping based on Do615's categories
CATEGORY_MAP = {
    "live music": "music",
    "music": "music",
    "concerts": "music",
    "comedy": "comedy",
    "theatre": "theater",
    "theater": "theater",
    "performing arts": "theater",
    "arts": "art",
    "culture": "art",
    "food": "food_drink",
    "drink": "food_drink",
    "nightlife": "nightlife",
    "game nights": "nightlife",
    "karaoke": "nightlife",
    "sports": "sports",
    "fitness": "sports",
    "wellness": "sports",
    "outdoors": "community",
    "nature": "community",
    "activism": "community",
    "volunteering": "community",
    "business": "community",
    "networking": "community",
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats to YYYY-MM-DD."""
    try:
        date_text = date_text.strip()

        # Try ISO format with datetime
        if "T" in date_text:
            try:
                dt = datetime.fromisoformat(date_text.replace("Z", "+00:00"))
                return dt.strftime("%Y-%m-%d")
            except:
                pass

        # Try MM/DD/YYYY format
        match = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
        if match:
            month, day, year = match.groups()
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d")

        # Try "Jan 15" or "January 15" format (current year)
        match = re.match(r"(\w{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?", date_text, re.IGNORECASE)
        if match:
            month, day = match.groups()
            year = datetime.now().year
            for fmt in ["%B %d", "%b %d"]:
                try:
                    dt = datetime.strptime(f"{month} {day}", fmt)
                    dt = dt.replace(year=year)
                    # If date is in past, assume next year
                    if dt < datetime.now() - timedelta(days=7):
                        dt = dt.replace(year=year + 1)
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    continue

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


def determine_category(text: str, do615_category: str = None) -> str:
    """Determine category from event text and Do615 category."""
    if do615_category:
        cat_lower = do615_category.lower()
        for keyword, category in CATEGORY_MAP.items():
            if keyword in cat_lower:
                return category

    text_lower = text.lower()
    for keyword, category in CATEGORY_MAP.items():
        if keyword in text_lower:
            return category

    return "community"


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Do615 events using Playwright.

    Args:
        source: Source record from database

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0
    venue_cache = {}
    seen_events = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            page = context.new_page()

            # Crawl each time range
            for url in SCRAPE_URLS:
                logger.info(f"Fetching Do615: {url}")

                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)

                    # Scroll to load more events
                    for _ in range(3):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(1000)

                    # Parse event cards - Do615 uses .event-card class
                    cards = page.query_selector_all(".event-card")

                    logger.info(f"Found {len(cards)} event cards")

                    for card in cards:
                        try:
                            # Title
                            title_el = card.query_selector(".ds-listing-event-title-text")
                            title = title_el.inner_text().strip() if title_el else None

                            if not title or len(title) < 3:
                                continue

                            # Date/Time - get from meta tag with itemprop="startDate"
                            start_date = None
                            start_time = None

                            date_meta = card.query_selector("meta[itemprop='startDate']")
                            if date_meta:
                                date_attr = date_meta.get_attribute("datetime")
                                if date_attr:
                                    try:
                                        # Handle different timezone formats
                                        # Replace timezone names (%CDT, %CST) with empty string
                                        date_attr = re.sub(r"%[A-Z]{3}$", "", date_attr)
                                        # Fix timezone offset format: -0600 -> -06:00
                                        date_attr = date_attr.replace("Z", "+00:00")
                                        if re.match(r".*[+-]\d{4}$", date_attr):
                                            # Insert colon in timezone offset
                                            date_attr = date_attr[:-2] + ":" + date_attr[-2:]
                                        dt = datetime.fromisoformat(date_attr)
                                        start_date = dt.strftime("%Y-%m-%d")
                                        start_time = dt.strftime("%H:%M")
                                    except Exception as e:
                                        logger.warning(f"Failed to parse datetime '{date_attr}': {e}")

                            # Fallback to time element text
                            if not start_date:
                                time_el = card.query_selector(".ds-event-time")
                                if time_el:
                                    time_text = time_el.inner_text().strip()
                                    start_time = parse_time(time_text)

                            if not start_date:
                                continue

                            # Venue - get from nested span inside .ds-venue-name
                            venue_el = card.query_selector(".ds-venue-name a span[itemprop='name']")
                            venue_name = venue_el.inner_text().strip() if venue_el else None

                            if not venue_name:
                                # Fallback to any text in .ds-venue-name
                                venue_container = card.query_selector(".ds-venue-name")
                                venue_name = venue_container.inner_text().strip() if venue_container else "Nashville Area"

                            # Clean up venue name
                            if venue_name and len(venue_name) > 2:
                                venue_name = venue_name.strip()
                            else:
                                venue_name = "Nashville Area"

                            # Avoid duplicates
                            event_key = f"{title}|{start_date}|{venue_name}"
                            if event_key in seen_events:
                                continue
                            seen_events.add(event_key)

                            # URL
                            link = card.query_selector("a.ds-listing-event-title")
                            href = link.get_attribute("href") if link else None
                            if href and not href.startswith("http"):
                                href = f"{BASE_URL}{href}"
                            source_url = href or url

                            # Image - from background-image style on .ds-cover-image
                            image_url = None
                            img_div = card.query_selector(".ds-cover-image")
                            if img_div:
                                style = img_div.get_attribute("style")
                                if style:
                                    # Extract URL from background-image:url('...')
                                    import re as img_re
                                    match = img_re.search(r"url\(['\"]?([^'\"]+)['\"]?\)", style)
                                    if match:
                                        image_url = match.group(1)
                                        if image_url.startswith("//"):
                                            image_url = f"https:{image_url}"

                            # Category - check data attributes
                            do615_cat = card.get_attribute("data-category") or card.get_attribute("class")
                            category = determine_category(title, do615_cat)

                            total_found += 1

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
                            existing = find_event_by_hash(content_hash)
                            if existing:
                                total_updated += 1
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
                                "category": category,
                                "subcategory": None,
                                "tags": ["do615"],
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
                                total_new += 1
                                logger.info(f"Added: {title} on {start_date} at {venue_name}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {title}: {e}")

                        except Exception as e:
                            logger.warning(f"Failed to parse event card: {e}")
                            continue

                except Exception as e:
                    logger.warning(f"Failed to fetch {url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Do615 crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Do615: {e}")
        raise

    return total_found, total_new, total_updated
