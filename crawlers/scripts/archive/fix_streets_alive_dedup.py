#!/usr/bin/env python3
"""
Task 1: Fix Streets Alive March 22 duplicates.

Situation:
  - id=77113: canonical record (is_tentpole=True, source=573, no image)
  - id=66837: dupe (is_tentpole=False, has image, source=NULL)
  - id=77063: dupe (is_tentpole=False, has image, source=781)
  - id=102565: dupe (is_tentpole=False, no image, source=1226)
  - id=119116: dupe (is_tentpole=False, no image, source=1334)

Fix:
  1. Promote best available image to id=77113 (try 66837 first, then 77063).
  2. Set canonical_event_id=77113 on all four non-canonical records.

Usage:
  cd crawlers
  python scripts/fix_streets_alive_dedup.py          # dry-run (default)
  python scripts/fix_streets_alive_dedup.py --apply  # write to production
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_client

CANONICAL_ID = 77113
DUPE_IDS = [66837, 77063, 102565, 119116]
ALL_IDS = [CANONICAL_ID] + DUPE_IDS


def fetch_events(client) -> dict[int, dict]:
    resp = (
        client.table("events")
        .select("id, title, start_date, image_url, is_tentpole, source_id, canonical_event_id")
        .in_("id", ALL_IDS)
        .execute()
    )
    return {row["id"]: row for row in (resp.data or [])}


def main(apply: bool) -> None:
    client = get_client()

    print("=== Fetching current state ===")
    events = fetch_events(client)

    for eid in ALL_IDS:
        row = events.get(eid)
        if not row:
            print(f"  WARNING: event id={eid} not found in DB")
            continue
        print(
            f"  id={eid:>6}  tentpole={str(row['is_tentpole']):<5}  "
            f"source={str(row.get('source_id') or 'NULL'):<6}  "
            f"canonical_event_id={row.get('canonical_event_id') or 'NULL':<6}  "
            f"image={'YES' if row.get('image_url') else 'NO '}"
        )

    canonical = events.get(CANONICAL_ID)
    if not canonical:
        print(f"\nERROR: canonical event id={CANONICAL_ID} not in DB — aborting.")
        sys.exit(1)

    # --- Step 1: determine best image to promote ---
    current_image = canonical.get("image_url")
    best_image = current_image  # may be None

    if not best_image:
        for donor_id in [66837, 77063]:
            donor = events.get(donor_id)
            if donor and donor.get("image_url"):
                best_image = donor["image_url"]
                print(f"\n  Image source: id={donor_id} → {best_image}")
                break

    if not best_image:
        print("\n  No image found on any record — will leave image_url as-is on canonical.")
    elif best_image == current_image:
        print("\n  Canonical already has an image — no image update needed.")
    else:
        print(f"\n  Will set image_url on id={CANONICAL_ID} to: {best_image}")

    # --- Step 2: show what canonical_event_id changes we'll make ---
    print(f"\n  Will set canonical_event_id={CANONICAL_ID} on ids: {DUPE_IDS}")

    if not apply:
        print("\n[DRY RUN] No changes written. Pass --apply to execute.")
        return

    # --- Apply Step 1: promote image ---
    if best_image and best_image != current_image:
        resp = (
            client.table("events")
            .update({"image_url": best_image})
            .eq("id", CANONICAL_ID)
            .execute()
        )
        if resp.data:
            print(f"\n[APPLIED] Set image_url on id={CANONICAL_ID}")
        else:
            print(f"\n[ERROR] Image update on id={CANONICAL_ID} returned no data: {resp}")

    # --- Apply Step 2: mark dupes ---
    for dupe_id in DUPE_IDS:
        resp = (
            client.table("events")
            .update({"canonical_event_id": CANONICAL_ID})
            .eq("id", dupe_id)
            .execute()
        )
        if resp.data:
            print(f"[APPLIED] canonical_event_id={CANONICAL_ID} on id={dupe_id}")
        else:
            print(f"[ERROR] Update on id={dupe_id} returned no data: {resp}")

    # --- Verify ---
    print("\n=== Verification ===")
    events_after = fetch_events(client)
    for eid in ALL_IDS:
        row = events_after.get(eid)
        if not row:
            print(f"  id={eid}: NOT FOUND")
            continue
        print(
            f"  id={eid:>6}  canonical_event_id={str(row.get('canonical_event_id') or 'NULL'):<6}  "
            f"image={'YES' if row.get('image_url') else 'NO '}"
        )

    canonical_after = events_after.get(CANONICAL_ID)
    if canonical_after:
        ok = bool(canonical_after.get("image_url"))
        print(f"\n  Canonical id={CANONICAL_ID} has image: {'YES' if ok else 'NO'}")

    all_dupes_marked = all(
        (events_after.get(d) or {}).get("canonical_event_id") == CANONICAL_ID
        for d in DUPE_IDS
    )
    print(f"  All dupes marked with canonical_event_id={CANONICAL_ID}: {'YES' if all_dupes_marked else 'NO'}")

    if ok and all_dupes_marked:
        print("\n  Task 1 COMPLETE.")
    else:
        print("\n  Task 1 INCOMPLETE — check errors above.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fix Streets Alive March 22 duplicates")
    parser.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Write changes to production (default: dry-run)",
    )
    args = parser.parse_args()
    main(apply=args.apply)
