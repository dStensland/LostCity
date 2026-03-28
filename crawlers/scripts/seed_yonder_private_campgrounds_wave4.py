#!/usr/bin/env python3
"""
Seed Yonder's fourth private/operator campground wave.

Wave 4 lands two clean operator rows that remain high-confidence in the queue.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_private_campgrounds_wave4.py
    python3 scripts/seed_yonder_private_campgrounds_wave4.py --apply
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


CAMPGROUND_TARGETS = [
    {
        "name": "Allatoona Landing Marine Resort Campground",
        "slug": "allatoona-landing-marine-resort-campground",
        "city": "Cartersville",
        "state": "GA",
        "address": "24 Allatoona Landing Rd SE",
        "website": "https://allatoonalandingmarina.com/",
        "reservation_url": "https://allatoonalandingmarina.com/",
        "lat": 34.1092868,
        "lng": -84.7080029,
        "short_description": "A Lake Allatoona campground and marina resort that expands Yonder's operator-led lake camping supply near metro Atlanta.",
        "description": "Allatoona Landing Marine Resort Campground belongs in the graph because it is a clear operator campground with a live official site and a strong lake-resort use case. It adds real overnight supply in a corridor people already recognize.",
        "planning_notes": "Use the operator site as the source of truth for camping, marina access, and reservation details.",
        "parking_note": "Use current resort guidance for arrival, hookup, and lake-access logistics before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Lake Allatoona campground and marina resort with direct operator booking.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Camp David RV Resort",
        "slug": "camp-david-rv-resort",
        "city": "Columbus",
        "state": "GA",
        "address": "3701 S Lumpkin Rd",
        "website": "https://www.campdavidrvresort.com/",
        "reservation_url": "https://www.campdavidrvresort.com/",
        "lat": 32.378723,
        "lng": -84.958793,
        "short_description": "A Columbus-area RV resort that adds more legitimate operator inventory to Yonder's west-Georgia camping layer.",
        "description": "Camp David RV Resort is a good fit for Yonder because it is a clearly identified RV resort with a live operator site and public booking posture. It improves the statewide campground graph with another real overnight option outside the mountain-heavy north.",
        "planning_notes": "Use the operator site as the source of truth for reservations, amenities, and stay rules.",
        "parking_note": "Use current operator guidance for hookup, arrival, and reservation details before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Columbus-area RV resort with direct operator booking.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
]


def build_payload(seed: dict) -> dict:
    return deepcopy(seed)


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
            "address",
            "lat",
            "lng",
            "website",
            "reservation_url",
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
    result = client.table("places").insert(payload).execute()
    if result.data:
        return result.data[0].get("id")
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Yonder private campground wave 4.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Private Campground Wave 4")
    print("=" * 72)
    print(f"Mode: {'apply' if args.apply else 'dry-run'}")
    print(f"Refresh existing: {args.refresh_existing}")
    print("")

    for seed in CAMPGROUND_TARGETS:
        payload = build_payload(seed)
        existing = find_existing_venue(seed)
        if not existing:
            created_id = None
            if args.apply:
                created_id = get_or_create_place(payload)
                if created_id and not get_venue_by_slug(seed["slug"]):
                    created_id = insert_venue_direct(payload)
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
