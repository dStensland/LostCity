"""
Crawler for Oglethorpe University Events.
Arts, lectures, athletics, and museum events at the liberal arts university in Brookhaven.
"""

import json
import logging
import re
from datetime import datetime
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://oglethorpe.edu"
EVENTS_URL = f"{BASE_URL}/events"

VENUES = {
    "museum": {
        "name": "Oglethorpe University Museum of Art",
        "slug": "oglethorpe-museum",
        "address": "4484 Peachtree Road NE",
        "neighborhood": "Brookhaven",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30319",
        "venue_type": "museum",
        "website": "https://museum.oglethorpe.edu",
    },
    "default": {
        "name": "Oglethorpe University",
        "slug": "oglethorpe-university",
        "address": "4484 Peachtree Road NE",
        "neighborhood": "Brookhaven",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30319",
        "venue_type": "university",
        "website": "https://oglethorpe.edu",
    },
}


def parse_jsonld_events(soup: BeautifulSoup) -> list[dict]:
    """Extract Event data from JSON-LD scripts."""
    events = []
    scripts = soup.find_all("script", type="application/ld+json")

    for script in scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                if data.get("@type") == "Event":
                    events.append(data)
                if "@graph" in data:
                    events.extend([e for e in data["@graph"] if e.get("@type") == "Event"])
            elif isinstance(data, list):
                events.extend([e for e in data if e.get("@type") == "Event"])
        except (json.JSONDecodeError, TypeError):
            continue

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Oglethorpe University events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_data = VENUES["default"]
        venue_id = get_or_create_venue(venue_data)

        # Try JSON-LD first
        json_events = parse_jsonld_events(soup)

        for event_data in json_events:
            events_found += 1
            title = event_data.get("name", "").strip()
            if not title:
                continue

            start_date = event_data.get("startDate", "")[:10] if event_data.get("startDate") else None
            if not start_date:
                continue

            # Determine venue based on event type
            title_lower = title.lower()
            if "museum" in title_lower or "exhibition" in title_lower or "art" in title_lower:
                venue_data = VENUES["museum"]
                venue_id = get_or_create_venue(venue_data)
                category, subcategory = "art", "exhibition"
            elif any(w in title_lower for w in ["athletics", "game", "petrels"]):
                category, subcategory = "sports", "college"
            elif any(w in title_lower for w in ["theater", "theatre", "performance"]):
                category, subcategory = "theater", "performance"
            else:
                category, subcategory = "community", "campus"

            content_hash = generate_content_hash(title, venue_data["name"], start_date)
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": event_data.get("description", f"Event at Oglethorpe University in Brookhaven")[:500],
                "start_date": start_date,
                "start_time": None,
                "end_date": None,
                "end_time": None,
                "is_all_day": True,
                "category": category,
                "subcategory": subcategory,
                "tags": ["college", "oglethorpe", "brookhaven"],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": EVENTS_URL,
                "ticket_url": None,
                "image_url": event_data.get("image"),
                "raw_text": json.dumps(event_data),
                "extraction_confidence": 0.85,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
            except Exception as e:
                logger.error(f"Failed to insert {title}: {e}")

        logger.info(f"Oglethorpe University: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Oglethorpe University: {e}")
        raise

    return events_found, events_new, events_updated
