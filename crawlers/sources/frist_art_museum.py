"""
Crawler for Frist Art Museum (fristartmuseum.org/calendar).
Nashville's premier art museum featuring exhibitions and public programs.

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

BASE_URL = "https://fristartmuseum.org"
CALENDAR_URL = f"{BASE_URL}/calendar"

VENUE_DATA = {
    "name": "Frist Art Museum",
    "slug": "frist-art-museum",
    "address": "919 Broadway",
    "neighborhood": "Downtown",
    "city": "Nashville",
    "state": "TN",
    "zip": "37203",
    "venue_type": "museum",
    "website": BASE_URL,
}

# Known event types
EVENT_TYPES = [
    "art making",
    "family program",
    "gallery talk",
    "lecture",
    "tour",
    "workshop",
    "concert",
    "performance",
    "special event",
]


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from formats like 'February 15', 'Feb 14, 2026'.
    Returns YYYY-MM-DD.
    """
    date_text = date_text.strip()
    current_year = datetime.now().year

    # Try "February 15, 2026" format
    try:
        dt = datetime.strptime(date_text, "%B %d, %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Try "February 15" format
    try:
        dt = datetime.strptime(date_text, "%B %d")
        dt = dt.replace(year=current_year)
        if dt < datetime.now():
            dt = dt.replace(year=current_year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Try "Feb 14" format
    try:
        dt = datetime.strptime(date_text, "%b %d")
        dt = dt.replace(year=current_year)
        if dt < datetime.now():
            dt = dt.replace(year=current_year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '1:30 PM' or '10 AM' to HH:MM."""
    if not time_text:
        return None

    time_text = time_text.strip()

    # Look for time pattern
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).upper()

        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def determine_category(
    title: str, event_type: str
) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and type."""
    title_lower = title.lower()
    type_lower = event_type.lower() if event_type else ""
    tags = ["art", "museum", "frist", "downtown-nashville"]

    if "family" in type_lower or any(w in title_lower for w in ["family", "kids", "children"]):
        return "family", "kids", tags + ["family", "kids"]
    if "tour" in type_lower or "tour" in title_lower:
        return "art", "tour", tags + ["tour"]
    if any(w in type_lower for w in ["art making", "workshop"]):
        return "art", "workshop", tags + ["workshop", "class"]
    if "lecture" in type_lower or "talk" in type_lower:
        return "community", "education", tags + ["lecture", "education"]
    if any(w in title_lower for w in ["music", "concert", "jazz"]):
        return "music", None, tags + ["music"]
    if "film" in title_lower or "screening" in title_lower:
        return "film", None, tags + ["film"]

    return "art", "museum", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Frist Art Museum events using Playwright."""
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

            logger.info(f"Fetching Frist Art Museum: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Skip navigation items
            skip_items = [
                "skip to content", "visit", "exhibitions", "calendar", "shop",
                "support", "about", "buy tickets", "become a member", "plan your visit",
                "all events", "filter events", "view", "frist art museum",
                "downtown", "free admission", "member exclusive",
            ]

            browser.close()

            i = 0
            seen_events = set()
            current_date = None
            current_type = None

            while i < len(lines):
                line = lines[i]
                line_lower = line.lower()

                # Skip nav/UI items
                if line_lower in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Check for date heading
                date_match = re.match(
                    r"^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}",
                    line,
                    re.IGNORECASE
                )
                if date_match:
                    current_date = parse_date(line)
                    i += 1
                    continue

                # Check for event type
                if any(et in line_lower for et in EVENT_TYPES):
                    current_type = line
                    i += 1
                    continue

                # Check for time pattern (indicates event entry)
                time_match = re.search(
                    r"\d{1,2}(?::\d{2})?\s*(?:AM|PM)",
                    line,
                    re.IGNORECASE
                )
                if time_match and current_date:
                    # This line is a time - title should be previous line
                    if i > 0:
                        title = lines[i - 1].strip()

                        # Skip if title looks like navigation
                        if title.lower() in skip_items:
                            i += 1
                            continue

                        # Parse time
                        start_time = parse_time(line)

                        # Look ahead for description
                        description = None
                        if i + 1 < len(lines):
                            next_line = lines[i + 1].strip()
                            if (
                                next_line.lower() not in skip_items
                                and len(next_line) > 30
                            ):
                                description = next_line[:500]

                        # Check for duplicates
                        event_key = f"{title}|{current_date}|{start_time}"
                        if event_key in seen_events:
                            i += 1
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, "Frist Art Museum", current_date
                        )

                        # Check for existing
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            i += 1
                            continue

                        # Determine category
                        category, subcategory, tags = determine_category(
                            title, current_type
                        )

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": current_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Museum admission may be required",
                            "is_free": False,
                            "source_url": CALENDAR_URL,
                            "ticket_url": CALENDAR_URL,
                            "image_url": image_map.get(title),
                            "raw_text": (
                                f"{current_type}: {title}" if current_type else title
                            ),
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {current_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                i += 1

        logger.info(
            f"Frist Art Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Frist Art Museum: {e}")
        raise

    return events_found, events_new, events_updated
