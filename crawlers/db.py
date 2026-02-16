"""
Database operations for Lost City crawlers.
Handles all Supabase interactions for events, venues, sources, and logs.
"""

import re
import html
import time
import logging
import functools
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Optional, Tuple
from supabase import create_client, Client
from config import get_config
from tags import VALID_CATEGORIES, VALID_VENUE_TYPES, VALID_VIBES
from tag_inference import infer_tags, infer_is_class, infer_is_support_group, infer_genres
from genre_normalize import normalize_genres
from description_fetcher import generate_synthetic_description
from series import get_or_create_series, update_series_metadata
from posters import get_metadata_for_film_event
from artist_images import get_info_for_music_event
from date_utils import MAX_FUTURE_DAYS_DEFAULT
from show_signals import derive_show_signals

logger = logging.getLogger(__name__)


# ===== TITLE CASE HELPER =====
# Python's .title() breaks on apostrophes: "JOHN'S" -> "John'S" (wrong)
# This function handles possessives/contractions correctly.
_SMALL_WORDS = {"a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "in", "of", "by", "is", "vs"}

def smart_title_case(text: str) -> str:
    """Title-case that correctly handles apostrophes and small words."""
    # Normalize smart/curly apostrophes to ASCII before processing
    text = text.replace("\u2019", "'").replace("\u2018", "'")
    words = text.lower().split()
    result = []
    for i, word in enumerate(words):
        if "'" in word:
            # Handle contractions: "valentine's" -> "Valentine's", "don't" -> "Don't"
            parts = word.split("'")
            parts[0] = parts[0].capitalize()
            # Keep everything after apostrophe lowercase
            result.append("'".join(parts))
        elif i == 0 or word not in _SMALL_WORDS:
            result.append(word.capitalize())
        else:
            result.append(word)
    return " ".join(result)


# ===== VALIDATION STATISTICS TRACKING =====
class ValidationStats:
    """Track validation statistics during a crawl run."""

    def __init__(self):
        self.total_validated = 0
        self.passed = 0
        self.rejected = 0
        self.warnings = 0
        self.rejection_reasons = {}
        self.warning_types = {}

    def record_rejection(self, reason: str):
        self.rejected += 1
        self.rejection_reasons[reason] = self.rejection_reasons.get(reason, 0) + 1

    def record_warning(self, warning_type: str):
        self.warnings += 1
        self.warning_types[warning_type] = self.warning_types.get(warning_type, 0) + 1

    def record_pass(self):
        self.passed += 1

    def get_summary(self) -> str:
        """Get a human-readable summary of validation stats."""
        lines = [
            f"Validation: {self.passed} passed, {self.rejected} rejected, {self.warnings} warnings"
        ]
        if self.rejection_reasons:
            lines.append("Rejections:")
            for reason, count in sorted(
                self.rejection_reasons.items(), key=lambda x: -x[1]
            ):
                lines.append(f"  - {reason}: {count}")
        if self.warning_types:
            lines.append("Warnings:")
            for wtype, count in sorted(self.warning_types.items(), key=lambda x: -x[1]):
                lines.append(f"  - {wtype}: {count}")
        return "\n".join(lines)


# Thread-local validation stats — each worker thread gets its own instance
# Prevents corruption when crawlers run in parallel via ThreadPoolExecutor
_thread_local = threading.local()


def reset_validation_stats():
    """Reset validation statistics for a new crawl run (per-thread)."""
    _thread_local.validation_stats = ValidationStats()


def get_validation_stats() -> ValidationStats:
    """Get current validation statistics (per-thread)."""
    if not hasattr(_thread_local, "validation_stats"):
        _thread_local.validation_stats = ValidationStats()
    return _thread_local.validation_stats


# Module-level alias used throughout validate_event()
# This property accessor ensures thread-safe access
@property  # type: ignore
def _validation_stats_property(self):
    return get_validation_stats()


# Keep _validation_stats as a module-level name that delegates to thread-local
class _ValidationStatsProxy:
    """Proxy that delegates attribute access to the thread-local ValidationStats."""

    def __getattr__(self, name):
        return getattr(get_validation_stats(), name)


_validation_stats = _ValidationStatsProxy()

_client: Optional[Client] = None
_SOURCE_CACHE: dict[int, dict] = {}
_VENUE_CACHE: dict[int, dict] = {}
_BLURHASH_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="blurhash")
_EVENTS_HAS_SHOW_SIGNAL_COLUMNS: Optional[bool] = None


def retry_on_network_error(max_retries: int = 3, base_delay: float = 0.5):
    """Decorator to retry database operations on transient network errors.

    Handles:
    - [Errno 35] Resource temporarily unavailable (macOS)
    - [Errno 11] Resource temporarily unavailable (Linux)
    - Connection reset errors
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except OSError as e:
                    # Errno 35 (macOS) or 11 (Linux) = Resource temporarily unavailable
                    if e.errno in (35, 11) or "Resource temporarily unavailable" in str(
                        e
                    ):
                        last_error = e
                        delay = base_delay * (2**attempt)  # Exponential backoff
                        logger.debug(
                            f"Network error in {func.__name__}, retrying in {delay}s (attempt {attempt + 1}/{max_retries})"
                        )
                        time.sleep(delay)
                    else:
                        raise
                except Exception as e:
                    error_str = str(e)
                    if (
                        "Resource temporarily unavailable" in error_str
                        or "Connection reset" in error_str
                    ):
                        last_error = e
                        delay = base_delay * (2**attempt)
                        logger.debug(
                            f"Network error in {func.__name__}, retrying in {delay}s (attempt {attempt + 1}/{max_retries})"
                        )
                        time.sleep(delay)
                    else:
                        raise
            # All retries exhausted
            raise last_error

        return wrapper

    return decorator


# Virtual venue for online events
VIRTUAL_VENUE_SLUG = "online-virtual"
VIRTUAL_VENUE_DATA = {
    "name": "Online / Virtual Event",
    "slug": VIRTUAL_VENUE_SLUG,
    "city": "Atlanta",
    "state": "GA",
    "venue_type": "virtual",
}


def get_or_create_virtual_venue() -> int:
    """Get or create canonical virtual venue. Returns venue ID."""
    client = get_client()
    result = (
        client.table("venues").select("id").eq("slug", VIRTUAL_VENUE_SLUG).execute()
    )
    if result.data:
        return result.data[0]["id"]
    result = client.table("venues").insert(VIRTUAL_VENUE_DATA).execute()
    return result.data[0]["id"]


def get_client() -> Client:
    """Get or create Supabase client."""
    global _client
    if _client is None:
        cfg = get_config()
        _client = create_client(
            cfg.database.supabase_url, cfg.database.supabase_service_key
        )
    return _client


def events_support_show_signal_columns() -> bool:
    """
    Detect whether first-class show metadata columns exist on events.

    Keeps crawler writes backward compatible before SQL migration is applied.
    """
    global _EVENTS_HAS_SHOW_SIGNAL_COLUMNS
    if _EVENTS_HAS_SHOW_SIGNAL_COLUMNS is not None:
        return _EVENTS_HAS_SHOW_SIGNAL_COLUMNS

    client = get_client()
    try:
        (
            client.table("events")
            .select("doors_time,age_policy,ticket_status,reentry_policy,set_times_mentioned")
            .limit(1)
            .execute()
        )
        _EVENTS_HAS_SHOW_SIGNAL_COLUMNS = True
    except Exception as e:
        error_str = str(e).lower()
        if "does not exist" in error_str and (
            "doors_time" in error_str
            or "age_policy" in error_str
            or "ticket_status" in error_str
            or "reentry_policy" in error_str
            or "set_times_mentioned" in error_str
        ):
            _EVENTS_HAS_SHOW_SIGNAL_COLUMNS = False
            logger.warning(
                "events table missing show signal columns; run migration 20260216110000_event_show_signal_columns.sql"
            )
        else:
            raise

    return bool(_EVENTS_HAS_SHOW_SIGNAL_COLUMNS)


def get_source_info(source_id: int) -> Optional[dict]:
    """Fetch source info with caching."""
    if source_id in _SOURCE_CACHE:
        return _SOURCE_CACHE[source_id]

    client = get_client()
    try:
        result = (
            client.table("sources")
            .select("id, slug, name, url, owner_portal_id, producer_id, is_sensitive")
            .eq("id", source_id)
            .execute()
        )
    except Exception:
        try:
            # Backward-compatible fallback for environments where producer_id isn't present.
            result = (
                client.table("sources")
                .select("id, slug, name, url, owner_portal_id, is_sensitive")
                .eq("id", source_id)
                .execute()
            )
        except Exception:
            # Backward-compatible fallback for environments where is_sensitive isn't present.
            result = (
                client.table("sources")
                .select("id, slug, name, url, owner_portal_id")
                .eq("id", source_id)
                .execute()
            )
    if result.data:
        _SOURCE_CACHE[source_id] = result.data[0]
        return result.data[0]
    return None


def get_source_by_slug(slug: str) -> Optional[dict]:
    """Fetch a source by its slug."""
    client = get_client()
    result = client.table("sources").select("*").eq("slug", slug).single().execute()
    return result.data


def get_portal_id_by_slug(slug: str) -> Optional[str]:
    """Fetch a portal's UUID by its slug."""
    client = get_client()
    result = client.table("portals").select("id").eq("slug", slug).single().execute()
    if result.data:
        return result.data["id"]
    return None


