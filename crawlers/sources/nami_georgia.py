"""
Crawler for NAMI Georgia (namiga.org).

National Alliance on Mental Illness - Georgia chapter. Events include support groups,
training sessions, volunteer orientations, advocacy events, and mental health education.

Uses The Events Calendar WordPress plugin with REST API.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://namiga.org"
API_URL = f"{BASE_URL}/wp-json/tribe/events/v1/events"

VENUE_DATA = {
    "name": "NAMI Georgia",
    "slug": "nami-georgia",
    "address": "4120 Presidential Parkway Ste 200",
    "neighborhood": "Chamblee",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30340",
    "lat": 33.8839,
    "lng": -84.2943,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["mental-health", "support", "education"],
}

# Skip staff meetings and internal events
SKIP_KEYWORDS = [
    "staff meeting",
    "board meeting",
    "committee",
    "internal",
    "closed",
    "private",
    "executive",
]

# Training/education event indicators
TRAINING_KEYWORDS = [
    "training",
    "orientation",
    "workshop",
    "class",
    "education",
    "learning",
    "certification",
    "course",
]

# Support group indicators
SUPPORT_KEYWORDS = [
    "support group",
    "peer support",
    "family support",
    "caregiver",
    "group meeting",
]

# Volunteer event indicators
VOLUNTEER_KEYWORDS = [
    "volunteer",
    "volunteering",
    "orientation",
]

# Advocacy event indicators
ADVOCACY_KEYWORDS = [
    "advocacy",
    "rally",
    "awareness",
    "campaign",
    "lobby",
]


def parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse ISO datetime string to date and time.
    Returns (YYYY-MM-DD, HH:MM) tuple.
    """
    if not dt_str:
        return None, None

    try:
        # Parse ISO format: "2026-02-14 10:00:00"
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


def determine_category_and_tags(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["mental-health", "nonprofit"]

    # Training/education events
    if any(kw in text for kw in TRAINING_KEYWORDS):
        tags.extend(["education", "training"])
        return "learning", "workshop", tags

    # Support group events
    if any(kw in text for kw in SUPPORT_KEYWORDS):
        tags.extend(["support-group", "free"])
        return "wellness", None, tags

    # Volunteer events
    if any(kw in text for kw in VOLUNTEER_KEYWORDS):
        tags.append("volunteer")
        return "community", "volunteer", tags

    # Advocacy events
    if any(kw in text for kw in ADVOCACY_KEYWORDS):
        tags.append("advocacy")
        return "community", None, tags

    # Check for specific topics
    if any(kw in text for kw in ["family", "families", "caregiver"]):
        tags.append("family-support")

    if any(kw in text for kw in ["youth", "teen", "young adult", "adolescent"]):
        tags.append("youth")

    if any(kw in text for kw in ["peer", "peers"]):
        tags.append("peer-support")

    if any(kw in text for kw in ["crisis", "hotline", "emergency"]):
        tags.append("crisis-support")

    if any(kw in text for kw in ["wellness", "recovery", "health"]):
        tags.append("wellness")

    # Default to wellness
    return "wellness", None, tags


def is_public_event(title: str, description: str) -> bool:
    """Determine if event is public vs. internal."""
    text = f"{title} {description}".lower()

    # Skip internal events
    if any(kw in text for kw in SKIP_KEYWORDS):
        return False

    # Most events are public
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl NAMI Georgia events using The Events Calendar REST API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

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

            logger.info(f"Fetching NAMI Georgia events API page {page}")
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

                    # Dedupe by title and date
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "NAMI Georgia", start_date
                    )

                    # Check for existing

                    # Determine category and tags
                    category, subcategory, tags = determine_category_and_tags(title, description)

                    # Check if all day
                    all_day = event_data.get("all_day", False)
                    is_all_day = bool(all_day)

                    # Get image
                    image_url = None
                    if event_data.get("image"):
                        image_url = event_data["image"].get("url")

                    # Check if free (many NAMI events are free)
                    cost_text = f"{title} {description}".lower()
                    is_free = "free" in cost_text or "no cost" in cost_text or "complimentary" in cost_text

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
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} {description}"[:500],
                        "extraction_confidence": 0.9,
                        "is_recurring": False,
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
            f"NAMI Georgia crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch NAMI Georgia events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl NAMI Georgia: {e}")
        raise

    return events_found, events_new, events_updated
