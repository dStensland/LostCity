"""
Crawler for Emory University Events via Trumba JSON feeds.
Arts at Emory (arts, music, film, exhibitions) and filtered university-wide public events.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# Trumba JSON feed URLs
ARTS_FEED_URL = "https://www.trumba.com/calendars/arts-at-emory.json"
EVENTS_FEED_URL = "https://www.trumba.com/calendars/emory-events.json"

VENUES = {
    "schwartz": {
        "name": "Schwartz Center for Performing Arts",
        "slug": "schwartz-center-emory",
        "address": "1700 North Decatur Road",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7909,
        "lng": -84.3228,
        "venue_type": "performing_arts",
        "spot_type": "performing_arts",
        "website": "https://schwartz.emory.edu",
        "vibes": ["university", "performing-arts", "theater"],
    },
    "carlos": {
        "name": "Michael C. Carlos Museum",
        "slug": "carlos-museum",
        "address": "571 South Kilgo Circle",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7900,
        "lng": -84.3237,
        "venue_type": "museum",
        "spot_type": "museum",
        "website": "https://carlos.emory.edu",
        "vibes": ["university", "museum", "art"],
    },
    "default": {
        "name": "Emory University",
        "slug": "emory-university",
        "address": "201 Dowman Drive",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7920,
        "lng": -84.3240,
        "venue_type": "university",
        "spot_type": "university",
        "website": "https://emory.edu",
        "vibes": ["university", "campus", "education"],
    },
}


def get_custom_field(event: dict, label: str) -> str | None:
    """Extract custom field value by label from Trumba event."""
    custom_fields = event.get("customFields", [])
    if not custom_fields:
        return None

    for field in custom_fields:
        if field.get("label", "").lower() == label.lower():
            return field.get("value", "").strip()
    return None


def is_public_event(event: dict) -> bool:
    """Check if event is open to the public (for emory-events feed filtering)."""
    open_to = get_custom_field(event, "Event Open To")
    if not open_to:
        return False

    open_to_lower = open_to.lower()
    return any(keyword in open_to_lower for keyword in ["public", "all", "community", "general"])


def strip_html(text: str) -> str:
    """Remove HTML tags from text using BeautifulSoup."""
    if not text:
        return ""
    soup = BeautifulSoup(text, "html.parser")
    return soup.get_text(separator=" ", strip=True)


def determine_venue(location: str) -> dict:
    """Route event to appropriate venue based on location string."""
    location_lower = location.lower()

    # Schwartz Center patterns
    if any(keyword in location_lower for keyword in ["schwartz", "emerson", "concert hall"]):
        return VENUES["schwartz"]

    # Carlos Museum patterns
    if any(keyword in location_lower for keyword in ["carlos", "museum"]):
        return VENUES["carlos"]

    # Default to generic Emory
    return VENUES["default"]


def map_category(category_calendar: str, title: str) -> str:
    """Map Trumba categoryCalendar and title to LostCity category."""
    category_lower = category_calendar.lower()
    title_lower = title.lower()

    # Check categoryCalendar first
    if "music" in category_lower:
        return "music"
    if "film" in category_lower:
        return "film"
    if any(keyword in category_lower for keyword in ["visual arts", "exhibitions", "art"]):
        return "museums"
    if "dance" in category_lower:
        return "dance"
    if any(keyword in category_lower for keyword in ["theater", "theatre"]):
        return "theater"
    if any(keyword in category_lower for keyword in ["lecture", "talk", "speaker"]):
        return "learning"

    # Fallback to title-based detection
    if any(keyword in title_lower for keyword in ["concert", "music", "performance", "band", "orchestra"]):
        return "music"
    if any(keyword in title_lower for keyword in ["film", "movie", "screening"]):
        return "film"
    if any(keyword in title_lower for keyword in ["exhibition", "gallery", "art show"]):
        return "museums"
    if any(keyword in title_lower for keyword in ["dance", "ballet"]):
        return "dance"
    if any(keyword in title_lower for keyword in ["theater", "theatre", "play"]):
        return "theater"

    # Default
    return "learning"


def parse_datetime(iso_string: str) -> tuple[str | None, str | None]:
    """
    Parse ISO 8601 datetime string to (date YYYY-MM-DD, time HH:MM:SS).
    Example: "2026-02-13T20:00:00" -> ("2026-02-13", "20:00:00")
    """
    if not iso_string:
        return None, None

    try:
        dt = datetime.fromisoformat(iso_string)
        date_str = dt.strftime("%Y-%m-%d")
        time_str = dt.strftime("%H:%M:%S")
        return date_str, time_str
    except (ValueError, TypeError):
        logger.warning(f"Failed to parse datetime: {iso_string}")
        return None, None


def determine_is_free(event: dict) -> bool:
    """Check if event is free based on requiresPayment and Cost custom field."""
    if event.get("requiresPayment", False):
        return False

    cost = get_custom_field(event, "Cost")
    if not cost:
        return True  # Assume free if no cost specified

    cost_lower = cost.lower()
    return any(keyword in cost_lower for keyword in ["free", "$0", "no charge", "complimentary"])


def crawl_feed(feed_url: str, source_id: int, is_arts_feed: bool) -> tuple[int, int, int]:
    """Crawl a single Trumba JSON feed."""
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        response = requests.get(feed_url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        logger.warning(f"Failed to fetch {feed_url}: {e}")
        return 0, 0, 0
    except ValueError as e:
        logger.error(f"Failed to parse JSON from {feed_url}: {e}")
        return 0, 0, 0

    # Handle array or object response
    events_list = data if isinstance(data, list) else data.get("events", [])

    for event in events_list:
        try:
            # Skip canceled events
            if event.get("canceled", False):
                continue

            # Filter public-only for emory-events feed
            if not is_arts_feed and not is_public_event(event):
                continue

            events_found += 1

            # Required fields
            title = event.get("title", "").strip()
            if not title:
                logger.debug("Skipping event with no title")
                continue

            start_datetime = event.get("startDateTime", "")
            start_date, start_time = parse_datetime(start_datetime)
            if not start_date:
                logger.debug(f"Skipping event '{title}' with no valid start date")
                continue

            # Venue routing
            location_raw = event.get("location", "")
            location = strip_html(location_raw)
            venue_data = determine_venue(location)
            venue_id = get_or_create_venue(venue_data)

            # Category mapping
            category_calendar = event.get("categoryCalendar", "")
            category = map_category(category_calendar, title)

            # Image
            image_url = None
            event_image = event.get("eventImage")
            if event_image and isinstance(event_image, dict):
                image_url = event_image.get("url")

            # URLs
            source_url = event.get("permaLinkUrl", "")
            signup_url = event.get("signUpUrl")
            ticket_url = signup_url if signup_url else source_url

            # Description (strip HTML)
            description_raw = event.get("description", "")
            description = strip_html(description_raw)

            # All-day flag
            is_all_day = event.get("allDay", False)

            # Free/paid
            is_free = determine_is_free(event)

            # Deduplication
            content_hash = generate_content_hash(title, venue_data["name"], start_date)

            # Build event record
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description[:1000] if description else None,
                "start_date": start_date,
                "start_time": start_time if not is_all_day else None,
                "end_date": None,  # Could parse endDateTime if needed
                "end_time": None,
                "is_all_day": is_all_day,
                "category": category,
                "subcategory": None,
                "tags": ["university", "emory"],
                "price_min": None,
                "price_max": None,
                "price_note": get_custom_field(event, "Cost"),
                "is_free": is_free,
                "source_url": source_url,
                "ticket_url": ticket_url if ticket_url else None,
                "image_url": image_url,
                "raw_text": None,
                "extraction_confidence": 0.95,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            insert_event(event_record)
            events_new += 1

        except Exception as e:
            logger.error(f"Error processing event from {feed_url}: {e}")
            continue

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Emory University events from Trumba JSON feeds."""
    source_id = source["id"]

    # Crawl Arts at Emory feed (all events)
    logger.info("Crawling Arts at Emory feed...")
    arts_found, arts_new, arts_updated = crawl_feed(ARTS_FEED_URL, source_id, is_arts_feed=True)

    # Crawl Emory Events feed (public events only)
    logger.info("Crawling Emory Events feed (public only)...")
    events_found, events_new, events_updated = crawl_feed(EVENTS_FEED_URL, source_id, is_arts_feed=False)

    # Aggregate totals
    total_found = arts_found + events_found
    total_new = arts_new + events_new
    total_updated = arts_updated + events_updated

    logger.info(
        f"Emory Events: Found {total_found} events, {total_new} new, {total_updated} existing "
        f"(Arts: {arts_found}/{arts_new}, Events: {events_found}/{events_new})"
    )

    return total_found, total_new, total_updated