def get_active_sources() -> list[dict]:
    """Fetch all active sources."""
    client = get_client()
    result = client.table("sources").select("*").eq("is_active", True).execute()
    return result.data or []


# Hardcoded source slug to producer_id mapping used as fallback when
# sources.producer_id is not populated.
_SOURCE_PRODUCER_MAP = {
    "atlanta-film-society": "atlanta-film-society",
    "out-on-film": "out-on-film",
    "ajff": "atlanta-jewish-film",
    "atlanta-opera": "atlanta-opera",
    "atlanta-ballet": "atlanta-ballet",
    "atlanta-pride": "atlanta-pride",
    "beltline": "atlanta-beltline-inc",
    "atlanta-contemporary": "atlanta-contemporary",
    "callanwolde": "callanwolde",
    "atlanta-track-club": "atlanta-track-club",
    "arts-atl": "artsatl",
    "atlanta-cultural-affairs": "atlanta-cultural-affairs",
    "community-foundation-atl": "community-foundation-atl",
    "high-museum": "woodruff-arts",
    "decatur-arts-festival": "decatur-arts",
    "taste-of-atlanta": "taste-of-atlanta",
}

# Festival/conference source overrides for rollup + festival linking
_FESTIVAL_SOURCE_OVERRIDES = {
    "dragon-con": {"festival_type": "convention"},
    "momocon": {"festival_type": "convention"},
    "fancons": {"festival_type": "convention"},
    "anime-weekend-atlanta": {"festival_type": "convention"},
    "dreamhack-atlanta": {"festival_type": "convention"},
    "blade-show": {"festival_type": "convention"},
    "furry-weekend-atlanta": {"festival_type": "convention"},
    "southern-fried-gaming-expo": {"festival_type": "convention"},
    "atlanta-tech-week": {"festival_type": "conference"},
    "render-atl": {"festival_type": "conference"},
    "piedmont-heart-conferences": {"festival_type": "conference"},
    # Name→slug mismatches: source name doesn't slugify to source slug
    # The festival_name here must match the festival record's name exactly
    "shaky-knees": {"festival_name": "Shaky Knees"},
    "juneteenth-atlanta": {"festival_name": "Juneteenth Atlanta"},
    "a3c-festival": {
        "festival_name": "A3C Festival & Conference",
        "festival_type": "conference",
    },
    "ajff": {"festival_name": "Atlanta Jewish Film Festival"},
    "atlanta-dogwood": {"festival_name": "Atlanta Dogwood Festival"},
    "atlanta-food-wine": {"festival_name": "Atlanta Food & Wine Festival"},
    "buried-alive": {"festival_name": "Buried Alive Film Festival"},
    "candler-park-fest": {"festival_name": "Candler Park Fall Fest"},
    "ga-renaissance-festival": {"festival_name": "Georgia Renaissance Festival"},
    "grant-park-festival": {"festival_name": "Grant Park Summer Shade Festival"},
    "music-midtown": {"festival_name": "Music Midtown"},
}

_FESTIVAL_SOURCE_SLUGS = {
    "atlanta-film-festival",
    "atlanta-jazz-festival",
    "decatur-arts-festival",
    "decatur-book-festival",
    "grant-park-festival",
    "inman-park-festival",
    "shaky-knees",
    "atlanta-dogwood",
    "atlanta-food-wine",
    "sweet-auburn-springfest",
    "candler-park-fest",
    "east-atlanta-strut",
    "peachtree-road-race",
    "atlanta-pride",
    "atlanta-black-pride",
    "out-on-film",
    "ajff",
    "buried-alive",
    # Tier 1 festivals
    "dragon-con",
    "momocon",
    "music-midtown",
    "one-musicfest",
    "southern-fried-queer-pride",
    "dreamhack-atlanta",
    # Tier 2 festivals
    "ga-renaissance-festival",
    "imagine-music-festival",
    "a3c-festival",
    "afropunk-atlanta",
    "japanfest-atlanta",
    "atlanta-greek-festival",
    "juneteenth-atlanta",
    "stone-mountain-highland-games",
    "atlanta-tattoo-arts-festival",
    "blade-show",
    "furry-weekend-atlanta",
    "southern-fried-gaming-expo",
    "anime-weekend-atlanta",
}

_FESTIVAL_NAME_PATTERN = re.compile(
    r"\b(festival|fest|conference|convention|summit|symposium|expo|week)\b",
    re.IGNORECASE,
)

_FESTIVAL_CONFERENCE_PATTERN = re.compile(
    r"\b(conference|summit|symposium|forum|congress)\b",
    re.IGNORECASE,
)

_FESTIVAL_CONVENTION_PATTERN = re.compile(
    r"\b(convention|expo|con)\b",
    re.IGNORECASE,
)

_PROGRAM_TITLE_KEYWORDS = {
    "track",
    "program",
    "stage",
    "room",
    "hall",
    "session",
    "panel",
    "workshop",
    "keynote",
    "talk",
    "lecture",
    "summit",
    "forum",
    "expo",
    "screening",
    "showcase",
}


def infer_festival_type_from_name(name: Optional[str]) -> Optional[str]:
    """Infer festival type (conference vs convention) from name."""
    if not name:
        return None
    if _FESTIVAL_CONFERENCE_PATTERN.search(name):
        return "conference"
    if _FESTIVAL_CONVENTION_PATTERN.search(name):
        return "convention"
    return None


def get_festival_source_hint(
    source_slug: Optional[str], source_name: Optional[str]
) -> Optional[dict]:
    """Return festival metadata hint if the source looks like a festival/conference."""
    slug = source_slug or ""
    if slug in _FESTIVAL_SOURCE_OVERRIDES or slug in _FESTIVAL_SOURCE_SLUGS:
        override = _FESTIVAL_SOURCE_OVERRIDES.get(slug, {})
        name = override.get("festival_name") or source_name
        return {
            "festival_name": name,
            "festival_type": override.get("festival_type")
            or infer_festival_type_from_name(name),
        }

    if source_name and _FESTIVAL_NAME_PATTERN.search(source_name):
        return {
            "festival_name": source_name,
            "festival_type": infer_festival_type_from_name(source_name),
        }

    return None


def infer_program_title(title: Optional[str]) -> Optional[str]:
    """Infer a program/track title from an event title."""
    if not title:
        return None
    separators = [" - ", ": ", " | "]
    for sep in separators:
        if sep not in title:
            continue
        left, right = title.split(sep, 1)
        left = left.strip()
        right = right.strip()
        if not left or not right:
            continue
        if len(left) < 4 or len(left) > 60:
            continue
        if any(keyword in left.lower() for keyword in _PROGRAM_TITLE_KEYWORDS):
            return left
    return None


def get_producer_id_for_source(source_id: int) -> Optional[str]:
    """Get the producer_id associated with a source, if any."""
    source_info = get_source_info(source_id)
    if source_info:
        producer_id = source_info.get("producer_id")
        if producer_id:
            return producer_id

    # Fallback to legacy slug mapping.
    try:
        if source_info and source_info.get("slug"):
            return _SOURCE_PRODUCER_MAP.get(source_info["slug"])

        client = get_client()
        result = client.table("sources").select("slug").eq("id", source_id).execute()
        if result.data:
            slug = result.data[0].get("slug")
            if slug:
                return _SOURCE_PRODUCER_MAP.get(slug)
    except Exception:
        pass

    return None


def _compute_and_save_event_blurhash(event_id: int, image_url: str) -> None:
    """Best-effort async blurhash generation for newly inserted events."""
    try:
        from backfill_blurhash import (
            compute_blurhash,
        )  # local import to keep crawler startup fast

        blurhash = compute_blurhash(image_url)
        if not blurhash:
            return

        client = get_client()
        client.table("events").update({"blurhash": blurhash}).eq(
            "id", event_id
        ).execute()
        logger.debug(f"Stored blurhash for event {event_id}")
    except Exception as e:
        logger.debug(f"Blurhash generation skipped for event {event_id}: {e}")


def _queue_event_blurhash(event_id: int, image_url: Optional[str]) -> None:
    """Queue background blurhash generation without blocking crawler writes."""
    if not image_url:
        return
    _BLURHASH_EXECUTOR.submit(_compute_and_save_event_blurhash, event_id, image_url)


