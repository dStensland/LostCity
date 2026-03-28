"""
Crawler for the official Atlanta Hawks Bar Network.

The public page is a thin HTML shell that hydrates from JSON feeds hosted on the
Hawks CDN. We use those feeds directly instead of scraping rendered markup.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Any, Optional

import requests

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from utils import slugify

logger = logging.getLogger(__name__)

BASE_PAGE_URL = "https://www.nba.com/hawks/barnetwork"
API_BASE_URL = "https://s3.amazonaws.com/cdn.atlhawksdigital.com/api/v1"
GLOBAL_SETTINGS_URL = f"{API_BASE_URL}/global_settings_latest.json"
BUSINESSES_URL = f"{API_BASE_URL}/gen_businesses_latest.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}


def _fetch_json(url: str) -> dict[str, Any]:
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    return response.json()


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None


def _format_display_time(value: str) -> str:
    parsed = datetime.strptime(value, "%H:%M")
    hour = parsed.hour % 12 or 12
    suffix = "AM" if parsed.hour < 12 else "PM"
    return f"{hour}:{parsed.minute:02d} {suffix}"


def _parse_city_state_zip(value: str) -> tuple[str, str, str]:
    parts = [part.strip() for part in (value or "").split(",") if part.strip()]
    if len(parts) < 2:
        return "", "GA", ""

    city = parts[0]
    state_zip = parts[1].split()
    state = state_zip[0] if state_zip else "GA"
    zip_code = state_zip[1] if len(state_zip) > 1 else ""
    return city, state, zip_code


def _build_venue_data(business: dict[str, Any]) -> dict[str, Any]:
    city, state, zip_code = _parse_city_state_zip(str(business.get("addr2") or ""))
    name = str(business.get("name") or "Atlanta Hawks Bar Network Venue").strip()
    slug = slugify(name) or f"hawks-bar-{business.get('id')}"

    return {
        "name": name,
        "slug": slug[:120],
        "address": str(business.get("addr1") or "").strip(),
        "city": city or "Atlanta",
        "state": state or "GA",
        "zip": zip_code,
        "place_type": "sports_bar",
        "spot_type": "sports_bar",
        "website": business.get("web_url") or BASE_PAGE_URL,
    }


def _build_schedule_lookup(schedule_payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for game in schedule_payload.get("schedule", {}).get("games", []):
        gid_simple = str(game.get("gid_simple") or "").strip()
        if gid_simple:
            lookup[gid_simple] = game
    return lookup


def _extract_opponent_name(event: dict[str, Any], schedule_game: Optional[dict[str, Any]]) -> str:
    if schedule_game:
        city = str(schedule_game.get("opp_tc") or "").strip()
        team = str(schedule_game.get("opp_tn") or "").strip()
        if city and team:
            return f"{city} {team}"
        if team:
            return team

    name = str(event.get("name") or "").strip()
    if " vs. " in name:
        return name.split(" vs. ", 1)[1].strip()
    if " vs " in name:
        return name.split(" vs ", 1)[1].strip()
    return "Opponent"


def parse_watch_parties(
    events_payload: dict[str, Any],
    businesses_payload: dict[str, Any],
    schedule_payload: dict[str, Any],
    today: Optional[date] = None,
) -> list[dict[str, Any]]:
    today = today or date.today()
    businesses = {
        int(row["id"]): row
        for row in businesses_payload.get("gen_businesses", [])
        if row.get("is_in_bar_network")
    }
    schedule_lookup = _build_schedule_lookup(schedule_payload)

    parsed: list[dict[str, Any]] = []
    for event in events_payload.get("gen_events", []):
        if not event.get("is_bar_network_event"):
            continue

        try:
            business_id = int(event.get("business_id"))
        except (TypeError, ValueError):
            continue
        if business_id not in businesses:
            continue

        business = businesses[business_id]
        schedule_game = schedule_lookup.get(str(event.get("gid_simple") or "").strip())

        game_start = _parse_datetime(
            (schedule_game or {}).get("datetime_eastern") or event.get("event_start")
        )
        if not game_start:
            continue

        if event.get("type") == "wp":
            event_start = game_start - timedelta(minutes=30)
            tipoff_time = game_start.strftime("%H:%M")
        else:
            raw_event_start = _parse_datetime(event.get("event_start"))
            event_start = raw_event_start or game_start
            tipoff_time = ""

        if event_start.date() < today:
            continue

        opponent = _extract_opponent_name(event, schedule_game)
        venue_name = str(business.get("name") or "Atlanta Hawks Bar Network Venue").strip()
        title = f"Atlanta Hawks Watch Party vs. {opponent} at {venue_name}"
        description = str(event.get("description") or "").strip()
        place_data = _build_venue_data(business)
        image_url = (
            str(event.get("img_url") or "").strip()
            or str((schedule_game or {}).get("opp_logo_url") or "").strip()
            or str(business.get("logo_url") or "").strip()
        )

        parsed.append(
            {
                "title": title,
                "opponent": opponent,
                "venue_name": venue_name,
                "venue_data": place_data,
                "start_date": event_start.strftime("%Y-%m-%d"),
                "start_time": event_start.strftime("%H:%M"),
                "tipoff_time": tipoff_time,
                "description": description,
                "source_url": BASE_PAGE_URL,
                "image_url": image_url or None,
                "gid_simple": str(event.get("gid_simple") or "").strip(),
                "event_id": event.get("id"),
            }
        )

    parsed.sort(key=lambda item: (item["start_date"], item["start_time"], item["title"]))
    return parsed


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    global_settings = _fetch_json(GLOBAL_SETTINGS_URL)
    season = str(global_settings.get("global_settings", {}).get("current_season_year") or "").strip()
    if not season:
        raise ValueError("Atlanta Hawks Bar Network did not expose a current season year")

    events_url = f"{API_BASE_URL}/{season}_gen_events_latest.json"
    schedule_url = f"{API_BASE_URL}/{season}_schedule_latest.json"

    businesses_payload = _fetch_json(BUSINESSES_URL)
    events_payload = _fetch_json(events_url)
    schedule_payload = _fetch_json(schedule_url)

    items = parse_watch_parties(events_payload, businesses_payload, schedule_payload)

    for item in items:
        venue_id = get_or_create_place(item["venue_data"])
        description = (
            f"Official Atlanta Hawks Bar Network watch party at {item['venue_name']} "
            f"for the {item['opponent']} game. Party starts at "
            f"{_format_display_time(item['start_time'])}"
        )
        if item["tipoff_time"]:
            description += (
                f"; tipoff is at "
                f"{_format_display_time(item['tipoff_time'])}."
            )
        else:
            description += "."
        if item["description"]:
            description += f" {item['description']}"

        content_hash = generate_content_hash(
            item["title"], item["venue_name"], item["start_date"]
        )
        current_hashes.add(content_hash)

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": item["title"],
            "description": description[:1000],
            "start_date": item["start_date"],
            "start_time": item["start_time"],
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "sports",
            "subcategory": "watch_party",
            "tags": [
                "hawks",
                "atlanta-hawks",
                "basketball",
                "nba",
                "watch-party",
                "sports-bar",
                "public",
            ],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": item["source_url"],
            "ticket_url": None,
            "image_url": item["image_url"],
            "raw_text": (
                f"{item['title']} | start={item['start_time']} | "
                f"tipoff={item['tipoff_time']} | gid={item['gid_simple']}"
            ),
            "extraction_confidence": 0.94,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        events_found += 1
        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        insert_event(event_record)
        events_new += 1
        logger.info("Added Atlanta Hawks bar-network event: %s", item["title"])

    remove_stale_source_events(source_id, current_hashes)
    logger.info(
        "Atlanta Hawks Bar Network crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
