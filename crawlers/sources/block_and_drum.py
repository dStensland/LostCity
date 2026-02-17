"""
Crawler for Block & Drum, a craft distillery, hi-fi lounge, and music venue.

Multi-concept space featuring:
- Craft distillery producing spirits on-site
- Hi-fi listening lounge with audiophile sound system
- Cafe with craft cocktails and light bites
- Live music venue with recurring programming:
  - Deep Root (Wednesdays): Alternative R&B and 2000s R&B listening sessions
  - Latin Nights / Sabor (Thursdays): Salsa, bachata, tropical music
  - Smokin' Shells (Fridays): Reggae sessions
  - Sanctuary Saturdays: House music

Location: 5105 Peachtree Blvd, Building B, Chamblee, GA 30341

Events are hosted on Eventbrite organizer page:
https://www.eventbrite.com/o/block-drum-81487738023
"""

from __future__ import annotations

import logging
import re
import time
import requests
from datetime import datetime
from typing import Optional

from config import get_config
from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

API_BASE = "https://www.eventbriteapi.com/v3/"
ORGANIZER_ID = "81487738023"

VENUE_DATA = {
    "name": "Block & Drum",
    "slug": "block-and-drum",
    "address": "5105 Peachtree Blvd, Building B",
    "neighborhood": "Chamblee",
    "city": "Chamblee",
    "state": "GA",
    "zip": "30341",
    "lat": 33.8879,
    "lng": -84.3005,
    "venue_type": "distillery",
    "spot_type": "distillery",
    "website": "https://www.blockanddrum.com/",
    "vibes": ["craft-cocktails", "live-music", "lounge", "latin-night", "hi-fi", "distillery"],
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


def fetch_organizer_events(organizer_id: str) -> list[dict]:
    """Fetch all events for an organizer from Eventbrite API."""
    events = []
    page = 1
    has_more = True

    while has_more:
        try:
            url = f"{API_BASE}organizers/{organizer_id}/events/"
            params = {
                "status": "live",
                "order_by": "start_asc",
                "page": page,
                "expand": "venue,category,format",
            }

            response = requests.get(url, headers=get_api_headers(), params=params, timeout=15)

            if response.status_code == 404:
                logger.warning(f"Organizer {organizer_id} not found")
                break
            elif response.status_code == 429:
                logger.warning("Rate limited, waiting 30 seconds...")
                time.sleep(30)
                continue

            response.raise_for_status()
            data = response.json()

            page_events = data.get("events", [])
            events.extend(page_events)

            pagination = data.get("pagination", {})
            has_more = pagination.get("has_more_items", False)
            page += 1

            logger.info(f"Fetched page {page - 1}, total events: {len(events)}")

            if has_more:
                time.sleep(0.5)  # Be nice to the API

        except Exception as e:
            logger.error(f"Error fetching organizer events: {e}")
            break

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


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    title_lower = title.lower()
    description_lower = description.lower() if description else ""
    combined = f"{title_lower} {description_lower}"

    tags = ["block-and-drum", "chamblee", "distillery"]

    # Deep Root - Alternative R&B
    if "deep root" in title_lower:
        return "music", "r&b", tags + ["r&b", "alternative-rnb", "listening-session"]

    # Latin Nights / Sabor
    if any(w in title_lower for w in ["latin", "sabor", "salsa", "bachata"]):
        return "nightlife", "dancing", tags + ["latin-night", "salsa", "bachata", "dance"]

    # Smokin' Shells - Reggae
    if "smokin" in title_lower or "shells" in title_lower or "reggae" in combined:
        return "music", "reggae", tags + ["reggae", "listening-session"]

    # Sanctuary Saturdays - House
    if "sanctuary" in title_lower or "house" in combined:
        return "nightlife", "dancing", tags + ["house-music", "dance", "dj"]

    # General music events
    if any(w in combined for w in ["concert", "live music", "band", "dj", "performance"]):
        return "music", "concert", tags + ["live-music"]

    # Nightlife/parties
    if any(w in combined for w in ["party", "dance", "night", "lounge"]):
        return "nightlife", "party", tags + ["nightlife"]

    # Tasting events
    if any(w in combined for w in ["tasting", "spirit", "whiskey", "cocktail"]):
        return "food", "tasting", tags + ["spirits", "cocktails"]

    # Default to nightlife
    return "nightlife", "party", tags


def process_event(event_data: dict, source_id: int, venue_id: int) -> Optional[dict]:
    """Process API event data into our format."""
    try:
        # Extract basic info
        title = event_data.get("name", {}).get("text", "").strip()
        if not title:
            return None

        # Skip past events
        start_info = event_data.get("start", {})
        start_date, start_time = parse_datetime(start_info.get("local"))
        if not start_date:
            return None

        if start_date < datetime.now().strftime("%Y-%m-%d"):
            return None

        description = event_data.get("description", {}).get("text", "")
        if description:
            description = description[:2000]

        end_info = event_data.get("end", {})
        end_date, end_time = parse_datetime(end_info.get("local"))

        # Determine category
        category, subcategory, tags = determine_category(title, description)

        # Check if free
        is_free = event_data.get("is_free", False)

        # Get image
        logo = event_data.get("logo") or {}
        image_url = None
        if logo:
            original = logo.get("original") or {}
            image_url = original.get("url")

        # Get URL
        event_url = event_data.get("url", "")

        # Generate content hash
        content_hash = generate_content_hash(title, "Block & Drum", start_date)

        # Check if already exists
        if find_event_by_hash(content_hash):
            return {"status": "exists"}

        return {
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
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": "Free" if is_free else "See Eventbrite",
            "is_free": is_free,
            "source_url": event_url,
            "ticket_url": event_url,
            "image_url": image_url,
            "raw_text": None,
            "extraction_confidence": 0.90,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
    except Exception as e:
        logger.error(f"Error processing event: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Block & Drum events from Eventbrite API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Get or create venue
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Using venue ID: {venue_id} for Block & Drum")

        # Fetch events from API
        logger.info(f"Fetching events for Block & Drum organizer {ORGANIZER_ID}...")
        event_list = fetch_organizer_events(ORGANIZER_ID)

        if not event_list:
            logger.warning("No events found for Block & Drum")
            return 0, 0, 0

        logger.info(f"Processing {len(event_list)} events...")

        for event_data in event_list:
            events_found += 1

            # Process into our format
            result = process_event(event_data, source_id, venue_id)
            if not result:
                continue

            if result.get("status") == "exists":
                events_updated += 1
                continue

            # Insert
            try:
                insert_event(result)
                events_new += 1
                logger.info(f"Added: {result['title'][:60]}... on {result['start_date']}")
            except Exception as e:
                logger.error(f"Failed to insert: {result['title'][:60]}: {e}")

        logger.info(
            f"Block & Drum crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Block & Drum: {e}")
        raise

    return events_found, events_new, events_updated
