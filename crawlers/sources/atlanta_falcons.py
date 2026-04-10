"""
Crawler for Atlanta Falcons NFL home game schedule.

Uses Ticketmaster Discovery API filtered to Mercedes-Benz Stadium + "Falcons"
keyword to deterministically extract home game events.

API Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

import requests

from config import get_config
from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

TM_API_BASE = "https://app.ticketmaster.com/discovery/v2"
# Mercedes-Benz Stadium venue ID on Ticketmaster (verified 2026-04-10)
TM_VENUE_ID = "KovZpZAEdJaA"
LOOKAHEAD_DAYS = 365
ATLANTA_TZ = ZoneInfo("America/New_York")

PLACE_DATA = {
    "name": "Mercedes-Benz Stadium",
    "slug": "mercedes-benz-stadium",
    "address": "1 AMB Drive NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7553,
    "lng": -84.4006,
    "place_type": "stadium",
    "spot_type": "stadium",
    "website": "https://mercedesbenzstadium.com/",
}

def _build_series_hint() -> dict:
    """Build series hint using the current NFL season year."""
    year = datetime.now(ATLANTA_TZ).year
    # NFL season starting in fall belongs to the year it starts
    season_year = year if datetime.now(ATLANTA_TZ).month >= 6 else year - 1
    return {
        "series_type": "recurring_show",
        "series_title": f"Atlanta Falcons {season_year} Season",
        "frequency": "weekly",
    }


def _fetch_falcons_events(api_key: str) -> list[dict]:
    """Fetch Atlanta Falcons home game events from Ticketmaster Discovery API."""
    start_dt = datetime.now(ATLANTA_TZ)
    end_dt = start_dt + timedelta(days=LOOKAHEAD_DAYS)

    params = {
        "apikey": api_key,
        "venueId": TM_VENUE_ID,
        "keyword": "Falcons",
        "startDateTime": start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "endDateTime": end_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "size": 50,
        "sort": "date,asc",
    }

    response = requests.get(
        f"{TM_API_BASE}/events.json",
        params=params,
        timeout=30,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    response.raise_for_status()
    payload = response.json()

    embedded = payload.get("_embedded") or {}
    events = embedded.get("events") or []
    logger.info("Ticketmaster returned %s Falcons event(s)", len(events))
    return events


def _parse_event_datetime(event: dict) -> tuple[Optional[str], Optional[str]]:
    """Extract local Atlanta date and time from a Ticketmaster event dict."""
    dates = event.get("dates") or {}
    start = dates.get("start") or {}

    # Ticketmaster provides localDate and localTime in the venue's local timezone
    local_date: Optional[str] = start.get("localDate")
    local_time: Optional[str] = start.get("localTime")

    if not local_date:
        return None, None

    if local_time:
        # Normalize to HH:MM
        local_time = local_time[:5]

    return local_date, local_time


def _extract_image_url(event: dict) -> Optional[str]:
    """Return the highest-resolution non-placeholder image URL."""
    images = event.get("images") or []
    # Filter out generic TM category placeholders (/dam/c/)
    event_images = [
        img for img in images if "/dam/c/" not in (img.get("url") or "")
    ]
    pool = event_images if event_images else images
    if not pool:
        return None
    sorted_images = sorted(pool, key=lambda x: x.get("width", 0), reverse=True)
    return sorted_images[0].get("url")


def _extract_price_range(event: dict) -> tuple[Optional[float], Optional[float]]:
    """Return (price_min, price_max) from priceRanges if available."""
    price_ranges = event.get("priceRanges") or []
    if not price_ranges:
        return None, None
    first = price_ranges[0]
    return first.get("min"), first.get("max")


def _build_description(title: str, start_date: str, start_time: Optional[str]) -> str:
    """Build a clean factual description for a Falcons home game."""
    time_part = f" at {start_time}" if start_time else ""
    return (
        f"Atlanta Falcons NFL home game at Mercedes-Benz Stadium. "
        f"Kickoff scheduled for {start_date}{time_part} Eastern. "
        f"Purchase tickets through the official Ticketmaster link."
    )


def _is_falcons_home_game(event: dict) -> bool:
    """Confirm the event is an Atlanta Falcons home game (not a concert etc.)."""
    name = (event.get("name") or "").lower()
    classifications = event.get("classifications") or []

    # Must reference Falcons in the title
    if "falcons" not in name:
        return False

    # Must be classified as sports
    for clf in classifications:
        if not isinstance(clf, dict):
            continue
        segment = clf.get("segment") or {}
        if isinstance(segment, dict) and segment.get("name", "").lower() == "sports":
            return True

    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Falcons home game schedule via Ticketmaster Discovery API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    cfg = get_config()
    api_key = cfg.api.ticketmaster_api_key
    if not api_key:
        logger.error("TICKETMASTER_API_KEY not set — skipping Atlanta Falcons crawl")
        return 0, 0, 0

    try:
        venue_id = get_or_create_place(PLACE_DATA)
        raw_events = _fetch_falcons_events(api_key)

        for event in raw_events:
            if not _is_falcons_home_game(event):
                logger.debug("Skipping non-Falcons-home-game event: %s", event.get("name"))
                continue

            title = (event.get("name") or "").strip()
            if not title:
                continue

            start_date, start_time = _parse_event_datetime(event)
            if not start_date:
                logger.warning("Skipping Falcons event with no date: %s", title)
                continue

            ticket_url = event.get("url") or ""
            source_url = ticket_url
            image_url = _extract_image_url(event)
            price_min, price_max = _extract_price_range(event)
            description = _build_description(title, start_date, start_time)

            content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)
            current_hashes.add(content_hash)
            events_found += 1

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "sports",
                "subcategory": "football",
                "tags": ["atlanta-falcons", "nfl", "football", "mercedes-benz-stadium", "home-game"],
                "price_min": price_min,
                "price_max": price_max,
                "price_note": "Ticketed NFL game — prices vary by section and date.",
                "is_free": False,
                "source_url": source_url,
                "ticket_url": ticket_url,
                "image_url": image_url,
                "raw_text": f"{title} - {start_date}",
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
                insert_event(event_record, series_hint=_build_series_hint())
                events_new += 1
                logger.debug("Added: %s on %s", title, start_date)
            except Exception as exc:
                logger.error("Failed to insert Falcons game %s on %s: %s", title, start_date, exc)

        stale_removed = remove_stale_source_events(source_id, current_hashes)
        if stale_removed:
            logger.info("Removed %s stale Atlanta Falcons events after schedule refresh", stale_removed)

        logger.info(
            "Atlanta Falcons crawl complete: %s found, %s new, %s updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Atlanta Falcons: %s", exc)
        raise

    return events_found, events_new, events_updated
