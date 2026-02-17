"""
Crawler for Atlanta History Center (atlantahistorycenter.com).
33-acre museum campus with historical exhibitions and events.

Site uses JavaScript rendering - must use Playwright.
Format: Category, Title, Optional subtitle, Weekday, Month DD @ Time
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantahistorycenter.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Atlanta History Center",
    "slug": "atlanta-history-center",
    "address": "130 W Paces Ferry Rd NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8422,
    "lng": -84.3864,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
}

# Event categories from the site
EVENT_CATEGORIES = [
    "family events",
    "author talks",
    "lecture",
    "education",
    "after hours",
    "for members",
    "genealogy programs",
    "gardens",
    "public programs",
    "virtual event",
]

# Navigation/UI items to skip
SKIP_ITEMS = [
    "visit", "experience", "learning & research", "support", "tickets",
    "open search", "search our collections", "programs & events",
    "events calendar", "types", "main campus", "margaret mitchell house",
    "all topics", "atlanta - city", "culture and society",
    "sports and entertainment", "health and education", "black history",
    "government and civic affairs", "genealogy", "military",
    "georgia - rural and coastal", "science and horticulture", "reset",
    "past events", "stories and experiences", "sign up for weekly",
    "join the list", "about us", "support ahc", "in the news",
    "ok", "skip to main content", "we use cookies",
]


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7pm' or '10am' or '10:30am' format."""
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) or "00"
        period = match.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def parse_date_line(line: str) -> Optional[dict]:
    """
    Parse date line like 'Monday, Jan 19 @ 10am - 4pm' or 'Wednesday, Jan 21 @ 7pm'.
    Returns dict with start_date, start_time, end_time or None.
    """
    # Pattern: Weekday, Month DD @ Time
    pattern = r"(\w+),\s+(\w{3})\s+(\d{1,2})\s+@\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))"
    match = re.match(pattern, line, re.IGNORECASE)
    if not match:
        return None

    day_name, month_abbr, day, time_str = match.groups()

    # Parse date
    current_year = datetime.now().year
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    try:
        dt = datetime.strptime(f"{month_abbr} {day} {current_year}", "%b %d %Y")
        # If date is in the past (before today), assume next year
        if dt < today:
            dt = datetime.strptime(f"{month_abbr} {day} {current_year + 1}", "%b %d %Y")
        start_date = dt.strftime("%Y-%m-%d")
    except ValueError:
        return None

    start_time = parse_time(time_str)

    # Check for end time (after " - ")
    end_time = None
    end_match = re.search(r"-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))", line, re.IGNORECASE)
    if end_match:
        end_time = parse_time(end_match.group(1))

    return {
        "start_date": start_date,
        "start_time": start_time,
        "end_time": end_time,
    }


def determine_category(event_type: str, title: str, raw_text: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event type and title."""
    type_lower = event_type.lower() if event_type else ""
    title_lower = title.lower()
    text_lower = raw_text.lower()
    tags = ["atlanta-history-center", "museum", "history", "buckhead"]

    if "author" in type_lower:
        return "community", "books", tags + ["author-talk", "books", "reading"]
    if "lecture" in type_lower:
        return "community", "education", tags + ["lecture", "education"]
    if "after hours" in type_lower or "history on the rocks" in title_lower:
        return "nightlife", "social", tags + ["21+", "adults-only"]
    if "family" in type_lower:
        return "family", None, tags + ["family-friendly", "kids"]
    if "education" in type_lower or "homeschool" in title_lower or "storytime" in title_lower:
        return "family", "kids", tags + ["education", "kids"]
    if "genealogy" in type_lower:
        return "community", "education", tags + ["genealogy", "research"]
    if "for members" in type_lower:
        return "community", "members", tags + ["members-only"]
    if "gardens" in type_lower:
        return "community", "nature", tags + ["gardens", "outdoor"]

    return "museums", "museum", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta History Center events using Playwright."""
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

            logger.info(f"Fetching Atlanta History Center: {EVENTS_URL}")
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

            # Get page text
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            browser.close()

            i = 0
            seen_events = set()
            current_category = None

            while i < len(lines):
                line = lines[i]
                line_lower = line.lower()

                # Skip navigation/UI items
                if line_lower in SKIP_ITEMS or len(line) < 3:
                    i += 1
                    continue

                # Check if this is a category marker
                if line_lower in EVENT_CATEGORIES:
                    current_category = line
                    i += 1
                    continue

                # Look for date pattern
                date_info = parse_date_line(line)
                if date_info:
                    # We found a date line, look backwards to find title
                    # The structure is: Category, Title, [Subtitle], Date
                    # So we look back 1-3 lines for title

                    title = None
                    subtitle = None
                    found_category = current_category

                    # Look back for title (skip subtitle and category if present)
                    for lookback in range(1, 4):
                        if i - lookback < 0:
                            break
                        prev_line = lines[i - lookback]
                        prev_lower = prev_line.lower()

                        # Skip if it's a skip item
                        if prev_lower in SKIP_ITEMS:
                            continue

                        # Skip if it's a category (but capture it)
                        if prev_lower in EVENT_CATEGORIES:
                            found_category = prev_line
                            continue

                        # Skip metadata lines like "Onsite | Free with RSVP | Family-Friendly"
                        if "|" in prev_line and any(
                            kw in prev_lower
                            for kw in ["onsite", "free", "ticketed", "rsvp", "friendly", "21+", "members"]
                        ):
                            continue

                        # Skip if it looks like an author subtitle
                        if prev_line.startswith('Author of "') or prev_line.startswith("Author of '"):
                            subtitle = prev_line
                            continue

                        # Skip bracketed items like "[SOLD OUT]"
                        if prev_line.startswith("[") and prev_line.endswith("]"):
                            continue

                        # This should be the title
                        title = prev_line
                        break

                    if not title:
                        i += 1
                        continue

                    # Clean up title - remove [SOLD OUT] prefix if present
                    title = re.sub(r"^\[SOLD OUT\]\s*", "", title).strip()
                    if not title or len(title) < 3:
                        i += 1
                        continue

                    start_date = date_info["start_date"]
                    start_time = date_info["start_time"]
                    end_time = date_info["end_time"]

                    # Check for duplicates
                    event_key = f"{title}|{start_date}|{start_time}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Atlanta History Center", start_date
                    )

                    # Check for existing

                    # Build description from subtitle
                    description = subtitle if subtitle else None

                    # Check if free
                    raw_text = f"{found_category or ''} {title} {subtitle or ''} {line}"
                    is_free = "free" in raw_text.lower()

                    # Determine category
                    category, subcategory, tags = determine_category(
                        found_category, title, raw_text
                    )

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
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": raw_text[:500],
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        i += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

        logger.info(
            f"Atlanta History Center crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta History Center: {e}")
        raise

    return events_found, events_new, events_updated
