"""
Crawler for City Winery Atlanta (citywinery.com/atlanta).
Restaurant, winery, and intimate music venue.
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

BASE_URL = "https://citywinery.com/atlanta"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "City Winery Atlanta",
    "slug": "city-winery-atlanta",
    "address": "650 North Ave NE",
    "neighborhood": "Ponce City Market",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_datetime(text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date and time from 'Tue, Jan 13 @ 6:00 pm' format."""
    try:
        current_year = datetime.now().year

        # Format: "Tue, Jan 13 @ 6:00 pm" or "Thu, Jan 15 @ 8:00 pm"
        match = re.search(
            r"(\w{3}),?\s+(\w{3})\s+(\d+)\s*@\s*(\d{1,2}):(\d{2})\s*(am|pm)",
            text,
            re.IGNORECASE,
        )
        if match:
            _, month, day, hour, minute, period = match.groups()
            # Parse date
            for fmt in ["%b %d %Y"]:
                try:
                    dt = datetime.strptime(f"{month} {day} {current_year}", fmt)
                    if dt < datetime.now():
                        dt = datetime.strptime(f"{month} {day} {current_year + 1}", fmt)
                    date_str = dt.strftime("%Y-%m-%d")
                    break
                except ValueError:
                    continue
            else:
                return None, None

            # Parse time
            hour = int(hour)
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            time_str = f"{hour:02d}:{minute}"

            return date_str, time_str

        return None, None
    except Exception:
        return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City Winery Atlanta events."""
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

            logger.info(f"Fetching City Winery: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load more events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            venue_id = get_or_create_venue(VENUE_DATA)

            body_text = page.inner_text("body")

            # Pattern: Title / "Tue, Jan 13 @ 6:00 pm" / "City Winery Atlanta" / "Get Tickets"
            # Split by ticket action buttons
            blocks = re.split(
                r"(?:Get Tickets|Join Waitlist|Sold out)",
                body_text,
                flags=re.IGNORECASE,
            )

            for block in blocks:
                lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
                if len(lines) < 2:
                    continue

                title = None
                datetime_text = None

                for line in lines:
                    # Date/time pattern: "Tue, Jan 13 @ 6:00 pm"
                    if re.search(
                        r"\w{3},?\s+\w{3}\s+\d+\s*@\s*\d{1,2}:\d{2}\s*(am|pm)",
                        line,
                        re.IGNORECASE,
                    ):
                        datetime_text = line
                        continue

                    # Skip venue name and navigation
                    skip_words = [
                        "City Winery",
                        "Atlanta Concerts",
                        "Check out",
                        "Date",
                        "Sort",
                        "All Shows",
                        "Blues",
                        "Comedy",
                        "Global",
                        "Gospel",
                        "Hip-Hop",
                        "Podcast",
                        "Pop",
                        "R&B",
                        "Rock",
                        "Tribute",
                        "Wine",
                        "Pre-Sale",
                        "Low Ticket Alert",
                        "This Weekend",
                        "events",
                        "Skip to content",
                    ]
                    if any(w.lower() in line.lower() for w in skip_words):
                        continue

                    # Title - substantial text that's not a date
                    if not title and len(line) > 3 and len(line) < 120:
                        if not re.match(
                            r"^\d+$", line
                        ):  # Skip numbers like "148 events"
                            title = line

                if not title or not datetime_text:
                    continue

                start_date, start_time = parse_datetime(datetime_text)
                if not start_date:
                    continue

                events_found += 1

                content_hash = generate_content_hash(
                    title, "City Winery Atlanta", start_date
                )

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
                    "subcategory": "live",
                    "tags": ["music", "live-music", "city-winery", "dinner-show"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": EVENTS_URL,
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
            f"City Winery crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl City Winery: {e}")
        raise

    return events_found, events_new, events_updated
