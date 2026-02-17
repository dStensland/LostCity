"""
Crawler for Atlanta-Fulton Public Library System events.

Uses the BiblioCommons Events API to fetch events from all library branches.
Includes storytimes, book clubs, computer classes, author talks, and more.
"""

from __future__ import annotations

import logging
import re
import requests
from datetime import datetime
from typing import Optional
from bs4 import BeautifulSoup

from utils import slugify
from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# BiblioCommons API endpoints
API_BASE = "https://gateway.bibliocommons.com/v2/libraries/fulcolibrary"
EVENTS_URL = f"{API_BASE}/events"
LOCATIONS_URL = f"{API_BASE}/locations"
IMAGE_BASE = "https://d2snwnmzyr8jue.cloudfront.net"

# Category mapping based on event types
CATEGORY_MAP = {
    "book": "words",
    "storytime": "words",
    "author": "words",
    "writing": "words",
    "reading": "words",
    "computer": "learning",
    "technology": "learning",
    "esl": "learning",
    "class": "learning",
    "career": "learning",
    "music": "music",
    "film": "film",
    "movie": "film",
    "craft": "art",
    "art": "art",
    "fitness": "fitness",
    "yoga": "fitness",
    "game": "play",
    "gaming": "play",
}


def determine_category(title: str, description: str, type_ids: list) -> str:
    """Determine event category from title and description."""
    text = f"{title} {description}".lower()

    for keyword, category in CATEGORY_MAP.items():
        if keyword in text:
            return category

    return "words"  # Default for library events


def parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse BiblioCommons datetime string to date and time.
    Format: "2026-01-27T10:00" or "2026-01-27T10:00:00Z"
    Returns: (date, time) tuple
    """
    if not dt_str:
        return None, None

    try:
        # Remove timezone if present
        dt_str = dt_str.replace("Z", "")

        # Parse the datetime
        if "T" in dt_str:
            date_part, time_part = dt_str.split("T")
            # Extract just HH:MM
            time_clean = time_part[:5]
            return date_part, time_clean
        else:
            return dt_str[:10], None
    except Exception as e:
        logger.warning(f"Failed to parse datetime '{dt_str}': {e}")
        return None, None


def strip_html(html: str) -> str:
    """Strip HTML tags and clean up description text."""
    if not html:
        return ""

    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    # Clean up whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def fetch_locations() -> dict[str, dict]:
    """Fetch all library branch locations."""
    locations = {}
    page = 1

    try:
        while True:
            url = f"{LOCATIONS_URL}?page={page}&pageSize=50"
            response = requests.get(url, headers={"accept": "application/json"}, timeout=30)
            response.raise_for_status()

            data = response.json()
            entities = data.get("entities", {}).get("locations", {})

            if not entities:
                break

            for loc_id, loc_data in entities.items():
                locations[loc_id] = {
                    "name": loc_data.get("name", ""),
                    "address": loc_data.get("address", {}),
                }

            # Check if there are more pages
            pagination = data.get("locations", {}).get("pagination", {})
            if page >= pagination.get("pages", 1):
                break

            page += 1

        logger.info(f"Fetched {len(locations)} library locations")
        return locations

    except Exception as e:
        logger.error(f"Failed to fetch locations: {e}")
        return {}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Fulton County Library events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Fetch library locations first
        locations = fetch_locations()

        # Fetch events from API (paginated)
        page = 1
        max_pages = 50  # Limit to first 500 events (they have 5000+)

        while page <= max_pages:
            url = f"{EVENTS_URL}?page={page}&pageSize=50"
            logger.info(f"Fetching page {page}: {url}")

            try:
                response = requests.get(url, headers={"accept": "application/json"}, timeout=30)
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                logger.error(f"Failed to fetch/parse JSON from page {page}: {e}")
                break

            # Extract events from entities
            entities = data.get("entities", {}).get("events", {})
            if not entities:
                logger.info(f"No events found on page {page}")
                break

            # Process each event
            for event_id, event_data in entities.items():
                try:
                    events_found += 1

                    # Extract event definition
                    defn = event_data.get("definition", {})

                    # Skip cancelled events
                    if defn.get("isCancelled", False):
                        continue

                    # Parse dates
                    start_date, start_time = parse_datetime(defn.get("start"))
                    end_date, end_time = parse_datetime(defn.get("end"))

                    if not start_date:
                        logger.warning(f"Event {event_id} has no start date, skipping")
                        continue

                    # Skip past events (before today)
                    try:
                        event_date = datetime.strptime(start_date, "%Y-%m-%d")
                        if event_date.date() < datetime.now().date():
                            continue
                    except ValueError:
                        continue

                    # Extract basic info
                    title = defn.get("title", "").strip()
                    if not title:
                        continue

                    description = strip_html(defn.get("description", ""))

                    # Get venue info
                    branch_id = defn.get("branchLocationId")
                    location_details = defn.get("locationDetails", "")

                    if branch_id and branch_id in locations:
                        branch = locations[branch_id]
                        venue_name = branch["name"]
                        address = branch.get("address", {})

                        venue_data = {
                            "name": venue_name,
                            "slug": slugify(venue_name),
                            "address": address.get("street"),
                            "city": address.get("city", "Atlanta"),
                            "state": address.get("region", "GA"),
                            "zip": address.get("postalCode"),
                            "venue_type": "library",
                        }
                    else:
                        # Fallback to generic library venue
                        venue_data = {
                            "name": "Fulton County Library System",
                            "slug": "fulton-county-library-system",
                            "city": "Atlanta",
                            "state": "GA",
                            "venue_type": "library",
                        }

                    venue_id = get_or_create_venue(venue_data)

                    # Build event URL
                    event_url = f"https://fulcolibrary.bibliocommons.com/events/{event_id}"

                    # Get image URL if available
                    image_url = None
                    if defn.get("featuredImageId"):
                        image_url = f"{IMAGE_BASE}/{defn['featuredImageId']}"

                    # Determine category
                    category = determine_category(title, description, defn.get("typeIds", []))

                    # Check for registration info
                    reg_info = defn.get("registrationInfo", {})
                    is_registration_required = bool(reg_info.get("enabledMethods"))

                    # Build full description
                    full_description = description
                    if location_details:
                        full_description = f"{description}\n\nLocation: {location_details}"

                    # Generate content hash
                    content_hash = generate_content_hash(title, venue_data["name"], start_date)

                    # Check if event already exists

                    # Create event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": full_description[:5000] if full_description else None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": None,
                        "tags": ["library", "free", "public"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": event_url if is_registration_required else None,
                        "image_url": image_url,
                        "raw_text": None,
                        "extraction_confidence": 0.95,  # API data is highly reliable
                        "is_recurring": event_data.get("isRecurring", False),
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    # Insert event
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date} at {venue_data['name']}")

                except Exception as e:
                    logger.error(f"Failed to process event {event_id}: {e}")
                    continue

            # Check pagination
            pagination = data.get("events", {}).get("pagination", {})
            total_pages = pagination.get("pages", 1)

            if page >= total_pages:
                break

            page += 1

        logger.info(
            f"Fulton County Library crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Fulton County Library: {e}")
        raise

    return events_found, events_new, events_updated
