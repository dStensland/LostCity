#!/usr/bin/env python3
"""
Audit persisted Yonder inventory snapshots by provider family and stale/current split.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/audit_yonder_inventory_snapshots.py
"""

from __future__ import annotations

import logging
import sys
from collections import Counter
from pathlib import Path

from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import get_config

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    cfg = get_config()
    missing = cfg.database.missing_active_credentials()
    if missing:
        raise RuntimeError(
            f"Missing Supabase credentials for {cfg.database.active_target}: {', '.join(missing)}"
        )

    client = create_client(
        cfg.database.active_supabase_url,
        cfg.database.active_supabase_service_key,
    )
    rows = (
        client.table("venue_inventory_snapshots")
        .select("id,provider_id,inventory_scope,arrival_date,total_results,records,metadata")
        .execute()
        .data
        or []
    )
    current_view_available = True
    try:
        current_rows = (
            client.table("current_venue_inventory_snapshots")
            .select("id,provider_id,inventory_scope,arrival_date,total_results,records")
            .execute()
            .data
            or []
        )
    except Exception:
        current_rows = []
        current_view_available = False
    current_ids = {row["id"] for row in current_rows}

    counts = Counter((row["provider_id"], row["inventory_scope"]) for row in rows)
    current_counts = Counter(
        (row["provider_id"], row["inventory_scope"]) for row in current_rows
    )
    logger.info("Yonder inventory snapshot audit")
    if not current_view_available:
        logger.info("Current snapshot view unavailable; stale/current split is in fallback mode.")
    logger.info("")
    for (provider_id, inventory_scope), count in sorted(counts.items()):
        current_count = current_counts.get((provider_id, inventory_scope), 0)
        logger.info(
            "%s | %s | rows=%s | current=%s | stale=%s",
            provider_id,
            inventory_scope,
            count,
            current_count,
            count - current_count,
        )
        provider_rows = [
            row for row in rows
            if row["provider_id"] == provider_id and row["inventory_scope"] == inventory_scope
        ]
        for row in provider_rows[:5]:
            logger.info(
                "  - arrival=%s | total=%s | record_count=%s | current=%s",
                row["arrival_date"],
                row["total_results"],
                len(row["records"]) if isinstance(row["records"], list) else 0,
                "yes" if row["id"] in current_ids else "no",
            )


if __name__ == "__main__":
    main()
