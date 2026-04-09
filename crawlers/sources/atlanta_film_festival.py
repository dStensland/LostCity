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
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from db import (
    get_client,
    get_or_create_place,
    writes_enabled,
    persist_screening_bundle,
    sync_run_events_from_screenings,
    remove_stale_showtime_events,
    build_screening_bundle_from_event_rows,
    entries_to_event_like_rows,
)

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
FESTIVAL_NAME = "Atlanta Film Festival"

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
    "place_type": "festival",
    "website": "https://www.atlantafilmfestival.com",
    "is_active": True,
}

# Known Eventive venue slugs → PLACE_DATA for get_or_create_place
# Populated on first encounter and cached across the crawl run
_VENUE_CACHE: dict[str, int] = {}
_BLACKLISTED_EVENT_TITLES = {
    "Championing discovery, artistic growth, and the arts locally and internationally.",
}


def _is_ancillary_outside_window(
    *,
    films_linked: list,
    start_date: Optional[str],
) -> bool:
    """Treat non-film Eventive specials outside the announced festival window as ancillary.

    These items can appear in the Eventive events feed, but they should not stay
    linked under the core ATLFF festival window integrity gates.
    """
    if films_linked:
        return False
    if not start_date:
        return False
    return start_date < FESTIVAL_START or start_date > FESTIVAL_END


def _deactivate_existing_event(existing: dict) -> None:
    event_id = existing.get("id")
    if not event_id or existing.get("is_active") is False:
        return
    client = get_client()
    client.table("events").update({"is_active": False}).eq("id", event_id).execute()
    logger.info(
        "Deactivated ancillary ATLFF event %s: %s", event_id, existing.get("title")
    )


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
        "place_type": "cinema",
        "website": "https://www.atlantafilmfestival.com",
        "is_active": True,
    }

    venue_id = get_or_create_place(place_data)
    _VENUE_CACHE[cache_key] = venue_id
    return venue_id


def _is_blacklisted_title(title: str) -> bool:
    return (title or "").strip() in _BLACKLISTED_EVENT_TITLES


def _build_film_series_hint(
    *,
    series_title: str,
    description: str,
    image_url: Optional[str],
    director: Optional[str] = None,
    runtime_minutes: Optional[int] = None,
    year: Optional[int] = None,
    imdb_id: Optional[str] = None,
) -> dict:
    hint = {
        "series_type": "film",
        "series_title": series_title,
        "festival_name": FESTIVAL_NAME,
        "festival_website": "https://www.atlantafilmfestival.com",
    }
    if description:
        hint["description"] = description
    if image_url:
        hint["image_url"] = image_url
    if director:
        hint["director"] = director
    if runtime_minutes:
        hint["runtime_minutes"] = runtime_minutes
    if year:
        hint["year"] = year
    if imdb_id:
        hint["imdb_id"] = imdb_id
    return hint


def _build_nonfilm_session_description(name: str, description: str) -> str:
    cleaned = (description or "").strip()
    if len(cleaned) >= 80:
        return cleaned
    return (
        f"{name} is a scheduled Atlanta Film Festival 2026 festival session in the published "
        "Eventive lineup. The current listing does not yet include full program copy or panel details."
    )


def _build_series_hint_for_screening(
    event: dict,
    description: str,
    image_url: Optional[str],
) -> dict:
    films_linked = event.get("films") or []
    if films_linked:
        primary_film = films_linked[0]
        details = primary_film.get("details") or {}
        credits = primary_film.get("credits") or {}
        runtime_minutes = None
        runtime_raw = details.get("runtime")
        if runtime_raw:
            try:
                runtime_minutes = int(str(runtime_raw).strip())
            except ValueError:
                runtime_minutes = None
        year = None
        year_raw = details.get("year")
        if year_raw:
            try:
                year = int(str(year_raw).strip())
            except ValueError:
                year = None
        return _build_film_series_hint(
            series_title=(primary_film.get("name") or event.get("name") or "").strip(),
            description=_strip_html(primary_film.get("description") or "")
            or description,
            image_url=(
                primary_film.get("poster_image")
                or primary_film.get("cover_image")
                or primary_film.get("still_image")
                or image_url
            ),
            director=(credits.get("director") or "").strip() or None,
            runtime_minutes=runtime_minutes,
            year=year,
            imdb_id=(primary_film.get("imdb_id") or "").strip() or None,
        )

    return _build_film_series_hint(
        series_title=(event.get("name") or "").strip(),
        description=_build_nonfilm_session_description(
            (event.get("name") or "").strip(),
            description,
        ),
        image_url=image_url,
    )


def _deactivate_blacklisted_events(source_id: int) -> int:
    if not writes_enabled():
        return 0
    client = get_client()
    if not _BLACKLISTED_EVENT_TITLES:
        return 0
    rows = (
        client.table("events")
        .select("id,title,is_active")
        .eq("source_id", source_id)
        .in_("title", list(_BLACKLISTED_EVENT_TITLES))
        .execute()
        .data
        or []
    )
    deactivated = 0
    for row in rows:
        if row.get("is_active") is False:
            continue
        client.table("events").update({"is_active": False}).eq(
            "id", row["id"]
        ).execute()
        logger.info("Deactivated junk ATLFF row %s: %s", row["id"], row["title"])
        deactivated += 1
    return deactivated


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


