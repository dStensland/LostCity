"""
Crawler for Center Stage Atlanta (centerstage-atlanta.com).
Historic Midtown concert venue complex including Center Stage, The Loft, and Vinyl.

Site uses JavaScript rendering - must use Playwright.
Format: VENUE, DAY MON DD [|SUFFIX], TITLE, [Presented by...], Age restriction, Times
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

BASE_URL = "https://www.centerstage-atlanta.com"

# Venue configurations for the Center Stage complex
VENUE_DATA = {
    "CENTER STAGE": {
        "name": "Center Stage",
        "slug": "center-stage-atlanta",
        "address": "1374 W Peachtree St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7908,
        "lng": -84.3880,
        "venue_type": "music_venue",
        "spot_type": "music_venue",
        "website": BASE_URL,
    },
    "THE LOFT": {
        "name": "The Loft",
        "slug": "the-loft-atlanta",
        "address": "1374 W Peachtree St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7908,
        "lng": -84.3880,
        "venue_type": "music_venue",
        "spot_type": "music_venue",
        "website": BASE_URL,
    },
    "VINYL": {
        "name": "Vinyl",
        "slug": "vinyl-atlanta",
        "address": "1374 W Peachtree St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7908,
        "lng": -84.3880,
        "venue_type": "music_venue",
        "spot_type": "music_venue",
        "website": BASE_URL,
    },
}

# Day name abbreviations
DAY_NAMES = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}

# Month abbreviations to numbers
MONTH_MAP = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from 'Doors 7:00 pm / Show 8:00 pm' format, extracting show time."""
    # Look for "Show X:XX pm" pattern
    match = re.search(r"Show\s+(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if not match:
        # Fall back to any time pattern
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


def parse_date_line(line: str) -> Optional[tuple[str, int, str]]:
    """
    Parse date from format like 'WED JAN 21' or 'SAT JAN 31 |EARLY SHOW'.
    Returns (month_abbr, day, optional_suffix) or None.
    """
    # Remove any suffix after |
    date_part = line.split("|")[0].strip()
    suffix = line.split("|")[1].strip() if "|" in line else None

    # Match pattern: DAY MON DD
    match = re.match(r"([A-Z]{3})\s+([A-Z]{3})\s+(\d{1,2})", date_part, re.IGNORECASE)
    if match:
        day_name, month_abbr, day_num = match.groups()
        if day_name.upper() in DAY_NAMES and month_abbr.upper() in MONTH_MAP:
            return (month_abbr.upper(), int(day_num), suffix)
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Center Stage complex events using Playwright."""
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

            # Cache venue IDs
            venue_ids = {}
            for venue_key, venue_data in VENUE_DATA.items():
                venue_ids[venue_key] = get_or_create_venue(venue_data)

            logger.info(f"Fetching Center Stage: {BASE_URL}")
            page.goto(BASE_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(10):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            browser.close()

        # Valid venue names to look for
        venue_names = set(VENUE_DATA.keys())
        # Also match "ATLANTA SYMPHONY HALL" but map to Center Stage
        venue_names.add("ATLANTA SYMPHONY HALL")

        current_year = datetime.now().year
        seen_events = set()

        i = 0
        while i < len(lines):
            line = lines[i].upper()

            # Skip navigation and non-event content
            skip_patterns = [
                "SKIP TO", "NEWSLETTER", "INSTAGRAM", "FACEBOOK", "TWITTER",
                "ABOUT THE", "FAQS", "VENUE RENTAL", "DIRECTIONS", "CONTACT",
                "FEATURED EVENTS", "UPCOMING SHOWS", "PREVIOUS", "NEXT",
                "BUY TICKETS", "MORE INFO", "ALL CENTER STAGE", "SUBMIT",
            ]
            if any(skip in line for skip in skip_patterns):
                i += 1
                continue

            # Check for venue name line
            venue_key = None
            if line in venue_names:
                venue_key = line
                # Map Symphony Hall to Center Stage
                if venue_key == "ATLANTA SYMPHONY HALL":
                    venue_key = "CENTER STAGE"

            if venue_key and i + 1 < len(lines):
                # Next line should be date
                date_info = parse_date_line(lines[i + 1])

                if date_info:
                    month_abbr, day_num, date_suffix = date_info

                    # Title should be on line i + 2
                    if i + 2 >= len(lines):
                        i += 1
                        continue

                    title = lines[i + 2].strip()

                    # Skip if title looks like nav/UI
                    if title.upper() in venue_names or "BUY TICKETS" in title.upper():
                        i += 1
                        continue

                    # Build the date
                    month_num = MONTH_MAP[month_abbr]
                    year = current_year
                    try:
                        event_date = datetime(year, month_num, day_num)
                        # If date is in the past, use next year
                        if event_date < datetime.now():
                            year += 1
                            event_date = datetime(year, month_num, day_num)
                        start_date = event_date.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    # Look for additional info in subsequent lines
                    presenter = None
                    age_restriction = None
                    start_time = None

                    # Scan next few lines for presenter, age, and time
                    for j in range(3, 7):
                        if i + j >= len(lines):
                            break
                        next_line = lines[i + j]

                        # Stop if we hit another venue or navigation
                        if next_line.upper() in venue_names:
                            break
                        if "BUY TICKETS" in next_line.upper():
                            break

                        # Check for presenter
                        if next_line.lower().startswith("presented by"):
                            presenter = next_line
                        # Check for age restriction
                        elif next_line in ["All Ages", "18+", "21+"]:
                            age_restriction = next_line
                        # Check for time
                        elif "Doors" in next_line or "Show" in next_line:
                            start_time = parse_time(next_line)

                    # Create unique key for deduplication
                    event_key = f"{title}|{start_date}|{venue_key}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Get venue name for hash
                    venue_name = VENUE_DATA.get(venue_key, VENUE_DATA["CENTER STAGE"])["name"]

                    # Generate content hash
                    content_hash = generate_content_hash(title, venue_name, start_date)

                    # Check for existing event
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        continue

                    # Determine category based on title and presenter
                    category = "music"
                    subcategory = "concert"
                    tags = ["live-music", "concert", "midtown"]

                    title_lower = title.lower()
                    if any(w in title_lower for w in ["comedy", "comedian", "stand-up", "stand up"]):
                        category = "comedy"
                        subcategory = None
                        tags = ["comedy", "midtown"]
                    elif any(w in title_lower for w in ["podcast", "had it"]):
                        category = "community"
                        subcategory = "podcast"
                        tags = ["podcast", "midtown"]

                    # Add venue-specific tag
                    if venue_key == "THE LOFT":
                        tags.append("the-loft")
                    elif venue_key == "VINYL":
                        tags.append("vinyl")
                    else:
                        tags.append("center-stage")

                    # Build description
                    description_parts = []
                    if presenter:
                        description_parts.append(presenter)
                    if age_restriction:
                        description_parts.append(age_restriction)
                    if date_suffix:
                        description_parts.append(date_suffix)
                    description = ". ".join(description_parts) if description_parts else None

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_ids.get(venue_key, venue_ids["CENTER STAGE"]),
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
                        "price_note": None,
                        "is_free": False,
                        "source_url": BASE_URL,
                        "ticket_url": BASE_URL,
                        "image_url": None,
                        "raw_text": f"{venue_key} - {lines[i + 1]} - {title}",
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} at {venue_name} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

            i += 1

        logger.info(
            f"Center Stage crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Center Stage: {e}")
        raise

    return events_found, events_new, events_updated