def _fetch_venue_description(url: str) -> Optional[str]:
    """Quick meta description extraction for new venues. Non-blocking, short timeout."""
    try:
        import requests
        from bs4 import BeautifulSoup

        resp = requests.get(
            url,
            timeout=5,
            allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"},
        )
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        for attr_key, attr_val in [
            ("name", "description"),
            ("property", "og:description"),
            ("name", "twitter:description"),
        ]:
            meta = soup.find("meta", attrs={attr_key: attr_val})
            if meta and meta.get("content", "").strip():
                desc = meta["content"].strip()
                if len(desc) >= 30:
                    lower = desc.lower()
                    if any(
                        lower.startswith(p)
                        for p in [
                            "welcome to",
                            "just another",
                            "coming soon",
                            "page not found",
                        ]
                    ):
                        continue
                    return desc[:500]
    except Exception:
        pass
    return None


@retry_on_network_error(max_retries=3, base_delay=0.5)
def get_or_create_venue(venue_data: dict) -> int:
    """Get existing venue or create new one. Returns venue ID."""
    client = get_client()

    # Try to find by slug first
    slug = venue_data.get("slug")
    if slug:
        result = client.table("venues").select("id").eq("slug", slug).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]["id"]

    # Try to find by name (exact match)
    name = venue_data.get("name")
    if name:
        result = client.table("venues").select("id").eq("name", name).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]["id"]

    # Proximity dedup: if a venue with a similar name exists within 100m, reuse it
    lat = venue_data.get("lat")
    lng = venue_data.get("lng")
    if name and lat and lng:
        # ~100m box
        lat_delta = 0.001
        lng_delta = 0.001
        try:
            nearby = (
                client.table("venues")
                .select("id, name")
                .gte("lat", lat - lat_delta)
                .lte("lat", lat + lat_delta)
                .gte("lng", lng - lng_delta)
                .lte("lng", lng + lng_delta)
                .execute()
            )
            if nearby.data:
                name_lower = name.lower().strip()
                for row in nearby.data:
                    existing_name = (row.get("name") or "").lower().strip()
                    # Check if names share substantial overlap (>60% of shorter name)
                    shorter = min(len(name_lower), len(existing_name))
                    if shorter < 3:
                        continue
                    # Simple substring check: one contains the other, or starts the same
                    if (name_lower in existing_name or existing_name in name_lower
                            or name_lower[:shorter] == existing_name[:shorter]):
                        logger.info(
                            f"Proximity dedup: reusing '{row['name']}' (id={row['id']}) for '{name}'"
                        )
                        return row["id"]
        except Exception as e:
            logger.debug(f"Proximity dedup check failed: {e}")

    # Auto-fetch description for new venues with websites
    if venue_data.get("website") and not venue_data.get("description"):
        try:
            desc = _fetch_venue_description(venue_data["website"])
            if desc:
                venue_data["description"] = desc
                logger.debug(
                    "Auto-fetched description for %s", venue_data.get("name", "unknown")
                )
        except Exception:
            pass  # Never block venue creation on description fetch

    # Auto-extract parking info for new venues with websites
    if venue_data.get("website") and not venue_data.get("parking_note"):
        try:
            from parking_extract import extract_parking_info

            parking = extract_parking_info(venue_data["website"])
            if parking:
                venue_data["parking_note"] = parking["parking_note"]
                venue_data["parking_type"] = parking["parking_type"]
                venue_data["parking_free"] = parking["parking_free"]
                venue_data["parking_source"] = "scraped"
                if parking.get("transit_note"):
                    venue_data["transit_note"] = parking["transit_note"]
                logger.debug(
                    "Auto-extracted parking for %s", venue_data.get("name", "unknown")
                )
        except Exception:
            pass  # Never block venue creation on parking fetch

    # Validate venue_type (warn, don't reject)
    vtype = venue_data.get("venue_type")
    if vtype and vtype not in VALID_VENUE_TYPES:
        logger.warning(
            f"Unknown venue_type '{vtype}' for '{venue_data.get('name', '?')}'"
        )

    # Filter invalid vibes
    if venue_data.get("vibes"):
        valid = [v for v in venue_data["vibes"] if v in VALID_VIBES]
        removed = set(venue_data["vibes"]) - set(valid)
        if removed:
            logger.warning(
                f"Removed invalid vibes {removed} from '{venue_data.get('name', '?')}'"
            )
        venue_data["vibes"] = valid or None

    # Create new venue
    result = client.table("venues").insert(venue_data).execute()
    return result.data[0]["id"]


@retry_on_network_error(max_retries=3, base_delay=0.5)
def get_venue_by_id(venue_id: int) -> Optional[dict]:
    """Fetch a venue by its ID."""
    client = get_client()
    result = client.table("venues").select("*").eq("id", venue_id).execute()
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


def get_venue_by_id_cached(venue_id: int) -> Optional[dict]:
    """Fetch a venue by its ID with per-crawl-run caching."""
    if venue_id in _VENUE_CACHE:
        return _VENUE_CACHE[venue_id]

    venue = get_venue_by_id(venue_id)
    if venue:
        _VENUE_CACHE[venue_id] = venue
    return venue


def clear_venue_cache() -> None:
    """Clear the venue cache. Call this at the start of each crawl run."""
    _VENUE_CACHE.clear()


def get_venue_by_slug(slug: str) -> Optional[dict]:
    """Fetch a venue by its slug."""
    client = get_client()
    result = client.table("venues").select("*").eq("slug", slug).execute()
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


# ===== DATA VALIDATION FUNCTIONS =====


def sanitize_text(text: str) -> str:
    """
    Sanitize text field by:
    - Stripping whitespace
    - Removing HTML tags (robust: handles malformed tags)
    - Decoding HTML entities (&#8211; → –, &amp; → &, etc.)
    - Normalizing whitespace (collapse multiple spaces/newlines)

    Note: We decode rather than escape HTML entities because this data is
    stored as plain text and rendered by React (which auto-escapes on output).
    The old html.escape() call was double-encoding entities from crawlers.
    """
    if not text:
        return text

    # Strip leading/trailing whitespace
    text = text.strip()

    # Remove HTML tags — use two passes to catch malformed/nested tags
    # First pass: standard well-formed tags
    text = re.sub(r"<[^>]*>", "", text)
    # Second pass: catch unclosed tags like <img src=x onerror=alert(1)
    text = re.sub(r"<[^>]*$", "", text)

    # Decode HTML entities to plain text (&#8211; → –, &amp; → &, etc.)
    # Run twice to handle double-encoded entities (&amp;#8211; → &#8211; → –)
    text = html.unescape(html.unescape(text))

    # Normalize whitespace - collapse multiple spaces
    text = re.sub(r"\s+", " ", text)

    # Collapse multiple newlines (preserve intentional line breaks)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)

    return text.strip()


