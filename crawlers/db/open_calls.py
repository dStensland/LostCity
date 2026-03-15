"""
Open call insert/update and dedup lookups for the open_calls table.

Open calls are deadline-driven opportunities for artists: submissions,
residencies, grants, commissions, and exhibition proposals. They're a
first-class entity for the Arts portal.
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


def _generate_open_call_slug(org_name: str, title: str) -> str:
    """Generate a URL-safe slug: '{org}-{title}', max 80 chars."""
    raw = f"{org_name}-{title}".lower()
    slug = _SLUG_RE.sub("-", raw).strip("-")
    return slug[:80]


def generate_open_call_hash(title: str, application_url: str) -> str:
    """MD5 hash on (title, application_url) for dedup."""
    key = f"{title.strip().lower()}|{application_url.strip()}"
    return hashlib.md5(key.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Dedup lookup
# ---------------------------------------------------------------------------


def find_open_call_by_hash(content_hash: str) -> Optional[dict]:
    """Look up an open call by its content hash (stored in metadata.content_hash)."""
    client = get_client()
    result = (
        client.table("open_calls")
        .select("id, title, deadline, updated_at")
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

_OPEN_CALL_COLUMNS = {
    "slug", "organization_id", "venue_id", "source_id", "portal_id", "title",
    "description", "deadline", "application_url", "fee", "eligibility",
    "medium_requirements", "call_type", "status", "source_url", "tags",
    "metadata", "is_active",
}


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _insert_open_call_record(client, data: dict):
    """Insert open_call row with retries."""
    return client.table("open_calls").insert(data).execute()


def insert_open_call(call_data: dict) -> Optional[str]:
    """
    Insert a new open call. Returns the UUID, or None on skip/failure.
    """
    title = call_data.get("title", "").strip()
    if not title:
        logger.warning("Skipping open call with empty title")
        return None

    application_url = call_data.get("application_url", "").strip()
    if not application_url:
        logger.warning("Skipping open call %r — no application_url", title)
        return None

    call_type = call_data.get("call_type")
    if not call_type:
        logger.warning("Skipping open call %r — no call_type", title)
        return None

    # Generate content hash for dedup
    content_hash = generate_open_call_hash(title, application_url)

    # Dedup check
    existing = find_open_call_by_hash(content_hash)
    if existing:
        logger.debug("Open call %r already exists (id=%s), updating", title, existing["id"])
        update_open_call(existing["id"], call_data)
        return existing["id"]

    # Generate slug if not provided
    if not call_data.get("slug"):
        org_name = call_data.pop("_org_name", "") or "call"
        call_data["slug"] = _generate_open_call_slug(org_name, title)

    # Store content hash in metadata
    metadata = call_data.get("metadata") or {}
    metadata["content_hash"] = content_hash
    call_data["metadata"] = metadata

    # Filter to only valid columns
    filtered = {k: v for k, v in call_data.items() if k in _OPEN_CALL_COLUMNS}

    # Defaults
    if "status" not in filtered:
        filtered["status"] = "open"

    if not writes_enabled():
        _log_write_skip(f"insert open_calls title={title[:60]}")
        return None

    try:
        result = _insert_open_call_record(get_client(), filtered)
        call_id = result.data[0]["id"]
        logger.debug("Inserted open call %r (id=%s)", title, call_id)
        return call_id
    except Exception as exc:
        error_str = str(exc).lower()
        if "open_calls_slug_key" in error_str or "unique" in error_str:
            filtered["slug"] = f"{filtered['slug']}-{content_hash[:6]}"
            try:
                result = _insert_open_call_record(get_client(), filtered)
                return result.data[0]["id"]
            except Exception as exc2:
                logger.error("Failed to insert open call %r with slug fix: %s", title, exc2)
                return None
        logger.error("Failed to insert open call %r: %s", title, exc)
        return None


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


def update_open_call(call_id: str, updates: dict) -> None:
    """Update an existing open call by ID."""
    if not writes_enabled():
        _log_write_skip(f"update open_calls id={call_id}")
        return

    filtered = {
        k: v for k, v in updates.items()
        if k in _OPEN_CALL_COLUMNS and k not in ("slug", "metadata")
    }

    if "metadata" in updates and updates["metadata"]:
        filtered["metadata"] = updates["metadata"]

    if not filtered:
        return

    client = get_client()
    client.table("open_calls").update(filtered).eq("id", call_id).execute()
    logger.debug("Updated open call %s", call_id)
