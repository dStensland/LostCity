#!/usr/bin/env python3
"""
Taxonomy v2 backfill script.

Reclassifies all active/future events using the new classification engine.
Saves the old category_id to legacy_category_id before overwriting.

Usage:
    # Dry run — shows what would change, writes nothing
    python scripts/backfill_taxonomy_v2.py --dry-run

    # Test on a single source first (recommended)
    python scripts/backfill_taxonomy_v2.py --source-id 554 --dry-run
    python scripts/backfill_taxonomy_v2.py --source-id 554

    # Full backfill (run after dry-run review)
    python scripts/backfill_taxonomy_v2.py

    # Limit batch processing for incremental runs
    python scripts/backfill_taxonomy_v2.py --batch-size 50 --max-batches 10
"""

from __future__ import annotations

import argparse
import logging
import sys
import os
from datetime import date
from collections import defaultdict

# Add parent directory to path so we can import from crawlers/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client
from classify import classify_rules, classify_event, ClassificationResult
from supabase import Client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Source-level defaults — skip classification for high-volume deterministic sources
# ---------------------------------------------------------------------------

SOURCE_DEFAULTS: dict[int, dict] = {
    554:  {"category": "workshops", "genres": ["painting"]},   # Painting With a Twist
    808:  {"category": "workshops", "genres": []},              # Spruill Center
    1318: {"category": "education", "genres": ["technology"]}, # theCoderSchool
}

# Callanwolde (809) is NOT in source defaults — needs per-event classification
# because it has both workshops (classes) and art (exhibitions).


def get_supabase() -> Client:
    return get_client()


def fetch_event_batch(
    client: Client,
    offset: int,
    batch_size: int,
    source_id: int | None,
    today: str,
) -> list[dict]:
    """Fetch a batch of active/future events for reclassification."""
    query = (
        client.table("events")
        .select(
            "id, title, description, category_id, genres, source_id, "
            "place_id, venues(name, venue_type)"
        )
        .eq("is_active", True)
        .gte("start_date", today)
        .is_("canonical_event_id", "null")
        .order("id", desc=False)
        .range(offset, offset + batch_size - 1)
    )

    if source_id is not None:
        query = query.eq("source_id", source_id)

    result = query.execute()
    return result.data or []


DISSOLVED_CATEGORIES = {
    "nightlife", "community", "family", "recreation",
    "wellness", "exercise", "learning", "support_group",
}

# Direct renames — no classification needed, just category swap
DIRECT_RENAMES: dict[str, str] = {
    "exercise": "fitness",
    "support_group": "support",
}


def classify_event_for_backfill(
    event: dict,
    use_llm: bool = True,
) -> ClassificationResult:
    """
    Run classification on a single event.
    Uses source-level defaults first, then rules, then LLM for dissolved categories.
    """
    source_id = event.get("source_id")
    old_cat = event.get("category_id") or ""

    # Source-level default
    if source_id in SOURCE_DEFAULTS:
        defaults = SOURCE_DEFAULTS[source_id]
        return ClassificationResult(
            category=defaults["category"],
            genres=defaults.get("genres", []),
            confidence=1.0,
            source="source_default",
        )

    # Direct renames — no ambiguity
    if old_cat in DIRECT_RENAMES:
        return ClassificationResult(
            category=DIRECT_RENAMES[old_cat],
            genres=[],
            confidence=1.0,
            source="direct_rename",
        )

    place_data = event.get("venues") or {}
    venue_type = place_data.get("place_type") if isinstance(place_data, dict) else None
    title = event.get("title") or ""
    description = event.get("description") or ""

    # Try rules first
    result = classify_rules(
        title=title,
        description=description,
        venue_type=venue_type,
    )

    # If rules are confident, use them
    if result.category and result.confidence >= 0.7:
        return result

    # For dissolved categories, use LLM fallback if enabled
    if use_llm and old_cat in DISSOLVED_CATEGORIES:
        venue_name = place_data.get("name") if isinstance(place_data, dict) else None
        llm_result = classify_event(
            title=title,
            description=description,
            venue_type=venue_type,
            venue_name=venue_name,
            source_id=source_id,
            category_hint=old_cat,
        )
        if llm_result.category and llm_result.confidence > 0.3:
            return llm_result

    return result


def apply_genre_scoping(category: str, genres: list[str]) -> list[str]:
    """
    Strip genres that don't belong to the new category.
    Import GENRES_BY_CATEGORY to validate.
    """
    try:
        from genre_normalize import GENRES_BY_CATEGORY
        valid = GENRES_BY_CATEGORY.get(category, set())
        return [g for g in genres if g in valid]
    except ImportError:
        return genres


