"""
Crawler for Atlanta United FC home matches.

The official Atlanta United schedule page renders from MLS stats and club APIs.
This source uses the same first-party JSON feeds to model upcoming MLS regular
season home matches at Mercedes-Benz Stadium.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
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
TEAM_SPORTEC_ID = "MLS-CLU-00000A"
SEASON_SPORTEC_ID = "MLS-SEA-0001KA"
SCHEDULE_URL = "https://www.atlutd.com/schedule"
STATS_API_URL = (
    "https://stats-api.mlssoccer.com/matches/seasons/"
    f"{SEASON_SPORTEC_ID}"
    "?match_date[gte]=2026-01-01&match_date[lte]=2026-12-31"
    f"&team_id={TEAM_SPORTEC_ID}&per_page=100&sort=planned_kickoff_time:asc,home_team_name:asc"
)
SPORTAPI_URL = "https://sportapi.atlutd.com/api/matches/bySportecIds/"
DEFAULT_TICKETS_URL = "https://www.atlutd.com/tickets"
ATLANTA_TZ = ZoneInfo("America/New_York")

VENUE_DATA = {
    "name": "Mercedes-Benz Stadium",
    "slug": "mercedes-benz-stadium",
    "address": "1 AMB Dr NW, Atlanta, GA 30313, USA",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7553,
    "lng": -84.4006,
    "venue_type": "stadium",
    "spot_type": "stadium",
    "website": "https://mercedesbenzstadium.com/",
}


def parse_match_datetime(value: str) -> datetime:
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    normalized = re.sub(r"\.(\d{6})\d+([+-]\d{2}:\d{2})$", r".\1\2", normalized)
    return datetime.fromisoformat(normalized)


def build_match_page_url(match: dict[str, Any]) -> str:
    competition_slug = match["competition"]["slug"]
    season_name = str(match["season"]["name"])
    slug = match["slug"]
    return f"https://www.atlutd.com/competitions/{competition_slug}/{season_name}/matches/{slug}/"


def build_event_title(match: dict[str, Any]) -> str:
    opponent = match["away"]["fullName"]
    return f"Atlanta United FC vs. {opponent}"


def build_matchup_participants(match: dict[str, Any]) -> list[dict]:
    return [
        {"name": "Atlanta United FC", "role": "team", "billing_order": 1},
        {
            "name": match["away"]["fullName"],
            "role": "team",
            "billing_order": 2,
        },
    ]


def build_description(match: dict[str, Any], kickoff_local: datetime) -> str:
    opponent = match["away"]["fullName"]
    kickoff_text = kickoff_local.strftime("%B %-d, %Y at %-I:%M %p")
    return (
        f"Official Atlanta United FC MLS regular season home match versus {opponent} at Mercedes-Benz Stadium. "
        f"The club's official schedule API lists kickoff for {kickoff_text} Eastern. "
        f"Check the official Atlanta United match page and ticket link for the latest matchday details."
    )[:1400]


def fetch_schedule_match_ids() -> list[str]:
    response = requests.get(STATS_API_URL, headers=HEADERS, timeout=30)
    response.raise_for_status()
    schedule = response.json().get("schedule", [])
    return [
        item["match_id"]
        for item in schedule
        if item.get("competition_name") == "Major League Soccer - Regular Season"
    ]


def fetch_match_details(match_ids: list[str]) -> list[dict[str, Any]]:
    if not match_ids:
        return []
    response = requests.get(
        f"{SPORTAPI_URL}{','.join(match_ids)}",
        headers=HEADERS,
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def upcoming_home_matches(matches: list[dict[str, Any]], now: datetime | None = None) -> list[dict[str, Any]]:
    cutoff = now or datetime.now(timezone.utc)
    upcoming: list[dict[str, Any]] = []
    for match in matches:
        if match.get("competition", {}).get("name") != "MLS Regular Season":
            continue
        if match.get("home", {}).get("sportecId") != TEAM_SPORTEC_ID:
            continue
        kickoff_utc = parse_match_datetime(match["matchDate"])
        if kickoff_utc < cutoff:
            continue
        upcoming.append(match)
    return sorted(upcoming, key=lambda match: parse_match_datetime(match["matchDate"]))


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    venue_id = get_or_create_venue(VENUE_DATA)
    matches = upcoming_home_matches(fetch_match_details(fetch_schedule_match_ids()))

    for match in matches:
        kickoff_utc = parse_match_datetime(match["matchDate"])
        kickoff_local = kickoff_utc.astimezone(ATLANTA_TZ)
        title = build_event_title(match)
        start_date = kickoff_local.strftime("%Y-%m-%d")
        start_time = kickoff_local.strftime("%H:%M")
        source_url = build_match_page_url(match)
        ticket_url = match.get("firstPartyTickets", {}).get("url") or DEFAULT_TICKETS_URL
        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": build_description(match, kickoff_local),
            "start_date": start_date,
            "start_time": start_time,
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "sports",
            "subcategory": "soccer",
            "tags": [
                "soccer",
                "mls",
                "atlanta-united-fc",
                "home-match",
                "mercedes-benz-stadium",
            ],
            "is_free": False,
            "price_min": None,
            "price_max": None,
            "price_note": "See the official Atlanta United ticket link for current pricing.",
            "source_url": source_url,
            "ticket_url": ticket_url,
            "image_url": None,
            "raw_text": (
                f"{match['sportecId']} | {kickoff_local.isoformat()} | "
                f"Atlanta United FC vs. {match['away']['fullName']}"
            ),
            "extraction_confidence": 0.95,
            "content_hash": content_hash,
            "_parsed_artists": build_matchup_participants(match),
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
            logger.error("Failed to insert Atlanta United FC match %s on %s: %s", title, start_date, exc)

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale Atlanta United FC events after schedule refresh", stale_removed)

    logger.info(
        "Atlanta United FC crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
