"""
Crawler for Georgia State University Events (calendar.gsu.edu).
Academic, cultural, student life, and public events at Georgia State University.
Uses the Localist API for structured event data.
"""

import json
import logging
from datetime import datetime
from typing import Optional
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://calendar.gsu.edu"
API_URL = f"{BASE_URL}/api/2/events"

VENUES = {
    "default": {
        "name": "Georgia State University",
        "slug": "georgia-state-university",
        "address": "33 Gilmer Street SE",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "venue_type": "university",
        "website": "https://gsu.edu",
    },
    "rialto": {
        "name": "Rialto Center for the Arts",
        "slug": "rialto-center",
        "address": "80 Forsyth Street NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "venue_type": "theater",
        "website": "https://rfrancishall.org",
    },
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse ISO date string to YYYY-MM-DD."""
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return dt.strftime("%Y-%m-%d")
    except (ValueError, AttributeError):
        return None


def parse_time(date_str: str) -> Optional[str]:
    """Parse ISO date string to HH:MM."""
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return dt.strftime("%H:%M")
    except (ValueError, AttributeError):
        return None


def categorize_event(event_data: dict) -> tuple[str, str]:
    """Determine category and subcategory from event data."""
    title = event_data.get("title", "").lower()
    description = event_data.get("description_text", "").lower()

    # Check event type filters
    filters = event_data.get("filters", {})
    event_types = filters.get("event_types", [])
    type_names = [t.get("name", "").lower() for t in event_types]

    # Athletics
    if any(t in type_names for t in ["athletics", "sports"]):
        return "sports", "college"

    # Music/Performance
    if any(word in type_names for word in ["music", "concert", "performance"]):
        return "music", "concert"

    if any(word in title for word in ["jazz", "orchestra", "choir", "concert"]):
        return "music", "concert"

    # Theater
    if any(word in type_names for word in ["theater", "theatre", "dance"]):
        return "theater", "performance"

    # Art
    if any(word in type_names for word in ["art", "exhibition", "gallery"]):
        return "art", "exhibition"

    # Lectures/Academic
    if any(word in type_names for word in ["lecture", "symposium", "seminar"]):
        return "community", "lecture"

    if any(word in title for word in ["lecture", "talk", "discussion", "symposium"]):
        return "community", "lecture"

    # Film
    if any(word in type_names for word in ["film", "screening", "movie"]):
        return "film", "screening"

    # Academic calendar items - skip these
    if any(t in type_names for t in ["academic calendar", "registration", "withdrawal"]):
        return "skip", "skip"

    # Default to community
    return "community", "campus"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia State University events using Localist API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "LostCity/1.0 (https://lostcity.ai; events@lostcity.ai)"
    }

    try:
        # Fetch 90 days of events
        params = {
            "days": 90,
            "pp": 100,  # Events per page
        }

        response = requests.get(API_URL, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        events = data.get("events", [])
        logger.info(f"Fetched {len(events)} events from GSU Localist API")

        # Get default venue
        default_venue_id = get_or_create_venue(VENUES["default"])
        rialto_venue_id = get_or_create_venue(VENUES["rialto"])

        for item in events:
            event_data = item.get("event", {})

            if not event_data:
                continue

            title = event_data.get("title", "").strip()
            if not title:
                continue

            # Get first event instance
            instances = event_data.get("event_instances", [])
            if not instances:
                continue

            instance = instances[0].get("event_instance", {})
            start_date_str = instance.get("start")

            if not start_date_str:
                continue

            start_date = parse_date(start_date_str)
            if not start_date:
                continue

            events_found += 1

            # Determine category
            category, subcategory = categorize_event(event_data)

            # Skip academic calendar items
            if category == "skip":
                continue

            # Determine venue
            location_name = event_data.get("location_name", "")
            if "rialto" in location_name.lower():
                venue_id = rialto_venue_id
                venue_name = VENUES["rialto"]["name"]
            else:
                venue_id = default_venue_id
                venue_name = VENUES["default"]["name"]

            # Check for duplicates
            content_hash = generate_content_hash(title, venue_name, start_date)

            # Parse times
            is_all_day = instance.get("all_day", False)
            start_time = None if is_all_day else parse_time(start_date_str)

            end_date_str = instance.get("end")
            end_date = parse_date(end_date_str) if end_date_str else None
            end_time = None if is_all_day else parse_time(end_date_str) if end_date_str else None

            # Get description
            description = event_data.get("description_text", "")[:500]

            # Get event URL
            event_url = event_data.get("localist_url", f"{BASE_URL}/event/{event_data.get('urlname', '')}")

            # Get photo
            photo_url = event_data.get("photo_url")

            # Get ticket info
            ticket_url = event_data.get("ticket_url")
            ticket_cost = event_data.get("ticket_cost")
            is_free = event_data.get("free", False)

            # Build tags
            tags = ["college", "gsu", "downtown"]

            # Add audience tags
            filters = event_data.get("filters", {})
            audiences = filters.get("event_audience", [])
            for aud in audiences:
                aud_name = aud.get("name", "").lower()
                if "public" in aud_name:
                    tags.append("public")
                elif "student" in aud_name:
                    tags.append("students")

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": is_all_day,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": ticket_cost,
                "is_free": is_free,
                "source_url": event_url,
                "ticket_url": ticket_url,
                "image_url": photo_url,
                "raw_text": json.dumps(event_data),
                "extraction_confidence": 0.9,
                "is_recurring": event_data.get("recurring", False),
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record)
                events_new += 1
                logger.debug(f"Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert {title}: {e}")

        logger.info(
            f"Georgia State University: Found {events_found} events, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Georgia State University: {e}")
        raise

    return events_found, events_new, events_updated
