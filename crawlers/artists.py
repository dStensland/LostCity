"""
Canonical artist resolution, persistence, and enrichment via MusicBrainz/Wikidata.

The `artists` table stores one record per real-world artist (musician, comedian,
visual artist, etc.).  `event_artists` rows link to it via `artist_id`.

Key functions:
- slugify_artist(name)           — deterministic slug for dedup
- get_or_create_artist(name)     — find by slug or create
- enrich_artist()                — backfill image/genres/musicbrainz_id
- resolve_and_link_event_artists — wire event_artists → artists FK
"""

from __future__ import annotations

import re
import logging
from typing import Optional

from artist_images import fetch_artist_info

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Slug helpers
# ---------------------------------------------------------------------------

_SLUG_STRIP_RE = re.compile(r"[^a-z0-9\s-]")
_SLUG_SPACE_RE = re.compile(r"[\s]+")


def slugify_artist(name: str) -> str:
    """Deterministic slug: 'The Black Keys' → 'the-black-keys'."""
    s = name.lower().strip()
    s = _SLUG_STRIP_RE.sub("", s)
    s = _SLUG_SPACE_RE.sub("-", s).strip("-")
    return s


# ---------------------------------------------------------------------------
# Core CRUD
# ---------------------------------------------------------------------------

def get_or_create_artist(
    name: str,
    discipline: str = "musician",
) -> dict:
    """Find artist by slug or create a new record.

    Returns the full artist row dict (id, name, slug, ...).
    """
    from db import get_client

    slug = slugify_artist(name)
    if not slug:
        raise ValueError(f"Cannot slugify artist name: {name!r}")

    client = get_client()

    # Try to find existing
    result = client.table("artists").select("*").eq("slug", slug).execute()
    if result.data:
        return result.data[0]

    # Create new
    payload = {
        "name": name.strip(),
        "slug": slug,
        "discipline": discipline,
    }
    result = client.table("artists").insert(payload).execute()
    return result.data[0]


def get_artist_by_slug(slug: str) -> Optional[dict]:
    """Fetch an artist by slug."""
    from db import get_client

    client = get_client()
    result = client.table("artists").select("*").eq("slug", slug).execute()
    if result.data:
        return result.data[0]
    return None


# ---------------------------------------------------------------------------
# MusicBrainz / Wikidata enrichment
# ---------------------------------------------------------------------------

def enrich_artist(artist: dict) -> dict:
    """Enrich an artist record with MusicBrainz/Wikidata data (image, genres, IDs).

    Only fills NULL fields (backfill-safe).  Writes updates back to DB.
    Returns the (potentially updated) artist dict.
    """
    from db import get_client

    # Skip only when key enrichment fields are already populated.
    needs_enrichment = any(
        not artist.get(field)
        for field in ("musicbrainz_id", "wikidata_id", "spotify_id", "image_url", "genres", "bio", "website")
    )
    if not needs_enrichment:
        return artist

    info = fetch_artist_info(artist["name"])
    if not info:
        return artist

    updates: dict = {}
    if info.musicbrainz_id and not artist.get("musicbrainz_id"):
        updates["musicbrainz_id"] = info.musicbrainz_id
    if info.wikidata_id and not artist.get("wikidata_id"):
        updates["wikidata_id"] = info.wikidata_id
    if info.spotify_id and not artist.get("spotify_id"):
        updates["spotify_id"] = info.spotify_id
    if info.image_url and not artist.get("image_url"):
        updates["image_url"] = info.image_url
    if info.genres and not artist.get("genres"):
        updates["genres"] = info.genres
    if info.bio and not artist.get("bio"):
        updates["bio"] = info.bio
    if info.website and not artist.get("website"):
        updates["website"] = info.website
    if updates:
        from datetime import datetime, timezone
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        client = get_client()
        client.table("artists").update(updates).eq("id", artist["id"]).execute()
        artist.update(updates)

    return artist


def get_or_create_and_enrich(
    name: str,
    discipline: str = "musician",
) -> dict:
    """Combined: get/create canonical artist + MusicBrainz/Wikidata enrichment for musicians."""
    artist = get_or_create_artist(name, discipline=discipline)

    if discipline in ("musician", "band", "dj"):
        artist = enrich_artist(artist)

    return artist


# ---------------------------------------------------------------------------
# Linking event_artists → artists
# ---------------------------------------------------------------------------

def resolve_and_link_event_artists(event_id: int) -> None:
    """For each event_artist row on *event_id*, get/create canonical artist and set artist_id FK."""
    from db import get_client

    client = get_client()
    rows = (
        client.table("event_artists")
        .select("id, name, artist_id")
        .eq("event_id", event_id)
        .execute()
    ).data or []

    for row in rows:
        if row.get("artist_id"):
            continue  # Already linked

        try:
            artist = get_or_create_and_enrich(row["name"])
            client.table("event_artists").update(
                {"artist_id": artist["id"]}
            ).eq("id", row["id"]).execute()
        except Exception as e:
            logger.debug(f"Artist resolution failed for '{row['name']}': {e}")
