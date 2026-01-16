"""
Crawler for Atlanta Pride (atlantapride.org/events-page).
Atlanta's major LGBTQ+ organization hosting Pride festival and year-round events.
"""

from __future__ import annotations

import re
import json
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantapride.org"
EVENTS_URL = f"{BASE_URL}/events-page/"

# Default venue for Atlanta Pride events
DEFAULT_VENUE = {
    "name": "Atlanta Pride",
    "slug": "atlanta-pride",
    "address": "1530 DeKalb Ave NE",
    "neighborhood": "Candler Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "venue_type": "organization",
    "website": BASE_URL,
}

# Piedmont Park is the main Pride festival location
PIEDMONT_PARK = {
    "name": "Piedmont Park",
    "slug": "piedmont-park",
    "address": "1320 Monroe Dr NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "venue_type": "park",
    "website": "https://piedmontpark.org",
}


def parse_iso_date(iso_string: str) -> Optional[str]:
    """Parse ISO 8601 date string to YYYY-MM-DD."""
    if not iso_string:
        return None
    try:
        # Handle various ISO formats
        dt = datetime.fromisoformat(iso_string.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass
    return None


def parse_iso_time(iso_string: str) -> Optional[str]:
    """Parse ISO 8601 date string to HH:MM time."""
    if not iso_string:
        return None
    try:
        dt = datetime.fromisoformat(iso_string.replace("Z", "+00:00"))
        return dt.strftime("%H:%M")
    except ValueError:
        pass
    return None


def parse_date_text(date_text: str) -> Optional[str]:
    """Parse date from 'January 18' or 'January 18, 2026' format."""
    date_text = date_text.strip()

    # Try "January 18, 2026" format
    for fmt in ["%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y"]:
        try:
            dt = datetime.strptime(date_text, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try to find date pattern without year
    match = re.search(r"(\w+)\s+(\d{1,2})", date_text)
    if match:
        month, day = match.groups()
        year = datetime.now().year
        for fmt in ["%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", fmt)
                if dt < datetime.now():
                    dt = datetime.strptime(f"{month} {day} {year + 1}", fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


def parse_time_text(time_text: str) -> Optional[str]:
    """Parse time from '4:30 pm' format."""
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


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Pride events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    }

    # Pre-create venues
    default_venue_id = get_or_create_venue(DEFAULT_VENUE)
    piedmont_venue_id = get_or_create_venue(PIEDMONT_PARK)

    try:
        logger.info(f"Fetching Atlanta Pride: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Try to extract JSON-LD first (most reliable)
        json_ld_scripts = soup.find_all("script", type="application/ld+json")
        for script in json_ld_scripts:
            try:
                data = json.loads(script.string)
                # Handle both single event and array of events
                if isinstance(data, list):
                    for item in data:
                        if item.get("@type") == "Event":
                            event_data = process_json_ld_event(
                                item, source_id, default_venue_id, piedmont_venue_id
                            )
                            if event_data:
                                events_found += 1
                                result = save_event(event_data)
                                if result == "new":
                                    events_new += 1
                                elif result == "existing":
                                    events_updated += 1
                elif data.get("@type") == "Event":
                    event_data = process_json_ld_event(
                        data, source_id, default_venue_id, piedmont_venue_id
                    )
                    if event_data:
                        events_found += 1
                        result = save_event(event_data)
                        if result == "new":
                            events_new += 1
                        elif result == "existing":
                            events_updated += 1
            except json.JSONDecodeError:
                continue

        # If no JSON-LD events found, fall back to HTML parsing
        if events_found == 0:
            # Look for Tribe Events calendar list
            event_items = soup.find_all("article", class_=re.compile(r"tribe-events"))
            if not event_items:
                # Fallback: find event links
                event_links = soup.find_all("a", href=re.compile(r"/event/"))

                seen_urls = set()
                for link in event_links:
                    href = link.get("href", "")
                    if href in seen_urls:
                        continue
                    seen_urls.add(href)

                    # Get parent container
                    parent = link.find_parent("article") or link.find_parent("div")
                    if not parent:
                        continue

                    title = link.get_text(strip=True)
                    if not title or len(title) < 3:
                        continue

                    parent_text = parent.get_text(" ", strip=True)

                    # Try to find date in text
                    start_date = parse_date_text(parent_text)
                    if not start_date:
                        continue

                    start_time = parse_time_text(parent_text)

                    events_found += 1

                    # Use Piedmont Park for festival events, default otherwise
                    venue_id = default_venue_id
                    if "piedmont" in parent_text.lower() or "festival" in title.lower():
                        venue_id = piedmont_venue_id

                    content_hash = generate_content_hash(title, "Atlanta Pride", start_date)

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    event_url = href if href.startswith("http") else f"{BASE_URL}{href}"

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "community",
                        "subcategory": "pride",
                        "tags": ["lgbtq", "pride", "atlanta-pride"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": None,
                        "image_url": None,
                        "raw_text": parent_text[:500] if parent_text else None,
                        "extraction_confidence": 0.75,
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

        logger.info(f"Atlanta Pride crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Pride: {e}")
        raise

    return events_found, events_new, events_updated


def process_json_ld_event(
    data: dict, source_id: int, default_venue_id: int, piedmont_venue_id: int
) -> Optional[dict]:
    """Process a JSON-LD event object into our event format."""
    title = data.get("name", "").strip()
    if not title:
        return None

    start_date = parse_iso_date(data.get("startDate"))
    if not start_date:
        return None

    start_time = parse_iso_time(data.get("startDate"))
    end_date = parse_iso_date(data.get("endDate"))
    end_time = parse_iso_time(data.get("endDate"))

    description = data.get("description", "")

    # Determine venue
    venue_id = default_venue_id
    location = data.get("location", {})
    if isinstance(location, dict):
        location_name = location.get("name", "").lower()
        if "piedmont" in location_name:
            venue_id = piedmont_venue_id

    event_url = data.get("url", EVENTS_URL)
    image_url = data.get("image")
    if isinstance(image_url, list):
        image_url = image_url[0] if image_url else None

    content_hash = generate_content_hash(title, "Atlanta Pride", start_date)

    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description[:1000] if description else None,
        "start_date": start_date,
        "start_time": start_time,
        "end_date": end_date,
        "end_time": end_time,
        "is_all_day": False,
        "category": "community",
        "subcategory": "pride",
        "tags": ["lgbtq", "pride", "atlanta-pride"],
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "is_free": True,
        "source_url": event_url,
        "ticket_url": None,
        "image_url": image_url,
        "raw_text": None,
        "extraction_confidence": 0.9,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def save_event(event_data: dict) -> str:
    """Save event to database. Returns 'new', 'existing', or 'error'."""
    existing = find_event_by_hash(event_data["content_hash"])
    if existing:
        return "existing"

    try:
        insert_event(event_data)
        logger.info(f"Added: {event_data['title']} on {event_data['start_date']}")
        return "new"
    except Exception as e:
        logger.error(f"Failed to insert: {event_data['title']}: {e}")
        return "error"
