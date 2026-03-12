"""
Crawler for U.S. Soccer USMNT schedule.

Uses the official ussoccer.com schedule page, which embeds current match cards in a
Next.js RSC payload. We only surface Atlanta home-market matches for the current
portal so official ownership can replace weaker venue and Ticketmaster rows.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from html import unescape
from zoneinfo import ZoneInfo

import requests
from db import (
    find_existing_event_for_insert,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.ussoccer.com"
SCHEDULE_URL = f"{BASE_URL}/schedule-tickets/usmnt"
ATLANTA_LOCATION = "Atlanta, GA"
EASTERN_TZ = ZoneInfo("America/New_York")

VENUE_DATA = {
    "name": "Mercedes-Benz Stadium",
    "slug": "mercedes-benz-stadium",
    "address": "1 AMB Drive NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7553,
    "lng": -84.4006,
    "venue_type": "stadium",
    "spot_type": "stadium",
    "website": "https://mercedesbenzstadium.com",
}


def _extract_json_array(decoded_payload: str, key: str) -> list[dict]:
    marker = f'"{key}":['
    start = decoded_payload.find(marker)
    if start == -1:
        return []

    array_start = start + len(f'"{key}":')
    depth = 0
    for idx in range(array_start, len(decoded_payload)):
        char = decoded_payload[idx]
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                array_text = decoded_payload[array_start : idx + 1]
                return json.loads(array_text)
    return []


def _extract_next_payloads(page_html: str) -> list[str]:
    payloads: list[str] = []
    pattern = re.compile(
        r'self\.__next_f\.push\(\[1,\s*("(?:(?:\\.|[^"\\])*)")\]\)',
        re.DOTALL,
    )
    for match in pattern.finditer(page_html):
        encoded_payload = match.group(1)
        try:
            payloads.append(json.loads(encoded_payload))
        except json.JSONDecodeError:
            continue
    return payloads


def extract_usmnt_matches(page_html: str) -> list[dict]:
    matches: list[dict] = []

    for decoded_payload in _extract_next_payloads(page_html):
        if '"matches":[' not in decoded_payload:
            continue

        extracted = _extract_json_array(decoded_payload, "matches")
        if extracted:
            matches.extend(extracted)

    return matches


def _build_title(match: dict) -> str:
    contestants = match.get("contestants") or []
    away = next(
        (
            row.get("officialName")
            or row.get("name")
            or row.get("shortName")
            for row in contestants
            if (row.get("position") or "").lower() == "away"
        ),
        None,
    )
    if not away:
        description = match.get("description") or ""
        away = description.replace("United States vs ", "", 1).strip()

    title = f"USMNT vs {away}".strip()
    sponsor = (match.get("sponsor") or "").strip()
    if sponsor:
        title = f"{title} {sponsor}".strip()
    return title


def _parse_start(match: dict) -> tuple[str, str | None]:
    raw_date = (match.get("date") or "").strip()
    if not raw_date:
        raise ValueError("USMNT match missing date")

    utc_dt = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
    local_dt = utc_dt.astimezone(EASTERN_TZ)
    return local_dt.date().isoformat(), local_dt.strftime("%H:%M")


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    response = requests.get(
        SCHEDULE_URL,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=30,
    )
    response.raise_for_status()

    venue_id = get_or_create_venue(VENUE_DATA)

    for match in extract_usmnt_matches(response.text):
        venue = match.get("venue") or {}
        if venue.get("location") != ATLANTA_LOCATION:
            continue

        title = _build_title(match)
        start_date, start_time = _parse_start(match)
        ticket_url = unescape(
            (
                ((match.get("tickets") or {}).get("value") or {}).get("href")
                or match.get("groupTicketUrl")
                or ""
            ).strip()
        )
        source_url = f"{BASE_URL}{(match.get('matchFeedUrl') or '').strip()}"
        if not source_url.startswith("http"):
            source_url = SCHEDULE_URL

        description = (
            f"Official U.S. Soccer match hub for {title} at {venue.get('longName', VENUE_DATA['name'])}."
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "sports",
            "subcategory": "soccer",
            "tags": ["sports", "soccer", "usmnt", "national-team", "atlanta"],
            "price_min": None,
            "price_max": None,
            "price_note": "Check official U.S. Soccer ticket link",
            "is_free": False,
            "source_url": source_url,
            "ticket_url": ticket_url or None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.95,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": generate_content_hash(title, VENUE_DATA["name"], start_date),
        }

        events_found += 1
        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        insert_event(event_record)
        events_new += 1

    logger.info(
        "USMNT crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
