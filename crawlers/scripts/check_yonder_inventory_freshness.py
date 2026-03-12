#!/usr/bin/env python3
"""
Check whether Yonder current inventory snapshots are fresh enough for runtime use.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/check_yonder_inventory_freshness.py
    python3 scripts/check_yonder_inventory_freshness.py --max-age-days 2
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import date, datetime
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


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Check freshness of Yonder current inventory snapshots."
    )
    parser.add_argument(
        "--max-age-days",
        type=int,
        default=1,
        help="Maximum acceptable age in days for current snapshots.",
    )
    parser.add_argument(
        "--provider-id",
        help="Optional provider_id filter.",
    )
    args = parser.parse_args()

    if args.max_age_days < 0:
        raise RuntimeError("--max-age-days must be 0 or greater")

    client = build_client()
    query = client.table("current_venue_inventory_snapshots").select(
        "provider_id,venue_id,arrival_date,captured_for_date"
    )
    if args.provider_id:
        query = query.eq("provider_id", args.provider_id)
    rows = query.execute().data or []

    today = date.today()
    stale_rows = []
    for row in rows:
        captured_for_date = datetime.strptime(
            row["captured_for_date"], "%Y-%m-%d"
        ).date()
        age_days = (today - captured_for_date).days
        if age_days > args.max_age_days:
            stale_rows.append((row, age_days))

    logger.info("Yonder inventory freshness check")
    logger.info("Rows checked: %s", len(rows))
    logger.info("Max age days: %s", args.max_age_days)
    logger.info("Stale rows: %s", len(stale_rows))

    for row, age_days in stale_rows[:20]:
        logger.info(
            "stale | provider=%s | venue_id=%s | arrival=%s | captured_for_date=%s | age_days=%s",
            row["provider_id"],
            row["venue_id"],
            row["arrival_date"],
            row["captured_for_date"],
            age_days,
        )

    if stale_rows:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
