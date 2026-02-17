"""
Crawler for Factory at Franklin (factoryatfranklin.com/events).
Mixed-use entertainment complex in Franklin, TN - concerts, shows, and events.
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

BASE_URL = "https://factoryatfranklin.com"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "Factory at Franklin",
    "slug": "factory-at-franklin",
    "address": "230 Franklin Rd",
    "city": "Franklin",
    "state": "TN",
    "zip": "37064",
    "venue_type": "venue",
    "spot_type": "entertainment_complex",
    "website": BASE_URL,
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

    if any(w in text_lower for w in ["concert", "music", "band", "live music"]):
        return "music"
    if any(w in text_lower for w in ["theater", "theatre", "show", "performance"]):
        return "theater"
    if any(w in text_lower for w in ["comedy", "comedian"]):
        return "comedy"
    if any(w in text_lower for w in ["art", "gallery", "exhibit"]):
        return "art"
    if any(w in text_lower for w in ["market", "vendor", "shopping"]):
        return "food_drink"
    if any(w in text_lower for w in ["family", "kids", "children"]):
        return "family"

    return "community"


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Factory at Franklin events using Playwright.

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
        venue_id = get_or_create_venue(VENUE_DATA)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            page = context.new_page()

            logger.info(f"Fetching Factory at Franklin events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)  # Wait for JS to render

            # Scroll to load more events
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Try to click "Load More" buttons
            for _ in range(3):
                try:
                    load_more = page.locator("text=/load more|show more|view more/i").first
                    if load_more.is_visible(timeout=1000):
                        load_more.click()
                        page.wait_for_timeout(2000)
                except Exception:
                    break

            # Parse event listings
            cards = page.query_selector_all("article, .event, .event-item, .event-card, .card")

            logger.info(f"Found {len(cards)} potential event cards on Factory at Franklin")

            for card in cards:
                try:
                    card_text = card.inner_text().strip()
                    if not card_text or len(card_text) < 10:
                        continue

                    # Title
                    title_el = card.query_selector("h1, h2, h3, h4, .title, .event-title")
                    title = title_el.inner_text().strip() if title_el else None

                    if not title or len(title) < 3:
                        # Try extracting from card text
                        lines = [l.strip() for l in card_text.split("\n") if l.strip()]
                        if lines and len(lines[0]) > 3:
                            title = lines[0]
                        else:
                            continue

                    # Date
                    date_el = card.query_selector("time, .date, .event-date, [itemprop='startDate']")
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

                    # Content hash
                    content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

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
                        "is_all_day": False,
                        "category": category,
                        "subcategory": None,
                        "tags": ["franklin", "factory-at-franklin"],
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

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

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
            f"Factory at Franklin crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Factory at Franklin: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Factory at Franklin: {e}")
        raise

    return events_found, events_new, events_updated
