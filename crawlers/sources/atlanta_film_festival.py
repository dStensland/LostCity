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
FESTIVAL_ID = "atlanta-film-festival"

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

# Venue metadata map — keyed by normalized venue name (auditorium suffix stripped).
# Ensures ATLFF crawler attaches to canonical Plaza/Tara/Landmark place rows instead
# of creating per-auditorium duplicates, and stamps the correct neighborhood/coords
# for map/filter surfaces.
_ATLFF_VENUE_METADATA: dict[str, dict] = {
    "Plaza Theatre": {
        "slug": "plaza-theatre",
        "address": "1049 Ponce De Leon Ave NE",
        "zip": "30306",
        "neighborhood": "Poncey-Highland",
        "lat": 33.7734,
        "lng": -84.3530,
        "place_type": "cinema",
        "website": "https://plazaatlanta.com",
    },
    "The Green Room @ The Plaza": {
        "slug": "the-green-room-the-plaza",
        "address": "1049 Ponce De Leon Ave NE",
        "zip": "30306",
        "neighborhood": "Poncey-Highland",
        "lat": 33.7734,
        "lng": -84.3530,
        "place_type": "event_space",
        "website": "https://plazaatlanta.com",
    },
    "Tara Theatre": {
        "slug": "tara-theatre",
        "address": "2345 Cheshire Bridge Rd NE",
        "zip": "30324",
        "neighborhood": "Lindbergh",
        "lat": 33.8190,
        "lng": -84.3505,
        "place_type": "cinema",
        "website": "https://thetaraatlanta.com",
    },
    "Headquarters": {
        "slug": "atlff-headquarters",
        "address": "535 Means St NW",
        "zip": "30318",
        "neighborhood": "Castleberry Hill",
        "lat": 33.7706,
        "lng": -84.4110,
        "place_type": "event_space",
        "website": "https://www.atlantafilmfestival.com",
    },
    "Oakland Cemetery": {
        "slug": "oakland-cemetery",
        "address": "248 Oakland Ave SE",
        "zip": "30312",
        "neighborhood": "Grant Park",
        "lat": 33.7488,
        "lng": -84.3719,
        "place_type": "park",
        "website": "https://oaklandcemetery.com",
    },
    "Hotel Clermont": {
        "slug": "hotel-clermont",
        "address": "789 Ponce De Leon Ave NE",
        "zip": "30306",
        "neighborhood": "Poncey-Highland",
        "lat": 33.7737,
        "lng": -84.3535,
        "place_type": "hotel",
        "website": "https://hotelclermont.com",
    },
    "The Goat Farm": {
        "slug": "the-goat-farm",
        "address": "1200 Foster St NW",
        "zip": "30318",
        "neighborhood": "West Midtown",
        "lat": 33.7806,
        "lng": -84.4158,
        "place_type": "event_space",
        "website": "https://goatfarmarts.com",
    },
    "Assembly Atlanta": {
        "slug": "assembly-atlanta",
        "address": "5601 Peachtree Blvd",
        "zip": "30341",
        "neighborhood": "Doraville",
        "lat": 33.9026,
        "lng": -84.2843,
        "place_type": "event_space",
        "website": "https://assemblystudios.com",
    },
    "Landmark Midtown Art Cinema": {
        "slug": "landmark-midtown-art-cinema",
        "address": "931 Monroe Dr NE",
        "zip": "30308",
        "neighborhood": "Midtown",
        "lat": 33.7803,
        "lng": -84.3688,
        "place_type": "cinema",
        "website": "https://www.landmarktheatres.com/atlanta/midtown-art-cinema",
    },
}

# Regex for stripping " | Auditorium Name" / " - Auditorium Name" suffix from
# Eventive venue names so "Tara Theatre | Jack Auditorium" → "Tara Theatre"
_AUDITORIUM_SUFFIX_RE = re.compile(r"\s*[|\-–]\s*[A-Za-z][A-Za-z0-9\s]*(?:Auditorium|Lobby|Room|Screen)\s*$")

