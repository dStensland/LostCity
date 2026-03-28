#!/usr/bin/env python3
"""
Seed Yonder's sixth private/operator campground wave.

Wave 6 adds four more clean operator-facing rows from the remaining queue.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_private_campgrounds_wave6.py
    python3 scripts/seed_yonder_private_campgrounds_wave6.py --apply
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


CAMPGROUND_TARGETS = [
    {
        "name": "Coastal Georgia RV Resort",
        "slug": "coastal-georgia-rv-resort",
        "city": "Brunswick",
        "state": "GA",
        "address": "287 S Port Pkwy",
        "website": "https://www.coastalgarvresort.com/",
        "reservation_url": "https://www.coastalgarvresort.com/",
        "lat": 31.1336301,
        "lng": -81.5824312,
        "short_description": "A Brunswick RV resort that gives Yonder stronger coastal Georgia overnight supply with a clear operator-led campground row.",
        "description": "Coastal Georgia RV Resort belongs in the graph because it is a real Georgia RV resort with a live public operator site and a clear overnight use case. It strengthens Yonder's coastal inventory with another legitimate campground travelers can actually compare.",
        "planning_notes": "Use the operator site as the source of truth for site mix, rates, and reservation details.",
        "parking_note": "Use current operator guidance for arrival, hookup access, and reservation policies before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Brunswick RV resort with direct operator booking.",
        "venue_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Southern Retreat RV Park",
        "slug": "southern-retreat-rv-park",
        "city": "Brunswick",
        "state": "GA",
        "address": "7445 Blythe Island Hwy",
        "website": "http://www.southernretreatrvpark.com/",
        "reservation_url": "http://www.southernretreatrvpark.com/",
        "lat": 31.1450614,
        "lng": -81.5798568,
        "short_description": "A Brunswick RV park that gives Yonder another clean operator overnight option in the south-coastal corridor.",
        "description": "Southern Retreat RV Park is a good Yonder fit because it is a publicly discoverable Georgia RV park with a clear official site and an obvious overnight use case. It adds another legitimate campground option in a part of the state where Yonder still needs depth.",
        "planning_notes": "Use the operator site as the source of truth for site types, reservation details, and current stay rules.",
        "parking_note": "Use current operator guidance for arrival, hookups, and reservation policies before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "South-coastal Georgia RV park with direct operator booking.",
        "venue_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Inland Harbor RV Park",
        "slug": "inland-harbor-rv-park",
        "city": "Darien",
        "state": "GA",
        "address": "13566 GA-251",
        "website": "http://www.inlandharborrvpark.com/",
        "reservation_url": "http://www.inlandharborrvpark.com/",
        "lat": 31.3916573,
        "lng": -81.4466104,
        "short_description": "A Darien-area RV park that strengthens Yonder's southeast Georgia camping layer with another public-facing operator row.",
        "description": "Inland Harbor RV Park belongs in the graph because it is a clearly public Georgia RV park with an accessible operator site and a straightforward overnight use case. It adds another real southeast Georgia campground to Yonder's statewide inventory.",
        "planning_notes": "Use the operator site as the source of truth for reservations, site rules, and amenities.",
        "parking_note": "Use current operator guidance for arrival, site access, and hookup logistics before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Darien-area RV park with direct operator booking.",
        "venue_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "McIntosh Lake RV Park",
        "slug": "mcintosh-lake-rv-park",
        "city": "Townsend",
        "state": "GA",
        "address": "1045 McIntosh Lake Ln SW",
        "website": "http://www.mcintoshlakervpark.com/",
        "reservation_url": "http://www.mcintoshlakervpark.com/",
        "lat": 31.5378226,
        "lng": -81.4572752,
        "short_description": "A Townsend RV park that adds another legitimate south-coastal overnight stop to Yonder's campground graph.",
        "description": "McIntosh Lake RV Park is worth adding because it is a clearly identified Georgia RV park with a stable public web presence and a straightforward overnight use case. It broadens Yonder's campground coverage in the coastal corridor with another real comparison option.",
        "planning_notes": "Use the operator site as the source of truth for availability inquiries, stay rules, and hookup details.",
        "parking_note": "Use current operator guidance for arrival, site access, and reservation logistics before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Townsend RV park with direct operator booking.",
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
    parser = argparse.ArgumentParser(description="Seed Yonder private campground wave 6.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Private Campground Wave 6")
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
            client.table("venues").update(updates).eq("id", existing["id"]).execute()
        print(f"{'UPDATE' if args.apply else 'WOULD UPDATE'} venue: {seed['slug']} ({len(updates)} fields)")
        updated += 1

    print("")
    print(f"Summary: created={created} updated={updated} skipped={skipped}")


if __name__ == "__main__":
    main()
