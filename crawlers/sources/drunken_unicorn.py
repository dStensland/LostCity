"""
Crawler for The Drunken Unicorn (via Songkick).

The Drunken Unicorn is a legendary dive bar and music venue in Little Five Points.
Since they don't have their own website, we crawl their Songkick venue page.

Songkick URL: https://www.songkick.com/venues/3517036-drunken-unicorn
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SONGKICK_URL = "https://www.songkick.com/venues/3517036-drunken-unicorn"

VENUE_DATA = {
    "name": "The Drunken Unicorn",
    "slug": "drunken-unicorn",
    "address": "736 Ponce De Leon Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "venue_type": "music_venue",
    "website": "https://www.songkick.com/venues/3517036-drunken-unicorn",
}


def parse_songkick_date(date_str: str) -> Optional[str]:
    """
    Parse Songkick date formats.
    Examples:
    - "Sun 02 Feb 2025"
    - "Mon 03 Mar 2025"
    """
    try:
        # Remove extra whitespace
        date_str = " ".join(date_str.split())

        # Try "Day DD Mon YYYY" format
        match = re.match(r"[A-Za-z]{3}\s+(\d{2})\s+([A-Za-z]{3})\s+(\d{4})", date_str)
        if match:
            day, month, year = match.groups()
            dt = datetime.strptime(f"{day} {month} {year}", "%d %b %Y")
            return dt.strftime("%Y-%m-%d")

        # Try other common formats
        for fmt in ["%a %d %b %Y", "%d %B %Y", "%B %d, %Y", "%b %d, %Y"]:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

        return None
    except Exception as e:
        logger.debug(f"Failed to parse date '{date_str}': {e}")
        return None


def parse_songkick_time(time_str: str) -> Optional[str]:
    """
    Parse Songkick time formats.
    Examples: "8:00 PM", "7:30pm", "9pm"
    """
    try:
        time_str = time_str.strip()
        match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_str, re.IGNORECASE)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2)) if match.group(2) else 0
            period = match.group(3).lower()

            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0

            return f"{hour:02d}:{minute:02d}"
        return None
    except Exception as e:
        logger.debug(f"Failed to parse time '{time_str}': {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Drunken Unicorn events from Songkick."""
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

            logger.info(f"Fetching Songkick page: {SONGKICK_URL}")
            page.goto(SONGKICK_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Parse the page content
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Songkick lists events with patterns like:
            # Artist Name
            # Sun 02 Feb 2025
            # 8:00 PM
            # or sometimes the date is formatted differently

            # Try to find event listings using common Songkick selectors
            # Look for event list items
            event_elements = page.query_selector_all("li[class*='event-listing'], li.event, [class*='event-row'], [itemprop='event']")

            if event_elements:
                logger.info(f"Found {len(event_elements)} event elements using selectors")

                for elem in event_elements:
                    try:
                        # Extract artist/title
                        title_elem = elem.query_selector("[class*='event-link'], [class*='artists'], a[class*='event'], strong")
                        title = title_elem.inner_text().strip() if title_elem else None

                        # Extract date
                        date_elem = elem.query_selector("[class*='date'], time, [datetime]")
                        date_text = None
                        if date_elem:
                            # Try datetime attribute first
                            date_text = date_elem.get_attribute("datetime") or date_elem.inner_text().strip()

                        # Extract time if available
                        time_elem = elem.query_selector("[class*='time']")
                        time_text = time_elem.inner_text().strip() if time_elem else None

                        if not title or not date_text:
                            continue

                        # Parse date
                        start_date = parse_songkick_date(date_text)
                        if not start_date:
                            # Try datetime attribute format
                            if date_text and len(date_text) >= 10:
                                start_date = date_text[:10]  # YYYY-MM-DD

                        if not start_date:
                            logger.debug(f"Could not parse date for: {title}")
                            continue

                        # Parse time
                        start_time = parse_songkick_time(time_text) if time_text else None

                        events_found += 1

                        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": f"Live music at The Drunken Unicorn featuring {title}",
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": start_time is None,
                            "category": "music",
                            "subcategory": "concert",
                            "tags": ["music", "concert", "little-five-points", "dive-bar"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": SONGKICK_URL,
                            "ticket_url": SONGKICK_URL,
                            "image_url": None,
                            "raw_text": f"{title} - {start_date}",
                            "extraction_confidence": 0.80,
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

                    except Exception as e:
                        logger.debug(f"Failed to parse event element: {e}")
                        continue
            else:
                # Fallback: Parse line by line if selectors don't work
                logger.info("No event elements found with selectors, trying line-by-line parsing")

                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Skip short lines and common non-event text
                    if len(line) < 5:
                        i += 1
                        continue

                    # Look for date patterns (Songkick format: "Sun 02 Feb 2025")
                    date_match = re.match(r"([A-Za-z]{3})\s+(\d{2})\s+([A-Za-z]{3})\s+(\d{4})", line)

                    if date_match:
                        start_date = parse_songkick_date(line)

                        if not start_date:
                            i += 1
                            continue

                        # Look backward for artist name (title)
                        title = None
                        for j in range(i - 1, max(i - 5, -1), -1):
                            prev_line = lines[j]
                            # Skip common non-title lines
                            if len(prev_line) < 3:
                                continue
                            if any(skip in prev_line.lower() for skip in ["songkick", "venue", "upcoming", "past events", "track", "buy tickets"]):
                                continue
                            # This is likely the artist name
                            title = prev_line
                            break

                        # Look forward for time
                        start_time = None
                        if i + 1 < len(lines):
                            next_line = lines[i + 1]
                            start_time = parse_songkick_time(next_line)

                        if not title:
                            i += 1
                            continue

                        events_found += 1

                        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            i += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": f"Live music at The Drunken Unicorn featuring {title}",
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": start_time is None,
                            "category": "music",
                            "subcategory": "concert",
                            "tags": ["music", "concert", "little-five-points", "dive-bar"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": SONGKICK_URL,
                            "ticket_url": SONGKICK_URL,
                            "image_url": None,
                            "raw_text": f"{title} - {start_date}",
                            "extraction_confidence": 0.80,
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
            f"Drunken Unicorn crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Songkick: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Drunken Unicorn: {e}")
        raise

    return events_found, events_new, events_updated
