#!/usr/bin/env python3
"""
Seed Yonder's fifth private/operator campground wave.

Wave 5 lands five clean operator rows that remain high-confidence in the queue.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_private_campgrounds_wave5.py
    python3 scripts/seed_yonder_private_campgrounds_wave5.py --apply
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
        "name": "Country Oaks Campground & RV",
        "slug": "country-oaks-campground-rv",
        "city": "Kingsland",
        "state": "GA",
        "address": "6 Carlton Cemetery Rd",
        "website": "http://www.countryoaksrv.com/",
        "reservation_url": "http://www.countryoaksrv.com/",
        "lat": 30.760144,
        "lng": -81.659705,
        "short_description": "A Kingsland campground and RV stop that strengthens Yonder's south-coastal overnight supply with a clear operator-led camping row.",
        "description": "Country Oaks Campground & RV belongs in the graph because it is a real Georgia campground with a live operator site, public location details, and a clear overnight use case. It gives Yonder more legitimate campground coverage near the Florida line and coastal travel corridor.",
        "planning_notes": "Use the operator site as the source of truth for hookups, amenities, and reservation details.",
        "parking_note": "Use current operator guidance for arrival, site access, and hookup logistics before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Kingsland campground and RV stop with direct operator booking.",
        "venue_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Eagle's Roost RV Resort",
        "slug": "eagles-roost-rv-resort",
        "city": "Lake Park",
        "state": "GA",
        "address": "5465 Mill Store Rd",
        "website": "https://eaglesroostrvresort.com/",
        "reservation_url": "https://eaglesroostrvresort.com/",
        "lat": 30.6695089,
        "lng": -83.2114469,
        "short_description": "A Lake Park RV resort that gives Yonder another clean overnight operator row on the I-75 south Georgia corridor.",
        "description": "Eagle's Roost RV Resort is a good Yonder fit because it is a clearly identified Georgia RV resort with a live public site and obvious overnight use. It expands the statewide campground graph with another legitimate south Georgia stop.",
        "planning_notes": "Use the operator site as the source of truth for site types, rates, and booking details.",
        "parking_note": "Use current operator guidance for arrival, pull-through access, and reservation details before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "South Georgia RV resort with direct operator booking.",
        "venue_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Georgia Peanut RV Park",
        "slug": "georgia-peanut-rv-park",
        "city": "Ashburn",
        "state": "GA",
        "address": "315 Whittle Cir",
        "website": "https://georgiapeanutrvpark.com/",
        "reservation_url": "https://georgiapeanutrvpark.com/",
        "lat": 31.7069963,
        "lng": -83.6362258,
        "short_description": "An Ashburn RV park that adds another straightforward operator campground row to Yonder's south Georgia supply.",
        "description": "Georgia Peanut RV Park belongs in the graph because it is a clearly public Georgia RV park with an identifiable official site and a straightforward overnight use case. It broadens Yonder's highway-corridor campground coverage beyond the mountain-heavy north.",
        "planning_notes": "Use the operator site as the source of truth for hookups, stay rules, and reservation details.",
        "parking_note": "Use current operator guidance for arrival, full-hookup availability, and reservation details before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Ashburn RV park with direct operator booking.",
        "venue_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Pataula Creek RV Campground",
        "slug": "pataula-creek-rv-campground",
        "city": "Fort Gaines",
        "state": "GA",
        "address": "2038 Eufaula Hwy",
        "website": "https://pataulacreekrv.com/",
        "reservation_url": "https://pataulacreekrv.com/",
        "lat": 31.7490005,
        "lng": -85.0537872,
        "short_description": "A Fort Gaines RV campground that strengthens Yonder's lake-country and west Georgia overnight supply.",
        "description": "Pataula Creek RV Campground is a good Yonder fit because it is a clearly public Georgia RV campground with a live operator site and an obvious overnight use case. It gives the graph another legitimate west Georgia camping option near the Alabama line.",
        "planning_notes": "Use the operator site as the source of truth for reservations, site mix, and stay rules.",
        "parking_note": "Use current operator guidance for arrival, hookup details, and reservation requirements before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "West Georgia RV campground with direct operator booking.",
        "venue_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
    },
    {
        "name": "Battlefield Campground & RV Park",
        "slug": "battlefield-campground-rv-park",
        "city": "Ringgold",
        "state": "GA",
        "address": "199 KOA Blvd",
        "website": "https://battlefieldcampground.square.site/",
        "reservation_url": "https://battlefieldcampground.square.site/",
        "lat": 34.9317088,
        "lng": -85.1559663,
        "short_description": "A Ringgold campground and RV park that adds another public-facing overnight stop in northwestern Georgia.",
        "description": "Battlefield Campground & RV Park belongs in the graph because it is a real Georgia campground with a live public booking site and a clear overnight use case. It helps Yonder cover another legitimate camping stop in the northwest corridor.",
        "planning_notes": "Use the operator site as the source of truth for reservations, site types, and current stay rules.",
        "parking_note": "Use current operator guidance for arrival, RV access, and reservation details before promotion.",
        "typical_duration_minutes": 1440,
        "explore_blurb": "Northwest Georgia campground and RV park with direct operator booking.",
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
    parser = argparse.ArgumentParser(description="Seed Yonder private campground wave 5.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Private Campground Wave 5")
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
