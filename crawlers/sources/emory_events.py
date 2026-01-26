"""
Crawler for Emory University Events (emory.edu/events, arts.emory.edu).
Lectures, concerts, arts, academic events, and Schwartz Center performances.
"""

import json
import logging
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.emory.edu"
EVENTS_URL = f"{BASE_URL}/home/events/"
ARTS_URL = "https://arts.emory.edu/events.html"

VENUES = {
    "schwartz": {
        "name": "Schwartz Center for Performing Arts",
        "slug": "schwartz-center-emory",
        "address": "1700 North Decatur Road",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "venue_type": "performing_arts",
        "website": "https://schwartz.emory.edu",
    },
    "carlos": {
        "name": "Michael C. Carlos Museum",
        "slug": "carlos-museum",
        "address": "571 South Kilgo Circle",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "venue_type": "museum",
        "website": "https://carlos.emory.edu",
    },
    "default": {
        "name": "Emory University",
        "slug": "emory-university",
        "address": "201 Dowman Drive",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "venue_type": "university",
        "website": "https://emory.edu",
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
    """Crawl Emory University events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    # URLs to crawl
    urls = [EVENTS_URL, ARTS_URL]

    for url in urls:
        try:
            response = requests.get(url, headers=headers, timeout=30)
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

                # Determine venue based on location or title
                title_lower = title.lower()
                location = event_data.get("location", {})
                location_name = location.get("name", "") if isinstance(location, dict) else ""

                if "schwartz" in title_lower or "schwartz" in location_name.lower():
                    venue_data = VENUES["schwartz"]
                    venue_id = get_or_create_venue(venue_data)
                    category, subcategory = "music", "concert"
                elif "carlos" in title_lower or "museum" in title_lower or "carlos" in location_name.lower():
                    venue_data = VENUES["carlos"]
                    venue_id = get_or_create_venue(venue_data)
                    category, subcategory = "art", "exhibition"
                elif any(w in title_lower for w in ["lecture", "speaker", "talk", "seminar"]):
                    category, subcategory = "community", "lecture"
                elif any(w in title_lower for w in ["concert", "music", "performance", "dance"]):
                    category, subcategory = "music", "concert"
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
                    "description": event_data.get("description", "Event at Emory University")[:500],
                    "start_date": start_date,
                    "start_time": None,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": True,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": ["college", "emory", "druid-hills"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": url,
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
            logger.warning(f"Failed to fetch {url}: {e}")
            continue

    logger.info(f"Emory Events: Found {events_found} events, {events_new} new, {events_updated} existing")
    return events_found, events_new, events_updated
