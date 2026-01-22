"""
Crawler for Georgia Tech Athletics (ramblinwreck.com).
Yellow Jackets sports events - football, basketball, baseball, etc.
Scrapes sport-specific schedule pages for game information.
"""

import json
import logging
import re
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_image_url

logger = logging.getLogger(__name__)

BASE_URL = "https://ramblinwreck.com"

# Sport-specific schedule URLs
SPORTS = [
    ("football", "/sports/m-footbl/schedule/", "m-footbl"),
    ("mens-basketball", "/sports/m-baskbl/schedule/", "m-baskbl"),
    ("womens-basketball", "/sports/w-baskbl/schedule/", "w-baskbl"),
    ("baseball", "/sports/m-basebl/schedule/", "m-basebl"),
    ("softball", "/sports/w-softbl/schedule/", "w-softbl"),
    ("volleyball", "/sports/w-volley/schedule/", "w-volley"),
]

# Venue mappings for different sports
VENUES = {
    "football": {
        "name": "Bobby Dodd Stadium",
        "slug": "bobby-dodd-stadium",
        "address": "177 North Avenue NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "venue_type": "stadium",
        "website": "https://ramblinwreck.com",
    },
    "mens-basketball": {
        "name": "McCamish Pavilion",
        "slug": "mccamish-pavilion",
        "address": "965 Fowler Street NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "arena",
        "website": "https://ramblinwreck.com",
    },
    "womens-basketball": {
        "name": "McCamish Pavilion",
        "slug": "mccamish-pavilion",
        "address": "965 Fowler Street NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "arena",
        "website": "https://ramblinwreck.com",
    },
    "baseball": {
        "name": "Russ Chandler Stadium",
        "slug": "russ-chandler-stadium",
        "address": "150 Bobby Dodd Way NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30332",
        "venue_type": "stadium",
        "website": "https://ramblinwreck.com",
    },
    "default": {
        "name": "Georgia Tech Campus",
        "slug": "georgia-tech-campus",
        "address": "North Avenue NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30332",
        "venue_type": "university",
        "website": "https://gatech.edu",
    },
}


def parse_schedule_page(soup: BeautifulSoup, sport_name: str) -> list[dict]:
    """Parse game information from schedule page text."""
    games = []
    body_text = soup.get_text(separator="\n")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    # Look for date patterns followed by opponent info
    # Format typically: "Sat Jan 24" or "Jan 24" followed by opponent
    current_date = None
    current_time = None

    for i, line in enumerate(lines):
        # Date pattern: "Sat Jan 24" or "Jan 24"
        date_match = re.match(
            r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*"
            r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$",
            line, re.IGNORECASE
        )
        if date_match:
            month, day = date_match.groups()
            # Assume current or next year
            year = datetime.now().year
            try:
                test_date = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
                if test_date < datetime.now() - timedelta(days=30):
                    year += 1
                current_date = f"{year}-{test_date.month:02d}-{int(day):02d}"
            except ValueError:
                current_date = None
            continue

        # Time pattern: "12:00 pm" or "7:00 PM"
        time_match = re.match(r"^(\d{1,2}):(\d{2})\s*(am|pm)$", line, re.IGNORECASE)
        if time_match:
            hour, minute, period = time_match.groups()
            hour = int(hour)
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            current_time = f"{hour:02d}:{minute}"
            continue

        # Opponent pattern: "vs" or "at" followed by team name
        opponent_match = re.match(r"^(vs\.?|at)\s+(.+)$", line, re.IGNORECASE)
        if opponent_match and current_date:
            prefix, opponent = opponent_match.groups()
            is_home = prefix.lower().startswith("vs")

            games.append({
                "date": current_date,
                "time": current_time,
                "opponent": opponent.strip(),
                "is_home": is_home,
            })
            current_time = None  # Reset time for next game

    return games


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Tech Athletics schedule."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    for sport_name, schedule_path, sport_code in SPORTS:
        try:
            url = f"{BASE_URL}{schedule_path}"
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            # Get venue for this sport
            venue_data = VENUES.get(sport_name, VENUES["default"])
            venue_id = get_or_create_venue(venue_data)

            # Parse games from the page
            games = parse_schedule_page(soup, sport_name)

            for game in games:
                events_found += 1

                opponent = game["opponent"]
                start_date = game["date"]
                start_time = game["time"]
                is_home = game["is_home"]

                # Build title
                sport_display = sport_name.replace("-", " ").title()
                if is_home:
                    title = f"GT {sport_display}: vs {opponent}"
                else:
                    title = f"GT {sport_display}: at {opponent}"

                # Generate hash
                content_hash = generate_content_hash(
                    title, venue_data["name"], start_date
                )

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id if is_home else None,
                    "title": title,
                    "description": f"Georgia Tech Yellow Jackets {sport_display} {'home game' if is_home else 'away game'} vs {opponent}",
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": start_time is None,
                    "category": "sports",
                    "subcategory": sport_name.replace("-", "_"),
                    "tags": ["sports", "college", "georgia-tech", "yellow-jackets", sport_name],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Check ramblinwreck.com for tickets",
                    "is_free": False,
                    "source_url": url,
                    "ticket_url": None,
                    "image_url": extract_image_url(soup) if soup else None,
                    "raw_text": None,
                    "extraction_confidence": 0.80,
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

            logger.info(f"GT {sport_name}: Found {len(games)} games")

        except requests.RequestException as e:
            logger.warning(f"Failed to fetch GT {sport_name} schedule: {e}")
            continue

    logger.info(f"Georgia Tech Athletics: Found {events_found} events, {events_new} new, {events_updated} existing")
    return events_found, events_new, events_updated
