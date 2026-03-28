"""
Crawler for Atlanta Film Festival (atlff26.eventive.org).

The 50th annual ATLFF runs April 23 - May 3, 2026 across multiple Atlanta venues.
Data source: Eventive platform API (api.eventive.org).

Strategy:
- Phase 1: Index all 151+ films from the Eventive films API as events. Film metadata
  (director, runtime, year, synopsis, image) is available now even before individual
  screening times are scheduled.
- Phase 2: Pull all scheduled events (screenings with specific times) and upsert them
  with precise start_time and venue. Screening times are being added progressively as
  the festival approaches.

The API key is the public client key embedded in the Eventive frontend bundle. It is
not a secret — it is shipped to every user's browser and gives read-only access to
publicly-visible festival content.
"""

from __future__ import annotations

import html
import logging
import re
import urllib.request
import json
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Eventive API configuration
# ---------------------------------------------------------------------------
# The bucket ID and API key are baked into the public festival frontend JS bundle.
# They are intentional public read credentials for the Eventive platform.
EVENTIVE_API_BASE = "https://api.eventive.org"
BUCKET_ID = "6817a3bdc26e086da991e7c3"
API_KEY = "96e99b063bbd01a738423dfb5ff419c4"
FRONTEND_ORIGIN = "https://atlff26.eventive.org"

# Festival date range — used as fallback when no specific screening time is scheduled
FESTIVAL_START = "2026-04-23"
FESTIVAL_END = "2026-05-03"

# Timezone for all Eventive UTC timestamps
EASTERN = ZoneInfo("America/New_York")

# ---------------------------------------------------------------------------
# Venue data for the festival itself (multi-venue, used as fallback)
# ---------------------------------------------------------------------------
FESTIVAL_VENUE_DATA = {
    "name": "Atlanta Film Festival 2026",
    "slug": "atlanta-film-festival-2026",
    "address": "535 Means St NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7706,
    "lng": -84.4110,
    "venue_type": "festival",
    "website": "https://www.atlantafilmfestival.com",
}

# Known Eventive venue slugs → PLACE_DATA for get_or_create_place
# Populated on first encounter and cached across the crawl run
_VENUE_CACHE: dict[str, int] = {}


def _api_headers() -> dict:
    return {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json",
        "Origin": FRONTEND_ORIGIN,
        "Referer": f"{FRONTEND_ORIGIN}/",
        "x-api-key": API_KEY,
    }


def _api_get(path: str) -> dict | list:
    url = f"{EVENTIVE_API_BASE}{path}"
    req = urllib.request.Request(url, headers=_api_headers())
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        return json.loads(resp.read())
    except urllib.request.HTTPError as exc:
        body = exc.read(300).decode("utf-8", errors="replace")
        logger.error("Eventive API error %s for %s: %s", exc.code, path, body[:200])
        raise
    except Exception as exc:
        logger.error("Eventive API request failed for %s: %s", path, exc)
        raise


def _strip_html(text: str) -> str:
    """Remove HTML tags and decode entities."""
    clean = re.sub(r"<[^>]+>", " ", text or "")
    clean = html.unescape(clean)
    return re.sub(r"\s+", " ", clean).strip()


def _parse_utc_to_eastern(iso_str: str) -> tuple[str, str]:
    """Convert ISO UTC datetime string to (YYYY-MM-DD, HH:MM:SS) in Eastern time."""
    dt_utc = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    dt_et = dt_utc.astimezone(EASTERN)
    return dt_et.strftime("%Y-%m-%d"), dt_et.strftime("%H:%M:%S")


def _get_or_cache_venue(eventive_venue: dict) -> int:
    """Return a LostCity venue_id for an Eventive venue dict, creating if needed."""
    venue_name = eventive_venue.get("name", "Atlanta Film Festival")
    cache_key = eventive_venue.get("id", venue_name)

    if cache_key in _VENUE_CACHE:
        return _VENUE_CACHE[cache_key]

    address = eventive_venue.get("address", "535 Means St NW, Atlanta, GA 30318")
    # Parse city/state/zip from "123 Main St, Atlanta, GA 30308" format
    neighborhood = "Midtown"  # Default — ATLFF venues are concentrated in Midtown
    city, state, zip_code = "Atlanta", "GA", ""
    addr_match = re.search(r",\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?", address)
    if addr_match:
        city = addr_match.group(1).strip()
        state = addr_match.group(2)
        zip_code = addr_match.group(3) or ""

    slug_base = re.sub(r"[^a-z0-9]+", "-", venue_name.lower()).strip("-")

    place_data = {
        "name": venue_name,
        "slug": slug_base,
        "address": address.split(",")[0].strip() if "," in address else address,
        "neighborhood": neighborhood,
        "city": city,
        "state": state,
        "zip": zip_code,
        "venue_type": "cinema",
        "website": "https://www.atlantafilmfestival.com",
    }

    venue_id = get_or_create_place(place_data)
    _VENUE_CACHE[cache_key] = venue_id
    return venue_id


