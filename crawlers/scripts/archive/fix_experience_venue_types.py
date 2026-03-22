#!/usr/bin/env python3
"""
Fix venue_type misclassifications that break Experience feed chips.

Fixes identified by data audit 2026-03-02:
- Zoo Atlanta (park → zoo) and Georgia Aquarium (museum → aquarium) fill empty Zoos chip
- Fox Theatre (landmark → theater) reverts overshot reclassification, fills Arts chip
- Atlanta Botanical Garden (park → garden) more accurate typing
- Ameris Bank Amphitheatre (arena → amphitheater) adds 24 events to Arts chip

Dry-run by default. Use --apply to write changes.
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db import get_client

FIXES = [
    # (venue_id, venue_name, expected_current_type, target_type, reason)

    # Zoos chip — currently empty
    (215, "Zoo Atlanta", "museum", "zoo", "Atlanta's zoo; fills empty Zoos chip (32 events)"),
    (214, "Georgia Aquarium", "museum", "aquarium", "World's largest aquarium; fills Zoos chip (15 events)"),

    # Arts chip — Fox Theatre revert
    (369, "Fox Theatre", "landmark", "theater", "Revert: primary function is performing arts venue (62 events)"),
    (119, "Fox Theatre - Atlanta", "landmark", "theater", "Revert: duplicate record, same venue (52 events)"),

    # Accuracy fixes
    (213, "Atlanta Botanical Garden", "museum", "garden", "Botanical garden, not a museum"),

    # Arts chip — amphitheater
    (316, "Ameris Bank Amphitheatre", "park", "amphitheater", "Amphitheater type adds to Arts chip (24 events)"),
]


def main():
    parser = argparse.ArgumentParser(description="Fix experience venue type misclassifications")
    parser.add_argument("--apply", action="store_true", help="Actually write changes (default: dry run)")
    args = parser.parse_args()

    supabase = get_client()

    ids = [r[0] for r in FIXES]
    result = supabase.table("venues").select("id, name, venue_type, active").in_("id", ids).execute()
    current = {row["id"]: row for row in result.data}

    print("=" * 70)
    print("  Experience Venue Type Fixes")
    print("=" * 70)

    to_update = []
    skipped = []
    not_found = []

    for venue_id, name, expected_current, target_type, reason in FIXES:
        row = current.get(venue_id)
        if not row:
            not_found.append((venue_id, name))
            continue

        actual_type = row["venue_type"]
        if actual_type == target_type:
            print(f"  OK [{venue_id:5d}] {name:<45s} already {target_type}")
            continue

        if actual_type != expected_current:
            skipped.append((venue_id, name, expected_current, actual_type, target_type))
            continue

        to_update.append((venue_id, name, actual_type, target_type, reason))

    if to_update:
        print(f"\n  Updates ({len(to_update)}):")
        for vid, name, old_type, new_type, reason in to_update:
            print(f"    [{vid:5d}] {name:<45s} {old_type} -> {new_type}")
            print(f"           {reason}")

    if skipped:
        print(f"\n  Skipped (type mismatch):")
        for vid, name, expected, actual, target in skipped:
            print(f"    [{vid:5d}] {name:<45s} expected={expected} actual={actual}")

    if not_found:
        print(f"\n  Not found:")
        for vid, name in not_found:
            print(f"    [{vid:5d}] {name}")

    if args.apply and to_update:
        print(f"\n  Applying {len(to_update)} updates...")
        success = 0
        for vid, name, old_type, new_type, reason in to_update:
            try:
                supabase.table("venues").update({"venue_type": new_type}).eq("id", vid).execute()
                success += 1
                print(f"    OK [{vid:5d}] {name} -> {new_type}")
            except Exception as e:
                print(f"    FAIL [{vid:5d}] {name}: {e}")
        print(f"\n  Done: {success}/{len(to_update)} updated.")
    elif not args.apply and to_update:
        print(f"\n  Dry run — use --apply to make changes.")


if __name__ == "__main__":
    main()
