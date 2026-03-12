"""
Crawler for Atlanta Hawks home games.

Uses the public NBA season schedule feed plus Hawks global settings to identify
the active season and upcoming official home games at State Farm Arena.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import requests

from db import (
    find_existing_event_for_insert,
    get_or_create_venue,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "Mozilla/5.0"}
GLOBAL_SETTINGS_URL = "https://s3.amazonaws.com/cdn.atlhawksdigital.com/api/v1/global_settings_latest.json"
SCHEDULE_TEMPLATE = "https://data.nba.com/data/10s/v2015/json/mobile_teams/nba/{season_start_year}/league/00_full_schedule.json"
SCHEDULE_URL = "https://www.nba.com/hawks/schedule"
TICKETS_URL = "https://www.nba.com/hawks/tickets/games"
TEAM_ABBREV = "ATL"
ATLANTA_TZ = ZoneInfo("America/New_York")

VENUE_DATA = {
    "name": "State Farm Arena",
    "slug": "state-farm-arena",
    "address": "1 State Farm Dr",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7573,
    "lng": -84.3963,
    "venue_type": "arena",
    "spot_type": "stadium",
    "website": "https://www.statefarmarena.com/",
}


def active_season_start_year() -> int:
    response = requests.get(GLOBAL_SETTINGS_URL, headers=HEADERS, timeout=30)
    response.raise_for_status()
    current_season = response.json()["global_settings"]["current_season_year"]
    return int(str(current_season).split("-")[0])


def fetch_schedule_games() -> list[dict[str, Any]]:
    year = active_season_start_year()
    response = requests.get(
        SCHEDULE_TEMPLATE.format(season_start_year=year),
        headers=HEADERS,
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    games: list[dict[str, Any]] = []
    for month in payload.get("lscd", []):
        games.extend(month.get("mscd", {}).get("g", []))
    return games


def parse_local_datetime(game: dict[str, Any]) -> datetime:
    return datetime.fromisoformat(game["etm"]).replace(tzinfo=ATLANTA_TZ)


def build_opponent_name(team: dict[str, Any]) -> str:
    city = str(team.get("tc") or "").strip()
    name = str(team.get("tn") or "").strip()
    return f"{city} {name}".strip()


def build_event_title(game: dict[str, Any]) -> str:
    return f"Atlanta Hawks vs. {build_opponent_name(game['v'])}"


def build_game_page_url(game: dict[str, Any]) -> str:
    return f"https://www.nba.com/game/{game['gid']}"


def build_description(game: dict[str, Any], local_dt: datetime) -> str:
    opponent = build_opponent_name(game["v"])
    kickoff_text = local_dt.strftime("%B %-d, %Y at %-I:%M %p")
    return (
        f"Official Atlanta Hawks home game versus the {opponent} at State Farm Arena. "
        f"The team's official schedule lists tipoff for {kickoff_text} Eastern. "
        f"Check the official game page and Hawks tickets page for the latest broadcast, entry, and ticket details."
    )[:1400]


def upcoming_home_games(games: list[dict[str, Any]], now: datetime | None = None) -> list[dict[str, Any]]:
    cutoff = now or datetime.now(ATLANTA_TZ)
    upcoming: list[dict[str, Any]] = []
    for game in games:
        if game.get("h", {}).get("ta") != TEAM_ABBREV:
            continue
        local_dt = parse_local_datetime(game)
        if local_dt < cutoff:
            continue
        upcoming.append(game)
    return sorted(upcoming, key=parse_local_datetime)


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    venue_id = get_or_create_venue(VENUE_DATA)
    games = upcoming_home_games(fetch_schedule_games())

    for game in games:
        local_dt = parse_local_datetime(game)
        title = build_event_title(game)
        start_date = local_dt.strftime("%Y-%m-%d")
        start_time = local_dt.strftime("%H:%M")
        source_url = build_game_page_url(game)
        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": build_description(game, local_dt),
            "start_date": start_date,
            "start_time": start_time,
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "sports",
            "subcategory": "basketball",
            "tags": ["basketball", "nba", "atlanta-hawks", "home-game", "state-farm-arena"],
            "is_free": False,
            "price_min": None,
            "price_max": None,
            "price_note": "See the official Atlanta Hawks tickets page for current pricing.",
            "source_url": source_url,
            "ticket_url": TICKETS_URL,
            "image_url": "https://cdn.nba.com/logos/nba/1610612737/global/D/logo.svg",
            "raw_text": f"{game['gid']} | {local_dt.isoformat()} | {title}",
            "extraction_confidence": 0.95,
            "content_hash": content_hash,
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record)
            events_new += 1
        except Exception as exc:
            logger.error("Failed to insert Atlanta Hawks game %s on %s: %s", title, start_date, exc)

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale Atlanta Hawks events after schedule refresh", stale_removed)

    logger.info(
        "Atlanta Hawks crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
