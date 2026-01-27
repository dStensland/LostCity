"""
Crawler for Agnes Scott College Events (calendar.agnesscott.edu).
Public events only - lectures, performances, and exhibits open to the general public.
Filters out student-only events using the Localist API.
"""

import json
import logging
from datetime import datetime
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# Calendar uses Localist platform
BASE_URL = "https://calendar.agnesscott.edu"
API_URL = f"{BASE_URL}/api/2/events"

VENUE_DATA = {
    "name": "Agnes Scott College",
    "slug": "agnes-scott-college",
    "address": "141 East College Avenue",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7696,
    "lng": -84.2936,
    "venue_type": "university",
    "spot_type": "arts-culture",
    "website": "https://agnesscott.edu",
}


def is_public_event(event: dict) -> bool:
    """Check if event is open to the general public."""
    filters = event.get("filters", {})
    audiences = filters.get("event_target_audience", [])

    # Check if "General Public" is in the target audience
    for audience in audiences:
        if isinstance(audience, dict):
            name = audience.get("name", "")
        else:
            name = str(audience)
        if "general public" in name.lower():
            return True

    return False


def parse_datetime(dt_str: str) -> tuple:
    """Parse ISO datetime into date and time strings."""
    if not dt_str:
        return None, None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except (ValueError, TypeError):
        return dt_str[:10] if len(dt_str) >= 10 else None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Agnes Scott College public events via Localist API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
    }

    try:
        # Fetch events for next 90 days
        response = requests.get(
            API_URL,
            params={"days": 90, "pp": 100},
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        venue_id = get_or_create_venue(VENUE_DATA)

        events_list = data.get("events", [])
        logger.info(f"Agnes Scott: Fetched {len(events_list)} total events from API")

        for event_wrapper in events_list:
            event = event_wrapper.get("event", event_wrapper)

            # Filter for public events only
            if not is_public_event(event):
                continue

            events_found += 1

            title = event.get("title", "").strip()
            if not title:
                continue

            # Get first event instance for date/time
            instances = event.get("event_instances", [])
            if instances:
                instance = instances[0].get("event_instance", instances[0])
                start_str = instance.get("start")
                end_str = instance.get("end")
            else:
                start_str = event.get("first_date")
                end_str = event.get("last_date")

            start_date, start_time = parse_datetime(start_str)
            end_date, end_time = parse_datetime(end_str)

            if not start_date:
                continue

            content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Get event types for categorization
            filters = event.get("filters", {})
            event_types = [t.get("name", "") if isinstance(t, dict) else str(t)
                         for t in filters.get("event_types", [])]
            types_lower = " ".join(event_types).lower()

            # Determine category from event types
            title_lower = title.lower()
            desc_lower = (event.get("description_text", "") or "").lower()

            if any(w in types_lower or w in title_lower for w in ["lecture", "presentation", "speaker"]):
                category, subcategory = "community", "lecture"
            elif any(w in types_lower or w in title_lower for w in ["performance", "exhibit", "recital", "concert"]):
                category, subcategory = "arts", "performance"
            elif any(w in types_lower for w in ["workshop", "training"]):
                category, subcategory = "community", "workshop"
            else:
                category, subcategory = "community", "campus"

            # Build tags
            tags = ["college", "agnes-scott", "decatur"]
            if "free" in desc_lower or event.get("free"):
                tags.append("free")

            # Get location details
            location = event.get("location_name") or event.get("location", "")
            room = event.get("room_number", "")
            if room and location:
                location = f"{location}, {room}"

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": (event.get("description_text") or f"Public event at Agnes Scott College")[:500],
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date if end_date != start_date else None,
                "end_time": end_time,
                "is_all_day": event.get("all_day", False),
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": "Free" if event.get("free") else None,
                "is_free": event.get("free", True),
                "source_url": event.get("localist_url") or f"{BASE_URL}/event/{event.get('id')}",
                "ticket_url": event.get("ticket_url"),
                "image_url": event.get("photo_url"),
                "raw_text": title,
                "extraction_confidence": 0.90,
                "is_recurring": len(instances) > 1,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added public event: {title}")
            except Exception as e:
                logger.error(f"Failed to insert {title}: {e}")

        logger.info(f"Agnes Scott College: {events_found} public events found, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Agnes Scott College: {e}")
        raise

    return events_found, events_new, events_updated
