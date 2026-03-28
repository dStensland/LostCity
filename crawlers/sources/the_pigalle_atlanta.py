"""
Crawler for Pigalle Theater & Speakeasy (The Pigalle Atlanta).
Parisian-style cabaret, burlesque, and absinthe bar.
Organizer: "Pigalle Theater & Speakeasy" on Eventbrite (organizer ID: 70832902633)
Instagram: @thepigalle

Address: 50 Upper Alabama St, Underground Atlanta, Atlanta, GA 30303

NOTE ON DOMAIN: thepigalle.com is hijacked by a spam/gambling site.
The Pigalle operates as an event producer rather than a fixed venue —
individual shows are hosted at various Atlanta locations (Underground Atlanta,
Atlantucky Brewing, and others). The venue record points to their primary
Underground Atlanta address; each event's specific venue is captured from
the Eventbrite event data.

NOTE ON EVENTBRITE API: The /organizers/{id}/events/ endpoint returns 0
events for this organizer despite 35+ past events existing on Eventbrite.
This appears to be an API visibility issue. Instead, we scrape the organizer
page HTML which contains full event data in a JSON-LD itemListElement block,
then fetch each event individually via the Eventbrite API for complete details.
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from config import get_config
from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
    remove_stale_source_events,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

ORGANIZER_ID = "70832902633"
ORGANIZER_URL = (
    f"https://www.eventbrite.com/o/pigalle-theater-speakeasy-{ORGANIZER_ID}/"
)
API_BASE = "https://www.eventbriteapi.com/v3/"

# Primary venue record for The Pigalle as an organization.
# Individual show venues may differ and are captured per-event from Eventbrite.
PLACE_DATA = {
    "name": "The Pigalle",
    "slug": "the-pigalle-atlanta",
    "address": "50 Upper Alabama St",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7484,
    "lng": -84.3912,
    "venue_type": "nightclub",
    "spot_type": "nightclub",
    "website": "https://www.eventbrite.com/o/pigalle-theater-speakeasy-70832902633",
    "description": (
        "Pigalle Theater & Speakeasy is Atlanta's Parisian-style cabaret and burlesque "
        "production company. Launched in 2023, the Pigalle produces themed burlesque "
        "shows, speakeasy nights, and theatrical cabaret events throughout Atlanta, "
        "with a home base at Underground Atlanta. Shows blend burlesque, drag, jazz, "
        "and pop culture tribute performances."
    ),
    "vibes": [
        "artsy",
        "lively",
        "late-night",
        "date-spot",
        "burlesque",
        "cabaret",
        "underground-atlanta",
    ],
}

_VENUE_PAREN_DROP_HINTS = (
    "course map",
    "emailed",
    "email",
    "details sent",
    "address shared",
)
_VENUE_PAREN_NOTE_RE = re.compile(r"\s*\(([^)]{1,120})\)\s*$")


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _normalize_venue_name(raw_name: str) -> str:
    name = _clean_text(raw_name)
    if not name:
        return ""
    match = _VENUE_PAREN_NOTE_RE.search(name)
    if match:
        note = match.group(1).lower()
        if any(hint in note for hint in _VENUE_PAREN_DROP_HINTS):
            name = _clean_text(name[: match.start()])
    return name


def get_api_headers() -> dict:
    cfg = get_config()
    api_key = cfg.api.eventbrite_api_key
    if not api_key:
        raise ValueError("EVENTBRITE_API_KEY not configured")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def discover_event_ids_from_organizer_page() -> list[str]:
    """
    Scrape the Eventbrite organizer page HTML to extract event IDs.

    The /organizers/{id}/events/ API endpoint returns empty for this organizer,
    but the organizer webpage embeds event data in a JSON-LD itemListElement block
    which is parseable without JavaScript.
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    try:
        resp = requests.get(ORGANIZER_URL, headers=headers, timeout=20)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"Failed to fetch Pigalle organizer page: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    event_ids: list[str] = []

    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = (script.string or script.get_text() or "").strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            continue

        if not isinstance(data, dict):
            continue

        items = data.get("itemListElement", [])
        if not items:
            continue

        for item in items:
            url = (item.get("item") or {}).get("url", "")
            match = re.search(r"/e/[^/]+-(\d+)(?:\?|$)", url)
            if match:
                event_ids.append(match.group(1))

    logger.info(f"Discovered {len(event_ids)} event IDs from Pigalle organizer page")
    return event_ids


def fetch_event_from_api(event_id: str) -> Optional[dict]:
    """Fetch full event details from the Eventbrite v3 API."""
    url = f"{API_BASE}events/{event_id}/"
    params = {"expand": "venue,organizer,ticket_availability,category,format"}
    try:
        resp = requests.get(
            url, headers=get_api_headers(), params=params, timeout=15
        )
        if resp.status_code == 404:
            logger.debug(f"Event {event_id} not found (private or ended)")
            return None
        if resp.status_code == 429:
            logger.warning("Eventbrite rate limited — waiting 30 seconds")
            time.sleep(30)
            return fetch_event_from_api(event_id)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        logger.error(f"Error fetching Eventbrite event {event_id}: {e}")
        return None


