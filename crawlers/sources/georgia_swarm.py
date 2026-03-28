"""
Crawler for Georgia Swarm home schedule.

Official NLL home games at Gas South Arena.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup, Tag

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.georgiaswarm.com"
SCHEDULE_URL = f"{BASE_URL}/schedule/"
TICKETS_URL = "https://www.ticketmaster.com/georgia-swarm-tickets/artist/2162829?home_away=home"

PLACE_DATA = {
    "name": "Gas South Arena",
    "slug": "gas-south-arena",
    "address": "6400 Sugarloaf Pkwy",
    "neighborhood": "Duluth",
    "city": "Duluth",
    "state": "GA",
    "zip": "30097",
    "lat": 33.9618,
    "lng": -84.0965,
    "venue_type": "arena",
    "spot_type": "stadium",
    "active": True,
    "website": "https://www.gassouthdistrict.com/arena",
}


def _clean_team_name(team_box: Tag | None) -> str:
    if not team_box:
        return ""
    parts = [
        node.get_text(" ", strip=True)
        for node in team_box.select(".team_status")
        if node.get_text(" ", strip=True)
    ]
    return " ".join(parts).strip()


def parse_game_date(value: str) -> Optional[str]:
    if not value:
        return None
    cleaned = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", value.strip())
    for fmt in ("%A, %B %d %Y", "%A, %B %d, %Y", "%B %d %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_game_time(value: str) -> Optional[str]:
    raw = (value or "").strip()
    if not raw:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).strftime("%H:%M")
        except ValueError:
            continue
    return None


def parse_schedule_html(html: str, *, today: date | None = None) -> list[dict]:
    ref_today = today or datetime.now().date()
    soup = BeautifulSoup(html, "html.parser")
    game_list = soup.select_one("#game_list .row")
    if not game_list:
        return []

    games: list[dict] = []
    current_date: Optional[str] = None

    for child in game_list.children:
        if not isinstance(child, Tag):
            continue

        classes = child.get("class", [])
        if "date" in classes:
            heading = child.select_one("h2.month")
            current_date = parse_game_date(heading.get_text(" ", strip=True) if heading else "")
            continue

        if "card_column" not in classes or not current_date:
            continue

        location = child.select_one(".game_location .location_wrapper")
        if not location or "gas south arena" not in location.get_text(" ", strip=True).lower():
            continue

        opponent = _clean_team_name(child.select_one(".team_box.team_1"))
        home_team = _clean_team_name(child.select_one(".team_box.team_2"))
        if "georgia swarm" not in home_team.lower() or not opponent:
            continue

        game_date = datetime.strptime(current_date, "%Y-%m-%d").date()
        if game_date < ref_today:
            continue

        preview_link = child.select_one('.cta_holder a[href*="/game/"]')
        buy_link = child.select_one('.buttons a[href*="ticket"]')
        time_span = child.select_one(".nll_time")

        games.append(
            {
                "title": f"Georgia Swarm vs {opponent}",
                "opponent": opponent,
                "start_date": current_date,
                "start_time": parse_game_time(
                    (time_span.get("data-time") if time_span else None)
                    or (time_span.get_text(" ", strip=True) if time_span else "")
                ),
                "source_url": preview_link.get("href", "").strip() if preview_link else SCHEDULE_URL,
                "ticket_url": buy_link.get("href", "").strip() if buy_link else TICKETS_URL,
            }
        )

    return games


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    response = requests.get(
        SCHEDULE_URL,
        headers={"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"},
        timeout=30,
    )
    response.raise_for_status()

    venue_id = get_or_create_place(PLACE_DATA)
    games = parse_schedule_html(response.text)

    for game in games:
        events_found += 1
        content_hash = generate_content_hash(game["title"], PLACE_DATA["name"], game["start_date"])
        current_hashes.add(content_hash)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": game["title"],
            "description": (
                f"{game['title']} at Gas South Arena. "
                "Official Georgia Swarm National Lacrosse League home game."
            ),
            "start_date": game["start_date"],
            "start_time": game["start_time"],
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "sports",
            "subcategory": "lacrosse",
            "tags": ["sports", "lacrosse", "nll", "georgia-swarm"],
            "price_min": None,
            "price_max": None,
            "price_note": "See Georgia Swarm or Ticketmaster for current pricing",
            "is_free": False,
            "source_url": game["source_url"],
            "ticket_url": game["ticket_url"],
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.95,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
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
        "Georgia Swarm: Found %s events, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
