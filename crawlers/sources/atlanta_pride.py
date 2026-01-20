"""
Crawler for Atlanta Pride (atlantapride.org).
Atlanta's major LGBTQ+ organization hosting Pride festival and year-round events.

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

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantapride.org"
EVENTS_URL = f"{BASE_URL}/events-page/"

# Default venue for Atlanta Pride events
DEFAULT_VENUE = {
    "name": "Atlanta Pride",
    "slug": "atlanta-pride",
    "address": "1530 DeKalb Ave NE",
    "neighborhood": "Candler Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "venue_type": "organization",
    "website": BASE_URL,
}

# Piedmont Park is the main Pride festival location
PIEDMONT_PARK = {
    "name": "Piedmont Park",
    "slug": "piedmont-park",
    "address": "1320 Monroe Dr NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "venue_type": "park",
    "website": "https://piedmontpark.org",
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '4:30 pm' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    # Also try "4pm" format without colon
    match = re.search(r"(\d{1,2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:00"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Pride events using Playwright."""
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

            # Pre-create venues
            default_venue_id = get_or_create_venue(DEFAULT_VENUE)
            piedmont_venue_id = get_or_create_venue(PIEDMONT_PARK)

            logger.info(f"Fetching Atlanta Pride: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse events - look for date patterns
            # Format varies: "January 18" or "January 18, 2026" or "Jan 18"
            i = 0
            while i < len(lines):
                line = lines[i]

                # Skip navigation/header items
                skip_items = [
                    "menu", "home", "about", "events", "donate", "volunteer",
                    "contact", "search", "close", "navigation", "pride",
                    "get involved", "sponsors", "board", "staff", "history"
                ]
                if line.lower() in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Look for date patterns
                # "January 18, 2026" or "January 18" or "Jan 18, 2026"
                date_match = re.match(
                    r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                    line,
                    re.IGNORECASE
                )

                # Also try "MM/DD/YYYY" format
                if not date_match:
                    date_match = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", line)
                    if date_match:
                        month_num, day, year = date_match.groups()
                        month_names = ["", "January", "February", "March", "April", "May", "June",
                                      "July", "August", "September", "October", "November", "December"]
                        try:
                            month = month_names[int(month_num)]
                            date_match = type('Match', (), {
                                'groups': lambda s=month, d=day, y=year: (s, d, y)
                            })()
                        except (IndexError, ValueError):
                            date_match = None

                if date_match:
                    groups = date_match.groups()
                    month = groups[0]
                    day = groups[1]
                    year = groups[2] if len(groups) > 2 and groups[2] else str(datetime.now().year)

                    # Look for title in surrounding lines
                    title = None
                    start_time = None

                    # Check lines before and after for title and time
                    for offset in [-2, -1, 1, 2, 3]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]

                            # Skip if it's another date or skip item
                            if check_line.lower() in skip_items:
                                continue
                            if re.match(r"(January|February|March|April|May|June|July|August|September|October|November|December)", check_line, re.IGNORECASE):
                                continue

                            # Check for time
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue

                            # Look for title (longer text that's not a time or date)
                            if not title and len(check_line) > 5:
                                if not re.match(r"\d{1,2}[:/]", check_line):
                                    if not re.match(r"(free|tickets|rsvp|register|\$)", check_line.lower()):
                                        title = check_line
                                        break

                    if not title:
                        i += 1
                        continue

                    # Parse date
                    try:
                        # Handle both full and abbreviated month names
                        month_str = month[:3] if len(month) > 3 else month
                        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                        # If date is in past, assume next year
                        if dt.date() < datetime.now().date():
                            dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    events_found += 1

                    # Determine venue - use Piedmont Park for festival events
                    title_lower = title.lower()
                    venue_id = default_venue_id
                    if "piedmont" in title_lower or "festival" in title_lower or "parade" in title_lower:
                        venue_id = piedmont_venue_id

                    # Generate content hash
                    content_hash = generate_content_hash(title, "Atlanta Pride", start_date)

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        continue

                    # Build tags
                    tags = ["lgbtq", "pride", "atlanta-pride", "community"]
                    if "festival" in title_lower:
                        tags.append("festival")
                    if "parade" in title_lower:
                        tags.append("parade")

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": "Atlanta Pride event",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": start_time is None,
                        "category": "community",
                        "subcategory": "pride",
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": EVENTS_URL,
                        "ticket_url": None,
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
            f"Atlanta Pride crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Pride: {e}")
        raise

    return events_found, events_new, events_updated
