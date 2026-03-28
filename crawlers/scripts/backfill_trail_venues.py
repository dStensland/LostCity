#!/usr/bin/env python3
"""
Identify and backfill venues that should have venue_type = 'trail'.

Searches venue name and description for trail/outdoor/path keywords,
plus a hardcoded list of known Atlanta-area trail and nature venues.

Usage:
    python3 scripts/backfill_trail_venues.py              # dry run
    python3 scripts/backfill_trail_venues.py --apply       # apply changes
    python3 scripts/backfill_trail_venues.py --portal nashville --city Nashville
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client

# Keywords in venue name or description that signal a trail-type venue.
# Matched case-insensitively against the full venue name string.
TRAIL_NAME_KEYWORDS = [
    "trail",
    "trails",
    "greenway",
    "beltline",
    "belt line",
    "silver comet",
    "chattahoochee",
    "riverwalk",
    "nature center",
    "nature preserve",
    "nature park",
    "hiking",
    "trailhead",
    "walking path",
    "multi-use path",
    "recreation path",
    "rail trail",
]

# Known Atlanta-area trail and nature venue slugs or name substrings.
# These are matched against venue slug or lowercased name for certainty.
KNOWN_TRAIL_VENUES = [
    # Atlanta BeltLine segments and access points
    "atlanta-beltline",
    "beltline",
    # Silver Comet Trail
    "silver-comet",
    "silver comet",
    # Chattahoochee
    "chattahoochee-river",
    "chattahoochee river",
    "cochran-shoals",
    "cochran shoals",
    "island-ford",
    "island ford",
    # PATH Foundation trails
    "path-foundation",
    "path foundation",
    # Stone Mountain trail
    "stone-mountain-trail",
    # Suwanee Greenway
    "suwanee-greenway",
    "suwanee greenway",
    # Kennesaw Mountain
    "kennesaw-mountain",
    "kennesaw mountain",
    # Arabia Mountain
    "arabia-mountain",
    "arabia mountain",
    # Panola Mountain
    "panola-mountain",
    "panola mountain",
    # McDaniel Farm
    "mcdaniel-farm",
    # Riverside EpiCenter (trail hub)
    "riverside-epicenter",
]

# venue_types that are already trail-adjacent — skip these (no change needed)
ALREADY_CORRECT_TYPES = {"trail", "park"}

# venue_types where we are confident enough to auto-reclassify
# (i.e., if name matches, these types are almost certainly miscategorized)
RECLASSIFIABLE_TYPES = {
    None,
    "venue",
    "organization",
    "event_space",
    "community_center",
    "park",          # park is close but trail is more accurate for linear paths
    "outdoor",
    "recreation",
    "fitness_center",
}


def is_trail_candidate(venue: dict) -> bool:
    """Return True if venue name or slug matches trail keyword signals."""
    name = (venue.get("name") or "").lower()
    slug = (venue.get("slug") or "").lower()

    # Check known venue slugs / name substrings first (high confidence)
    for known in KNOWN_TRAIL_VENUES:
        if known in slug or known in name:
            return True

    # Check keyword list against name
    for kw in TRAIL_NAME_KEYWORDS:
        if kw in name:
            return True

    return False


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Identify venues that should be venue_type='trail' and optionally update them."
    )
    parser.add_argument("--apply", action="store_true", help="Apply changes (default: dry run)")
    parser.add_argument("--portal", default="atlanta", help="Portal slug to scope query (default: atlanta)")
    parser.add_argument("--city", default="Atlanta", help="City name to scope query (default: Atlanta)")
    args = parser.parse_args()

    client = get_client()

    # Fetch all active venues for the target city.
    # We pull name, slug, venue_type, city, neighborhood so we can report clearly.
    result = (
        client.table("places")
        .select("id, name, slug, place_type, city, neighborhood, address")
        .neq("is_active", False)
        .eq("city", args.city)
        .execute()
    )
    venues = result.data or []

    if not venues:
        print(f"No active venues found for city='{args.city}'. Check --city spelling.")
        return

    # Classify venues
    candidates = []        # should become 'trail', currently something else
    already_trail = []     # already venue_type='trail'
    skipped_type = []      # keyword match but venue_type not in reclassifiable set

    for v in venues:
        if not is_trail_candidate(v):
            continue

        current_type = v.get("place_type")

        if current_type == "trail":
            already_trail.append(v)
        elif current_type in RECLASSIFIABLE_TYPES or current_type not in ALREADY_CORRECT_TYPES:
            # Anything that isn't already a park/trail and matched keywords
            if current_type not in ALREADY_CORRECT_TYPES:
                candidates.append(v)
            else:
                already_trail.append(v)
        else:
            skipped_type.append(v)

    # --- Report ---
    print(f"\n{'='*60}")
    print(f"  Trail Venue Backfill Report — {args.city}")
    print(f"{'='*60}")
    print(f"  Total active venues scanned:  {len(venues)}")
    print(f"  Already venue_type='trail':   {len(already_trail)}")
    print(f"  Candidates to update:         {len(candidates)}")
    print(f"  Skipped (type mismatch):      {len(skipped_type)}")

    if already_trail:
        print(f"\n  Already correct (trail):")
        for v in sorted(already_trail, key=lambda x: x["name"]):
            hood = v.get("neighborhood") or ""
            print(f"    [{v['id']:>5}] {v['name']:<45} type=trail  {hood}")

    if candidates:
        print(f"\n  Candidates (will be updated to venue_type='trail'):")
        for v in sorted(candidates, key=lambda x: x["name"]):
            hood = v.get("neighborhood") or ""
            current = v.get("place_type") or "NULL"
            print(f"    [{v['id']:>5}] {v['name']:<45} current={current:<20} {hood}")

    if skipped_type:
        print(f"\n  Skipped (keyword match but type not reclassifiable):")
        for v in sorted(skipped_type, key=lambda x: x["name"]):
            hood = v.get("neighborhood") or ""
            current = v.get("place_type") or "NULL"
            print(f"    [{v['id']:>5}] {v['name']:<45} type={current:<20} {hood}")

    # --- Apply ---
    if args.apply and candidates:
        ids = [v["id"] for v in candidates]
        updated = 0
        # Batch in chunks of 50 to stay within Supabase URL limits
        for i in range(0, len(ids), 50):
            chunk = ids[i : i + 50]
            client.table("places").update({"place_type": "trail"}).in_("id", chunk).execute()
            updated += len(chunk)
        print(f"\n  Applied venue_type='trail' to {updated} venues.")
    elif not args.apply and candidates:
        print(f"\n  Dry run — use --apply to make changes.")
    elif args.apply and not candidates:
        print(f"\n  Nothing to update.")

    print()


if __name__ == "__main__":
    main()
