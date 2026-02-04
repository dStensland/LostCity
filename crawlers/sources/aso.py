"""
Crawler for Atlanta Symphony Orchestra (aso.org).
Concerts and performances at Symphony Hall at Woodruff Arts Center.

Note: georgia_symphony.py covers the separate Georgia Symphony Orchestra.
The ASO is the city's premier orchestra at Woodruff Arts Center.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.aso.org"
CONCERTS_URL = f"{BASE_URL}/concerts-tickets"

VENUE_DATA = {
    "name": "Symphony Hall at Woodruff Arts Center",
    "slug": "symphony-hall-woodruff",
    "address": "1280 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7901,
    "lng": -84.3854,
    "venue_type": "performing_arts",
    "spot_type": "performing_arts",
    "website": "https://www.aso.org",
    "vibes": ["classical", "symphony", "orchestra", "date-night", "upscale"],
}


def parse_concert_date(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date from ASO concert listings.

    Handles formats like:
    - "February 4, 2026"
    - "February  4, 2026" (double space)
    - "February 5 - 6, 2026"
    - "February 6 - 8, 2026"
    """
    if not date_text:
        return None, None

    # Normalize whitespace
    date_text = re.sub(r'\s+', ' ', date_text.strip())

    # Range: "February 5 - 6, 2026" or "February 6 - 8, 2026"
    range_match = re.match(r"(\w+)\s+(\d+)\s*[-–]\s*(\d+),?\s*(\d{4})", date_text)
    if range_match:
        month, day1, day2, year = range_match.groups()
        for fmt in ["%B %d %Y", "%b %d %Y"]:
            try:
                start = datetime.strptime(f"{month} {day1} {year}", fmt)
                end = datetime.strptime(f"{month} {day2} {year}", fmt)
                return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
            except ValueError:
                continue

    # Cross-month range: "February 28 - March 1, 2026"
    cross_match = re.match(r"(\w+)\s+(\d+)\s*[-–]\s*(\w+)\s+(\d+),?\s*(\d{4})", date_text)
    if cross_match:
        month1, day1, month2, day2, year = cross_match.groups()
        for fmt in ["%B %d %Y", "%b %d %Y"]:
            try:
                start = datetime.strptime(f"{month1} {day1} {year}", fmt)
                end = datetime.strptime(f"{month2} {day2} {year}", fmt)
                return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
            except ValueError:
                continue

    # Single date: "February 4, 2026"
    for fmt in ["%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y"]:
        try:
            dt = datetime.strptime(date_text, fmt)
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            continue

    return None, None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '8:00 PM' to '20:00'."""
    if not time_text:
        return None
    time_text = time_text.strip().upper()
    for fmt in ["%I:%M %p", "%I:%M%p", "%I %p"]:
        try:
            dt = datetime.strptime(time_text, fmt)
            return dt.strftime("%H:%M")
        except ValueError:
            continue
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl ASO concert listings from the main listing page."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching ASO concerts: {CONCERTS_URL}")
            page.goto(CONCERTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all concerts
            for _ in range(3):
                page.keyboard.press("End")
                page.wait_for_timeout(1000)

            # Find all event cards on the listing page
            event_cards = page.query_selector_all("div.eventItem")
            logger.info(f"Found {len(event_cards)} event cards on listing page")

            seen_titles = set()

            for card in event_cards:
                try:
                    # Extract title and link
                    title_el = card.query_selector(".title a")
                    if not title_el:
                        continue

                    title = title_el.inner_text().strip()
                    href = title_el.get_attribute("href")
                    if not title or not href:
                        continue

                    event_url = href if href.startswith("http") else f"{BASE_URL}{href}"

                    # Extract date
                    date_el = card.query_selector(".date")
                    if not date_el:
                        continue

                    date_text = date_el.inner_text().strip()
                    start_date, end_date = parse_concert_date(date_text)

                    if not start_date:
                        logger.debug(f"Could not parse date: {date_text}")
                        continue

                    # Skip past events
                    if start_date < datetime.now().strftime("%Y-%m-%d"):
                        continue

                    # Extract venue/location
                    venue_name = VENUE_DATA["name"]  # Default
                    location_el = card.query_selector(".location")
                    if location_el:
                        location_text = location_el.inner_text().strip()
                        # Use specific venue if mentioned (e.g., "Goizueta Stage for Youth & Families")
                        if location_text and location_text != "Atlanta Symphony Hall":
                            venue_name = location_text

                    # Extract image
                    image_url = None
                    img_el = card.query_selector(".thumb img")
                    if img_el:
                        image_url = img_el.get_attribute("src")
                        if image_url and not image_url.startswith("http"):
                            image_url = f"{BASE_URL}{image_url}"

                    # Extract tagline (optional detail)
                    tagline_el = card.query_selector(".tagline")
                    tagline = tagline_el.inner_text().strip() if tagline_el else ""

                    events_found += 1

                    # Dedup
                    title_key = f"{title}:{start_date}"
                    if title_key in seen_titles:
                        continue
                    seen_titles.add(title_key)

                    content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Build description
                    description = f"{title} at {venue_name}."
                    if tagline:
                        description += f" {tagline}"

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:500],
                        "description": description[:2000],
                        "start_date": start_date,
                        "start_time": "20:00",  # Default symphony time
                        "end_date": end_date or start_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "music",
                        "subcategory": "music.classical",
                        "tags": ["classical", "symphony", "orchestra", "aso", "date-night"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "See aso.org for tickets",
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
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
                    logger.debug(f"Error processing event card: {e}")
                    continue

            browser.close()

        logger.info(
            f"ASO crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl ASO: {e}")
        raise

    return events_found, events_new, events_updated
