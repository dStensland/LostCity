"""
Exhibition insert/update and dedup lookups for the exhibitions table.

Exhibitions are time-bounded art shows at gallery/museum venues. They sit
alongside events as a first-class entity for the Arts portal — events answer
"what's happening tonight" while exhibitions answer "what's showing this month."
"""

import hashlib
import logging
import re
from typing import Optional

from db.client import (
    get_client,
    retry_on_network_error,
    writes_enabled,
    _log_write_skip,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Slug + hash generation
# ---------------------------------------------------------------------------

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _generate_exhibition_slug(venue_name: str, title: str) -> str:
    """Generate a URL-safe slug: '{venue}-{title}', max 80 chars."""
    raw = f"{venue_name}-{title}".lower()
    slug = _SLUG_RE.sub("-", raw).strip("-")
    return slug[:80]


def generate_exhibition_hash(title: str, venue_id: int, opening_date: Optional[str]) -> str:
    """MD5 hash on (title, venue_id, opening_date) for dedup."""
    key = f"{title.strip().lower()}|{venue_id}|{opening_date or ''}"
    return hashlib.md5(key.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Dedup lookup
# ---------------------------------------------------------------------------


def find_exhibition_by_hash(content_hash: str) -> Optional[dict]:
    """Look up an exhibition by its content hash (stored in metadata.content_hash)."""
    client = get_client()
    result = (
        client.table("exhibitions")
        .select("id, title, venue_id, opening_date, updated_at")
        .eq("metadata->>content_hash", content_hash)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


# ---------------------------------------------------------------------------
# Insert
# ---------------------------------------------------------------------------

_EXHIBITION_COLUMNS = {
    "slug", "venue_id", "source_id", "portal_id", "title", "description",
    "image_url", "opening_date", "closing_date", "medium", "exhibition_type",
    "admission_type", "admission_url", "source_url", "tags", "is_active",
    "metadata",
}


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _insert_exhibition_record(client, data: dict):
    """Insert exhibition row with retries."""
    return client.table("exhibitions").insert(data).execute()


def insert_exhibition(exhibition_data: dict, artists: Optional[list] = None) -> Optional[str]:
    """
    Insert a new exhibition. Returns the exhibition UUID, or None on skip/failure.

    artists: list of dicts with keys: artist_name, artist_url (optional), role (optional)
    """
    title = exhibition_data.get("title", "").strip()
    if not title:
        logger.warning("Skipping exhibition with empty title")
        return None

    venue_id = exhibition_data.get("venue_id")
    if not venue_id:
        logger.warning("Skipping exhibition %r — no venue_id", title)
        return None

    # Generate content hash for dedup
    opening_date = exhibition_data.get("opening_date")
    content_hash = generate_exhibition_hash(title, venue_id, opening_date)

    # Dedup check
    existing = find_exhibition_by_hash(content_hash)
    if existing:
        logger.debug("Exhibition %r already exists (id=%s), updating", title, existing["id"])
        update_exhibition(existing["id"], exhibition_data)
        return existing["id"]

    # Generate slug if not provided
    if not exhibition_data.get("slug"):
        venue_name = exhibition_data.pop("_venue_name", "") or "gallery"
        exhibition_data["slug"] = _generate_exhibition_slug(venue_name, title)

    # Store content hash in metadata
    metadata = exhibition_data.get("metadata") or {}
    metadata["content_hash"] = content_hash
    exhibition_data["metadata"] = metadata

    # Filter to only valid columns
    filtered = {k: v for k, v in exhibition_data.items() if k in _EXHIBITION_COLUMNS}

    if not writes_enabled():
        _log_write_skip(f"insert exhibitions title={title[:60]}")
        return None

    try:
        result = _insert_exhibition_record(get_client(), filtered)
        exhibition_id = result.data[0]["id"]
        logger.debug("Inserted exhibition %r (id=%s)", title, exhibition_id)

        # Insert artists if provided
        if artists:
            _upsert_exhibition_artists(exhibition_id, artists)

        return exhibition_id
    except Exception as exc:
        error_str = str(exc).lower()
        if "exhibitions_slug_key" in error_str or "unique" in error_str:
            filtered["slug"] = f"{filtered['slug']}-{content_hash[:6]}"
            try:
                result = _insert_exhibition_record(get_client(), filtered)
                exhibition_id = result.data[0]["id"]
                if artists:
                    _upsert_exhibition_artists(exhibition_id, artists)
                return exhibition_id
            except Exception as exc2:
                logger.error("Failed to insert exhibition %r with slug fix: %s", title, exc2)
                return None
        logger.error("Failed to insert exhibition %r: %s", title, exc)
        return None


def _upsert_exhibition_artists(exhibition_id: str, artists: list) -> None:
    """Insert artist associations for an exhibition."""
    if not artists or not writes_enabled():
        return

    payload = []
    for artist in artists:
        name = (artist.get("artist_name") or "").strip()
        if not name:
            continue
        payload.append({
            "exhibition_id": exhibition_id,
            "artist_name": name,
            "artist_url": artist.get("artist_url"),
            "role": artist.get("role", "artist"),
        })

    if not payload:
        return

    try:
        client = get_client()
        client.table("exhibition_artists").upsert(
            payload, on_conflict="exhibition_id,artist_name"
        ).execute()
    except Exception as e:
        logger.debug("Failed to upsert exhibition_artists for %s: %s", exhibition_id, e)


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


def update_exhibition(exhibition_id: str, updates: dict) -> None:
    """Update an existing exhibition by ID."""
    if not writes_enabled():
        _log_write_skip(f"update exhibitions id={exhibition_id}")
        return

    filtered = {
        k: v for k, v in updates.items()
        if k in _EXHIBITION_COLUMNS and k not in ("slug", "metadata")
    }

    if "metadata" in updates and updates["metadata"]:
        filtered["metadata"] = updates["metadata"]

    if not filtered:
        return

    client = get_client()
    client.table("exhibitions").update(filtered).eq("id", exhibition_id).execute()
    logger.debug("Updated exhibition %s", exhibition_id)
