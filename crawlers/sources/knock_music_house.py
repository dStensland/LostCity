"""
Crawler for Knock Music House (knockmusichouse.com).
Live music venue and event spaces on Cheshire Bridge Road.
Uses Wix platform - may need Playwright for dynamic content.
"""

import json
import logging
from datetime import datetime
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.knockmusichouse.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Knock Music House",
    "slug": "knock-music-house",
    "address": "1789 Cheshire Bridge Road NE",
    "neighborhood": "Cheshire Bridge",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_jsonld_events(soup: BeautifulSoup) -> list[dict]:
    """Extract Event data from JSON-LD scripts."""
    events = []
    scripts = soup.find_all("script", type="application/ld+json")

    for script in scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                if data.get("@type") in ["Event", "MusicEvent"]:
                    events.append(data)
                if "@graph" in data:
                    events.extend([e for e in data["@graph"] if e.get("@type") in ["Event", "MusicEvent"]])
            elif isinstance(data, list):
                events.extend([e for e in data if e.get("@type") in ["Event", "MusicEvent"]])
        except (json.JSONDecodeError, TypeError):
            continue

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Knock Music House events."""
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
        venue_id = get_or_create_venue(VENUE_DATA)

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

            content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Parse time if available
            start_time = None
            if event_data.get("startDate") and "T" in event_data.get("startDate", ""):
                try:
                    dt = datetime.fromisoformat(event_data["startDate"].replace("Z", "+00:00"))
                    if dt.hour != 0 or dt.minute != 0:
                        start_time = dt.strftime("%H:%M")
                except ValueError:
                    pass

            # Get specific event URL


            event_url = find_event_url(title, event_links, EVENTS_URL)



            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": event_data.get("description", "Live music at Knock Music House")[:500],
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "music",
                "subcategory": "live_music",
                "tags": ["music", "live-music", "cheshire-bridge"],
                "price_min": None,
                "price_max": None,
                "price_note": "Check knockmusichouse.com for tickets",
                "is_free": False,
                "source_url": event_url,
                "ticket_url": event_data.get("url"),
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

        logger.info(f"Knock Music House: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Knock Music House: {e}")
        raise

    return events_found, events_new, events_updated
