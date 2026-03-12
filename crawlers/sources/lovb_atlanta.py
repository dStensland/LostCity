"""
Crawler for LOVB Atlanta home matches.

Uses the official LOVB 2026 schedule server-component payload and filters it
down to Atlanta home matches only.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime
from zoneinfo import ZoneInfo
from urllib.parse import parse_qs, unquote, urlparse

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

SCHEDULE_URL = "https://www.lovb.com/2026/schedule"
SCHEDULE_PAYLOAD_URL = f"{SCHEDULE_URL}?_rsc=1"
TEAM_SLUG = "lovb-atlanta-volleyball"
ATLANTA_TZ = ZoneInfo("America/New_York")

TIMEZONE_ALIASES = {
    "US/Eastern": "America/New_York",
    "US/Central": "America/Chicago",
    "US/Mountain": "America/Denver",
    "US/Pacific": "America/Los_Angeles",
}

VENUE_DATA_BY_OFFICIAL_SLUG = {
    "gateway-center-arena": {
        "name": "Gateway Center Arena",
        "slug": "gateway-center-arena",
        "address": "2330 Convention Center Concourse",
        "neighborhood": "Airport District",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6624,
        "lng": -84.4440,
        "venue_type": "arena",
        "spot_type": "stadium",
        "active": True,
        "website": "https://gatewaycenterarena.com",
    },
    "ote-arena": {
        "name": "Overtime Elite Arena",
        "slug": "overtime-elite-arena",
        "address": "230 17th St NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30363",
        "venue_type": "arena",
        "spot_type": "arena",
        "active": True,
        "website": "https://overtimeelite.com",
    },
    "mccamish-pavilion": {
        "name": "McCamish Pavilion",
        "slug": "mccamish-pavilion",
        "address": "965 Fowler St NW",
        "neighborhood": "Georgia Tech",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "arena",
        "spot_type": "arena",
        "active": True,
        "website": "https://ramblinwreck.com",
    },
}


def build_event_title(opponent_name: str) -> str:
    opponent = " ".join((opponent_name or "").strip().split())
    if not opponent:
        opponent = "Unknown Opponent"
    if not opponent.lower().startswith("lovb "):
        opponent = f"LOVB {opponent}"
    return f"LOVB Atlanta vs {opponent}"


def build_matchup_participants(opponent_name: str) -> list[dict]:
    opponent = " ".join((opponent_name or "").strip().split())
    if opponent and not opponent.lower().startswith("lovb "):
        opponent = f"LOVB {opponent}"
    return [
        {"name": "LOVB Atlanta", "role": "team", "billing_order": 1},
        {"name": opponent or "Unknown Opponent", "role": "team", "billing_order": 2},
    ]


def clean_ticket_url(value: str | None) -> str | None:
    if not value:
        return None

    parsed = urlparse(value)
    if parsed.netloc == "www.google.com" and parsed.path == "/url":
        redirect_target = parse_qs(parsed.query).get("q", [None])[0]
        if redirect_target:
            return unquote(redirect_target)

    return value.strip()


def _extract_games(payload: str) -> list[dict]:
    marker = '"games":['
    start = payload.find(marker)
    if start == -1:
        return []

    start += len('"games":')
    depth = 0
    end = None
    in_string = False
    escaped = False

    for idx, char in enumerate(payload[start:], start):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                end = idx + 1
                break

    if end is None:
        return []

    games = json.loads(payload[start:end])
    return [item for item in games if isinstance(item, dict)]


def _resolve_timezone(value: str | None) -> ZoneInfo:
    return ZoneInfo(TIMEZONE_ALIASES.get(value or "", "America/New_York"))


def parse_schedule_payload(payload: str, *, today: date | None = None) -> list[dict]:
    ref_today = today or datetime.now(ATLANTA_TZ).date()
    matches: list[dict] = []

    for game in _extract_games(payload):
        host = game.get("host") or {}
        if host.get("slug") != TEAM_SLUG:
            continue

        venue = game.get("venue") or {}
        venue_slug = venue.get("slug")
        if venue_slug not in VENUE_DATA_BY_OFFICIAL_SLUG:
            continue

        start_value = game.get("startDate")
        if not start_value:
            continue

        local_zone = _resolve_timezone((game.get("start_date_timezone") or {}).get("name"))
        local_dt = datetime.fromisoformat(start_value).replace(tzinfo=local_zone).astimezone(ATLANTA_TZ)
        if local_dt.date() < ref_today:
            continue

        guest = game.get("guest") or {}
        title = build_event_title(guest.get("name", "Unknown Opponent"))
        special = game.get("special_event_description")
        tag = game.get("tag")
        ticket_url = clean_ticket_url(game.get("ticket_purchase_link"))

        matches.append(
            {
                "title": title,
                "opponent": guest.get("name", "Unknown Opponent"),
                "start_date": local_dt.strftime("%Y-%m-%d"),
                "start_time": local_dt.strftime("%H:%M"),
                "venue_slug": venue_slug,
                "ticket_url": ticket_url,
                "source_url": SCHEDULE_URL,
                "special_event_description": special,
                "tag": tag,
                "raw_text": json.dumps(
                    {
                        "id": game.get("id"),
                        "host": host.get("slug"),
                        "guest": guest.get("slug"),
                        "startDate": start_value,
                        "timezone": (game.get("start_date_timezone") or {}).get("name"),
                        "venue": venue.get("slug"),
                        "special_event_description": special,
                        "ticket_purchase_link": game.get("ticket_purchase_link"),
                    },
                    ensure_ascii=True,
                )[:1500],
            }
        )

    return matches


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    response = requests.get(
        SCHEDULE_PAYLOAD_URL,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)",
            "RSC": "1",
        },
        timeout=30,
    )
    response.raise_for_status()

    venue_ids = {
        official_slug: get_or_create_venue(venue_data)
        for official_slug, venue_data in VENUE_DATA_BY_OFFICIAL_SLUG.items()
    }

    for match in parse_schedule_payload(response.text):
        venue_data = VENUE_DATA_BY_OFFICIAL_SLUG[match["venue_slug"]]
        venue_id = venue_ids[match["venue_slug"]]

        events_found += 1
        content_hash = generate_content_hash(match["title"], venue_data["name"], match["start_date"])
        current_hashes.add(content_hash)

        description = f"{match['title']} at {venue_data['name']}. Official LOVB Atlanta home match."
        if match["special_event_description"]:
            description += f" {match['special_event_description']}."

        tags = ["sports", "volleyball", "lovb", "lovb-atlanta", venue_data["slug"], "home-game"]
        if match["tag"]:
            tags.append(match["tag"].lower().replace(" ", "-"))

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": match["title"],
            "description": description,
            "start_date": match["start_date"],
            "start_time": match["start_time"],
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "sports",
            "subcategory": "volleyball",
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": "See LOVB Atlanta for current ticket pricing",
            "is_free": False,
            "source_url": match["source_url"],
            "ticket_url": match["ticket_url"],
            "image_url": None,
            "raw_text": match["raw_text"],
            "extraction_confidence": 0.96,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
            "_parsed_artists": build_matchup_participants(match["opponent"]),
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        insert_event(event_record)
        events_new += 1
        logger.info("Added LOVB Atlanta home match: %s on %s", match["title"], match["start_date"])

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale LOVB Atlanta rows after official refresh", stale_removed)

    logger.info(
        "LOVB Atlanta crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
