"""
Crawler for The Earl (badearl.com/show-calendar/).

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
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://badearl.com"
EVENTS_URL = "https://badearl.com"

VENUE_DATA = {
    "name": "The Earl",
    "slug": "the-earl",
    "address": "488 Flat Shoals Ave SE",
    "neighborhood": "East Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "music_venue",
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


def parse_price(lines: list, start_idx: int) -> tuple[Optional[float], Optional[float], bool]:
    """Parse price from lines like '$20 ADV' or 'FREE SHOW!'."""
    for i in range(start_idx, min(start_idx + 6, len(lines))):
        line = lines[i].upper()
        if "FREE" in line:
            return None, None, True
        price_match = re.search(r"\$(\d+)", line)
        if price_match:
            price = float(price_match.group(1))
            return price, price, False
    return None, None, False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Earl events using Playwright."""
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

            logger.info(f"Fetching The Earl: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse events - look for date patterns like "FRIDAY, JAN. 30, 2026"
            i = 0
            while i < len(lines):
                line = lines[i]

                # Skip short lines
                if len(line) < 10:
                    i += 1
                    continue

                # Look for date patterns: "FRIDAY, JAN. 30, 2026" or "SUNDAY, FEB. 1, 2026"
                date_match = re.match(
                    r"(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),\s+"
                    r"(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\.?\s+"
                    r"(\d{1,2}),\s+(\d{4})",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    month = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3)

                    # Parse date
                    try:
                        dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
                        if dt.date() < datetime.now().date():
                            i += 1
                            continue
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    # Look for show time (line with "SHOW" in it)
                    start_time = None
                    for j in range(i + 1, min(i + 5, len(lines))):
                        if "SHOW" in lines[j].upper():
                            time_result = parse_time(lines[j])
                            if time_result:
                                start_time = time_result
                                break

                    # Parse price
                    price_min, price_max, is_free = parse_price(lines, i + 1)

                    # Find the headliner - skip time/price lines, find first artist name
                    title = None
                    for j in range(i + 1, min(i + 10, len(lines))):
                        check_line = lines[j]
                        # Skip common non-title lines
                        if re.match(r"^\d{1,2}:\d{2}", check_line):  # Time
                            continue
                        if re.match(r"^\$\d+", check_line):  # Price
                            continue
                        if "DOORS" in check_line.upper():
                            continue
                        if "SHOW" in check_line.upper() and len(check_line) < 20:
                            continue
                        if "ADV" in check_line.upper() or "DOS" in check_line.upper():
                            continue
                        if "MORE INFO" in check_line.upper():
                            break
                        if "RESCHEDULED" in check_line.upper() or "POSTPONED" in check_line.upper():
                            continue
                        if "FREE" in check_line.upper() and len(check_line) < 15:
                            continue
                        # Found a potential title (artist name)
                        if len(check_line) > 3:
                            title = check_line
                            break

                    if not title:
                        i += 1
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, "The Earl", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        i += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": f"Live music at The Earl featuring {title}",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": start_time is None,
                        "category": "music",
                        "subcategory": "concert",
                        "tags": ["live-music", "concert"],
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": EVENTS_URL,
                        "ticket_url": EVENTS_URL,
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
            f"The Earl crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl The Earl: {e}")
        raise

    return events_found, events_new, events_updated
