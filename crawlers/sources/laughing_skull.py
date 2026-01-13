"""
Crawler for Laughing Skull Lounge (laughingskulllounge.com).
Atlanta's dedicated comedy club since 2009.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from utils import slugify
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://laughingskulllounge.com"

VENUE_DATA = {
    "name": "Laughing Skull Lounge",
    "slug": "laughing-skull-lounge",
    "address": "878 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "comedy_club",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from 'Thursday, Jan 15' or 'Jan 15' format."""
    try:
        current_year = datetime.now().year

        # "Thursday, Jan 15" or "Jan 15"
        match = re.search(r"(\w{3,9}),?\s+(\w{3})\s+(\d+)", date_text)
        if match:
            _, month, day = match.groups()
        else:
            match = re.search(r"(\w{3})\s+(\d+)", date_text)
            if match:
                month, day = match.groups()
            else:
                return None

        for fmt in ["%b %d %Y", "%B %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", fmt)
                if dt < datetime.now():
                    dt = datetime.strptime(f"{month} {day} {current_year + 1}", fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
        return None
    except Exception:
        return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '8:00PM' format."""
    try:
        match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.upper() == "PM" and hour != 12:
                hour += 12
            elif period.upper() == "AM" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        return None
    except Exception:
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Laughing Skull events."""
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

            logger.info(f"Fetching Laughing Skull: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            venue_id = get_or_create_venue(VENUE_DATA)

            body_text = page.inner_text("body")

            # Pattern: Show Title\nDay, Mon DD\nTime\nGET TICKETS
            # Split by "GET TICKETS"
            blocks = re.split(r"GET TICKETS", body_text, flags=re.IGNORECASE)

            for block in blocks:
                lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
                if len(lines) < 2:
                    continue

                title = None
                date_text = None
                time_text = None

                for line in lines:
                    # Time pattern
                    if re.match(r"\d{1,2}:\d{2}\s*(AM|PM)$", line, re.IGNORECASE):
                        time_text = line
                        continue

                    # Date pattern
                    if re.search(r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+\w{3}\s+\d+", line, re.IGNORECASE):
                        date_text = line
                        continue
                    if re.match(r"\w{3}\s+\d+$", line):
                        date_text = line
                        continue

                    # Title - substantial text, not navigation
                    skip_words = ["UPCOMING SHOWS", "TONIGHT", "Calendar", "Open Mics", "About Us", "Show Time"]
                    if not title and len(line) > 5 and not any(w in line for w in skip_words):
                        title = line

                if not title or not date_text:
                    continue

                start_date = parse_date(date_text)
                if not start_date:
                    continue

                start_time = parse_time(time_text or "")

                events_found += 1

                content_hash = generate_content_hash(title, "Laughing Skull Lounge", start_date)

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
                    "category": "comedy",
                    "subcategory": "standup",
                    "tags": ["comedy", "standup", "laughing-skull"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": BASE_URL,
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

        logger.info(f"Laughing Skull crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Laughing Skull: {e}")
        raise

    return events_found, events_new, events_updated