# Known Eventive venue slugs → PLACE_DATA for get_or_create_place
# Populated on first encounter and cached across the crawl run
_VENUE_CACHE: dict[str, tuple[int, Optional[str]]] = {}


def _normalize_atlff_venue_name(raw_name: str) -> tuple[str, Optional[str]]:
    """Split Eventive venue name into (canonical_venue_name, auditorium_label).

    Examples:
      "Tara Theatre | Jack Auditorium" → ("Tara Theatre", "Jack Auditorium")
      "Plaza Theatre | LeFont Auditorium" → ("Plaza Theatre", "LeFont Auditorium")
      "Tara Theatre | Lobby" → ("Tara Theatre", "Lobby")
      "Plaza Theatre" → ("Plaza Theatre", None)
      "Oakland Cemetary" → ("Oakland Cemetery", None)  # typo fix
    """
    name = (raw_name or "").strip()
    # Fix known Eventive typos
    if name == "Oakland Cemetary":
        name = "Oakland Cemetery"

    auditorium: Optional[str] = None
    # Split on " | " or " - " separator; if the right side looks like an
    # auditorium/lobby/room label, treat it as an auditorium suffix.
    for sep in (" | ", " – ", " - "):
        if sep in name:
            left, right = name.split(sep, 1)
            right_clean = right.strip()
            if re.search(r"(?i)(auditorium|lobby|room|screen|stage)$", right_clean):
                auditorium = right_clean
                name = left.strip()
                break

    return name, auditorium
_BLACKLISTED_EVENT_TITLES = {
    "Championing discovery, artistic growth, and the arts locally and internationally.",
}

# Operational wayfinding / ticketing rows that show up in the Eventive events feed
# but aren't discoverable events — they're festival infrastructure. Filtered at crawl
# time; captured as festival-level metadata (practical_info on the festivals row)
# rather than as event rows. Match is case-insensitive on the trimmed title.
_OPERATIONAL_TITLE_PATTERNS = (
    re.compile(r"^\s*headquarters\s+open", re.IGNORECASE),
    re.compile(r"^\s*badge\s+pickup", re.IGNORECASE),
    re.compile(r"^\s*merch\b", re.IGNORECASE),
    re.compile(r"^\s*will\s+call", re.IGNORECASE),
    re.compile(r"^\s*box\s+office", re.IGNORECASE),
)


def _is_operational_title(title: str) -> bool:
    return any(p.match(title or "") for p in _OPERATIONAL_TITLE_PATTERNS)


# ---------------------------------------------------------------------------
# F2c — scannable tag taxonomy for non-film festival events
# ---------------------------------------------------------------------------
# ATLFF's Eventive feed includes ~42 non-film events (parties, filmmaker
# lounges, panels, book signings, afterparties, industry days) alongside 116
# film screenings. Without classification every row gets `category_id='film'`
# from the screening pipeline and renders in cinema surfaces, hiding the
# party/panel/social content from its natural sections and making the
# festival feel like "just a bunch of movies."
#
# Each ATLFF event is classified by inspecting Eventive tag names + title
# patterns. The resulting (category, subcategory, tags) gets stamped on the
# entry dict and propagates through build_screening_bundle_from_event_rows →
# screening_runs.metadata → derive_run_event_from_screening → events row.
#
# Base tags (always added): "atlff", "festival-2026"
# Film tags: "film", "screening" + Eventive tag slugs
# Non-film: category-specific tag set + "social" / "panel" / "talk" markers

_ATLFF_BASE_TAGS = ["atlff", "festival-2026"]

