#!/usr/bin/env python3
"""
Backfill events.image_width / image_height for all events that have an image_url
but are missing dimension data.

Requires the migration 20260413100004_add_image_dimensions.sql to have been applied
before running (adds image_width / image_height INTEGER columns).

Usage:
    python3 backfill_image_dims.py --dry-run --limit 20
    python3 backfill_image_dims.py --limit 5
    python3 backfill_image_dims.py --source atlantajcc
    python3 backfill_image_dims.py                          # full run

Flags:
    --dry-run         Probe URLs and print results, but don't write to DB.
    --limit N         Stop after processing N events (useful for testing).
    --source SLUG     Only process events from one source (join via sources table).
"""

import argparse
import logging
import signal
import sys
import time
from typing import Optional

from db.client import get_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Polite sleep between probes (seconds).
_PROBE_SLEEP = 0.15

# Batch size for DB pagination.
_BATCH_SIZE = 100

# How often to print a progress line.
_PROGRESS_EVERY = 100

# Graceful shutdown flag (set by SIGINT handler).
_SHUTDOWN = False


def _handle_sigint(signum, frame):
    global _SHUTDOWN
    logger.info("Caught Ctrl-C — finishing current batch then exiting.")
    _SHUTDOWN = True


def _count_target_events(client, source_slug: Optional[str]) -> int:
    """Return total count of events that need dimension backfill."""
    q = (
        client.table("events")
        .select("id", count="exact")
        .not_.is_("image_url", "null")
        .or_("image_width.is.null,image_height.is.null")
    )
    if source_slug:
        source_row = (
            client.table("sources")
            .select("id")
            .eq("slug", source_slug)
            .maybe_single()
            .execute()
        )
        if not source_row.data:
            logger.error("Source slug '%s' not found in sources table.", source_slug)
            sys.exit(1)
        q = q.eq("source_id", source_row.data["id"])

    result = q.execute()
    return result.count or 0


def _fetch_batch(client, offset: int, batch_size: int, source_id: Optional[int]) -> list:
    """Fetch one page of events that need backfill."""
    q = (
        client.table("events")
        .select("id, image_url")
        .not_.is_("image_url", "null")
        .or_("image_width.is.null,image_height.is.null")
        .order("id")
        .range(offset, offset + batch_size - 1)
    )
    if source_id is not None:
        q = q.eq("source_id", source_id)
    return q.execute().data or []


def backfill(*, dry_run: bool, limit: int, source_slug: Optional[str]) -> None:
    """Main backfill loop."""
    from image_dims import get_image_dimensions

    client = get_client()

    # Resolve source_id once if filtering by slug.
    source_id: Optional[int] = None
    if source_slug:
        # Use list select (not maybe_single) so 0-match returns empty list
        # rather than None — supabase-py raises 406 on maybe_single + 0 rows.
        rows = (
            client.table("sources")
            .select("id")
            .eq("slug", source_slug)
            .limit(1)
            .execute()
        )
        if not rows.data:
            logger.error("Source slug '%s' not found.", source_slug)
            sys.exit(1)
        source_id = rows.data[0]["id"]
        logger.info("Filtering to source '%s' (id=%s)", source_slug, source_id)

    total_target = _count_target_events(client, source_slug)
    effective = min(total_target, limit) if limit else total_target
    logger.info(
        "Events with image_url and missing dims: %d — will process: %d%s",
        total_target,
        effective,
        " (dry-run)" if dry_run else "",
    )

    stats = {"processed": 0, "success": 0, "skipped": 0, "failed": 0}
    start_time = time.time()
    offset = 0

    # URL → (w, h) cache across batches to avoid re-probing shared CDN images.
    url_cache: dict = {}

    try:
        while not _SHUTDOWN:
            if limit and stats["processed"] >= limit:
                break

            batch = _fetch_batch(client, offset, _BATCH_SIZE, source_id)
            if not batch:
                break

            for row in batch:
                if _SHUTDOWN:
                    break
                if limit and stats["processed"] >= limit:
                    break

                event_id = row["id"]
                url = row["image_url"]
                stats["processed"] += 1

                if url in url_cache:
                    w, h = url_cache[url]
                else:
                    w, h = get_image_dimensions(url)
                    url_cache[url] = (w, h)
                    time.sleep(_PROBE_SLEEP)

                if w is None or h is None:
                    logger.debug("  [%d] no dims — %s", event_id, url[:80])
                    stats["failed"] += 1
                else:
                    logger.debug("  [%d] %dx%d — %s", event_id, w, h, url[:80])
                    if dry_run:
                        stats["success"] += 1
                    else:
                        try:
                            client.table("events").update(
                                {"image_width": w, "image_height": h}
                            ).eq("id", event_id).execute()
                            stats["success"] += 1
                        except Exception as exc:
                            logger.warning(
                                "DB update failed for event %d: %s", event_id, exc
                            )
                            stats["failed"] += 1

                if stats["processed"] % _PROGRESS_EVERY == 0:
                    elapsed = time.time() - start_time
                    rate = stats["processed"] / elapsed if elapsed > 0 else 0
                    pct = (stats["processed"] / effective * 100) if effective else 0
                    logger.info(
                        "Progress: %d/%d (%.0f%%) — success=%d failed=%d — %.1f/s",
                        stats["processed"],
                        effective,
                        pct,
                        stats["success"],
                        stats["failed"],
                        rate,
                    )

            offset += _BATCH_SIZE
            if len(batch) < _BATCH_SIZE:
                break

    except KeyboardInterrupt:
        pass

    elapsed = time.time() - start_time
    logger.info(
        "Done in %.1fs — processed=%d success=%d failed=%d%s",
        elapsed,
        stats["processed"],
        stats["success"],
        stats["failed"],
        " [DRY RUN]" if dry_run else "",
    )


def main() -> None:
    signal.signal(signal.SIGINT, _handle_sigint)

    parser = argparse.ArgumentParser(
        description="Backfill image_width / image_height for events with image_url."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Probe images but do not write dimensions to the DB.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        metavar="N",
        help="Stop after processing N events (0 = no limit).",
    )
    parser.add_argument(
        "--source",
        default=None,
        metavar="SLUG",
        help="Only process events from this source slug (e.g. atlantajcc).",
    )
    args = parser.parse_args()

    backfill(dry_run=args.dry_run, limit=args.limit, source_slug=args.source)


if __name__ == "__main__":
    main()