def parse_datetime(dt_str: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Parse Eventbrite 'local' datetime string to (date, time) strings."""
    if not dt_str:
        return None, None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M:%S")
    except (ValueError, TypeError):
        return None, None


def process_event(
    event_data: dict,
    source_id: int,
    default_venue_id: int,
) -> Optional[dict]:
    """
    Convert Eventbrite API event dict to our event record format.
    Returns None if the event should be skipped (past, wrong region, etc.).
    """
    title = (event_data.get("name") or {}).get("text", "").strip()
    if not title:
        return None

    start_info = event_data.get("start") or {}
    start_date, start_time = parse_datetime(start_info.get("local"))
    if not start_date:
        return None
    if start_date < datetime.now().strftime("%Y-%m-%d"):
        return None

    end_info = event_data.get("end") or {}
    end_date, end_time = parse_datetime(end_info.get("local"))

    description_raw = (event_data.get("description") or {}).get("text", "") or ""
    description = _clean_text(description_raw)

    is_free = bool(event_data.get("is_free", False))

    # Image
    logo = event_data.get("logo") or {}
    image_url: Optional[str] = None
    if logo:
        original = logo.get("original") or {}
        image_url = original.get("url")

    event_url = event_data.get("url", "")

    # Venue — if event has a specific venue, use it; otherwise fall back to default
    place_data = event_data.get("venue") or {}
    venue_id = default_venue_id

    if place_data and place_data.get("name"):
        venue_name = _normalize_venue_name(place_data["name"])
        if venue_name:
            address_data = place_data.get("address") or {}
            region = address_data.get("region", "")
            if region and region not in ("GA", "Georgia"):
                logger.debug(f"Skipping non-GA venue: {venue_name} ({region})")
                return None
            venue_record = {
                "name": venue_name,
                "slug": re.sub(r"[^a-z0-9-]", "", venue_name.lower().replace(" ", "-"))[:50],
                "address": address_data.get("address_1"),
                "city": address_data.get("city", "Atlanta"),
                "state": "GA",
                "zip": address_data.get("postal_code"),
                "venue_type": "event_space",
                "website": None,
            }
            venue_id = get_or_create_place(venue_record)

    content_hash = generate_content_hash(
        title, place_data.get("name") or "The Pigalle", start_date
    )

    tags = ["cabaret", "burlesque", "speakeasy", "underground-atlanta"]
    if is_free:
        tags.append("free")

    if not description:
        description = (
            f"{title} — a Pigalle Theater & Speakeasy production. "
            f"Themed cabaret and burlesque entertainment in Atlanta. "
            f"Tickets and details: {event_url}"
        )

    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title[:500],
        "description": description[:2000],
        "start_date": start_date,
        "start_time": start_time,
        "end_date": end_date or start_date,
        "end_time": end_time,
        "is_all_day": False,
        "category": "theater",
        "subcategory": "cabaret",
        "tags": tags,
        "price_min": None,
        "price_max": None,
        "price_note": "Free" if is_free else "See Eventbrite",
        "is_free": is_free,
        "source_url": event_url,
        "ticket_url": event_url,
        "image_url": image_url,
        "raw_text": f"{title} | {start_date} {start_time or ''}".strip(),
        "extraction_confidence": 0.92,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl The Pigalle events via Eventbrite organizer page + API.

    Discovery: scrape organizer page HTML for event IDs (JSON-LD).
    Enrichment: fetch each event individually from Eventbrite v3 API.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    try:
        default_venue_id = get_or_create_place(PLACE_DATA)

        # Step 1: Discover event IDs from the organizer page
        logger.info("Discovering The Pigalle events from Eventbrite organizer page...")
        event_ids = discover_event_ids_from_organizer_page()

        if not event_ids:
            logger.info("The Pigalle: no upcoming events found on Eventbrite")
            remove_stale_source_events(source_id, current_hashes)
            return 0, 0, 0

        # Step 2: Fetch each event from the Eventbrite API
        logger.info(f"Fetching {len(event_ids)} Pigalle events from Eventbrite API...")
        for event_id in event_ids:
            event_data = fetch_event_from_api(event_id)
            if not event_data:
                continue

            event_record = process_event(event_data, source_id, default_venue_id)
            if not event_record:
                continue

            events_found += 1
            content_hash = event_record["content_hash"]
            current_hashes.add(content_hash)

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(
                    f"Added: {event_record['title'][:60]!r} on {event_record['start_date']}"
                )
            except Exception as e:
                logger.error(
                    f"Failed to insert {event_record['title'][:60]!r}: {e}"
                )

            time.sleep(0.2)  # be polite to the Eventbrite API

        remove_stale_source_events(source_id, current_hashes)

    except Exception as e:
        logger.error(f"Failed to crawl The Pigalle: {e}")
        raise

    logger.info(
        f"The Pigalle crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
