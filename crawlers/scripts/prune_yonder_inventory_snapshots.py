#!/usr/bin/env python3
"""
Prune older Yonder inventory snapshots while keeping recent history per provider window.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/prune_yonder_inventory_snapshots.py
    python3 scripts/prune_yonder_inventory_snapshots.py --provider-id ga_state_parks --apply
"""

from __future__ import annotations

import argparse
import logging
import sys
from collections import defaultdict
from pathlib import Path

from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import get_config

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def build_client():
    cfg = get_config()
    missing = cfg.database.missing_active_credentials()
    if missing:
        raise RuntimeError(
            f"Missing Supabase credentials for {cfg.database.active_target}: {', '.join(missing)}"
        )
    return create_client(
        cfg.database.active_supabase_url,
        cfg.database.active_supabase_service_key,
    )


def sort_key(row: dict) -> tuple[str, str]:
    captured_for_date = row.get("captured_for_date") or "0000-00-00"
    captured_at = row.get("captured_at") or "1970-01-01T00:00:00+00:00"
    return str(captured_for_date), str(captured_at)


def batched(values: list[str], size: int) -> list[list[str]]:
    return [values[index : index + size] for index in range(0, len(values), size)]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prune older Yonder inventory snapshots while keeping recent history."
    )
    parser.add_argument(
        "--keep-per-window",
        type=int,
        default=2,
        help="How many capture dates to keep per venue/provider/scope/arrival window.",
    )
    parser.add_argument(
        "--provider-id",
        help="Optional provider_id filter, e.g. ga_state_parks.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Delete older rows instead of printing a dry-run summary.",
    )
    args = parser.parse_args()

    if args.keep_per_window < 1:
        raise RuntimeError("--keep-per-window must be at least 1")

    client = build_client()
    query = client.table("venue_inventory_snapshots").select(
        "id,venue_id,provider_id,inventory_scope,arrival_date,nights,captured_for_date,captured_at"
    )
    if args.provider_id:
        query = query.eq("provider_id", args.provider_id)
    rows = query.execute().data or []

    grouped: dict[tuple[int, str, str, str, int], list[dict]] = defaultdict(list)
    for row in rows:
        key = (
            row["venue_id"],
            row["provider_id"],
            row["inventory_scope"],
            row["arrival_date"],
            row["nights"],
        )
        grouped[key].append(row)

    delete_ids: list[str] = []
    affected_groups = 0
    for key_rows in grouped.values():
        sorted_rows = sorted(key_rows, key=sort_key, reverse=True)
        survivors = sorted_rows[: args.keep_per_window]
        stale_rows = sorted_rows[args.keep_per_window :]
        if stale_rows:
            affected_groups += 1
            delete_ids.extend(row["id"] for row in stale_rows)
            latest = survivors[0]
            logger.info(
                "stale window | provider=%s | venue_id=%s | arrival=%s | kept=%s | pruned=%s | latest_capture=%s",
                latest["provider_id"],
                latest["venue_id"],
                latest["arrival_date"],
                len(survivors),
                len(stale_rows),
                latest["captured_for_date"],
            )

    logger.info("")
    logger.info("Yonder inventory prune summary")
    logger.info("Rows scanned: %s", len(rows))
    logger.info("Groups with stale history: %s", affected_groups)
    logger.info("Rows eligible for deletion: %s", len(delete_ids))

    if not args.apply or not delete_ids:
        return

    for batch in batched(delete_ids, 200):
        client.table("venue_inventory_snapshots").delete().in_("id", batch).execute()

    logger.info("Deleted rows: %s", len(delete_ids))


if __name__ == "__main__":
    main()
