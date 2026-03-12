"""
Film metadata, music enrichment, and blurhash generation.
"""

import logging
from typing import Optional

from db.client import (
    get_client,
    writes_enabled,
    _BLURHASH_EXECUTOR,
)

logger = logging.getLogger(__name__)


def _compute_and_save_event_blurhash(event_id: int, image_url: str) -> None:
    """Best-effort async blurhash generation for newly inserted events."""
    if not writes_enabled():
        return
    try:
        from backfill_blurhash import compute_blurhash

        blurhash = compute_blurhash(image_url)
        if not blurhash:
            return

        client = get_client()
        client.table("events").update({"blurhash": blurhash}).eq(
            "id", event_id
        ).execute()
        logger.debug(f"Stored blurhash for event {event_id}")
    except Exception as e:
        logger.debug(f"Blurhash generation skipped for event {event_id}: {e}")


def _queue_event_blurhash(event_id: int, image_url: Optional[str]) -> None:
    """Queue background blurhash generation without blocking crawler writes."""
    if not image_url:
        return
    _BLURHASH_EXECUTOR.submit(_compute_and_save_event_blurhash, event_id, image_url)
