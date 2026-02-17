"""
Crawler for Visit Decatur Georgia (visitdecaturga.com/events).
Official Decatur tourism site - community events calendar.
Uses Playwright for JavaScript-rendered content.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from utils import slugify
from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://visitdecaturga.com"
EVENTS_URL = f"{BASE_URL}/events/"

# Category mapping based on event content
CATEGORY_MAP = {
    "music": "music",
    "concert": "music",
    "band": "music",
    "live music": "music",
    "festival": "community",
    "art": "art",
    "gallery": "art",
    "exhibit": "art",
    "theatre": "theater",
    "theater": "theater",
    "comedy": "comedy",
    "standup": "comedy",
    "sports": "sports",
    "food": "food_drink",
    "dining": "food_drink",
    "restaurant": "food_drink",
    "wine": "food_drink",
    "beer": "food_drink",
    "nightlife": "nightlife",
    "family": "family",
    "kids": "family",
    "children": "family",
    "outdoor": "community",
    "park": "community",
    "film": "film",
    "movie": "film",
    "market": "community",
    "farmers market": "community",
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

        # "01/15/2026" or "1/15/26"
        slash_match = re.match(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", date_text)
        if slash_match:
            month, day, year = slash_match.groups()
            if len(year) == 2:
                year = f"20{year}"
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


def extract_venue_name(text: str, title: str) -> str:
    """
    Extract venue name from event text.
    Returns venue name or default to "Downtown Decatur" if not found.
    """
    # Skip these generic terms
    skip_terms = [
        "visit decatur",
        "decatur georgia",
        "downtown decatur",
        "decatur square",
        "the city of decatur",
    ]

    # Common venue patterns
    venue_patterns = [
        r"(?:at|@)\s+([A-Z][A-Za-z\s&'-]+(?:Theater|Theatre|Tavern|Bar|Restaurant|Cafe|Park|Center|Hall|Club|Gallery|Museum))",
        r"(?:location|venue):\s*([A-Z][A-Za-z\s&'-]+)",
    ]

    for pattern in venue_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            venue = match.group(1).strip()
            if venue.lower() not in [term.lower() for term in skip_terms]:
                return venue

    # Check if venue is mentioned in title
    venue_words = ["theater", "theatre", "tavern", "bar", "restaurant", "cafe", "park", "center", "hall", "club", "gallery", "museum"]
    for word in venue_words:
        if word in title.lower():
            return title.split("-")[0].strip() if "-" in title else title.split("at")[0].strip()

    return "Downtown Decatur"


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Visit Decatur Georgia events using Playwright.

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

            logger.info(f"Fetching Visit Decatur events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)  # Wait for JS calendar widget to render

            # Wait for page content
            page.wait_for_selector("body", timeout=5000)

            # Scroll to load lazy-loaded content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Try multiple selectors for events
            # Try tribe events first (common WordPress events plugin)
            cards = page.query_selector_all(".tribe-events-calendar-list__event-row")

            if not cards:
                # Try generic article/event selectors
                cards = page.query_selector_all("article.event, .event-item, .tribe-event, article[class*='event']")

            if not cards:
                # Try generic articles
                cards = page.query_selector_all("article")

            logger.info(f"Found {len(cards)} potential event cards on Visit Decatur")

            for card in cards:
                try:
                    # Get all text from card
                    card_text = card.inner_text().strip()
                    if not card_text or len(card_text) < 10:
                        continue

                    # Look for title - try various selectors
                    title_el = (
                        card.query_selector("h1, h2, h3, h4, .tribe-events-calendar-list__event-title, .event-title, .title")
                    )
                    title = title_el.inner_text().strip() if title_el else None

                    # If no title from selector, try first line
                    if not title:
                        lines = [l.strip() for l in card_text.split("\n") if l.strip()]
                        title = lines[0] if lines else None

                    if not title or len(title) < 3:
                        continue

                    # Skip navigation/footer elements
                    skip_words = ["menu", "home", "about", "contact", "subscribe", "sign up", "log in", "newsletter"]
                    if any(word in title.lower() for word in skip_words):
                        continue

                    # Parse date
                    start_date = None
                    end_date = None

                    # Look for date in card text
                    lines = [l.strip() for l in card_text.split("\n") if l.strip()]
                    for line in lines:
                        # Try various date formats
                        parsed = parse_date(line)
                        if parsed[0]:
                            start_date, end_date = parsed
                            break

                    if not start_date:
                        logger.debug(f"Skipping event without date: {title}")
                        continue

                    # Parse time
                    start_time = None
                    for line in lines:
                        time = parse_time(line)
                        if time:
                            start_time = time
                            break

                    # Determine category
                    category = determine_category(f"{title} {card_text}")

                    # Extract or default venue
                    venue_name = extract_venue_name(card_text, title)

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
                        image_url = img.get_attribute("src") or img.get_attribute("data-src")
                        if image_url and not image_url.startswith("http"):
                            image_url = f"{BASE_URL}{image_url}"

                    # Description - use excerpt if available
                    desc_el = card.query_selector(".excerpt, .description, .event-description, p")
                    description = desc_el.inner_text().strip() if desc_el else None

                    events_found += 1

                    # Create/get venue
                    venue_data = {
                        "name": venue_name,
                        "slug": slugify(venue_name),
                        "neighborhood": "Downtown Decatur",
                        "city": "Decatur",
                        "state": "GA",
                        "venue_type": "venue",
                    }
                    venue_id = get_or_create_venue(venue_data)

                    # Content hash
                    content_hash = generate_content_hash(title, venue_name, start_date)

                    # Check for existing

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": None,
                        "tags": ["visit-decatur", "decatur"],
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
            f"Visit Decatur crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Visit Decatur: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Visit Decatur: {e}")
        raise

    return events_found, events_new, events_updated
