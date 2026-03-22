"""
Enrichment worker: drains the async enrichment_queue table.

Processes TMDB/OMDb film metadata, Spotify music metadata, blurhash generation,
and series linking for events that were inserted without blocking the crawl path.

Usage:
    python3 enrichment_worker.py                    # single pass, batch-size 20
    python3 enrichment_worker.py --poll             # continuous polling loop
    python3 enrichment_worker.py --dry-run          # report depth, no writes
    python3 enrichment_worker.py --batch-size 50    # custom batch size
    python3 enrichment_worker.py --max-batches 10   # cap iterations
"""

import argparse
import logging
import time
import uuid
from typing import Any

import db.enrichment_queue as _queue
from db.client import get_client, writes_enabled

logger = logging.getLogger(__name__)

_WORKER_ID = str(uuid.uuid4())[:8]


# ---------------------------------------------------------------------------
# Individual handlers
# ---------------------------------------------------------------------------

def _handle_enrich_film(client: Any, entity_type: str, entity_id: str) -> None:
    """Fetch film metadata (OMDb/TMDB) for a film event and persist changed fields.

    Reuses the _step_enrich_film pipeline step from db.events by constructing a
    minimal event_data dict from the DB record and an InsertContext, running the
    step, then writing back only fields that changed.
    """
    from db.events import _step_enrich_film, InsertContext

    result = (
        client.table("events")
        .select("id, title, category_id, image_url, film_title, film_release_year, film_imdb_id")
        .eq("id", entity_id)
        .execute()
    )
    if not result.data:
        logger.warning("enrich_film: event %s not found", entity_id)
        return

    row = result.data[0]
    event_data = {
        "title": row.get("title", ""),
        "category": row.get("category_id", "film"),
        "image_url": row.get("image_url"),
        "film_title": row.get("film_title"),
        "film_release_year": row.get("film_release_year"),
        "film_imdb_id": row.get("film_imdb_id"),
    }

    ctx = InsertContext(client=client)
    try:
        updated = _step_enrich_film(event_data, ctx)
    except Exception as exc:
        raise RuntimeError(f"_step_enrich_film failed for event {entity_id}: {exc}") from exc

    # Persist only the fields the step may have populated.
    patch: dict[str, Any] = {}
    for field in ("image_url", "film_title", "film_release_year", "film_imdb_id",
                  "film_external_genres", "film_identity_source"):
        if updated.get(field) is not None and updated.get(field) != row.get(field):
            patch[field] = updated[field]

    # Genres live in a separate column on events.
    if ctx.genres and not row.get("genres"):
        patch["genres"] = ctx.genres

    if patch and writes_enabled():
        client.table("events").update(patch).eq("id", entity_id).execute()
        logger.info("enrich_film: updated event %s with %s", entity_id, list(patch.keys()))
    else:
        logger.debug("enrich_film: no new fields for event %s", entity_id)


def _handle_enrich_music(client: Any, entity_type: str, entity_id: str) -> None:
    """Fetch Spotify/Deezer music metadata for a music event and persist changed fields.

    Mirrors _handle_enrich_film but delegates to _step_enrich_music.
    """
    from db.events import _step_enrich_music, InsertContext

    result = (
        client.table("events")
        .select("id, title, category_id, image_url, genres")
        .eq("id", entity_id)
        .execute()
    )
    if not result.data:
        logger.warning("enrich_music: event %s not found", entity_id)
        return

    row = result.data[0]
    event_data = {
        "title": row.get("title", ""),
        "category": row.get("category_id", "music"),
        "image_url": row.get("image_url"),
    }

    ctx = InsertContext(client=client, genres=list(row.get("genres") or []))
    try:
        updated = _step_enrich_music(event_data, ctx)
    except Exception as exc:
        raise RuntimeError(f"_step_enrich_music failed for event {entity_id}: {exc}") from exc

    patch: dict[str, Any] = {}
    if updated.get("image_url") and not row.get("image_url"):
        patch["image_url"] = updated["image_url"]
    if ctx.genres and not row.get("genres"):
        patch["genres"] = ctx.genres

    if patch and writes_enabled():
        client.table("events").update(patch).eq("id", entity_id).execute()
        logger.info("enrich_music: updated event %s with %s", entity_id, list(patch.keys()))
    else:
        logger.debug("enrich_music: no new fields for event %s", entity_id)


