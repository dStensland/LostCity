"""
Extraction cache — skip LLM calls when HTML content is unchanged.

Results are keyed on (source_slug, content_hash). A cache hit means the
source page content is byte-for-byte identical to a previous successful run,
so the LLM extraction result can be reused without another API call.
"""
import hashlib
import logging
from typing import Optional

from db.client import writes_enabled

logger = logging.getLogger(__name__)


def compute_content_hash(html: str) -> str:
    """Return an MD5 hex digest of the HTML string."""
    return hashlib.md5(html.encode("utf-8")).hexdigest()


def get_cached_extraction(client, source_slug: str, content_hash: str) -> Optional[list]:
    """Return cached extraction result, or None on miss."""
    try:
        result = (
            client.table("extraction_cache")
            .select("extraction_result")
            .eq("source_slug", source_slug)
            .eq("content_hash", content_hash)
            .maybeSingle()
            .execute()
        )
        if result.data:
            return result.data["extraction_result"]
    except Exception as e:
        logger.debug("Cache miss for %s: %s", source_slug, e)
    return None


def store_extraction(client, source_slug: str, content_hash: str, extraction_result: list) -> None:
    """Persist an extraction result. No-op in dry-run mode."""
    if not writes_enabled():
        return
    try:
        client.table("extraction_cache").upsert({
            "source_slug": source_slug,
            "content_hash": content_hash,
            "extraction_result": extraction_result,
        }).execute()
    except Exception as e:
        logger.warning("Failed to cache extraction for %s: %s", source_slug, e)
