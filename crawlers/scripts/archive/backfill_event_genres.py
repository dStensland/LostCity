"""
One-time backfill script: re-infer genres on recurring events with empty genres.

Targets events where:
  - series_id IS NOT NULL (recurring events)
  - genres IS NULL or genres = '{}'  (empty array)

For each event, runs infer_genres() from tag_inference.py against the event's
title/description/category/tags, then updates the event row AND its series
if the result is non-empty.

Usage:
    cd crawlers/
    python backfill_event_genres.py [--dry-run] [--limit N]
"""

from __future__ import annotations

import argparse
import logging
import sys

from db import get_client
from tag_inference import infer_genres
from genre_normalize import normalize_genres

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

BATCH_SIZE = 500


def fetch_events_missing_genres(client, limit: int) -> list[dict]:
    """Fetch recurring events with NULL or empty genres."""
    query = (
        client.table("events")
        .select("id, title, description, category_id, tags, genres, series_id")
        .not_.is_("series_id", "null")
        .or_("genres.is.null,genres.eq.{}")
        .order("id")
        .limit(limit)
    )
    result = query.execute()
    return result.data or []


def backfill(dry_run: bool = False, limit: int = 5000) -> None:
    """Main backfill logic."""
    client = get_client()

    events = fetch_events_missing_genres(client, limit)
    logger.info(f"Found {len(events)} recurring events with empty genres")

    if not events:
        logger.info("Nothing to backfill.")
        return

    updated_count = 0
    skipped_count = 0
    series_updated: set[int] = set()

    for event in events:
        # Build a minimal event dict for infer_genres
        event_for_inference = {
            "title": event.get("title", ""),
            "description": event.get("description", ""),
            "category": event.get("category_id", ""),
            "tags": event.get("tags") or [],
            "genres": [],
        }

        inferred = normalize_genres(infer_genres(event_for_inference))

        if not inferred:
            skipped_count += 1
            continue

        event_id = event["id"]
        series_id = event.get("series_id")

        if dry_run:
            logger.info(
                f"[DRY RUN] Event {event_id}: "
                f"\"{event.get('title', '')[:60]}\" → genres={inferred}"
            )
            updated_count += 1
            continue

        # Update event genres
        try:
            client.table("events").update({"genres": inferred}).eq("id", event_id).execute()
            updated_count += 1

            # Also backfill the series if it hasn't been updated yet
            if series_id and series_id not in series_updated:
                client.table("series").update(
                    {"genres": inferred}
                ).eq("id", series_id).is_("genres", "null").execute()
                series_updated.add(series_id)

        except Exception as exc:
            logger.error(f"Failed to update event {event_id}: {exc}")

        if updated_count % 100 == 0 and updated_count > 0:
            logger.info(f"Progress: {updated_count} updated, {skipped_count} skipped")

    logger.info(
        f"Backfill complete: {updated_count} events updated, "
        f"{skipped_count} skipped (no genres inferred), "
        f"{len(series_updated)} series updated"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill genres on recurring events")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to DB")
    parser.add_argument("--limit", type=int, default=5000, help="Max events to process (default: 5000)")
    args = parser.parse_args()

    backfill(dry_run=args.dry_run, limit=args.limit)
