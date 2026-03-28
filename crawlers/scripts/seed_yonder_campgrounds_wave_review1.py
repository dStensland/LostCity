#!/usr/bin/env python3
"""
Seed Yonder's first curated review-wave campgrounds.

This wave converts the highest-confidence `needs_review` rows that have clear
operator surfaces or strong official-place confirmation.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_campgrounds_wave_review1.py
    python3 scripts/seed_yonder_campgrounds_wave_review1.py --apply
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

FOREST_PARENT_SLUG = "chattahoochee-oconee-national-forest"

CAMPGROUND_TARGETS = [
    {
        "name": "Tallulah River Campground",
        "slug": "tallulah-river-campground",
        "parent_slug": FOREST_PARENT_SLUG,
        "city": "Clayton",
        "state": "GA",
        "address": "800 Tallulah River Rd",
        "website": "https://www.fs.usda.gov/r08/chattahoochee-oconee/recreation/tallulah-river-campground",
        "reservation_url": "https://www.fs.usda.gov/r08/chattahoochee-oconee/recreation/tallulah-river-campground",
        "lat": 34.9270449,
        "lng": -83.5434748,
        "short_description": "A high-confidence Chattahoochee-Oconee campground that should be part of Yonder's official north-Georgia camping layer.",
        "description": "Tallulah River Campground is worth promoting because it is a named forest campground with strong place resolution and a clear Chattahoochee-Oconee identity. It closes a real gap in the Rabun / north-Georgia public-land camping lane.",
        "planning_notes": "Use the official forest campground page as the source of truth for seasonality, reservation posture, and access guidance. Treat it as a canonical forest campground row, not a minor campsite fragment.",
        "parking_note": "Use current forest guidance for river-road access, campground seasonality, and stay rules before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Canonical Chattahoochee-Oconee campground near the Tallulah River corridor.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Mulberry Gap Adventure Basecamp",
        "slug": "mulberry-gap-adventure-basecamp",
        "city": "Ellijay",
        "state": "GA",
        "address": "400 Mulberry Gap Rd",
        "website": "https://www.mulberrygap.com/",
        "reservation_url": "https://www.mulberrygap.com/",
        "lat": 34.7982469,
        "lng": -84.6116604,
        "short_description": "A biking-and-basecamp operator in Ellijay that broadens Yonder beyond standard campground inventory into real outdoor stay infrastructure.",
        "description": "Mulberry Gap is a strong Yonder row because it is a legitimate outdoor basecamp with camping utility, a clear operator site, and a distinct adventure identity. It makes the graph more reflective of the actual outdoor lodging and ride-base landscape in north Georgia.",
        "planning_notes": "Use the official operator site as the source of truth for stay modes, activity emphasis, and booking details. Position as an outdoor basecamp rather than a generic campground.",
        "parking_note": "Use current operator guidance for lodging mix, trail access, and arrival details before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Ellijay outdoor basecamp for camping and mountain-bike weekends.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Yonah Mountain Campground",
        "slug": "yonah-mountain-campground",
        "city": "Cleveland",
        "state": "GA",
        "address": "3678 Helen Hwy",
        "website": "https://yonahgocamping.com/index.html",
        "reservation_url": "https://yonahgocamping.com/index.html",
        "lat": 34.6475003,
        "lng": -83.73542,
        "short_description": "A private Cleveland campground with direct operator presence that adds another realistic north-Georgia camping option to Yonder.",
        "description": "Yonah Mountain Campground is a worthwhile operator row because it has a clear campground identity, a live operator site, and a useful location in the Cleveland / Helen corridor. It improves real camping coverage instead of only scenic destination coverage.",
        "planning_notes": "Use the operator site as the booking and amenity source. Position as a practical north-Georgia campground rather than a public-land stay.",
        "parking_note": "Use current operator guidance for check-in, hookups, and stay rules before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Private Cleveland campground near the Helen / Yonah corridor.",
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Yonder curated review-wave campgrounds.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Campgrounds Review Wave 1")
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
