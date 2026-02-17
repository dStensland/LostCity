#!/usr/bin/env python3
"""
Normalize event participants across event types.

What it does:
- Removes title-mirror / boilerplate participant rows
- Parses sports matchup titles into teams when possible
- Reindexes billing/lead ordering consistently

Usage:
  python scripts/normalize_event_participants.py --dry-run
  python scripts/normalize_event_participants.py --categories sports comedy music
  python scripts/normalize_event_participants.py --apply --skip-linking
"""

from __future__ import annotations

import argparse
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


def _normalize(value: str | None) -> str:
    return " ".join((value or "").lower().split())


def _signature(rows: list[dict[str, Any]]) -> tuple[tuple[str, str, int, bool], ...]:
    normalized = []
    for row in rows:
        normalized.append(
            (
                _normalize(str(row.get("name") or "")),
                _normalize(str(row.get("role") or "")),
                int(row.get("billing_order") or 0),
                bool(row.get("is_headliner")),
            )
        )
    normalized.sort()
    return tuple(normalized)


def load_event_artist_rows() -> list[dict[str, Any]]:
    client = get_client()
    today = date.today().isoformat()

    all_rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 1000

    while True:
        result = (
            client.table("event_artists")
            .select("event_id, name, role, billing_order, is_headliner, events!inner(id, title, category, start_date)")
            .gte("events.start_date", today)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            break

        all_rows.extend(rows)
        offset += len(rows)
        if len(rows) < page_size:
            break

    return all_rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize event participant rows")
    parser.add_argument("--apply", action="store_true", help="Write changes to database")
    parser.add_argument("--skip-linking", action="store_true", help="Skip canonical artist linking while applying")
    parser.add_argument(
        "--categories",
        nargs="*",
        default=["sports", "comedy", "music", "theater", "nightlife", "learning", "words", "community", "art", "film"],
        help="Categories to process (default: sports comedy music theater nightlife learning words community art film)",
    )
    parser.add_argument("--max-events", type=int, default=0, help="Optional cap for testing")
    parser.add_argument("--show-samples", type=int, default=20, help="How many changed events to print")
    args = parser.parse_args()

    categories = {c.strip().lower() for c in args.categories if c.strip()}
    rows = load_event_artist_rows()

    grouped: dict[int, dict[str, Any]] = {}
    for row in rows:
        event = row.get("events") or {}
        event_id = event.get("id")
        if not event_id:
            continue
        category = (event.get("category") or "").strip().lower()
        if categories and category not in categories:
            continue

        bucket = grouped.setdefault(
            int(event_id),
            {
                "title": event.get("title") or "",
                "category": category,
                "artists": [],
            },
        )
        bucket["artists"].append(
            {
                "name": row.get("name"),
                "role": row.get("role"),
                "billing_order": row.get("billing_order"),
                "is_headliner": row.get("is_headliner"),
            }
        )

    event_ids = sorted(grouped.keys())
    if args.max_events > 0:
        event_ids = event_ids[: args.max_events]

    stats = Counter()
    changed_by_category = Counter()
    changed_samples: list[str] = []

    for idx, event_id in enumerate(event_ids, start=1):
        payload = grouped[event_id]
        title = payload["title"]
        category = payload["category"]
        current_artists = payload["artists"]

        before = _signature(current_artists)
        sanitized = sanitize_event_artists(title, category, current_artists)
        after = _signature(sanitized)

        stats["events_checked"] += 1
        stats[f"events_checked_{category}"] += 1

        if before == after:
            continue

        stats["events_changed"] += 1
        changed_by_category[category] += 1

        if len(changed_samples) < args.show_samples:
            before_names = ", ".join(a.get("name") or "" for a in current_artists)
            after_names = ", ".join(a.get("name") or "" for a in sanitized)
            changed_samples.append(
                f"{event_id} [{category}] {title}\n  before: {before_names or '<none>'}\n  after:  {after_names or '<none>'}"
            )

        if args.apply:
            upsert_event_artists(event_id, current_artists, link_canonical=not args.skip_linking)
            stats["events_updated"] += 1

        if idx % 250 == 0:
            print(f"Processed {idx}/{len(event_ids)} events...")

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"\n=== {mode} SUMMARY ===")
    print(f"events checked: {stats['events_checked']}")
    print(f"events changed: {stats['events_changed']}")
    if args.apply:
        print(f"events updated: {stats['events_updated']}")

    print("\nChanged by category:")
    for cat, count in changed_by_category.most_common():
        print(f"  {cat}: {count}")

    if changed_samples:
        print("\nSample changes:")
        for sample in changed_samples:
            print(f"- {sample}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
