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

# BiblioCommons audience label → age band tags
# Audience label strings are lowercased for matching.
AUDIENCE_TAG_MAP: dict[str, list[str]] = {
    "birth to five": ["infant", "toddler", "preschool", "kids", "family-friendly"],
    "babies": ["infant", "kids", "family-friendly"],
    "toddlers": ["toddler", "kids", "family-friendly"],
    "preschool": ["preschool", "kids", "family-friendly"],
    "children": ["elementary", "kids", "family-friendly"],
    "kids": ["elementary", "kids", "family-friendly"],
    "elementary": ["elementary", "kids", "family-friendly"],
    "middle school": ["teen", "kids", "family-friendly"],
    "tweens": ["teen", "kids", "family-friendly"],
    "teens": ["teen"],
    "young adults": ["teen"],
    "adults": ["adults"],
    "seniors": ["adults", "seniors"],
    "all ages": ["family-friendly"],
    "families": ["family-friendly", "kids"],
}

# Audience labels that indicate child/family content → override category to "family"
FAMILY_AUDIENCE_KEYWORDS = {
    "birth to five",
    "babies",
    "toddlers",
    "preschool",
    "children",
    "kids",
    "elementary",
    "middle school",
    "tweens",
    "families",
    "all ages",
}


def audience_tags_and_category(
    audience_ids: list, entities: dict
) -> tuple[list[str], bool]:
    """
    Derive age-band tags and whether to set category="family" from BiblioCommons
    audience data.

    Args:
        audience_ids: list of audience ID strings from the event definition.
        entities: the full entities dict from the API response (contains
                  "eventAudiences" keyed by ID).

    Returns:
        (tags, is_family_category) tuple.
        tags: list of age-band tag strings to add.
        is_family_category: True when at least one child/family audience is present.
    """
    if not audience_ids:
        return [], False

    audience_lookup = entities.get("eventAudiences", {})
    tags: list[str] = []
    is_family = False

    for aud_id in audience_ids:
        aud_obj = audience_lookup.get(str(aud_id), {})
        # BiblioCommons returns the label in a "name" field
        label = (aud_obj.get("name") or aud_obj.get("label") or "").strip().lower()
        if not label:
            continue

        # Match against known audience labels
        matched = False
        for key, tag_list in AUDIENCE_TAG_MAP.items():
            if key in label:
                for t in tag_list:
                    if t not in tags:
                        tags.append(t)
                if key in FAMILY_AUDIENCE_KEYWORDS:
                    is_family = True
                matched = True
                break

        if not matched:
            # Partial fallback: detect child-related words in the label
            if any(w in label for w in ["child", "kid", "baby", "infant", "toddler", "preschool", "storytime"]):
                for t in ["kids", "family-friendly"]:
                    if t not in tags:
                        tags.append(t)
                is_family = True
            elif "teen" in label or "tween" in label or "young adult" in label:
                if "teen" not in tags:
                    tags.append("teen")
            elif "adult" in label and "young adult" not in label:
                if "adults" not in tags:
                    tags.append("adults")

    return tags, is_family


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


def format_time_label(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).strftime("%-I:%M %p")
        except ValueError:
            continue
    return raw


def build_library_description(
    *,
    title: str,
    base_description: str,
    location_details: str,
    start_date: Optional[str],
    start_time: Optional[str],
    end_time: Optional[str],
    venue_data: dict,
    category: str,
    is_registration_required: bool,
    event_url: str,
) -> str:
    description = (base_description or "").strip()
    venue_name = str(venue_data.get("name") or "Fulton County Library System").strip()
    city = str(venue_data.get("city") or "Atlanta").strip()
    state = str(venue_data.get("state") or "GA").strip()
    time_label = format_time_label(start_time)
    end_label = format_time_label(end_time)

    parts: list[str] = []
    if description and len(description) >= 140:
        parts.append(description if description.endswith(".") else f"{description}.")
    elif description:
        parts.append(description if description.endswith(".") else f"{description}.")
        parts.append(f"Fulton County Library {category.replace('_', ' ')} program.")
    else:
        parts.append(f"Fulton County Library {category.replace('_', ' ')} program: {title}.")

    if location_details:
        parts.append(f"Location details: {location_details}.")
    else:
        parts.append(f"Location: {venue_name}, {city}, {state}.")

    if start_date and time_label and end_label:
        parts.append(f"Scheduled on {start_date} from {time_label} to {end_label}.")
    elif start_date and time_label:
        parts.append(f"Scheduled on {start_date} at {time_label}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    if is_registration_required:
        parts.append("Registration may be required; capacity and waitlists vary by branch.")
    else:
        parts.append("Open community program; check listing for current attendance details.")

    if event_url:
        parts.append(f"Confirm details and updates on the official library event listing ({event_url}).")
    return " ".join(parts)[:5000]


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
            all_entities = data.get("entities", {})
            entities = all_entities.get("events", {})
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

                    # Determine category from title/description keywords
                    category = determine_category(title, description, defn.get("typeIds", []))

                    # Derive age-band tags and family category from BiblioCommons audience data
                    audience_ids = defn.get("audienceIds", [])
                    audience_tags, is_family_audience = audience_tags_and_category(
                        audience_ids, all_entities
                    )

                    # Audience data overrides category to "family" when child/family content
                    if is_family_audience:
                        category = "family"

                    # Build tag list: base tags + audience-derived tags (deduplicated)
                    base_tags = ["library", "free", "public"]
                    tags = base_tags + [t for t in audience_tags if t not in base_tags]

                    # Check for registration info
                    reg_info = defn.get("registrationInfo", {})
                    is_registration_required = bool(reg_info.get("enabledMethods"))

                    # Generate content hash
                    content_hash = generate_content_hash(title, venue_data["name"], start_date)

                    # Check if event already exists

                    # Create event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": build_library_description(
                            title=title,
                            base_description=description,
                            location_details=location_details,
                            start_date=start_date,
                            start_time=start_time,
                            end_time=end_time,
                            venue_data=venue_data,
                            category=category,
                            is_registration_required=is_registration_required,
                            event_url=event_url,
                        ),
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": None,
                        "tags": tags,
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
