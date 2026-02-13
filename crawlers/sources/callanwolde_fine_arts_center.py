"""
Crawler for Callanwolde Fine Arts Center (callanwolde.org).

Historic Gothic-Revival mansion in Druid Hills offering pottery, dance, yoga,
painting, drawing, jewelry, photography, writing, kids programs, and more.

Uses The Events Calendar WordPress plugin with REST API.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://callanwolde.org"
API_URL = f"{BASE_URL}/wp-json/tribe/events/v1/events"

VENUE_DATA = {
    "name": "Callanwolde Fine Arts Center",
    "slug": "callanwolde-fine-arts-center",
    "address": "980 Briarcliff Rd NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7858,
    "lng": -84.3398,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": ["workshop", "creative", "hands-on", "art-class", "historic", "pottery"],
}

# Skip staff meetings and internal events
SKIP_KEYWORDS = [
    "staff meeting",
    "board meeting",
    "committee",
    "internal",
    "closed",
    "private",
    "board of directors",
]


def parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse ISO datetime string to date and time.
    Returns (YYYY-MM-DD, HH:MM) tuple.
    """
    if not dt_str:
        return None, None

    try:
        # Parse ISO format: "2026-02-14 10:00:00" or "2026-02-14T10:00:00"
        dt = datetime.fromisoformat(dt_str.replace("T", " ").split("+")[0].split("Z")[0].strip())
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse datetime '{dt_str}': {e}")
        return None, None


def strip_html(html: str) -> str:
    """Strip HTML tags and clean up text."""
    if not html:
        return ""

    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    # Clean up multiple spaces
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_cost(cost_str: str, website_url: str) -> tuple[bool, Optional[str]]:
    """
    Parse cost field from API.
    Returns (is_free: bool, price_note: Optional[str]).

    Most Callanwolde classes require registration and have fees, even though
    the API doesn't populate the cost field. We infer paid vs. free based on
    whether there's a registration link.
    """
    if not cost_str:
        # If there's a registration link, assume paid
        if website_url and "campscui.active.com" in website_url:
            return False, "Registration required"
        # Otherwise, might be free or cost unknown
        return True, None

    cost_clean = cost_str.strip()

    # Check if explicitly free
    if cost_clean.lower() in ["free", "$0", "$0.00", "0", "no cost"]:
        return True, None

    # Otherwise, return as paid with price note
    return False, cost_clean


