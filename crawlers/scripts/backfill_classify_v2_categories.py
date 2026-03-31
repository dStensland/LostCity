#!/usr/bin/env python3
"""
Backfill event categories using the shared v2 classifier.

Usage:
  CLASSIFY_V2_REWRITE_CATEGORY=1 python3 scripts/backfill_classify_v2_categories.py
  CLASSIFY_V2_REWRITE_CATEGORY=1 python3 scripts/backfill_classify_v2_categories.py --apply
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from classify import classify_event
from db import get_client, events_support_taxonomy_v2_columns
from db.events import _should_rewrite_category_from_v2


SELECT_FIELDS = ",".join(
    [
        "id",
        "title",
        "description",
        "start_date",
        "category_id",
        "source_id",
        "classification_prompt_version",
        "source:sources(name,slug)",
        "venue:places(place_type)",
    ]
)


def _resolve_source_id(client, source_slug: str) -> int | None:
    result = (
        client.table("sources")
        .select("id")
        .eq("slug", source_slug)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    return rows[0]["id"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill event categories via classify_v2")
    parser.add_argument("--apply", action="store_true", help="Persist changes")
    parser.add_argument(
        "--lookback-days",
        type=int,
        default=90,
        help="Include events starting this many days before today (default: 90)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Rows per DB batch (default: 500)",
    )
    parser.add_argument(
        "--preview",
        type=int,
        default=20,
        help="Number of example changes to print (default: 20)",
    )
    parser.add_argument(
        "--source-slug",
        type=str,
        default=None,
        help="Optional single source slug to limit the backfill",
    )
    args = parser.parse_args()

    client = get_client()
    if not events_support_taxonomy_v2_columns():
        print(
            "events table is missing taxonomy v2 columns.\n"
            "Run the required taxonomy v2 migration set before this backfill."
        )
        return

    since_date = (datetime.utcnow() - timedelta(days=args.lookback_days)).date().isoformat()
    offset = 0
    scanned = 0
    updates = 0
    preview_shown = 0
    source_id = None

    if args.source_slug:
        source_id = _resolve_source_id(client, args.source_slug)
        if source_id is None:
            print(f"Unknown source slug: {args.source_slug}")
            return

    while True:
        query = (
            client.table("events")
            .select(SELECT_FIELDS)
            .eq("is_active", True)
            .gte("start_date", since_date)
            .order("id")
        )
        if source_id is not None:
            query = query.eq("source_id", source_id)
        result = query.range(offset, offset + args.batch_size - 1).execute()
        rows = result.data or []
        if not rows:
            break

        for row in rows:
            scanned += 1
            source_info = row.get("source") or {}
            venue = row.get("venue") or {}
            existing_category = str(row.get("category_id") or "").strip().lower()

            result = classify_event(
                title=row.get("title") or "",
                description=row.get("description") or "",
                venue_type=venue.get("place_type") if isinstance(venue, dict) else None,
                source_name=source_info.get("name") if isinstance(source_info, dict) else None,
                source_id=row.get("source_id"),
                source_slug=source_info.get("slug") if isinstance(source_info, dict) else None,
                category_hint=existing_category,
            )
            incoming_category = str(result.category or "").strip().lower()
            if not _should_rewrite_category_from_v2(existing_category, incoming_category):
                continue

            updates += 1
            if preview_shown < args.preview:
                print(
                    f"[{row['id']}] {row.get('title') or 'Untitled'} | "
                    f"source={source_info.get('slug') if isinstance(source_info, dict) else row.get('source_id')} | "
                    f"category: {existing_category or '<null>'} -> {incoming_category}"
                )
                preview_shown += 1

            if args.apply:
                (
                    client.table("events")
                    .update(
                        {
                            "category_id": incoming_category,
                            "classification_prompt_version": result.prompt_version,
                        }
                    )
                    .eq("id", row["id"])
                    .execute()
                )

        offset += args.batch_size
        print(f"Scanned {scanned} events, pending updates: {updates}")

    mode = "APPLY" if args.apply else "DRY RUN"
    print(
        f"[{mode}] complete: scanned={scanned}, updates={updates}, since={since_date}, "
        f"source_slug={args.source_slug or 'all'}"
    )


if __name__ == "__main__":
    main()