def validate_event(event_data: dict) -> Tuple[bool, Optional[str], list[str]]:
    """
    Validate event data before insertion into database.

    Returns:
        Tuple of (is_valid, rejection_reason, warnings)
        - is_valid: True if event should be inserted, False if rejected
        - rejection_reason: If rejected, the reason why (for logging)
        - warnings: List of non-fatal issues found (event can still be inserted)

    Required fields (reject if missing or invalid):
    - title: non-empty string, max 500 chars
    - start_date: valid date string (YYYY-MM-DD)
    - source_id: must be present

    Data quality checks (log warning but still insert):
    - start_date should not be more than configured future window
    - start_date should not be more than 1 day in past
    - title should not be all-caps (fix it)
    - description should be under 5000 chars (truncate)
    - price_min/price_max should be reasonable (0-10000)
    """
    _validation_stats.total_validated += 1

    warnings = []

    # ===== REQUIRED FIELD CHECKS =====

    # Check title
    title = event_data.get("title", "")
    if not title or not title.strip():
        _validation_stats.record_rejection("missing_title")
        return False, "Missing or empty title", warnings

    title = title.strip()

    if len(title) > 500:
        _validation_stats.record_rejection("title_too_long")
        return False, f"Title exceeds 500 characters ({len(title)} chars)", warnings

    # Check start_date
    start_date = event_data.get("start_date")
    if not start_date:
        _validation_stats.record_rejection("missing_start_date")
        return False, "Missing start_date", warnings

    # Validate date format
    try:
        date_obj = datetime.strptime(start_date, "%Y-%m-%d")
    except (ValueError, TypeError):
        _validation_stats.record_rejection("invalid_date_format")
        return (
            False,
            f"Invalid date format: {start_date} (expected YYYY-MM-DD)",
            warnings,
        )

    # Check source_id
    if not event_data.get("source_id"):
        _validation_stats.record_rejection("missing_source_id")
        return False, "Missing source_id", warnings

    # ===== HARD REJECTION CHECKS =====

    today = datetime.now().date()
    event_date = date_obj.date()

    # Reject events beyond the future window (usually year parsing bugs).
    if event_date > today + timedelta(days=MAX_FUTURE_DAYS_DEFAULT):
        _validation_stats.record_rejection("date_too_far_future")
        return (
            False,
            (
                f"Date >{MAX_FUTURE_DAYS_DEFAULT} days in future "
                f"(likely parsing bug): {start_date} - {title}"
            ),
            warnings,
        )

    # Warn on missing start_time (unless genuinely all-day)
    start_time = event_data.get("start_time")
    is_all_day = event_data.get("is_all_day", False)
    if not start_time and not is_all_day:
        warnings.append(f"Missing start_time (not all-day): {title}")
        _validation_stats.record_warning("missing_start_time")

    # ===== DATA QUALITY CHECKS (warnings only) =====

    # Check if date is in the past (more than 1 day ago)
    if event_date < today - timedelta(days=1):
        warnings.append(f"Date is in the past: {start_date}")
        _validation_stats.record_warning("past_date")

    # Check for all-caps title (likely extraction artifact)
    if title.isupper() and len(title) > 5:
        event_data["title"] = smart_title_case(title)
        warnings.append("All-caps title converted to title case")
        _validation_stats.record_warning("all_caps_title")

    # Check description length
    description = event_data.get("description")
    if description and len(description) > 5000:
        event_data["description"] = description[:4997] + "..."
        warnings.append(f"Description truncated from {len(description)} to 5000 chars")
        _validation_stats.record_warning("description_truncated")

    # Check price ranges
    price_min = event_data.get("price_min")
    price_max = event_data.get("price_max")

    if price_min is not None:
        try:
            price_min_val = float(price_min)
            if price_min_val < 0 or price_min_val > 10000:
                warnings.append(f"price_min out of range: {price_min_val}")
                _validation_stats.record_warning("invalid_price_min")
                event_data["price_min"] = None
        except (ValueError, TypeError):
            warnings.append(f"Invalid price_min: {price_min}")
            _validation_stats.record_warning("invalid_price_min")
            event_data["price_min"] = None

    if price_max is not None:
        try:
            price_max_val = float(price_max)
            if price_max_val < 0 or price_max_val > 10000:
                warnings.append(f"price_max out of range: {price_max_val}")
                _validation_stats.record_warning("invalid_price_max")
                event_data["price_max"] = None
        except (ValueError, TypeError):
            warnings.append(f"Invalid price_max: {price_max}")
            _validation_stats.record_warning("invalid_price_max")
            event_data["price_max"] = None

    # Category validity check (runs after normalize_category in insert_event)
    category = event_data.get("category")
    if category and category not in VALID_CATEGORIES:
        _validation_stats.record_rejection("invalid_category")
        return False, f"Invalid category: {category}", warnings

    # ===== SANITIZATION (fix and insert) =====

    # Sanitize title
    sanitized_title = sanitize_text(title)
    if sanitized_title != title:
        event_data["title"] = sanitized_title
        _validation_stats.record_warning("title_sanitized")

    # Sanitize description
    if description:
        sanitized_desc = sanitize_text(description)
        if sanitized_desc != description:
            event_data["description"] = sanitized_desc
            _validation_stats.record_warning("description_sanitized")

    # Sanitize venue name if present
    if "venue_name" in event_data and event_data["venue_name"]:
        sanitized_venue = sanitize_text(event_data["venue_name"])
        if sanitized_venue != event_data["venue_name"]:
            event_data["venue_name"] = sanitized_venue
            _validation_stats.record_warning("venue_name_sanitized")

    _validation_stats.record_pass()
    return True, None, warnings


@retry_on_network_error(max_retries=3, base_delay=0.5)
def validate_event_title(title: str) -> bool:
    """Reject obviously bad event titles (nav elements, descriptions, junk).
    Returns True if valid, False if title should be rejected."""
    if not title or not title.strip():
        return False

    title = title.strip()

    # Too short or too long
    if len(title) < 3 or len(title) > 200:
        return False

    # Exact-match junk (nav/UI elements scraped as titles)
    junk_exact = {
        "learn more",
        "host an event",
        "upcoming events",
        "see details",
        "buy tickets",
        "click here",
        "read more",
        "view all",
        "sign up",
        "subscribe",
        "follow us",
        "contact us",
        "more info",
        "register",
        "rsvp",
        "get tickets",
        "see more",
        "shows",
        "about us",
        "skip to content",
        "skip to main content",
        "events search and views navigation",
        "google calendar",
        "event calendar",
        "events list view",
        "upcoming shows",
        "all dates",
        "all events",
        "all locations",
        "event type",
        "event location",
        "this month",
        "select date.",
        "sold out",
        "our calendar of shows and events",
        "corporate partnerships",
        "big futures",
        "match resources",
        # Placeholder/TBA titles
        "tba",
        "tbd",
        "tbc",
        "t.b.a.",
        "t.b.d.",
        "to be announced",
        "to be determined",
        "to be confirmed",
        "event tba",
        "event tbd",
        "show tba",
        "show tbd",
        "artist tba",
        "performer tba",
        "special event",
        "special event tba",
        "private event",
        "closed",
        "closed for private event",
        "n/a",
        "none",
        "book now",
        "buy now",
        "get tickets now",
        "reserve now",
        # Concession/promo items scraped as events
        "view fullsize",
        "more details",
        "gnashcash",
        "value pack hot dog & soda",
        "value pack hot dog and soda",
    }
    if title.lower().strip() in junk_exact:
        return False

    # URLs as titles
    if re.match(r"^https?://", title, re.IGNORECASE):
        return False

    # Titles that are just scraping artifacts (ticket policy text, nav cruft)
    if re.match(r"^(advance ticket sales|current production)", title, re.IGNORECASE):
        return False

    # Day/date + random word patterns ("FRI, FEB 6, 2026 headphones")
    if re.match(r"^(MON|TUE|WED|THU|FRI|SAT|SUN),\s+\w+\s+\d", title):
        return False

    # Titles that are just "TBA" with minor decoration ("** TBA **", "- TBA -")
    stripped = re.sub(r"[^a-zA-Z0-9\s]", "", title).strip()
    if stripped.upper() in {"TBA", "TBD", "TBC"}:
        return False

    # Day-of-week only titles
    if re.match(
        r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$",
        title,
        re.IGNORECASE,
    ):
        return False

    # Date-only titles ("Thursday, February 5")
    if re.match(
        r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}$",
        title,
        re.IGNORECASE,
    ):
        return False

    # Month-label titles ("January Activities", "January 2026")
    if re.match(
        r"^(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(Activities|Events|Calendar|Schedule|Programs|Classes|\d{4})$",
        title,
        re.IGNORECASE,
    ):
        return False

    # Titles starting with description-like patterns
    desc_starts = [
        "every monday",
        "every tuesday",
        "every wednesday",
        "every thursday",
        "every friday",
        "every saturday",
        "every sunday",
        'join us for "navigating',
        "registration for this free event",
        "keep your pet happy",
        "come join the tipsy",
        "viewing 1-",
        "click here to download",
    ]
    title_lower = title.lower()
    for pattern in desc_starts:
        if title_lower.startswith(pattern):
            return False

    return True


# ---------------------------------------------------------------------------
# Category normalization
# ---------------------------------------------------------------------------
_CATEGORY_NORMALIZATION_MAP: dict[str, str] = {
    "arts": "art",
    "activism": "community",
    "cultural": "community",
    "haunted": "nightlife",
    "eatertainment": "nightlife",
    "entertainment": "family",
    "food": "food_drink",
    "yoga": "fitness",
    "cooking": "learning",
    "class": "learning",
}


def normalize_category(category):
    """Normalize a category value to the canonical taxonomy."""
    if not category:
        return category
    return _CATEGORY_NORMALIZATION_MAP.get(category, category)


