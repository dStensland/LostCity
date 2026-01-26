"""
Crawler for Kennesaw State Athletics (ksuowls.com).
Owls sports events - football, basketball, baseball, softball.
Scrapes sport-specific schedule pages for game information.
Uses Sidearm Sports platform (same as Georgia Tech).
"""

import logging
import re
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_image_url

logger = logging.getLogger(__name__)

BASE_URL = "https://ksuowls.com"

# Sport-specific schedule URLs
SPORTS = [
    ("football", "/sports/football/schedule"),
    ("mens-basketball", "/sports/mens-basketball/schedule"),
    ("womens-basketball", "/sports/womens-basketball/schedule"),
    ("baseball", "/sports/baseball/schedule"),
    ("softball", "/sports/softball/schedule"),
]

# Venue mappings for different sports
VENUES = {
    "football": {
        "name": "Fifth Third Bank Stadium",
        "slug": "fifth-third-bank-stadium",
        "address": "1000 Chastain Road",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "stadium",
        "website": "https://ksuowls.com",
    },
    "mens-basketball": {
        "name": "KSU Convocation Center",
        "slug": "ksu-convocation-center",
        "address": "3333 Busbee Drive NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "arena",
        "website": "https://ksuowls.com",
    },
    "womens-basketball": {
        "name": "KSU Convocation Center",
        "slug": "ksu-convocation-center",
        "address": "3333 Busbee Drive NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "arena",
        "website": "https://ksuowls.com",
    },
    "baseball": {
        "name": "Stillwell Stadium",
        "slug": "stillwell-stadium",
        "address": "1000 Chastain Road",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "stadium",
        "website": "https://ksuowls.com",
    },
    "softball": {
        "name": "Bailey Park",
        "slug": "bailey-park-ksu",
        "address": "1000 Chastain Road",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "stadium",
        "website": "https://ksuowls.com",
    },
    "default": {
        "name": "Kennesaw State University",
        "slug": "kennesaw-state-university",
        "address": "1000 Chastain Road",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "university",
        "website": "https://kennesaw.edu",
    },
}


def parse_schedule_page(soup: BeautifulSoup, sport_name: str) -> list[dict]:
    """Parse game information from schedule page by finding schedule game items."""
    games = []

    # Find all schedule items (li.sidearm-schedule-game)
    schedule_items = soup.select("li.sidearm-schedule-game")
    logger.debug(f"Found {len(schedule_items)} schedule items")

    for item in schedule_items:
        try:
            # Check if this is a home game
            item_classes = item.get("class", [])
            is_home = "sidearm-schedule-home-game" in item_classes

            # Skip away games - we only want home games
            if not is_home:
                continue

            # Check if game already has results (past game)
            has_result = "sidearm-schedule-game-completed" in item_classes
            if has_result:
                logger.debug("Skipping past game with results")
                continue

            # Extract date from span.sidearm-schedule-game-opponent-date
            date_elem = item.select_one("span.sidearm-schedule-game-opponent-date span")
            if not date_elem:
                logger.debug("No date element found, skipping")
                continue

            date_str = date_elem.get_text(strip=True)  # e.g., "Jan 28 (Wed)" or "Nov 3 (Mon)"

            # Parse date - format is like "Jan 28 (Wed)"
            # Remove day of week in parentheses
            date_str_clean = re.sub(r'\s*\([^)]*\)', '', date_str).strip()
            date_parts = date_str_clean.split()

            if len(date_parts) >= 2:
                month_str = date_parts[0]
                day_str = date_parts[1]
            else:
                logger.debug(f"Could not parse date: {date_str}")
                continue

            # Determine year (assume current or next year)
            year = datetime.now().year
            try:
                test_date = datetime.strptime(f"{month_str} {day_str} {year}", "%b %d %Y")
                # If date is more than 30 days in the past, assume it's next year
                if test_date < datetime.now() - timedelta(days=30):
                    year += 1
                parsed_date = f"{year}-{test_date.month:02d}-{int(day_str):02d}"
            except ValueError as e:
                logger.debug(f"Failed to parse date {month_str} {day_str}: {e}")
                continue

            # Extract opponent name from span.sidearm-schedule-game-opponent-name
            opponent_elem = item.select_one("span.sidearm-schedule-game-opponent-name")
            if not opponent_elem:
                logger.debug("Could not find opponent name")
                continue

            # Get text from the link or direct text
            opponent_link = opponent_elem.select_one("a")
            if opponent_link:
                opponent = opponent_link.get_text(strip=True)
            else:
                opponent = opponent_elem.get_text(strip=True)

            # Extract time if available from span.sidearm-schedule-game-time
            time_elem = item.select_one("span.sidearm-schedule-game-time span")
            game_time = None
            if time_elem:
                time_str = time_elem.get_text(strip=True)
                # Parse time like "7 PM" or "2:00 PM"
                time_match = re.match(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)", time_str, re.IGNORECASE)
                if time_match:
                    hour, minute, period = time_match.groups()
                    hour = int(hour)
                    minute = int(minute) if minute else 0
                    if period.upper() == "PM" and hour != 12:
                        hour += 12
                    elif period.upper() == "AM" and hour == 12:
                        hour = 0
                    game_time = f"{hour:02d}:{minute:02d}"

            games.append({
                "date": parsed_date,
                "time": game_time,
                "opponent": opponent,
                "is_home": is_home,
            })
            logger.debug(f"Found game: {opponent} on {parsed_date}")

        except Exception as e:
            logger.warning(f"Error parsing schedule item: {e}")
            continue

    return games


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Kennesaw State Athletics schedule."""
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
                    title = f"KSU {sport_display}: vs {opponent}"
                else:
                    title = f"KSU {sport_display}: at {opponent}"

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
                    "description": f"Kennesaw State Owls {sport_display} {'home game' if is_home else 'away game'} vs {opponent}",
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": start_time is None,
                    "category": "sports",
                    "subcategory": sport_name.replace("-", "_"),
                    "tags": ["sports", "college", "kennesaw-state", "owls", sport_name],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Check ksuowls.com for tickets",
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

            logger.info(f"KSU {sport_name}: Found {len(games)} games")

        except requests.RequestException as e:
            logger.warning(f"Failed to fetch KSU {sport_name} schedule: {e}")
            continue

    logger.info(f"Kennesaw State Athletics: Found {events_found} events, {events_new} new, {events_updated} existing")
    return events_found, events_new, events_updated