def _handle_blurhash(client: Any, entity_type: str, entity_id: str) -> None:
    """Generate and store a blurhash for an event image if one is missing.

    Delegates to _compute_and_save_event_blurhash in db.enrichment so that the
    logic stays in one place.
    """
    from db.enrichment import _compute_and_save_event_blurhash

    result = (
        client.table("events")
        .select("id, image_url, blurhash")
        .eq("id", entity_id)
        .execute()
    )
    if not result.data:
        logger.warning("blurhash: event %s not found", entity_id)
        return

    row = result.data[0]
    if row.get("blurhash"):
        logger.debug("blurhash: event %s already has a blurhash — skipping", entity_id)
        return
    if not row.get("image_url"):
        logger.debug("blurhash: event %s has no image_url — skipping", entity_id)
        return

    _compute_and_save_event_blurhash(int(entity_id), row["image_url"])
    logger.debug("blurhash: queued generation for event %s", entity_id)


def _handle_series_linking(client: Any, entity_type: str, entity_id: str) -> None:
    """Attempt to link an event to a series if it is not already linked.

    Uses a simple title-based recurring_show series hint so that events that
    were inserted without a series_hint (e.g. from sources that don't pass one)
    can still be grouped after the fact.

    Only processes events that have is_recurring=True and no series_id.
    """
    from series import get_or_create_series

    result = (
        client.table("events")
        .select("id, title, category_id, venue_id, series_id, is_recurring")
        .eq("id", entity_id)
        .execute()
    )
    if not result.data:
        logger.warning("series_linking: event %s not found", entity_id)
        return

    row = result.data[0]
    if row.get("series_id"):
        logger.debug("series_linking: event %s already in series %s — skipping", entity_id, row["series_id"])
        return
    if not row.get("is_recurring"):
        logger.debug("series_linking: event %s is not recurring — skipping", entity_id)
        return

    title = row.get("title") or ""
    if not title:
        return

    series_hint = {
        "series_type": "recurring_show",
        "series_title": title,
        "frequency": "irregular",
    }
    if row.get("venue_id"):
        series_hint["venue_id"] = row["venue_id"]

    category = row.get("category_id")
    series_id = get_or_create_series(
        client,
        series_hint,
        category=category,
        venue_id=row.get("venue_id"),
    )
    if series_id and writes_enabled():
        client.table("events").update({"series_id": series_id}).eq("id", entity_id).execute()
        logger.info(
            "series_linking: linked event %s → series %s",
            entity_id, str(series_id)[:8],
        )


# ---------------------------------------------------------------------------
# Handler dispatch table
# ---------------------------------------------------------------------------

TASK_HANDLERS: dict[str, Any] = {
    "enrich_film": _handle_enrich_film,
    "enrich_music": _handle_enrich_music,
    "blurhash": _handle_blurhash,
    "series_linking": _handle_series_linking,
}


# ---------------------------------------------------------------------------
# Task processor
# ---------------------------------------------------------------------------

def process_task(client: Any, task: dict) -> None:
    """Dispatch a single enrichment task to its handler.

    Calls complete_task on success, fail_task on any exception (including
    unknown task_type).  Never raises — the caller can keep going.
    """
    task_id = task["id"]
    task_type = task.get("task_type", "")
    entity_type = task.get("entity_type", "event")
    entity_id = str(task.get("entity_id", ""))
    attempts = task.get("attempts", 0)

    handler = TASK_HANDLERS.get(task_type)
    if handler is None:
        error_msg = f"Unknown task_type: {task_type!r}"
        logger.warning("process_task: %s (task %s)", error_msg, task_id)
        _queue.fail_task(client, task_id, error_msg, attempts)
        return

    try:
        handler(client, entity_type, entity_id)
        _queue.complete_task(client, task_id)
        logger.debug("process_task: completed %s for %s/%s", task_type, entity_type, entity_id)
    except Exception as exc:
        error_str = str(exc)
        logger.warning(
            "process_task: handler %s failed for %s/%s — %s",
            task_type, entity_type, entity_id, error_str,
        )
        _queue.fail_task(client, task_id, error_str, attempts)


