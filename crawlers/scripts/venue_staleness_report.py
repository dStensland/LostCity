#!/usr/bin/env python3
"""
Venue staleness report — shows verification status across all venues.

Identifies venues that have never been verified (referenced by a crawler)
and venues that haven't been seen in over 90 days.

Usage:
    python3 scripts/venue_staleness_report.py
    python3 scripts/venue_staleness_report.py --csv stale_venues.csv
"""

import argparse
import csv
import logging
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.client import get_client

logger = logging.getLogger(__name__)

STALE_THRESHOLD_DAYS = 90


def fetch_all_venues(client) -> list[dict]:
    """Fetch all active venues with verification timestamps."""
    all_venues = []
    offset = 0
    while True:
        r = (
            client.table("places")
            .select("id, name, slug, place_type, neighborhood, city, verified_at, created_at, active")
            .eq("is_active", True)
            .order("id")
            .range(offset, offset + 999)
            .execute()
        )
        if not r.data:
            break
        all_venues.extend(r.data)
        if len(r.data) < 1000:
            break
        offset += 1000
    return all_venues


def main():
    parser = argparse.ArgumentParser(description="Venue staleness report")
    parser.add_argument("--csv", help="Export stale venues to CSV file")
    parser.add_argument("--threshold", type=int, default=STALE_THRESHOLD_DAYS,
                        help=f"Days before a venue is considered stale (default: {STALE_THRESHOLD_DAYS})")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    client = get_client()

    print("Fetching venues...")
    venues = fetch_all_venues(client)
    print(f"Loaded {len(venues)} active venues\n")

    now = datetime.utcnow()
    stale_cutoff = now - timedelta(days=args.threshold)

    never_verified = []
    stale = []
    recently_verified = []

    for v in venues:
        verified_at = v.get("verified_at")
        if not verified_at:
            never_verified.append(v)
        else:
            try:
                verified_dt = datetime.fromisoformat(verified_at.replace("Z", "+00:00")).replace(tzinfo=None)
                if verified_dt < stale_cutoff:
                    stale.append(v)
                else:
                    recently_verified.append(v)
            except (ValueError, TypeError):
                never_verified.append(v)

    # Print report
    print("Venue Staleness Report")
    print("-" * 40)
    print(f"Never verified:     {len(never_verified):>5} venues ({len(never_verified)*100//len(venues)}%)")
    print(f"Stale (>{args.threshold} days):  {len(stale):>5} venues")
    print(f"Recently verified:  {len(recently_verified):>5} venues")
    print()

    # Breakdown by venue_type
    type_counts: dict[str, int] = {}
    for v in never_verified:
        vtype = v.get("place_type") or "unknown"
        type_counts[vtype] = type_counts.get(vtype, 0) + 1

    if type_counts:
        print("Top never-verified venue types:")
        for vtype, count in sorted(type_counts.items(), key=lambda x: -x[1])[:10]:
            print(f"  {vtype:25s} {count:>5} never verified")

    # CSV export
    if args.csv:
        export = never_verified + stale
        with open(args.csv, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "id", "name", "slug", "venue_type", "neighborhood", "city",
                "verified_at", "created_at", "status"
            ])
            writer.writeheader()
            for v in never_verified:
                writer.writerow({**v, "status": "never_verified"})
            for v in stale:
                writer.writerow({**v, "status": "stale"})
        print(f"\nExported {len(export)} venues to {args.csv}")


if __name__ == "__main__":
    main()
