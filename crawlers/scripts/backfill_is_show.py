#!/usr/bin/env python3
"""
Backfill the events.is_show flag from existing event and venue data.

Usage:
  python3 scripts/backfill_is_show.py            # dry run
  python3 scripts/backfill_is_show.py --apply    # persist changes
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client, events_support_is_show_column
from db.events import _compute_is_show


SELECT_FIELDS = ",".join(
    [
        "id",
        "title",
        "start_date",
        "category_id",
        "content_kind",
        "tags",
        "genres",
        "price_min",
        "price_max",
        "ticket_url",
        "ticket_status",
        "is_recurring",
        "is_class",
        "is_show",
        "venue:places(place_type)",
    ]
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill events.is_show")
    parser.add_argument("--apply", action="store_true", help="Persist changes")
    parser.add_argument(
        "--lookback-days",
        type=int,
        default=45,
        help="Include events starting this many days before today (default: 45)",
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
    args = parser.parse_args()

    client = get_client()
    if not events_support_is_show_column():
        print(
            "events table is missing is_show.\n"
            "Run migration: supabase/migrations/20260330010001_event_is_show.sql"
        )
        return

    since_date = (datetime.utcnow() - timedelta(days=args.lookback_days)).date().isoformat()
    offset = 0
    scanned = 0
    updates = 0
    preview_shown = 0

    while True:
        result = (
            client.table("events")
            .select(SELECT_FIELDS)
            .eq("is_active", True)
            .gte("start_date", since_date)
            .order("id")
            .range(offset, offset + args.batch_size - 1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            break

        for row in rows:
            scanned += 1
            venue = row.get("venue") or {}
            venue_type = venue.get("place_type")
            computed = _compute_is_show(row, venue_type)
            existing = bool(row.get("is_show"))

            if computed == existing:
                continue

            updates += 1
            if preview_shown < args.preview:
                print(
                    f"[{row['id']}] {row.get('title') or 'Untitled'} | "
                    f"category={row.get('category_id')} | venue_type={venue_type} | "
                    f"is_show: {existing} -> {computed}"
                )
                preview_shown += 1

            if args.apply:
                (
                    client.table("events")
                    .update({"is_show": computed})
                    .eq("id", row["id"])
                    .execute()
                )

        offset += args.batch_size
        print(f"Scanned {scanned} events, pending updates: {updates}")

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"[{mode}] complete: scanned={scanned}, updates={updates}, since={since_date}")


if __name__ == "__main__":
    main()
