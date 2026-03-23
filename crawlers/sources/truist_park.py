"""
Crawler for Truist Park / The Battery Atlanta.

Uses MLB schedule API for deterministic Atlanta Braves home game extraction.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta, date
from typing import Optional
from zoneinfo import ZoneInfo

import requests

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://www.mlb.com/braves/ballpark"
SCHEDULE_API_URL = "https://statsapi.mlb.com/api/v1/schedule"
BRAVES_TEAM_ID = 144

VENUE_DATA = {
    "name": "Truist Park",
    "slug": "truist-park",
    "address": "755 Battery Ave SE",
    "neighborhood": "The Battery",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "lat": 33.8907,
    "lng": -84.4678,
    "venue_type": "stadium",
    "spot_type": "stadium",
    "website": BASE_URL,
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def format_time_label(time_24: Optional[str]) -> Optional[str]:
    if not time_24:
        return None
    raw = str(time_24).strip()
    if not raw:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).strftime("%-I:%M %p")
        except ValueError:
            continue
    return raw


def build_truist_description(
    *,
    title: str,
    start_date: str,
    start_time: Optional[str],
    source_url: str,
) -> str:
    lowered = title.lower()
    if any(k in lowered for k in ("braves", "baseball", "vs.", "vs ")):
        lead = f"{title} at Truist Park."
        context = "Live baseball experience at the Atlanta Braves' home stadium in The Battery."
    elif any(k in lowered for k in ("tour", "tours")):
        lead = f"{title} at Truist Park."
        context = "Stadium tour experience with ballpark access details listed by the organizer."
    elif any(k in lowered for k in ("concert", "show", "festival")):
        lead = f"{title} at Truist Park."
        context = "Live event in The Battery entertainment district at Truist Park."
    else:
        lead = f"{title} at Truist Park."
        context = "Live event in The Battery entertainment district."

    parts = [lead, context, "Location: Truist Park, The Battery, Atlanta, GA."]
    time_label = format_time_label(start_time)
    if start_date and time_label:
        parts.append(f"Scheduled on {start_date} at {time_label}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    if source_url:
        parts.append(f"Check the official listing for latest entry rules, parking, and ticket availability ({source_url}).")
    else:
        parts.append("Check the official listing for latest entry rules, parking, and ticket availability.")
    return " ".join(parts)[:1200]


def _parse_game_datetime(game_date: str) -> tuple[str, Optional[str]]:
    """Parse MLB API gameDate into local Atlanta date/time."""
    dt_utc = datetime.fromisoformat(game_date.replace("Z", "+00:00"))
    dt_local = dt_utc.astimezone(ZoneInfo("America/New_York"))
    return dt_local.strftime("%Y-%m-%d"), dt_local.strftime("%H:%M")


def _fetch_schedule(start: date, end: date) -> list[dict]:
    params = {
        "sportId": 1,
        "teamId": BRAVES_TEAM_ID,
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
    }
    response = requests.get(
        SCHEDULE_API_URL,
        params=params,
        timeout=30,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    response.raise_for_status()
    payload = response.json()
    games: list[dict] = []
    for d in payload.get("dates", []):
        games.extend(d.get("games", []))
    return games


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add("destination_details", {
        "venue_id": venue_id,
        "destination_type": "stadium",
        "commitment_tier": "halfday",
        "primary_activity": "Atlanta Braves MLB games and The Battery entertainment district",
        "best_seasons": ["spring", "summer", "fall"],
        "weather_fit_tags": ["outdoor", "partially-covered"],
        "parking_type": "paid_lot",
        "best_time_of_day": "any",
        "practical_notes": (
            "The Battery Atlanta entertainment district surrounds the stadium with restaurants, bars, "
            "and shops open year-round regardless of game schedule. Battery garages fill up on game days "
            "— arrive early or consider rideshare. The park itself is best experienced during baseball season."
        ),
        "accessibility_notes": "Fully ADA accessible. Companion seating available in all sections.",
        "family_suitability": "yes",
        "reservation_required": True,
        "permit_required": False,
        "fee_note": "Game tickets vary. The Battery district is free to visit.",
        "source_url": BASE_URL,
        "metadata": {"source_type": "venue_enrichment", "venue_type": "stadium", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "battery-atlanta-district",
        "title": "The Battery Atlanta entertainment district",
        "feature_type": "attraction",
        "description": "A walkable mixed-use district with 30+ restaurants, bars, and shops surrounding the ballpark — active year-round, not just on game days.",
        "url": "https://batteryatl.com",
        "is_free": True,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "braves-museum-monument-garden",
        "title": "Braves museum and Monument Garden",
        "feature_type": "experience",
        "description": "The Braves' on-site museum and Monument Garden celebrating franchise history with statues, memorabilia, and interactive displays.",
        "url": BASE_URL,
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "ballpark-tours",
        "title": "Ballpark tours",
        "feature_type": "experience",
        "description": "Guided tours of Truist Park including dugout access, press box, and behind-the-scenes areas on non-game days.",
        "url": BASE_URL,
        "is_free": False,
        "sort_order": 30,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "battery-restaurants-taproom",
        "title": "Terrapin Taproom, Antico Pizza, and Battery restaurants",
        "feature_type": "amenity",
        "description": "The Battery offers a range of dining from Terrapin Taproom's craft beer to Antico Pizza's wood-fired pies.",
        "url": "https://batteryatl.com",
        "is_free": False,
        "sort_order": 40,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "the-sandlot-kids-area",
        "title": "The Sandlot kids' play area",
        "feature_type": "amenity",
        "description": "Interactive kids' play area at The Battery for families attending games or visiting the district.",
        "url": "https://batteryatl.com",
        "is_free": True,
        "sort_order": 50,
    })
    envelope.add("venue_specials", {
        "venue_id": venue_id,
        "slug": "truist-park-ballpark-tours",
        "title": "Truist Park ballpark tours",
        "description": "Guided ballpark tours available on non-game days with access to the dugout, press box, and more.",
        "price_note": "Tour tickets sold separately from game tickets.",
        "is_free": False,
        "source_url": BASE_URL,
        "category": "recurring_deal",
    })
    return envelope


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Truist Park home games via MLB schedule API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        persist_typed_entity_envelope(_build_destination_envelope(venue_id))
        today = datetime.now().date()
        end_date = today + timedelta(days=240)
        games = _fetch_schedule(today, end_date)
        logger.info("Fetched %s Braves schedule games in window", len(games))

        for game in games:
            venue = game.get("venue") or {}
            if venue.get("name") != "Truist Park":
                continue

            teams = game.get("teams") or {}
            home = ((teams.get("home") or {}).get("team") or {}).get("name", "")
            away = ((teams.get("away") or {}).get("team") or {}).get("name", "")
            if not home or not away:
                continue

            # We only keep Atlanta home games at Truist.
            if "Atlanta Braves" not in home:
                continue

            start_date, start_time = _parse_game_datetime(game.get("gameDate", ""))
            if not start_date:
                continue

            title = f"Atlanta Braves vs {away}"
            game_pk = game.get("gamePk")
            event_url = f"https://www.mlb.com/gameday/{game_pk}" if game_pk else BASE_URL
            image_url = (
                "https://www.mlbstatic.com/team-logos/share/144.jpg"
                if game_pk
                else None
            )

            events_found += 1
            content_hash = generate_content_hash(title, "Truist Park", start_date)
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": build_truist_description(
                    title=title,
                    start_date=start_date,
                    start_time=start_time,
                    source_url=event_url,
                ),
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "sports",
                "subcategory": "baseball",
                "tags": ["atlanta-braves", "mlb", "baseball", "truist-park"],
                "price_min": None,
                "price_max": None,
                "price_note": "Ticketed MLB game",
                "is_free": False,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": image_url,
                "raw_text": f"{title} - {start_date}",
                "extraction_confidence": 0.93,
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
            except Exception as e:
                logger.error(f"Failed to insert: {title}: {e}")

        logger.info(
            f"Truist Park crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Truist Park: {e}")
        raise

    return events_found, events_new, events_updated
