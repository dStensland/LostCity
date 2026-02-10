#!/usr/bin/env python3
"""
Backfill genres AND tags for existing events.

1. Migrates subcategory values → genre slugs (using SUBCATEGORY_TO_GENRE map)
2. Normalizes existing messy genre strings
3. Infers genres from title/description for events with no genres
4. Re-infers tags with genre context (GENRE_TO_TAGS mapping from Phase A)
5. Backfills venue genres from event history

Usage:
    python3 scripts/backfill_genres.py --dry-run
    python3 scripts/backfill_genres.py --limit 500
    python3 scripts/backfill_genres.py --category music --limit 1000
    python3 scripts/backfill_genres.py --retag-all --limit 5000  # re-tag even events with good genres
"""

from __future__ import annotations

import sys
import time
import logging
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)

from db import get_client
from genre_normalize import (
    normalize_genres,
    genre_from_subcategory,
    VALID_GENRES,
)
from tag_inference import infer_genres, infer_tags

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def backfill_events(
    limit: int = 5000,
    category: str | None = None,
    dry_run: bool = False,
    retag_all: bool = False,
) -> dict:
    """Backfill genres and tags for existing events.

    Args:
        limit: Max events to process.
        category: Filter by category.
        dry_run: Don't write to DB.
        retag_all: Re-infer tags even for events with good genres.
    """
    client = get_client()

    stats = {
        "total": 0,
        "genres_from_subcategory": 0,
        "genres_from_inference": 0,
        "genres_normalized": 0,
        "genres_already_good": 0,
        "no_genres": 0,
        "tags_updated": 0,
        "tags_already_good": 0,
        "errors": 0,
    }

    # Fetch events in batches — include fields needed for tag inference
    select_fields = (
        "id,title,description,category,subcategory,genres,tags,"
        "is_free,price_min,ticket_url,is_class"
    )
    batch_size = 500
    offset = 0
    processed = 0

    while processed < limit:
        query = (
            client.table("events")
            .select(select_fields)
            .order("id")
        )
        if category:
            query = query.eq("category", category)

        result = query.range(offset, offset + batch_size - 1).execute()
        events = result.data or []
        if not events:
            break

        for event in events:
            if processed >= limit:
                break
            processed += 1
            stats["total"] += 1

            event_id = event["id"]
            existing_genres = event.get("genres") or []
            existing_tags = event.get("tags") or []
            subcategory = event.get("subcategory") or ""
            new_genres: list[str] = []
            genre_changed = False

            # --- GENRE BACKFILL ---

            # Step 1: If has existing genres, normalize them
            if existing_genres:
                normalized = normalize_genres(existing_genres)
                if normalized == existing_genres:
                    stats["genres_already_good"] += 1
                    # Genres are good — but if retag_all, continue to tag inference
                    if not retag_all:
                        continue
                    new_genres = existing_genres
                else:
                    if normalized:
                        new_genres = normalized
                        stats["genres_normalized"] += 1
                        genre_changed = True

            # Step 2: If no genres yet, try migrating from subcategory
            if not new_genres and subcategory:
                genre = genre_from_subcategory(subcategory)
                if genre:
                    new_genres = [genre]
                    stats["genres_from_subcategory"] += 1
                    genre_changed = True

            # Step 3: If still no genres, infer from title/description
            if not new_genres:
                inferred = infer_genres(event)
                if inferred:
                    new_genres = inferred
                    stats["genres_from_inference"] += 1
                    genre_changed = True
                else:
                    stats["no_genres"] += 1
                    # Still try tag inference even without genres
                    new_genres = []

            # --- TAG RE-INFERENCE (with genre context) ---
            final_genres = new_genres or existing_genres
            new_tags = infer_tags(event, genres=final_genres)
            # ADD only: merge new tags into existing, never remove
            merged_tags = sorted(set(existing_tags) | set(new_tags))
            tags_changed = merged_tags != sorted(existing_tags)

            if tags_changed:
                stats["tags_updated"] += 1
            else:
                stats["tags_already_good"] += 1

            # --- WRITE UPDATES ---
            updates: dict = {}
            if genre_changed and new_genres:
                updates["genres"] = new_genres
            if tags_changed:
                updates["tags"] = merged_tags

            if not updates:
                continue

            if not dry_run:
                try:
                    client.table("events").update(updates).eq("id", event_id).execute()
                except Exception as e:
                    logger.warning(f"Failed to update event {event_id}: {e}")
                    stats["errors"] += 1
                    if "Resource temporarily unavailable" in str(e) or "Connection reset" in str(e):
                        time.sleep(1)
                        client = get_client()
                    continue

            if processed % 200 == 0:
                logger.info(f"  Processed {processed}/{limit}...")

        offset += batch_size
        time.sleep(0.1)  # Rate limit

    return stats