def insert_event(
    event_data: dict, series_hint: dict = None, genres: list = None
) -> int:
    """Insert a new event with inferred tags, series linking, and genres. Returns event ID."""
    client = get_client()

    original_category = event_data.get("category")

    # Normalize category to canonical taxonomy
    if event_data.get("category"):
        event_data["category"] = normalize_category(event_data["category"])

    # ===== VALIDATION LAYER =====
    # Validate event data before processing
    is_valid, rejection_reason, warnings = validate_event(event_data)

    if not is_valid:
        # Log rejection and skip insertion
        logger.warning(
            f"Event rejected: {rejection_reason} - Title: \"{event_data.get('title', 'N/A')[:80]}\""
        )
        raise ValueError(f"Event validation failed: {rejection_reason}")

    # Log warnings if any
    if warnings:
        for warning in warnings:
            logger.debug(
                f"Event validation warning: {warning} - Title: \"{event_data.get('title', 'N/A')[:50]}\""
            )

    # Additional title quality check (existing validation)
    title = event_data.get("title", "")
    if not validate_event_title(title):
        logger.warning(f'Rejected bad title: "{title[:80]}"')
        raise ValueError(f'Invalid event title: "{title[:50]}"')

    # Reject events where title is just the venue name (junk / "place is open")
    venue_id = event_data.get("venue_id")
    if venue_id and title:
        try:
            venue_row = client.table("venues").select("name").eq("id", venue_id).maybe_single().execute()
            if venue_row.data:
                venue_name_db = (venue_row.data.get("name") or "").strip().lower()
                if venue_name_db and title.strip().lower() == venue_name_db:
                    logger.warning(f'Rejected title=venue_name junk: "{title[:80]}"')
                    raise ValueError(f'Event title matches venue name: "{title[:50]}"')
        except ValueError:
            raise  # Re-raise our own ValueError
        except Exception:
            pass  # Don't block insert on lookup failure

    # Remove producer_id if present (not a database column)
    if "producer_id" in event_data:
        event_data.pop("producer_id")

    # Extract is_class flag (will be re-added before insert)
    is_class_flag = event_data.pop("is_class", None)

    # Extract is_sensitive flag (will be re-added before insert)
    is_sensitive_flag = event_data.pop("is_sensitive", None)

    # Fetch source info once for class/festival inference and portal linking
    source_info = None
    source_slug = None
    source_name = None
    source_url = None
    if event_data.get("source_id"):
        source_info = get_source_info(event_data["source_id"])
        if source_info:
            source_slug = source_info.get("slug")
            source_name = source_info.get("name")
            source_url = source_info.get("url")

    # Inherit is_sensitive from source if not explicitly set on event
    if not is_sensitive_flag and source_info and source_info.get("is_sensitive"):
        is_sensitive_flag = True

    # Get venue info for tag inheritance
    venue_vibes = []
    venue_type = None
    if event_data.get("venue_id"):
        venue = get_venue_by_id_cached(event_data["venue_id"])
        if venue:
            venue_vibes = venue.get("vibes") or []
            venue_type = venue.get("venue_type")

            # Reject events at venues outside metro Atlanta
            venue_state = (venue.get("state") or "").upper().strip()
            if venue_state and venue_state != "GA":
                msg = (
                    f"Venue outside Georgia: {venue.get('name')} "
                    f"({venue.get('city')}, {venue_state})"
                )
                logger.warning(f"Event rejected: {msg}")
                raise ValueError(msg)

    # Auto-fetch movie metadata (poster, director, runtime, etc.) for film events
    film_metadata = None
    if event_data.get("category") == "film":
        film_metadata = get_metadata_for_film_event(
            event_data.get("title", ""), event_data.get("image_url")
        )
        if film_metadata and not event_data.get("image_url"):
            event_data["image_url"] = film_metadata.poster_url

    # Auto-fetch artist image, genres, and bio for music events
    music_info = None
    if event_data.get("category") == "music":
        music_info = get_info_for_music_event(
            event_data.get("title", ""),
            event_data.get("image_url"),
            genres,  # Pass existing genres if any
        )
        if music_info.image_url and not event_data.get("image_url"):
            event_data["image_url"] = music_info.image_url
        # Use fetched genres if none provided
        if music_info.genres and not genres:
            genres = music_info.genres

    # Parse lineup from title for event_artists population (music + comedy)
    if event_data.get("category") in ("music", "comedy"):
        if not event_data.get("_parsed_artists"):
            parsed = parse_lineup_from_title(event_data.get("title", ""))
            if parsed:
                event_data["_parsed_artists"] = parsed

    # Venue image fallback: if event still has no image after film/music enrichment,
    # use the venue's image. Covers venues like Callanwolde, MJCCA, GWCC where
    # crawlers don't extract per-event images but the venue has a good photo.
    if not event_data.get("image_url") and venue:
        venue_image = venue.get("image_url")
        if venue_image:
            event_data["image_url"] = venue_image
            logger.debug(f"Using venue image fallback for: {event_data.get('title', '')[:50]}")

    # Auto-infer is_class if not explicitly set
    if not is_class_flag:
        if infer_is_class(event_data, source_slug=source_slug, venue_type=venue_type):
            is_class_flag = True

    # Auto-detect support groups — reclassify and mark sensitive
    if infer_is_support_group(event_data, source_slug=source_slug):
        event_data["category"] = "support_group"
        is_sensitive_flag = True

    # Festival/conference rollup hints based on source
    festival_hint = get_festival_source_hint(source_slug, source_name)
    if festival_hint:
        if not series_hint:
            if event_data.get("category") == "film":
                series_type = "film"
            elif is_class_flag:
                series_type = "class_series"
            elif event_data.get("is_recurring"):
                series_type = "recurring_show"
            else:
                series_type = "festival_program"

            # For festival programs, consolidate under inferred program or festival name.
            # NEVER fall back to event title — that creates one series per event.
            inferred_program = infer_program_title(event_data.get("title"))
            series_title = (
                inferred_program
                or festival_hint.get("festival_name")
            )
            if not series_title:
                # No usable series title — skip series creation entirely
                festival_hint = None
            else:
                series_hint = {
                    "series_type": series_type,
                    "series_title": series_title,
                }

        if festival_hint and series_hint:
            if festival_hint.get("festival_name") and not series_hint.get("festival_name"):
                series_hint["festival_name"] = festival_hint["festival_name"]
            if festival_hint.get("festival_type") and not series_hint.get("festival_type"):
                series_hint["festival_type"] = festival_hint["festival_type"]
            if source_url and not series_hint.get("festival_website"):
                series_hint["festival_website"] = source_url

    # Class rollup hints
    if not series_hint and is_class_flag:
        series_hint = {
            "series_type": "class_series",
            "series_title": event_data.get("title"),
        }

    # Recurring show rollup hints
    if not series_hint and event_data.get("is_recurring"):
        series_hint = {
            "series_type": "recurring_show",
            "series_title": event_data.get("title"),
        }

    # Infer genres FIRST so tags can use genre context
    venue_genres = None
    if event_data.get("venue_id"):
        venue = get_venue_by_id_cached(event_data["venue_id"])
        if venue:
            venue_genres = venue.get("genres")
    inferred_genres = normalize_genres(
        infer_genres(
            event_data,
            venue_genres=venue_genres,
            venue_vibes=venue_vibes,
            venue_type=venue_type,
        )
    )
    explicit_genres = normalize_genres(genres or [])
    merged_genres = list(dict.fromkeys(explicit_genres + inferred_genres))
    if original_category == "activism" and "activism" not in merged_genres:
        merged_genres.append("activism")

    # Infer and merge tags (now with genre context)
    event_data["tags"] = infer_tags(
        event_data,
        venue_vibes,
        venue_type=venue_type,
        genres=merged_genres,
    )

    # Update genres variable for downstream use
    if merged_genres:
        genres = merged_genres

    # Enrich series_hint with OMDB metadata for film events
    if film_metadata and series_hint and series_hint.get("series_type") == "film":
        omdb_fields = {
            "director": film_metadata.director,
            "runtime_minutes": film_metadata.runtime_minutes,
            "year": film_metadata.year,
            "rating": film_metadata.rating,
            "imdb_id": film_metadata.imdb_id,
            "genres": film_metadata.genres,
            "description": film_metadata.plot,
            "image_url": film_metadata.poster_url,
        }
        for key, value in omdb_fields.items():
            if value is not None and not series_hint.get(key):
                series_hint[key] = value

    # Process series association if hint provided — but only if no series_id already set
    if series_hint and not event_data.get("series_id"):
        # Inject inferred genres into series_hint so new series get genres at creation
        if genres and not series_hint.get("genres"):
            series_hint["genres"] = genres
        series_id = get_or_create_series(
            client, series_hint, event_data.get("category")
        )
        if series_id:
            event_data["series_id"] = series_id
            # Backfill genres on existing series that are missing them
            if genres:
                update_series_metadata(client, series_id, {"genres": genres})
            # Don't store genres on event if it has a series (genres live on series)
            genres = None
            # Backfill NULL fields on existing series with OMDB metadata
            if film_metadata and series_hint.get("series_type") == "film":
                update_series_metadata(
                    client,
                    series_id,
                    {
                        "director": film_metadata.director,
                        "runtime_minutes": film_metadata.runtime_minutes,
                        "year": film_metadata.year,
                        "rating": film_metadata.rating,
                        "imdb_id": film_metadata.imdb_id,
                        "genres": film_metadata.genres,
                        "description": film_metadata.plot,
                        "image_url": film_metadata.poster_url,
                    },
                )
            # Backfill NULL fields on recurring show / class series from crawler hints
            if series_hint.get("series_type") in ("recurring_show", "class_series"):
                backfill = {}
                for field in (
                    "description",
                    "image_url",
                    "day_of_week",
                    "start_time",
                    "frequency",
                ):
                    if series_hint.get(field):
                        backfill[field] = series_hint[field]
                if backfill:
                    update_series_metadata(client, series_id, backfill)

    # Always store genres on the event row for discoverability
    # (series also stores genres, but event-level enables filtering/display)
    if genres:
        event_data["genres"] = genres

    # Backfill description from film metadata when missing or too short to be useful
    existing_desc = event_data.get("description") or ""
    if film_metadata and film_metadata.plot and len(existing_desc) < 80:
        event_data["description"] = film_metadata.plot[:2000]

    # Backfill description from artist Wikipedia bio for music events
    existing_desc = event_data.get("description") or ""
    if music_info and music_info.bio and len(existing_desc) < 80:
        event_data["description"] = music_info.bio[:2000]

    # Strip template/filler descriptions — NULL is better than "Event at X".
    desc = event_data.get("description") or ""
    if re.match(
        r"^(Event at |Live music at .+ featuring|Comedy show at |"
        r"Theater performance at |Film screening at |Sporting event at |"
        r"Arts event at |Food & drink event at |Fitness class at |"
        r"Creative workshop at |Performance at |Show at |Paint and sip class at )",
        desc,
    ):
        event_data["description"] = None

    # Inherit portal_id from source if not explicitly set
    if (
        not event_data.get("portal_id")
        and source_info
        and source_info.get("owner_portal_id")
    ):
        event_data["portal_id"] = source_info["owner_portal_id"]

    # Persist is_class flag to database
    if is_class_flag:
        event_data["is_class"] = True

    # Persist is_sensitive flag to database
    if is_sensitive_flag:
        event_data["is_sensitive"] = True

    # Safety guard: an event with a real price can never be free
    if event_data.get("price_min") is not None and event_data["price_min"] > 0:
        event_data["is_free"] = False

    # Persist first-class show metadata (doors, age policy, ticket state, etc.)
    signal_fields = (
        "doors_time",
        "age_policy",
        "ticket_status",
        "reentry_policy",
        "set_times_mentioned",
    )
    if events_support_show_signal_columns():
        event_data.update(derive_show_signals(event_data))
    else:
        for field in signal_fields:
            event_data.pop(field, None)

    # Pop transient and deprecated fields before DB insert
    parsed_artists_for_insert = event_data.pop("_parsed_artists", None)
    event_data.pop("subcategory", None)  # DEPRECATED: migrated to genres[]

    result = client.table("events").insert(event_data).execute()
    event_id = result.data[0]["id"]

    # Generate blurhash in background to avoid slowing crawl throughput.
    _queue_event_blurhash(event_id, event_data.get("image_url"))

    # Auto-populate event_artists from parsed lineup for music events
    if parsed_artists_for_insert:
        try:
            upsert_event_artists(event_id, parsed_artists_for_insert)
        except Exception as e:
            logger.debug(f"Auto event_artists failed for event {event_id}: {e}")

    return event_id


