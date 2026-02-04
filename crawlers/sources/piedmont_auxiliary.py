"""
Crawler for Piedmont Atlanta Hospital Auxiliary (pahauxiliary.org/calendar).

Events include book clubs, cocktail parties, volunteer events, and meetings.
Site uses Squarespace - can be scraped with Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, get_portal_id_by_slug
from dedupe import generate_content_hash
from utils import extract_images_from_page

# Portal ID for Piedmont-exclusive events
PORTAL_SLUG = "piedmont"

logger = logging.getLogger(__name__)

BASE_URL = "https://www.pahauxiliary.org"
CALENDAR_URL = f"{BASE_URL}/calendar"

VENUE_DATA = {
    "name": "Piedmont Atlanta Hospital Auxiliary",
    "slug": "piedmont-atlanta-auxiliary",
    "address": "1968 Peachtree Road NW, Suite 180, Building 35",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "hospital",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from formats like 'March 11, 2026' or 'January 14, 2026'.
    """
    date_text = date_text.strip()

    # Try "Month DD, YYYY" format
    patterns = [
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, date_text, re.IGNORECASE)
        if match:
            month, day, year = match.groups()
            try:
                month_str = month[:3] if len(month) > 3 else month
                dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '10:30 AM' or '4:30 PM' to HH:MM."""
    if not time_text:
        return None

    time_text = time_text.strip().upper()

    # Match "10:30 AM", "4:30 PM", "1:00 PM"
    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    return None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title."""
    title_lower = title.lower()
    base_tags = ["piedmont", "hospital", "healthcare", "auxiliary", "buckhead"]

    if "book club" in title_lower:
        return "community", "book-club", base_tags + ["book-club", "reading"]
    if "cocktail" in title_lower or "party" in title_lower or "brunch" in title_lower:
        return "food_drink", "social", base_tags + ["social", "networking"]
    if "meeting" in title_lower or "board" in title_lower:
        return "community", "meeting", base_tags + ["meeting", "volunteer"]
    if "volunteer" in title_lower:
        return "community", "volunteer", base_tags + ["volunteer"]
    if "tree lighting" in title_lower or "deck the halls" in title_lower:
        return "community", "holiday", base_tags + ["holiday", "family"]
    if "luncheon" in title_lower:
        return "food_drink", "luncheon", base_tags + ["lunch", "social"]

    return "community", None, base_tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Piedmont Auxiliary calendar using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Get portal ID for Piedmont-exclusive events
    portal_id = get_portal_id_by_slug(PORTAL_SLUG)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Piedmont Auxiliary: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text
            body_text = page.inner_text("body")
            lines = [line.strip() for line in body_text.split("\n") if line.strip()]

            # Skip navigation items
            skip_items = [
                "home", "about", "calendar", "volunteer", "donate", "contact",
                "blog", "menu", "search", "piedmont atlanta hospital auxiliary",
                "join us", "learn more", "read more", "view all",
            ]

            i = 0
            seen_events = set()

            while i < len(lines):
                line = lines[i]
                line_lower = line.lower()

                # Skip nav/UI items
                if line_lower in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Look for date patterns (Month DD, YYYY)
                date_match = re.search(
                    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    start_date = parse_date(line)
                    if not start_date:
                        i += 1
                        continue

                    # Check if date is in the past
                    try:
                        event_date = datetime.strptime(start_date, "%Y-%m-%d")
                        if event_date.date() < datetime.now().date():
                            i += 1
                            continue
                    except ValueError:
                        i += 1
                        continue

                    # Look for title and time in surrounding lines
                    title = None
                    start_time = None
                    description = None

                    # Check previous lines for title
                    for offset in range(-3, 0):
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx].strip()
                            if check_line.lower() in skip_items:
                                continue
                            if len(check_line) > 5 and len(check_line) < 100:
                                # Skip if it looks like a date or time
                                if not re.search(r"\d{4}|AM|PM|\d{1,2}:\d{2}", check_line, re.IGNORECASE):
                                    title = check_line
                                    break

                    # Check following lines for time and description
                    for offset in range(1, 5):
                        idx = i + offset
                        if idx < len(lines):
                            check_line = lines[idx].strip()

                            # Look for time
                            if not start_time:
                                time_match = re.search(r"(\d{1,2}:\d{2}\s*(?:AM|PM))", check_line, re.IGNORECASE)
                                if time_match:
                                    start_time = parse_time(time_match.group(1))
                                    continue

                            # Look for description
                            if not description and len(check_line) > 20:
                                if check_line.lower() not in skip_items:
                                    description = check_line[:500]

                    if not title:
                        i += 1
                        continue

                    # Dedupe
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    content_hash = generate_content_hash(
                        title, "Piedmont Atlanta Hospital Auxiliary", start_date
                    )

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        continue

                    category, subcategory, tags = determine_category(title)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "portal_id": portal_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Free for auxiliary members",
                        "is_free": True,
                        "source_url": CALENDAR_URL,
                        "ticket_url": CALENDAR_URL,
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
            f"Piedmont Auxiliary crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Piedmont Auxiliary: {e}")
        raise

    return events_found, events_new, events_updated
