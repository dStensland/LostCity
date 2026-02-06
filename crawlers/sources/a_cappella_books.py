"""
Crawler for A Cappella Books (acappellabooks.com/events.php).
An independent bookstore in Inman Park with frequent author events.
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

BASE_URL = "https://www.acappellabooks.com"
EVENTS_URL = f"{BASE_URL}/events.php"

VENUE_DATA = {
    "name": "A Cappella Books",
    "slug": "a-cappella-books",
    "address": "208 Haralson Ave NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "venue_type": "bookstore",
    "website": BASE_URL,
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from format like 'Wednesday, January 14, 2026' or 'January 14, 2026'."""
    date_str = date_str.strip()

    # Remove day of week if present (only match actual day names, not month names)
    day_pattern = r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*"
    date_str = re.sub(day_pattern, "", date_str, flags=re.I)

    # Try full date formats with year
    for fmt in ["%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y"]:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try without year
    current_year = datetime.now().year
    for fmt in ["%B %d", "%b %d"]:
        try:
            dt = datetime.strptime(date_str, fmt)
            dt = dt.replace(year=current_year)
            if dt < datetime.now():
                dt = dt.replace(year=current_year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from format like '7:00 PM'."""
    try:
        match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_str, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.upper() == "PM" and hour != 12:
                hour += 12
            elif period.upper() == "AM" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
    except Exception:
        pass
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl A Cappella Books events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            page = context.new_page()

            logger.info(f"Fetching A Cappella Books: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Get page text and parse events
            text = page.inner_text("body")

            # Split by "READ MORE" to get individual event blocks
            blocks = re.split(r"READ MORE", text)

            for block in blocks:
                try:
                    # Pattern: Title line, then date line, then description, then location
                    # "Wednesday January 14, 2026 7:00 PM"
                    date_match = re.search(
                        r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+"
                        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
                        r"(\d{1,2}),?\s*(\d{4})\s+(\d{1,2}:\d{2}\s*(AM|PM))",
                        block,
                        re.I,
                    )

                    if not date_match:
                        continue

                    # Parse date
                    month = date_match.group(2)
                    day = date_match.group(3)
                    year = date_match.group(4)
                    time_str = date_match.group(5)

                    start_date = parse_date(f"{month} {day}, {year}")
                    if not start_date:
                        continue

                    start_time = parse_time(time_str)

                    # Title is the line before the date line
                    # Split block into lines
                    lines = [l.strip() for l in block.split("\n") if l.strip()]

                    title = None
                    description = None

                    # Find the line index that contains the date
                    date_line_idx = None
                    for i, line in enumerate(lines):
                        if re.match(
                            r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)",
                            line,
                            re.I,
                        ):
                            date_line_idx = i
                            break

                    if date_line_idx is None:
                        continue

                    # Title is the line just before the date line
                    if date_line_idx > 0:
                        potential_title = lines[date_line_idx - 1]
                        # Must have author name pattern (contains – or - or "in conversation")
                        if (
                            " – " in potential_title
                            or " - " in potential_title
                            or "in conversation" in potential_title.lower()
                        ):
                            title = potential_title

                    if not title:
                        continue

                    # Description is after the date line (usually starts with quote)
                    for i in range(
                        date_line_idx + 1, min(date_line_idx + 5, len(lines))
                    ):
                        line = lines[i]
                        if line.startswith('"') or (
                            len(line) > 30 and not line.startswith("Location")
                        ):
                            description = line.strip('"').strip("...")[:500]
                            break

                    events_found += 1

                    content_hash = generate_content_hash(
                        title, VENUE_DATA["name"], start_date
                    )

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Determine subcategory
                    title_lower = title.lower()
                    if "book club" in title_lower:
                        subcategory = "words.bookclub"
                    elif "poetry" in title_lower or "poet" in title_lower:
                        subcategory = "words.poetry"
                    elif "workshop" in title_lower or "writing" in title_lower:
                        subcategory = "words.workshop"
                    else:
                        subcategory = "words.reading"

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



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
                        "category": "words",
                        "subcategory": subcategory,
                        "tags": ["books", "author", "reading", "literary"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Book purchase may be required",
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
                        "image_url": image_map.get(title),
                        "raw_text": None,
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")

                except Exception as e:
                    logger.debug(f"Error processing event block: {e}")
                    continue

            browser.close()

        logger.info(
            f"A Cappella Books crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl A Cappella Books: {e}")
        raise

    return events_found, events_new, events_updated
