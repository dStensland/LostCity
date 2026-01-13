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
EVENTS_URL = f"{BASE_URL}/events"

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
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Terminal West: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Get page content
            body_text = page.inner_text("body")

            # Terminal West event format varies - look for event blocks
            # Common patterns: event titles followed by dates and "BUY TICKETS"

            # Split by common delimiters
            blocks = re.split(r"(?:BUY TICKETS|SOLD OUT|RSVP)", body_text, flags=re.IGNORECASE)

            for block in blocks:
                lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
                if len(lines) < 2:
                    continue

                title = None
                date_text = None
                time_text = None

                for line in lines:
                    # Skip navigation
                    skip_words = ["EVENTS", "ABOUT", "GALLERY", "CONTACT", "NEWSLETTER", "©", "Privacy"]
                    if any(w.lower() in line.lower() for w in skip_words):
                        continue

                    # Time pattern
                    if re.search(r"\d{1,2}:\d{2}\s*(AM|PM)", line, re.IGNORECASE):
                        time_text = line
                        continue

                    # Date patterns
                    if re.match(r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\w{3}\s+\d+", line, re.IGNORECASE):
                        date_text = line
                        continue
                    if re.match(r"\w+\s+\d+,?\s*\d{4}?$", line):
                        date_text = line
                        continue

                    # Title - longer text that's not a date or time
                    if not title and len(line) > 5 and len(line) < 200:
                        title = line

                if not title or not date_text:
                    continue

                start_date = parse_date(date_text)
                if not start_date:
                    continue

                start_time = parse_time(time_text or "")

                events_found += 1

                content_hash = generate_content_hash(title, "Terminal West", start_date)

                existing = find_event_by_hash(content_hash)
                if existing:
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

            browser.close()

        logger.info(f"Terminal West crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Terminal West: {e}")
        raise

    return events_found, events_new, events_updated
