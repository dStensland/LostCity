"""
Crawler for Georgia Tech Athletics (ramblinwreck.com).
Yellow Jackets sports events - football, basketball, baseball, etc.
Scrapes sport-specific schedule pages for game information.
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
    """Parse game information from schedule page by finding schedule item divs."""
    games = []

    # Find all schedule items
    schedule_items = soup.select("div.schedule__table_item--inner")
    logger.debug(f"Found {len(schedule_items)} schedule items")

    for item in schedule_items:
        try:
            # Check if this is a home game
            item_classes = item.get("class", [])
            is_home = "home" in item_classes

            # Skip away and neutral games - we only want home games
            if not is_home:
                continue

            # Check if game already has results (past game)
            has_result = item.select_one("div.score_results") is not None
            if has_result:
                logger.debug("Skipping past game with results")
                continue

            # Extract date from <time> tag
            time_elem = item.select_one("time")
            if not time_elem:
                logger.debug("No time element found, skipping")
                continue

            date_str = time_elem.get_text(strip=True)  # e.g., "Mon Nov 3" or "Sat Dec 6"

            # Parse date - format is like "Mon Nov 3" or "Fri Nov 7"
            # Remove day of week if present
            date_parts = date_str.split()
            if len(date_parts) >= 3:
                # Format: "Mon Nov 3"
                month_str = date_parts[1]
                day_str = date_parts[2]
            elif len(date_parts) == 2:
                # Format: "Nov 3"
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

            # Extract opponent from img alt tags - second image is opponent
            logos = item.select("img[alt]")
            if len(logos) < 2:
                logger.debug("Could not find opponent logo")
                continue
            opponent = logos[1].get("alt", "").strip()

            # Extract time if available
            # NOTE: ramblinwreck.com typically does not publish game times until closer
            # to game day (usually 1-2 weeks before). The <div class="time"> element
            # only appears on the schedule page once times are announced. This is normal
            # for college athletics - most future games will have date but no time.
            time_div = item.select_one("div.time")
            game_time = None
            if time_div:
                time_str = time_div.get_text(strip=True)
                # Parse time like "7:00 PM" or "2:00 PM"
                time_match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_str, re.IGNORECASE)
                if time_match:
                    hour, minute, period = time_match.groups()
                    hour = int(hour)
                    if period.upper() == "PM" and hour != 12:
                        hour += 12
                    elif period.upper() == "AM" and hour == 12:
                        hour = 0
                    game_time = f"{hour:02d}:{minute}"
                    logger.debug(f"Found game time: {game_time}")

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

                # Build description with TBA note if no time
                description = f"Georgia Tech Yellow Jackets {sport_display} {'home game' if is_home else 'away game'} vs {opponent}"
                if start_time is None:
                    description += "\n\nGame time TBA — typically announced 1-2 weeks before the game."

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
