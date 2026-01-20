"""
Crawler for Center for Puppetry Arts (puppet.org).
World-class puppetry museum and performance venue.
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

BASE_URL = "https://puppet.org"
CALENDAR_URL = f"{BASE_URL}/visit/see-full-calendar/"

VENUE_DATA = {
    "name": "Center for Puppetry Arts",
    "slug": "center-for-puppetry-arts",
    "address": "1404 Spring St NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "museum",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '1:00 PM' format."""
    try:
        match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)
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
    """Crawl Center for Puppetry Arts shows from calendar."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Track unique shows to avoid duplicates from multiple showtimes
    seen_shows = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Puppetry Arts Calendar: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Get current and next month
            for month_offset in range(2):
                if month_offset > 0:
                    # Click next month
                    try:
                        next_btn = page.query_selector(
                            "text=/March 2026 >|February 2026 >/"
                        )
                        if next_btn:
                            next_btn.click()
                            page.wait_for_timeout(2000)
                    except Exception:
                        pass

                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                # Find month header like "February 2026"
                current_month = None
                current_year = None
                current_day = None

                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Month header: "February 2026" or "< January 2026"
                    month_match = re.search(
                        r"<?:?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})",
                        line,
                    )
                    if month_match:
                        current_month = month_match.group(1)
                        current_year = int(month_match.group(2))
                        i += 1
                        continue

                    # Day marker: "SUN" followed by number, or "MON" followed by number
                    if line in ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]:
                        if i + 1 < len(lines) and re.match(r"^\d{1,2}$", lines[i + 1]):
                            current_day = int(lines[i + 1])
                            i += 2
                            continue

                    # Check for PUPPET SHOWS entries
                    if line == "PUPPET SHOWS" and current_month and current_day:
                        if i + 2 < len(lines):
                            show_title = lines[i + 1]
                            time_text = lines[i + 2] if i + 2 < len(lines) else None

                            # Skip exhibitions and non-shows
                            skip_words = [
                                "Collection",
                                "Exhibition",
                                "PERMANENT",
                                "CLOSED",
                            ]
                            if any(w in show_title for w in skip_words):
                                i += 1
                                continue

                            # Build date
                            try:
                                dt = datetime.strptime(
                                    f"{current_month} {current_day} {current_year}",
                                    "%B %d %Y",
                                )
                                start_date = dt.strftime("%Y-%m-%d")
                            except ValueError:
                                i += 1
                                continue

                            start_time = parse_time(time_text) if time_text else None

                            # Track unique show + date combos
                            show_key = f"{show_title}|{start_date}"
                            if show_key in seen_shows:
                                i += 1
                                continue
                            seen_shows.add(show_key)

                            events_found += 1

                            content_hash = generate_content_hash(
                                show_title, "Center for Puppetry Arts", start_date
                            )

                            existing = find_event_by_hash(content_hash)
                            if existing:
                                events_updated += 1
                                i += 1
                                continue

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": show_title,
                                "description": None,
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": "family",
                                "subcategory": "puppetry",
                                "tags": [
                                    "puppetry",
                                    "family",
                                    "museum",
                                    "performing-arts",
                                ],
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": False,
                                "source_url": CALENDAR_URL,
                                "ticket_url": None,
                                "image_url": None,
                                "raw_text": None,
                                "extraction_confidence": 0.85,
                                "is_recurring": True,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(f"Added: {show_title} on {start_date}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {show_title}: {e}")

                    i += 1

            browser.close()

        logger.info(
            f"Puppetry Arts crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Puppetry Arts: {e}")
        raise

    return events_found, events_new, events_updated
