"""
Database operations for Lost City crawlers.
Handles all Supabase interactions for events, venues, sources, and logs.
"""

from datetime import datetime
from typing import Optional
from supabase import create_client, Client
from config import get_config
from tag_inference import infer_tags
from series import get_or_create_series


_client: Optional[Client] = None


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


def insert_event(event_data: dict, series_hint: dict = None, genres: list = None) -> int:
    """Insert a new event with inferred tags, series linking, and genres. Returns event ID."""
    client = get_client()

    # Auto-link producer_id from source if not already set
    if not event_data.get("producer_id") and event_data.get("source_id"):
        producer_id = get_producer_id_for_source(event_data["source_id"])
        if producer_id:
            event_data["producer_id"] = producer_id

    # Get venue vibes for tag inheritance
    venue_vibes = []
    if event_data.get("venue_id"):
        venue = get_venue_by_id(event_data["venue_id"])
        if venue:
            venue_vibes = venue.get("vibes") or []

    # Infer and merge tags
    event_data["tags"] = infer_tags(event_data, venue_vibes)

    # Process series association if hint provided
    if series_hint:
        series_id = get_or_create_series(client, series_hint, event_data.get("category"))
        if series_id:
            event_data["series_id"] = series_id
            # Don't store genres on event if it has a series (genres live on series)
            genres = None

    # Add genres for standalone events (events without a series)
    if genres and not event_data.get("series_id"):
        event_data["genres"] = genres

    result = client.table("events").insert(event_data).execute()
    return result.data[0]["id"]


def update_event(event_id: int, event_data: dict) -> None:
    """Update an existing event."""
    client = get_client()
    client.table("events").update(event_data).eq("id", event_id).execute()


def find_event_by_hash(content_hash: str) -> Optional[dict]:
    """Find event by content hash for deduplication."""
    client = get_client()
    result = client.table("events").select("*").eq("content_hash", content_hash).execute()
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


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
