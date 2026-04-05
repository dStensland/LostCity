#!/usr/bin/env python3
"""
Backfill historic_site and landmark venue types.

Many Atlanta heritage destinations are mistyped as museum, park, theater, or
artifact when their primary identity is a historic site or landmark.

Dry-run by default. Use --apply to write changes.
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db import get_client

# ─── Reclassification rules ──────────────────────────────────────────────────
# (venue_id, venue_name, current_type, target_type, reason)

RECLASSIFICATIONS = [
    # NPS sites and National Historic Landmarks → historic_site
    (221, "Martin Luther King Jr. National Historical Park", "museum", "historic_site", "NPS National Historical Park"),
    (986, "The King Center", "museum", "historic_site", "MLK memorial/tomb complex, National Historic Site"),
    (210, "Center for Civil and Human Rights", "museum", "historic_site", "Major Atlanta civil rights landmark"),
    (895, "Oakland Cemetery", "museum", "historic_site", "Atlanta's oldest public park & cemetery, heritage site"),
    (4490, "Herndon Home Museum", "museum", "historic_site", "National Historic Landmark"),
    (984, "Wrens Nest House Museum", "museum", "historic_site", "National Historic Landmark"),
    (4049, "Rhodes Hall", "museum", "historic_site", "Last surviving Peachtree St mansion, National Register"),
    (211, "Atlanta History Center", "museum", "historic_site", "Historic houses + grounds, primary heritage destination"),
    (1372, "Southern Museum of Civil War and Locomotive History", "museum", "historic_site", "Civil War + railroad heritage museum"),
    (4082, "The General Locomotive", "museum", "historic_site", "Civil War artifact in Kennesaw"),
    (4033, "Westview Cemetery", "museum", "historic_site", "Historic cemetery with notable graves"),

    # Battlefields and military sites → historic_site
    (4346, "Kennesaw Mountain National Battlefield Park", "park", "historic_site", "NPS National Battlefield"),
    (4085, "Kennesaw Mountain Battlefield Cannons", "park", "historic_site", "Civil War artifacts at battlefield"),
    (4123, "Cascade Springs Earthworks", "park", "historic_site", "Civil War earthworks"),

    # Artifacts that are actually historic sites → historic_site
    (4059, "Zero Mile Post", "artifact", "historic_site", "Founding marker of Atlanta"),
    (4092, "Marietta National Cemetery", "artifact", "historic_site", "National cemetery, 1866"),
    (4083, "Roswell Mill Ruins", "artifact", "historic_site", "Civil War ruins, burned by Sherman"),

    # Religious historic sites
    (4461, "Big Bethel AME Church", "religious", "historic_site", "Historic Auburn Ave AME church"),

    # Event spaces that are actually historic sites
    (931, "Pullman Yards", "event_space", "historic_site", "Historic Pullman rail yards"),

    # Iconic Atlanta landmarks → landmark
    (369, "Fox Theatre", "theater", "landmark", "Atlanta's most iconic architectural landmark"),
    (119, "Fox Theatre - Atlanta", "theater", "landmark", "Duplicate Fox Theatre record — same landmark"),
    (224, "Margaret Mitchell House", "museum", "landmark", "Margaret Mitchell literary landmark"),
    (4065, "The Cyclorama", "museum", "landmark", "One of world's largest paintings, Atlanta History Center"),
    (4144, "Millennium Gate Museum", "museum", "landmark", "Second largest classical monument in US"),

    # Prominent artifacts → landmark (large public monuments/walls)
    (4064, "World Athletes Monument", "artifact", "landmark", "55-foot 1996 Olympics monument"),
    (4107, "Hank Aaron Home Run Wall", "artifact", "landmark", "Original outfield wall from HR #715"),
    (4126, "East Atlanta Village Totem Pole", "artifact", "landmark", "30-foot neighborhood landmark"),
    (4124, "The Dump Apartment", "artifact", "landmark", "Margaret Mitchell's apartment"),
    (4129, "The Bridge Over Nothing", "artifact", "landmark", "Unique urban landmark on Freedom Parkway"),
]


def main():
    parser = argparse.ArgumentParser(description="Backfill historic_site / landmark venue types")
    parser.add_argument("--apply", action="store_true", help="Actually write changes (default: dry run)")
    args = parser.parse_args()

    supabase = get_client()

    # Fetch current state of all target venues
    ids = [r[0] for r in RECLASSIFICATIONS]
    result = supabase.table("places").select("id, name, place_type, active").in_("id", ids).execute()
    current = {row["id"]: row for row in result.data}

    print("=" * 70)
    print("  Historic Site / Landmark Backfill")
    print("=" * 70)

    to_update = []
    skipped = []
    already_correct = []
    not_found = []

    for venue_id, name, expected_current, target_type, reason in RECLASSIFICATIONS:
        row = current.get(venue_id)
        if not row:
            not_found.append((venue_id, name))
            continue

        actual_type = row["venue_type"]
        if actual_type == target_type:
            already_correct.append((venue_id, name, target_type))
            continue

        if actual_type != expected_current:
            skipped.append((venue_id, name, expected_current, actual_type, target_type))
            continue

        to_update.append((venue_id, name, actual_type, target_type, reason))

    # Report
    print(f"\n  Total rules:        {len(RECLASSIFICATIONS)}")
    print(f"  Already correct:    {len(already_correct)}")
    print(f"  Will update:        {len(to_update)}")
    print(f"  Skipped (mismatch): {len(skipped)}")
    print(f"  Not found:          {len(not_found)}")

    if already_correct:
        print("\n  Already correct:")
        for vid, name, vtype in already_correct:
            print(f"    [{vid:5d}] {name:<55s} type={vtype}")

    if to_update:
        print("\n  Updates:")
        for vid, name, old_type, new_type, reason in to_update:
            print(f"    [{vid:5d}] {name:<55s} {old_type} -> {new_type}  ({reason})")

    if skipped:
        print("\n  Skipped (current type doesn't match expected):")
        for vid, name, expected, actual, target in skipped:
            print(f"    [{vid:5d}] {name:<55s} expected={expected} actual={actual} target={target}")

    if not_found:
        print("\n  Not found in DB:")
        for vid, name in not_found:
            print(f"    [{vid:5d}] {name}")

    # Apply
    if args.apply and to_update:
        print(f"\n  Applying {len(to_update)} updates...")
        success = 0
        for vid, name, old_type, new_type, reason in to_update:
            try:
                supabase.table("places").update({"place_type": new_type}).eq("id", vid).execute()
                success += 1
                print(f"    OK [{vid:5d}] {name} -> {new_type}")
            except Exception as e:
                print(f"    FAIL [{vid:5d}] {name}: {e}")
        print(f"\n  Done: {success}/{len(to_update)} updated.")
    elif not args.apply and to_update:
        print("\n  Dry run — use --apply to make changes.")
    else:
        print("\n  Nothing to update.")


if __name__ == "__main__":
    main()