def _crawl_films(source_id: int, festival_venue_id: int) -> list[dict]:
    """
    Phase 1: Crawl all films from the Eventive films API.

    Each film is anchored to the festival start date as a screening entry.
    These are updated to specific screening times in Phase 2 once scheduled.

    Returns a list of screening entry dicts for later bulk persistence.
    """
    entries: list[dict] = []

    data = _api_get(f"/event_buckets/{BUCKET_ID}/films")
    films = data.get("films", [])
    logger.info("Eventive films API returned %d films", len(films))

    for film in films:
        name = film.get("name", "").strip()
        if not name or _is_blacklisted_title(name):
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
            meta = " | ".join(
                filter(
                    None,
                    [
                        f"{year}" if year else "",
                        f"{runtime} min" if runtime else "",
                        country,
                    ],
                )
            )
            if meta.strip():
                desc_parts.append(meta)

        premiere = details.get("premiere", "")
        if premiere:
            desc_parts.append(f"Premiere: {premiere}")

        description = (
            "\n".join(desc_parts)
            if desc_parts
            else f"Atlanta Film Festival 2026 — {name}"
        )

        image_url = film.get("cover_image") or film.get("still_image")
        tags = _film_to_tags(film)

        entries.append({
            "title": name,
            "start_date": FESTIVAL_START,
            "start_time": None,
            "image_url": image_url,
            "source_url": public_url,
            "ticket_url": f"{FRONTEND_ORIGIN}/schedule",
            "description": description,
            "tags": tags,
            "source_id": source_id,
            "place_id": festival_venue_id,
            "festival_id": None,
        })
        logger.debug("Queued film: %s", name)

    return entries


def _crawl_scheduled_events(
    source_id: int, festival_venue_id: int
) -> list[dict]:
    """
    Phase 2: Crawl scheduled screening events with specific times and venues.

    These are the individual ticketed screenings added as the festival approaches.
    Ancillary events outside the festival window are deactivated directly.

    Returns a list of screening entry dicts for later bulk persistence.
    """
    entries: list[dict] = []

    data = _api_get(f"/event_buckets/{BUCKET_ID}/events")
    events = data.get("events", [])
    logger.info("Eventive events API returned %d scheduled events", len(events))

    for event in events:
        name = event.get("name", "").strip()
        if not name or _is_blacklisted_title(name):
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

        image_url = None
        images = event.get("images", [])
        if images and isinstance(images, list):
            image_url = images[0].get("url") if isinstance(images[0], dict) else None

        ancillary_outside_window = _is_ancillary_outside_window(
            films_linked=films_linked,
            start_date=start_date,
        )

        if ancillary_outside_window:
            logger.info(
                "Skipping ancillary ATLFF event outside festival window: %s on %s",
                name,
                start_date,
            )
            continue

        entries.append({
            "title": name,
            "start_date": start_date,
            "start_time": start_time,
            "image_url": image_url,
            "source_url": public_url,
            "ticket_url": public_url,
            "description": description,
            "tags": tags,
            "source_id": source_id,
            "place_id": venue_id,
            "festival_id": None,
        })
        logger.info("Queued screening: %s on %s at %s", name, start_date, start_time)

    return entries


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Film Festival via Eventive API."""
    source_id = source["id"]
    total_new = 0
    total_updated = 0
    all_entries: list[dict] = []

    _VENUE_CACHE.clear()

    try:
        festival_venue_id = get_or_create_place(FESTIVAL_VENUE_DATA)

        # Phase 1: All films (151+ titles, available now)
        film_entries = _crawl_films(source_id, festival_venue_id)
        all_entries.extend(film_entries)
        logger.info("Films phase: %d queued", len(film_entries))

        # Phase 2: Scheduled screenings with specific times
        screening_entries = _crawl_scheduled_events(source_id, festival_venue_id)
        all_entries.extend(screening_entries)
        logger.info("Screenings phase: %d queued", len(screening_entries))

        # Deactivate junk rows (direct DB, not screening-primary path)
        cleaned = _deactivate_blacklisted_events(source_id)
        if cleaned:
            total_updated += cleaned
            logger.info("Junk-row cleanup: %d deactivated", cleaned)

        # --- Screening-primary persistence ---
        total_found = len(all_entries)
        source_slug = source.get("slug", "atlanta-film-festival")

        event_like_rows = entries_to_event_like_rows(all_entries)

        bundle = build_screening_bundle_from_event_rows(
            source_id=source_id, source_slug=source_slug, events=event_like_rows,
        )
        screening_summary = persist_screening_bundle(bundle)
        logger.info(
            "ATLFF screening sync: %s titles, %s runs, %s times",
            screening_summary.get("titles", 0),
            screening_summary.get("runs", 0),
            screening_summary.get("times", 0),
        )

        run_summary = sync_run_events_from_screenings(source_id=source_id, source_slug=source_slug)
        total_new = run_summary.get("events_created", 0)
        total_updated += run_summary.get("events_updated", 0)

        run_event_hashes = run_summary.get("run_event_hashes", set())
        if run_event_hashes:
            remove_stale_showtime_events(source_id=source_id, run_event_hashes=run_event_hashes)

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
