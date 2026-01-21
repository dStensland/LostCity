"""
Crawler for Georgia State University Athletics (georgiastatesports.com).
Panthers sports events - football, basketball, baseball, etc.
Uses JSON-LD SportsEvent schema data embedded in schedule pages.
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

BASE_URL = "https://georgiastatesports.com"

# Sport-specific schedule URLs
SPORTS = [
    ("football", "/sports/football/schedule"),
    ("mens-basketball", "/sports/mens-basketball/schedule"),
    ("womens-basketball", "/sports/womens-basketball/schedule"),
    ("baseball", "/sports/baseball/schedule"),
    ("softball", "/sports/softball/schedule"),
    ("volleyball", "/sports/volleyball/schedule"),
    ("soccer", "/sports/soccer/schedule"),
]

VENUES = {
    "football": {
        "name": "Center Parc Stadium",
        "slug": "center-parc-stadium",
        "address": "755 Hank Aaron Drive SE",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30315",
        "venue_type": "stadium",
        "website": "https://georgiastatesports.com",
    },
    "mens-basketball": {
        "name": "GSU Convocation Center",
        "slug": "gsu-convocation-center",
        "address": "100 Piedmont Avenue SE",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "venue_type": "arena",
        "website": "https://georgiastatesports.com",
    },
    "womens-basketball": {
        "name": "GSU Convocation Center",
        "slug": "gsu-convocation-center",
        "address": "100 Piedmont Avenue SE",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "venue_type": "arena",
        "website": "https://georgiastatesports.com",
    },
    "default": {
        "name": "Georgia State University",
        "slug": "georgia-state-university",
        "address": "33 Gilmer Street SE",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "venue_type": "university",
        "website": "https://gsu.edu",
    },
}


def parse_jsonld_events(soup: BeautifulSoup) -> list[dict]:
    """Extract SportsEvent data from JSON-LD scripts."""
    events = []
    scripts = soup.find_all("script", type="application/ld+json")

    for script in scripts:
        try:
            data = json.loads(script.string)
            # Handle both single events and arrays
            if isinstance(data, list):
                for item in data:
                    if item.get("@type") == "SportsEvent":
                        events.append(item)
            elif isinstance(data, dict):
                if data.get("@type") == "SportsEvent":
                    events.append(data)
        except (json.JSONDecodeError, TypeError):
            continue

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia State Athletics schedule using JSON-LD data."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    for sport_name, schedule_path in SPORTS:
        try:
            url = f"{BASE_URL}{schedule_path}"
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")
            sport_events = parse_jsonld_events(soup)

            # Get venue for this sport
            venue_data = VENUES.get(sport_name, VENUES["default"])
            venue_id = get_or_create_venue(venue_data)

            for event_data in sport_events:
                events_found += 1

                # Parse event details
                title = event_data.get("name", "").strip()
                if not title:
                    continue

                # Clean up title (remove leading spaces, "Vs" formatting)
                title = re.sub(r"^\s*", "", title)
                title = f"GSU Panthers {sport_name.replace('-', ' ').title()}: {title}"

                # Parse date/time
                start_date_str = event_data.get("startDate", "")
                start_date = None
                start_time = None

                if start_date_str:
                    try:
                        # Format: "2026-09-05T00:00:00"
                        dt = datetime.fromisoformat(start_date_str.replace("Z", "+00:00"))
                        start_date = dt.strftime("%Y-%m-%d")
                        if dt.hour != 0 or dt.minute != 0:
                            start_time = dt.strftime("%H:%M")
                    except ValueError:
                        pass

                if not start_date:
                    continue

                # Get location
                location = event_data.get("location", {})
                location_name = location.get("name", "") if isinstance(location, dict) else ""

                # Determine if home game
                is_home = "Center Parc" in location_name or "Convocation" in location_name

                # Generate hash
                content_hash = generate_content_hash(
                    title, venue_data["name"], start_date
                )

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                # Build description
                away_team = event_data.get("awayTeam", {})
                away_name = away_team.get("name", "") if isinstance(away_team, dict) else ""
                description = f"Georgia State Panthers vs {away_name}" if away_name else ""
                if location_name:
                    description += f" at {location_name}"

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id if is_home else None,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": start_time is None,
                    "category": "sports",
                    "subcategory": sport_name.replace("-", "_"),
                    "tags": ["sports", "college", "gsu", "panthers", sport_name],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Check georgiastatesports.com for tickets",
                    "is_free": False,
                    "source_url": url,
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": json.dumps(event_data),
                    "extraction_confidence": 0.95,
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

            logger.info(f"GSU {sport_name}: Found {len(sport_events)} games")

        except requests.RequestException as e:
            logger.warning(f"Failed to fetch GSU {sport_name} schedule: {e}")
            continue

    logger.info(f"GSU Athletics: Found {events_found} events, {events_new} new, {events_updated} existing")
    return events_found, events_new, events_updated
