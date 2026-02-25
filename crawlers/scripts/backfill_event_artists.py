#!/usr/bin/env python3
"""Unified artist backfill and normalization for all event categories.

Replaces three older scripts:
  - batch_backfill_artists.py  (music/comedy/nightlife backfill via parse_lineup_from_title)
  - normalize_event_participants.py  (cleanup existing rows via sanitize_event_artists)
  - backfill_artists.py  (music-only backfill + enrichment + description regen)

Two passes:
  Cleanup  — re-sanitize events that already have event_artists rows
  Backfill — extract artists from titles for events with no rows

Usage:
  python scripts/backfill_event_artists.py --dry-run
  python scripts/backfill_event_artists.py --categories sports --dry-run
  python scripts/backfill_event_artists.py --backfill-only
  python scripts/backfill_event_artists.py --cleanup-only
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from collections import Counter
from datetime import date
from typing import Any

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CRAWLERS_ROOT = os.path.dirname(SCRIPT_DIR)
if CRAWLERS_ROOT not in sys.path:
    sys.path.insert(0, CRAWLERS_ROOT)

from db import get_client, sanitize_event_artists, upsert_event_artists

logger = logging.getLogger(__name__)

# Categories where title extraction makes sense (backfill pass)
BACKFILL_CATEGORIES = {"music", "comedy", "nightlife", "sports"}

# All categories that can have event_artists rows (cleanup pass)
CLEANUP_CATEGORIES = {
    "sports", "comedy", "music", "theater", "nightlife",
    "learning", "words", "community", "art", "film",
}

# Nightlife subcategories where title parsing won't find real performers
_NIGHTLIFE_SKIP_SUBCATEGORIES = {
    "karaoke", "trivia", "bar_event", "poker", "bingo",
    "nightlife.karaoke", "nightlife.trivia", "nightlife.bar_event",
    "nightlife.poker", "nightlife.bingo",
}


def _normalize(value: str | None) -> str:
    return " ".join((value or "").lower().split())


def _signature(rows: list[dict[str, Any]]) -> tuple[tuple[str, str, int, bool], ...]:
    """Create a comparable fingerprint of artist rows for change detection."""
    normalized = []
    for row in rows:
        normalized.append((
            _normalize(str(row.get("name") or "")),
            _normalize(str(row.get("role") or "")),
            int(row.get("billing_order") or 0),
            bool(row.get("is_headliner")),
        ))
    normalized.sort()
    return tuple(normalized)


def _load_events_with_artists(
    categories: set[str],
    source_ids: list[int] | None = None,
) -> dict[int, dict[str, Any]]:
    """Fetch upcoming events that have event_artists rows, grouped by event_id."""
    client = get_client()
    today = date.today().isoformat()

    all_rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 1000

    while True:
        query = (
            client.table("event_artists")
            .select("event_id, name, role, billing_order, is_headliner, "
                    "events!inner(id, title, category, start_date, source_id)")
            .gte("events.start_date", today)
            .range(offset, offset + page_size - 1)
        )
        result = query.execute()
        rows = result.data or []
        if not rows:
            break
        all_rows.extend(rows)
        offset += len(rows)
        if len(rows) < page_size:
            break

    grouped: dict[int, dict[str, Any]] = {}
    for row in all_rows:
        event = row.get("events") or {}
        event_id = event.get("id")
        if not event_id:
            continue
        category = (event.get("category") or "").strip().lower()
        if category not in categories:
            continue
        if source_ids and event.get("source_id") not in source_ids:
            continue

        bucket = grouped.setdefault(int(event_id), {
            "title": event.get("title") or "",
            "category": category,
            "artists": [],
        })
        bucket["artists"].append({
            "name": row.get("name"),
            "role": row.get("role"),
            "billing_order": row.get("billing_order"),
            "is_headliner": row.get("is_headliner"),
        })

    return grouped


def _load_events_without_artists(
    categories: set[str],
    source_ids: list[int] | None = None,
) -> list[dict[str, Any]]:
    """Fetch upcoming events in backfill-eligible categories, then filter to those missing artists."""
    client = get_client()
    today = date.today().isoformat()

    all_events: list[dict[str, Any]] = []
    offset = 0
    batch = 1000

    while True:
        query = (
            client.table("events")
            .select("id, title, category, subcategory")
            .in_("category", list(categories))
            .gte("start_date", today)
            .order("id")
            .range(offset, offset + batch - 1)
        )
        if source_ids:
            query = query.in_("source_id", source_ids)
        result = query.execute()
        rows = result.data or []
        all_events.extend(rows)
        if len(rows) < batch:
            break
        offset += batch

    if not all_events:
        return []

    # Batch-check which already have event_artists rows
    event_ids = [e["id"] for e in all_events]
    has_artists: set[int] = set()
    for i in range(0, len(event_ids), 500):
        chunk = event_ids[i : i + 500]
        r = client.table("event_artists").select("event_id").in_("event_id", chunk).execute()
        for row in r.data or []:
            has_artists.add(row["event_id"])

    return [e for e in all_events if e["id"] not in has_artists]


def run_cleanup_pass(
    categories: set[str],
    source_ids: list[int] | None = None,
    dry_run: bool = True,
    skip_linking: bool = False,
    max_events: int = 0,
    show_samples: int = 20,
) -> dict[str, int]:
    """Re-sanitize existing event_artists rows; delete or upsert if changed."""
    stats: Counter[str] = Counter()
    samples: list[str] = []

    grouped = _load_events_with_artists(categories, source_ids)
    event_ids = sorted(grouped.keys())
    if max_events > 0:
        event_ids = event_ids[:max_events]

    logger.info("Cleanup pass: %d events with existing artists", len(event_ids))

    client = get_client()
    for idx, event_id in enumerate(event_ids, start=1):
        payload = grouped[event_id]
        title = payload["title"]
        category = payload["category"]
        current_artists = payload["artists"]

        before = _signature(current_artists)
        sanitized = sanitize_event_artists(title, category, current_artists)
        after = _signature(sanitized)

        stats["checked"] += 1

        if before == after:
            continue

        if not sanitized:
            # Sanitized to empty — delete all rows
            stats["deleted"] += 1
            if len(samples) < show_samples:
                names = ", ".join(a.get("name") or "" for a in current_artists)
                samples.append(f"  DELETE {event_id} [{category}] {title[:60]}\n    was: {names}")
            if not dry_run:
                client.table("event_artists").delete().eq("event_id", event_id).execute()
        else:
            stats["changed"] += 1
            if len(samples) < show_samples:
                before_names = ", ".join(a.get("name") or "" for a in current_artists)
                after_names = ", ".join(a.get("name") or "" for a in sanitized)
                samples.append(
                    f"  UPDATE {event_id} [{category}] {title[:60]}\n"
                    f"    before: {before_names}\n    after:  {after_names}"
                )
            if not dry_run:
                upsert_event_artists(event_id, sanitized, link_canonical=not skip_linking)

        if idx % 250 == 0:
            logger.info("Cleanup: processed %d/%d events...", idx, len(event_ids))

    mode = "DRY RUN" if dry_run else "APPLIED"
    print(f"\n=== Cleanup {mode} ===")
    print(f"  Checked: {stats['checked']}")
    print(f"  Changed: {stats['changed']}")
    print(f"  Deleted: {stats['deleted']}")
    if samples:
        print("\nSample changes:")
        for s in samples:
            print(s)

    return {
        "cleanup_checked": stats["checked"],
        "cleanup_changed": stats["changed"],
        "cleanup_deleted": stats["deleted"],
    }


def run_backfill_pass(
    categories: set[str],
    source_ids: list[int] | None = None,
    dry_run: bool = True,
    skip_linking: bool = False,
    max_events: int = 0,
    show_samples: int = 20,
) -> dict[str, int]:
    """Extract artists from titles for events with no event_artists rows."""
    stats: Counter[str] = Counter()
    samples: list[str] = []

    missing = _load_events_without_artists(categories, source_ids)
    if max_events > 0:
        missing = missing[:max_events]

    logger.info("Backfill pass: %d events without artists", len(missing))

    for idx, event in enumerate(missing, start=1):
        event_id = event["id"]
        title = event.get("title") or ""
        category = (event.get("category") or "").strip().lower()
        subcategory = (event.get("subcategory") or "").strip().lower()

        # Skip nightlife events in participatory subcategories
        if category == "nightlife" and subcategory in _NIGHTLIFE_SKIP_SUBCATEGORIES:
            stats["skipped_nightlife"] += 1
            continue

        stats["checked"] += 1
        result = sanitize_event_artists(title, category, [])

        if not result:
            stats["no_artists"] += 1
            continue

        stats["added"] += 1
        if len(samples) < show_samples:
            names = ", ".join(a.get("name") or "" for a in result)
            samples.append(f"  ADD {event_id} [{category}] {title[:60]} -> {names}")

        if not dry_run:
            upsert_event_artists(event_id, result, link_canonical=not skip_linking)

        if idx % 100 == 0:
            logger.info("Backfill: processed %d/%d events...", idx, len(missing))

    mode = "DRY RUN" if dry_run else "APPLIED"
    print(f"\n=== Backfill {mode} ===")
    print(f"  Checked: {stats['checked']}")
    print(f"  Added:   {stats['added']}")
    print(f"  No artists found: {stats['no_artists']}")
    if stats["skipped_nightlife"]:
        print(f"  Skipped nightlife: {stats['skipped_nightlife']}")
    if samples:
        print("\nSample additions:")
        for s in samples:
            print(s)

    return {
        "backfill_checked": stats["checked"],
        "backfill_added": stats["added"],
    }


def run_artist_backfill(
    categories: list[str] | None = None,
    source_ids: list[int] | None = None,
    dry_run: bool = False,
    cleanup: bool = True,
    backfill: bool = True,
    skip_linking: bool = False,
    max_events: int = 0,
) -> dict:
    """Run artist cleanup and/or backfill. Returns combined stats dict."""
    results: dict[str, int] = {}

    cleanup_cats = set(categories) & CLEANUP_CATEGORIES if categories else CLEANUP_CATEGORIES
    backfill_cats = set(categories) & BACKFILL_CATEGORIES if categories else BACKFILL_CATEGORIES

    if cleanup and cleanup_cats:
        results.update(run_cleanup_pass(
            categories=cleanup_cats,
            source_ids=source_ids,
            dry_run=dry_run,
            skip_linking=skip_linking,
            max_events=max_events,
        ))

    if backfill and backfill_cats:
        results.update(run_backfill_pass(
            categories=backfill_cats,
            source_ids=source_ids,
            dry_run=dry_run,
            skip_linking=skip_linking,
            max_events=max_events,
        ))

    return results


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Unified artist backfill and normalization for event_artists"
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--cleanup-only", action="store_true", help="Only run cleanup pass")
    parser.add_argument("--backfill-only", action="store_true", help="Only run backfill pass")
    parser.add_argument("--skip-linking", action="store_true", help="Skip canonical artist linking")
    parser.add_argument("--max-events", type=int, default=0, help="Cap events per pass (0=all)")
    parser.add_argument(
        "--categories",
        nargs="*",
        default=None,
        help="Limit to specific categories (e.g. sports comedy music)",
    )
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    do_cleanup = not args.backfill_only
    do_backfill = not args.cleanup_only

    stats = run_artist_backfill(
        categories=args.categories,
        dry_run=args.dry_run,
        cleanup=do_cleanup,
        backfill=do_backfill,
        skip_linking=args.skip_linking,
        max_events=args.max_events,
    )

    print(f"\nFinal stats: {stats}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
