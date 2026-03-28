"""
Shared writes for editorial_mentions.

This makes venue-attached editorial signal available to typed crawler envelopes
instead of limiting it to the standalone editorial ingest pipeline.
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

_EDITORIAL_MENTION_COLUMNS = {
    "venue_id",
    "source_key",
    "article_url",
    "article_title",
    "mention_type",
    "published_at",
    "guide_name",
    "snippet",
    "is_active",
}


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _upsert_editorial_mention_record(client, row: dict):
    if row.get("place_id") is not None:
        return client.table("editorial_mentions").upsert(
            row,
            on_conflict="article_url,place_id",
        ).execute()

    return client.table("editorial_mentions").upsert(
        row,
        on_conflict="article_url",
    ).execute()


def upsert_editorial_mention(
    venue_id: Optional[int],
    mention_data: dict,
) -> Optional[int]:
    """Insert or update an editorial mention using the existing ingest keys."""
    article_url = mention_data.get("article_url")
    article_title = mention_data.get("article_title")
    source_key = mention_data.get("source_key")

    if not isinstance(article_url, str) or not article_url.strip():
        logger.warning("upsert_editorial_mention: missing article_url")
        return None
    if not isinstance(article_title, str) or not article_title.strip():
        logger.warning(
            "upsert_editorial_mention: missing article_title for article_url=%s",
            article_url,
        )
        return None
    if not isinstance(source_key, str) or not source_key.strip():
        logger.warning(
            "upsert_editorial_mention: missing source_key for article_url=%s",
            article_url,
        )
        return None

    row = {
        "place_id": venue_id,
        **{
            key: value
            for key, value in mention_data.items()
            if key in _EDITORIAL_MENTION_COLUMNS and key != "venue_id"
        },
    }
    row["article_url"] = article_url.strip()
    row["article_title"] = article_title.strip()
    row["source_key"] = source_key.strip()
    row["mention_type"] = row.get("mention_type") or "feature"
    if "is_active" not in row:
        row["is_active"] = True

    if not writes_enabled():
        _log_write_skip(
            f"upsert editorial_mentions article_url={row['article_url']}"
        )
        return venue_id if venue_id else 1

    try:
        result = _upsert_editorial_mention_record(get_client(), row)
        if result.data:
            inserted_id = result.data[0].get("id")
            if isinstance(inserted_id, int):
                return inserted_id
            return venue_id if venue_id else 1
    except Exception:
        logger.exception(
            "Failed to upsert editorial mention for article_url=%s venue_id=%s",
            row["article_url"],
            venue_id,
        )

    return None
