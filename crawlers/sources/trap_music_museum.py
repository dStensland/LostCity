"""
Crawler for Trap Music Museum (trapmusicmuseum.com).
Interactive museum and cultural attraction in Atlanta's West Side.

Site uses Squarespace - BeautifulSoup with requests should work for basic content.
Special events are featured on the homepage.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://trapmusicmuseum.com"

VENUE_DATA = {
    "name": "Trap Music Museum",
    "slug": "trap-music-museum",
    "address": "630 Travis St NW",
    "neighborhood": "English Avenue",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7701,
    "lng": -84.4189,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    current_year = datetime.now().year

    # Try "December 31, 2026" or "Dec 31, 2026"
    patterns = [
        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?",
        r"(\d{1,2})/(\d{1,2})/(\d{2,4})",  # MM/DD/YYYY or MM/DD/YY
    ]

    for pattern in patterns:
        match = re.search(pattern, date_text, re.IGNORECASE)
        if match:
            groups = match.groups()

            if "/" in pattern:
                # MM/DD/YYYY format
                month, day, year = groups
                year = year if len(year) == 4 else f"20{year}"
            else:
                # Month Day, Year format
                month, day, year = groups
                year = year or str(current_year)

                # Convert month name to number
                month_map = {
                    "january": 1, "jan": 1, "february": 2, "feb": 2,
                    "march": 3, "mar": 3, "april": 4, "apr": 4,
                    "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
                    "august": 8, "aug": 8, "september": 9, "sep": 9,
                    "october": 10, "oct": 10, "november": 11, "nov": 11,
                    "december": 12, "dec": 12
                }
                month = month_map.get(month.lower(), 1)

            try:
                dt = datetime(int(year), int(month), int(day))
                # If date is in the past, assume next year
                if dt.date() < datetime.now().date():
                    dt = datetime(dt.year + 1, dt.month, dt.day)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7PM' format."""
    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)", time_text)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        minute = minute or "00"
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Trap Music Museum for special events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    }

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Check main page for featured events
        logger.info(f"Fetching Trap Music Museum: {BASE_URL}")
        response = requests.get(BASE_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Look for event-related content in various common patterns
        # Squarespace sites often use specific class patterns
        event_containers = []

        # Try various selectors that might contain events
        selectors = [
            ".eventlist-event",
            ".summary-item",
            "[data-type='event']",
            ".blog-item",
            ".collection-item",
        ]

        for selector in selectors:
            event_containers.extend(soup.select(selector))

        # Also scan page text for event announcements
        page_text = soup.get_text(separator="\n")
        lines = [l.strip() for l in page_text.split("\n") if l.strip()]

        # Look for patterns that indicate events
        event_keywords = [
            "comedy show", "concert", "live performance", "special event",
            "new year", "halloween", "valentine", "party", "celebration",
            "live music", "dj", "performance"
        ]

        i = 0
        while i < len(lines):
            line = lines[i].lower()

            # Check if this line mentions an event
            is_event_line = any(keyword in line for keyword in event_keywords)

            if is_event_line:
                # Look for date in surrounding lines
                title = lines[i]
                start_date = None
                start_time = None

                # Search nearby lines for date/time info
                for j in range(max(0, i - 3), min(len(lines), i + 5)):
                    if not start_date:
                        start_date = parse_date(lines[j])
                    if not start_time:
                        start_time = parse_time(lines[j])

                if title and start_date:
                    events_found += 1

                    content_hash = generate_content_hash(
                        title, "Trap Music Museum", start_date
                    )


                    # Try to find an image
                    image_url = None
                    img_tags = soup.find_all("img")
                    for img in img_tags:
                        src = img.get("src", "") or img.get("data-src", "")
                        if src and "logo" not in src.lower() and "icon" not in src.lower():
                            if src.startswith("//"):
                                src = "https:" + src
                            elif src.startswith("/"):
                                src = BASE_URL + src
                            image_url = src
                            break

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": "Special event at the Trap Music Museum",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "nightlife",
                        "subcategory": "special-event",
                        "tags": [
                            "trap-music-museum",
                            "hip-hop",
                            "museum",
                            "west-side",
                            "nightlife",
                        ],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": BASE_URL,
                        "ticket_url": f"{BASE_URL}/shop",
                        "image_url": image_url,
                        "raw_text": title,
                        "extraction_confidence": 0.75,
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
            f"Trap Music Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch Trap Music Museum: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Trap Music Museum: {e}")
        raise

    return events_found, events_new, events_updated
