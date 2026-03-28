#!/usr/bin/env python3
"""
Seed Yonder's seventh public-land campground wave.

Wave 7 resolves the last clean official-public-land campground edge case by
normalizing the OSM label `Ocmulgee Flats Camp` into the official Forest
Service concept `Ocmulgee Horse Camp`.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_campgrounds_wave7.py
    python3 scripts/seed_yonder_public_land_campgrounds_wave7.py --apply
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from copy import deepcopy
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, get_or_create_place, get_venue_by_slug

CACHE_PATH = Path(__file__).resolve().parent / ".cache" / "yonder-public-land-camp_sites.json"
FOREST_PARENT_SLUG = "chattahoochee-oconee-national-forest"
OFFICIAL_FS_URL = "https://www.fs.usda.gov/r08/chattahoochee-oconee/recreation/ocmulgee-bluff-horse-bike-and-hike-trail-system"

WAVE_7_CAMPGROUNDS = [
    {
        "source_name": "Ocmulgee Flats Camp",
        "name": "Ocmulgee Horse Camp",
        "slug": "ocmulgee-horse-camp",
        "city": "Juliette",
        "state": "GA",
        "website": OFFICIAL_FS_URL,
        "short_description": "A primitive Forest Service camp tied to the Ocmulgee Bluff Horse, Bike, and Hike Trail System that gives Yonder a clean official resolution for the last federal campground edge case.",
        "description": "Ocmulgee Horse Camp is the official Forest Service camping concept associated with the Ocmulgee Bluff Horse, Bike, and Hike Trail System. It resolves the noisier OSM label 'Ocmulgee Flats Camp' into a real public-land camping row with a defensible source path.",
        "planning_notes": "Treat as primitive dispersed camping attached to the Ocmulgee Bluff system, not as a developed book-ahead campground. Forest Service guidance notes no fee and a 14-day stay limit.",
        "parking_note": "Use current Forest Service trail-system guidance for access, camping rules, and road conditions before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Primitive Forest Service horse-camp node for the Ocmulgee Bluff system.",
    },
]


def load_probe_index() -> dict[str, dict]:
    rows = json.loads(CACHE_PATH.read_text())
    index: dict[str, dict] = {}
    for row in rows:
        tags = row.get("tags", {})
        name = (tags.get("name") or "").strip()
        if name:
            index[name.lower()] = row
    return index


def build_payload(seed: dict, probe_index: dict[str, dict], parent_id: int | None) -> dict:
    payload = deepcopy(seed)
    source_name = payload.pop("source_name", None)
    payload.setdefault("venue_type", "campground")
    payload.setdefault("spot_type", "campground")
    payload.setdefault("explore_category", "outdoors")
    payload.setdefault("active", True)
    if parent_id:
        payload["parent_venue_id"] = parent_id
    probe_row = probe_index.get((source_name or seed["name"]).lower())
    if probe_row:
        center = probe_row.get("center") or {}
        payload.setdefault("lat", probe_row.get("lat") or center.get("lat"))
        payload.setdefault("lng", probe_row.get("lon") or center.get("lon"))
    return payload


def find_existing_venue(seed: dict) -> dict | None:
    existing = get_venue_by_slug(seed["slug"])
    if existing:
        return existing
    client = get_client()
    result = client.table("places").select("*").eq("name", seed["name"]).limit(1).execute()
    if result.data:
        return result.data[0]
    return None


def compute_updates(existing: dict, payload: dict) -> dict:
    updates: dict = {}
    for key, value in payload.items():
        if value in (None, "", []):
            continue
        current = existing.get(key)
        if current in (None, "", []):
            updates[key] = value
            continue
        if key in {
            "slug",
            "city",
            "state",
            "lat",
            "lng",
            "website",
            "parent_venue_id",
            "venue_type",
            "spot_type",
            "short_description",
            "description",
            "planning_notes",
            "parking_note",
            "typical_duration_minutes",
            "explore_blurb",
            "explore_category",
        } and current != value:
            updates[key] = value
    return updates


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Yonder public-land campground wave 7.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    probe_index = load_probe_index()
    client = get_client()
    parent = get_venue_by_slug(FOREST_PARENT_SLUG)
    parent_id = parent["id"] if parent else None
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Public-Land Campground Wave 7")
    print("=" * 72)
    print(f"Mode: {'apply' if args.apply else 'dry-run'}")
    print(f"Refresh existing: {args.refresh_existing}")
    print(f"Forest parent present: {bool(parent_id)}")
    print("")

    for seed in WAVE_7_CAMPGROUNDS:
        payload = build_payload(seed, probe_index, parent_id)
        existing = find_existing_venue(seed)
        if not existing:
            created_id = None
            if args.apply:
                created_id = get_or_create_place(payload)
            print(f"{'CREATE' if args.apply else 'WOULD CREATE'} venue: {seed['slug']}")
            if not args.apply or created_id:
                created += 1
            continue
        if not args.refresh_existing:
            print(f"KEEP venue: {seed['slug']} (already exists)")
            skipped += 1
            continue
        updates = compute_updates(existing, payload)
        if not updates:
            print(f"KEEP venue: {seed['slug']} (no changes)")
            skipped += 1
            continue
        if args.apply:
            client.table("places").update(updates).eq("id", existing["id"]).execute()
        print(f"{'UPDATE' if args.apply else 'WOULD UPDATE'} venue: {seed['slug']} ({len(updates)} fields)")
        updated += 1

    print("")
    print(f"Summary: created={created} updated={updated} skipped={skipped}")


if __name__ == "__main__":
    main()
