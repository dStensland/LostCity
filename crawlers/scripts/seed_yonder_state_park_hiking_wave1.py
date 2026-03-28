#!/usr/bin/env python3
"""
Seed Yonder's first state-park hiking backbone wave.

Wave 1 adds F.D. Roosevelt State Park plus its main campground child and the
canonical Pine Mountain Trail route so Yonder's hiking graph captures one of
Georgia's most important state-park trail systems.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_state_park_hiking_wave1.py
    python3 scripts/seed_yonder_state_park_hiking_wave1.py --apply
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

PARK_TARGETS = [
    {
        "name": "F.D. Roosevelt State Park",
        "slug": "fd-roosevelt-state-park",
        "city": "Pine Mountain",
        "state": "GA",
        "address": "2970 GA-190",
        "website": "https://gastateparks.org/FDRoosevelt",
        "reservation_url": GA_STATE_PARK_RESERVATIONS,
        "lat": 32.8444509,
        "lng": -84.8287057,
        "short_description": "Georgia's largest state park and the backbone destination for Pine Mountain Trail hiking, camping, and backpacking weekends.",
        "description": "F.D. Roosevelt State Park should be a first-class Yonder anchor because it combines a major state-park trail system, campground access, and backpacking relevance. Leaving it out makes the hiking graph materially less credible.",
        "planning_notes": "Use as the parent park anchor for Pine Mountain Trail, campground stays, and broader west-Georgia hiking discovery.",
        "parking_note": "Use current Georgia State Parks guidance for access, trailheads, camping rules, and seasonal trail conditions.",
        "typical_duration_minutes": 300,
        "explore_blurb": "Major Pine Mountain hiking-and-camping state-park anchor.",
        "place_type": "park",
        "spot_type": "park",
        "explore_category": "outdoors",
        "active": True,
    }
]

CAMPGROUND_TARGETS = [
    {
        "name": "F.D. Roosevelt State Park Campground",
        "slug": "fd-roosevelt-state-park-campground",
        "parent_slug": "fd-roosevelt-state-park",
        "city": "Pine Mountain",
        "state": "GA",
        "address": "2970 GA-190",
        "website": "https://gastateparks.org/FDRoosevelt",
        "reservation_url": GA_STATE_PARK_RESERVATIONS,
        "lat": 32.8379693,
        "lng": -84.8153922,
        "short_description": "The main campground row beneath F.D. Roosevelt State Park, giving Yonder a real overnight child under Georgia's flagship long-trail state park.",
        "description": "F.D. Roosevelt State Park Campground should be modeled separately because the park is both a hiking anchor and a real overnight base. The official park surface clearly treats camping as a core part of the experience.",
        "planning_notes": "Use as the standard campground child for F.D. Roosevelt State Park and keep backpacking / trail-camp interpretation attached to the broader park-and-trail logic.",
        "parking_note": "Use current Georgia State Parks reservation and campground guidance before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Official campground child for F.D. Roosevelt State Park stays.",
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    }
]

TRAIL_TARGETS = [
    {
        "name": "Pine Mountain Trail",
        "slug": "pine-mountain-trail",
        "parent_slug": "fd-roosevelt-state-park",
        "city": "Pine Mountain",
        "state": "GA",
        "website": "https://gastateparks.org/FDRoosevelt/Trails",
        "lat": 32.8444509,
        "lng": -84.8287057,
        "short_description": "Georgia's signature state-park long trail, turning F.D. Roosevelt into a real route-level hiking anchor in the graph.",
        "description": "Pine Mountain Trail deserves a canonical route row because it is one of Georgia's most important named hiking systems and the clearest route-level expression of F.D. Roosevelt State Park. It should not be missing while lower-signal forest connectors are present.",
        "planning_notes": "Use as the route-level hiking row for F.D. Roosevelt State Park. Pair with campground and backpacking interpretation in user-facing guidance rather than fragmenting every segment into its own venue.",
        "parking_note": "Use current Georgia State Parks trail guidance for segment planning, route conditions, and trailhead access before promotion.",
        "typical_duration_minutes": 300,
        "explore_blurb": "Canonical long-trail route through F.D. Roosevelt State Park.",
        "place_type": "trail",
        "spot_type": "trail",
        "explore_category": "outdoors",
        "active": True,
    }
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
    parser = argparse.ArgumentParser(description="Seed Yonder state-park hiking wave 1.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    print("=" * 72)
    print("Yonder State-Park Hiking Wave 1")
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
    print("Trail rows:")
    t_created, t_updated, t_skipped = upsert_seeds(TRAIL_TARGETS, apply=args.apply, refresh_existing=args.refresh_existing)

    print("")
    print(
        f"Summary: created={p_created + c_created + t_created} "
        f"updated={p_updated + c_updated + t_updated} skipped={p_skipped + c_skipped + t_skipped}"
    )


if __name__ == "__main__":
    main()
