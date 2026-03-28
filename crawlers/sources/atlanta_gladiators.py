"""
Crawler for Atlanta Gladiators home games.

Uses the official Atlanta Gladiators site and each game page's SportsEvent
JSON-LD to model upcoming ECHL home games at Gas South Arena.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any, Iterable
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "Mozilla/5.0"}
BASE_URL = "https://atlantagladiators.com"
SCHEDULE_URL = f"{BASE_URL}/"
DEFAULT_TICKETS_URL = "https://www.ticketmaster.com/atlanta-gladiators-tickets/artist/874463?home_away=home"
TEAM_NAME = "Atlanta Gladiators"
GAME_LINK_RE = re.compile(r"^/games/\d{4}/\d{2}/\d{2}/[^/?#]+/?$")

PLACE_DATA = {
    "name": "Gas South Arena",
    "slug": "gas-south-arena",
    "address": "6400 Sugarloaf Pkwy",
    "neighborhood": "Duluth",
    "city": "Duluth",
    "state": "GA",
    "zip": "30097",
    "lat": 33.9822,
    "lng": -84.0723,
    "venue_type": "arena",
    "spot_type": "arena",
    "website": "https://www.gassouthdistrict.com/arena",
    "vibes": ["sports", "hockey", "family-friendly"],
}


def extract_game_links(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: list[str] = []
    seen: set[str] = set()

    for anchor in soup.select('a[href*="/games/"]'):
        href = (anchor.get("href") or "").strip()
        absolute = urljoin(BASE_URL, href)
        if not GAME_LINK_RE.match(urlparse(absolute).path):
            continue
        if absolute in seen:
            continue
        seen.add(absolute)
        links.append(absolute)

    return links


def _iter_jsonld_objects(soup: BeautifulSoup) -> Iterable[dict[str, Any]]:
    for script in soup.find_all("script", {"type": "application/ld+json"}):
        content = script.get_text(strip=True)
        if not content:
            continue
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            continue

        if isinstance(data, dict):
            yield data
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    yield item


def _extract_sports_event(soup: BeautifulSoup) -> dict[str, Any] | None:
    for item in _iter_jsonld_objects(soup):
        if item.get("@type") == "SportsEvent":
            return item
    return None


def _team_name(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("name") or "").strip()
    return str(value or "").strip()


def _offer_url(value: Any) -> str | None:
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict) and item.get("url"):
                return str(item["url"]).strip()
    elif isinstance(value, dict) and value.get("url"):
        return str(value["url"]).strip()
    return None


def _image_url(value: Any) -> str | None:
    if isinstance(value, list):
        for item in value:
            if item:
                return str(item).strip()
    elif value:
        return str(value).strip()
    return None


def build_event_title(opponent: str) -> str:
    return f"{TEAM_NAME} vs. {opponent}"


def build_description(opponent: str, start_dt: datetime) -> str:
    puck_drop_text = start_dt.strftime("%B %-d, %Y at %-I:%M %p")
    return (
        f"Official Atlanta Gladiators ECHL home game versus the {opponent} at Gas South Arena. "
        f"The official game page lists puck drop for {puck_drop_text} Eastern. "
        "Check the official game page and ticket link for the latest promotions, entry rules, and gameday details."
    )[:1400]


def parse_game_page(html: str, *, source_url: str, now: datetime | None = None) -> dict[str, Any] | None:
    soup = BeautifulSoup(html, "html.parser")
    sports_event = _extract_sports_event(soup)
    if not sports_event:
        return None

    home_team = _team_name(sports_event.get("homeTeam"))
    away_team = _team_name(sports_event.get("awayTeam"))
    if home_team != TEAM_NAME or not away_team:
        return None

    start_dt = datetime.fromisoformat(str(sports_event["startDate"]))
    cutoff = now or datetime.now(start_dt.tzinfo)
    if start_dt < cutoff:
        return None

    title = build_event_title(away_team)
    return {
        "title": title,
        "description": build_description(away_team, start_dt),
        "start_date": start_dt.strftime("%Y-%m-%d"),
        "start_time": start_dt.strftime("%H:%M"),
        "source_url": str(sports_event.get("url") or source_url).strip(),
        "ticket_url": _offer_url(sports_event.get("offers")) or DEFAULT_TICKETS_URL,
        "image_url": _image_url(sports_event.get("image")),
        "raw_text": f"{sports_event.get('name', title)} | {start_dt.isoformat()}",
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    venue_id = get_or_create_place(PLACE_DATA)
    homepage_response = requests.get(SCHEDULE_URL, headers=HEADERS, timeout=30)
    homepage_response.raise_for_status()
    game_links = extract_game_links(homepage_response.text)

    for game_url in game_links:
        response = requests.get(game_url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        parsed = parse_game_page(response.text, source_url=game_url)
        if not parsed:
            continue

        title = parsed["title"]
        start_date = parsed["start_date"]
        content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": parsed["description"],
            "start_date": start_date,
            "start_time": parsed["start_time"],
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "sports",
            "subcategory": "hockey",
            "tags": ["hockey", "echl", "atlanta-gladiators", "gas-south-arena", "home-game"],
            "price_min": None,
            "price_max": None,
            "price_note": "See the official Atlanta Gladiators ticket link for current pricing.",
            "is_free": False,
            "source_url": parsed["source_url"],
            "ticket_url": parsed["ticket_url"],
            "image_url": parsed["image_url"],
            "raw_text": parsed["raw_text"],
            "extraction_confidence": 0.95,
            "is_recurring": False,
            "recurrence_rule": None,
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
            logger.error("Failed to insert Atlanta Gladiators game %s on %s: %s", title, start_date, exc)

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale Atlanta Gladiators rows after official refresh", stale_removed)

    logger.info(
        "Atlanta Gladiators crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
