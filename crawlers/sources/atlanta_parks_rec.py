"""
Crawler for Atlanta Department of Parks and Recreation events.

The site uses the Atlanta.gov calendar system. Parks & Recreation events
are spread across various Atlanta city calendar pages and event listings.
We filter for events related to parks, recreation, fitness, and community programs.
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

BASE_URL = "https://www.atlantaga.gov"
CALENDAR_URL = f"{BASE_URL}/Home/Components/Calendar/Event/Index"

# Main Parks & Recreation locations
PARKS_VENUES = {
    "Piedmont Park": {
        "slug": "piedmont-park-atlanta",
        "address": "1320 Monroe Dr NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7869,
        "lng": -84.3733,
        "venue_type": "park",
        "spot_type": "park",
    },
    "Grant Park": {
        "slug": "grant-park-atlanta",
        "address": "537 Park Ave SE",
        "neighborhood": "Grant Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7423,
        "lng": -84.3711,
        "venue_type": "park",
        "spot_type": "park",
    },
    "Chastain Park": {
        "slug": "chastain-park",
        "address": "4469 Stella Dr NW",
        "neighborhood": "Chastain Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30327",
        "lat": 33.8667,
        "lng": -84.4166,
        "venue_type": "park",
        "spot_type": "park",
    },
    "Atlanta Recreation Center": {
        "slug": "atlanta-recreation-center",
        "city": "Atlanta",
        "state": "GA",
        "venue_type": "community_center",
        "spot_type": "community_center",
    },
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '07:30 PM' format to 24-hour HH:MM."""
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


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats to YYYY-MM-DD."""
    # Try different date patterns
    patterns = [
        (r"(\w+)\s+(\d{1,2}),?\s+(\d{4})", "%B %d %Y"),  # January 25, 2026
        (r"(\w+)\s+(\d{1,2})", "%B %d"),  # January 25 (current year)
        (r"(\d{1,2})/(\d{1,2})/(\d{4})", "%m/%d/%Y"),  # 1/25/2026
    ]

    for pattern, date_format in patterns:
        match = re.search(pattern, date_text, re.IGNORECASE)
        if match:
            try:
                if len(match.groups()) == 2:  # No year provided
                    dt = datetime.strptime(f"{match.group(1)} {match.group(2)} {datetime.now().year}", date_format + " %Y")
                    # If date is in the past, assume next year
                    if dt.date() < datetime.now().date():
                        dt = dt.replace(year=dt.year + 1)
                else:
                    dt = datetime.strptime(date_text, date_format)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


def is_parks_recreation_event(title: str, description: str = "") -> bool:
    """
    Check if an event is related to Parks & Recreation.
    """
    text = (title + " " + description).lower()

    # Keywords that indicate parks/recreation events
    keywords = [
        "park", "recreation", "fitness", "yoga", "exercise", "workout",
        "sports", "basketball", "tennis", "soccer", "baseball", "softball",
        "swimming", "pool", "trail", "hike", "nature", "playground",
        "community center", "youth program", "kids program", "summer camp",
        "senior", "athletics", "volleyball", "football", "track",
        "greenspace", "garden", "outdoor", "picnic", "family fun"
    ]

    # Anti-keywords that exclude events not related to Parks & Rec
    exclude_keywords = [
        "city council", "zoning", "permit", "hearing", "ordinance",
        "budget", "procurement", "bid", "contract", "commission meeting"
    ]

    # Check for exclusions first
    for keyword in exclude_keywords:
        if keyword in text:
            return False

    # Check for parks/rec keywords
    for keyword in keywords:
        if keyword in text:
            return True

    return False


def fetch_event_details(event_url: str) -> Optional[dict]:
    """
    Fetch detailed event information from event page.
    Returns dict with title, description, date, time, location.
    """
    try:
        response = requests.get(
            event_url,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            timeout=15
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Extract title
        title_elem = soup.find("h1") or soup.find("h2")
        title = title_elem.text.strip() if title_elem else "Unknown Event"

        # Extract description
        desc_elem = soup.find("div", class_=re.compile("description|content|details", re.I))
        description = desc_elem.get_text(" ", strip=True) if desc_elem else ""

        # Extract date/time
        time_elem = soup.find("time") or soup.find("div", class_=re.compile("date|time", re.I))
        date_time_text = time_elem.get_text(" ", strip=True) if time_elem else ""

        # Extract location
        location_elem = soup.find("div", class_=re.compile("location|venue", re.I))
        location = location_elem.text.strip() if location_elem else ""

        return {
            "title": title,
            "description": description,
            "date_time_text": date_time_text,
            "location": location,
            "url": event_url
        }

    except Exception as e:
        logger.warning(f"Failed to fetch event details from {event_url}: {e}")
        return None


def determine_venue(location_text: str, title: str) -> tuple[int, str]:
    """
    Determine venue based on location text and title.
    Returns (venue_id, venue_name).
    """
    location_lower = (location_text + " " + title).lower()

    # Check for known parks
    for park_name, venue_data in PARKS_VENUES.items():
        if park_name.lower() in location_lower:
            venue_data_with_name = {"name": park_name, "website": BASE_URL, **venue_data}
            venue_id = get_or_create_venue(venue_data_with_name)
            return venue_id, park_name

    # Default to generic Atlanta Recreation Center
    default_venue = PARKS_VENUES["Atlanta Recreation Center"]
    venue_data_with_name = {"name": "Atlanta Recreation Center", "website": BASE_URL, **default_venue}
    venue_id = get_or_create_venue(venue_data_with_name)
    return venue_id, "Atlanta Recreation Center"


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """
    Determine category, subcategory, and tags for an event.
    Returns (category, subcategory, tags).
    """
    text = (title + " " + description).lower()
    tags = ["parks", "recreation", "atlanta", "community"]

    # Sports & Fitness
    if any(word in text for word in ["fitness", "yoga", "exercise", "workout", "gym", "training"]):
        category = "sports"
        subcategory = "fitness"
        tags.extend(["fitness", "health", "wellness"])
    elif any(word in text for word in ["basketball", "tennis", "soccer", "baseball", "softball", "volleyball", "football"]):
        category = "sports"
        subcategory = "team_sports"
        tags.extend(["sports", "athletics"])
    elif any(word in text for word in ["swimming", "pool"]):
        category = "sports"
        subcategory = "swimming"
        tags.extend(["swimming", "aquatics"])

    # Youth & Family
    elif any(word in text for word in ["kids", "children", "youth", "family", "child"]):
        category = "community"
        subcategory = "family"
        tags.extend(["family-friendly", "kids", "youth"])

    # Senior programs
    elif "senior" in text:
        category = "community"
        subcategory = "seniors"
        tags.extend(["seniors", "55+"])

    # Nature & Outdoors
    elif any(word in text for word in ["nature", "trail", "hike", "garden", "outdoor"]):
        category = "community"
        subcategory = "outdoor"
        tags.extend(["outdoor", "nature"])

    # Default to community
    else:
        category = "community"
        subcategory = None

    # Check if free
    if "free" in text or "no cost" in text:
        tags.append("free")

    return category, subcategory, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Parks & Recreation events from city calendar.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        logger.info(f"Fetching Atlanta city calendar: {CALENDAR_URL}")

        response = requests.get(
            CALENDAR_URL,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            timeout=20
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Find all event links on the calendar page
        event_links = soup.find_all("a", href=re.compile(r"/Home/Components/Calendar/Event/\d+"))

        logger.info(f"Found {len(event_links)} total events on calendar")

        for link in event_links:
            try:
                event_url = link.get("href")
                if not event_url.startswith("http"):
                    event_url = BASE_URL + event_url

                # Get event preview from link
                preview_title = link.get_text(strip=True)

                # Fetch full event details
                event_details = fetch_event_details(event_url)
                if not event_details:
                    continue

                title = event_details["title"]
                description = event_details["description"]

                # Filter for Parks & Recreation events
                if not is_parks_recreation_event(title, description):
                    logger.debug(f"Skipping non-Parks/Rec event: {title}")
                    continue

                events_found += 1

                # Parse date and time
                date_time_text = event_details["date_time_text"]
                start_date = parse_date(date_time_text)
                start_time = parse_time(date_time_text)

                if not start_date:
                    logger.warning(f"Could not parse date for: {title}")
                    continue

                # Determine venue
                venue_id, venue_name = determine_venue(event_details["location"], title)

                # Categorize event
                category, subcategory, tags = categorize_event(title, description)

                # Generate content hash for deduplication
                content_hash = generate_content_hash(title, venue_name, start_date)

                # Check if already exists
                if find_event_by_hash(content_hash):
                    events_updated += 1
                    logger.debug(f"Event already exists: {title}")
                    continue

                # Create event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
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
                    "is_free": "free" in tags,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": None,
                    "raw_text": f"{title}\n{description[:200]}",
                    "extraction_confidence": 0.75,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                insert_event(event_record)
                events_new += 1
                logger.info(f"Added Parks/Rec event: {title} on {start_date}")

            except Exception as e:
                logger.error(f"Error processing event: {e}")
                continue

        logger.info(
            f"Atlanta Parks & Recreation crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Parks & Recreation: {e}")
        raise

    return events_found, events_new, events_updated
