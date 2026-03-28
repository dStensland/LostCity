#!/usr/bin/env python3
"""
Backfill is_experience flag on qualifying venues.

Catches venues added after the initial migration (270_venue_experiences.sql)
that have experience-qualifying venue_types but aren't flagged.

Usage:
    python3 scripts/backfill_experience_flag.py              # dry run
    python3 scripts/backfill_experience_flag.py --apply       # apply changes
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client

# Venue types that qualify as experiences (matches migration 270)
EXPERIENCE_VENUE_TYPES = [
    # Outdoors
    "park", "trail", "garden", "zoo", "aquarium",
    # Sightseeing
    "landmark", "public_art", "viewpoint", "historic_site", "skyscraper",
    # Cultural
    "museum", "gallery",
    # Recreation
    "attraction", "arcade", "eatertainment", "bowling", "pool_hall",
    "entertainment",
    # Markets
    "farmers_market", "food_hall",
]

# Default durations by venue type (matches migration 270)
DURATION_DEFAULTS = {
    "park": 90, "trail": 90, "garden": 90,
    "zoo": 120, "aquarium": 120, "museum": 120, "attraction": 120,
    "gallery": 45, "public_art": 45, "viewpoint": 45,
    "landmark": 45, "historic_site": 45, "skyscraper": 45,
    "arcade": 90, "eatertainment": 90, "bowling": 90,
    "pool_hall": 90, "entertainment": 90,
    "farmers_market": 60, "food_hall": 60,
}


def main():
    parser = argparse.ArgumentParser(description="Backfill is_experience flag")
    parser.add_argument("--apply", action="store_true", help="Apply changes (default: dry run)")
    parser.add_argument("--city", default=None, help="Filter to a specific city")
    args = parser.parse_args()

    client = get_client()

    # Find active venues with qualifying types that aren't flagged
    query = (
        client.table("places")
        .select("id, name, place_type, city, neighborhood, is_experience, typical_duration_minutes")
        .in_("place_type", EXPERIENCE_VENUE_TYPES)
        .neq("is_active", False)
    )
    if args.city:
        query = query.eq("city", args.city)

    result = query.execute()
    venues = result.data or []

    # Split into already-flagged vs needs-flagging
    already_flagged = [v for v in venues if v.get("is_experience")]
    needs_flag = [v for v in venues if not v.get("is_experience")]
    needs_duration = [v for v in venues if v.get("is_experience") and not v.get("typical_duration_minutes")]

    print(f"\n{'='*60}")
    print(f"  Experience Venue Coverage Report")
    print(f"{'='*60}")
    print(f"  Already flagged:           {len(already_flagged)}")
    print(f"  Needs is_experience=true:  {len(needs_flag)}")
    print(f"  Needs duration estimate:   {len(needs_duration)}")
    print(f"  Total qualifying:          {len(venues)}")

    if needs_flag:
        print(f"\n  Venues to flag:")
        by_type = {}
        for v in needs_flag:
            vt = v["venue_type"] or "unknown"
            by_type.setdefault(vt, []).append(v)

        for vt in sorted(by_type.keys()):
            vlist = by_type[vt]
            print(f"\n    {vt} ({len(vlist)}):")
            for v in sorted(vlist, key=lambda x: x["name"]):
                city = v.get("city", "")
                hood = v.get("neighborhood", "")
                loc = f"{hood}, {city}" if hood else city
                print(f"      [{v['id']:>5}] {v['name']:<40} {loc}")

    if args.apply and needs_flag:
        ids = [v["id"] for v in needs_flag]
        # Batch update in chunks of 50
        updated = 0
        for i in range(0, len(ids), 50):
            chunk = ids[i:i+50]
            client.table("places").update({"is_experience": True}).in_("id", chunk).execute()
            updated += len(chunk)
        print(f"\n  Applied is_experience=true to {updated} venues.")

        # Set duration defaults for newly flagged venues
        for v in needs_flag:
            vt = v["venue_type"] or ""
            dur = DURATION_DEFAULTS.get(vt, 60)
            if not v.get("typical_duration_minutes"):
                client.table("places").update(
                    {"typical_duration_minutes": dur}
                ).eq("id", v["id"]).execute()

        print(f"  Set duration defaults for newly flagged venues.")

    # Also backfill duration for previously flagged venues missing it
    if args.apply and needs_duration:
        for v in needs_duration:
            vt = v["venue_type"] or ""
            dur = DURATION_DEFAULTS.get(vt, 60)
            client.table("places").update(
                {"typical_duration_minutes": dur}
            ).eq("id", v["id"]).execute()
        print(f"  Backfilled duration for {len(needs_duration)} existing experience venues.")

    if not args.apply and (needs_flag or needs_duration):
        print(f"\n  Dry run — use --apply to make changes.")

    print()


if __name__ == "__main__":
    main()
