"""
Series matching and creation logic.
Identifies when events belong to the same series and manages series records.
"""

import re
import logging
from typing import Optional
from supabase import Client

logger = logging.getLogger(__name__)


def slugify(text: str) -> str:
    """Generate a URL-friendly slug from text."""
    slug = text.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def infer_festival_type(festival_name: str) -> Optional[str]:
    """Infer festival type from name."""
    if not festival_name:
        return None
    name = festival_name.lower()
    if re.search(r"\b(conference|summit|symposium|forum|congress)\b", name):
        return "conference"
    if re.search(r"\b(convention|expo|con)\b", name):
        return "convention"
    return None


def _ensure_festival_slug(client: Client, base_slug: str) -> str:
    """Ensure a unique festival slug."""
    slug = base_slug
    counter = 1
    while True:
        existing = client.table("festivals").select("id").eq("slug", slug).execute()
        if not existing.data:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


def create_festival(
    client: Client,
    festival_name: str,
    festival_type: Optional[str] = None,
    website: Optional[str] = None,
) -> str:
    """Create a new festival record and return its ID."""
    base_slug = slugify(festival_name)
    slug = _ensure_festival_slug(client, base_slug)
    festival_id = slug

    festival_data = {
        "id": festival_id,
        "name": festival_name,
        "slug": slug,
    }
    if festival_type:
        festival_data["festival_type"] = festival_type
    if website:
        festival_data["website"] = website

    result = client.table("festivals").insert(festival_data).execute()
    return result.data[0]["id"]


def resolve_festival_id(
    client: Client,
    festival_name: Optional[str],
    festival_type: Optional[str] = None,
    website: Optional[str] = None,
    create_if_missing: bool = False,
) -> Optional[str]:
    """Resolve a festival ID from a provided festival name or slug."""
    if not festival_name:
        return None

    inferred_type = festival_type or infer_festival_type(festival_name)

    def _maybe_update(existing: dict) -> None:
        updates = {}
        if inferred_type and not existing.get("festival_type"):
            updates["festival_type"] = inferred_type
        if website and not existing.get("website"):
            updates["website"] = website
        if updates:
            client.table("festivals").update(updates).eq("id", existing["id"]).execute()

    # Try exact slug match first (with and without slugify)
    for candidate in {festival_name, slugify(festival_name)}:
        if not candidate:
            continue
        result = client.table("festivals").select("id, festival_type, website").eq("slug", candidate).execute()
        if result.data:
            existing = result.data[0]
            _maybe_update(existing)
            return existing["id"]

    # Try exact name match (case-insensitive)
    result = client.table("festivals").select("id, festival_type, website").ilike("name", festival_name).execute()
    if result.data:
        existing = result.data[0]
        _maybe_update(existing)
        return existing["id"]

    # Try partial name match as a fallback
    result = client.table("festivals").select("id, festival_type, website").ilike("name", f"%{festival_name}%").execute()
    if result.data:
        existing = result.data[0]
        _maybe_update(existing)
        return existing["id"]

    if create_if_missing:
        return create_festival(client, festival_name, inferred_type, website=website)

    return None


def normalize_title(title: str) -> str:
    """Normalize a title for comparison."""
    # Remove common prefixes/suffixes
    title = title.lower().strip()
    # Remove year in parentheses
    title = re.sub(r'\s*\(\d{4}\)\s*', '', title)
    # Remove screening/showing qualifiers
    title = re.sub(r'\s*(screening|showing|presentation|special)\s*', '', title)
    # Remove "the" prefix
    title = re.sub(r'^the\s+', '', title)
    return title.strip()


def find_series_by_title(client: Client, title: str, series_type: str) -> Optional[dict]:
    """Find an existing series by title and type."""
    normalized = normalize_title(title)

    # Try exact match first
    result = client.table("series").select("*").eq("title", title).eq("series_type", series_type).execute()
    if result.data:
        return result.data[0]

    # Try normalized match via slug
    slug = slugify(normalized)
    result = client.table("series").select("*").eq("slug", slug).eq("series_type", series_type).execute()
    if result.data:
        return result.data[0]

    return None


def find_series_by_imdb(client: Client, imdb_id: str) -> Optional[dict]:
    """Find an existing series by IMDB ID."""
    result = client.table("series").select("*").eq("imdb_id", imdb_id).execute()
    if result.data:
        return result.data[0]
    return None


def create_series(client: Client, series_data: dict) -> dict:
    """Create a new series record."""
    # Ensure slug is unique
    base_slug = slugify(series_data.get("title", "untitled"))
    slug = base_slug
    counter = 1

    while True:
        existing = client.table("series").select("id").eq("slug", slug).execute()
        if not existing.data:
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    series_data["slug"] = slug

    result = client.table("series").insert(series_data).execute()
    logger.info(f"Created new series: {series_data.get('title')} ({series_data.get('series_type')})")
    return result.data[0]


