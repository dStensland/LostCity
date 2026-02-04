"""
Crawler for Museum of Design Atlanta (MODA).
Atlanta's only museum dedicated to design - Midtown.

Site structure: Text-based event listings with FEB/3/Title/Date/Description format.
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

BASE_URL = "https://www.museumofdesign.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Museum of Design Atlanta (MODA)",
    "slug": "moda",
    "address": "1315 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "museum",
    "website": BASE_URL,
}

MONTHS = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12
}


def parse_date_from_parts(month_abbr: str, day: int, year: int = None) -> Optional[str]:
    """Parse date from month abbreviation and day number."""
    month = MONTHS.get(month_abbr.upper())
    if not month:
        return None

    now = datetime.now()
    year = year or now.year

    try:
        dt = datetime(year, month, day)
        # If date is in the past, assume next year
        if dt < now and year == now.year:
            dt = datetime(year + 1, month, day)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def determine_category(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and description."""
    title_lower = title.lower()
    desc_lower = (description or "").lower()
    combined = f"{title_lower} {desc_lower}"
    tags = ["design", "museum", "moda", "midtown"]

    if any(w in combined for w in ["lego", "kids", "children", "ages 6", "ages 8", "family", "youth"]):
        return "family", "workshop", tags + ["family", "kids", "workshop"]
    if any(w in combined for w in ["wine", "cocktail", "happy hour"]):
        return "food_drink", "tasting", tags + ["adults", "wine"]
    if any(w in combined for w in ["book club", "reading"]):
        return "learning", "book", tags + ["book-club"]
    if any(w in combined for w in ["camp", "summer"]):
        return "family", "camp", tags + ["camp", "kids"]
    if any(w in combined for w in ["workshop", "studio", "class", "make", "stitch"]):
        return "art", "workshop", tags + ["workshop", "class"]
    if any(w in combined for w in ["tour", "docent"]):
        return "art", "tour", tags + ["tour"]
    if any(w in combined for w in ["conversation", "lecture", "talk"]):
        return "learning", "lecture", tags + ["lecture"]
    if any(w in combined for w in ["teen", "9th", "10th", "11th", "12th", "grade"]):
        return "family", "teens", tags + ["teens"]

    return "art", "museum", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl MODA events using Playwright."""
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

            logger.info(f"Fetching MODA: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Get body text and parse events
            body_text = page.inner_text('body')
            lines = [l.strip() for l in body_text.split('\n') if l.strip()]

            # Pattern: MONTH_ABBR / DAY / TITLE / Full_Date / Location_Info / Description
            i = 0
            seen_events = set()

            while i < len(lines) - 3:
                line = lines[i]

                # Check for month abbreviation (JAN, FEB, etc.)
                if line.upper() in MONTHS:
                    month_abbr = line.upper()

                    # Next line should be day number
                    if i + 1 < len(lines) and lines[i + 1].isdigit():
                        day = int(lines[i + 1])

                        # Next line should be title
                        if i + 2 < len(lines):
                            title = lines[i + 2]

                            # Skip if title looks like navigation
                            if title.lower() in ['all events', 'adult events', 'youth events', 'events calendar']:
                                i += 1
                                continue

                            # Next should be full date like "Feb 3, 2026"
                            full_date_line = lines[i + 3] if i + 3 < len(lines) else ""

                            # Parse the date
                            start_date = parse_date_from_parts(month_abbr, day)
                            if not start_date:
                                i += 1
                                continue

                            # Gather location, time, and description from subsequent lines
                            location_info = ""
                            description = ""
                            start_time = None

                            j = i + 3
                            while j < len(lines) and j < i + 8:
                                next_line = lines[j]
                                # Stop if we hit another month abbreviation
                                if next_line.upper() in MONTHS:
                                    break
                                # Try to extract time
                                if not start_time:
                                    time_match = re.search(
                                        r'(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))',
                                        next_line
                                    )
                                    if time_match:
                                        raw = time_match.group(1).strip().lower()
                                        # Parse to HH:MM
                                        t = re.match(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)', raw)
                                        if t:
                                            h = int(t.group(1))
                                            m = int(t.group(2)) if t.group(2) else 0
                                            if t.group(3) == 'pm' and h != 12:
                                                h += 12
                                            elif t.group(3) == 'am' and h == 12:
                                                h = 0
                                            start_time = f"{h:02d}:{m:02d}"
                                if "In-person" in next_line or "Virtual" in next_line or "Ages" in next_line:
                                    location_info = next_line
                                elif len(next_line) > 30 and not description:
                                    description = next_line[:500]
                                j += 1

                            # Skip duplicates
                            event_key = f"{title}|{start_date}"
                            if event_key in seen_events:
                                i += 1
                                continue
                            seen_events.add(event_key)

                            events_found += 1

                            # Generate content hash
                            content_hash = generate_content_hash(
                                title, "Museum of Design Atlanta", start_date
                            )

                            # Check for existing
                            existing = find_event_by_hash(content_hash)
                            if existing:
                                events_updated += 1
                                i += 1
                                continue

                            # Determine category
                            full_text = f"{title} {location_info} {description}"
                            category, subcategory, tags = determine_category(title, full_text)

                            # Check if virtual
                            is_virtual = "virtual" in location_info.lower()

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id if not is_virtual else None,
                                "title": title,
                                "description": description if description else location_info,
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
                                "price_note": "Check MODA website for pricing",
                                "is_free": False,
                                "source_url": EVENTS_URL,
                                "ticket_url": EVENTS_URL,
                                "image_url": image_map.get(title),
                                "raw_text": f"{title}\n{location_info}\n{description}"[:500],
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
            f"MODA crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl MODA: {e}")
        raise

    return events_found, events_new, events_updated
