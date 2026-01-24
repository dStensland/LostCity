"""
Crawler for Dad's Garage Theatre (dadsgarage.com).
Improv and sketch comedy theater in Old Fourth Ward.

Site structure: Calendar-based shows at /shows/ with individual event URLs.
Uses Salesforce for ticketing.
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

BASE_URL = "https://dadsgarage.com"
SHOWS_URL = f"{BASE_URL}/shows/"

VENUE_DATA = {
    "name": "Dad's Garage Theatre",
    "slug": "dads-garage",
    "address": "569 Ezzard St SE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7558,
    "lng": -84.3685,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}

SKIP_PATTERNS = [
    r"^(home|about|contact|donate|support|subscribe|tickets?|buy|cart|menu)$",
    r"^(login|sign in|register|account)$",
    r"^(facebook|twitter|instagram|youtube)$",
    r"^(privacy|terms|policy|copyright)$",
    r"^(calendar|all shows|get tickets)$",
    r"^\d+$",
    r"^[a-z]{1,3}$",
]


def is_valid_title(title: str) -> bool:
    """Check if a string looks like a valid show title."""
    if not title or len(title) < 3 or len(title) > 200:
        return False
    title_lower = title.lower().strip()
    for pattern in SKIP_PATTERNS:
        if re.match(pattern, title_lower, re.IGNORECASE):
            return False
    return True


def parse_show_datetime(date_text: str, time_text: str = "") -> tuple[Optional[str], Optional[str]]:
    """
    Parse date and time from Dad's Garage format.
    Date: "Jan 23, 2026" or "January 23, 2026"
    Time: "8:00 PM - 9:30 PM" or "8:00 PM"
    """
    start_date = None
    start_time = None

    if not date_text:
        return None, None

    # Parse date
    date_patterns = [
        (r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s*(\d{4})", "%b %d %Y"),
        (r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})", "%B %d %Y"),
    ]

    for pattern, fmt in date_patterns:
        match = re.search(pattern, date_text, re.IGNORECASE)
        if match:
            month, day, year = match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {year}", fmt)
                start_date = dt.strftime("%Y-%m-%d")
                break
            except ValueError:
                continue

    # Parse time
    if time_text:
        time_match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)
        if time_match:
            hour, minute, period = time_match.groups()
            hour = int(hour)
            if period.upper() == "PM" and hour != 12:
                hour += 12
            elif period.upper() == "AM" and hour == 12:
                hour = 0
            start_time = f"{hour:02d}:{minute}"

    return start_date, start_time


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Dad's Garage shows from their calendar."""
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

            logger.info(f"Fetching Dad's Garage: {SHOWS_URL}")
            page.goto(SHOWS_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load more events
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Dad's Garage calendar shows events in a list/grid format
            # Each event has title, date, time, and ticket link
            # Look for event containers
            event_items = page.query_selector_all(".event-item, .show-item, .calendar-event, article")

            if not event_items or len(event_items) < 3:
                # Fallback: parse the page text for event patterns
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                # Look for date patterns followed by show info
                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Match date pattern like "Jan 23, 2026"
                    date_match = re.match(
                        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s*(\d{4})",
                        line,
                        re.IGNORECASE
                    )

                    if date_match:
                        date_text = line

                        # Look for time and title in next few lines
                        time_text = ""
                        title = None

                        for j in range(i + 1, min(i + 5, len(lines))):
                            check_line = lines[j]

                            # Check for time
                            if re.search(r"\d{1,2}:\d{2}\s*(AM|PM)", check_line, re.IGNORECASE):
                                time_text = check_line
                                continue

                            # Check for title (not a date, not "Get Tickets", etc.)
                            if not title and len(check_line) > 3:
                                if not re.match(r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)", check_line, re.IGNORECASE):
                                    if not re.match(r"(get tickets|buy|sold out|\$|pm|am)", check_line.lower()):
                                        if is_valid_title(check_line):
                                            title = check_line
                                            break

                        if title:
                            start_date, start_time = parse_show_datetime(date_text, time_text)

                            if start_date:
                                # Skip past events
                                try:
                                    if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                                        i += 1
                                        continue
                                except ValueError:
                                    pass

                                events_found += 1

                                content_hash = generate_content_hash(title, "Dad's Garage Theatre", start_date)

                                if find_event_by_hash(content_hash):
                                    events_updated += 1
                                    i += 1
                                    continue

                                # Determine show type from title
                                category = "comedy"
                                subcategory = "improv"
                                tags = ["dads-garage", "comedy", "improv", "o4w", "old-fourth-ward"]

                                title_lower = title.lower()
                                if "theatresports" in title_lower or "tournament" in title_lower:
                                    tags.append("competition")
                                elif "adventure playhouse" in title_lower or "kid" in title_lower:
                                    tags.append("family")
                                    tags.append("kids")
                                elif "blackground" in title_lower:
                                    tags.append("black-voices")
                                elif "valentine" in title_lower or "sex" in title_lower:
                                    tags.append("date-night")
                                    tags.append("21+")

                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": f"{title} at Dad's Garage Theatre",
                                    "start_date": start_date,
                                    "start_time": start_time or "20:00",
                                    "end_date": None,
                                    "end_time": None,
                                    "is_all_day": False,
                                    "category": category,
                                    "subcategory": subcategory,
                                    "tags": tags,
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": None,
                                    "is_free": False,
                                    "source_url": SHOWS_URL,
                                    "ticket_url": SHOWS_URL,
                                    "image_url": None,
                                    "raw_text": f"{title} - {date_text} {time_text}",
                                    "extraction_confidence": 0.82,
                                    "is_recurring": False,
                                    "recurrence_rule": None,
                                    "content_hash": content_hash,
                                }

                                try:
                                    insert_event(event_record)
                                    events_new += 1
                                    logger.info(f"Added: {title} on {start_date} at {start_time}")
                                except Exception as e:
                                    logger.error(f"Failed to insert: {title}: {e}")

                    i += 1

            browser.close()

        logger.info(
            f"Dad's Garage crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Dad's Garage: {e}")
        raise

    return events_found, events_new, events_updated