def get_or_create_series(client: Client, series_hint: dict, category: str = None) -> Optional[str]:
    """
    Get an existing series or create a new one based on series hints.
    Returns series UUID if found/created, None otherwise.
    """
    if not series_hint:
        return None

    series_type = series_hint.get("series_type")
    series_title = series_hint.get("series_title")

    if not series_type or not series_title:
        return None

    # Resolve festival link if provided
    festival_id = series_hint.get("festival_id") or resolve_festival_id(
        client,
        series_hint.get("festival_name"),
        festival_type=series_hint.get("festival_type"),
        website=series_hint.get("festival_website"),
        create_if_missing=True,
    )

    # Check for existing series
    existing = find_series_by_title(client, series_title, series_type)
    if existing:
        # Backfill festival_id if missing
        if festival_id and not existing.get("festival_id"):
            client.table("series").update({"festival_id": festival_id}).eq("id", existing["id"]).execute()
        logger.debug(f"Found existing series: {series_title}")
        return existing["id"]

    # For films, check IMDB if available
    imdb_id = series_hint.get("imdb_id")
    if imdb_id:
        existing = find_series_by_imdb(client, imdb_id)
        if existing:
            return existing["id"]

    # Create new series
    series_data = {
        "title": series_title,
        "series_type": series_type,
        "category": category,
    }
    if festival_id:
        series_data["festival_id"] = festival_id

    # Add film-specific fields
    if series_type == "film":
        for field in ("director", "runtime_minutes", "year", "rating", "description", "image_url"):
            if series_hint.get(field):
                series_data[field] = series_hint[field]
        if imdb_id:
            series_data["imdb_id"] = imdb_id

    # Add recurring show / class series fields
    if series_type in ("recurring_show", "class_series"):
        for field in ("frequency", "day_of_week", "start_time", "description", "image_url"):
            if series_hint.get(field):
                series_data[field] = series_hint[field]

    # Add genres if provided
    if series_hint.get("genres"):
        series_data["genres"] = series_hint["genres"]

    new_series = create_series(client, series_data)
    return new_series["id"]


def update_series_metadata(client: Client, series_id: str, updates: dict) -> bool:
    """
    Update a series record, only setting fields that are currently NULL.
    Used to backfill OMDB metadata on existing series without overwriting
    curator-provided values.

    Args:
        client: Supabase client
        series_id: Series UUID
        updates: Dict of field -> value to set (only if currently NULL)

    Returns:
        True if any fields were updated
    """
    if not updates:
        return False

    # Fetch existing series
    result = client.table("series").select("*").eq("id", series_id).execute()
    if not result.data:
        return False

    existing = result.data[0]

    # Only update fields that are currently NULL
    fields_to_set = {}
    for key, value in updates.items():
        if value is not None and existing.get(key) is None:
            fields_to_set[key] = value

    if not fields_to_set:
        return False

    client.table("series").update(fields_to_set).eq("id", series_id).execute()
    logger.info(f"Backfilled series {existing.get('title', series_id)}: {list(fields_to_set.keys())}")
    return True


def link_event_to_series(client: Client, event_id: int, series_id: str) -> None:
    """Link an event to a series."""
    client.table("events").update({"series_id": series_id}).eq("id", event_id).execute()
    logger.debug(f"Linked event {event_id} to series {series_id}")


def process_event_series(client: Client, event_id: int, series_hint: dict, category: str = None) -> Optional[str]:
    """
    Process series association for an event.
    Returns series_id if event was linked to a series.
    """
    series_id = get_or_create_series(client, series_hint, category)
    if series_id:
        link_event_to_series(client, event_id, series_id)
    return series_id


def get_series_events(client: Client, series_id: str, future_only: bool = True) -> list[dict]:
    """Get all events for a series."""
    query = client.table("events").select("*, venues(*)").eq("series_id", series_id)

    if future_only:
        from datetime import date
        query = query.gte("start_date", date.today().isoformat())

    result = query.order("start_date", "start_time").execute()
    return result.data or []


def get_series_by_slug(client: Client, slug: str) -> Optional[dict]:
    """Get a series by its slug."""
    result = client.table("series").select("*").eq("slug", slug).single().execute()
    return result.data


def get_active_series(
    client: Client,
    series_type: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50
) -> list[dict]:
    """Get active series with upcoming events."""
    query = client.table("series").select("*").eq("is_active", True)

    if series_type:
        query = query.eq("series_type", series_type)
    if category:
        query = query.eq("category", category)

    result = query.limit(limit).execute()
    return result.data or []
