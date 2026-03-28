#!/usr/bin/env python3
"""
Seed Yonder's second private/operator campground wave.

Wave 2 mixes one high-confidence `needs_review` state-park/resort campground
lane with several clean private/operator campground rows that already have
verifiable official surfaces.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_private_campgrounds_wave2.py
    python3 scripts/seed_yonder_private_campgrounds_wave2.py --apply
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

PARK_TARGETS = [
    {
        "name": "Georgia Veterans State Park",
        "slug": "georgia-veterans-state-park",
        "city": "Cordele",
        "state": "GA",
        "address": "2459 US-280 W",
        "website": "https://gastateparks.org/GeorgiaVeterans",
        "reservation_url": "https://www.lakeblackshearresort.com/ga-veterans-park/",
        "lat": 31.958425,
        "lng": -83.89821,
        "short_description": "A Lake Blackshear state-park resort anchor that should be part of Yonder's weekend camping and lodging graph, not left as a blind spot.",
        "description": "Georgia Veterans State Park deserves a first-class anchor row because it combines a state-park identity, resort operations, campground access, cottages, and a major lake setting. It closes an obvious south-Georgia weekend gap in Yonder's park graph.",
        "planning_notes": "Use as the parent park anchor for Lake Blackshear camping and resort-style state-park stays. The official park page routes visitors to the Lake Blackshear resort operator for current stay details.",
        "parking_note": "Use current park and resort guidance for access, reservation, and activity details before promotion.",
        "typical_duration_minutes": 300,
        "explore_blurb": "Lake Blackshear state-park resort anchor for camping and weekend stays.",
        "place_type": "park",
        "spot_type": "park",
        "explore_category": "outdoors",
        "active": True,
    }
]

CAMPGROUND_TARGETS = [
    {
        "name": "Georgia Veterans State Park Campground",
        "slug": "georgia-veterans-state-park-campground",
        "parent_slug": "georgia-veterans-state-park",
        "city": "Cordele",
        "state": "GA",
        "address": "2459 US-280 W",
        "website": "https://www.lakeblackshearresort.com/ga-veterans-park/",
        "reservation_url": "https://www.lakeblackshearresort.com/ga-veterans-park/",
        "lat": 31.9517551,
        "lng": -83.9118825,
        "short_description": "The main Lake Blackshear campground row beneath Georgia Veterans State Park, converting a high-signal missing weekend into a real Yonder stay object.",
        "description": "Georgia Veterans State Park Campground should exist as a distinct row because the official park and resort surfaces clearly present campground inventory as a core overnight mode. It gives Yonder a more complete Lake Blackshear weekend story instead of leaving the campground implied.",
        "planning_notes": "Use as the standard campground child for Georgia Veterans State Park and keep cottages / lodge nuance attached to the parent park-and-resort interpretation.",
        "parking_note": "Use current resort-operated park guidance for campground reservations and arrival logistics before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Lake Blackshear campground child beneath Georgia Veterans State Park.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Blue Moon Campground",
        "slug": "blue-moon-campground",
        "city": "LaFayette",
        "state": "GA",
        "address": "2035 Old Mineral Springs Rd",
        "website": "https://bmcampground.com/",
        "reservation_url": "https://bmcampground.com/",
        "lat": 34.7279034,
        "lng": -85.296594,
        "short_description": "A clear private campground in northwest Georgia that broadens Yonder's weekend camping supply beyond public-land and state-park rows.",
        "description": "Blue Moon Campground is a good wave-2 private row because it has a dedicated official campground site, a clear campground identity, and a real Georgia overnight use case. It expands supply without lowering the source bar.",
        "planning_notes": "Use the official campground site as the source of truth for reservations, rules, and amenities.",
        "parking_note": "Use current operator guidance for arrival, hookups, and stay logistics before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Northwest Georgia private campground with direct operator booking.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Lake Harmony RV Park",
        "slug": "lake-harmony-rv-park",
        "city": "Townsend",
        "state": "GA",
        "address": "1088 Lake Harmony Dr SW",
        "website": "https://lakeharmonypark.com/",
        "reservation_url": "https://lakeharmonypark.com/",
        "lat": 31.536605,
        "lng": -81.4551976,
        "short_description": "A coastal Georgia RV park that gives Yonder more realistic south-coast overnight coverage instead of over-indexing on mountains and state parks.",
        "description": "Lake Harmony RV Park should be in the graph because it is a clear, official RV campground surface with a straightforward Georgia overnight value proposition. It helps Yonder reflect the actual shape of camping supply across the state.",
        "planning_notes": "Use the official operator site as the booking and amenity source. Position as a convenience-led RV stay rather than a wilderness-forward escape.",
        "parking_note": "Use current operator guidance for check-in, hookups, and reservation policy before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Coastal Georgia RV park with direct operator booking.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Cecil Bay RV Park",
        "slug": "cecil-bay-rv-park",
        "city": "Cecil",
        "state": "GA",
        "address": "1787 Old Coffee Rd",
        "website": "https://www.cecilbayrv.com/",
        "reservation_url": "https://www.cecilbayrv.com/",
        "lat": 31.0461888,
        "lng": -83.3991716,
        "short_description": "A south-Georgia RV park that adds more real operator supply to Yonder's statewide camping graph.",
        "description": "Cecil Bay RV Park belongs in the graph because it is a clean official campground surface with a clear RV-park identity and public booking information. It adds another legitimate operator row outside the better-covered mountain corridor.",
        "planning_notes": "Use the operator website as the source of truth for reservations and stay details.",
        "parking_note": "Use current operator guidance for site setup, hookups, and arrival before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "South-Georgia RV park with direct operator site.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "A Big Wheel RV Park",
        "slug": "a-big-wheel-rv-park",
        "city": "St. Marys",
        "state": "GA",
        "address": "6031 Charlie Smith Sr Hwy",
        "website": "https://www.abigwheelrvpark.com/",
        "reservation_url": "https://www.abigwheelrvpark.com/",
        "lat": 30.8378737,
        "lng": -81.5636498,
        "short_description": "A St. Marys RV park that strengthens Yonder's coastal camping supply near Cumberland and the southeast Georgia corridor.",
        "description": "A Big Wheel RV Park is worth adding because it is a clear private campground/RV surface with an official site and a useful southeast Georgia location. It makes the coastal overnight graph feel less sparse and less dependent on park-only supply.",
        "planning_notes": "Use the operator website as the booking and amenity source. Position as practical coastal RV camping rather than wilderness-first overnighting.",
        "parking_note": "Use current operator guidance for arrival, hookups, and park rules before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Coastal RV park near St. Marys and Cumberland access.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
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
    result = client.table("places").insert(payload).execute()
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
            client.table("places").update(updates).eq("id", existing["id"]).execute()
        print(f"{'UPDATE' if apply else 'WOULD UPDATE'} venue: {seed['slug']} ({len(updates)} fields)")
        updated += 1
    return created, updated, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Yonder private campground wave 2.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    print("=" * 72)
    print("Yonder Private Campground Wave 2")
    print("=" * 72)
    print(f"Mode: {'apply' if args.apply else 'dry-run'}")
    print(f"Refresh existing: {args.refresh_existing}")
    print("")

    print("Park anchors:")
    p_created, p_updated, p_skipped = upsert_seeds(PARK_TARGETS, apply=args.apply, refresh_existing=args.refresh_existing)
    print("")
    print("Campground rows:")
    c_created, c_updated, c_skipped = upsert_seeds(CAMPGROUND_TARGETS, apply=args.apply, refresh_existing=args.refresh_existing)
    print("")
    print(
        f"Summary: created={p_created + c_created} updated={p_updated + c_updated} skipped={p_skipped + c_skipped}"
    )


if __name__ == "__main__":
    main()
