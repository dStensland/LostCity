"""
Database operations for Lost City crawlers.
Handles all Supabase interactions for events, venues, sources, and logs.
"""

import re
import time
import logging
import functools
from datetime import datetime
from typing import Optional
from supabase import create_client, Client
from config import get_config
from tag_inference import infer_tags, infer_is_class
from description_fetcher import generate_synthetic_description
from series import get_or_create_series, update_series_metadata
from posters import get_metadata_for_film_event
from artist_images import get_info_for_music_event

logger = logging.getLogger(__name__)

_client: Optional[Client] = None


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
                    if e.errno in (35, 11) or "Resource temporarily unavailable" in str(e):
                        last_error = e
                        delay = base_delay * (2 ** attempt)  # Exponential backoff
                        logger.debug(f"Network error in {func.__name__}, retrying in {delay}s (attempt {attempt + 1}/{max_retries})")
                        time.sleep(delay)
                    else:
                        raise
                except Exception as e:
                    error_str = str(e)
                    if "Resource temporarily unavailable" in error_str or "Connection reset" in error_str:
                        last_error = e
                        delay = base_delay * (2 ** attempt)
                        logger.debug(f"Network error in {func.__name__}, retrying in {delay}s (attempt {attempt + 1}/{max_retries})")
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
    result = client.table("venues").select("id").eq("slug", VIRTUAL_VENUE_SLUG).execute()
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
            cfg.database.supabase_url,
            cfg.database.supabase_service_key
        )
    return _client


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


# Hardcoded source slug to producer_id mapping
# TODO: Move to sources table when migration 025 is applied
_SOURCE_PRODUCER_MAP = {
    'atlanta-film-society': 'atlanta-film-society',
    'out-on-film': 'out-on-film',
    'ajff': 'atlanta-jewish-film',
    'atlanta-opera': 'atlanta-opera',
    'atlanta-ballet': 'atlanta-ballet',
    'atlanta-pride': 'atlanta-pride',
    'beltline': 'atlanta-beltline-inc',
    'atlanta-contemporary': 'atlanta-contemporary',
    'callanwolde': 'callanwolde',
    'atlanta-track-club': 'atlanta-track-club',
    'arts-atl': 'artsatl',
    'atlanta-cultural-affairs': 'atlanta-cultural-affairs',
    'community-foundation-atl': 'community-foundation-atl',
    'high-museum': 'woodruff-arts',
    'decatur-arts-festival': 'decatur-arts',
    'taste-of-atlanta': 'taste-of-atlanta',
}


def get_producer_id_for_source(source_id: int) -> Optional[str]:
    """Get the producer_id associated with a source, if any."""
    client = get_client()

    # Get source slug to look up in mapping
    try:
        result = client.table("sources").select("slug").eq("id", source_id).execute()
        if result.data and len(result.data) > 0:
            slug = result.data[0].get("slug")
            if slug:
                return _SOURCE_PRODUCER_MAP.get(slug)
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

    # Try to find by name
    name = venue_data.get("name")
    if name:
        result = client.table("venues").select("id").eq("name", name).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]["id"]

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