def determine_category_and_tags(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category, subcategory, and tags based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["art-class", "creative"]

    # Pottery/ceramics
    if any(kw in text for kw in ["pottery", "ceramics", "wheel", "clay", "kiln"]):
        tags.extend(["pottery", "ceramics", "hands-on"])
        return "learning", "workshop", tags

    # Dance classes
    if any(kw in text for kw in ["dance", "ballet", "hip-hop", "hip hop", "creative movement", "contemporary dance", "tap dance"]):
        tags.append("dance")
        return "learning", "class", tags

    # Yoga/wellness
    if any(kw in text for kw in ["yoga", "tai chi", "meditation", "wellness", "mindfulness"]):
        tags.extend(["yoga", "wellness"])
        if "yoga" in text:
            return "fitness", "yoga", tags
        return "fitness", "class", tags

    # Painting/drawing
    if any(kw in text for kw in ["painting", "drawing", "sketch", "watercolor", "acrylic", "oil painting", "pastel"]):
        tags.extend(["painting", "art-class"])
        return "learning", "workshop", tags

    # Photography
    if any(kw in text for kw in ["photography", "photo", "camera", "darkroom"]):
        tags.append("photography")
        return "learning", "workshop", tags

    # Writing/poetry
    if any(kw in text for kw in ["writing", "poetry", "creative writing", "journaling", "memoir"]):
        tags.extend(["writing", "creative-writing"])
        return "learning", "workshop", tags

    # Jewelry/crafts
    if any(kw in text for kw in ["jewelry", "metalwork", "beading", "silversmith"]):
        tags.append("hands-on")
        return "learning", "workshop", tags

    # Music performances/concerts
    if any(kw in text for kw in ["concert", "recital", "performance", "symphony", "chamber music"]):
        tags.append("performance")
        return "music", "performance", tags

    # Theater/performances
    if any(kw in text for kw in ["theater", "theatre", "play", "drama"]):
        tags.append("performance")
        return "art", "performance", tags

    # Kids/family programs
    if any(kw in text for kw in ["kids", "children", "youth", "family", "toddler", "preschool"]):
        tags.append("family-friendly")
        return "learning", "class", tags

    # Workshops in general
    if any(kw in text for kw in ["workshop", "class", "lesson", "instruction"]):
        return "learning", "workshop", tags

    # Exhibitions/galleries
    if any(kw in text for kw in ["exhibition", "exhibit", "gallery", "opening"]):
        tags.append("gallery")
        return "art", "exhibition", tags

    # Default to learning/class
    return "learning", "class", tags


def is_public_event(title: str, description: str) -> bool:
    """Determine if event is public vs. internal."""
    text = f"{title} {description}".lower()

    # Skip internal events
    if any(kw in text for kw in SKIP_KEYWORDS):
        return False

    # Most events are public classes/workshops
    return True


def extract_venue_from_api(venue_data: dict) -> Optional[int]:
    """
    Extract venue information from API response and get or create venue.
    Returns venue_id or None if we should use the default Callanwolde venue.
    """
    if not venue_data:
        return None

    venue_name = venue_data.get("venue", "").strip()
    if not venue_name or venue_name == "Callanwolde Fine Arts Center":
        return None  # Use default venue

    # Extract address info
    address = venue_data.get("address", "").strip()
    city = venue_data.get("city", "").strip()
    state = venue_data.get("state", "").strip()
    zip_code = venue_data.get("zip", "").strip()

    if not address or not city:
        return None  # Not enough info, use default

    # Create venue record for satellite location
    satellite_venue = {
        "name": venue_name,
        "slug": re.sub(r"[^a-z0-9]+", "-", venue_name.lower()).strip("-"),
        "address": address,
        "city": city,
        "state": state or "GA",
        "zip": zip_code,
        "venue_type": "venue",
        "spot_type": "venue",
    }

    try:
        return get_or_create_venue(satellite_venue)
    except Exception as e:
        logger.debug(f"Could not create satellite venue '{venue_name}': {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Callanwolde Fine Arts Center events using The Events Calendar REST API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        default_venue_id = get_or_create_venue(VENUE_DATA)

        # Fetch events from API
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)",
        }

        page = 1
        per_page = 50
        seen_events = set()

        while True:
            params = {
                "per_page": per_page,
                "page": page,
                "start_date": datetime.now().strftime("%Y-%m-%d"),
            }

            logger.info(f"Fetching Callanwolde events API page {page}")
            response = requests.get(API_URL, params=params, headers=headers, timeout=30)
            response.raise_for_status()

            data = response.json()
            events = data.get("events", [])

            if not events:
                logger.info(f"No more events on page {page}")
                break

            logger.info(f"Processing {len(events)} events from page {page}")

            for event_data in events:
                try:
                    title = event_data.get("title", "").strip()

                    if not title or len(title) < 5:
                        continue

                    # Parse dates and times
                    start_date_str = event_data.get("start_date")
                    end_date_str = event_data.get("end_date")

                    start_date, start_time = parse_datetime(start_date_str)
                    end_date, end_time = parse_datetime(end_date_str) if end_date_str else (None, None)

                    if not start_date:
                        logger.debug(f"No valid date for: {title}")
                        continue

                    # Extract description (HTML)
                    description_html = event_data.get("description", "")
                    description = strip_html(description_html)[:500]

                    # Get URL
                    event_url = event_data.get("url", f"{BASE_URL}/events/")

                    # Check if public
                    if not is_public_event(title, description):
                        logger.debug(f"Skipping internal event: {title}")
                        continue

                    # Determine venue (satellite location or default Callanwolde)
                    venue_api_data = event_data.get("venue")
                    venue_id = extract_venue_from_api(venue_api_data)
                    if not venue_id:
                        venue_id = default_venue_id

                    # Dedupe by title and date
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Callanwolde Fine Arts Center", start_date
                    )

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Determine category and tags
                    category, subcategory, tags = determine_category_and_tags(title, description)

                    # Check if all day
                    all_day = event_data.get("all_day", False)
                    is_all_day = bool(all_day)

                    # Get image
                    image_url = None
                    if event_data.get("image"):
                        image_url = event_data["image"].get("url")

                    # Get registration/ticket URL (may differ from event page URL)
                    website_url = event_data.get("website", "")

                    # Parse cost
                    cost_str = event_data.get("cost", "")
                    is_free, price_note = parse_cost(cost_str, website_url)

                    # Build event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:200],
                        "description": description if description else None,
                        "start_date": start_date,
                        "start_time": start_time if not is_all_day else None,
                        "end_date": end_date if end_date != start_date else None,
                        "end_time": end_time if not is_all_day else None,
                        "is_all_day": is_all_day,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": website_url if website_url else event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} {description}"[:500],
                        "extraction_confidence": 0.9,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title[:50]}... on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.error(f"Error processing event: {e}")
                    continue

            # Check if there are more pages
            total_pages = data.get("total_pages", 1)
            if page >= total_pages:
                break

            page += 1

        logger.info(
            f"Callanwolde crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch Callanwolde events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Callanwolde: {e}")
        raise

    return events_found, events_new, events_updated
