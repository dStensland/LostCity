"""
Crawler for Spelman College Events (spelman.edu/events).
Concerts, lectures, museum exhibitions, and campus events at the #1 HBCU.
Parses events from their calendar page.
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

BASE_URL = "https://www.spelman.edu"
EVENTS_URL = f"{BASE_URL}/events/index.html"

VENUES = {
    "museum": {
        "name": "Spelman College Museum of Fine Art",
        "slug": "spelman-museum",
        "address": "350 Spelman Lane SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30314",
        "venue_type": "museum",
        "website": "https://museum.spelman.edu",
    },
    "default": {
        "name": "Spelman College",
        "slug": "spelman-college",
        "address": "350 Spelman Lane SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30314",
        "venue_type": "university",
        "website": "https://spelman.edu",
    },
}


def parse_events_from_html(soup: BeautifulSoup) -> list[dict]:
    """Parse event information from HTML structure."""
    events = []

    # Look for common event container patterns
    # Try various selectors that might contain events
    event_containers = (
        soup.find_all("div", class_=re.compile(r"event", re.IGNORECASE)) or
        soup.find_all("article", class_=re.compile(r"event", re.IGNORECASE)) or
        soup.find_all("li", class_=re.compile(r"event", re.IGNORECASE))
    )

    for container in event_containers:
        event = {}

        # Try to find title
        title_elem = (
            container.find(["h2", "h3", "h4"], class_=re.compile(r"title", re.IGNORECASE)) or
            container.find("a", class_=re.compile(r"title", re.IGNORECASE)) or
            container.find(["h2", "h3", "h4"])
        )
        if title_elem:
            event["title"] = title_elem.get_text(strip=True)

        # Try to find date
        date_elem = container.find(class_=re.compile(r"date", re.IGNORECASE))
        if date_elem:
            event["date_text"] = date_elem.get_text(strip=True)

        # Try to find time
        time_elem = container.find(class_=re.compile(r"time", re.IGNORECASE))
        if time_elem:
            event["time_text"] = time_elem.get_text(strip=True)

        # Try to find location
        loc_elem = container.find(class_=re.compile(r"location|venue", re.IGNORECASE))
        if loc_elem:
            event["location"] = loc_elem.get_text(strip=True)

        if event.get("title"):
            events.append(event)

    return events


def parse_date(date_text: str) -> str:
    """Parse date from various formats."""
    if not date_text:
        return None

    # Common date patterns
    patterns = [
        (r"(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})", "%d %B %Y"),
        (r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})", "%B %d %Y"),
        (r"(\d{1,2})/(\d{1,2})/(\d{4})", "%m/%d/%Y"),
    ]

    for pattern, fmt in patterns:
        match = re.search(pattern, date_text, re.IGNORECASE)
        if match:
            try:
                date_str = " ".join(match.groups())
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Spelman College events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_data = VENUES["default"]
        venue_id = get_or_create_venue(venue_data)

        # Try to find JSON-LD first
        scripts = soup.find_all("script", type="application/ld+json")
        json_events = []
        for script in scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict) and data.get("@type") == "Event":
                    json_events.append(data)
                elif isinstance(data, list):
                    json_events.extend([e for e in data if e.get("@type") == "Event"])
            except (json.JSONDecodeError, TypeError):
                continue

        if json_events:
            # Process JSON-LD events
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
                    "description": event_data.get("description", f"Event at Spelman College")[:500],
                    "start_date": start_date,
                    "start_time": None,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": True,
                    "category": "community",
                    "subcategory": "campus",
                    "tags": ["college", "hbcu", "spelman", "women"],
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
        else:
            # Fall back to HTML parsing
            html_events = parse_events_from_html(soup)
            for event_data in html_events:
                events_found += 1
                title = event_data.get("title", "").strip()
                if not title:
                    continue

                start_date = parse_date(event_data.get("date_text", ""))
                if not start_date:
                    continue

                content_hash = generate_content_hash(title, venue_data["name"], start_date)
                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                # Determine category based on title
                title_lower = title.lower()
                if "museum" in title_lower or "exhibition" in title_lower or "art" in title_lower:
                    category, subcategory = "art", "exhibition"
                    venue_id = get_or_create_venue(VENUES["museum"])
                elif "concert" in title_lower or "music" in title_lower or "choir" in title_lower:
                    category, subcategory = "music", "concert"
                elif "lecture" in title_lower or "speaker" in title_lower:
                    category, subcategory = "community", "lecture"
                else:
                    category, subcategory = "community", "campus"

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": f"Event at Spelman College, ranked #1 HBCU in the nation.",
                    "start_date": start_date,
                    "start_time": None,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": True,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": ["college", "hbcu", "spelman", "women"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": EVENTS_URL,
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": None,
                    "extraction_confidence": 0.70,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                except Exception as e:
                    logger.error(f"Failed to insert {title}: {e}")

        logger.info(f"Spelman College: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Spelman College: {e}")
        raise

    return events_found, events_new, events_updated
