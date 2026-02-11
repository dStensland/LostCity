"""
Crawler for Peachtree Road United Methodist Church Music Program.
https://www.prumc.org/music/

Organ recitals, Atlanta Brassworks, Georgia Boy Choir, Three Choirs Festival,
Atlanta Summer Organ Festival, international organists. 20-30 concerts/year,
most free. Historic Buckhead church with 6 organs and 7 choirs.

Uses Tribe Events Calendar API (WordPress plugin).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.prumc.org"
API_URL = f"{BASE_URL}/wp-json/tribe/events/v1/events"

VENUE_DATA = {
    "name": "Peachtree Road United Methodist Church",
    "slug": "peachtree-road-umc",
    "address": "3180 Peachtree Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8440,
    "lng": -84.3690,
    "venue_type": "church",
    "spot_type": "church",
    "website": "https://www.prumc.org/",
    "vibes": ["faith-christian", "methodist", "live-music", "historic", "upscale"],
}

# Skip internal church events that aren't public concerts
SKIP_KEYWORDS = [
    "worship service",
    "sunday school",
    "bible study",
    "prayer group",
    "committee meeting",
    "staff meeting",
    "business meeting",
    "member",
    "lunch menu",
    "food service",
    "midweek community lunch",
    "children's program",
    "youth group",
    "small group",
]

# Public concert indicators
MUSIC_KEYWORDS = [
    "concert",
    "recital",
    "organ",
    "organist",
    "choir",
    "choral",
    "brassworks",
    "georgia boy choir",
    "three choirs",
    "music festival",
    "organ festival",
    "symphony",
    "chamber",
    "ensemble",
]


def parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse API datetime to (date, time) tuple."""
    if not dt_str:
        return None, None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except (ValueError, AttributeError):
        return None, None


def is_music_event(title: str, description: str, categories: list) -> bool:
    """Determine if event is a public concert vs. internal church activity."""
    text = f"{title} {description}".lower()

    # Skip internal church business
    if any(kw in text for kw in SKIP_KEYWORDS):
        return False

    # Include if it has music keywords
    if any(kw in text for kw in MUSIC_KEYWORDS):
        return True

    # Check categories
    if categories:
        category_names = " ".join([cat.get("name", "").lower() for cat in categories])
        if any(kw in category_names for kw in ["music", "concert", "organ", "arts"]):
            return True
        # Skip food service, admin, etc.
        if any(kw in category_names for kw in ["food", "service", "meeting", "lunch"]):
            return False

    # Default: skip unless explicitly music-related
    return False


def categorize_event(title: str, description: str) -> tuple[str, Optional[str]]:
    """Determine category and subcategory."""
    text = f"{title} {description}".lower()

    # Organ recitals/performances
    if "organ" in text and any(kw in text for kw in ["recital", "concert", "performance", "festival"]):
        return "music", "music.classical"

    # Choir/choral
    if any(kw in text for kw in ["choir", "choral", "chorus", "chorale"]):
        return "music", "music.choral"

    # Brass/orchestra
    if any(kw in text for kw in ["brass", "brassworks", "orchestra", "symphony"]):
        return "music", "music.classical"

    # Chamber music
    if any(kw in text for kw in ["chamber", "quartet", "trio", "ensemble"]):
        return "music", "music.classical"

    # General classical
    if any(kw in text for kw in ["classical", "bach", "mozart", "beethoven", "sonata", "concerto"]):
        return "music", "music.classical"

    # Default to music
    return "music", "music.classical"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl PRUMC music events via Tribe Events Calendar API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    try:
        # Fetch events starting from today
        params = {
            "per_page": 100,
            "start_date": datetime.now().strftime("%Y-%m-%dT00:00:00"),
            "order": "asc",
            "orderby": "start_date",
        }

        logger.info(f"Fetching PRUMC events from API: {API_URL}")
        response = requests.get(API_URL, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        events_list = data.get("events", [])
        logger.info(f"Found {len(events_list)} total events from API")

        seen_titles = set()

        for event_data in events_list:
            try:
                title = event_data.get("title", "").strip()
                if not title:
                    continue

                # Extract description (strip HTML tags)
                description = event_data.get("description", "")
                if description:
                    import re
                    description = re.sub(r"<.*?>", "", description)
                    description = description.strip()[:2000]

                # Get categories
                categories = event_data.get("categories", [])

                # Filter: only include public music events
                if not is_music_event(title, description, categories):
                    logger.debug(f"Skipping non-music event: {title}")
                    continue

                # Parse dates
                start_date, start_time = parse_datetime(event_data.get("start_date"))
                end_date, end_time = parse_datetime(event_data.get("end_date"))

                if not start_date:
                    logger.debug(f"No start_date for: {title}")
                    continue

                events_found += 1

                # Dedup by title
                title_key = f"{title}:{start_date}"
                if title_key in seen_titles:
                    continue
                seen_titles.add(title_key)

                # Get source URL
                event_url = event_data.get("url", BASE_URL)

                # Extract image
                image_url = None
                if event_data.get("image"):
                    if isinstance(event_data["image"], dict):
                        image_url = event_data["image"].get("url")
                    elif isinstance(event_data["image"], str) and event_data["image"] != "false":
                        image_url = event_data["image"]

                # Determine if all_day
                is_all_day = event_data.get("all_day", False)

                # Check for duplicates
                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                # Categorize
                category, subcategory = categorize_event(title, description)

                # Build tags
                tags = ["classical", "prumc", "buckhead", "church-concert"]
                if "organ" in title.lower():
                    tags.extend(["organ", "organ-recital"])
                if "choir" in title.lower() or "choral" in title.lower():
                    tags.append("choral")
                if "brass" in title.lower():
                    tags.append("brass")
                if "free" in description.lower() or "no charge" in description.lower():
                    tags.append("free")

                # Determine pricing (most are free, some may have cost info in description)
                is_free = None
                price_note = None
                if "free" in description.lower() or "no charge" in description.lower():
                    is_free = True
                    price_note = "Free admission"
                elif "admission" in description.lower() or "ticket" in description.lower():
                    price_note = "See prumc.org for details"

                # Build event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title[:500],
                    "description": description or f"Music event at Peachtree Road United Methodist Church.",
                    "start_date": start_date,
                    "start_time": start_time if not is_all_day else None,
                    "end_date": end_date,
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
                    "ticket_url": event_url,
                    "image_url": image_url,
                    "raw_text": None,
                    "extraction_confidence": 0.90,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert {title}: {e}")

            except Exception as e:
                logger.debug(f"Error processing event: {e}")
                continue

        logger.info(
            f"PRUMC crawl complete: {events_found} music events found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl PRUMC: {e}")
        raise

    return events_found, events_new, events_updated
