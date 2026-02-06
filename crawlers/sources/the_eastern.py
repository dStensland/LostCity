"""
Crawler for The Eastern (easternatl.com).

Major 2,500-capacity music venue in Grant Park. Opened 2021.
Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://easternatl.com"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "The Eastern",
    "slug": "the-eastern",
    "address": "777 Memorial Dr SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7401,
    "lng": -84.3511,
    "venue_type": "music_venue",
    "spot_type": "music_venue",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
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
    """Crawl The Eastern events using Playwright."""
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

            logger.info(f"Fetching The Eastern: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # The Eastern format: "FRI, FEB 6, 2026 7:30 PM" with artist name on previous lines
            # Pattern: DAY, MON DD, YYYY H:MM PM
            date_pattern = re.compile(
                r"^(?:MON|TUE|WED|THU|FRI|SAT|SUN),?\s+"
                r"(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+"
                r"(\d{1,2}),?\s+"
                r"(\d{4})\s+"
                r"(\d{1,2}):(\d{2})\s*(AM|PM)",
                re.IGNORECASE
            )

            i = 0
            while i < len(lines):
                line = lines[i]

                # Look for date pattern like "FRI, FEB 6, 2026 7:30 PM"
                date_match = date_pattern.match(line)

                if date_match:
                    month_str = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3)
                    hour = int(date_match.group(4))
                    minute = date_match.group(5)
                    period = date_match.group(6).upper()

                    # Convert to 24-hour time
                    if period == "PM" and hour != 12:
                        hour += 12
                    elif period == "AM" and hour == 12:
                        hour = 0
                    start_time = f"{hour:02d}:{minute}"

                    # Parse date
                    try:
                        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    # Look for title in previous lines (artist name comes before date)
                    title = None
                    for offset in range(-1, -5, -1):
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]
                            # Skip navigation, times, tickets, short lines
                            if len(check_line) < 3:
                                continue
                            if date_pattern.match(check_line):
                                continue
                            skip_words = ["tickets", "calendar", "venue", "getting", "dining",
                                         "rental", "upgrades", "doors", "show", "upcoming"]
                            if any(w in check_line.lower() for w in skip_words):
                                continue
                            if re.match(r"^\d+:\d+\s*(am|pm)", check_line, re.IGNORECASE):
                                continue
                            # Found title
                            title = check_line
                            break

                    if not title or len(title) < 3:
                        i += 1
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, "The Eastern", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        i += 1
                        continue

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": f"Live at The Eastern",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "music",
                        "subcategory": "concert",
                        "tags": ["live-music", "concert", "grant-park"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date}",
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

        logger.info(
            f"The Eastern crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl The Eastern: {e}")
        raise

    return events_found, events_new, events_updated
