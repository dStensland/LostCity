"""
Crawler for Atlanta Humane Society events via Eventbrite API.
Organizer ID: 12003007997

Uses the Eventbrite API to fetch events from Atlanta Humane Society's
Eventbrite organizer page. Events include adoption events, vaccine clinics,
fundraisers, volunteer opportunities, and educational workshops.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Optional

import requests

from config import get_config
from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

API_BASE = "https://www.eventbriteapi.com/v3/"
ORGANIZER_ID = "12003007997"

VENUE_DATA = {
    "name": "Atlanta Humane Society",
    "slug": "atlanta-humane-society",
    "address": "981 Howell Mill Rd NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7867,
    "lng": -84.4109,
    "venue_type": "animal_shelter",
    "spot_type": "animal_shelter",
    "website": "https://atlantahumane.org",
    "vibes": ["dog-friendly", "family-friendly", "adoption"],
}


def get_api_headers() -> dict:
    """Get API request headers with authentication."""
    cfg = get_config()
    api_key = cfg.api.eventbrite_api_key
    if not api_key:
        raise ValueError("EVENTBRITE_API_KEY not configured")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def fetch_organizer_events() -> list[dict]:
    """Fetch all events from Atlanta Humane Society's Eventbrite organizer."""
    events = []
    page = 1

    try:
        while True:
            url = f"{API_BASE}organizers/{ORGANIZER_ID}/events/"
            params = {
                "status": "live",
                "expand": "venue,category",
                "page": page,
            }

            logger.info(f"Fetching page {page} from Eventbrite organizer {ORGANIZER_ID}...")
            response = requests.get(url, headers=get_api_headers(), params=params, timeout=15)

            if response.status_code == 429:
                logger.warning("Rate limited, waiting 30 seconds...")
                time.sleep(30)
                continue

            response.raise_for_status()
            data = response.json()

            page_events = data.get("events", [])
            if not page_events:
                break

            events.extend(page_events)
            logger.info(f"Page {page}: Found {len(page_events)} events ({len(events)} total)")

            # Check if there are more pages
            pagination = data.get("pagination", {})
            if not pagination.get("has_more_items", False):
                break

            page += 1
            time.sleep(0.5)  # Be nice to the API

    except Exception as e:
        logger.error(f"Error fetching events from Eventbrite: {e}")
        raise

    return events


def parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse Eventbrite datetime to date and time strings."""
    if not dt_str:
        return None, None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M:%S")
    except Exception:
        return None, None


def determine_category(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    combined = f"{title} {description}".lower()

    event_tags = ["animals", "adoption", "atlanta-humane-society"]

    # Adoption events
    if any(word in combined for word in ["adoption", "adopt", "meet & greet", "meet the pets", "adoptable"]):
        event_tags.extend(["family-friendly", "pets"])
        return "family", "adoption-event", event_tags

    # Vaccine/spay/neuter clinics
    if any(word in combined for word in ["vaccine", "vaccination", "clinic", "spay", "neuter", "wellness", "vet"]):
        event_tags.extend(["pets", "family-friendly"])
        return "family", "pet-clinic", event_tags

    # Volunteer events
    if any(word in combined for word in ["volunteer", "orientation", "training", "walk dogs", "dog walking"]):
        event_tags.append("volunteer")
        return "community", "volunteer", event_tags

    # Fundraising events
    if any(word in combined for word in ["fundraiser", "gala", "benefit", "donation", "auction", "raffle", "giving", "donate"]):
        event_tags.extend(["fundraiser", "charity"])
        return "community", "fundraiser", event_tags

    # Educational workshops
    if any(word in combined for word in ["workshop", "class", "seminar", "learn", "education", "training", "101"]):
        event_tags.extend(["education", "family-friendly"])
        return "learning", "workshop", event_tags

    # Community outreach
    if any(word in combined for word in ["outreach", "community", "awareness", "celebration"]):
        event_tags.extend(["community", "family-friendly"])
        return "community", "community-event", event_tags

    # Default to family event with animals
    event_tags.append("family-friendly")
    return "family", "animal-event", event_tags


def process_event(event_data: dict, source_id: int, venue_id: int) -> Optional[dict]:
    """Process Eventbrite API event data into our format."""
    try:
        # Extract basic info
        title = event_data.get("name", {}).get("text", "").strip()
        if not title:
            return None

        # Parse dates
        start_info = event_data.get("start", {})
        start_date, start_time = parse_datetime(start_info.get("local"))
        if not start_date:
            return None

        # Skip past events
        if start_date < datetime.now().strftime("%Y-%m-%d"):
            return None

        end_info = event_data.get("end", {})
        end_date, end_time = parse_datetime(end_info.get("local"))

        # Description
        description = event_data.get("description", {}).get("text", "")
        if description:
            description = description[:2000]
        else:
            description = f"{title} at Atlanta Humane Society"

        # Category determination
        category, subcategory, event_tags = determine_category(title, description)

        # Price info - most AHS events are free
        is_free = event_data.get("is_free", False)

        # Image
        logo = event_data.get("logo") or {}
        image_url = None
        if logo:
            original = logo.get("original") or {}
            image_url = original.get("url")

        # Event URL
        event_url = event_data.get("url", "")

        # Content hash for dedup
        content_hash = generate_content_hash(title, "Atlanta Humane Society", start_date)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title[:500],
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date or start_date,
            "end_time": end_time,
            "is_all_day": False,
            "category": category,
            "subcategory": subcategory,
            "tags": event_tags,
            "price_min": None,
            "price_max": None,
            "price_note": "Free" if is_free else "See Eventbrite",
            "is_free": is_free,
            "source_url": event_url,
            "ticket_url": event_url,
            "image_url": image_url,
            "raw_text": f"{title} - {description[:200]}",
            "extraction_confidence": 0.95,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            return {"status": "exists"}

        return event_record
    except Exception as e:
        logger.error(f"Error processing event: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Humane Society events via Eventbrite API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create/verify venue
        venue_id = get_or_create_venue(VENUE_DATA)

        # Fetch all events from Eventbrite organizer
        logger.info(f"Fetching events from Atlanta Humane Society (Eventbrite organizer {ORGANIZER_ID})...")
        event_list = fetch_organizer_events()

        if not event_list:
            logger.warning("No events found from Eventbrite API")
            return 0, 0, 0

        logger.info(f"Processing {len(event_list)} events from Eventbrite...")

        for event_data in event_list:
            events_found += 1

            # Process event
            result = process_event(event_data, source_id, venue_id)
            if not result:
                continue

            if result.get("status") == "exists":
                events_updated += 1
                continue

            # Insert event
            try:
                insert_event(result)
                events_new += 1
                logger.info(f"Added: {result['title']} on {result['start_date']}")
            except Exception as e:
                logger.error(f"Failed to insert event '{result['title']}': {e}")

        logger.info(
            f"Atlanta Humane Society crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Humane Society: {e}")
        raise

    return events_found, events_new, events_updated
