"""
Crawler for Fox Theatre (foxtheatre.org/events).
Atlanta's historic theater hosting Broadway shows, concerts, and special events.

Site uses JavaScript rendering - must use Playwright.
Format: DATE RANGE, CATEGORY, TITLE, "Buy Tickets", "Learn More"
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.foxtheatre.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Fox Theatre",
    "slug": "fox-theatre",
    "address": "660 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "venue_type": "theater",
    "website": BASE_URL,
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date range like 'JAN 24 - 25, 2026' or 'FEB 28 - MAR 15, 2026'.
    Returns (start_date, end_date) tuple.
    """
    date_text = date_text.strip().upper()

    # Pattern: "JAN 24 - 25, 2026" (same month)
    match = re.match(r"([A-Z]{3})\s+(\d{1,2})\s*-\s*(\d{1,2}),?\s*(\d{4})", date_text)
    if match:
        month, start_day, end_day, year = match.groups()
        try:
            start_dt = datetime.strptime(f"{month} {start_day} {year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{month} {end_day} {year}", "%b %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: "FEB 28 - MAR 15, 2026" (different months)
    match = re.match(r"([A-Z]{3})\s+(\d{1,2})\s*-\s*([A-Z]{3})\s+(\d{1,2}),?\s*(\d{4})", date_text)
    if match:
        start_month, start_day, end_month, end_day, year = match.groups()
        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%b %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: Single date "FEB 21, 2026"
    match = re.match(r"([A-Z]{3})\s+(\d{1,2}),?\s*(\d{4})", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Fox Theatre events using Playwright."""
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

            logger.info(f"Fetching Fox Theatre: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Skip navigation items
            skip_items = ["skip to content", "accessibility", "buy tickets", "search",
                         "my account", "e-club", "donate", "english", "fox theatre",
                         "tickets", "visit us", "private events", "premium experiences",
                         "community partnerships", "about us", "upcoming events",
                         "category", "tours", "learn more"]

            i = 0
            seen_events = set()

            while i < len(lines):
                line = lines[i]

                # Skip nav/UI items
                if line.lower() in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Look for date pattern at start of line
                # Format: "JAN 24 - 25, 2026" or "FEB 21, 2026"
                date_match = re.match(
                    r"([A-Z]{3})\s+(\d{1,2})(?:\s*-\s*(?:[A-Z]{3}\s+)?(\d{1,2}))?,?\s*(\d{4})",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    # Found a date line
                    start_date, end_date = parse_date_range(line)

                    if not start_date:
                        i += 1
                        continue

                    # Look ahead for category and title
                    category_line = None
                    title = None

                    # Next line might be category (REGIONS BANK BROADWAY IN ATLANTA)
                    if i + 1 < len(lines):
                        next_line = lines[i + 1]
                        if "broadway" in next_line.lower() or next_line.isupper():
                            category_line = next_line
                            # Title should be line after that
                            if i + 2 < len(lines):
                                title = lines[i + 2]
                                i += 2
                        else:
                            # No category line, next line is title
                            title = next_line
                            i += 1

                    if not title:
                        i += 1
                        continue

                    # Skip if title is "Buy Tickets" or similar
                    if title.lower() in ["buy tickets", "learn more", "sold out"]:
                        i += 1
                        continue

                    # Check for duplicates
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(title, "Fox Theatre", start_date)

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        continue

                    # Determine category based on content
                    event_category = "theater"
                    subcategory = None
                    tags = ["fox-theatre", "midtown"]

                    title_lower = title.lower()
                    if category_line and "broadway" in category_line.lower():
                        subcategory = "broadway"
                        tags.append("broadway")
                    elif any(w in title_lower for w in ["musical", "hamilton", "wicked", "phantom"]):
                        subcategory = "musical"
                        tags.append("broadway")
                    elif any(w in title_lower for w in ["concert", "tour", "live", "band"]):
                        event_category = "music"
                        subcategory = "concert"
                        tags.append("concert")
                    elif any(w in title_lower for w in ["comedy", "comedian", "stand-up"]):
                        event_category = "comedy"
                        tags.append("comedy")
                    elif any(w in title_lower for w in ["dance", "ballet", "riverdance", "ailey"]):
                        subcategory = "dance"
                        tags.append("dance")

                    # Get specific event URL
                    event_url = find_event_url(title, event_links, EVENTS_URL)

                    image_url = image_map.get(title)

                    # Build series_hint for multi-night shows
                    series_hint = None
                    if end_date is not None:
                        series_hint = {
                            "series_type": "recurring_show",
                            "series_title": title,
                            "description": category_line,
                        }
                        if image_url:
                            series_hint["image_url"] = image_url

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": category_line,
                        "start_date": start_date,
                        "start_time": None,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": event_category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{line} {title}",
                        "extraction_confidence": 0.90,
                        "is_recurring": end_date is not None,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Fox Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Fox Theatre: {e}")
        raise

    return events_found, events_new, events_updated
