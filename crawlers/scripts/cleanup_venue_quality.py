#!/usr/bin/env python3
"""
One-time venue data quality cleanup.

Fixes the backlog of known data quality issues:
1. Venues with addresses as names (158 known)
2. Venues outside Atlanta metro (Michigan community centers, etc.)
3. Neighborhood normalization splits
4. Duplicate venue candidates (same name + nearby coords)

Usage:
    python3 scripts/cleanup_venue_quality.py --dry-run          # Report only
    python3 scripts/cleanup_venue_quality.py --allow-production-writes  # Apply fixes
"""

import argparse
import logging
import os
import sys

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.client import get_client
from db.place_validation import validate_place_name
from neighborhood_lookup import haversine

logger = logging.getLogger(__name__)

ATLANTA_CENTER_LAT = 33.749
ATLANTA_CENTER_LNG = -84.388
METRO_RADIUS_KM = 80.0  # ~50 miles

# Canonical form → variants that exist in DB
NEIGHBORHOOD_FIXES = {
    "Virginia-Highland": ["Virginia Highland"],
    "Northwest Atlanta": ["NorthWest Atlanta"],
    "Cabbagetown": ["Cabbage Town"],
}


def fetch_all_venues(client, *, active_only: bool = True) -> list[dict]:
    """Fetch all venues in batches."""
    all_venues = []
    offset = 0
    while True:
        query = client.table("venues").select(
            "id, name, slug, city, state, lat, lng, neighborhood, active, address"
        ).order("id")
        if active_only:
            query = query.eq("active", True)
        r = query.range(offset, offset + 999).execute()
        if not r.data:
            break
        all_venues.extend(r.data)
        if len(r.data) < 1000:
            break
        offset += 1000
    return all_venues


def step1_address_as_name(client, venues: list[dict], *, write: bool = False) -> int:
    """Flag and deactivate venues with addresses as names."""
    print("\n=== Step 1: Address-as-Name Venues ===")
    flagged = []

    for v in venues:
        name_ok, reason = validate_place_name(v.get("name"))
        if not name_ok:
            flagged.append((v, reason))

    print(f"Found {len(flagged)} venues with invalid names")
    for v, reason in flagged[:20]:
        print(f"  [{v['id']}] {v.get('name', '?')!r:50s} — {reason}")
    if len(flagged) > 20:
        print(f"  ... and {len(flagged) - 20} more")

    if write and flagged:
        deactivated = 0
        for v, reason in flagged:
            try:
                client.table("venues").update({"active": False}).eq("id", v["id"]).execute()
                deactivated += 1
            except Exception as e:
                logger.error(f"Failed to deactivate venue {v['id']}: {e}")
        print(f"Deactivated {deactivated} venues")

    return len(flagged)


def step2_out_of_state(client, venues: list[dict], *, write: bool = False) -> int:
    """Flag and deactivate venues outside allowed states."""
    print("\n=== Step 2: Out-of-State Venues ===")
    flagged = []

    allowed_states = {"GA"}

    for v in venues:
        state = (v.get("state") or "").upper().strip()
        lat = v.get("lat")
        lng = v.get("lng")

        # State check — reject if state is set and not GA
        if state and state not in allowed_states:
            flagged.append((v, f"state={state}"))
            continue

        # No state + coords far from Atlanta = leaked venue
        if not state and lat and lng:
            dist_m = haversine(ATLANTA_CENTER_LAT, ATLANTA_CENTER_LNG, lat, lng)
            if dist_m > METRO_RADIUS_KM * 1000:
                flagged.append((v, f"no state, coords {dist_m/1000:.0f}km from Atlanta center"))

    print(f"Found {len(flagged)} venues outside Atlanta metro")
    for v, reason in flagged[:20]:
        print(f"  [{v['id']}] {v.get('name', '?')!r:50s} city={v.get('city','?'):15s} — {reason}")
    if len(flagged) > 20:
        print(f"  ... and {len(flagged) - 20} more")

    if write and flagged:
        deactivated = 0
        for v, reason in flagged:
            try:
                client.table("venues").update({"active": False}).eq("id", v["id"]).execute()
                deactivated += 1
            except Exception as e:
                logger.error(f"Failed to deactivate venue {v['id']}: {e}")
        print(f"Deactivated {deactivated} venues")

    return len(flagged)


