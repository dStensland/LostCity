#!/usr/bin/env python3
"""
Seed Yonder's sixth public-land campground wave.

Wave 6 handles special-case official campground products that are clearly real
inventory but do not fit the simpler campground queue heuristics cleanly.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_campgrounds_wave6.py
    python3 scripts/seed_yonder_public_land_campgrounds_wave6.py --apply
"""

from __future__ import annotations

import argparse
import sys
from copy import deepcopy
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from db import get_client, get_or_create_place, get_venue_by_slug

WAVE_6_CAMPGROUNDS = [
    {
        "name": "Bolding Mill Shelters (GA)",
        "slug": "bolding-mill-shelters-ga",
        "city": "Gainesville",
        "state": "GA",
        "website": "https://www.recreation.gov/camping/campgrounds/251921",
        "reservation_url": "https://www.recreation.gov/camping/campgrounds/251921",
        "short_description": "A Recreation.gov shelter-based campground product at Lake Sidney Lanier that belongs in Yonder as a special-case overnight/group-camp option rather than a generic day-use row.",
        "description": "Bolding Mill Shelters (GA) is worth adding because Recreation.gov exposes it as a distinct campground-class booking product under Lake Sidney Lanier, separate from the main Bolding Mill campground. It is not a normal tent-site field, but it is real overnight/group infrastructure with official public booking support.",
        "planning_notes": "Frame as a special-case shelter/group-camp option within the Lake Sidney Lanier booking ecosystem. Do not present it as interchangeable with standard individual campsites.",
        "parking_note": "Follow current Recreation.gov and on-site park guidance for vehicle access, shelter rules, and overnight/group use.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Official Lanier shelter-camp product with public booking support.",
        "lat": 34.3381139,
        "lng": -83.9513778,
        "parent_slug": "lake-sidney-lanier",
    },
]


def build_payload(seed: dict) -> dict:
    payload = deepcopy(seed)
    parent_slug = payload.pop("parent_slug", None)
    payload.setdefault("venue_type", "campground")
    payload.setdefault("spot_type", "campground")
    payload.setdefault("explore_category", "outdoors")
    payload.setdefault("active", True)
    if parent_slug:
        parent = get_venue_by_slug(parent_slug)
        if parent:
            payload["parent_venue_id"] = parent["id"]
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
            "reservation_url",
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
    parser = argparse.ArgumentParser(description="Seed Yonder public-land campground wave 6.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Public-Land Campground Wave 6")
    print("=" * 72)
    print(f"Mode: {'apply' if args.apply else 'dry-run'}")
    print(f"Refresh existing: {args.refresh_existing}")
    print("")

    for seed in WAVE_6_CAMPGROUNDS:
        payload = build_payload(seed)
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
