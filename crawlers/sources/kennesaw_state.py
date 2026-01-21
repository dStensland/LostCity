"""
Crawler for Kennesaw State University (kennesaw.edu, ksuowls.com).
ArtsKSU performances, athletics, and campus events.
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

BASE_URL = "https://www.kennesaw.edu"
ARTS_URL = f"{BASE_URL}/arts/concerts-events/index.php"
ATHLETICS_URL = "https://ksuowls.com/calendar"

VENUES = {
    "stadium": {
        "name": "Fifth Third Bank Stadium",
        "slug": "fifth-third-bank-stadium",
        "address": "3200 George Busbee Parkway NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "stadium",
        "website": "https://ksuowls.com",
    },
    "bailey": {
        "name": "Bailey Performance Center",
        "slug": "bailey-performance-center",
        "address": "488 Prillaman Way",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "performing_arts",
        "website": "https://arts.kennesaw.edu",
    },
    "default": {
        "name": "Kennesaw State University",
        "slug": "kennesaw-state-university",
        "address": "1000 Chastain Road NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "university",
        "website": "https://kennesaw.edu",
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
                if data.get("@type") in ["Event", "SportsEvent"]:
                    events.append(data)
                if "@graph" in data:
                    events.extend([e for e in data["@graph"] if e.get("@type") in ["Event", "SportsEvent"]])
            elif isinstance(data, list):
                events.extend([e for e in data if e.get("@type") in ["Event", "SportsEvent"]])
        except (json.JSONDecodeError, TypeError):
            continue

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Kennesaw State events and athletics."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    # Crawl arts events
    try:
        response = requests.get(ARTS_URL, headers=headers, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        venue_data = VENUES["bailey"]
        venue_id = get_or_create_venue(venue_data)

        # Check for JSON-LD events
        json_events = parse_jsonld_events(soup)

        for event_data in json_events:
            events_found += 1
            title = event_data.get("name", "").strip()
            if not title:
                continue

            start_date = event_data.get("startDate", "")[:10] if event_data.get("startDate") else None
            if not start_date:
                continue

            content_hash = generate_content_hash(title, venue_data["name"], start_date)
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": event_data.get("description", f"Performance at Bailey Performance Center, Kennesaw State University")[:500],
                "start_date": start_date,
                "start_time": None,
                "end_date": None,
                "end_time": None,
                "is_all_day": True,
                "category": "music",
                "subcategory": "concert",
                "tags": ["college", "kennesaw-state", "arts-ksu", "classical"],
                "price_min": None,
                "price_max": None,
                "price_note": "Check arts.kennesaw.edu for tickets",
                "is_free": False,
                "source_url": ARTS_URL,
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

    except requests.RequestException as e:
        logger.warning(f"Failed to fetch KSU arts events: {e}")

    # Crawl athletics
    try:
        response = requests.get(ATHLETICS_URL, headers=headers, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        venue_data = VENUES["stadium"]
        venue_id = get_or_create_venue(venue_data)

        json_events = parse_jsonld_events(soup)

        for event_data in json_events:
            events_found += 1
            title = event_data.get("name", "").strip()
            if not title:
                continue

            # Prefix with KSU for clarity
            if not title.lower().startswith("ksu"):
                title = f"KSU Owls: {title}"

            start_date = event_data.get("startDate", "")[:10] if event_data.get("startDate") else None
            if not start_date:
                continue

            content_hash = generate_content_hash(title, venue_data["name"], start_date)
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": event_data.get("description", f"KSU Owls athletic event")[:500],
                "start_date": start_date,
                "start_time": None,
                "end_date": None,
                "end_time": None,
                "is_all_day": True,
                "category": "sports",
                "subcategory": "college",
                "tags": ["college", "kennesaw-state", "owls", "sports"],
                "price_min": None,
                "price_max": None,
                "price_note": "Check ksuowls.com for tickets",
                "is_free": False,
                "source_url": ATHLETICS_URL,
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

    except requests.RequestException as e:
        logger.warning(f"Failed to fetch KSU athletics: {e}")

    logger.info(f"Kennesaw State: Found {events_found} events, {events_new} new, {events_updated} existing")
    return events_found, events_new, events_updated
