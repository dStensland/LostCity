#!/usr/bin/env python3
"""
Demote stale festival dates: moves announced dates that have already passed
into pending_start/pending_end so they don't display as upcoming.

Usage:
    python3 demote_stale_festival_dates.py              # Execute updates
    python3 demote_stale_festival_dates.py --dry-run    # Preview only
"""

import argparse
import logging
from datetime import date
from supabase import create_client
from config import get_config

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def demote_stale_dates(dry_run: bool = False):
    cfg = get_config()
    sb = create_client(cfg.database.supabase_url, cfg.database.supabase_service_key)
    today = date.today().isoformat()

    # Find festivals with announced dates in the past
    resp = (
        sb.table("festivals")
        .select("slug, name, announced_start, announced_end")
        .lt("announced_end", today)
        .not_.is_("announced_start", "null")
        .execute()
    )

    stale = resp.data or []
    if not stale:
        logger.info("No stale festival dates found.")
        return

    logger.info(f"Found {len(stale)} festival(s) with stale dates:")
    for f in stale:
        logger.info(f"  {f['slug']}: {f['announced_start']} - {f['announced_end']}")

    if dry_run:
        logger.info("Dry run — no changes made.")
        return

    for f in stale:
        sb.table("festivals").update(
            {
                "pending_start": f["announced_start"],
                "pending_end": f["announced_end"],
                "announced_start": None,
                "announced_end": None,
                "date_confidence": 20,
                "date_source": "auto-demoted-stale",
            }
        ).eq("slug", f["slug"]).execute()
        logger.info(f"  Demoted: {f['slug']}")

    logger.info(f"Done. Demoted {len(stale)} festival(s).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Demote stale festival dates")
    parser.add_argument("--dry-run", action="store_true", help="Preview without changes")
    args = parser.parse_args()
    demote_stale_dates(dry_run=args.dry_run)
