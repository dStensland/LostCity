"""
Crawler for Visit Franklin TN (visitfranklin.com/things-to-do-events).
Official tourism board for Franklin, TN - events, festivals, and attractions.
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

BASE_URL = "https://visitfranklin.com"
EVENTS_URL = f"{BASE_URL}/things-to-do-events/"

# Category mapping
CATEGORY_MAP = {
    "music": "music",
    "concert": "music",
    "live music": "music",
    "festival": "community",
    "fair": "community",
    "art": "art",
    "gallery": "art",
    "theater": "theater",
    "theatre": "theater",
    "comedy": "comedy",
    "sports": "sports",
    "food": "food_drink",
    "wine": "food_drink",
    "dining": "food_drink",
    "market": "food_drink",
    "family": "family",
    "kids": "family",
    "children": "family",
}


def parse_date(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date from various formats.
    Returns (start_date, end_date) in YYYY-MM-DD format.
    """
    try:
        date_text = date_text.strip()

        # Try ISO datetime format
        if "T" in date_text:
            try:
                dt = datetime.fromisoformat(date_text.replace("Z", "+00:00"))
                return dt.strftime("%Y-%m-%d"), None
            except:
                pass

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

        # MM/DD/YYYY
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
    Crawl Visit Franklin events using Playwright.

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

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            page = context.new_page()

            logger.info(f"Fetching Visit Franklin events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)  # Wait for JS to render

            # Scroll to load more events
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Try to click "Load More" or "Show More" buttons
            for _ in range(3):
                try:
                    load_more = page.locator("text=/load more|show more|view more/i").first
                    if load_more.is_visible(timeout=1000):
                        load_more.click()
                        page.wait_for_timeout(2000)
                except Exception:
                    break

            # Parse event listings - look for event cards
            cards = page.query_selector_all("article, .event, .event-item, .event-card, .card, .tribe-event")

            logger.info(f"Found {len(cards)} potential event cards on Visit Franklin")

            for card in cards:
                try:
                    card_text = card.inner_text().strip()
                    if not card_text or len(card_text) < 10:
                        continue

                    # Title
                    title_el = card.query_selector("h1, h2, h3, h4, .title, .event-title, .tribe-events-list-event-title")
                    title = title_el.inner_text().strip() if title_el else None

                    if not title or len(title) < 3:
                        # Try extracting from card text
                        lines = [l.strip() for l in card_text.split("\n") if l.strip()]
                        if lines and len(lines[0]) > 3:
                            title = lines[0]
                        else:
                            continue

                    # Date
                    date_el = card.query_selector("time, .date, .event-date, .tribe-event-date-start, [itemprop='startDate']")
                    start_date = None
                    end_date = None
                    start_time = None

                    if date_el:
                        # Try datetime attribute
                        date_attr = date_el.get_attribute("datetime")
                        if date_attr:
                            try:
                                dt = datetime.fromisoformat(date_attr.replace("Z", "+00:00"))
                                start_date = dt.strftime("%Y-%m-%d")
                                start_time = dt.strftime("%H:%M")
                            except:
                                date_text = date_el.inner_text().strip()
                                start_date, end_date = parse_date(date_text)
                                start_time = parse_time(date_text)
                        else:
                            date_text = date_el.inner_text().strip()
                            start_date, end_date = parse_date(date_text)
                            start_time = parse_time(date_text)

                    if not start_date:
                        # Try parsing from card text
                        for line in card_text.split("\n"):
                            parsed_start, parsed_end = parse_date(line)
                            if parsed_start:
                                start_date = parsed_start
                                end_date = parsed_end
                                start_time = parse_time(line)
                                break

                    if not start_date:
                        continue

                    # Venue
                    venue_el = card.query_selector(".venue, .location, .event-venue, .tribe-venue, [itemprop='location']")
                    venue_name = venue_el.inner_text().strip() if venue_el else "Franklin Area"

                    # Clean up venue name
                    if venue_name and len(venue_name) > 2:
                        venue_name = venue_name.strip()
                    else:
                        venue_name = "Franklin Area"

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
                            if image_url.startswith("//"):
                                image_url = f"https:{image_url}"
                            else:
                                image_url = f"{BASE_URL}{image_url}"

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
                            "city": "Franklin",
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
                        "title": title,
                        "description": None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": end_date is not None,
                        "category": category,
                        "subcategory": None,
                        "tags": ["franklin", "visit-franklin"],
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
            f"Visit Franklin crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Visit Franklin: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Visit Franklin: {e}")
        raise

    return events_found, events_new, events_updated
