"""
Crawler for Georgia Tech Campus Events (calendar.gatech.edu).
Lectures, arts, campus activities, and public events.
Georgia Tech uses Trumba calendar system.
"""

import json
import logging
import re
from datetime import datetime
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_image_url

logger = logging.getLogger(__name__)

BASE_URL = "https://calendar.gatech.edu"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Georgia Tech",
    "slug": "georgia-tech",
    "address": "North Avenue NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30332",
    "venue_type": "university",
    "website": "https://gatech.edu",
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


def parse_trumba_events(soup: BeautifulSoup) -> list[dict]:
    """Parse events from Trumba calendar HTML structure."""
    events = []

    # Trumba uses specific class patterns for events
    event_items = soup.find_all(class_=re.compile(r"twSimpleEvent|twDetailEvent|event-item", re.IGNORECASE))

    for item in event_items:
        event = {}

        # Try to find title
        title_elem = item.find(class_=re.compile(r"title|summary|event-title", re.IGNORECASE))
        if title_elem:
            event["title"] = title_elem.get_text(strip=True)

        # Try to find date
        date_elem = item.find(class_=re.compile(r"date|startdate", re.IGNORECASE))
        if date_elem:
            event["date_text"] = date_elem.get_text(strip=True)

        # Try to find location
        loc_elem = item.find(class_=re.compile(r"location|venue", re.IGNORECASE))
        if loc_elem:
            event["location"] = loc_elem.get_text(strip=True)

        if event.get("title"):
            events.append(event)

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Tech campus events calendar."""
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

            # Determine category
            title_lower = title.lower()
            if any(w in title_lower for w in ["lecture", "seminar", "talk", "speaker"]):
                category, subcategory = "community", "lecture"
            elif any(w in title_lower for w in ["concert", "music", "performance"]):
                category, subcategory = "music", "concert"
            elif any(w in title_lower for w in ["workshop", "class", "training"]):
                category, subcategory = "community", "workshop"
            else:
                category, subcategory = "community", "campus"

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": event_data.get("description", f"Event at Georgia Tech")[:500],
                "start_date": start_date,
                "start_time": None,
                "end_date": None,
                "end_time": None,
                "is_all_day": True,
                "category": category,
                "subcategory": subcategory,
                "tags": ["college", "georgia-tech", "midtown"],
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

        # If no JSON-LD, try Trumba parsing
        if not json_events:
            trumba_events = parse_trumba_events(soup)
            for event_data in trumba_events:
                events_found += 1
                title = event_data.get("title", "")
                if not title:
                    continue

                # Parse date from text
                date_text = event_data.get("date_text", "")
                start_date = None
                if date_text:
                    match = re.search(r"(\w+)\s+(\d{1,2}),?\s+(\d{4})", date_text)
                    if match:
                        try:
                            month, day, year = match.groups()
                            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
                            start_date = dt.strftime("%Y-%m-%d")
                        except ValueError:
                            pass

                if not start_date:
                    continue

                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": f"Event at Georgia Tech",
                    "start_date": start_date,
                    "start_time": None,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": True,
                    "category": "community",
                    "subcategory": "campus",
                    "tags": ["college", "georgia-tech", "midtown"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": EVENTS_URL,
                    "ticket_url": None,
                    "image_url": extract_image_url(soup) if soup else None,
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

        logger.info(f"Georgia Tech Events: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Georgia Tech Events: {e}")
        raise

    return events_found, events_new, events_updated