def get_venue_by_slug(slug: str) -> Optional[dict]:
    """Fetch a venue by its slug."""
    client = get_client()
    result = client.table("venues").select("*").eq("slug", slug).execute()
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


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
        "learn more", "host an event", "upcoming events", "see details",
        "buy tickets", "click here", "read more", "view all", "sign up",
        "subscribe", "follow us", "contact us", "more info", "register",
        "rsvp", "get tickets", "see more", "shows", "about us",
        "skip to content", "google calendar", "event calendar",
        "events list view", "upcoming shows", "all dates", "all events",
        "all locations", "event type", "event location", "this month",
        "select date.", "sold out", "our calendar of shows and events",
        "corporate partnerships", "big futures", "match resources",
        # Placeholder/TBA titles
        "tba", "tbd", "tbc", "t.b.a.", "t.b.d.", "to be announced",
        "to be determined", "to be confirmed", "event tba", "event tbd",
        "show tba", "show tbd", "artist tba", "performer tba",
        "special event", "special event tba", "private event",
        "closed", "closed for private event", "n/a", "none",
        "book now", "buy now", "get tickets now", "reserve now",
        # Concession/promo items scraped as events
        "view fullsize", "more details", "gnashcash",
        "value pack hot dog & soda", "value pack hot dog and soda",
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
    if re.match(r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$", title, re.IGNORECASE):
        return False

    # Date-only titles ("Thursday, February 5")
    if re.match(r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
                r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}$",
                title, re.IGNORECASE):
        return False

    # Month-label titles ("January Activities", "January 2026")
    if re.match(r"^(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
                r"(Activities|Events|Calendar|Schedule|Programs|Classes|\d{4})$", title, re.IGNORECASE):
        return False

    # Titles starting with description-like patterns
    desc_starts = [
        "every monday", "every tuesday", "every wednesday", "every thursday",
        "every friday", "every saturday", "every sunday",
        "join us for \"navigating", "registration for this free event",
        "keep your pet happy", "come join the tipsy",
        "viewing 1-", "click here to download",
    ]
    title_lower = title.lower()
    for pattern in desc_starts:
        if title_lower.startswith(pattern):
            return False

    return True


def insert_event(event_data: dict, series_hint: dict = None, genres: list = None) -> int:
    """Insert a new event with inferred tags, series linking, and genres. Returns event ID."""
    client = get_client()

    # Validate title before inserting
    title = event_data.get("title", "")
    if not validate_event_title(title):
        logger.warning(f"Rejected bad title: \"{title[:80]}\"")
        raise ValueError(f"Invalid event title: \"{title[:50]}\"")

    # Remove producer_id if present (not a database column)
    if "producer_id" in event_data:
        event_data.pop("producer_id")

    # Remove is_class if present (not a database column - used only for tag inference)
    is_class_flag = event_data.pop("is_class", None)

    # Get venue info for tag inheritance
    venue_vibes = []
    venue_type = None
    if event_data.get("venue_id"):
        venue = get_venue_by_id(event_data["venue_id"])
        if venue:
            venue_vibes = venue.get("vibes") or []
            venue_type = venue.get("venue_type")

    # Auto-fetch movie metadata (poster, director, runtime, etc.) for film events
    film_metadata = None
    if event_data.get("category") == "film":
        film_metadata = get_metadata_for_film_event(
            event_data.get("title", ""),
            event_data.get("image_url")
        )
        if film_metadata and not event_data.get("image_url"):
            event_data["image_url"] = film_metadata.poster_url

    # Auto-fetch artist image and genres for music events
    if event_data.get("category") == "music":
        music_info = get_info_for_music_event(
            event_data.get("title", ""),
            event_data.get("image_url"),
            genres  # Pass existing genres if any
        )
        if music_info.image_url and not event_data.get("image_url"):
            event_data["image_url"] = music_info.image_url
        # Use fetched genres if none provided
        if music_info.genres and not genres:
            genres = music_info.genres

    # Auto-infer is_class if not explicitly set
    if not is_class_flag:
        source_slug = None
        if event_data.get("source_id"):
            try:
                src = client.table("sources").select("slug").eq("id", event_data["source_id"]).execute()
                if src.data and src.data[0].get("slug"):
                    source_slug = src.data[0]["slug"]
            except Exception:
                pass
        if infer_is_class(event_data, source_slug=source_slug, venue_type=venue_type):
            is_class_flag = True

    # Infer and merge tags
    event_data["tags"] = infer_tags(event_data, venue_vibes, venue_type=venue_type)

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

    # Process series association if hint provided
    if series_hint:
        series_id = get_or_create_series(client, series_hint, event_data.get("category"))
        if series_id:
            event_data["series_id"] = series_id
            # Don't store genres on event if it has a series (genres live on series)
            genres = None
            # Backfill NULL fields on existing series with OMDB metadata
            if film_metadata and series_hint.get("series_type") == "film":
                update_series_metadata(client, series_id, {
                    "director": film_metadata.director,
                    "runtime_minutes": film_metadata.runtime_minutes,
                    "year": film_metadata.year,
                    "rating": film_metadata.rating,
                    "imdb_id": film_metadata.imdb_id,
                    "genres": film_metadata.genres,
                    "description": film_metadata.plot,
                    "image_url": film_metadata.poster_url,
                })

    # Add genres for standalone events (events without a series)
    if genres and not event_data.get("series_id"):
        event_data["genres"] = genres

    # Backfill description from film metadata (covers Tara, Aurora, Plaza, etc.)
    if not event_data.get("description") and film_metadata and film_metadata.plot:
        event_data["description"] = film_metadata.plot[:500]

    # Last-resort: generate synthetic description so no event is inserted with NULL
    if not event_data.get("description"):
        venue_name = None
        if event_data.get("venue_id"):
            v = get_venue_by_id(event_data["venue_id"])
            if v:
                venue_name = v.get("name")
        event_data["description"] = generate_synthetic_description(
            event_data.get("title", ""),
            venue_name=venue_name,
            category=event_data.get("category"),
        )

    # Inherit portal_id from source if not explicitly set
    if not event_data.get("portal_id") and event_data.get("source_id"):
        source = client.table("sources").select("owner_portal_id").eq("id", event_data["source_id"]).execute()
        if source.data and source.data[0].get("owner_portal_id"):
            event_data["portal_id"] = source.data[0]["owner_portal_id"]

    result = client.table("events").insert(event_data).execute()
    return result.data[0]["id"]


