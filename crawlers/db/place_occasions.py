"""
Shared writes for place_occasions.

Renamed from venue_occasions.py (Task 8 — places refactor).
Preserves source-protection semantics: manual and editorial rows are
authoritative, inferred rows can refresh their confidence when the signal
materially changes.
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

_PLACE_OCCASION_COLUMNS = {
    "place_id",
    "occasion",
    "confidence",
    "source",
}


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _select_existing_occasion(client, venue_id: int, occasion: str):
    return (
        client.table("place_occasions")
        .select("id, source, confidence")
        .eq("place_id", venue_id)
        .eq("occasion", occasion)
        .limit(1)
        .execute()
    )


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _insert_occasion_record(client, row: dict):
    return client.table("place_occasions").insert(row).execute()


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _update_occasion_record(client, occasion_id: int, updates: dict):
    return client.table("place_occasions").update(updates).eq("id", occasion_id).execute()


def upsert_place_occasion(venue_id: int, occasion_data: dict) -> Optional[int]:
    """Insert or update a place occasion while respecting authoritative rows."""
    if not venue_id:
        logger.warning("upsert_place_occasion: missing place_id")
        return None

    occasion = occasion_data.get("occasion")
    if not isinstance(occasion, str) or not occasion.strip():
        logger.warning("upsert_place_occasion: missing occasion for venue_id=%s", venue_id)
        return None

    row = {
        "place_id": venue_id,
        **{
            key: value
            for key, value in occasion_data.items()
            if key in _PLACE_OCCASION_COLUMNS and key != "place_id"
        },
    }
    row["occasion"] = occasion.strip()
    row["source"] = row.get("source") or "editorial"
    row["confidence"] = float(row.get("confidence", 1.0))

    if not writes_enabled():
        _log_write_skip(
            f"upsert place_occasions place_id={venue_id} occasion={row['occasion']}"
        )
        return venue_id

    client = get_client()
    try:
        existing = _select_existing_occasion(client, venue_id, row["occasion"])
        existing_rows = getattr(existing, "data", None) or []
        if not existing_rows:
            _insert_occasion_record(client, row)
            return venue_id

        current = existing_rows[0]
        current_source = current.get("source")
        if current_source in ("manual", "editorial"):
            return current.get("id") if isinstance(current.get("id"), int) else venue_id

        current_confidence = float(current.get("confidence") or 0.0)
        if abs(current_confidence - row["confidence"]) < 0.01:
            return current.get("id") if isinstance(current.get("id"), int) else venue_id

        _update_occasion_record(
            client,
            current["id"],
            {
                "confidence": row["confidence"],
            },
        )
        return current["id"]
    except Exception:
        logger.exception(
            "Failed to upsert place occasion for venue_id=%s occasion=%s",
            venue_id,
            row["occasion"],
        )
        return None

