#!/usr/bin/env python3
"""
Seed Yonder's seventh private/operator campground wave.

Wave 7 adds five more clean operator-facing rows from the remaining queue.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_private_campgrounds_wave7.py
    python3 scripts/seed_yonder_private_campgrounds_wave7.py --apply
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
        "name": "Huck's RV Park",
        "slug": "hucks-rv-park",
        "city": "Woodbine",
        "state": "GA",
        "address": "1979 Harrietts Bluff Rd",
        "website": "https://hucksrv.com/",
        "reservation_url": "https://hucksrv.com/",
        "lat": 30.8498959,
        "lng": -81.6667876,
        "short_description": "A Woodbine RV park that adds another clear public-facing operator campground to Yonder's coastal Georgia supply.",
        "description": "Huck's RV Park belongs in the graph because it is a publicly accessible Georgia RV park with a live operator site and a clear overnight use case. It strengthens Yonder's coastal campground layer with another legitimate stop people can actually compare.",
        "planning_notes": "Use the operator site as the source of truth for reservations, amenities, and stay rules.",
        "parking_note": "Use current operator guidance for arrival, site access, and hookup logistics before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Woodbine RV park with direct operator booking.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Walkabout Camp & RV Park",
        "slug": "walkabout-camp-rv-park",
        "city": "Woodbine",
        "state": "GA",
        "address": "742 Old Still Rd",
        "website": "https://walkaboutcamp.com/",
        "reservation_url": "https://walkaboutcamp.com/",
        "lat": 30.8403717,
        "lng": -81.6755676,
        "short_description": "A Woodbine camp and RV park that gives Yonder another legitimate overnight option in the southeast Georgia corridor.",
        "description": "Walkabout Camp & RV Park is a good Yonder fit because it is a clearly public Georgia campground with a live operator site and a straightforward overnight use case. It adds more real camping supply in a part of the state where Yonder still needs depth.",
        "planning_notes": "Use the operator site as the source of truth for site mix, reservations, and current stay rules.",
        "parking_note": "Use current operator guidance for arrival, hookups, and reservation details before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Southeast Georgia camp and RV park with direct operator booking.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Cat Head Creek RV Park",
        "slug": "cat-head-creek-rv-park",
        "city": "Townsend",
        "state": "GA",
        "address": "1334 Cox Rd SW",
        "website": "https://www.catheadcreek.com/",
        "reservation_url": "https://www.catheadcreek.com/",
        "lat": 31.4245738,
        "lng": -81.488675,
        "short_description": "A Townsend RV park that adds another public-facing overnight stop in Yonder's coastal Georgia campground layer.",
        "description": "Cat Head Creek RV Park belongs in the graph because it is a clearly public Georgia RV park with a live operator site and an obvious overnight use case. It adds another legitimate campground travelers can compare in the Townsend corridor.",
        "planning_notes": "Use the operator site as the source of truth for reservations, rates, and site details.",
        "parking_note": "Use current operator guidance for arrival, site access, and reservation policies before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Townsend RV park with direct operator booking.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Rivers End Campground & RV Park",
        "slug": "rivers-end-campground-rv-park",
        "city": "Tybee Island",
        "state": "GA",
        "address": "5 Fort Ave",
        "website": "https://riversendcampground.com/",
        "reservation_url": "https://riversendcampground.com/",
        "lat": 32.0230957,
        "lng": -80.8512206,
        "short_description": "A Tybee Island campground and RV park that gives Yonder a stronger public-facing beach-adjacent overnight option.",
        "description": "Rivers End Campground & RV Park is a strong Yonder fit because it is a clearly public Georgia campground with a live operator site and an obvious overnight use case near Tybee. It expands the graph with another destination people are likely to actively compare for coastal stays.",
        "planning_notes": "Use the operator site as the source of truth for reservations, stay rules, and campground amenities.",
        "parking_note": "Use current operator guidance for island access, arrival timing, and reservation requirements before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Tybee-adjacent campground and RV park with direct operator booking.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "341 RV Park",
        "slug": "341-rv-park",
        "city": "Hazlehurst",
        "state": "GA",
        "address": "147 Martin Luther King Jr Blvd",
        "website": "https://www.341rvpark.com/",
        "reservation_url": "https://www.341rvpark.com/",
        "lat": 31.8825092,
        "lng": -82.6002359,
        "short_description": "A Hazlehurst RV park that adds another straightforward operator overnight row to Yonder's south Georgia campground graph.",
        "description": "341 RV Park belongs in the graph because it is a clearly public Georgia RV park with a live operator site and a straightforward overnight use case. It broadens Yonder's statewide campground inventory with another real south Georgia option.",
        "planning_notes": "Use the operator site as the source of truth for reservations, site rules, and campground amenities.",
        "parking_note": "Use current operator guidance for arrival, hookups, and reservation details before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Hazlehurst RV park with direct operator booking.",
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
    parser = argparse.ArgumentParser(description="Seed Yonder private campground wave 7.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Private Campground Wave 7")
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
