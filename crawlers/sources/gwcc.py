"""
Crawler for Georgia World Congress Center (gwcca.org/event-calendar).
The largest convention center in Georgia - hosts 160+ expos/conventions per year.
Uses Playwright for JavaScript-rendered content.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gwcca.org"
CALENDAR_URL = f"{BASE_URL}/event-calendar"

# GWCC has multiple venues
VENUES = {
    "georgia world congress center": {
        "name": "Georgia World Congress Center",
        "slug": "georgia-world-congress-center",
        "address": "285 Andrew Young International Blvd NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "venue_type": "convention_center",
        "website": "https://www.gwcca.org",
    },
    "centennial olympic park": {
        "name": "Centennial Olympic Park",
        "slug": "centennial-olympic-park",
        "address": "265 Park Ave W NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "venue_type": "outdoor",
        "website": "https://www.gwcca.org",
    },
    "mercedes-benz stadium": {
        "name": "Mercedes-Benz Stadium",
        "slug": "mercedes-benz-stadium",
        "address": "1 AMB Drive NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "venue_type": "stadium",
        "website": "https://mercedesbenzstadium.com",
    },
    "state farm arena": {
        "name": "State Farm Arena",
        "slug": "state-farm-arena",
        "address": "1 State Farm Drive",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "venue_type": "arena",
        "website": "https://www.statefarmarena.com",
    },
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date ranges like 'January 8-11, 2026', 'Jan 15, 2026', or 'March 15, 2026'.
    Returns (start_date, end_date) in YYYY-MM-DD format.
    """
    try:
        date_text = date_text.strip()

        # Try both full and abbreviated month formats
        month_formats = ["%B %d, %Y", "%b %d, %Y"]

        def try_parse(text: str) -> Optional[datetime]:
            for fmt in month_formats:
                try:
                    return datetime.strptime(text, fmt)
                except ValueError:
                    continue
            return None

        # Handle range like "January 8-11, 2026" or "Jan 8-11, 2026"
        range_match = re.match(r"(\w+)\s+(\d+)-(\d+),?\s*(\d{4})", date_text)
        if range_match:
            month, start_day, end_day, year = range_match.groups()
            start = try_parse(f"{month} {start_day}, {year}")
            end = try_parse(f"{month} {end_day}, {year}")
            if start and end:
                return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")

        # Handle range across months like "January 30 - February 2, 2026"
        cross_month_match = re.match(
            r"(\w+)\s+(\d+)\s*[-–]\s*(\w+)\s+(\d+),?\s*(\d{4})", date_text
        )
        if cross_month_match:
            month1, day1, month2, day2, year = cross_month_match.groups()
            start = try_parse(f"{month1} {day1}, {year}")
            end = try_parse(f"{month2} {day2}, {year}")
            if start and end:
                return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")

        # Handle single date like "March 15, 2026" or "Mar 15, 2026"
        single_match = re.match(r"(\w+)\s+(\d+),?\s*(\d{4})", date_text)
        if single_match:
            month, day, year = single_match.groups()
            date = try_parse(f"{month} {day}, {year}")
            if date:
                return date.strftime("%Y-%m-%d"), None

        return None, None
    except ValueError as e:
        logger.warning(f"Failed to parse date '{date_text}': {e}")
        return None, None


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(w in text for w in ["concert", "music", "festival", "band", "live"]):
        return "music"
    if any(
        w in text for w in ["expo", "convention", "conference", "trade show", "summit"]
    ):
        return "community"
    if any(w in text for w in ["boat", "auto", "car", "home", "garden"]):
        return "community"
    if any(w in text for w in ["anime", "comic", "dragon", "momo", "fan"]):
        return "community"
    if any(w in text for w in ["food", "wine", "beer", "taste", "culinary"]):
        return "food_drink"
    if any(w in text for w in ["art", "craft", "design"]):
        return "art"
    if any(w in text for w in ["sports", "game", "championship", "tournament"]):
        return "sports"
    if any(w in text for w in ["family", "kid", "children"]):
        return "family"

    return "community"


def get_venue_for_event(event_text: str) -> dict:
    """Determine which GWCC venue an event is at."""
    text = event_text.lower()

    for key, venue in VENUES.items():
        if key in text:
            return venue

    # Default to main GWCC venue
    return VENUES["georgia world congress center"]


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl GWCC events using Playwright.

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
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching GWCC calendar: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)  # Wait for JS to render

            # Wait for events to load
            page.wait_for_selector(".event-heading", timeout=10000)

            # GWCC uses .event-heading for titles and .event-date for dates
            # Get all event headings
            headings = page.query_selector_all(".event-heading")
            dates = page.query_selector_all(".event-date")

            logger.info(f"Found {len(headings)} events on GWCC")

            # Process each event
            for i, heading_el in enumerate(headings):
                try:
                    title = heading_el.inner_text().strip()
                    if not title or len(title) < 3:
                        continue

                    # Get corresponding date
                    date_text = ""
                    if i < len(dates):
                        date_text = dates[i].inner_text().strip()
                        # Clean up format like "16 Jan. 16, 2026" -> "Jan 16, 2026"
                        date_match = re.search(
                            r"(\w+)\.?\s*(\d+),?\s*(\d{4})", date_text
                        )
                        if date_match:
                            month, day, year = date_match.groups()
                            date_text = f"{month} {day}, {year}"

                    start_date, end_date = parse_date_range(date_text)
                    if not start_date:
                        logger.debug(f"Skipping event without date: {title}")
                        continue

                    # Get parent element for more details
                    parent = heading_el.evaluate_handle(
                        "el => el.closest('.event-card, .w-dyn-item, div')"
                    )

                    # Get URL from parent
                    source_url = CALENDAR_URL
                    try:
                        link = parent.as_element().query_selector("a")
                        if link:
                            href = link.get_attribute("href")
                            if href:
                                source_url = (
                                    href
                                    if href.startswith("http")
                                    else f"{BASE_URL}{href}"
                                )
                    except Exception:
                        pass

                    # Try to get image
                    image_url = None
                    try:
                        img = parent.as_element().query_selector("img")
                        if img:
                            image_url = img.get_attribute("src")
                            if image_url and not image_url.startswith("http"):
                                image_url = f"{BASE_URL}{image_url}"
                    except Exception:
                        pass

                    description = None

                    events_found += 1

                    # Determine venue and category
                    full_text = f"{title} {description or ''}"
                    venue_data = get_venue_for_event(full_text)
                    category = determine_category(title, description or "")

                    # Get or create venue
                    venue_id = get_or_create_venue(venue_data)

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, venue_data["name"], start_date
                    )

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Build event record
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
                        "tags": ["convention", "expo", "gwcc"],
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
                    logger.warning(f"Failed to parse event element: {e}")
                    continue

            browser.close()

        logger.info(f"GWCC crawl complete: {events_found} found, {events_new} new")

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching GWCC: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl GWCC: {e}")
        raise

    return events_found, events_new, events_updated
