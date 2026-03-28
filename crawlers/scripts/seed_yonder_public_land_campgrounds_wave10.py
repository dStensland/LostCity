#!/usr/bin/env python3
"""
Seed Yonder's tenth public-land campground wave.

Wave 10 closes the most obvious campground-child depth gap under weekend anchors
that Yonder already promotes as camp-capable state-park trips.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_campgrounds_wave10.py
    python3 scripts/seed_yonder_public_land_campgrounds_wave10.py --apply
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

CAMPGROUND_TARGETS = [
    {
        "name": "Cloudland Canyon State Park Campground",
        "slug": "cloudland-canyon-state-park-campground",
        "parent_slug": "cloudland-canyon",
        "short_description": "The main overnight row beneath Cloudland Canyon, giving Yonder a real campground child under one of its flagship canyon weekends.",
        "description": "Cloudland Canyon State Park Campground should exist as its own row because Cloudland is not just a hike-and-leave destination. The official state-park surface clearly treats camping as a core stay mode alongside cottages, yurts, and backcountry options.",
        "planning_notes": "Use as the standard campground child for Cloudland weekend planning. Keep cabins, yurts, and backcountry interpretation attached to the parent stay logic rather than fragmenting them into separate venue rows.",
        "explore_blurb": "Official campground child for Cloudland Canyon weekend stays.",
    },
    {
        "name": "Vogel State Park Campground",
        "slug": "vogel-state-park-campground",
        "parent_slug": "vogel-state-park",
        "short_description": "The main campground row beneath Vogel, converting one of Yonder's core mountain weekends into a cleaner overnight graph.",
        "description": "Vogel State Park Campground should be a first-class child row because Vogel is one of the most recognizable Georgia mountain camping anchors. The official park page explicitly presents camping as part of the core stay mix.",
        "planning_notes": "Use as the standard campground child for Vogel. Keep cottages and specialty stay interpretation in the parent planning layer.",
        "explore_blurb": "Official campground child for Vogel weekend stays.",
    },
    {
        "name": "Fort Mountain State Park Campground",
        "slug": "fort-mountain-state-park-campground",
        "parent_slug": "fort-mountain-state-park",
        "short_description": "The main overnight campground row beneath Fort Mountain, strengthening Yonder's mountain-weekend child inventory.",
        "description": "Fort Mountain State Park Campground deserves a dedicated child row because the park functions as a real camp-capable weekend, not just a scenic overlook anchor. The official park surface clearly supports overnight campground use.",
        "planning_notes": "Use as the primary campground child for Fort Mountain and keep cabin interpretation at the parent level.",
        "explore_blurb": "Official campground child for Fort Mountain weekends.",
    },
    {
        "name": "Black Rock Mountain State Park Campground",
        "slug": "black-rock-mountain-state-park-campground",
        "parent_slug": "black-rock-mountain",
        "short_description": "The main campground row beneath Black Rock Mountain, giving Yonder a cleaner overnight answer for its overlook-heavy mountain park.",
        "description": "Black Rock Mountain State Park Campground should exist as a separate row because camping is one of the park's core overnight modes. It helps Yonder represent a scenic mountain weekend without flattening everything into the parent park anchor.",
        "planning_notes": "Use as the standard campground child for Black Rock Mountain. Keep cottages and backcountry nuance attached to the parent weekend interpretation.",
        "explore_blurb": "Official campground child for Black Rock Mountain stays.",
    },
    {
        "name": "Chattahoochee Bend State Park Campground",
        "slug": "chattahoochee-bend-state-park-campground",
        "parent_slug": "chattahoochee-bend-state-park",
        "short_description": "The main campground row beneath Chattahoochee Bend, making Yonder's close-in river weekend feel like a real overnight product.",
        "description": "Chattahoochee Bend State Park Campground is worth modeling separately because the park already serves as a camp-capable weekend anchor in Yonder logic. An explicit child row makes that overnight posture visible in the graph instead of implied.",
        "planning_notes": "Use as the primary campground child for Chattahoochee Bend. Keep cottages and backcountry context attached to the parent planning layer.",
        "explore_blurb": "Official campground child for Chattahoochee Bend stays.",
    },
    {
        "name": "Hard Labor Creek State Park Campground",
        "slug": "hard-labor-creek-state-park-campground",
        "parent_slug": "hard-labor-creek-state-park",
        "short_description": "The main campground row beneath Hard Labor Creek, closing an obvious overnight-child gap under a promoted weekend anchor.",
        "description": "Hard Labor Creek State Park Campground should be a distinct row because the park is already positioned as a lower-friction camping base in Yonder. The official park surface treats campground inventory as a core overnight mode.",
        "planning_notes": "Use as the standard campground child for Hard Labor Creek. Keep cabins and golf-oriented stay context attached to the parent weekend interpretation.",
        "explore_blurb": "Official campground child for Hard Labor Creek stays.",
    },
    {
        "name": "Fort Yargo State Park Campground",
        "slug": "fort-yargo-state-park-campground",
        "parent_slug": "fort-yargo-state-park",
        "short_description": "The main campground row beneath Fort Yargo, turning a broad-audience lake weekend into a cleaner overnight graph object.",
        "description": "Fort Yargo State Park Campground deserves a first-class row because the park is already a core camp-and-cabin weekend in Yonder's accommodation logic. Making the campground explicit improves both coverage and parent-child clarity.",
        "planning_notes": "Use as the standard campground child for Fort Yargo. Keep cottage and yurt-style stay interpretation attached to the parent layer.",
        "explore_blurb": "Official campground child for Fort Yargo stays.",
    },
    {
        "name": "Don Carter State Park Campground",
        "slug": "don-carter-state-park-campground",
        "parent_slug": "don-carter-state-park",
        "short_description": "The main campground row beneath Don Carter, making Yonder's lake-forward overnight lane more structurally real.",
        "description": "Don Carter State Park Campground should be represented separately because camping is central to the park's overnight profile. The official state-park surface clearly supports campground-first weekend planning alongside cabin stays.",
        "planning_notes": "Use as the standard campground child for Don Carter. Keep cabin interpretation attached to the parent stay logic.",
        "explore_blurb": "Official campground child for Don Carter stays.",
    },
    {
        "name": "Unicoi State Park Campground",
        "slug": "unicoi-state-park-campground",
        "parent_slug": "unicoi-state-park",
        "short_description": "The main campground row beneath Unicoi, separating its campsite product from the lodge-and-cabin parent anchor.",
        "description": "Unicoi State Park Campground should exist as its own row because Unicoi is one of Yonder's most important accommodation-rich weekends. A campground child lets the graph distinguish campsite inventory from lodge rooms and cabins instead of collapsing every stay mode into the parent park.",
        "planning_notes": "Use as the standard campground child for Unicoi. Keep lodge rooms and cabins attached to the parent stay logic rather than splitting them into separate venue rows.",
        "explore_blurb": "Official campground child for Unicoi stays.",
    },
]


def build_payload(seed: dict) -> dict:
    payload = deepcopy(seed)
    parent_slug = payload.pop("parent_slug")
    parent = get_venue_by_slug(parent_slug)
    if not parent:
        raise ValueError(f"Missing parent venue for {seed['slug']}: {parent_slug}")
    payload["parent_venue_id"] = parent["id"]
    payload.setdefault("city", parent.get("city"))
    payload.setdefault("state", parent.get("state"))
    payload.setdefault("address", parent.get("address"))
    payload.setdefault("lat", parent.get("lat"))
    payload.setdefault("lng", parent.get("lng"))
    payload.setdefault("website", parent.get("website"))
    payload.setdefault(
        "reservation_url",
        parent.get("website") if seed["slug"] == "unicoi-state-park-campground" else GA_STATE_PARK_RESERVATIONS,
    )
    payload.setdefault("venue_type", "campground")
    payload.setdefault("spot_type", "campground")
    payload.setdefault("explore_category", "outdoors")
    payload.setdefault("active", True)
    payload.setdefault("typical_duration_minutes", 1440)
    payload.setdefault(
        "parking_note",
        "Use the official park or booking surface for current campground access, reservation, and site-rule details before promotion.",
    )
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
    parser = argparse.ArgumentParser(description="Seed Yonder public-land campground wave 10.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Public-Land Campground Wave 10")
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