def backfill_venues(
    limit: int = 5000,
    dry_run: bool = False,
) -> dict:
    """Backfill genres for venues based on their event history."""
    client = get_client()

    stats = {
        "total": 0,
        "updated": 0,
        "already_has_genres": 0,
        "no_events": 0,
        "errors": 0,
    }

    # Get venues without genres
    result = (
        client.table("venues")
        .select("id,name,venue_type,genres")
        .eq("active", True)
        .is_("genres", "null")
        .order("id")
        .limit(limit)
        .execute()
    )
    venues = result.data or []

    logger.info(f"Found {len(venues)} venues without genres")

    for i, venue in enumerate(venues, 1):
        stats["total"] += 1
        venue_id = venue["id"]

        # Get genre distribution from this venue's events
        events_result = (
            client.table("events")
            .select("genres")
            .eq("venue_id", venue_id)
            .not_.is_("genres", "null")
            .limit(100)
            .execute()
        )
        events = events_result.data or []

        if not events:
            stats["no_events"] += 1
            continue

        # Count genre frequency
        genre_counts: dict[str, int] = {}
        for event in events:
            for genre in (event.get("genres") or []):
                if genre in VALID_GENRES:
                    genre_counts[genre] = genre_counts.get(genre, 0) + 1

        if not genre_counts:
            stats["no_events"] += 1
            continue

        # Keep genres that appear in >= 20% of events (min 2 occurrences)
        total_events = len(events)
        threshold = max(2, total_events * 0.2)
        venue_genres = sorted(
            [g for g, c in genre_counts.items() if c >= threshold],
            key=lambda g: -genre_counts[g],
        )[:5]  # Cap at 5 genres per venue

        if not venue_genres:
            # Fall back to top genre if nothing passes threshold
            top_genre = max(genre_counts, key=genre_counts.get)
            if genre_counts[top_genre] >= 2:
                venue_genres = [top_genre]

        if not venue_genres:
            stats["no_events"] += 1
            continue

        if not dry_run:
            try:
                client.table("venues").update(
                    {"genres": venue_genres}
                ).eq("id", venue_id).execute()
            except Exception as e:
                logger.warning(f"Failed to update venue {venue_id}: {e}")
                stats["errors"] += 1
                continue

        logger.info(f"  [{i}/{len(venues)}] {venue['name'][:40]}: {venue_genres}")
        stats["updated"] += 1

        if i % 50 == 0:
            time.sleep(0.2)

    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill genres and tags for events and venues")
    parser.add_argument("--limit", type=int, default=5000, help="Max records to process")
    parser.add_argument("--category", type=str, help="Filter events by category")
    parser.add_argument("--dry-run", action="store_true", help="Don't update database")
    parser.add_argument("--venues-only", action="store_true", help="Only backfill venue genres")
    parser.add_argument("--events-only", action="store_true", help="Only backfill event genres")
    parser.add_argument("--retag-all", action="store_true",
                        help="Re-infer tags for ALL events (even those with good genres)")
    args = parser.parse_args()

    dry_label = " (DRY RUN)" if args.dry_run else ""
    retag_label = " + retag-all" if args.retag_all else ""

    if not args.venues_only:
        logger.info(f"=== Backfilling event genres & tags{retag_label}{dry_label} ===")
        event_stats = backfill_events(
            limit=args.limit,
            category=args.category,
            dry_run=args.dry_run,
            retag_all=args.retag_all,
        )
        logger.info(f"\nEvent Results:")
        logger.info(f"  Total processed:         {event_stats['total']}")
        logger.info(f"  Genres from subcategory:  {event_stats['genres_from_subcategory']}")
        logger.info(f"  Genres from inference:    {event_stats['genres_from_inference']}")
        logger.info(f"  Genres normalized:        {event_stats['genres_normalized']}")
        logger.info(f"  Genres already good:      {event_stats['genres_already_good']}")
        logger.info(f"  No genres found:          {event_stats['no_genres']}")
        logger.info(f"  Tags updated (ADD only):  {event_stats['tags_updated']}")
        logger.info(f"  Tags already good:        {event_stats['tags_already_good']}")
        logger.info(f"  Errors:                   {event_stats['errors']}")

    if not args.events_only:
        logger.info(f"\n=== Backfilling venue genres{dry_label} ===")
        venue_stats = backfill_venues(
            limit=args.limit,
            dry_run=args.dry_run,
        )
        logger.info(f"\nVenue Results:")
        logger.info(f"  Total processed: {venue_stats['total']}")
        logger.info(f"  Updated: {venue_stats['updated']}")
        logger.info(f"  No events: {venue_stats['no_events']}")
        logger.info(f"  Errors: {venue_stats['errors']}")

    if args.dry_run:
        logger.info(f"\n*** DRY RUN - No changes were made ***")
