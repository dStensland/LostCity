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

_JUNK_TITLE_RE = re.compile(
    r"^(view\s+fullsize|download\s+(press|release|pdf|image|file|brochure)|click\s+here|read\s+more|learn\s+more)",
    re.IGNORECASE,
)


def _generate_exhibition_slug(venue_name: str, title: str) -> str:
    """Generate a URL-safe slug: '{venue}-{title}', max 80 chars."""
    raw = f"{venue_name}-{title}".lower()
    slug = _SLUG_RE.sub("-", raw).strip("-")
    return slug[:80]


def generate_exhibition_hash(title: str, venue_id: int, opening_date: Optional[str]) -> str:
    """MD5 hash on (title, venue_id, opening_date) for dedup."""
    normalized_title = re.sub(r"\s+", " ", title.strip().lower())
    key = f"{normalized_title}|{venue_id}|{opening_date or ''}"
    return hashlib.md5(key.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Dedup lookup
# ---------------------------------------------------------------------------


def find_exhibition_by_hash(content_hash: str) -> Optional[dict]:
    """Look up an exhibition by its content hash (stored in metadata.content_hash)."""
    client = get_client()
    result = (
        client.table("exhibitions")
        .select("id, title, place_id, opening_date, updated_at")
        .eq("metadata->>content_hash", content_hash)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


def find_exhibition_by_title_venue(title: str, venue_id: int) -> Optional[dict]:
    """Fallback dedup: find exhibition by normalized title + venue_id.

    Used when hash-based lookup misses (e.g., same exhibition from different
    sources with different opening_date values).
    """
    normalized = re.sub(r"\s+", " ", title.strip().lower())
    client = get_client()
    result = (
        client.table("exhibitions")
        .select("id, title, place_id, opening_date, updated_at")
        .eq("place_id", venue_id)
        .ilike("title", normalized)
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
    "slug", "place_id", "source_id", "portal_id", "title", "description",
    "image_url", "opening_date", "closing_date", "medium", "exhibition_type",
    "admission_type", "admission_url", "source_url", "tags", "is_active",
    "metadata", "related_feature_id", "operating_schedule",
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

    if _JUNK_TITLE_RE.match(title):
        logger.debug("Skipping exhibition with junk title: %r", title)
        return None

    # Normalize venue_id → place_id (Deploy 10: exhibitions.venue_id renamed)
    if "venue_id" in exhibition_data and "place_id" not in exhibition_data:
        exhibition_data["place_id"] = exhibition_data.pop("venue_id")
    elif "venue_id" in exhibition_data:
        exhibition_data.pop("venue_id")

    venue_id = exhibition_data.get("place_id")
    if not venue_id:
        logger.warning("Skipping exhibition %r — no place_id", title)
        return None

    # Default exhibition_type if not provided
    if not exhibition_data.get("exhibition_type"):
        exhibition_data["exhibition_type"] = "group"

    # Generate content hash for dedup
    opening_date = exhibition_data.get("opening_date")
    content_hash = generate_exhibition_hash(title, venue_id, opening_date)

    # Hash-based dedup (fast path)
    existing = find_exhibition_by_hash(content_hash)
    if existing:
        logger.debug("Exhibition %r already exists (hash match, id=%s), updating", title, existing["id"])
        update_exhibition(existing["id"], exhibition_data, artists=artists)
        return existing["id"]

    # Title+venue fallback (catches cross-source duplicates with different dates)
    existing = find_exhibition_by_title_venue(title, venue_id)
    if existing:
        logger.debug("Exhibition %r already exists (title+venue match, id=%s), updating", title, existing["id"])
        update_exhibition(existing["id"], exhibition_data, artists=artists)
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

    from artists import get_or_create_artist, normalize_artist_name

    payload = []
    for artist in artists:
        name = (artist.get("artist_name") or "").strip()
        if not name:
            continue
        normalized_name = normalize_artist_name(name)
        if not normalized_name:
            continue
        row: dict = {
            "exhibition_id": exhibition_id,
            "artist_name": normalized_name,
            "artist_url": artist.get("artist_url"),
            "role": artist.get("role", "artist"),
        }
        try:
            canonical = get_or_create_artist(normalized_name, discipline="visual_artist")
            row["artist_id"] = canonical["id"]
        except Exception as resolve_err:
            logger.debug(
                "Could not resolve artist %r to canonical record: %s", normalized_name, resolve_err
            )
        payload.append(row)

    if not payload:
        return

    try:
        client = get_client()
        client.table("exhibition_artists").upsert(
            payload, on_conflict="exhibition_id,artist_name"
        ).execute()
    except Exception as e:
        logger.warning("Failed to upsert exhibition_artists for %s: %s", exhibition_id, e)


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


def update_exhibition(exhibition_id: str, updates: dict, artists: Optional[list] = None) -> None:
    """Update an existing exhibition by ID, optionally re-linking artists."""
    if not writes_enabled():
        _log_write_skip(f"update exhibitions id={exhibition_id}")
        return

    filtered = {
        k: v for k, v in updates.items()
        if k in _EXHIBITION_COLUMNS and k not in ("slug", "metadata")
    }

    if "metadata" in updates and updates["metadata"]:
        filtered["metadata"] = updates["metadata"]

    if filtered:
        client = get_client()
        client.table("exhibitions").update(filtered).eq("id", exhibition_id).execute()
        logger.debug("Updated exhibition %s", exhibition_id)

    # Re-link artists if provided
    if artists:
        _upsert_exhibition_artists(exhibition_id, artists)