def update_event(event_id: int, event_data: dict) -> None:
    """Update an existing event."""
    client = get_client()
    client.table("events").update(event_data).eq("id", event_id).execute()


@retry_on_network_error(max_retries=3, base_delay=0.5)
def find_event_by_hash(content_hash: str) -> Optional[dict]:
    """Find event by content hash for deduplication."""
    client = get_client()
    result = client.table("events").select("*").eq("content_hash", content_hash).execute()
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
    result = client.table("events").select("id,content_hash").eq(
        "source_id", source_id
    ).gte("start_date", today).execute()

    if not result.data:
        return 0

    # Find events whose hash wasn't seen in this crawl
    stale_ids = [
        e["id"] for e in result.data
        if e["content_hash"] not in current_hashes
    ]

    if not stale_ids:
        return 0

    # Clear canonical references pointing to stale events
    for stale_id in stale_ids:
        client.table("events").update(
            {"canonical_event_id": None}
        ).eq("canonical_event_id", stale_id).execute()

    # Delete in batches
    deleted = 0
    batch_size = 50
    for i in range(0, len(stale_ids), batch_size):
        batch = stale_ids[i:i + batch_size]
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
        result = client.table("venues").select("id").ilike("name", "%masquerade%").execute()
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
    for event in (result.data or []):
        event["venue_name"] = event.get("venue", {}).get("name", "")
        events.append(event)

    return events


def create_crawl_log(source_id: int) -> int:
    """Create a new crawl log entry. Returns log ID."""
    client = get_client()
    result = client.table("crawl_logs").insert({
        "source_id": source_id,
        "started_at": datetime.utcnow().isoformat(),
        "status": "running"
    }).execute()
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
    error_message: Optional[str] = None
) -> None:
    """Update crawl log with results."""
    client = get_client()
    client.table("crawl_logs").update({
        "completed_at": datetime.utcnow().isoformat(),
        "status": status,
        "events_found": events_found,
        "events_new": events_new,
        "events_updated": events_updated,
        "error_message": error_message
    }).eq("id", log_id).execute()


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


def update_source_health_tags(source_id: int, health_tags: list[str], active_months: Optional[list[int]] = None) -> bool:
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
        result = client.table("sources").select("health_tags, active_months").eq("id", source_id).execute()
        if result.data and len(result.data) > 0:
            return (
                result.data[0].get("health_tags") or [],
                result.data[0].get("active_months")
            )
    except Exception:
        pass
    return [], None
