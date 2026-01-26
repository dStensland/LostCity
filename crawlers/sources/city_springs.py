"""
Crawler for City Springs events (citysprings.com/events).

Sandy Springs mixed-use development featuring:
- Sandy Springs Performing Arts Center (concerts, theater)
- City Green (outdoor events, fitness classes)
- Community events (Cornhole ATL, Fit4Mom classes)

Uses Gatsby page-data.json API for efficient data extraction.
"""

from __future__ import annotations

import re
import logging
import requests
from datetime import datetime
from typing import Optional

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://citysprings.com"
JSON_URL = "https://citysprings.com/page-data/events/page-data.json"

# Venue definitions
VENUES = {
    "city-green": {
        "name": "City Green",
        "slug": "city-green",
        "address": "1 Galambos Way",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9304,
        "lng": -84.3733,
        "venue_type": "outdoor",
        "spot_type": "outdoor",
        "website": BASE_URL,
    },
    "performing-arts-center": {
        "name": "Sandy Springs Performing Arts Center",
        "slug": "sandy-springs-pac",
        "address": "1 Galambos Way",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9304,
        "lng": -84.3733,
        "venue_type": "theater",
        "spot_type": "theater",
        "website": BASE_URL,
    },
}


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from '11:00am' or '7:00 PM' format to HH:MM."""
    if not time_str:
        return None

    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_str, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def determine_venue(venue_title: str) -> str:
    """Determine which venue to use based on venue name."""
    venue_lower = venue_title.lower()

    if "city green" in venue_lower or "outdoor" in venue_lower:
        return "city-green"
    elif "performing arts" in venue_lower or "theater" in venue_lower or "byers theatre" in venue_lower:
        return "performing-arts-center"

    # Default to City Green for outdoor/community events
    return "city-green"


def determine_category_and_tags(event_node: dict) -> tuple[str, Optional[str], list[str]]:
    """Determine category, subcategory, and tags from event data."""
    title_lower = event_node.get("title", "").lower()
    venue = event_node.get("relationships", {}).get("field_venue", {})
    venue_title = venue.get("title", "").lower() if venue else ""
    tags_data = event_node.get("relationships", {}).get("field_tags", [])
    series_data = event_node.get("relationships", {}).get("field_series", {})

    # Start with basic tags
    tags = ["sandy-springs", "city-springs"]

    # Add venue-specific tags
    if "city green" in venue_title:
        tags.extend(["outdoor", "city-green"])
    elif "performing arts" in venue_title:
        tags.extend(["performing-arts", "indoor"])

    # Add tags from field_tags
    for tag in tags_data:
        tag_name = tag.get("name", "").lower()
        if tag_name:
            tags.append(tag_name.replace(" ", "-"))

    # Add series tag if present
    if series_data and series_data.get("name"):
        series_name = series_data.get("name", "").lower().replace(" ", "-")
        tags.append(series_name)

    # Determine category and subcategory
    category = "community"
    subcategory = None

    # Music
    if any(word in title_lower for word in ["concert", "music", "band", "orchestra", "symphony"]):
        category = "music"
        if "jazz" in title_lower:
            subcategory = "jazz"
        elif "classical" in title_lower:
            subcategory = "classical"
        elif "rock" in title_lower or "pop" in title_lower:
            subcategory = "rock-pop"
        tags.append("music")

    # Theater
    elif any(word in title_lower for word in ["play", "theater", "theatre", "musical", "performance"]):
        category = "theater"
        if "musical" in title_lower:
            subcategory = "musical"
        else:
            subcategory = "play"
        tags.append("theater")

    # Family/Kids
    elif any(word in title_lower for word in ["family", "kids", "children"]):
        tags.append("family-friendly")

    # Fitness
    elif any(word in title_lower for word in ["fitness", "yoga", "fit4mom", "workout"]):
        category = "sports"
        subcategory = "fitness"
        tags.append("fitness")

    # Holidays
    elif any(word in title_lower for word in ["holiday", "christmas", "skate", "ice skating"]):
        tags.append("holiday")
        tags.append("seasonal")

    # Games/Competition
    elif any(word in title_lower for word in ["cornhole", "game", "tournament"]):
        category = "sports"
        subcategory = "recreation"
        tags.append("games")

    # Food/Market
    elif any(word in title_lower for word in ["market", "food", "vendor"]):
        category = "food"
        tags.append("market")

    return category, subcategory, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City Springs events from Gatsby page-data.json."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Create venue mappings
    venue_ids = {}
    for key, venue_data in VENUES.items():
        venue_ids[key] = get_or_create_venue(venue_data)

    try:
        logger.info(f"Fetching City Springs events from: {JSON_URL}")

        response = requests.get(JSON_URL, timeout=30)
        if response.status_code != 200:
            logger.error(f"Failed to fetch City Springs data: HTTP {response.status_code}")
            return events_found, events_new, events_updated

        data = response.json()

        # Navigate to events data
        events = data.get("result", {}).get("data", {}).get("allNodeEvent", {}).get("edges", [])

        for edge in events:
            node = edge.get("node", {})

            # Extract basic info
            title = node.get("title")
            if not title:
                continue

            # Extract date info
            date_obj = node.get("date", {})
            start_date = date_obj.get("start")
            end_date = date_obj.get("end")
            time_str = date_obj.get("time")

            if not start_date:
                logger.warning(f"Skipping event without start date: {title}")
                continue

            # Parse time
            start_time = parse_time(time_str) if time_str else None

            # Extract venue
            venue_rel = node.get("relationships", {}).get("field_venue")
            if venue_rel and venue_rel.get("title"):
                venue_title = venue_rel.get("title")
            else:
                # Default to City Green if no venue specified
                venue_title = "City Green"
            venue_key = determine_venue(venue_title)
            venue_id = venue_ids[venue_key]

            # Extract description
            body_obj = node.get("body", {})
            description = body_obj.get("summary", "").strip()
            if not description:
                description = f"Event at {venue_title}"

            # Build event URL
            path_obj = node.get("path", {})
            path_alias = path_obj.get("alias", "")
            event_url = f"{BASE_URL}{path_alias}" if path_alias else BASE_URL

            # Extract image
            image_url = None
            try:
                img_rel = node.get("relationships", {}).get("field_image", {})
                img_data = img_rel.get("max_1600_16_9", {}).get("childImageSharp", {}).get("contentTeaser", {})
                img_src = img_data.get("src")
                if img_src:
                    image_url = f"{BASE_URL}{img_src}" if img_src.startswith("/") else img_src
            except (KeyError, AttributeError):
                pass

            # Determine category and tags
            category, subcategory, tags = determine_category_and_tags(node)

            events_found += 1

            # Generate content hash
            content_hash = generate_content_hash(title, venue_title, start_date)

            # Check if event exists
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Create event record
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": None,
                "is_all_day": start_time is None,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": None,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": image_url,
                "raw_text": f"{title} | {venue_title} | {start_date}",
                "extraction_confidence": 0.95,
                "is_recurring": end_date is not None and end_date != start_date,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} at {venue_title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert event '{title}': {e}")

        logger.info(
            f"City Springs crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl City Springs: {e}")
        raise

    return events_found, events_new, events_updated
