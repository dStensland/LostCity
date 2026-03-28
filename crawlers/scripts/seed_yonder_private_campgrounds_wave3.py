#!/usr/bin/env python3
"""
Seed Yonder's third private/operator campground wave.

Wave 3 mixes one clean Recreation.gov campground with several clearly
identified Georgia operator campgrounds and RV resorts.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_private_campgrounds_wave3.py
    python3 scripts/seed_yonder_private_campgrounds_wave3.py --apply
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
        "name": "Morganton Point Campground",
        "slug": "morganton-point-campground",
        "city": "Morganton",
        "state": "GA",
        "address": "475 Lake Dr",
        "website": "https://www.recreation.gov/camping/campgrounds/234590",
        "reservation_url": "https://www.recreation.gov/camping/campgrounds/234590",
        "lat": 34.8694707,
        "lng": -84.2490964,
        "short_description": "A Recreation.gov campground on the Blue Ridge lake corridor that strengthens Yonder's north-Georgia public camping breadth.",
        "description": "Morganton Point Campground is worth adding because it is a clean public campground with a real Recreation.gov surface and a useful Blue Ridge-area overnight position. It expands Yonder's public camping coverage without relying on low-signal OSM-only interpretation.",
        "planning_notes": "Use the Recreation.gov campground page as the source of truth for reservations, seasonality, and access guidance.",
        "parking_note": "Use current Recreation.gov and local access guidance before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Blue Ridge-area public campground with Recreation.gov booking.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Albany RV Resort",
        "slug": "albany-rv-resort",
        "city": "Albany",
        "state": "GA",
        "address": "1202 Liberty Expy E",
        "website": "https://www.albanyrvresort.com/",
        "reservation_url": "https://www.albanyrvresort.com/",
        "lat": 31.5205146,
        "lng": -84.1138771,
        "short_description": "A full-hookup RV resort in Albany that makes Yonder's south-Georgia camping coverage more representative of real traveler supply.",
        "description": "Albany RV Resort belongs in the graph because it is a clear, operator-run campground with an active official site and a distinct south-Georgia use case. It broadens Yonder's inventory beyond scenic or park-first camping options.",
        "planning_notes": "Use the operator site as the source of truth for reservations, hookup details, and stay rules.",
        "parking_note": "Use current operator guidance for site setup, arrival, and amenities before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "South-Georgia full-hookup RV resort with direct booking.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Talona Ridge RV Resort",
        "slug": "talona-ridge-rv-resort",
        "city": "East Ellijay",
        "state": "GA",
        "address": "723 Highland Pkwy",
        "website": "https://www.talonaridgerv.com/",
        "reservation_url": "https://www.talonaridgerv.com/",
        "lat": 34.6535808,
        "lng": -84.4822177,
        "short_description": "A mountain-corridor RV resort in East Ellijay that adds another legitimate operator stay option to Yonder's north-Georgia layer.",
        "description": "Talona Ridge RV Resort is a strong wave-3 operator row because it has a live official site, clear RV-resort identity, and a useful position in the Ellijay corridor. It helps Yonder represent practical overnight supply near the mountain destinations people already browse.",
        "planning_notes": "Use the operator site as the booking and amenity source. Position as comfort-first RV camping rather than wilderness-first camping.",
        "parking_note": "Use current operator guidance for hookups, arrival, and resort rules before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "East Ellijay RV resort with direct operator booking.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Lake Park RV & Campground",
        "slug": "lake-park-rv-campground",
        "city": "Lake Park",
        "state": "GA",
        "address": "5300 Jewell Futch Rd",
        "website": "https://lakeparkrvcamp.com/",
        "reservation_url": "https://lakeparkrvcamp.com/",
        "lat": 30.6750034,
        "lng": -83.2191939,
        "short_description": "A south-Georgia RV and campground operation that improves Yonder's statewide overnight realism near the Florida line corridor.",
        "description": "Lake Park RV & Campground is worth adding because it is a clear operator campground with a live official site and substantial capacity. It adds more of the pragmatic overnight supply that a definitive statewide graph should acknowledge.",
        "planning_notes": "Use the operator site as the booking and amenity source.",
        "parking_note": "Use current operator guidance for hookups, arrival, and reservation policy before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "South-Georgia RV and campground operation with direct booking.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Oz Campground",
        "slug": "oz-campground",
        "city": "Unadilla",
        "state": "GA",
        "address": "50 GA-230",
        "website": "https://www.ozcampground.com/",
        "reservation_url": "https://www.ozcampground.com/",
        "lat": 32.2529934,
        "lng": -83.6144258,
        "short_description": "A distinctive middle-Georgia campground that broadens Yonder's operator coverage outside the usual mountain and lake corridors.",
        "description": "Oz Campground should be represented because it is a clearly identified Georgia campground with a live operator site and an obvious camping use case. It contributes more real statewide breadth than another marginal public-land fragment would.",
        "planning_notes": "Use the operator site as the source of truth for reservations, policies, and amenities.",
        "parking_note": "Use current operator guidance for arrival and campground rules before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Middle-Georgia campground with a distinct operator identity.",
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
    parser = argparse.ArgumentParser(description="Seed Yonder private campground wave 3.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Private Campground Wave 3")
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