def parse_lineup_from_title(title: str) -> list[dict]:
    """Parse artist lineup from event title.

    Returns list of dicts: [{name, role, billing_order, is_headliner}, ...]
    """
    from extractors.lineup import (
        split_lineup_text_with_roles,
        dedupe_artist_entries,
    )
    from artist_images import extract_artist_from_title, _ARTIST_BLOCKLIST

    parsed_entries = dedupe_artist_entries(split_lineup_text_with_roles(title))
    if not parsed_entries:
        # Fallback: single artist extraction (removes tour names, prefixes, etc.)
        headliner = extract_artist_from_title(title)
        if headliner:
            parsed_entries = [{"name": headliner, "role": "headliner"}]

    if not parsed_entries:
        return []

    # Filter out blocklisted terms and single short words
    filtered_entries: list[dict] = []
    for entry in parsed_entries:
        name = str(entry.get("name") or "").strip()
        if not name:
            continue
        if name.lower() in _ARTIST_BLOCKLIST:
            continue
        if len(name) < 4 and " " not in name:
            continue
        filtered_entries.append({"name": name, "role": entry.get("role")})

    if not filtered_entries:
        return []

    has_explicit_headliner = any(
        str(entry.get("role") or "").lower() == "headliner"
        for entry in filtered_entries
    )

    result: list[dict] = []
    for idx, entry in enumerate(filtered_entries, 1):
        role = str(entry.get("role") or "").lower() or ("headliner" if idx == 1 else "support")
        if role not in {"headliner", "support", "opener"}:
            role = "headliner" if idx == 1 else "support"

        is_headliner = role == "headliner"
        if not has_explicit_headliner and idx == 1:
            is_headliner = True
            role = "headliner"

        result.append(
            {
                "name": entry["name"],
                "role": role,
                "billing_order": idx,
                "is_headliner": is_headliner,
            }
        )

    return result


def update_event(event_id: int, event_data: dict) -> None:
    """Update an existing event."""
    client = get_client()
    client.table("events").update(event_data).eq("id", event_id).execute()


def upsert_event_artists(event_id: int, artists: list) -> None:
    """Replace event artists for an event, preserving billing order."""
    if not artists:
        return

    cleaned: list[dict] = []
    seen: set[str] = set()

    for idx, entry in enumerate(artists, start=1):
        if isinstance(entry, dict):
            name = entry.get("name")
            role = entry.get("role")
            billing_order = entry.get("billing_order") or entry.get("order") or idx
            is_headliner = entry.get("is_headliner")
        else:
            name = entry
            role = None
            billing_order = idx
            is_headliner = None

        if not name:
            continue

        normalized = " ".join(str(name).split())
        if not normalized:
            continue

        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)

        if is_headliner is None and role:
            is_headliner = str(role).lower() == "headliner"

        cleaned.append(
            {
                "name": normalized,
                "role": role,
                "billing_order": billing_order,
                "is_headliner": is_headliner if is_headliner is not None else None,
            }
        )

    if not cleaned:
        return

    client = get_client()
    client.table("event_artists").delete().eq("event_id", event_id).execute()

    payload = []
    for item in cleaned:
        payload.append(
            {
                "event_id": event_id,
                "name": item["name"],
                "role": item.get("role"),
                "billing_order": item.get("billing_order"),
                "is_headliner": item.get("is_headliner"),
            }
        )

    client.table("event_artists").insert(payload).execute()

    # Resolve canonical artist records and set artist_id FK
    try:
        from artists import resolve_and_link_event_artists

        resolve_and_link_event_artists(event_id)
    except Exception as e:
        logger.debug(f"Artist resolution failed for event {event_id}: {e}")


def upsert_event_images(event_id: int, images: list) -> None:
    """Upsert images for an event."""
    if not images:
        return

    payload = []
    seen: set[str] = set()

    for entry in images:
        if isinstance(entry, dict):
            url = entry.get("url")
            width = entry.get("width")
            height = entry.get("height")
            img_type = entry.get("type")
            source = entry.get("source")
            confidence = entry.get("confidence")
            is_primary = entry.get("is_primary", False)
        else:
            url = entry
            width = None
            height = None
            img_type = None
            source = None
            confidence = None
            is_primary = False

        if not url:
            continue
        normalized = str(url).strip()
        if not normalized:
            continue
        if normalized in seen:
            continue
        seen.add(normalized)

        payload.append(
            {
                "event_id": event_id,
                "url": normalized,
                "width": width,
                "height": height,
                "type": img_type,
                "source": source,
                "confidence": confidence,
                "is_primary": bool(is_primary),
            }
        )

    if not payload:
        return

    client = get_client()
    client.table("event_images").upsert(payload, on_conflict="event_id,url").execute()


def upsert_event_links(event_id: int, links: list) -> None:
    """Upsert links for an event (ticketing, organizer, etc.)."""
    if not links:
        return

    payload = []
    seen: set[tuple[str, str]] = set()

    for entry in links:
        if isinstance(entry, dict):
            link_type = entry.get("type")
            url = entry.get("url")
            source = entry.get("source")
            confidence = entry.get("confidence")
        else:
            link_type = None
            url = entry
            source = None
            confidence = None

        if not link_type or not url:
            continue

        normalized_url = str(url).strip()
        normalized_type = str(link_type).strip()
        if not normalized_url or not normalized_type:
            continue

        key = (normalized_type.lower(), normalized_url)
        if key in seen:
            continue
        seen.add(key)

        payload.append(
            {
                "event_id": event_id,
                "type": normalized_type,
                "url": normalized_url,
                "source": source,
                "confidence": confidence,
            }
        )

    if not payload:
        return

    client = get_client()
    client.table("event_links").upsert(
        payload, on_conflict="event_id,type,url"
    ).execute()


def update_event_extraction_metadata(
    event_id: int,
    field_provenance: Optional[dict] = None,
    field_confidence: Optional[dict] = None,
    extraction_version: Optional[str] = None,
) -> None:
    """Update per-field provenance/confidence metadata for an event."""
    update_data: dict = {}
    if field_provenance is not None:
        update_data["field_provenance"] = field_provenance
    if field_confidence is not None:
        update_data["field_confidence"] = field_confidence
    if extraction_version is not None:
        update_data["extraction_version"] = extraction_version

    if not update_data:
        return

    client = get_client()
    client.table("events").update(update_data).eq("id", event_id).execute()


