#!/usr/bin/env python3
"""
Seed Yonder's first private/operator campground wave.

This wave captures obvious Georgia campground rows that already appear in the
coverage queue with clean official surfaces. The goal is breadth without
dropping the source-quality bar.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_private_campgrounds_wave1.py
    python3 scripts/seed_yonder_private_campgrounds_wave1.py --apply
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

CAMPGROUND_TARGETS = [
    {
        "name": "Stone Mountain Campground",
        "slug": "stone-mountain-campground",
        "parent_slug": "stone-mountain-park",
        "city": "Stone Mountain",
        "state": "GA",
        "address": "4003 Stonewall Jackson Dr",
        "website": "https://www.stonemountainpark.com/lodging-camping/camping.aspx",
        "reservation_url": "https://www.stonemountainpark.com/lodging-camping/camping.aspx",
        "lat": 33.8030901,
        "lng": -84.1255742,
        "short_description": "A major private-style campground inside Stone Mountain Park that should be part of Yonder's statewide camping answer, not left to long-tail search.",
        "description": "Stone Mountain Campground is one of the most obvious missing Georgia camping rows because it sits inside a major outdoor destination and offers a mainstream campground experience close to Atlanta. It should exist as a first-class campground row rather than leaking into discovery only through the park anchor.",
        "planning_notes": "Use as the campground child beneath Stone Mountain Park. The official park camping page is the operative source for reservation and amenity details.",
        "parking_note": "Use current Stone Mountain Park guidance for campground access, gate timing, and reservation requirements before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Major Atlanta-area campground inside Stone Mountain Park.",
    },
    {
        "name": "Bainbridge Riverview Campground",
        "slug": "bainbridge-riverview-campground",
        "city": "Bainbridge",
        "state": "GA",
        "address": "1000 Basin View Drive",
        "website": "https://www.bainbridgecity.com/page/bainbridge-riverview-campground",
        "reservation_url": "https://www.bainbridgecity.com/page/bainbridge-riverview-campground",
        "lat": 30.8968173,
        "lng": -84.6003364,
        "short_description": "A city-run Flint River campground that broadens Yonder's south-Georgia camping layer beyond mountains and state parks.",
        "description": "Bainbridge Riverview Campground is a strong city-operated campground row because the official City of Bainbridge page treats it as a real reservable camping product with tent and RV capability. It adds a riverfront municipal option that the current Georgia graph was missing.",
        "planning_notes": "Use the city campground page as the source of truth. The official city surface currently positions it within the Earle May Boat Basin recreation area with reservable sites for RV and tent camping.",
        "parking_note": "Use current City of Bainbridge reservation and access guidance before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "City-run Flint River campground in Bainbridge.",
    },
    {
        "name": "Beautiful Rock Campground",
        "slug": "beautiful-rock-campground",
        "city": "Rockmart",
        "state": "GA",
        "address": "130 Forsyth Lake Rd",
        "website": "https://therockrvpark.com/",
        "reservation_url": "https://therockrvpark.com/",
        "lat": 33.9696303,
        "lng": -85.0177528,
        "short_description": "A private Rockmart campground and RV park that gives Yonder a cleaner answer for west-Georgia overnight camping.",
        "description": "Beautiful Rock Campground is worth adding because it is a clear private campground operator with its own official reservation surface. It helps Yonder move beyond public-land-only coverage without lowering the source bar.",
        "planning_notes": "Use the official campground site as the operative source for current reservations, rules, and amenities.",
        "parking_note": "Use current operator guidance for arrival logistics and campsite setup before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Private Rockmart campground and RV park.",
    },
    {
        "name": "Jenny's Creek Campground",
        "slug": "jennys-creek-campground",
        "city": "Cleveland",
        "state": "GA",
        "address": "4542 US-129",
        "website": "https://www.jennyscreek.com/",
        "reservation_url": "https://www.jennyscreek.com/",
        "lat": 34.6326922,
        "lng": -83.8220894,
        "short_description": "A family campground near Cleveland that strengthens Yonder's privately operated North Georgia camping coverage.",
        "description": "Jenny's Creek Campground is a useful private-operator row because it is a clear camping destination with a dedicated official website and public-facing campground identity. It adds another approachable North Georgia overnight option outside the state-park lane.",
        "planning_notes": "Use the official campground site as the source of truth for availability, amenities, and rules. Position as a private campground option rather than a public-land stay.",
        "parking_note": "Use current operator guidance for arrival and reservation details before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Private family campground near Cleveland.",
    },
    {
        "name": "Atlanta South RV Park",
        "slug": "atlanta-south-rv-park",
        "city": "McDonough",
        "state": "GA",
        "address": "281 Mt Olive Rd",
        "website": "https://www.atlantasouthrvresort.com/",
        "reservation_url": "https://www.atlantasouthrvresort.com/",
        "lat": 33.47429,
        "lng": -84.2164928,
        "short_description": "A south-metro RV campground that gives Yonder a more realistic camping inventory picture around Atlanta's edge.",
        "description": "Atlanta South RV Park belongs in the graph because it is a clean, official private campground surface in the Atlanta orbit. It helps Yonder represent the real camping supply people will compare when they want convenience over scenic prestige.",
        "planning_notes": "Use the official operator site as the booking and amenity source. Position this row as convenience-led RV camping rather than destination-first wilderness camping.",
        "parking_note": "Use current operator guidance for check-in, hookups, and reservation policy before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "South-metro RV campground with straightforward overnight utility.",
    },
]


def build_payload(seed: dict) -> dict:
    payload = deepcopy(seed)
    parent_slug = payload.pop("parent_slug", None)
    if parent_slug:
        parent = get_venue_by_slug(parent_slug)
        if parent:
            payload["parent_venue_id"] = parent["id"]
    payload.setdefault("venue_type", "campground")
    payload.setdefault("spot_type", "campground")
    payload.setdefault("explore_category", "outdoors")
    payload.setdefault("active", True)
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Yonder private campground wave 1.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Private Campground Wave 1")
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
