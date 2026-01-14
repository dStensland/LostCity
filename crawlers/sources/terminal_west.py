"""
Crawler for Terminal West (terminalwestatl.com/events).
A music venue in West Midtown Atlanta.
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

BASE_URL = "https://terminalwestatl.com"
EVENTS_URL = BASE_URL  # Main page has all events; /events returns 403

VENUE_DATA = {
    "name": "Terminal West",
    "slug": "terminal-west",
    "address": "887 W Marietta St NW Suite J",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    current_year = datetime.now().year

    # Try "Sat Jan 18" format
    match = re.match(r"(\w{3})\s+(\w{3})\s+(\d+)", date_text)
    if match:
        _, month, day = match.groups()
        for fmt in ["%b %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", fmt)
                if dt < datetime.now():
                    dt = datetime.strptime(f"{month} {day} {current_year + 1}", fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    # Try "January 18, 2026" format
    match = re.match(r"(\w+)\s+(\d+),?\s*(\d{4})?", date_text)
    if match:
        month, day, year = match.groups()
        year = year or str(current_year)
        for fmt in ["%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7PM' format."""
    try:
        # "7:00 PM" or "7:00PM"
        match = re.search(r"(\d{1,2}):?(\d{2})?\s*(AM|PM)", time_text, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            minute = minute or "00"
            if period.upper() == "PM" and hour != 12:
                hour += 12
            elif period.upper() == "AM" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        return None
    except Exception:
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Terminal West events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Terminal West: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load more events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Get page content
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse events - format: TITLE / (supporting) / DATE TIME / TICKETS
            # Date pattern: FRI, JAN 16, 2026 8:00 PM
            date_pattern = re.compile(r"(MON|TUE|WED|THU|FRI|SAT|SUN),\s+(\w{3})\s+(\d+),\s+(\d{4})\s+(\d{1,2}:\d{2})\s*(AM|PM)", re.IGNORECASE)

            i = 0
            while i < len(lines):
                line = lines[i]
                match = date_pattern.match(line)
                if match:
                    # Found a date line - look backwards for title
                    _, month, day, year, time_str, period = match.groups()

                    # Find title - look up to 5 lines back for non-skip content
                    title = None
                    for j in range(i - 1, max(i - 6, -1), -1):
                        prev_line = lines[j]
                        # Skip navigation, tickets, etc.
                        skip_words = ["TICKETS", "CANCELLED", "SOLD OUT", "CALENDAR", "VENUE", "UPCOMING", "GETTING HERE", "DINING", "RENTAL", "SEARCH"]
                        if any(w in prev_line.upper() for w in skip_words):
                            continue
                        # Skip short lines
                        if len(prev_line) < 4:
                            continue
                        # Skip other date lines
                        if date_pattern.match(prev_line):
                            break
                        # This is likely the title
                        title = prev_line
                        break

                    # Parse date
                    start_date = parse_date(f"{month} {day}, {year}")

                    if title and start_date:
                        # Parse time
                        hour = int(time_str.split(":")[0])
                        minute = time_str.split(":")[1]
                        if period.upper() == "PM" and hour != 12:
                            hour += 12
                        elif period.upper() == "AM" and hour == 12:
                            hour = 0
                        start_time = f"{hour:02d}:{minute}"

                        events_found += 1

                        content_hash = generate_content_hash(title, "Terminal West", start_date)

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            i += 1
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
                            "tags": ["music", "concert", "terminal-west"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": EVENTS_URL,
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

                i += 1

            browser.close()

        logger.info(f"Terminal West crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Terminal West: {e}")
        raise

    return events_found, events_new, events_updated
