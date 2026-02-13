"""
Crawler for MASS Collective (masscollective.org).

Atlanta's premier community makerspace offering welding, woodworking, machining,
leatherwork, and other hands-on workshop classes. Events are hosted on Eventbrite.

Uses Eventbrite API to fetch events for organizer ID 4567583831.
"""

from __future__ import annotations

import logging
import re
import time
import requests
from datetime import datetime
from typing import Optional

from config import get_config
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

ORGANIZER_ID = "4567583831"
API_BASE = "https://www.eventbriteapi.com/v3/"

VENUE_DATA = {
    "name": "MASS Collective",
    "slug": "mass-collective",
    "address": "364 Nelson St SW",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7450,
    "lng": -84.4020,
    "venue_type": "studio",
    "spot_type": "studio",
    "website": "https://www.masscollective.org",
    "vibes": ["workshop", "hands-on", "makerspace", "woodworking", "welding", "leatherwork"],
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


def parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse Eventbrite datetime to date and time strings."""
    if not dt_str:
        return None, None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except Exception as e:
        logger.debug(f"Could not parse datetime '{dt_str}': {e}")
        return None, None


def parse_price(event_data: dict) -> tuple[Optional[float], Optional[float], bool]:
    """
    Extract price information from Eventbrite event data.
    Returns (price_min, price_max, is_free).
    """
    is_free = event_data.get("is_free", False)
    if is_free:
        return None, None, True

    # Try to get ticket classes if available
    ticket_availability = event_data.get("ticket_availability") or {}
    if ticket_availability:
        # API includes ticket data in expanded response
        min_price = ticket_availability.get("minimum_ticket_price")
        max_price = ticket_availability.get("maximum_ticket_price")

        if min_price and max_price:
            try:
                # Prices are in cents
                min_val = float(min_price.get("major_value", 0))
                max_val = float(max_price.get("major_value", 0))
                return min_val, max_val, False
            except (ValueError, AttributeError):
                pass

    return None, None, False


def determine_tags(title: str, description: str) -> list[str]:
    """Determine event tags based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["makerspace", "hands-on", "workshop"]

    if any(kw in text for kw in ["welding", "weld", "mig", "tig"]):
        tags.extend(["welding", "metalwork"])

    if any(kw in text for kw in ["woodworking", "wood", "carpentry"]):
        tags.append("woodworking")

    if any(kw in text for kw in ["machining", "machine shop", "lathe", "mill"]):
        tags.extend(["machining", "metalwork"])

    if any(kw in text for kw in ["leather", "leatherwork"]):
        tags.extend(["leatherwork", "crafts"])

    if any(kw in text for kw in ["blacksmith", "forge", "forging"]):
        tags.extend(["blacksmithing", "metalwork"])

    if any(kw in text for kw in ["intro", "introduction", "beginner", "basics"]):
        tags.append("beginner-friendly")

    if any(kw in text for kw in ["certification", "certified", "safety"]):
        tags.append("certification")

    # Remove duplicates while preserving order
    seen = set()
    unique_tags = []
    for tag in tags:
        if tag not in seen:
            seen.add(tag)
            unique_tags.append(tag)

    return unique_tags


def fetch_organizer_events() -> list[dict]:
    """Fetch all live events for MASS Collective organizer from Eventbrite API."""
    all_events = []
    continuation = None
    page = 1

    try:
        while True:
            url = f"{API_BASE}organizers/{ORGANIZER_ID}/events/"
            params = {
                "status": "live",
                "order_by": "start_asc",
                "expand": "venue,ticket_availability",
            }

            if continuation:
                params["continuation"] = continuation

            logger.info(f"Fetching MASS Collective events page {page}")
            response = requests.get(url, headers=get_api_headers(), params=params, timeout=15)

            if response.status_code == 404:
                logger.warning(f"Organizer {ORGANIZER_ID} not found")
                break
            elif response.status_code == 429:
                logger.warning("Rate limited, waiting 30 seconds...")
                time.sleep(30)
                continue

            response.raise_for_status()
            data = response.json()

            events = data.get("events", [])
            if not events:
                logger.info(f"No more events on page {page}")
                break

            all_events.extend(events)
            logger.info(f"Page {page}: Found {len(events)} events ({len(all_events)} total)")

            # Check for pagination
            pagination = data.get("pagination", {})
            continuation = pagination.get("continuation")

            if not continuation or not pagination.get("has_more_items"):
                break

            page += 1
            time.sleep(0.5)  # Be nice to API

    except Exception as e:
        logger.error(f"Error fetching organizer events: {e}")
        raise

    return all_events


def process_event(event_data: dict, source_id: int, venue_id: int) -> Optional[dict]:
    """Process Eventbrite event data into our format."""
    try:
        # Extract basic info
        title = event_data.get("name", {}).get("text", "").strip()
        if not title:
            return None

        # Parse dates
        start_info = event_data.get("start", {})
        start_date, start_time = parse_datetime(start_info.get("local"))
        if not start_date:
            logger.debug(f"No valid date for: {title}")
            return None

        # Skip past events
        if start_date < datetime.now().strftime("%Y-%m-%d"):
            return None

        end_info = event_data.get("end", {})
        end_date, end_time = parse_datetime(end_info.get("local"))

        # Get description
        description = event_data.get("description", {}).get("text", "")
        if description:
            description = description[:1000]

        # Parse price
        price_min, price_max, is_free = parse_price(event_data)

        # Get image
        logo = event_data.get("logo") or {}
        image_url = None
        if logo:
            original = logo.get("original") or {}
            image_url = original.get("url")

        # Get URL
        event_url = event_data.get("url", "")

        # Determine tags
        tags = determine_tags(title, description)

        # Generate content hash
        content_hash = generate_content_hash(title, "MASS Collective", start_date)

        # Check if already exists
        existing = find_event_by_hash(content_hash)
        if existing:
            return {"status": "exists"}

        # Build price note
        price_note = None
        if is_free:
            price_note = "Free"
        elif price_min and price_max:
            if price_min == price_max:
                price_note = f"${price_min:.0f}"
            else:
                price_note = f"${price_min:.0f}-${price_max:.0f}"

        return {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title[:200],
            "description": description if description else None,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date if end_date != start_date else None,
            "end_time": end_time,
            "is_all_day": False,
            "category": "learning",
            "subcategory": "workshop",
            "tags": tags,
            "price_min": price_min,
            "price_max": price_max,
            "price_note": price_note,
            "is_free": is_free,
            "source_url": event_url,
            "ticket_url": event_url,
            "image_url": image_url,
            "raw_text": f"{title} {description}"[:500] if description else title[:500],
            "extraction_confidence": 0.95,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
    except Exception as e:
        logger.error(f"Error processing event: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl MASS Collective events from Eventbrite API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create/get venue
        venue_id = get_or_create_venue(VENUE_DATA)

        # Fetch all events from API
        logger.info(f"Fetching events for MASS Collective (organizer {ORGANIZER_ID})...")
        events_data = fetch_organizer_events()

        if not events_data:
            logger.warning("No events found from API")
            return 0, 0, 0

        logger.info(f"Processing {len(events_data)} events from Eventbrite API")

        for event_data in events_data:
            try:
                events_found += 1

                # Process into our format
                result = process_event(event_data, source_id, venue_id)
                if not result:
                    continue

                if result.get("status") == "exists":
                    events_updated += 1
                    continue

                # Insert event
                insert_event(result)
                events_new += 1
                logger.info(f"Added: {result['title'][:50]}... on {result['start_date']}")

            except Exception as e:
                logger.error(f"Error processing event: {e}")
                continue

        logger.info(
            f"MASS Collective crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl MASS Collective: {e}")
        raise

    return events_found, events_new, events_updated
