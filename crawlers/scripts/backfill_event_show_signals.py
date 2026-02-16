#!/usr/bin/env python3
"""
Backfill first-class show metadata on events.

Usage:
  python3 scripts/backfill_event_show_signals.py           # dry run
  python3 scripts/backfill_event_show_signals.py --apply   # write changes
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client, events_support_show_signal_columns
from show_signals import derive_show_signals


SELECT_FIELDS = ",".join(
    [
        "id",
        "title",
        "description",
        "price_note",
        "tags",
        "start_time",
        "end_time",
        "is_all_day",
        "is_free",
        "is_adult",
        "ticket_url",
        "doors_time",
        "age_policy",
        "ticket_status",
        "reentry_policy",
        "set_times_mentioned",
        "start_date",
    ]
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill event show signal columns")
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
    args = parser.parse_args()

    client = get_client()
    if not events_support_show_signal_columns():
        print(
            "events table is missing show signal columns.\n"
            "Run migration: supabase/migrations/20260216110000_event_show_signal_columns.sql"
        )
        return

    since_date = (datetime.utcnow() - timedelta(days=args.lookback_days)).date().isoformat()

    offset = 0
    scanned = 0
    updates = 0

    while True:
        result = (
            client.table("events")
            .select(SELECT_FIELDS)
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
            derived = derive_show_signals(row, preserve_existing=False)
            update_data = {}

            for field, derived_value in derived.items():
                existing_value = row.get(field)
                if field == "set_times_mentioned":
                    if bool(existing_value) != bool(derived_value):
                        update_data[field] = bool(derived_value)
                    continue

                normalized_existing = existing_value or None
                normalized_derived = derived_value or None
                if normalized_existing != normalized_derived:
                    update_data[field] = normalized_derived

            if update_data:
                updates += 1
                if args.apply:
                    (
                        client.table("events")
                        .update(update_data)
                        .eq("id", row["id"])
                        .execute()
                    )

        offset += args.batch_size
        print(f"Scanned {scanned} events, pending updates: {updates}")

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"[{mode}] complete: scanned={scanned}, updates={updates}, since={since_date}")


if __name__ == "__main__":
    main()
