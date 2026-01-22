"""
Crawler for Atlanta Contemporary (atlantacontemporary.org).
Free contemporary art center in West Midtown with rotating exhibitions.

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

BASE_URL = "https://www.atlantacontemporary.org"
EVENTS_URL = f"{BASE_URL}/programs"

VENUE_DATA = {
    "name": "Atlanta Contemporary",
    "slug": "atlanta-contemporary",
    "address": "535 Means St NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7780,
    "lng": -84.4127,
    "venue_type": "museum",
    "spot_type": "museum",
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
    tags = ["atlanta-contemporary", "museum", "contemporary", "west-midtown", "free"]
    if any(w in title_lower for w in ["exhibition", "exhibit", "gallery", "show"]):
        return "art", "exhibition", tags + ["exhibition"]
    if any(w in title_lower for w in ["opening", "reception"]):
        return "art", "opening", tags + ["opening"]
    if any(w in title_lower for w in ["talk", "lecture", "artist", "conversation"]):
        return "art", "talk", tags + ["talk"]
    if any(w in title_lower for w in ["workshop", "class"]):
        return "art", "workshop", tags + ["workshop"]
    if any(w in title_lower for w in ["film", "screening", "movie"]):
        return "film", None, tags + ["film"]
    if any(w in title_lower for w in ["music", "performance", "concert"]):
        return "music", "performance", tags + ["performance"]
    return "art", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Contemporary events using Playwright."""
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

            logger.info(f"Fetching Atlanta Contemporary: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
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

            # Parse events - look for date patterns
            i = 0
            while i < len(lines):
                line = lines[i]

                # Skip navigation/header items
                skip_items = [
                    "menu", "visit", "exhibitions", "events", "support", "about",
                    "contact", "search", "hours", "admission", "shop", "donate",
                    "membership", "calendar", "free admission"
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
                        title, "Atlanta Contemporary", start_date
                    )

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        continue

                    category, subcategory, tags = determine_category(title)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": "Event at Atlanta Contemporary - free admission",
                        "start_date": start_date,
                        "start_time": start_time if start_time else "12:00",
                        "end_date": None,
                        "end_time": "17:00" if not start_time else None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Free admission",
                        "is_free": True,
                        "source_url": EVENTS_URL,
                        "ticket_url": EVENTS_URL,
                        "image_url": image_map.get(title),
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
            f"Atlanta Contemporary crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Contemporary: {e}")
        raise

    return events_found, events_new, events_updated
