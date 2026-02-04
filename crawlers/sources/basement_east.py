"""
Crawler for The Basement East (thebasementnashville.com/basement-east-calendar).

Popular East Nashville music venue with intimate setting.
Uses WordPress with Divi theme and JavaScript rendering.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.thebasementnashville.com"
CALENDAR_URL = f"{BASE_URL}/basement-east-calendar/"

VENUE_DATA = {
    "name": "The Basement East",
    "slug": "basement-east",
    "address": "917 Woodland St",
    "neighborhood": "East Nashville",
    "city": "Nashville",
    "state": "TN",
    "zip": "37206",
    "lat": 36.1654,
    "lng": -86.7463,
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7:00PM' format to 24-hour time."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def parse_price(price_text: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """Parse price from text. Returns (min, max, note)."""
    # Try to find price pattern like $25.00 or $25
    match = re.search(r"\$(\d+(?:\.\d{2})?)", price_text)
    if match:
        price = float(match.group(1))
        return price, price, None
    return None, None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Basement East events using Playwright and JavaScript extraction."""
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

            logger.info(f"Fetching The Basement East: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Extract the all_events JavaScript array directly
            try:
                events_data = page.evaluate("""
                    () => {
                        if (typeof all_events !== 'undefined' && Array.isArray(all_events)) {
                            return all_events.map(e => ({
                                title: e.title || '',
                                start: e.start || '',
                                displayTime: e.displayTime || '',
                                imageUrl: e.imageUrl || '',
                                venue: e.venue || '',
                            }));
                        }
                        return [];
                    }
                """)
            except Exception as e:
                logger.error(f"Failed to extract all_events JS array: {e}")
                events_data = []

            if not events_data:
                logger.warning("No events found in all_events JavaScript array")
                browser.close()
                return 0, 0, 0

            logger.info(f"Found {len(events_data)} events in all_events JS array")

            for event in events_data:
                try:
                    # Extract title - may contain HTML tags like <a href="...">Title</a>
                    raw_title = event.get("title", "")
                    title = re.sub(r'<[^>]+>', '', raw_title).strip()
                    if not title:
                        continue

                    # Extract date from start field (format: "YYYY-MM-DD")
                    start_date = event.get("start", "")
                    if not start_date:
                        continue

                    # Extract time from displayTime (format: "Show: 8:00 PM" or "Doors: 7:00 PM")
                    start_time = None
                    display_time = event.get("displayTime", "")
                    if display_time:
                        # Look for time pattern like "8:00 PM"
                        time_match = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)", display_time, re.IGNORECASE)
                        if time_match:
                            start_time = parse_time(time_match.group(1))

                    # Extract image URL from imageUrl field - may contain HTML like <img src="...">
                    image_url = None
                    raw_image = event.get("imageUrl", "")
                    if raw_image:
                        # Try to extract src attribute from <img> tag
                        img_match = re.search(r'src="([^"]+)"', raw_image)
                        if img_match:
                            image_url = img_match.group(1)
                            if not image_url.startswith("http"):
                                image_url = BASE_URL + image_url
                        elif raw_image.startswith("http"):
                            # Direct URL
                            image_url = raw_image

                    events_found += 1

                    content_hash = generate_content_hash(title, "The Basement East", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
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
                        "category": "music",
                        "subcategory": "concert",
                        "tags": ["basement-east", "nashville", "live-music", "east-nashville"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": CALENDAR_URL,
                        "ticket_url": CALENDAR_URL,
                        "image_url": image_url,
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}" + (f" at {start_time}" if start_time else " (all-day)"))

                except Exception as e:
                    logger.error(f"Failed to parse event: {e}")
                    continue

            browser.close()

        logger.info(
            f"The Basement East crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl The Basement East: {e}")
        raise

    return events_found, events_new, events_updated
