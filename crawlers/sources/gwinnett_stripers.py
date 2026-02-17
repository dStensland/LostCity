"""
Crawler for Gwinnett Stripers (MiLB AAA, Atlanta Braves affiliate).
Home games at Coolray Field in Lawrenceville.

Uses the MLB Stats API to fetch schedule data.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
import httpx

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.milb.com/gwinnett"
MLB_API_BASE = "https://statsapi.mlb.com/api/v1"

VENUE_DATA = {
    "name": "Coolray Field",
    "slug": "coolray-field",
    "address": "2500 Buford Dr",
    "neighborhood": "Lawrenceville",
    "city": "Lawrenceville",
    "state": "GA",
    "zip": "30043",
    "lat": 33.9601,
    "lng": -83.9891,
    "venue_type": "stadium",
    "spot_type": "arena",
    "website": "https://www.milb.com/gwinnett",
    "vibes": ["sports", "baseball", "family-friendly", "outdoor", "summer"],
}

# Team ID for Gwinnett Stripers in MLB Stats API
# sportId=11 is Triple-A
STRIPERS_TEAM_ID = 536  # May need verification


def find_stripers_team_id() -> int:
    """Find the Gwinnett Stripers team ID from the MLB API."""
    try:
        url = f"{MLB_API_BASE}/teams?sportId=11"  # sportId=11 is Triple-A
        response = httpx.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        for team in data.get("teams", []):
            if "gwinnett" in team.get("name", "").lower() or "stripers" in team.get("name", "").lower():
                logger.info(f"Found Stripers team: {team['name']} (ID: {team['id']})")
                return team["id"]

        # Fallback
        logger.warning("Could not find Gwinnett Stripers in API, using default ID")
        return STRIPERS_TEAM_ID
    except Exception as e:
        logger.error(f"Error finding team ID: {e}")
        return STRIPERS_TEAM_ID


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Gwinnett Stripers schedule from MLB Stats API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    try:
        # Find the correct team ID
        team_id = find_stripers_team_id()

        # Get schedule for next 3 months
        today = datetime.now()
        end_date = today + timedelta(days=90)

        start_str = today.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")

        schedule_url = f"{MLB_API_BASE}/schedule?sportId=11&teamId={team_id}&startDate={start_str}&endDate={end_str}"
        logger.info(f"Fetching Gwinnett Stripers schedule from MLB API: {schedule_url}")

        response = httpx.get(schedule_url, timeout=30)
        response.raise_for_status()
        data = response.json()

        dates = data.get("dates", [])
        logger.info(f"Found {len(dates)} dates with games")

        for date_entry in dates:
            games = date_entry.get("games", [])

            for game in games:
                try:
                    # Only home games
                    home_team = game.get("teams", {}).get("home", {}).get("team", {})
                    away_team = game.get("teams", {}).get("away", {}).get("team", {})

                    home_team_name = home_team.get("name", "")
                    if "gwinnett" not in home_team_name.lower() and "stripers" not in home_team_name.lower():
                        # Skip away games
                        continue

                    # Parse game date
                    game_date_str = game.get("gameDate")
                    if not game_date_str:
                        continue

                    game_dt = datetime.fromisoformat(game_date_str.replace("Z", "+00:00"))
                    game_date = game_dt.strftime("%Y-%m-%d")
                    game_time = game_dt.strftime("%H:%M")

                    # Skip past games
                    if game_date < today.strftime("%Y-%m-%d"):
                        continue

                    # Get opponent
                    opponent = away_team.get("name", "Unknown Opponent")

                    # Get venue
                    venue_info = game.get("venue", {})
                    venue_name = venue_info.get("name", "Coolray Field")

                    title = f"Gwinnett Stripers vs {opponent}"
                    events_found += 1

                    content_hash = generate_content_hash(title, VENUE_DATA["name"], game_date)


                    # Get game link if available
                    game_link = game.get("link", "")
                    source_url = f"{BASE_URL}/schedule" if not game_link else f"https://www.mlb.com{game_link}"

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": f"{title} at {venue_name}. AAA minor league baseball, Atlanta Braves affiliate.",
                        "start_date": game_date,
                        "start_time": game_time,
                        "end_date": game_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "sports",
                        "subcategory": "sports.baseball",
                        "tags": ["baseball", "sports", "family-friendly", "stripers", "milb", "outdoor"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "See milb.com/gwinnett for tickets",
                        "is_free": False,
                        "source_url": source_url,
                        "ticket_url": f"{BASE_URL}/tickets",
                        "image_url": None,
                        "raw_text": None,
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {game_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing game: {e}")
                    continue

        logger.info(
            f"Gwinnett Stripers crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Gwinnett Stripers: {e}")
        raise

    return events_found, events_new, events_updated
