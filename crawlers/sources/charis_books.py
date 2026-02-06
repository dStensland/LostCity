"""
Crawler for Charis Books & More (charisbooksandmore.com/events).
A feminist bookstore in Decatur with book clubs, poetry, and author events.
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

BASE_URL = "https://www.charisbooksandmore.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Charis Books & More",
    "slug": "charis-books",
    "address": "184 S Candler St",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "venue_type": "bookstore",
    "website": BASE_URL,
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from format like 'Sun, 1/4/2026' or '1/4/2026'."""
    date_str = date_str.strip()

    # Remove day of week prefix
    date_str = re.sub(r"^[A-Za-z]+,\s*", "", date_str)

    for fmt in ["%m/%d/%Y", "%m/%d/%y", "%B %d, %Y", "%b %d, %Y"]:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from format like '3:00pm'."""
    try:
        match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_str, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
    except Exception:
        pass
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Charis Books events using Playwright."""
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

            logger.info(f"Fetching Charis Books: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Get page text
            text = page.inner_text("body")

            # Split by month+day pattern to get event blocks
            # Each event starts with JAN\n04 or similar
            blocks = re.split(
                r"(?=JAN\s+\d|FEB\s+\d|MAR\s+\d|APR\s+\d|MAY\s+\d|JUN\s+\d|JUL\s+\d|AUG\s+\d|SEP\s+\d|OCT\s+\d|NOV\s+\d|DEC\s+\d)",
                text,
            )

            for block in blocks:
                try:
                    # Skip navigation blocks
                    if "SUB-NAVIGATION" in block or "Event Type" in block:
                        continue

                    # Extract date from DATE: line
                    date_match = re.search(
                        r"DATE:\s*\n?\s*([A-Za-z]+,?\s*\d{1,2}/\d{1,2}/\d{2,4})", block
                    )
                    if not date_match:
                        continue

                    start_date = parse_date(date_match.group(1))
                    if not start_date:
                        continue

                    # Extract time from TIME: line
                    time_match = re.search(
                        r"TIME:\s*\n?\s*(\d{1,2}:\d{2}\s*(am|pm))", block, re.I
                    )
                    start_time = parse_time(time_match.group(1)) if time_match else None

                    # Extract title - it's right after the month/day at start of block
                    lines = [l.strip() for l in block.split("\n") if l.strip()]

                    title = None
                    description = None

                    for i, line in enumerate(lines):
                        # Skip month abbreviations and day numbers
                        if re.match(
                            r"^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$", line
                        ):
                            continue
                        if re.match(r"^\d{1,2}$", line):
                            continue
                        # Skip event type tags
                        if re.match(
                            r"^(In-Store|Online|Book Club|Fiction|Non-Fiction|Poetry|Trans|Workshop|Off-Site)",
                            line,
                            re.I,
                        ):
                            continue
                        # Skip navigation/metadata
                        if any(
                            skip in line
                            for skip in [
                                "DATE:",
                                "TIME:",
                                "PLACE:",
                                "VIEW EVENT",
                                "ABOUT",
                                "RSVP",
                            ]
                        ):
                            break
                        # Skip address lines
                        if re.match(r"^\d+\s+(S\.|N\.|E\.|W\.|South|North)", line):
                            continue
                        if re.match(r"^(Decatur|Atlanta),?\s*GA", line):
                            continue
                        if line == "Zoom":
                            continue
                        # Title is the first substantial line (usually all caps)
                        if not title and len(line) > 10:
                            title = line
                            continue
                        # Description is the next substantial line after title
                        if title and not description and len(line) > 20:
                            description = line[:500]
                            break

                    if not title:
                        continue

                    # Clean up title
                    title = re.sub(r"\s+", " ", title).strip()
                    if len(title) < 5:
                        continue

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
                    elif (
                        "poetry" in title_lower
                        or "poet" in title_lower
                        or "open mic" in title_lower
                    ):
                        subcategory = "words.poetry"
                    elif "workshop" in title_lower or "writing" in title_lower:
                        subcategory = "words.workshop"
                    elif "story" in title_lower:
                        subcategory = "words.storytelling"
                    else:
                        subcategory = "words.reading"

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title.title() if title.isupper() else title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "words",
                        "subcategory": subcategory,
                        "tags": ["books", "feminist", "literary", "decatur", "lgbtq"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
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
            f"Charis Books crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Charis Books: {e}")
        raise

    return events_found, events_new, events_updated