def step3_neighborhood_normalization(client, venues: list[dict], *, write: bool = False) -> int:
    """Fix neighborhood naming inconsistencies."""
    print("\n=== Step 3: Neighborhood Normalization ===")
    fixed = 0

    for canonical, variants in NEIGHBORHOOD_FIXES.items():
        for variant in variants:
            matches = [v for v in venues if v.get("neighborhood") == variant]
            if matches:
                print(f"  {variant!r} → {canonical!r}: {len(matches)} venues")
                if write:
                    for v in matches:
                        try:
                            client.table("venues").update(
                                {"neighborhood": canonical}
                            ).eq("id", v["id"]).execute()
                            fixed += 1
                        except Exception as e:
                            logger.error(f"Failed to fix neighborhood for venue {v['id']}: {e}")

    if write:
        print(f"Fixed {fixed} neighborhood assignments")
    return fixed


def step4_duplicate_candidates(client, venues: list[dict], *, write: bool = False) -> int:
    """Find duplicate venue candidates (same name + nearby coords)."""
    print("\n=== Step 4: Duplicate Venue Candidates ===")

    # Build index by normalized name
    by_name: dict[str, list[dict]] = {}
    for v in venues:
        name = (v.get("name") or "").strip().lower()
        if name and len(name) > 3:
            by_name.setdefault(name, []).append(v)

    dupes = []
    for name, group in by_name.items():
        if len(group) < 2:
            continue
        # Check if any pair is within 500m
        for i, a in enumerate(group):
            for b in group[i + 1:]:
                if a.get("lat") and a.get("lng") and b.get("lat") and b.get("lng"):
                    dist = haversine(a["lat"], a["lng"], b["lat"], b["lng"])
                    if dist < 500:
                        dupes.append((a, b, dist))

    print(f"Found {len(dupes)} potential duplicate pairs")
    for a, b, dist in dupes[:15]:
        print(f"  [{a['id']}] vs [{b['id']}] {a.get('name', '?')!r:40s} dist={dist:.0f}m")
    if len(dupes) > 15:
        print(f"  ... and {len(dupes) - 15} more")

    # Duplicate merge is manual — just report, don't auto-merge
    if dupes:
        print("\n  NOTE: Duplicate merging requires manual review. Run with event count check before merging.")

    return len(dupes)


def main():
    parser = argparse.ArgumentParser(description="Venue data quality cleanup")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Report only (default)")
    parser.add_argument("--allow-production-writes", action="store_true", help="Apply fixes")
    parser.add_argument("--active-only", action="store_true", default=True, help="Only check active venues")
    args = parser.parse_args()

    write = args.allow_production_writes
    if write:
        args.dry_run = False

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    client = get_client()

    print("Fetching venues...")
    venues = fetch_all_venues(client, active_only=args.active_only)
    print(f"Loaded {len(venues)} venues")

    mode = "WRITE MODE" if write else "DRY RUN"
    print(f"\n{'=' * 60}")
    print(f"  Venue Quality Cleanup — {mode}")
    print(f"{'=' * 60}")

    bad_names = step1_address_as_name(client, venues, write=write)
    out_of_metro = step2_out_of_state(client, venues, write=write)
    hood_fixes = step3_neighborhood_normalization(client, venues, write=write)
    dupe_pairs = step4_duplicate_candidates(client, venues, write=write)

    print(f"\n{'=' * 60}")
    print(f"  Summary")
    print(f"{'=' * 60}")
    print(f"  Bad names:           {bad_names}")
    print(f"  Out of metro:        {out_of_metro}")
    print(f"  Neighborhood fixes:  {hood_fixes}")
    print(f"  Duplicate pairs:     {dupe_pairs}")


if __name__ == "__main__":
    main()