# ===== EVENT UPDATE NOTIFICATIONS =====

_CANCEL_KEYWORDS = ("canceled", "cancelled", "postponed")


def _event_looks_cancelled(title: Optional[str], description: Optional[str]) -> bool:
    text = f"{title or ''} {description or ''}".lower()
    return any(word in text for word in _CANCEL_KEYWORDS)


def format_event_update_message(
    title: str,
    changes: list[str],
    cancelled: bool = False,
) -> str:
    if cancelled:
        return f"Update: {title} was canceled."
    if changes:
        change_summary = "; ".join(changes)
        return f"Update: {title} changed — {change_summary}."
    return f"Update: {title} has new details."


def _filter_users_with_event_updates(user_ids: list[str]) -> list[str]:
    """Filter users by notification_settings.event_updates (default true)."""
    if not user_ids:
        return []
    client = get_client()
    try:
        result = (
            client.table("profiles")
            .select("id,notification_settings")
            .in_("id", user_ids)
            .execute()
        )
    except Exception as e:
        logger.warning(
            "Failed to load notification_settings; defaulting to all users",
            exc_info=e,
        )
        return user_ids
    allowed: list[str] = []
    for row in result.data or []:
        settings = row.get("notification_settings") or {}
        if settings.get("event_updates", True):
            allowed.append(row["id"])
    return allowed


def create_event_update_notifications(event_id: int, message: str) -> int:
    """Create in-app notifications for users with RSVPs or saved items."""
    client = get_client()

    # RSVP users (going/interested)
    rsvp_result = (
        client.table("event_rsvps")
        .select("user_id,status")
        .eq("event_id", event_id)
        .execute()
    )
    rsvp_users = {
        row["user_id"]
        for row in (rsvp_result.data or [])
        if row.get("status") in ("going", "interested")
    }

    # Saved users
    saved_result = (
        client.table("saved_items").select("user_id").eq("event_id", event_id).execute()
    )
    saved_users = {
        row["user_id"] for row in (saved_result.data or []) if row.get("user_id")
    }

    user_ids = list(rsvp_users | saved_users)
    user_ids = _filter_users_with_event_updates(user_ids)

    if not user_ids:
        return 0

    payload = [
        {
            "user_id": user_id,
            "type": "event_update",
            "event_id": event_id,
            "message": message,
        }
        for user_id in user_ids
    ]

    client.table("notifications").insert(payload).execute()
    return len(payload)


def compute_event_update(
    existing: dict, incoming: dict
) -> tuple[dict, list[str], bool]:
    """Compute update fields and a change summary for notifications."""
    update_data: dict = {}
    changes: list[str] = []
    incoming_with_signals = {**incoming, **derive_show_signals(incoming, preserve_existing=False)}

    # Time/date changes
    if incoming_with_signals.get("start_date") and incoming_with_signals.get("start_date") != existing.get(
        "start_date"
    ):
        changes.append(
            f"date {existing.get('start_date')} → {incoming_with_signals.get('start_date')}"
        )
        update_data["start_date"] = incoming_with_signals.get("start_date")
    if incoming_with_signals.get("start_time") and incoming_with_signals.get("start_time") != existing.get(
        "start_time"
    ):
        changes.append(
            f"time {existing.get('start_time') or 'TBA'} → {incoming_with_signals.get('start_time')}"
        )
        update_data["start_time"] = incoming_with_signals.get("start_time")
    if incoming_with_signals.get("end_date") and incoming_with_signals.get("end_date") != existing.get(
        "end_date"
    ):
        update_data["end_date"] = incoming_with_signals.get("end_date")
    if incoming_with_signals.get("end_time") and incoming_with_signals.get("end_time") != existing.get(
        "end_time"
    ):
        update_data["end_time"] = incoming_with_signals.get("end_time")

    # Venue change
    if incoming_with_signals.get("venue_id") and incoming_with_signals.get("venue_id") != existing.get(
        "venue_id"
    ):
        changes.append("venue updated")
        update_data["venue_id"] = incoming_with_signals.get("venue_id")

    # Title change (preserve cancellation/reschedule markers)
    incoming_title = incoming_with_signals.get("title")
    if incoming_title and incoming_title != existing.get("title"):
        if _event_looks_cancelled(incoming_title, incoming_with_signals.get("description")):
            update_data["title"] = incoming_title

    # Description (prefer longer)
    incoming_desc = incoming_with_signals.get("description")
    if incoming_desc and (
        not existing.get("description")
        or len(incoming_desc) > len(existing.get("description", ""))
    ):
        update_data["description"] = incoming_desc

    # Image / ticket / price if missing
    for field in ("image_url", "ticket_url", "price_note"):
        if incoming_with_signals.get(field) and not existing.get(field):
            update_data[field] = incoming_with_signals.get(field)
    for field in ("price_min", "price_max"):
        if incoming_with_signals.get(field) is not None and existing.get(field) is None:
            update_data[field] = incoming_with_signals.get(field)

    # First-class show metadata
    if events_support_show_signal_columns():
        for field in ("doors_time", "age_policy", "ticket_status", "reentry_policy"):
            incoming_value = incoming_with_signals.get(field)
            if incoming_value and incoming_value != existing.get(field):
                update_data[field] = incoming_value

        incoming_set_times = incoming_with_signals.get("set_times_mentioned")
        if incoming_set_times is True and not existing.get("set_times_mentioned"):
            update_data["set_times_mentioned"] = True

    cancelled = _event_looks_cancelled(
        incoming_with_signals.get("title"), incoming_with_signals.get("description")
    ) and not _event_looks_cancelled(existing.get("title"), existing.get("description"))

    return update_data, changes, cancelled


@retry_on_network_error(max_retries=3, base_delay=0.5)
def find_event_by_hash(content_hash: str) -> Optional[dict]:
    """Find event by content hash for deduplication."""
    client = get_client()
    result = (
        client.table("events").select("*").eq("content_hash", content_hash).execute()
    )
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


@retry_on_network_error()
def remove_stale_source_events(source_id: int, current_hashes: set[str]) -> int:
    """Remove future events from a source that weren't seen in the current crawl.

    Used by cinema crawlers where the full schedule is available each crawl run.
    Showtimes that have been removed from the theater's site are deleted from our DB.

    Args:
        source_id: The source to clean up
        current_hashes: Set of content_hashes seen in this crawl run

    Returns:
        Number of stale events deleted
    """
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")

    # Get all future events from this source
    result = (
        client.table("events")
        .select("id,content_hash")
        .eq("source_id", source_id)
        .gte("start_date", today)
        .execute()
    )

    if not result.data:
        return 0

    # Find events whose hash wasn't seen in this crawl
    stale_ids = [
        e["id"] for e in result.data if e["content_hash"] not in current_hashes
    ]

    if not stale_ids:
        return 0

    # Clear canonical references pointing to stale events
    for stale_id in stale_ids:
        client.table("events").update({"canonical_event_id": None}).eq(
            "canonical_event_id", stale_id
        ).execute()

    # Delete in batches
    deleted = 0
    batch_size = 50
    for i in range(0, len(stale_ids), batch_size):
        batch = stale_ids[i : i + batch_size]
        client.table("events").delete().in_("id", batch).execute()
        deleted += len(batch)

    logger.info(f"Removed {deleted} stale events from source {source_id}")
    return deleted


def find_events_by_date_and_venue(date: str, venue_id: int) -> list[dict]:
    """Find events on a specific date at a specific venue."""
    client = get_client()
    result = (
        client.table("events")
        .select("*")
        .eq("start_date", date)
        .eq("venue_id", venue_id)
        .execute()
    )
    return result.data or []


def get_sibling_venue_ids(venue_id: int) -> list[int]:
    """
    Get IDs of sibling venues (other rooms of the same multi-room venue).
    For example, if venue_id is for "The Masquerade - Hell", returns IDs for
    Heaven, Purgatory, Altar, Music Park, and the main Masquerade venue.

    Returns list including the original venue_id.
    """
    client = get_client()

    # Get the venue name
    venue = get_venue_by_id(venue_id)
    if not venue:
        return [venue_id]

    venue_name = venue.get("name", "").lower()

    # Check if this is a Masquerade room
    if "masquerade" in venue_name:
        # Find all Masquerade venues
        result = (
            client.table("venues").select("id").ilike("name", "%masquerade%").execute()
        )
        if result.data:
            return [v["id"] for v in result.data]

    # Add more multi-room venue patterns here as needed
    # if "terminal west" in venue_name:
    #     result = client.table("venues").select("id").ilike("name", "%terminal west%").execute()
    #     ...

    return [venue_id]


