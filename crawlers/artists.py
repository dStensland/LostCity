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


_LAST_FIRST_RE = re.compile(r"^([\w][\w\-.]+),\s+(\w.+)$")


def normalize_artist_name(name: str) -> str:
    """Normalize an artist name for consistent matching.

    - Strips leading/trailing whitespace
    - Normalizes internal whitespace
    - Inverts 'Last, First' → 'First Last'
    """
    name = re.sub(r"\s+", " ", name.strip())
    if not name:
        return ""
    m = _LAST_FIRST_RE.match(name)
    if m:
        name = f"{m.group(2)} {m.group(1)}"
    return name


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

# Blocklist of known non-person strings
_ARTIST_BLOCKLIST = frozenset(s.lower() for s in [
    "ARTISTS", "Various Artists", "Group Exhibition", "TBD", "TBA",
    "Unknown", "Unknown Artist", "Anonymous", "N/A", "None",
    "Staff", "Volunteer", "View fullsize", "Read More",
])


def validate_artist_name(name: str) -> bool:
    """Check whether a string is a plausible artist name.

    Returns True if valid, False if it should be rejected.
    Rejects: blocklist matches, pipe chars, purely numeric,
    all-caps single words, too short (<3), too long (>200).
    """
    name = name.strip()

    # Length checks
    if len(name) < 3 or len(name) > 200:
        return False

    # Blocklist (case-insensitive)
    if name.lower() in _ARTIST_BLOCKLIST:
        return False

    # Pipe characters (concatenated lists)
    if "|" in name:
        return False

    # Purely numeric
    if name.isdigit():
        return False

    # All-caps single word (generic labels like "ARTISTS", "GALLERY")
    words = name.split()
    if len(words) == 1 and name.isupper():
        return False

    return True


# ---------------------------------------------------------------------------
# Core CRUD
# ---------------------------------------------------------------------------

def get_or_create_artist(
    name: str,
    discipline: str = "musician",
    extra_fields: dict | None = None,
) -> dict:
    """Find artist by slug or create a new record.

    extra_fields: optional dict merged into insert payload (e.g., bio, image_url, website).
    On the "get" path: updates null fields with extra_fields values (backfill-safe).
    Discipline collision: if existing record has discipline='musician' and caller
    passes 'visual_artist', overwrites — resolves slug collisions from event pipeline.

    Returns the full artist row dict (id, name, slug, ...).
    """
    from db import get_client

    if not validate_artist_name(name):
        raise ValueError(f"Invalid artist name rejected by validation: {name!r}")

    slug = slugify_artist(name)
    if not slug:
        raise ValueError(f"Cannot slugify artist name: {name!r}")

    client = get_client()

    # Try to find existing
    result = client.table("artists").select("*").eq("slug", slug).execute()
    if result.data:
        artist = result.data[0]
        updates: dict = {}

        # Discipline collision: musician → visual_artist upgrade
        if (
            artist.get("discipline") == "musician"
            and discipline == "visual_artist"
        ):
            updates["discipline"] = "visual_artist"

        # Backfill null fields from extra_fields
        if extra_fields:
            for key, value in extra_fields.items():
                if value and not artist.get(key):
                    updates[key] = value

        if updates:
            from datetime import datetime, timezone
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            client.table("artists").update(updates).eq("id", artist["id"]).execute()
            artist.update(updates)

        return artist

    # Create new
    payload = {
        "name": name.strip(),
        "slug": slug,
        "discipline": discipline,
    }
    if extra_fields:
        for key, value in extra_fields.items():
            if value:
                payload[key] = value

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

def _discipline_for_category(category: Optional[str]) -> str:
    normalized = (category or "").strip().lower()
    mapping = {
        "music": "musician",
        "nightlife": "musician",
        "comedy": "comedian",
        "theater": "actor",
        "dance": "actor",
        "film": "filmmaker",
        "art": "visual_artist",
        "learning": "speaker",
        "words": "speaker",
        "community": "speaker",
    }
    return mapping.get(normalized, "musician")


def resolve_and_link_event_artists(event_id: int, category: Optional[str] = None) -> None:
    """For each event_artist row on *event_id*, get/create canonical artist and set artist_id FK."""
    from db import get_client

    client = get_client()
    event_category = category
    if event_category is None:
        event_row = (
            client.table("events")
            .select("category_id")
            .eq("id", event_id)
            .maybe_single()
            .execute()
        ).data or {}
        event_category = event_row.get("category_id")

    if (event_category or "").strip().lower() == "sports":
        return

    discipline = _discipline_for_category(event_category)
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
            artist = get_or_create_and_enrich(row["name"], discipline=discipline)
            client.table("event_artists").update(
                {"artist_id": artist["id"]}
            ).eq("id", row["id"]).execute()
        except Exception as e:
            logger.warning(f"Artist resolution failed for '{row['name']}': {e}")
