#!/usr/bin/env python3
"""
Seed Yonder's ninth public-land campground wave.

Wave 9 starts converting the highest-confidence official state-park special-
permit inventory into real graph rows instead of leaving it in the generic
`special_permit` bucket.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_campgrounds_wave9.py
    python3 scripts/seed_yonder_public_land_campgrounds_wave9.py --apply
"""

from __future__ import annotations

import argparse
import os
import sys
from copy import deepcopy
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from db import get_client, get_or_create_place, get_venue_by_slug

GA_STATE_PARK_RESERVATIONS = "https://gastateparks.reserveamerica.com/"

PARK_TARGETS = [
    {
        "name": "Stephen C Foster State Park",
        "slug": "stephen-c-foster-state-park",
        "city": "Fargo",
        "state": "GA",
        "address": "17515 GA-177",
        "website": "https://gastateparks.org/StephenCFoster",
        "lat": 30.821471699999996,
        "lng": -82.3655311,
        "short_description": "A major Okefenokee gateway park that should be a first-class Yonder anchor for swamp camping, dark skies, and southern wilderness access.",
        "description": "Stephen C Foster State Park is one of the most distinctive overnight and paddling anchors in Georgia because it sits at the Okefenokee edge and combines cabins, campsites, and swamp access. It deserves a proper park row instead of only leaking into the graph through campground fragments.",
        "planning_notes": "Use as the parent park anchor for Okefenokee-edge camping, paddling, and dark-sky discovery. The official park page currently advertises campsites, cottages, and a pioneer campground.",
        "parking_note": "Use current Georgia State Parks guidance for access, reservations, and Okefenokee-specific logistics.",
        "typical_duration_minutes": 240,
        "explore_blurb": "Okefenokee gateway state-park anchor for camping and paddling.",
        "venue_type": "park",
        "spot_type": "park",
        "explore_category": "outdoors",
        "active": True,
    }
]

CAMPGROUND_TARGETS = [
    {
        "name": "Stephen C Foster State Park Pioneer Campground",
        "slug": "stephen-c-foster-state-park-pioneer-campground",
        "city": "Fargo",
        "state": "GA",
        "address": "17515 GA-177",
        "website": "https://gastateparks.org/StephenCFoster",
        "reservation_url": GA_STATE_PARK_RESERVATIONS,
        "lat": 30.821471699999996,
        "lng": -82.3655311,
        "short_description": "A special-case pioneer campground beneath Stephen C Foster State Park that converts an official state-park camping mode into a real Yonder overnight row.",
        "description": "Stephen C Foster State Park Pioneer Campground is worth modeling because the official park page explicitly exposes it as a distinct campground type, not just generic campsite inventory. It helps Yonder represent structured special-permit camping without collapsing everything into a vague park blob.",
        "planning_notes": "Treat as a special-case state-park group/pioneer camping row rather than a standard individual campsite field. The official park page currently lists one pioneer campground.",
        "parking_note": "Use current Georgia State Parks reservation and group-camping guidance before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Official pioneer-camp row beneath Stephen C Foster State Park.",
        "parent_slug": "stephen-c-foster-state-park",
        "venue_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    }
]


def build_payload(seed: dict) -> dict:
    payload = deepcopy(seed)
    parent_slug = payload.pop("parent_slug", None)
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
    result = client.table("venues").select("*").eq("name", seed["name"]).limit(1).execute()
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
            "address",
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


def insert_venue_direct(payload: dict) -> int | None:
    client = get_client()
    result = client.table("venues").insert(payload).execute()
    if result.data:
        return result.data[0].get("id")
    return None


def upsert_seeds(seeds: list[dict], *, apply: bool, refresh_existing: bool) -> tuple[int, int, int]:
    client = get_client()
    created = 0
    updated = 0
    skipped = 0
    for seed in seeds:
        payload = build_payload(seed)
        existing = find_existing_venue(seed)
        if not existing:
            created_id = None
            if apply:
                created_id = get_or_create_place(payload)
                if created_id and not get_venue_by_slug(seed["slug"]):
                    created_id = insert_venue_direct(payload)
            print(f"{'CREATE' if apply else 'WOULD CREATE'} venue: {seed['slug']}")
            if not apply or created_id:
                created += 1
            continue
        if not refresh_existing:
            print(f"KEEP venue: {seed['slug']} (already exists)")
            skipped += 1
            continue
        updates = compute_updates(existing, payload)
        if not updates:
            print(f"KEEP venue: {seed['slug']} (no changes)")
            skipped += 1
            continue
        if apply:
            client.table("venues").update(updates).eq("id", existing["id"]).execute()
        print(f"{'UPDATE' if apply else 'WOULD UPDATE'} venue: {seed['slug']} ({len(updates)} fields)")
        updated += 1
    return created, updated, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Yonder public-land campground wave 9.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    print("=" * 72)
    print("Yonder Public-Land Campground Wave 9")
    print("=" * 72)
    print(f"Mode: {'apply' if args.apply else 'dry-run'}")
    print(f"Refresh existing: {args.refresh_existing}")
    print("")

    print("Park anchors:")
    p_created, p_updated, p_skipped = upsert_seeds(PARK_TARGETS, apply=args.apply, refresh_existing=args.refresh_existing)
    print("")
    print("Campground children:")
    c_created, c_updated, c_skipped = upsert_seeds(CAMPGROUND_TARGETS, apply=args.apply, refresh_existing=args.refresh_existing)

    print("")
    print(
        f"Summary: created={p_created + c_created} updated={p_updated + c_updated} skipped={p_skipped + c_skipped}"
    )


if __name__ == "__main__":
    main()
