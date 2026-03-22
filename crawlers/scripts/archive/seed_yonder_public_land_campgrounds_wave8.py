#!/usr/bin/env python3
"""
Seed Yonder's eighth public-land campground wave.

Wave 8 captures the next set of high-confidence official campground rows that
still sat in the `needs_review` bucket, plus the missing James H. Floyd park
anchor needed to avoid orphaning its campground child.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_campgrounds_wave8.py
    python3 scripts/seed_yonder_public_land_campgrounds_wave8.py --apply
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

from db import get_client, get_or_create_venue, get_venue_by_slug

FOREST_PARENT_SLUG = "chattahoochee-oconee-national-forest"
GA_STATE_PARK_RESERVATIONS = "https://gastateparks.reserveamerica.com/"

PARK_TARGETS = [
    {
        "name": 'James H. "Sloppy" Floyd State Park',
        "slug": "james-h-floyd-state-park",
        "city": "Summerville",
        "state": "GA",
        "address": "2800 Sloppy Floyd Lake Rd",
        "website": "https://gastateparks.org/JamesHFloyd",
        "lat": 34.434622399999995,
        "lng": -85.3377505,
        "short_description": "A northwest Georgia state park with lakes, cottages, and camping that deserves a first-class anchor row instead of only showing up as a missing campground note.",
        "description": "James H. Floyd State Park expands Yonder's northwest Georgia outdoor graph with a quieter state-park camping and cabin option outside the most saturated mountain corridor. The official park page confirms tent, trailer, and RV sites plus backcountry camping.",
        "planning_notes": "Use as the parent park anchor for campground and cabin discovery around Summerville. The official park page currently lists electric campsites, backcountry campsites, cottages, and lake recreation.",
        "parking_note": "Use current Georgia State Parks guidance for access, reservations, and trail/lake logistics.",
        "typical_duration_minutes": 240,
        "explore_blurb": "Northwest Georgia state-park anchor with camping, lakes, and cabins.",
        "venue_type": "park",
        "spot_type": "park",
        "explore_category": "outdoors",
        "active": True,
    }
]

CAMPGROUND_TARGETS = [
    {
        "name": "Andrew's Cove Campground",
        "slug": "andrews-cove-campground",
        "city": "Helen",
        "state": "GA",
        "website": "https://www.recreation.gov/camping/campgrounds/10309337",
        "reservation_url": "https://www.recreation.gov/camping/campgrounds/10309337",
        "short_description": "A small Forest Service campground near Helen that adds a calmer creekside alternative to Yonder's busier North Georgia camping mix.",
        "description": "Andrew's Cove Campground is a compact developed campground on Andrews Creek, close to Helen but quieter than the area's heavier tourist gravity. RIDB exposes it as official campground inventory with direct hiking and fishing context.",
        "planning_notes": "Use for creekside mountain camping and quick forest getaways near Helen. Keep it framed as a small developed Forest Service campground rather than a large reservation complex.",
        "parking_note": "Use current Recreation.gov and Forest Service guidance for access, seasonal operations, and overnight rules.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Small official creekside campground near Helen.",
        "lat": 34.778228,
        "lng": -83.73751,
        "parent_slug": FOREST_PARENT_SLUG,
    },
    {
        "name": "Tate Branch Campground",
        "slug": "tate-branch-campground",
        "city": "Clayton",
        "state": "GA",
        "website": "https://www.recreation.gov/camping/campgrounds/10309540",
        "reservation_url": "https://www.recreation.gov/camping/campgrounds/10309540",
        "short_description": "A developed Tallulah River campground that strengthens Yonder's official mountain-river camping layer with another real bookable Forest Service option.",
        "description": "Tate Branch Campground is an official Tallulah River campground with developed sites and a direct Recreation.gov presence. It expands Yonder's Rabun and Clayton camping coverage with a clear public-land overnight option.",
        "planning_notes": "Use for Tallulah River corridor camping and official public-booking comparisons. The current facility page indicates reservations are required for camping.",
        "parking_note": "Use current Recreation.gov guidance for access, reservations, and river-corridor campground rules.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Official Tallulah River campground with public booking support.",
        "lat": 34.9553,
        "lng": -83.5521,
        "parent_slug": FOREST_PARENT_SLUG,
    },
    {
        "name": "Sandy Bottoms Recreation Area Campground",
        "slug": "sandy-bottoms-recreation-area-campground",
        "city": "Clayton",
        "state": "GA",
        "website": "https://www.recreation.gov/camping/campgrounds/10309501",
        "reservation_url": "https://www.recreation.gov/camping/campgrounds/10309501",
        "short_description": "A developed North Georgia river campground that broadens Yonder's official forest camping choices around Clayton.",
        "description": "Sandy Bottoms Recreation Area Campground is an official developed campground with reservation-only camping according to the live Recreation.gov facility copy. It makes Yonder's mountain-forest camping layer broader and more bookable.",
        "planning_notes": "Use for reservation-first forest camping near Clayton and for mountain-river comparisons against other developed public campgrounds.",
        "parking_note": "Use current Recreation.gov guidance for reservations, campground access, and overnight rules.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Official developed forest campground near Clayton with reservation-only camping.",
        "lat": 34.78675,
        "lng": -84.23888,
        "parent_slug": FOREST_PARENT_SLUG,
    },
    {
        "name": 'James H. "Sloppy" Floyd State Park Campground',
        "slug": "james-h-floyd-state-park-campground",
        "city": "Summerville",
        "state": "GA",
        "address": "2800 Sloppy Floyd Lake Rd",
        "website": "https://gastateparks.org/JamesHFloyd",
        "reservation_url": GA_STATE_PARK_RESERVATIONS,
        "lat": 34.434622399999995,
        "lng": -85.3377505,
        "short_description": "The campground layer beneath James H. Floyd State Park, with electric sites and backcountry campsites confirmed on the official park page.",
        "description": "James H. Floyd State Park Campground matters because the official state-park page clearly advertises electric campsites and backcountry campsites, making it a clean campground child for a park that should already be in Yonder's outdoor graph.",
        "planning_notes": "Use as the overnight child row beneath James H. Floyd State Park. The current park page advertises 24 electric campsites plus 4 backcountry campsites.",
        "parking_note": "Use current Georgia State Parks reservation and campground guidance before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Official James H. Floyd overnight row with electric and backcountry campsites.",
        "parent_slug": "james-h-floyd-state-park",
    },
]


def build_payload(seed: dict) -> dict:
    payload = deepcopy(seed)
    parent_slug = payload.pop("parent_slug", None)
    payload.setdefault("venue_type", "campground" if "campground" in payload.get("slug", "") else "park")
    payload.setdefault("spot_type", payload["venue_type"])
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
                created_id = get_or_create_venue(payload)
                # Park/campground child rows can legitimately share coordinates
                # with their parent anchor, which the generic deduper sometimes
                # collapses. If the intended slug still does not exist, insert
                # the row directly.
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
    parser = argparse.ArgumentParser(description="Seed Yonder public-land campground wave 8.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    print("=" * 72)
    print("Yonder Public-Land Campground Wave 8")
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
