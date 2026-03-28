#!/usr/bin/env python3
"""
One-time data retrofit: convert full-name day keys to 3-letter abbreviated keys.

Fixes ~111 venues where hours were stored with keys like "monday" instead of
"mon", which the frontend hours.ts expects.

Also backfills hours_source for venues that have hours but no source tracking.

Usage:
    python fix_hours_day_keys.py --dry-run     # Preview changes
    python fix_hours_day_keys.py               # Apply changes
"""

import sys
import logging
import argparse
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client
from hours_utils import normalize_hours, format_hours_display

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Full day names that indicate the bug
FULL_DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def fix_day_keys(dry_run: bool = False):
    """Find and fix venues with full-name day keys in hours JSON."""
    client = get_client()

    # Fetch all venues that have hours
    result = client.table("places").select(
        "id, name, hours, hours_source, last_verified_at"
    ).eq("active", True).not_.is_("hours", "null").execute()

    venues = result.data or []
    logger.info(f"Found {len(venues)} venues with hours data")

    fixed = 0
    backfilled_source = 0
    skipped = 0

    for venue in venues:
        hours = venue.get("hours")
        if not hours or not isinstance(hours, dict):
            continue

        venue_id = venue["id"]
        name = venue["name"]

        # Check if any key is a full day name
        has_full_names = any(k in FULL_DAY_NAMES for k in hours.keys())

        if has_full_names:
            normalized = normalize_hours(hours)
            if not normalized:
                logger.info(f"  SKIP: {name} (id={venue_id}) — normalization returned empty")
                skipped += 1
                continue

            display = format_hours_display(normalized)

            if dry_run:
                old_keys = sorted(hours.keys())
                new_keys = sorted(normalized.keys())
                logger.info(f"  FIX: {name} (id={venue_id})")
                logger.info(f"       {old_keys} → {new_keys}")
                logger.info(f"       Display: {display}")
            else:
                updates = {"hours": normalized}
                if display:
                    updates["hours_display"] = display
                client.table("places").update(updates).eq("id", venue_id).execute()
                logger.info(f"  FIXED: {name} (id={venue_id})")

            fixed += 1

        # Backfill hours_source if missing
        if not venue.get("hours_source"):
            source = "website" if venue.get("last_verified_at") else None
            if source:
                if not dry_run:
                    now = datetime.now(timezone.utc).isoformat()
                    client.table("places").update({
                        "hours_source": source,
                        "hours_updated_at": now,
                    }).eq("id", venue_id).execute()
                backfilled_source += 1

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Day keys fixed: {fixed}")
    logger.info(f"Sources backfilled: {backfilled_source}")
    logger.info(f"Skipped: {skipped}")
    if dry_run:
        logger.info("(Dry run — no changes made)")


def main():
    parser = argparse.ArgumentParser(description="Fix hours day keys from full names to abbreviations")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to DB")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("Hours Day Key Retrofit")
    logger.info("=" * 60)
    logger.info("")

    fix_day_keys(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