def find_events_by_date_and_venue_family(date: str, venue_id: int) -> list[dict]:
    """
    Find events on a specific date at a venue OR any of its sibling rooms.
    Used for deduplication of events at multi-room venues like The Masquerade.
    """
    client = get_client()
    sibling_ids = get_sibling_venue_ids(venue_id)

    result = (
        client.table("events")
        .select("*, venue:venues(name)")
        .eq("start_date", date)
        .in_("venue_id", sibling_ids)
        .execute()
    )

    # Add venue_name to results for similarity calculation
    events = []
    for event in result.data or []:
        event["venue_name"] = event.get("venue", {}).get("name", "")
        events.append(event)

    return events


def create_crawl_log(source_id: int) -> int:
    """Create a new crawl log entry. Returns log ID."""
    client = get_client()
    result = (
        client.table("crawl_logs")
        .insert(
            {
                "source_id": source_id,
                "started_at": datetime.utcnow().isoformat(),
                "status": "running",
            }
        )
        .execute()
    )
    return result.data[0]["id"]


def get_all_events(limit: int = 1000, offset: int = 0) -> list[dict]:
    """Fetch events with pagination."""
    client = get_client()
    result = (
        client.table("events")
        .select("*")
        .order("id")
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data or []


def update_event_tags(event_id: int, tags: list[str]) -> None:
    """Update only the tags field of an event."""
    client = get_client()
    client.table("events").update({"tags": tags}).eq("id", event_id).execute()


def update_crawl_log(
    log_id: int,
    status: str,
    events_found: int = 0,
    events_new: int = 0,
    events_updated: int = 0,
    events_rejected: int = 0,
    error_message: Optional[str] = None,
) -> None:
    """Update crawl log with results."""
    client = get_client()

    # Build update data
    update_data = {
        "completed_at": datetime.utcnow().isoformat(),
        "status": status,
        "events_found": events_found,
        "events_new": events_new,
        "events_updated": events_updated,
    }

    if error_message:
        update_data["error_message"] = error_message

    # events_rejected column guaranteed by migration 20260215000000
    update_data["events_rejected"] = events_rejected

    client.table("crawl_logs").update(update_data).eq("id", log_id).execute()


def refresh_available_filters() -> bool:
    """
    Refresh the available_filters table with current filter options.
    Call this after each crawl run to update filter availability.
    Returns True on success, False on error.
    """
    client = get_client()
    try:
        # Call the PostgreSQL function that refreshes filters
        client.rpc("refresh_available_filters").execute()
        return True
    except Exception as e:
        print(f"Error refreshing available filters: {e}")
        return False


def update_source_health_tags(
    source_id: int, health_tags: list[str], active_months: Optional[list[int]] = None
) -> bool:
    """
    Update the health_tags and optionally active_months for a source.

    Args:
        source_id: The source ID to update
        health_tags: List of health tag strings (e.g., ['timeout', 'no-events'])
        active_months: Optional list of active months (1-12), None means year-round

    Returns:
        True on success, False on error
    """
    client = get_client()
    try:
        update_data = {"health_tags": health_tags}
        if active_months is not None:
            update_data["active_months"] = active_months

        client.table("sources").update(update_data).eq("id", source_id).execute()
        return True
    except Exception as e:
        print(f"Error updating source health tags: {e}")
        return False


def get_source_health_tags(source_id: int) -> tuple[list[str], Optional[list[int]]]:
    """
    Get the current health_tags and active_months for a source.

    Returns:
        Tuple of (health_tags, active_months)
    """
    client = get_client()
    try:
        result = (
            client.table("sources")
            .select("health_tags, active_months")
            .eq("id", source_id)
            .execute()
        )
        if result.data and len(result.data) > 0:
            return (
                result.data[0].get("health_tags") or [],
                result.data[0].get("active_months"),
            )
    except Exception:
        pass
    return [], None


def deactivate_tba_events() -> int:
    """
    Report future events that still have no start_time after enrichment.

    TBA events are filtered at the web API level (search.ts adds
    or(start_time.not.is.null,is_all_day.eq.true) to queries) so they
    don't appear in feeds. This function just logs the count for visibility.

    Returns:
        Number of TBA events found
    """
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")

    result = (
        client.table("events")
        .select("id", count="exact", head=True)
        .gte("start_date", today)
        .is_("start_time", "null")
        .eq("is_all_day", False)
        .execute()
    )

    tba_count = result.count or 0
    if tba_count > 0:
        logger.info(
            f"Found {tba_count} TBA events (missing start_time) — hidden from feeds via API filter"
        )

    return tba_count


# ===== SMART CRAWL SCHEDULING =====


def update_source_last_crawled(source_id: int) -> None:
    """Set last_crawled_at = NOW() for a source after successful crawl."""
    client = get_client()
    client.table("sources").update(
        {"last_crawled_at": datetime.utcnow().isoformat()}
    ).eq("id", source_id).execute()


def update_expected_event_count(source_id: int, events_found: int) -> None:
    """Update rolling average of expected event count for zero-event detection.

    Uses exponential moving average: new = 0.7 * old + 0.3 * current.
    If old is NULL, sets directly.
    """
    client = get_client()
    result = (
        client.table("sources")
        .select("expected_event_count")
        .eq("id", source_id)
        .execute()
    )
    old = None
    if result.data:
        old = result.data[0].get("expected_event_count")

    if old is None:
        new_count = events_found
    else:
        new_count = int(0.7 * old + 0.3 * events_found)

    client.table("sources").update(
        {"expected_event_count": new_count}
    ).eq("id", source_id).execute()


def get_sources_due_for_crawl() -> list[dict]:
    """Fetch active sources that are due for a crawl based on crawl_frequency.

    Uses slightly-under thresholds to prevent drift from cron timing:
    - daily: >20 hours ago
    - twice_weekly: >3 days ago
    - weekly: >6.5 days ago
    - monthly: >28 days ago
    """
    client = get_client()
    sources = client.table("sources").select("*").eq("is_active", True).execute()
    all_sources = sources.data or []

    now = datetime.utcnow()
    thresholds = {
        "daily": timedelta(hours=20),
        "twice_weekly": timedelta(days=3),
        "weekly": timedelta(days=6, hours=12),
        "monthly": timedelta(days=28),
    }

    due = []
    for source in all_sources:
        freq = source.get("crawl_frequency") or "daily"
        threshold = thresholds.get(freq, thresholds["daily"])
        last = source.get("last_crawled_at")

        if last is None:
            due.append(source)
            continue

        # Parse ISO timestamp
        if isinstance(last, str):
            # Handle both with and without timezone
            last_str = last.replace("Z", "+00:00")
            try:
                last_dt = datetime.fromisoformat(last_str).replace(tzinfo=None)
            except ValueError:
                due.append(source)
                continue
        else:
            last_dt = last

        if (now - last_dt) > threshold:
            due.append(source)

    return due


def get_sources_by_cadence(cadence: str) -> list[dict]:
    """Fetch all active sources with a specific crawl_frequency."""
    client = get_client()
    result = (
        client.table("sources")
        .select("*")
        .eq("is_active", True)
        .eq("crawl_frequency", cadence)
        .execute()
    )
    return result.data or []


def detect_zero_event_sources() -> tuple[int, list[str]]:
    """Detect and auto-deactivate sources with persistent zero-event crawls.

    Checks sources where expected_event_count > 5. If the last 3 successful
    crawls all returned 0 events_found, deactivates the source and tags it.

    Returns:
        Tuple of (count_deactivated, list_of_slugs)
    """
    client = get_client()

    # Get sources with meaningful expected_event_count
    result = (
        client.table("sources")
        .select("id, slug, expected_event_count, health_tags")
        .eq("is_active", True)
        .gt("expected_event_count", 5)
        .execute()
    )
    candidates = result.data or []

    deactivated_slugs = []

    for source in candidates:
        # Get last 3 successful crawl logs
        logs = (
            client.table("crawl_logs")
            .select("events_found")
            .eq("source_id", source["id"])
            .eq("status", "success")
            .order("completed_at", desc=True)
            .limit(3)
            .execute()
        )
        log_data = logs.data or []

        if len(log_data) < 3:
            continue

        # Check if all 3 returned 0 events
        if all(log.get("events_found", 0) == 0 for log in log_data):
            # Auto-deactivate
            existing_tags = source.get("health_tags") or []
            if "zero-events-deactivated" not in existing_tags:
                existing_tags.append("zero-events-deactivated")

            client.table("sources").update({
                "is_active": False,
                "health_tags": existing_tags,
            }).eq("id", source["id"]).execute()

            deactivated_slugs.append(source["slug"])
            logger.warning(
                f"Auto-deactivated source '{source['slug']}': "
                f"3 consecutive zero-event crawls (expected ~{source['expected_event_count']})"
            )

    return len(deactivated_slugs), deactivated_slugs