def run_backfill(
    dry_run: bool,
    source_id: int | None,
    batch_size: int,
    max_batches: int | None,
    use_llm: bool = True,
) -> None:
    client = get_supabase()
    today = date.today().isoformat()

    logger.info(
        "Starting taxonomy v2 backfill: dry_run=%s source_id=%s batch_size=%d",
        dry_run,
        source_id,
        batch_size,
    )

    total_processed = 0
    total_changed = 0
    total_unchanged = 0
    total_errors = 0
    category_before: dict[str, int] = defaultdict(int)
    category_after: dict[str, int] = defaultdict(int)
    changes_log: list[dict] = []

    batch_num = 0
    offset = 0

    while True:
        if max_batches is not None and batch_num >= max_batches:
            logger.info("Reached max_batches=%d, stopping.", max_batches)
            break

        events = fetch_event_batch(client, offset, batch_size, source_id, today)
        if not events:
            logger.info("No more events at offset=%d, done.", offset)
            break

        batch_num += 1
        logger.info(
            "Batch %d: processing %d events (offset=%d)",
            batch_num,
            len(events),
            offset,
        )

        updates: list[dict] = []

        for event in events:
            try:
                old_cat = event.get("category_id") or "unknown"
                category_before[old_cat] += 1

                result = classify_event_for_backfill(event, use_llm=use_llm)

                if not result.category:
                    # No classification result — leave unchanged
                    category_after[old_cat] += 1
                    total_unchanged += 1
                    continue

                new_cat = result.category
                new_genres = apply_genre_scoping(new_cat, result.genres or [])
                category_after[new_cat] += 1

                changed = new_cat != old_cat

                if changed:
                    total_changed += 1
                    change_entry = {
                        "event_id": event["id"],
                        "title": (event.get("title") or "")[:60],
                        "old_category": old_cat,
                        "new_category": new_cat,
                        "confidence": result.confidence,
                        "source": result.source,
                    }
                    changes_log.append(change_entry)
                    logger.info(
                        "  CHANGE id=%d old=%s new=%s conf=%.2f title='%s'",
                        event["id"],
                        old_cat,
                        new_cat,
                        result.confidence,
                        change_entry["title"],
                    )
                else:
                    total_unchanged += 1

                if not dry_run:
                    updates.append({
                        "id": event["id"],
                        "legacy_category_id": old_cat,
                        "category_id": new_cat,
                        "genres": new_genres,
                    })

            except Exception as e:
                logger.error("Error on event id=%s: %s", event.get("id"), e)
                total_errors += 1
                continue

        # Batch upsert
        if not dry_run and updates:
            for upd in updates:
                try:
                    client.table("events").update({
                        "legacy_category_id": upd["legacy_category_id"],
                        "category_id": upd["category_id"],
                        "genres": upd["genres"],
                    }).eq("id", upd["id"]).execute()
                except Exception as e:
                    logger.error("DB update failed for id=%s: %s", upd["id"], e)
                    total_errors += 1

        total_processed += len(events)
        offset += batch_size

        if len(events) < batch_size:
            # Last page
            break

    # Summary
    logger.info("=" * 60)
    logger.info("BACKFILL COMPLETE")
    logger.info("  Mode:        %s", "DRY RUN" if dry_run else "LIVE WRITE")
    logger.info("  Source ID:   %s", source_id or "ALL")
    logger.info("  Processed:   %d", total_processed)
    logger.info("  Changed:     %d", total_changed)
    logger.info("  Unchanged:   %d", total_unchanged)
    logger.info("  Errors:      %d", total_errors)
    logger.info("")
    logger.info("Category distribution BEFORE:")
    for cat, count in sorted(category_before.items(), key=lambda x: -x[1]):
        logger.info("  %-20s %d", cat, count)
    logger.info("")
    logger.info("Category distribution AFTER:")
    for cat, count in sorted(category_after.items(), key=lambda x: -x[1]):
        logger.info("  %-20s %d", cat, count)
    logger.info("")

    if changes_log:
        logger.info("Sample of changes (first 20):")
        for ch in changes_log[:20]:
            logger.info(
                "  [%d] %s -> %s (conf=%.2f) '%s'",
                ch["event_id"],
                ch["old_category"],
                ch["new_category"],
                ch["confidence"],
                ch["title"],
            )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill taxonomy v2 classifications for all active/future events."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log what would change without writing to the database.",
    )
    parser.add_argument(
        "--source-id",
        type=int,
        default=None,
        help="Only process events from this source_id (for incremental testing).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of events to process per batch (default: 100).",
    )
    parser.add_argument(
        "--max-batches",
        type=int,
        default=None,
        help="Stop after N batches (for incremental runs).",
    )
    parser.add_argument(
        "--no-llm",
        action="store_true",
        help="Disable LLM fallback — rules-only classification.",
    )
    args = parser.parse_args()

    run_backfill(
        dry_run=args.dry_run,
        source_id=args.source_id,
        batch_size=args.batch_size,
        max_batches=args.max_batches,
        use_llm=not args.no_llm,
    )


if __name__ == "__main__":
    main()
