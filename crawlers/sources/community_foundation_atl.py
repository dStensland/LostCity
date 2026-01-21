"""
Crawler for Community Foundation for Greater Atlanta.
Nonprofit events, educational programs, and community gatherings.
Events often held at Monday Night Garage and other venues.
"""

import json
import logging
import re
from datetime import datetime
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://cfgreateratlanta.org"
EVENTS_URL = f"{BASE_URL}/events"

# Known venues for CFGA events
MONDAY_NIGHT_GARAGE = {
    "name": "Monday Night Garage",
    "slug": "monday-night-garage",
    "address": "933 Lee St SW",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "venue_type": "event_space",
    "website": "https://mondaynightbrewing.com",
}

DEFAULT_VENUE = {
    "name": "Community Foundation for Greater Atlanta",
    "slug": "community-foundation-atl",
    "address": "191 Peachtree Street NE, Suite 1000",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "nonprofit",
    "website": BASE_URL,
}


def parse_date_from_text(text: str) -> tuple[str | None, str | None]:
    """Parse date and time from text like 'Thursday, August 8 | 9–10:30 a.m.'"""
    # Try to find a date pattern
    months = {
        "january": "01", "february": "02", "march": "03", "april": "04",
        "may": "05", "june": "06", "july": "07", "august": "08",
        "september": "09", "october": "10", "november": "11", "december": "12"
    }

    date_match = re.search(r'([A-Za-z]+)\s+(\d{1,2})', text, re.IGNORECASE)
    if date_match:
        month_name = date_match.group(1).lower()
        day = date_match.group(2)
        if month_name in months:
            year = datetime.now().year
            month = months[month_name]
            # If the month is in the past, assume next year
            current_month = datetime.now().month
            if int(month) < current_month:
                year += 1
            start_date = f"{year}-{month}-{day.zfill(2)}"

            # Try to get time
            time_match = re.search(r'(\d{1,2}(?::\d{2})?)\s*(?:–|-)\s*(\d{1,2}(?::\d{2})?)\s*(a\.?m\.?|p\.?m\.?)', text, re.IGNORECASE)
            if time_match:
                start_hour = time_match.group(1)
                ampm = time_match.group(3).lower().replace(".", "")
                # Parse the hour
                if ":" in start_hour:
                    hour, minute = start_hour.split(":")
                else:
                    hour, minute = start_hour, "00"
                hour = int(hour)
                if "pm" in ampm and hour != 12:
                    hour += 12
                elif "am" in ampm and hour == 12:
                    hour = 0
                start_time = f"{hour:02d}:{minute}"
                return start_date, start_time

            return start_date, None

    return None, None


def parse_events_html(soup: BeautifulSoup) -> list[dict]:
    """Parse events from the simple HTML structure."""
    events = []

    # Find event sections - typically h2 or h4 headings followed by text
    headings = soup.find_all(["h2", "h3", "h4"])

    for heading in headings:
        text = heading.get_text(strip=True)

        # Skip navigation/section headers
        if text.lower() in ["events", "upcoming events", "past events", "check back soon"]:
            continue

        # Look for event patterns - titles often contain colons or are followed by dates
        if any(keyword in text.lower() for keyword in ["facts & acts", "neil asks", "forum", "symposium", "gathering"]):
            event = {"title": text}

            # Get the surrounding text for date/location
            next_siblings = []
            for sibling in heading.find_next_siblings(limit=5):
                if sibling.name in ["h2", "h3", "h4"]:
                    break
                sibling_text = sibling.get_text(strip=True)
                if sibling_text:
                    next_siblings.append(sibling_text)

            context_text = " ".join(next_siblings)

            # Parse date
            start_date, start_time = parse_date_from_text(context_text)
            event["start_date"] = start_date
            event["start_time"] = start_time

            # Check for Monday Night Garage
            if "monday night garage" in context_text.lower() or "933 lee st" in context_text.lower():
                event["venue"] = "monday_night_garage"
            else:
                event["venue"] = "default"

            # Get description from context
            event["description"] = context_text[:500] if context_text else None

            if event.get("start_date"):
                events.append(event)

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Community Foundation for Greater Atlanta events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Parse events from HTML
        html_events = parse_events_html(soup)

        for event_data in html_events:
            events_found += 1
            title = event_data.get("title", "").strip()
            start_date = event_data.get("start_date")

            if not title or not start_date:
                continue

            # Get or create venue
            if event_data.get("venue") == "monday_night_garage":
                venue_id = get_or_create_venue(MONDAY_NIGHT_GARAGE)
            else:
                venue_id = get_or_create_venue(DEFAULT_VENUE)

            content_hash = generate_content_hash(title, "Community Foundation Atlanta", start_date)
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": event_data.get("description", "Community event from Community Foundation for Greater Atlanta"),
                "start_date": start_date,
                "start_time": event_data.get("start_time"),
                "end_date": None,
                "end_time": None,
                "is_all_day": event_data.get("start_time") is None,
                "category": "community",
                "subcategory": "nonprofit",
                "tags": ["community", "nonprofit", "education", "philanthropy"],
                "price_min": None,
                "price_max": None,
                "price_note": "RSVP required",
                "is_free": True,
                "source_url": EVENTS_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": json.dumps(event_data),
                "extraction_confidence": 0.80,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
            except Exception as e:
                logger.error(f"Failed to insert {title}: {e}")

        logger.info(f"Community Foundation Atlanta: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Community Foundation Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