# Title-pattern → (category, subcategory, extra tags). Ordered — first match wins.
_ATLFF_NONFILM_PATTERNS: list[tuple[re.Pattern, str, Optional[str], list[str]]] = [
    # Parties and celebration events
    (re.compile(r"(?i)opening\s+night\s+party"), "nightlife", "party", ["party", "opening-night", "social", "marquee"]),
    (re.compile(r"(?i)closing\s+night\s+party"), "nightlife", "party", ["party", "closing-night", "social", "marquee"]),
    (re.compile(r"(?i)afterparty"), "nightlife", "party", ["party", "afterparty", "social"]),
    (re.compile(r"(?i)\bparty\b"), "nightlife", "party", ["party", "social"]),
    (re.compile(r"(?i)happy\s+hour"), "nightlife", "social", ["happy-hour", "social"]),
    (re.compile(r"(?i)filmmaker\s+lounge"), "nightlife", "social", ["lounge", "social", "industry"]),
    (re.compile(r"(?i)(creative\s+cocktails|networking)"), "nightlife", "social", ["networking", "social", "industry"]),
    (re.compile(r"(?i)hang\s*out"), "nightlife", "social", ["social"]),

    # Industry / conference / educational
    (re.compile(r"(?i)sustainability\s+summit"), "community", "conference", ["summit", "industry", "conference"]),
    (re.compile(r"(?i)(summit|symposium|conference)"), "community", "conference", ["conference", "industry"]),
    (re.compile(r"(?i)(sports,\s+entertainment,\s+arts\s*&\s*tourism|SEAT\b)"), "community", "conference", ["industry-day", "conference", "industry"]),
    (re.compile(r"(?i)(panel|roundtable)"), "community", "panel", ["panel", "industry"]),
    (re.compile(r"(?i)book\s+signing"), "community", "talk", ["book-signing", "author-event", "talk"]),
    (re.compile(r"(?i)in\s+conversation"), "community", "talk", ["in-conversation", "talk"]),
    (re.compile(r"(?i)(q&a|q\s*and\s*a)$"), "community", "talk", ["q-and-a", "talk"]),
    (re.compile(r"(?i)(masterclass|workshop)"), "learning", "workshop", ["workshop", "learning", "industry"]),

    # Art / gallery / immersive
    (re.compile(r"(?i)virtual\s+reality\s+gallery"), "art", "gallery", ["vr", "gallery", "immersive"]),
    (re.compile(r"(?i)illumine"), "art", "installation", ["installation", "immersive", "outdoor"]),
    (re.compile(r"(?i)flash\s+tattoo"), "art", "installation", ["installation", "community", "pre-festival"]),

    # Launch / promo
    (re.compile(r"(?i)launch\s+party"), "nightlife", "party", ["party", "launch", "social", "pre-festival"]),
]

# Eventive tag → extra LostCity tag slugs (added to every event regardless of classification).
_EVENTIVE_TAG_MAP = {
    "narrative feature": "narrative-feature",
    "documentary feature": "documentary",
    "shorts block": "shorts",
    "narrative short": "shorts",
    "legacy screening": "legacy-screening",
    "special presentation": "special-presentation",
    "marquee": "marquee",
    "talent in attendance": ["talent-in-attendance", "q-and-a"],
    "creative conference": ["conference", "industry"],
    "producing": ["producing", "industry"],
    "directing": ["directing", "industry"],
    "storytelling": ["storytelling", "industry"],
    "screenwriting": ["screenwriting", "industry"],
    "acting": ["acting", "industry"],
    "budgeting": ["budgeting", "industry"],
    "financing": ["financing", "industry"],
    "socials": ["social"],
}


def _classify_atlff_event(
    name: str,
    eventive_tags: list,
    has_films_linked: bool,
) -> tuple[str, Optional[str], list[str]]:
    """Classify an Eventive event → (category_id, subcategory, tags).

    Films (has_films_linked=True) always return film/cinema regardless of
    name — even if the title contains "Q&A with Director", it's still a film
    screening.

    Non-film events are classified via _ATLFF_NONFILM_PATTERNS. Fallback is
    community/talk for generic non-film rows that don't match any pattern.
    """
    tags = list(_ATLFF_BASE_TAGS)

    # Pull slugs from Eventive-provided tag names (regardless of category)
    eventive_slugs: list[str] = []
    for tag in eventive_tags or []:
        tag_name = (tag.get("name") or "").strip().lower() if isinstance(tag, dict) else str(tag).strip().lower()
        if not tag_name:
            continue
        extra = _EVENTIVE_TAG_MAP.get(tag_name)
        if extra:
            if isinstance(extra, list):
                eventive_slugs.extend(extra)
            else:
                eventive_slugs.append(extra)

    if has_films_linked:
        # Film screening: retain film taxonomy, fold in Eventive signals
        tags.extend(["film", "screening"])
        tags.extend(eventive_slugs)
        return "film", "cinema", list(dict.fromkeys(tags))

    # Non-film: try patterns in order
    for pattern, category, subcategory, extras in _ATLFF_NONFILM_PATTERNS:
        if pattern.search(name or ""):
            tags.extend(extras)
            tags.extend(eventive_slugs)
            return category, subcategory, list(dict.fromkeys(tags))

    # Fallback: unknown non-film event — community/talk is the widest safe bucket
    tags.extend(["talk", "industry"])
    tags.extend(eventive_slugs)
    return "community", "talk", list(dict.fromkeys(tags))