def _film_to_tags(film: dict) -> list[str]:
    """Build tag list from Eventive film record."""
    tags = ["film", "festival", "atlff", "independent"]
    for tag in film.get("tags", []):
        name = tag.get("name", "")
        if name:
            slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
            tags.append(slug)
    return list(dict.fromkeys(tags))  # Deduplicate while preserving order


def _infer_subcategory(film: dict) -> str:
    """Infer film subcategory from Eventive tags."""
    tag_names = {t.get("name", "").lower() for t in film.get("tags", [])}
    if any("short" in t for t in tag_names):
        return "short_film"
    if any("documentary" in t for t in tag_names):
        return "documentary"
    if any("feature" in t for t in tag_names):
        return "feature_film"
    if any("animation" in t for t in tag_names):
        return "animation"
    return "screening"


def _crawl_films(source_id: int, festival_venue_id: int) -> tuple[int, int, int]:
    """
    Phase 1: Crawl all films from the Eventive films API.

    Each film is created as an event anchored to the festival start date.
    These are updated to specific screening times in Phase 2 once scheduled.
    """
    found = new = updated = 0

    data = _api_get(f"/event_buckets/{BUCKET_ID}/films")
    films = data.get("films", [])
    logger.info("Eventive films API returned %d films", len(films))

    for film in films:
        name = film.get("name", "").strip()
        if not name:
            continue

        film_id = film.get("id", "")
        public_url = f"{FRONTEND_ORIGIN}/films/{film_id}"

        # Build description from synopsis + credits
        desc_parts = []
        short_desc = _strip_html(film.get("short_description") or "")
        long_desc = _strip_html(film.get("description") or "")
        synopsis = short_desc or long_desc
        if synopsis:
            desc_parts.append(synopsis)

        credits = film.get("credits") or {}
        details = film.get("details") or {}

        director = credits.get("director", "").strip()
        if director:
            desc_parts.append(f"Director: {director}")

        runtime = details.get("runtime", "")
        year = details.get("year", "")
        country = details.get("country", "")
        if any([runtime, year, country]):
            meta = " | ".join(filter(None, [
                f"{year}" if year else "",
                f"{runtime} min" if runtime else "",
                country,
            ]))
            if meta.strip():
                desc_parts.append(meta)

        premiere = details.get("premiere", "")
        if premiere:
            desc_parts.append(f"Premiere: {premiere}")

        description = "\n".join(desc_parts) if desc_parts else f"Atlanta Film Festival 2026 — {name}"

        image_url = film.get("cover_image") or film.get("still_image")
        tags = _film_to_tags(film)
        subcategory = _infer_subcategory(film)

        found += 1
        content_hash = generate_content_hash(name, "Atlanta Film Festival 2026", FESTIVAL_START)

        event_record = {
            "source_id": source_id,
            "venue_id": festival_venue_id,
            "title": name,
            "description": description,
            "start_date": FESTIVAL_START,
            "start_time": None,
            "end_date": FESTIVAL_END,
            "end_time": None,
            "is_all_day": True,
            "category": "film",
            "subcategory": subcategory,
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": "Requires festival badge or individual screening ticket",
            "is_free": False,
            "source_url": public_url,
            "ticket_url": f"{FRONTEND_ORIGIN}/schedule",
            "image_url": image_url,
            "raw_text": None,
            "extraction_confidence": 0.95,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
        else:
            try:
                insert_event(event_record)
                new += 1
                logger.debug("Added film: %s", name)
            except Exception as exc:
                logger.error("Failed to insert film %s: %s", name, exc)

    return found, new, updated


def _crawl_scheduled_events(source_id: int, festival_venue_id: int) -> tuple[int, int, int]:
    """
    Phase 2: Crawl scheduled screening events with specific times and venues.

    These are the individual ticketed screenings added as the festival approaches.
    Once a film has scheduled screenings, its event record should be updated from
    is_all_day=True to a specific start_time.
    """
    found = new = updated = 0

    data = _api_get(f"/event_buckets/{BUCKET_ID}/events")
    events = data.get("events", [])
    logger.info("Eventive events API returned %d scheduled events", len(events))

    for event in events:
        name = event.get("name", "").strip()
        if not name:
            continue

        event_id = event.get("id", "")
        public_url = f"{FRONTEND_ORIGIN}/schedule/{event_id}"

        start_iso = event.get("start_time")
        end_iso = event.get("end_time")

        if start_iso:
            start_date, start_time = _parse_utc_to_eastern(start_iso)
        else:
            start_date = FESTIVAL_START
            start_time = None

        if end_iso:
            end_date, end_time = _parse_utc_to_eastern(end_iso)
        else:
            end_date = None
            end_time = None

        # Resolve venue
        eventive_venue = event.get("venue")
        if eventive_venue and isinstance(eventive_venue, dict):
            venue_id = _get_or_cache_venue(eventive_venue)
        else:
            venue_id = festival_venue_id

        # Build description
        desc_raw = event.get("description") or event.get("short_description") or ""
        description = _strip_html(desc_raw) or f"Atlanta Film Festival 2026 — {name}"

        # Tags from event tags + linked films
        tags = ["film", "festival", "atlff"]
        for tag in event.get("tags", []):
            tag_name = tag.get("name", "")
            if tag_name:
                slug = re.sub(r"[^a-z0-9]+", "-", tag_name.lower()).strip("-")
                tags.append(slug)

        films_linked = event.get("films", [])
        if films_linked:
            tags.append("screening")

        tags = list(dict.fromkeys(tags))

        # Price from ticket_buckets
        price_min = None
        price_max = None
        is_free = False
        for tb in event.get("ticket_buckets", []):
            if not tb.get("public", True):
                continue
            price = tb.get("price", 0)
            if tb.get("variable_price"):
                price = tb.get("variable_price_minimum", 0)
            if price_min is None or price < price_min:
                price_min = price
            if price_max is None or price > price_max:
                price_max = price

        if price_min is not None and price_min == 0 and price_max == 0:
            is_free = True
        if price_min == 0 and price_max and price_max > 0:
            price_min = None  # "Pay what you can" style

        image_url = None
        images = event.get("images", [])
        if images and isinstance(images, list):
            image_url = images[0].get("url") if isinstance(images[0], dict) else None

        found += 1
        # Use event_id in hash so each scheduling instance is unique
        content_hash = generate_content_hash(name, "Atlanta Film Festival 2026", f"{start_date}:{event_id}")

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": name,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date,
            "end_time": end_time,
            "is_all_day": start_time is None,
            "category": "film",
            "subcategory": "screening",
            "tags": tags,
            "price_min": price_min,
            "price_max": price_max,
            "price_note": "Requires festival badge or individual screening ticket",
            "is_free": is_free,
            "source_url": public_url,
            "ticket_url": public_url,
            "image_url": image_url,
            "raw_text": None,
            "extraction_confidence": 0.97,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
        else:
            try:
                insert_event(event_record)
                new += 1
                logger.info("Added screening: %s on %s at %s", name, start_date, start_time)
            except Exception as exc:
                logger.error("Failed to insert screening %s: %s", name, exc)

    return found, new, updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Film Festival via Eventive API."""
    source_id = source["id"]
    total_found = total_new = total_updated = 0

    _VENUE_CACHE.clear()

    try:
        festival_venue_id = get_or_create_place(FESTIVAL_VENUE_DATA)

        # Phase 1: All films (151+ titles, available now)
        f, n, u = _crawl_films(source_id, festival_venue_id)
        total_found += f
        total_new += n
        total_updated += u
        logger.info("Films phase: %d found, %d new, %d updated", f, n, u)

        # Phase 2: Scheduled screenings with specific times
        f, n, u = _crawl_scheduled_events(source_id, festival_venue_id)
        total_found += f
        total_new += n
        total_updated += u
        logger.info("Screenings phase: %d found, %d new, %d updated", f, n, u)

    except Exception as exc:
        logger.error("Atlanta Film Festival crawl failed: %s", exc)
        raise

    logger.info(
        "Atlanta Film Festival crawl complete: %d found, %d new, %d updated",
        total_found,
        total_new,
        total_updated,
    )
    return total_found, total_new, total_updated
