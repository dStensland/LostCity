"""
Crawler for Atlanta BeltLine events and public art.
The BeltLine hosts various community events and art installations.
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

BASE_URL = "https://beltline.org"
EVENTS_URL = f"{BASE_URL}/visit/events/"

BELTLINE_VENUE = {
    "name": "Atlanta BeltLine",
    "slug": "atlanta-beltline",
    "address": "112 Krog Street NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "venue_type": "outdoor",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date from various formats."""
    try:
        date_text = date_text.strip()
        current_year = datetime.now().year

        # "January 15, 2026" or "Jan 15, 2026"
        full_match = re.match(r"(\w+)\s+(\d+),?\s*(\d{4})", date_text)
        if full_match:
            month, day, year = full_match.groups()
            for fmt in ["%B %d, %Y", "%b %d, %Y"]:
                try:
                    dt = datetime.strptime(f"{month} {day}, {year}", fmt)
                    return dt.strftime("%Y-%m-%d"), None
                except ValueError:
                    continue

        # "January 15" (no year)
        short_match = re.match(r"(\w+)\s+(\d+)$", date_text)
        if short_match:
            month, day = short_match.groups()
            for fmt in ["%B %d %Y", "%b %d %Y"]:
                try:
                    dt = datetime.strptime(f"{month} {day} {current_year}", fmt)
                    if dt < datetime.now():
                        dt = datetime.strptime(f"{month} {day} {current_year + 1}", fmt)
                    return dt.strftime("%Y-%m-%d"), None
                except ValueError:
                    continue

        # "1/15/26" or "01/15/2026"
        slash_match = re.match(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", date_text)
        if slash_match:
            month, day, year = slash_match.groups()
            if len(year) == 2:
                year = f"20{year}"
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d"), None

        return None, None
    except Exception as e:
        logger.debug(f"Failed to parse date '{date_text}': {e}")
        return None, None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time to HH:MM format."""
    try:
        match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_text, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            minute = minute or "00"
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

    if any(w in text_lower for w in ["art", "mural", "sculpture", "gallery", "exhibit"]):
        return "art"
    if any(w in text_lower for w in ["run", "walk", "bike", "fitness", "yoga"]):
        return "fitness"
    if any(w in text_lower for w in ["music", "concert", "band", "live"]):
        return "music"
    if any(w in text_lower for w in ["food", "market", "vendor"]):
        return "food_drink"
    if any(w in text_lower for w in ["family", "kid", "children"]):
        return "family"
    if any(w in text_lower for w in ["volunteer", "cleanup", "plant"]):
        return "community"

    return "community"


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta BeltLine events.
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

            logger.info(f"Fetching BeltLine events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get venue ID
            venue_id = get_or_create_venue(BELTLINE_VENUE)

            # Find event cards
            cards = page.query_selector_all("article, [class*='event'], [class*='card']")
            logger.info(f"Found {len(cards)} potential event cards")

            for card in cards:
                try:
                    text = card.inner_text().strip()
                    lines = [l.strip() for l in text.split("\n") if l.strip()]

                    if len(lines) < 2:
                        continue

                    title = None
                    date_text = None
                    time_text = None

                    for line in lines:
                        # Date patterns
                        if re.search(r"\w+\s+\d+,?\s*\d{4}", line):
                            date_text = line
                            continue
                        if re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", line):
                            date_text = line
                            continue

                        # Time pattern
                        if re.search(r"\d{1,2}:\d{2}\s*(am|pm)", line, re.IGNORECASE):
                            time_text = line
                            continue

                        # Title - first substantial line
                        if not title and len(line) > 5 and len(line) < 100:
                            title = line

                    if not title:
                        continue

                    start_date, end_date = parse_date(date_text or "")
                    if not start_date:
                        continue

                    start_time = parse_time(time_text or date_text or "")

                    events_found += 1

                    # Category
                    category = determine_category(f"{title} {text}")

                    # Content hash
                    content_hash = generate_content_hash(title, "Atlanta BeltLine", start_date)

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Get link
                    link = card.query_selector("a[href]")
                    href = link.get_attribute("href") if link else None
                    source_url = href if href and href.startswith("http") else f"{BASE_URL}{href}" if href else EVENTS_URL

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
                        "tags": ["beltline", "outdoor", "atlanta"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": source_url,
                        "ticket_url": None,
                        "image_url": None,
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
                    logger.debug(f"Failed to parse card: {e}")
                    continue

            browser.close()

        logger.info(f"BeltLine crawl complete: {events_found} found, {events_new} new")

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching BeltLine: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl BeltLine: {e}")
        raise

    return events_found, events_new, events_updated