# How far outside the announced festival window we allow ancillary (non-film) events.
# Pre-festival hype events (Launch Party, FLASH Tattoo Day, SEAT industry day) live
# up to 45 days before FESTIVAL_START. Post-festival wrap events can trail by 14 days.
# This is wide enough to keep legitimate marketing-launch content while still
# rejecting spurious Eventive rows that fall well outside the festival's orbit.
_ANCILLARY_LEAD_DAYS = 45
_ANCILLARY_TRAIL_DAYS = 14


def _is_ancillary_outside_window(
    *,
    films_linked: list,
    start_date: Optional[str],
) -> bool:
    """Treat non-film Eventive specials far outside the festival window as ancillary.

    Non-film events (parties, panels, industry days, socials) can appear in the
    Eventive feed before the festival proper starts — these are valuable marketing
    hype content and should be kept. Only reject events that fall outside a
    generous window around the festival dates.
    """
    if films_linked:
        return False
    if not start_date:
        return False
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        fest_start = datetime.strptime(FESTIVAL_START, "%Y-%m-%d").date()
        fest_end = datetime.strptime(FESTIVAL_END, "%Y-%m-%d").date()
    except ValueError:
        return False
    from datetime import timedelta
    earliest = fest_start - timedelta(days=_ANCILLARY_LEAD_DAYS)
    latest = fest_end + timedelta(days=_ANCILLARY_TRAIL_DAYS)
    return start < earliest or start > latest


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


def _get_or_cache_venue(eventive_venue: dict) -> tuple[int, Optional[str]]:
    """Resolve an Eventive venue dict to (LostCity venue_id, auditorium_label).

    Rolls up auditorium suffixes ("Tara Theatre | Jack Auditorium" → "Tara Theatre")
    and maps known ATLFF venues to canonical slugs + metadata so we attach to
    existing Plaza/Tara/Landmark place rows instead of creating duplicates.
    The auditorium label is returned separately so callers can thread it into
    screen_name metadata on the event/screening-run.
    """
    raw_name = eventive_venue.get("name", "Atlanta Film Festival")
    canonical_name, auditorium = _normalize_atlff_venue_name(raw_name)

    # Cache by canonical_name so all auditoriums of the same theater share a row,
    # but keep the auditorium label per-call so it can still vary per screening.
    cache_key = canonical_name
    if cache_key in _VENUE_CACHE:
        venue_id, _ = _VENUE_CACHE[cache_key]
        return venue_id, auditorium

    meta = _ATLFF_VENUE_METADATA.get(canonical_name)

    if meta:
        place_data = {
            "name": canonical_name,
            "slug": meta["slug"],
            "address": meta["address"],
            "neighborhood": meta["neighborhood"],
            "city": "Atlanta",
            "state": "GA",
            "zip": meta["zip"],
            "lat": meta["lat"],
            "lng": meta["lng"],
            "place_type": meta["place_type"],
            "website": meta["website"],
            "is_active": True,
        }
    else:
        # Fallback path: parse from Eventive address, don't assume Midtown
        address = eventive_venue.get("address", "")
        city, state, zip_code = "Atlanta", "GA", ""
        addr_match = re.search(r",\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?", address)
        if addr_match:
            city = addr_match.group(1).strip()
            state = addr_match.group(2)
            zip_code = addr_match.group(3) or ""
        slug_base = re.sub(r"[^a-z0-9]+", "-", canonical_name.lower()).strip("-")
        place_data = {
            "name": canonical_name,
            "slug": slug_base,
            "address": address.split(",")[0].strip() if "," in address else address,
            "neighborhood": None,
            "city": city,
            "state": state,
            "zip": zip_code,
            "place_type": "event_space",
            "website": "https://www.atlantafilmfestival.com",
            "is_active": True,
        }
        logger.info(
            "ATLFF venue not in metadata map, using fallback: %s", canonical_name
        )

    venue_id = get_or_create_place(place_data)
    _VENUE_CACHE[cache_key] = (venue_id, auditorium)
    return venue_id, auditorium


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


