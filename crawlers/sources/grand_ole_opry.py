"""
Crawler for Grand Ole Opry (opry.com/full-calendar).
The world's longest-running live radio show and iconic Nashville venue.

Site uses JavaScript rendering - must use Playwright.
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

BASE_URL = "https://www.opry.com"
EVENTS_URL = f"{BASE_URL}/full-calendar"

VENUE_DATA = {
    "name": "Grand Ole Opry",
    "slug": "grand-ole-opry",
    "address": "2804 Opryland Dr",
    "city": "Nashville",
    "state": "TN",
    "zip": "37214",
    "neighborhood": "Donelson",
    "venue_type": "music_venue",
    "website": BASE_URL,
    "lat": 36.2067,
    "lng": -86.6920,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats to YYYY-MM-DD."""
    formats = [
        "%B %d, %Y",      # "January 15, 2026"
        "%b %d, %Y",      # "Jan 15, 2026"
        "%m/%d/%Y",       # "01/15/2026"
        "%Y-%m-%d",       # "2026-01-15"
        "%A, %B %d, %Y",  # "Monday, January 15, 2026"
    ]

    date_text = date_text.strip()

    for fmt in formats:
        try:
            dt = datetime.strptime(date_text, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '19:00' format to 24-hour time."""
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


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Grand Ole Opry events using Playwright."""
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

            logger.info(f"Fetching Grand Ole Opry: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page HTML and parse with BeautifulSoup
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Find all calendar day containers that have events
            calendar_days = soup.find_all("div", class_="ch_calendar-day hasEvent")
            logger.info(f"Found {len(calendar_days)} days with events")

            for day_container in calendar_days:
                try:
                    # Get the date from data-fulldate attribute (format: MM-DD-YYYY)
                    date_attr = day_container.get("data-fulldate")
                    if not date_attr:
                        continue

                    # Parse date from MM-DD-YYYY format
                    start_date = parse_date(date_attr.replace("-", "/"))
                    if not start_date:
                        logger.debug(f"Could not parse date: {date_attr}")
                        continue

                    # Find all event items within this day
                    event_items = day_container.find_all("div", class_="event_item")

                    for event_item in event_items:
                        # Extract title from h3 > span.link
                        title_elem = event_item.find("h3")
                        if title_elem:
                            link_span = title_elem.find("span", class_="link")
                            if link_span:
                                title = link_span.get_text(strip=True)
                            else:
                                title = title_elem.get_text(strip=True)
                        else:
                            continue

                        if not title or len(title) < 3:
                            continue

                        # Extract time from div.showings.time
                        time_elem = event_item.find("div", class_="showings")
                        start_time = None
                        if time_elem:
                            time_text = time_elem.get_text(strip=True)
                            start_time = parse_time(time_text)

                        # Extract description
                        description = "Grand Ole Opry live show featuring country music's finest performers"

                        # Extract ticket URL from link
                        ticket_url = EVENTS_URL
                        link_elem = event_item.find("a", href=True)
                        if link_elem and link_elem.get("href"):
                            ticket_url = link_elem["href"]
                            if ticket_url.startswith("/"):
                                ticket_url = BASE_URL + ticket_url

                        # Extract image URL (usually not in event_item)
                        image_url = None

                        events_found += 1

                        content_hash = generate_content_hash(title, "Grand Ole Opry", start_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        # Build tags
                        tags = ["grand-ole-opry", "donelson", "country-music", "live-radio", "iconic-venue"]

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "music",
                            "subcategory": "concert",
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Tickets required",
                            "is_free": False,
                            "source_url": EVENTS_URL,
                            "ticket_url": ticket_url,
                            "image_url": image_url,
                            "raw_text": f"{title} - {start_date} - {description}",
                            "extraction_confidence": 0.90,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")

                except Exception as e:
                    logger.error(f"Failed to parse event: {e}")
                    continue

            browser.close()

        logger.info(
            f"Grand Ole Opry crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Grand Ole Opry: {e}")
        raise

    return events_found, events_new, events_updated
