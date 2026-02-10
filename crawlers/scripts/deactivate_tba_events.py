#!/usr/bin/env python3
"""
Deactivate TBA events that are missing start_time after enrichment.

This script moves future events with no start_time to year 2099 so they
don't appear in feeds. These are typically events that haven't been fully
announced yet (TBA/TBD listings).

Usage:
    python scripts/deactivate_tba_events.py           # Run deactivation
    python scripts/deactivate_tba_events.py --dry-run # Preview only
"""

import argparse
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, deactivate_tba_events
from datetime import datetime
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def preview_tba_events():
    """Preview events that would be deactivated."""
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")

    result = client.table("events").select(
        "id, title, start_date, venue_id, source_id, category"
    ).gte(
        "start_date", today
    ).is_("start_time", "null").eq("is_all_day", False).execute()

    if not result.data:
        print("\n✓ No TBA events found (all events have start_time or are all-day)")
        return []

    events = result.data
    print(f"\n⚠️  Found {len(events)} TBA events (missing start_time):\n")

    # Group by category
    by_category = {}
    for event in events:
        cat = event.get("category") or "uncategorized"
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(event)

    for cat in sorted(by_category.keys()):
        print(f"  {cat.upper()} ({len(by_category[cat])} events):")
        for event in sorted(by_category[cat][:5], key=lambda e: e.get("start_date", "")):
            title = event.get("title", "Untitled")[:60]
            date = event.get("start_date", "N/A")
            print(f"    - {title} ({date})")
        if len(by_category[cat]) > 5:
            print(f"    ... and {len(by_category[cat]) - 5} more")
        print()

    return events


def main():
    parser = argparse.ArgumentParser(
        description="Deactivate TBA events missing start_time"
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Preview events without deactivating"
    )
    args = parser.parse_args()

    if args.dry_run:
        events = preview_tba_events()
        if events:
            print(f"\n[DRY RUN] Would deactivate {len(events)} events")
        return 0

    print("Scanning for TBA events...")
    count = deactivate_tba_events()

    if count > 0:
        print(f"\n✓ Deactivated {count} TBA events (moved to year 2099)")
        print("  These events will not appear in feeds until they have a start_time")
    else:
        print("\n✓ No TBA events found - all events have start_time or are all-day")

    return 0


if __name__ == "__main__":
    sys.exit(main())
