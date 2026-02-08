"""
Crawler for All Star Monster Truck Tour (allstarmonster.com).
Touring monster truck show that visits various venues nationwide.

Site uses Wix Studio - must use Playwright for JavaScript rendering.
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

BASE_URL = "https://www.allstarmonster.com"
EVENTS_URL = f"{BASE_URL}/events"

# Jim R. Miller Park - where they perform in the Atlanta area
VENUE_DATA = {
    "name": "Jim R. Miller Park",
    "slug": "jim-r-miller-park",
    "address": "2245 Callaway Rd SW",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30008",
    "lat": 33.9271,
    "lng": -84.5868,
    "venue_type": "event_space",
    "website": "https://www.cobbcounty.org",
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date strings from the events page.

    Examples:
    - "February 6-8, 2026"
    - "Feb 6, 2026"
    - "2/6/2026"

    Returns:
        Date in YYYY-MM-DD format, or None if not parseable
    """
    date_text = date_text.strip()
    current_year = datetime.now().year

    # Pattern 1: "Month Day, Year" or "Month Day-Day, Year"
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:-\d{1,2})?,?\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        month, day, year = match.groups()
        try:
            # Handle abbreviated month names
            month_abbr = month[:3] if len(month) > 3 else month
            dt = datetime.strptime(f"{month_abbr} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern 2: "MM/DD/YYYY"
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern 3: "Month Day" (no year)
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})",
        date_text,
        re.IGNORECASE
    )
    if match:
        month, day = match.groups()
        year = current_year
        try:
            month_abbr = month[:3] if len(month) > 3 else month
            dt = datetime.strptime(f"{month_abbr} {day} {year}", "%b %d %Y")
            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def is_georgia_event(location_text: str) -> bool:
    """
    Check if the event is in Georgia or Atlanta area.

    Args:
        location_text: Text containing location info (city, state, venue)

    Returns:
        True if event is in Georgia or nearby Atlanta area
    """
    location_lower = location_text.lower()

    # Georgia keywords - check for " ga" or " ga," to avoid matching "garage"
    if " ga" in location_lower or "georgia" in location_lower:
        return True

    # Specific Georgia cities
    georgia_cities = ["atlanta", "marietta", "savannah", "winder", "augusta", "macon", "columbus"]
    if any(city in location_lower for city in georgia_cities):
        return True

    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl All Star Monster Truck Tour events using Playwright."""
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

            # We'll create venue records dynamically per event
            # Keep VENUE_DATA as default for Jim R. Miller Park

            logger.info(f"Fetching All Star Monster Truck Tour: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)

            # Wait for Wix to render
            page.wait_for_timeout(5000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Get the full page text
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse events in triplet structure: City/State, Date, Venue
            # Structure is: City State, Date, Venue Name
            i = 0
            while i < len(lines) - 2:
                # Check if this looks like a city/state line
                city_state_line = lines[i]

                # Skip navigation and common non-event lines
                if city_state_line.lower() in ["home", "events", "faqs", "contact", "media", "skip to main content"]:
                    i += 1
                    continue

                # Look for pattern like "City ST" or "City State"
                if not re.search(r"^[A-Za-z\s]+ (GA|TN|NC|SC|AL|FL)", city_state_line):
                    i += 1
                    continue

                # Next line should be a date
                date_line = lines[i + 1] if i + 1 < len(lines) else None
                venue_line = lines[i + 2] if i + 2 < len(lines) else None

                if not date_line or not venue_line:
                    i += 1
                    continue

                # Try to parse the date
                parsed_date = parse_date(date_line)
                if not parsed_date:
                    i += 1
                    continue

                # Check if this is a Georgia event
                if not is_georgia_event(city_state_line):
                    i += 3  # Skip to next triplet
                    continue

                events_found += 1

                # Use the default title
                title = "All Star Monster Truck Tour"

                # Extract city and state for venue creation
                city_state_match = re.match(r"^(.+?)\s+(GA|TN|NC|SC|AL|FL)$", city_state_line)
                if city_state_match:
                    city = city_state_match.group(1).strip()
                    state = city_state_match.group(2)
                else:
                    city = city_state_line
                    state = "GA"

                # Create venue data dynamically
                venue_data = {
                    "name": venue_line,
                    "slug": re.sub(r'[^\w\s-]', '', venue_line.lower()).replace(' ', '-').strip('-'),
                    "city": city,
                    "state": state,
                    "venue_type": "event_space",
                }

                # Get or create venue
                current_venue_id = get_or_create_venue(venue_data)

                # Generate content hash
                content_hash = generate_content_hash(
                    title,
                    venue_line,
                    parsed_date
                )

                # Check for existing event
                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    i += 3  # Skip to next triplet
                    continue

                # Build event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": current_venue_id,
                    "title": title,
                    "description": f"All Star Monster Truck Tour featuring monster truck racing, stunts, and entertainment at {venue_line}, {city_state_line}.",
                    "start_date": parsed_date,
                    "start_time": "19:00",  # Typical evening show time
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "sports",
                    "subcategory": "monster_trucks",
                    "tags": [
                        "monster-trucks",
                        "motorsports",
                        "all-star-monster-trucks",
                        "family",
                        "marietta",
                    ],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Ticket prices vary",
                    "is_free": False,
                    "source_url": EVENTS_URL,
                    "ticket_url": EVENTS_URL,
                    "image_url": None,
                    "raw_text": f"{city_state_line} - {date_line} - {venue_line}",
                    "extraction_confidence": 0.85,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {parsed_date} at {venue_line}, {city_state_line}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title} on {parsed_date}: {e}")

                # Move to next triplet
                i += 3

            browser.close()

        logger.info(
            f"All Star Monster Truck Tour crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl All Star Monster Truck Tour: {e}")
        raise

    return events_found, events_new, events_updated
