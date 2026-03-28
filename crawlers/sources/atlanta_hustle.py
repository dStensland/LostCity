"""
Crawler for Atlanta Hustle home games.

Uses the official UFA schedule API backing the Atlanta Hustle team schedule page.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional

import requests

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

TEAM_ID = 1
SCHEDULE_URL = "https://www.watchufa.com/hustle/schedule"
API_URL = f"https://www.backend.ufastats.com/web-v1/games?current&teamID={TEAM_ID}"
TEAM_BASE_URL = "https://www.watchufa.com/hustle"

PLACE_DATA = {
    "name": "Silverbacks Park",
    "slug": "silverbacks-park",
    "address": "3200 Atlanta Silverbacks Way",
    "neighborhood": "North Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30340",
    "lat": 33.8409,
    "lng": -84.2513,
    "venue_type": "stadium",
    "spot_type": "stadium",
    "website": "https://silverbackspark.com/",
    "active": True,
}


def build_matchup_participants(opponent: str) -> list[dict]:
    """Return structured home/opponent participants for Hustle matches."""
    return [
        {"name": "Atlanta Hustle", "role": "team", "billing_order": 1},
        {"name": opponent, "role": "team", "billing_order": 2},
    ]


def _normalize_url(value: str | None) -> Optional[str]:
    if not value:
        return None
    cleaned = value.strip()
    if cleaned.startswith("http://") or cleaned.startswith("https://"):
        return cleaned
    return f"https://{cleaned.lstrip('/')}"


def _build_game_url(game_id: str) -> str:
    return f"{TEAM_BASE_URL}/game/{game_id}"


def _parse_timestamp(value: str) -> tuple[Optional[str], Optional[str]]:
    if not value:
        return None, None
    dt = datetime.fromisoformat(value)
    return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")


def parse_games(payload: dict, *, today: date | None = None) -> list[dict]:
    ref_today = today or datetime.now().date()
    games = payload.get("games")
    if not isinstance(games, list):
        return []

    parsed: list[dict] = []
    for game in games:
        if not isinstance(game, dict):
            continue

        if game.get("status") != "Upcoming":
            continue
        if game.get("homeTeamID") != "hustle":
            continue

        start_date, start_time = _parse_timestamp(game.get("startTimestamp", ""))
        if not start_date:
            continue
        if datetime.strptime(start_date, "%Y-%m-%d").date() < ref_today:
            continue

        opponent = f"{game.get('awayTeamCity', '').strip()} {game.get('awayTeamName', '').strip()}".strip()
        location = (game.get("locationName") or "").strip()
        if not opponent or "silverbacks" not in location.lower():
            continue

        game_id = (game.get("gameID") or "").strip()
        parsed.append(
            {
                "title": f"Atlanta Hustle vs {opponent}",
                "opponent": opponent,
                "start_date": start_date,
                "start_time": None if game.get("startTimeTBD") else start_time,
                "source_url": _build_game_url(game_id) if game_id else SCHEDULE_URL,
                "ticket_url": _normalize_url(game.get("ticketURL")) or SCHEDULE_URL,
                "stream_url": _normalize_url(game.get("streamingURL")),
                "location_name": location,
                "week": game.get("week"),
                "game_id": game_id,
            }
        )

    parsed.sort(key=lambda game: (game["start_date"], game["start_time"] or "99:99"))
    return parsed


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    response = requests.get(
        API_URL,
        headers={"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"},
        timeout=30,
    )
    response.raise_for_status()

    venue_id = get_or_create_place(PLACE_DATA)
    games = parse_games(response.json())

    for game in games:
        events_found += 1
        content_hash = generate_content_hash(game["title"], PLACE_DATA["name"], game["start_date"])
        current_hashes.add(content_hash)

        description = (
            f"{game['title']} at Silverbacks Park. "
            "Official Atlanta Hustle Ultimate Frisbee Association home game."
        )
        if game.get("stream_url"):
            description += " Streaming is available through the official UFA watch link."

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": game["title"],
            "description": description,
            "start_date": game["start_date"],
            "start_time": game["start_time"],
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "sports",
            "subcategory": "ultimate-frisbee",
            "tags": ["sports", "ultimate-frisbee", "ufa", "atlanta-hustle", "silverbacks-park", "home-game"],
            "price_min": None,
            "price_max": None,
            "price_note": "See the official Atlanta Hustle ticket page for current pricing",
            "is_free": False,
            "source_url": game["source_url"],
            "ticket_url": game["ticket_url"],
            "image_url": None,
            "raw_text": f"{game['game_id']} | {game['week']} | {game['location_name']}",
            "extraction_confidence": 0.97,
            "content_hash": content_hash,
            "_parsed_artists": build_matchup_participants(game["opponent"]),
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        insert_event(event_record)
        events_new += 1

    remove_stale_source_events(source_id, current_hashes)
    logger.info(
        "Atlanta Hustle: Found %s events, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