# ---------------------------------------------------------------------------
# Worker loop
# ---------------------------------------------------------------------------

def run_worker(
    client: Any,
    batch_size: int = 20,
    max_batches: int = 0,
    dry_run: bool = False,
) -> dict:
    """Drain the enrichment queue.

    Args:
        client:      Supabase client instance.
        batch_size:  Number of tasks claimed per iteration.
        max_batches: Stop after this many batches (0 = unlimited).
        dry_run:     Log queue depth and exit without processing anything.

    Returns a summary dict with processed/failed/skipped counts.
    """
    depth = _queue.get_queue_depth(client)
    logger.info("Enrichment queue depth: %s", depth)

    if dry_run:
        logger.info("dry-run mode — no tasks will be processed")
        return {"processed": 0, "failed": 0, "skipped": 0, "dry_run": True}

    processed = 0
    failed = 0
    batch_num = 0

    while True:
        if max_batches and batch_num >= max_batches:
            logger.info("Reached max_batches=%d — stopping", max_batches)
            break

        tasks = _queue.claim_tasks(client, _WORKER_ID, limit=batch_size)
        if not tasks:
            logger.info("Queue empty — worker done (batches=%d)", batch_num)
            break

        batch_num += 1
        logger.info("Batch %d: claimed %d tasks", batch_num, len(tasks))

        for task in tasks:
            task_id = task.get("id")
            task_type = task.get("task_type", "?")
            try:
                process_task(client, task)
                processed += 1
            except Exception as exc:
                # process_task shouldn't raise, but be defensive.
                logger.error(
                    "Unexpected error in process_task for task %s (%s): %s",
                    task_id, task_type, exc,
                )
                failed += 1

    summary = {"processed": processed, "failed": failed, "skipped": 0}
    logger.info("Worker finished: %s", summary)
    return summary


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Enrichment worker: drains the async enrichment_queue.",
    )
    parser.add_argument(
        "--poll",
        action="store_true",
        help="Keep polling the queue on an interval until interrupted.",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=60,
        metavar="SECONDS",
        help="Seconds to wait between poll cycles (default: 60).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=20,
        metavar="N",
        help="Tasks claimed per batch (default: 20).",
    )
    parser.add_argument(
        "--max-batches",
        type=int,
        default=0,
        metavar="N",
        help="Stop after N batches per cycle; 0 = unlimited (default: 0).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report queue depth and exit without processing tasks.",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=("DEBUG", "INFO", "WARNING", "ERROR"),
        help="Logging verbosity (default: INFO).",
    )
    return parser


def main() -> None:
    parser = _build_arg_parser()
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    client = get_client()

    if args.poll:
        logger.info(
            "Polling mode: batch_size=%d interval=%ds", args.batch_size, args.interval
        )
        try:
            while True:
                run_worker(
                    client,
                    batch_size=args.batch_size,
                    max_batches=args.max_batches,
                    dry_run=args.dry_run,
                )
                if not args.dry_run:
                    logger.info("Sleeping %ds before next poll…", args.interval)
                    time.sleep(args.interval)
                else:
                    break  # dry-run: single pass is enough
        except KeyboardInterrupt:
            logger.info("Worker interrupted — exiting.")
    else:
        run_worker(
            client,
            batch_size=args.batch_size,
            max_batches=args.max_batches,
            dry_run=args.dry_run,
        )


if __name__ == "__main__":
    main()
