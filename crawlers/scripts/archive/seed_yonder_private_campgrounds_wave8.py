#!/usr/bin/env python3
"""
Seed Yonder's eighth private/operator campground wave.

Wave 8 intentionally stays narrow: only rows with a stable operator surface land.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_private_campgrounds_wave8.py
    python3 scripts/seed_yonder_private_campgrounds_wave8.py --apply
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

from db import get_client, get_or_create_venue, get_venue_by_slug


CAMPGROUND_TARGETS = [
    {
        "name": "Madison RV Park",
        "slug": "madison-rv-park",
        "city": "Madison",
        "state": "GA",
        "address": "2750 Eatonton Rd",
        "website": "https://www.madisonrvga.com",
        "reservation_url": "https://www.madisonrvga.com",
        "lat": 33.5352097,
        "lng": -83.4545423,
        "short_description": "A Madison RV park that adds another clearly public-facing overnight stop in Yonder's east-central Georgia campground layer.",
        "description": "Madison RV Park belongs in the graph because it is a real Georgia RV park with a stable public operator site and a straightforward overnight use case. It broadens Yonder's statewide campground coverage with another legitimate stop outside the coast and mountains.",
        "planning_notes": "Use the operator site as the source of truth for reservations, site rules, and current stay details.",
        "parking_note": "Use current operator guidance for arrival, hookups, and reservation details before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Madison RV park with direct operator booking.",
        "venue_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Okefenokee RV Park",
        "slug": "okefenokee-rv-park",
        "city": "Homeland",
        "state": "GA",
        "address": "252 Bowery Ln",
        "website": "http://okefenokeervpark.com/",
        "reservation_url": "http://okefenokeervpark.com/",
        "lat": 30.8514762,
        "lng": -82.0191174,
        "short_description": "A Homeland RV park that gives Yonder a clearer overnight foothold near the Okefenokee corridor.",
        "description": "Okefenokee RV Park is a good Yonder fit because it is a clearly public Georgia RV park with a stable operator site and an obvious overnight use case near one of the state's more distinctive outdoor regions. It strengthens the graph with another real south Georgia comparison option.",
        "planning_notes": "Use the operator site as the source of truth for reservations, site details, and stay rules.",
        "parking_note": "Use current operator guidance for arrival, hookups, and campground amenities before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Okefenokee-area RV park with direct operator booking.",
        "venue_type": "campground",
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Yonder private campground wave 8.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Private Campground Wave 8")
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
                created_id = get_or_create_venue(payload)
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
            client.table("venues").update(updates).eq("id", existing["id"]).execute()
        print(f"{'UPDATE' if args.apply else 'WOULD UPDATE'} venue: {seed['slug']} ({len(updates)} fields)")
        updated += 1

    print("")
    print(f"Summary: created={created} updated={updated} skipped={skipped}")


if __name__ == "__main__":
    main()
