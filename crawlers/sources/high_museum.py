"""
Crawler for High Museum of Art (high.org/events).
Atlanta's premier art museum in Midtown.

Site uses JavaScript rendering - must use Playwright.
Format: Date (January 18), Event Type, Title, Time (12:30-2:30 p.m.), Description
Also handles: Daily, Weekly, and Ongoing programs
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

BASE_URL = "https://high.org"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "High Museum of Art",
    "slug": "high-museum",
    "address": "1280 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "museum",
    "website": BASE_URL,
}

# Known event type categories
EVENT_TYPES = {
    "tour",
    "art making",
    "studio classes",
    "young children",
    "teens",
    "culture collective",
    "friday nights",
    "art conversations",
    "wine & dine",
    "member exclusive",
    "family programs",
    "special event",
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from formats like 'January 18', 'Daily', 'Weekly', 'Ongoing'.
    Returns YYYY-MM-DD or None for recurring events.
    """
    date_text = date_text.strip()
    now = datetime.now()
    year = now.year

    # Handle recurring markers
    if date_text.lower() in ["daily", "weekly", "ongoing"]:
        return None

    # Try "January 18" format
    try:
        dt = datetime.strptime(date_text, "%B %d")
        dt = dt.replace(year=year)
        if dt < now:
            dt = dt.replace(year=year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Try "Jan 18" format
    try:
        dt = datetime.strptime(date_text, "%b %d")
        dt = dt.replace(year=year)
        if dt < now:
            dt = dt.replace(year=year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '12:30–2:30 p.m.' or '1 p.m.' to HH:MM."""
    if not time_text:
        return None

    time_text = time_text.strip().lower()

    # Look for start time pattern (first time in range)
    # Handles: "1–2 p.m.", "12:30–2:30 p.m.", "10 a.m.–3 p.m.", "1:30–4 p.m."
    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?\s*(?:–|-|—)?\s*(?:\d{1,2}(?::\d{2})?)?\s*(a\.?m\.?|p\.?m\.?)",
        time_text,
    )
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).replace(".", "")

        if "p" in period and hour != 12:
            hour += 12
        elif "a" in period and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def determine_category(
    title: str, event_type: str
) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and type."""
    title_lower = title.lower()
    type_lower = event_type.lower() if event_type else ""
    tags = ["art", "museum", "high-museum", "midtown"]

    if "toddler" in title_lower or "young children" in type_lower:
        return "family", "kids", tags + ["family", "kids", "toddler"]
    if any(w in title_lower for w in ["teens", "teen"]) or "teens" in type_lower:
        return "community", "teens", tags + ["teens"]
    if "friday night" in type_lower or "friday night" in title_lower:
        return "nightlife", "museum", tags + ["adults", "nightlife"]
    if "tour" in type_lower or "tour" in title_lower:
        return "art", "tour", tags + ["tour"]
    if any(w in type_lower for w in ["studio", "art making", "workshop"]):
        return "art", "workshop", tags + ["workshop", "class"]
    if "wine" in type_lower or "wine" in title_lower:
        return "food_drink", "wine", tags + ["wine", "adults"]
    if any(w in title_lower for w in ["jazz", "music", "concert"]):
        return "music", None, tags + ["music"]
    if "film" in title_lower or "screening" in title_lower:
        return "film", None, tags + ["film"]

    return "art", "museum", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl High Museum events using Playwright."""
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

            logger.info(f"Fetching High Museum: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Get page text
            body_text = page.inner_text("body")
            lines = [line.strip() for line in body_text.split("\n") if line.strip()]

            # Skip navigation items
            skip_items = [
                "skip to main",
                "skip to footer",
                "visit",
                "visit us",
                "plan your visit",
                "buy tickets",
                "become a member",
                "what to do",
                "events",
                "events calendar",
                "art",
                "give",
                "login",
                "order history",
                "all events",
                "our events",
                "select date",
                "filter events",
                "apply filters",
                "for adults",
                "for educators",
                "for families and kids",
                "for teens",
                "motivation",
                "free admission",
                "member exclusive",
                "clear filters",
                "view",
                "sold out",
            ]

            i = 0
            seen_events = set()
            current_date = None
            current_type = None
            is_recurring = False

            while i < len(lines):
                line = lines[i]
                line_lower = line.lower()

                # Skip nav/UI items
                if line_lower in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Check for date heading (January 18, Daily, Weekly, Ongoing)
                # These appear as standalone lines
                date_match = re.match(
                    r"^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}$",
                    line,
                    re.IGNORECASE,
                )
                if date_match or line_lower in ["daily", "weekly", "ongoing"]:
                    current_date = parse_date(line)
                    is_recurring = line_lower in ["daily", "weekly", "ongoing"]
                    if is_recurring:
                        # For recurring events, use today as the start date
                        current_date = datetime.now().strftime("%Y-%m-%d")
                    i += 1
                    continue

                # Check for event type (Tour, Art Making, Studio Classes, etc.)
                if line_lower in EVENT_TYPES or any(
                    et in line_lower for et in EVENT_TYPES
                ):
                    current_type = line
                    i += 1
                    continue

                # Check for time pattern (indicates we're at an event entry)
                # Times look like: "1–2 p.m.", "12:30–2:30 p.m.", "10 a.m.–3 p.m."
                time_match = re.search(
                    r"\d{1,2}(?::\d{2})?\s*(?:–|-|—)\s*\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)",
                    line,
                    re.IGNORECASE,
                )
                if time_match:
                    # This line is a time - title should be previous line
                    if i > 0 and current_date:
                        title = lines[i - 1].strip()

                        # Skip if title looks like navigation or date header
                        if title.lower() in skip_items:
                            i += 1
                            continue

                        # Skip if title is a date header (Daily, Weekly, etc.)
                        if title.lower() in ["daily", "weekly", "ongoing"]:
                            i += 1
                            continue

                        # Skip "SOLD OUT" as title - look one more back
                        if title.upper() == "SOLD OUT" and i > 1:
                            title = lines[i - 2].strip()

                        # Skip if title is an event type (Tour, Art Making, etc.)
                        if title.lower() in EVENT_TYPES or title.lower() in ["tour"]:
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
                            title, "High Museum of Art", current_date
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
                            "is_all_day": start_time is None,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Museum admission may be required",
                            "is_free": False,
                            "source_url": EVENTS_URL,
                            "ticket_url": EVENTS_URL,
                            "image_url": image_map.get(title),
                            "raw_text": (
                                f"{current_type}: {title}" if current_type else title
                            ),
                            "extraction_confidence": 0.85,
                            "is_recurring": is_recurring,
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

            browser.close()

        logger.info(
            f"High Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl High Museum: {e}")
        raise

    return events_found, events_new, events_updated
