"""
Crawler for Concerts@First (First Presbyterian Church of Atlanta).
https://concertsatfirst.org/

Classical concerts, Bach's Lunch series, organ recitals, choral performances at
First Presbyterian Church Atlanta. 20-30 FREE concerts/year in Midtown.

Uses Tribe Events Calendar API (WordPress plugin).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://concertsatfirst.org"
API_URL = f"{BASE_URL}/wp-json/tribe/events/v1/events"

VENUE_DATA = {
    "name": "First Presbyterian Church of Atlanta",
    "slug": "first-presbyterian-atlanta",
    "address": "1328 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7889,
    "lng": -84.3834,
    "venue_type": "church",
    "spot_type": "church",
    "website": "https://www.firstpresatl.org/",
    "vibes": ["faith-christian", "presbyterian", "live-music", "historic"],
}


def parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse API datetime to (date, time) tuple."""
    if not dt_str:
        return None, None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except (ValueError, AttributeError):
        return None, None


def categorize_event(title: str, description: str) -> tuple[str, Optional[str]]:
    """Determine category and subcategory."""
    text = f"{title} {description}".lower()

    # Bach's Lunch is a recurring series
    if "bach's lunch" in text or "bachs lunch" in text:
        return "music", "music.classical"

    # Organ recitals
    if "organ" in text and any(kw in text for kw in ["recital", "concert", "performance"]):
        return "music", "music.classical"

    # Choir/choral
    if any(kw in text for kw in ["choir", "choral", "chorus", "chorale"]):
        return "music", "music.choral"

    # Chamber music
    if any(kw in text for kw in ["chamber", "quartet", "trio", "ensemble"]):
        return "music", "music.classical"

    # General classical music
    if any(kw in text for kw in ["symphony", "concerto", "sonata", "brahms", "mozart", "bach"]):
        return "music", "music.classical"

    # Default to music
    return "music", "music.classical"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Concerts@First via Tribe Events Calendar API."""
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

        logger.info(f"Fetching Concerts@First events from API: {API_URL}")
        response = requests.get(API_URL, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        events_list = data.get("events", [])
        logger.info(f"Found {len(events_list)} events from API")

        seen_titles = set()

        for event_data in events_list:
            try:
                title = event_data.get("title", "").strip()
                if not title:
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

                # Extract description (strip HTML tags)
                description = event_data.get("description", "")
                if description:
                    # Basic HTML tag removal
                    import re
                    description = re.sub(r"<.*?>", "", description)
                    description = description.strip()[:2000]

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

                # Categorize
                category, subcategory = categorize_event(title, description)

                # Build tags
                tags = ["classical", "concerts-at-first", "free", "midtown", "church-concert"]
                if "bach" in title.lower():
                    tags.append("bach")
                if "organ" in title.lower():
                    tags.append("organ")
                if "choir" in title.lower() or "choral" in title.lower():
                    tags.append("choral")

                # Build event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title[:500],
                    "description": description or f"Classical concert at First Presbyterian Church Atlanta.",
                    "start_date": start_date,
                    "start_time": start_time if not is_all_day else None,
                    "end_date": end_date,
                    "end_time": end_time if not is_all_day else None,
                    "is_all_day": is_all_day,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": 0,
                    "price_max": 0,
                    "price_note": "Free admission - donations welcome",
                    "is_free": True,
                    "source_url": event_url,
                    "ticket_url": event_url,
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
            f"Concerts@First crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Concerts@First: {e}")
        raise

    return events_found, events_new, events_updated
