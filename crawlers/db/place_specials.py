"""
Shared writes for venue_specials (place specials).

Renamed from venue_specials.py. upsert_place_special is the canonical name;
upsert_venue_special is kept as a backward-compatible alias.

This gives typed crawler envelopes a real persistence path for time-sensitive
place offerings instead of advertising the lane and dropping it.
"""

import logging
from typing import Optional

from db.client import (
    _log_write_skip,
    get_client,
    retry_on_network_error,
    writes_enabled,
)

logger = logging.getLogger(__name__)

_VENUE_SPECIAL_COLUMNS = {
    "venue_id",
    "title",
    "type",
    "description",
    "days_of_week",
    "time_start",
    "time_end",
    "start_date",
    "end_date",
    "image_url",
    "price_note",
    "confidence",
    "source_url",
    "is_active",
    "last_verified_at",
}


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _select_existing_special(client, row: dict):
    query = (
        client.table("venue_specials")
        .select("id")
        .eq("venue_id", row["venue_id"])
        .eq("title", row["title"])
        .eq("type", row["type"])
    )

    if row.get("source_url"):
        query = query.eq("source_url", row["source_url"])
    else:
        query = query.is_("source_url", "null")

    if row.get("start_date"):
        query = query.eq("start_date", row["start_date"])
    else:
        query = query.is_("start_date", "null")

    if row.get("time_start"):
        query = query.eq("time_start", row["time_start"])
    else:
        query = query.is_("time_start", "null")

    return query.limit(1).execute()


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _insert_special_record(client, row: dict):
    return client.table("venue_specials").insert(row).execute()


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _update_special_record(client, special_id: int, row: dict):
    return client.table("venue_specials").update(row).eq("id", special_id).execute()


def upsert_place_special(venue_id: int, special_data: dict) -> Optional[int]:
    """Insert or update a place special matched by venue/title/type/source/date."""
    if not venue_id:
        logger.warning("upsert_place_special: missing venue_id")
        return None

    title = special_data.get("title")
    if not isinstance(title, str) or not title.strip():
        logger.warning("upsert_place_special: missing title for venue_id=%s", venue_id)
        return None

    row = {
        "venue_id": venue_id,
        **{
            key: value
            for key, value in special_data.items()
            if key in _VENUE_SPECIAL_COLUMNS and key != "venue_id"
        },
    }
    row["title"] = title.strip()
    row["type"] = row.get("type") or "daily_special"
    row["confidence"] = row.get("confidence") or "medium"
    if "is_active" not in row:
        row["is_active"] = True

    if not writes_enabled():
        _log_write_skip(f"upsert venue_specials venue_id={venue_id} title={row['title']}")
        return venue_id

    client = get_client()
    try:
        existing = _select_existing_special(client, row)
        existing_rows = getattr(existing, "data", None) or []
        if existing_rows:
            special_id = existing_rows[0]["id"]
            _update_special_record(client, special_id, row)
            return special_id

        _insert_special_record(client, row)
        return venue_id
    except Exception:
        logger.exception(
            "Failed to upsert place special for venue_id=%s title=%s",
            venue_id,
            row["title"],
        )
        return None


# ===== BACKWARD-COMPATIBLE ALIASES =====
# Remove in cleanup phase (Task 9+)
upsert_venue_special = upsert_place_special
