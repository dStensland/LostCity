"""
Crawler for Spivey Hall at Clayton State University.
World-renowned concert hall known for exceptional acoustics.
Scrapes upcoming events from the events page.
"""

import logging
import re
from datetime import datetime
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_image_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.spiveyhall.org"
EVENTS_URL = f"{BASE_URL}/events/upcoming-events/"

VENUE_DATA = {
    "name": "Spivey Hall",
    "slug": "spivey-hall",
    "address": "2000 Clayton State Boulevard",
    "neighborhood": "Morrow",
    "city": "Morrow",
    "state": "GA",
    "zip": "30260",
    "venue_type": "concert_hall",
    "website": "https://spiveyhall.org",
}


def parse_date_time(date_text: str, time_text: str) -> tuple[str, str]:
    """Parse date and time from Spivey Hall format."""
    # Date format: "Saturday Jan 24, 2026" or "Jan 24, 2026"
    date_str = None
    time_str = None

    if date_text:
        # Remove day name if present
        date_text = re.sub(r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*", "", date_text, flags=re.IGNORECASE)
        try:
            # Try "Jan 24, 2026" format
            dt = datetime.strptime(date_text.strip(), "%b %d, %Y")
            date_str = dt.strftime("%Y-%m-%d")
        except ValueError:
            try:
                # Try "January 24, 2026" format
                dt = datetime.strptime(date_text.strip(), "%B %d, %Y")
                date_str = dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    if time_text:
        # Time format: "3:00PM" or "7:30PM"
        match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.upper() == "PM" and hour != 12:
                hour += 12
            elif period.upper() == "AM" and hour == 12:
                hour = 0
            time_str = f"{hour:02d}:{minute}"

    return date_str, time_str


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Spivey Hall concert schedule."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_id = get_or_create_venue(VENUE_DATA)

        # Parse the page text for event patterns
        # Events follow pattern: Date, Time, Title, Description, Get Tickets
        body_text = soup.get_text(separator="\n")
        lines = [l.strip() for l in body_text.split("\n") if l.strip()]

        # Track parsing state
        current_date = None
        current_time = None
        i = 0

        while i < len(lines):
            line = lines[i]

            # Look for date pattern: "Saturday Jan 24, 2026" or "Jan 24, 2026"
            date_match = re.match(
                r"^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*"
                r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})$",
                line, re.IGNORECASE
            )
            if date_match:
                month, day, year = date_match.groups()
                current_date = f"{month} {day}, {year}"
                i += 1
                continue

            # Look for time pattern: "3:00PM" or "7:30PM"
            time_match = re.match(r"^(\d{1,2}:\d{2}\s*(?:AM|PM))$", line, re.IGNORECASE)
            if time_match:
                current_time = time_match.group(1)
                i += 1
                continue

            # Skip navigation and UI elements
            skip_words = [
                "Get Tickets", "Open Page", "Home", "Events", "Support", "About",
                "Contact", "Calendar", "Season", "Subscribe", "Menu", "Search",
                "upcoming", "Upcoming Events", "spiveyhall.org", "Clayton State",
                "Box Office", "Directions", "Parking", "Facebook", "Instagram",
                "Twitter", "©", "Copyright", "Privacy", "Terms"
            ]
            if any(skip.lower() in line.lower() for skip in skip_words):
                i += 1
                continue

            # Skip short lines
            if len(line) < 5:
                i += 1
                continue

            # If we have a date and this looks like a title (not a date or time)
            if current_date and not date_match and not time_match:
                # This might be a performer/event name
                # Titles are usually capitalized and reasonably short
                if len(line) < 100 and line[0].isupper():
                    title = line
                    events_found += 1

                    # Parse date and time
                    start_date, start_time = parse_date_time(current_date, current_time)

                    if not start_date:
                        i += 1
                        continue

                    # Generate hash
                    content_hash = generate_content_hash(
                        title, VENUE_DATA["name"], start_date
                    )

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        current_date = None
                        current_time = None
                        continue

                    # Get description (next line if not a date/time/skip)
                    description = ""
                    if i + 1 < len(lines):
                        next_line = lines[i + 1]
                        if not re.match(r"^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)", next_line, re.IGNORECASE):
                            if not re.match(r"^\d{1,2}:\d{2}", next_line):
                                if "Get Tickets" not in next_line and len(next_line) > 10:
                                    description = next_line

                    # Determine genre based on common patterns
                    title_lower = title.lower()
                    if any(w in title_lower for w in ["jazz", "swing", "blues"]):
                        subcategory = "jazz"
                        tags = ["music", "jazz", "classical", "spivey-hall"]
                    elif any(w in title_lower for w in ["orchestra", "symphony", "philharmonic"]):
                        subcategory = "classical"
                        tags = ["music", "classical", "orchestra", "spivey-hall"]
                    elif any(w in title_lower for w in ["choir", "choral", "chorus"]):
                        subcategory = "choral"
                        tags = ["music", "choral", "classical", "spivey-hall"]
                    elif any(w in title_lower for w in ["piano", "recital"]):
                        subcategory = "recital"
                        tags = ["music", "classical", "recital", "spivey-hall"]
                    else:
                        subcategory = "concert"
                        tags = ["music", "concert", "spivey-hall"]

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description if description else "Concert at Spivey Hall, world-renowned for exceptional acoustics.",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": start_time is None,
                        "category": "music",
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Check spiveyhall.org for tickets",
                        "is_free": False,
                        "source_url": EVENTS_URL,
                        "ticket_url": BASE_URL,
                        "image_url": extract_image_url(soup) if soup else None,
                        "raw_text": None,
                        "extraction_confidence": 0.80,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.debug(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert {title}: {e}")

                    # Reset for next event
                    current_date = None
                    current_time = None

            i += 1

        logger.info(f"Spivey Hall: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Spivey Hall: {e}")
        raise

    return events_found, events_new, events_updated
