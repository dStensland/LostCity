"""
Crawler for Morehouse College Events (events.morehouse.edu).
Lectures, concerts, sports, and campus events at the historic HBCU.
Uses JSON-LD Event schema data embedded in the events page.
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

# Keywords that indicate student/alumni-only events (not public)
STUDENT_ONLY_KEYWORDS = [
    "orientation", "new student", "prospective", "open house",
    "registration", "enrollment", "advising", "deadline",
    "reunion", "alumni weekend", "homecoming weekend",
    "virtual info session", "info session",
    "staff meeting", "faculty meeting",
    "commencement rehearsal", "graduation rehearsal",
    "student only", "students only", "for students",
    "admitted students", "accepted students",
    "parent weekend", "family weekend",
    "preview day", "admitted student",
    "career fair", "graduate school fair", "job fair",
]


def is_public_event(title: str, description: str = "") -> bool:
    """Check if event appears to be open to the public (not student/alumni only)."""
    text = f"{title} {description}".lower()

    for keyword in STUDENT_ONLY_KEYWORDS:
        if keyword in text:
            return False

    return True


BASE_URL = "https://events.morehouse.edu"
EVENTS_URL = BASE_URL

VENUES = {
    "athletics": {
        "name": "B.T. Harvey Stadium",
        "slug": "bt-harvey-stadium",
        "address": "637 Martin Luther King Jr Dr SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30314",
        "venue_type": "stadium",
        "website": "https://morehousemaroontigers.com",
    },
    "default": {
        "name": "Morehouse College",
        "slug": "morehouse-college",
        "address": "830 Westview Drive SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30314",
        "venue_type": "university",
        "website": "https://morehouse.edu",
    },
}


def parse_jsonld_events(soup: BeautifulSoup) -> list[dict]:
    """Extract Event data from JSON-LD scripts."""
    events = []
    scripts = soup.find_all("script", type="application/ld+json")

    for script in scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, list):
                for item in data:
                    if item.get("@type") == "Event":
                        events.append(item)
            elif isinstance(data, dict):
                if data.get("@type") == "Event":
                    events.append(data)
                if "@graph" in data:
                    for item in data["@graph"]:
                        if item.get("@type") == "Event":
                            events.append(item)
        except (json.JSONDecodeError, TypeError):
            continue

    return events


def parse_datetime(date_str: str) -> tuple[str, str]:
    """Parse ISO datetime string to (date, time) tuple."""
    if not date_str:
        return None, None

    try:
        # Handle ISO format with timezone
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        date = dt.strftime("%Y-%m-%d")
        time = dt.strftime("%H:%M") if dt.hour != 0 or dt.minute != 0 else None
        return date, time
    except ValueError:
        pass

    # Fallback: extract date
    match = re.match(r"(\d{4})-(\d{2})-(\d{2})", date_str)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}", None

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Morehouse College events using JSON-LD data."""
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
        json_events = parse_jsonld_events(soup)

        for event_data in json_events:
            title = event_data.get("name", "").strip()
            if not title:
                continue

            # Skip student/alumni-only events
            description = event_data.get("description", "")
            if not is_public_event(title, description):
                logger.debug(f"Skipping non-public event: {title}")
                continue

            events_found += 1

            # Parse dates
            start_date, start_time = parse_datetime(event_data.get("startDate", ""))
            end_date, end_time = parse_datetime(event_data.get("endDate", ""))

            if not start_date:
                continue

            # Get location info
            location = event_data.get("location", {})
            location_name = ""
            if isinstance(location, dict):
                location_name = location.get("name", "")

            # Determine venue
            if "stadium" in location_name.lower() or "athletics" in title.lower():
                venue_data = VENUES["athletics"]
            else:
                venue_data = VENUES["default"]

            venue_id = get_or_create_venue(venue_data)

            # Generate hash
            content_hash = generate_content_hash(
                title, venue_data["name"], start_date
            )

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Get description and image
            description = event_data.get("description", "")
            image_url = event_data.get("image", "")
            event_url = event_data.get("url", EVENTS_URL)

            # Determine category
            title_lower = title.lower()
            if any(w in title_lower for w in ["lecture", "speaker", "talk", "seminar"]):
                category = "community"
                subcategory = "lecture"
                tags = ["college", "hbcu", "morehouse", "lecture"]
            elif any(w in title_lower for w in ["concert", "music", "choir", "band"]):
                category = "music"
                subcategory = "concert"
                tags = ["college", "hbcu", "morehouse", "music"]
            elif any(w in title_lower for w in ["athletics", "football", "basketball", "game"]):
                category = "sports"
                subcategory = "college"
                tags = ["college", "hbcu", "morehouse", "sports"]
            elif any(w in title_lower for w in ["mlk", "king", "civil rights"]):
                category = "community"
                subcategory = "cultural"
                tags = ["college", "hbcu", "morehouse", "mlk", "civil-rights"]
            else:
                category = "community"
                subcategory = "campus"
                tags = ["college", "hbcu", "morehouse"]

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description[:500] if description else "Event at Morehouse College, a historic HBCU in Atlanta.",
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": event_url,
                "ticket_url": None,
                "image_url": image_url if image_url else None,
                "raw_text": json.dumps(event_data),
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.debug(f"Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert {title}: {e}")

        logger.info(f"Morehouse College: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Morehouse College: {e}")
        raise

    return events_found, events_new, events_updated
