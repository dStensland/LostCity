"""
Crawler for Krog Street Market (krogstreetmarket.com).
Popular food hall in Inman Park with restaurants and events.

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

BASE_URL = "https://www.krogstreetmarket.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Krog Street Market",
    "slug": "krog-street-market",
    "address": "99 Krog St NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7575,
    "lng": -84.3641,
    "venue_type": "food_hall",
    "spot_type": "food_hall",
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


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title."""
    title_lower = title.lower()
    tags = ["krog-street-market", "food-hall", "inman-park", "beltline"]
    if any(w in title_lower for w in ["music", "concert", "live", "dj", "band"]):
        return "music", "live", tags + ["live-music"]
    if any(w in title_lower for w in ["market", "pop-up", "vendor", "makers"]):
        return "community", "market", tags + ["market"]
    if any(w in title_lower for w in ["tasting", "food", "chef", "dinner", "brunch"]):
        return "food_drink", "tasting", tags + ["food"]
    if any(w in title_lower for w in ["yoga", "fitness"]):
        return "fitness", None, tags + ["fitness"]
    if any(w in title_lower for w in ["kids", "family", "children"]):
        return "family", None, tags + ["family"]
    return "community", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Krog Street Market events using Playwright."""
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

            logger.info(f"Fetching Krog Street Market: {EVENTS_URL}")
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
            i = 0
            while i < len(lines):
                line = lines[i]

                # Skip navigation/header items
                skip_items = [
                    "menu", "food", "shops", "events", "directory", "about",
                    "contact", "search", "hours", "visit", "location", "parking",
                    "leasing", "merchants", "beltline"
                ]
                if line.lower() in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Look for date patterns
                # "January 18, 2026" or "Jan 18" or "Saturday, January 18"
                date_match = re.match(
                    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    month = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

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

                            # Look for title
                            if not title and len(check_line) > 5:
                                if not re.match(r"\d{1,2}[:/]", check_line):
                                    if not re.match(r"(free|tickets|register|learn more|\$|more info|rsvp)", check_line.lower()):
                                        title = check_line
                                        break

                    if not title:
                        i += 1
                        continue

                    # Parse date
                    try:
                        month_str = month[:3] if len(month) > 3 else month
                        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                        if dt.date() < datetime.now().date():
                            dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Krog Street Market", start_date
                    )

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        continue

                    category, subcategory, tags = determine_category(title)
                    is_free = "free" in title.lower()

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": "Event at Krog Street Market",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": start_time is None,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": EVENTS_URL,
                        "ticket_url": EVENTS_URL,
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
            f"Krog Street Market crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Krog Street Market: {e}")
        raise

    return events_found, events_new, events_updated