def _enrich_festival_row() -> None:
    """Idempotently fill missing fields on the ATLFF festivals row.

    The row is seeded via migration. This keeps marketing-surface fields
    (location, ticket_url, categories) populated so downstream API routes
    and the festival detail page don't render with null metadata. Safe to
    run on every crawl — only overwrites fields the crawler is authoritative
    for, and preserves any fields already filled by other sources.
    """
    if not writes_enabled():
        return
    client = get_client()
    try:
        client.table("festivals").update({
            "location": "Multiple venues, Atlanta",
            "ticket_url": f"{FRONTEND_ORIGIN}/schedule",
            "categories": ["film", "festival"],
        }).eq("id", FESTIVAL_ID).execute()
        logger.info("Enriched festivals row %s", FESTIVAL_ID)
    except Exception as exc:
        logger.warning("Failed to enrich festivals row: %s", exc)


def _fix_nonfilm_event_categories(source_id: int) -> int:
    """Post-sync correction: override category_id for non-film ATLFF events.

    smart_update_existing_event intentionally refuses to overwrite an existing
    category_id='film' with a different value (its guard only allows rewrites
    from community/other). ATLFF's screening-primary pipeline initially stamps
    every event as film, so without this fix-up parties, panels, talks, and
    happy hours stay misclassified as films.

    This runs every crawl, matches by title against _ATLFF_NONFILM_PATTERNS,
    and updates category_id + subcategory in place. Tags are merged additively
    (existing + classified) to preserve any manual curation.
    """
    if not writes_enabled():
        return 0
    client = get_client()
    try:
        rows = (
            client.table("events")
            .select("id,title,category_id,tags")
            .eq("source_id", source_id)
            .eq("is_active", True)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        logger.warning("Failed to fetch ATLFF events for category fix-up: %s", exc)
        return 0

    updated = 0
    for row in rows:
        title = row.get("title") or ""
        # Classify via title pattern only (no Eventive tags available here).
        # Subcategory is not persisted on events rows (no column), but the
        # scannable tags carry the same signal.
        category, _subcategory, extra_tags = _classify_atlff_event(
            name=title,
            eventive_tags=[],
            has_films_linked=False,
        )
        # If the classifier fell through to the community/talk default AND
        # existing category is film, assume the title is actually a film —
        # don't clobber. Only update when we got a clear non-film pattern match.
        matched_nonfilm_pattern = any(
            p.search(title) for p, *_ in _ATLFF_NONFILM_PATTERNS
        )
        if not matched_nonfilm_pattern:
            continue

        existing_category = row.get("category_id")
        existing_tags = set(row.get("tags") or [])
        new_tags = existing_tags | set(extra_tags)

        update_payload = {}
        if existing_category != category:
            update_payload["category_id"] = category
        if new_tags != existing_tags:
            update_payload["tags"] = sorted(new_tags)

        if not update_payload:
            continue

        try:
            client.table("events").update(update_payload).eq("id", row["id"]).execute()
            logger.info(
                "Corrected ATLFF classification: id=%s %s → %s/%s",
                row["id"],
                title[:50],
                category,
                subcategory,
            )
            updated += 1
        except Exception as exc:
            logger.warning(
                "Failed to correct category for event %s: %s", row["id"], exc
            )
    return updated


def _deactivate_operational_events(source_id: int) -> int:
    """Retire pre-existing operational wayfinding rows from the events table.

    Rows matching _OPERATIONAL_TITLE_PATTERNS were created by earlier crawler
    runs before the filter was added. These aren't discoverable events —
    "Headquarters Open!", "Badge Pickup", etc. — and should live as festival
    metadata instead. Deactivate (don't delete) to preserve RSVP/saved data.
    """
    if not writes_enabled():
        return 0
    client = get_client()
    rows = (
        client.table("events")
        .select("id,title,is_active")
        .eq("source_id", source_id)
        .eq("is_active", True)
        .execute()
        .data
        or []
    )
    deactivated = 0
    for row in rows:
        if not _is_operational_title(row.get("title") or ""):
            continue
        try:
            client.table("events").update({"is_active": False}).eq(
                "id", row["id"]
            ).execute()
            logger.info(
                "Deactivated operational ATLFF row %s: %s", row["id"], row["title"]
            )
            deactivated += 1
        except Exception as exc:
            logger.warning(
                "Failed to deactivate operational row %s: %s", row["id"], exc
            )
    return deactivated


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
        # Phase 1 rows are always films — use the classifier's film branch to
        # pick up scannable Eventive tag slugs (narrative-feature, documentary,
        # legacy-screening, marquee, etc.) on top of the film defaults.
        event_category, event_subcategory, tags = _classify_atlff_event(
            name=name,
            eventive_tags=film.get("tags", []),
            has_films_linked=True,
        )

        entries.append({
            "title": name,
            "start_date": FESTIVAL_START,
            "start_time": None,
            "image_url": image_url,
            "source_url": public_url,
            "ticket_url": f"{FRONTEND_ORIGIN}/schedule",
            "description": description,
            "tags": tags,
            "category_id": event_category,
            "subcategory": event_subcategory,
            "source_id": source_id,
            "place_id": festival_venue_id,
            "festival_id": FESTIVAL_ID,
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

        if _is_operational_title(name):
            logger.debug("Skipping operational wayfinding row: %s", name)
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

        # Resolve venue (rolls up auditoriums; returns the auditorium label separately)
        eventive_venue = event.get("venue")
        auditorium_label: Optional[str] = None
        if eventive_venue and isinstance(eventive_venue, dict):
            venue_id, auditorium_label = _get_or_cache_venue(eventive_venue)
        else:
            venue_id = festival_venue_id

        # Build description
        desc_raw = event.get("description") or event.get("short_description") or ""
        description = _strip_html(desc_raw) or f"Atlanta Film Festival 2026 — {name}"

        # F2c: classify the event and generate the scannable tag set.
        # Films → category="film" with film/screening tags + Eventive signals.
        # Non-film (parties, panels, talks) → category="nightlife"/"community"/
        # "art"/"learning" with scannable tags for the festival detail page filter.
        films_linked = event.get("films", [])
        event_category, event_subcategory, tags = _classify_atlff_event(
            name=name,
            eventive_tags=event.get("tags", []),
            has_films_linked=bool(films_linked),
        )

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
            "category_id": event_category,
            "subcategory": event_subcategory,
            "source_id": source_id,
            "place_id": venue_id,
            "festival_id": FESTIVAL_ID,
            "screen_name": auditorium_label,
        })
        logger.info(
            "Queued screening: %s on %s at %s (%s)",
            name, start_date, start_time, auditorium_label or "main",
        )

    return entries


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Film Festival via Eventive API."""
    source_id = source["id"]
    total_new = 0
    total_updated = 0
    all_entries: list[dict] = []

    _VENUE_CACHE.clear()

    try:
        _enrich_festival_row()
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

        # Deactivate operational wayfinding rows captured by earlier crawler runs
        op_cleaned = _deactivate_operational_events(source_id)
        if op_cleaned:
            total_updated += op_cleaned
            logger.info("Operational-row cleanup: %d deactivated", op_cleaned)

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

        # F2c fix-up: override category_id on non-film events that the
        # screening pipeline stamped as "film" by default.
        corrected = _fix_nonfilm_event_categories(source_id)
        if corrected:
            total_updated += corrected
            logger.info("Non-film category fix-up: %d corrected", corrected)

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
