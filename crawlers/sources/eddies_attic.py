"""
Crawler for Eddie's Attic (eddiesattic.com).
Legendary acoustic music venue in Decatur - John Mayer started here.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://eddiesattic.com"

VENUE_DATA = {
    "name": "Eddie's Attic",
    "slug": "eddies-attic",
    "address": "515-B N McDonough St",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date from 'Mon, Jan 12' format."""
    try:
        date_text = date_text.strip()
        current_year = datetime.now().year

        match = re.match(r"(\w+),?\s+(\w+)\s+(\d+)", date_text)
        if match:
            _, month, day = match.groups()
            for fmt in ["%b %d %Y", "%B %d %Y"]:
                try:
                    dt = datetime.strptime(f"{month} {day} {current_year}", fmt)
                    if dt < datetime.now():
                        dt = datetime.strptime(f"{month} {day} {current_year + 1}", fmt)
                    return dt.strftime("%Y-%m-%d"), None
                except ValueError:
                    continue
        return None, None
    except Exception:
        return None, None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:30pm' format."""
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


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Eddie's Attic events."""
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

            logger.info(f"Fetching Eddie's Attic: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Find event blocks - they contain title, date, time
            body_text = page.inner_text("body")

            # Pattern: ARTIST NAME\nDay, Mon DD Time\n
            # Split by "More info" or "Buy tickets" to separate events
            blocks = re.split(
                r"(?:Buy tickets|More info|Sold out)", body_text, flags=re.IGNORECASE
            )

            for block in blocks:
                lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
                if len(lines) < 2:
                    continue

                title = None
                date_text = None
                time_text = None

                for line in lines:
                    # Date pattern: Mon, Jan 12
                    if re.match(r"\w{3},?\s+\w{3}\s+\d+", line):
                        parts = line.split()
                        # Could be "Mon, Jan 12 7:30pm"
                        date_text = " ".join(parts[:3])
                        if len(parts) > 3:
                            time_text = parts[-1]
                        continue

                    # Time only
                    if re.match(r"\d{1,2}:?\d{0,2}\s*(am|pm)$", line, re.IGNORECASE):
                        time_text = line
                        continue

                    # Title - all caps or substantial text
                    if (
                        not title
                        and len(line) > 3
                        and line
                        not in ["UPCOMING SHOWS", "ATLANTA'S LEGENDARY LISTENING ROOM"]
                    ):
                        title = line

                if not title or not date_text:
                    continue

                start_date, _ = parse_date(date_text)
                if not start_date:
                    continue

                start_time = parse_time(time_text or "")

                events_found += 1

                content_hash = generate_content_hash(title, "Eddie's Attic", start_date)

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
                    "subcategory": "acoustic",
                    "tags": ["live-music", "acoustic", "singer-songwriter"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": BASE_URL,
                    "ticket_url": None,
                    "image_url": image_map.get(title),
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

        logger.info(
            f"Eddie's Attic crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Eddie's Attic: {e}")
        raise

    return events_found, events_new, events_updated
