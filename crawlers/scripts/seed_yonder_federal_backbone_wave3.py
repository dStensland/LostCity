#!/usr/bin/env python3
"""
Seed Yonder's third federal park / recreation-area backbone wave.

Wave 3 adds outdoor-relevant federal parent anchors that improve statewide
 hiking, wildlife, paddling, and lake-recreation coverage without dragging in
 low-signal historic or non-Georgia records.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_federal_backbone_wave3.py
    python3 scripts/seed_yonder_federal_backbone_wave3.py --apply
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from db import get_client, get_or_create_venue, get_venue_by_slug

RIDB_API_KEY = (os.getenv("RIDB_API_KEY") or "").strip()
RIDB_BASE_URL = "https://ridb.recreation.gov/api/v1"

RIDB_TARGETS = {
    "banks-lake-national-wildlife-refuge": {
        "recarea_id": "1288",
        "website": "https://www.fws.gov/refuge/banks-lake",
        "city": "Lakeland",
        "short_description": "A South Georgia refuge anchor with boardwalk, paddling, and swamp-edge habitat value that broadens Yonder beyond the mountain and metro pattern.",
        "planning_notes": "Use as a wildlife, paddling, and short-walk refuge parent row for South Georgia day trips and coastal-plain exploration.",
        "explore_blurb": "South Georgia refuge anchor for boardwalks, paddling, and swamp-edge wildlife.",
    },
    "blackbeard-island-national-wildlife-refuge": {
        "recarea_id": "1308",
        "website": "https://www.fws.gov/refuge/blackbeard-island",
        "city": "Sapelo Island",
        "short_description": "A remote coastal refuge that adds barrier-island wilderness and boat-access adventure context to Yonder's Georgia coast layer.",
        "planning_notes": "Use as a boat-access coastal wilderness parent anchor. Promotion should set clear access expectations because this is not a casual roadside stop.",
        "explore_blurb": "Barrier-island refuge anchor for remote coastal wilderness.",
    },
    "harris-neck-national-wildlife-refuge": {
        "recarea_id": "1420",
        "website": "https://www.fws.gov/refuge/harris-neck",
        "city": "Townsend",
        "short_description": "A coastal refuge with strong birding, wildlife-drive, and easy-access nature value that makes Yonder's coast more usable for general outdoor discovery.",
        "planning_notes": "Use as a low-friction wildlife and birding parent anchor for the Georgia coast, especially for users who want easier access than boat-only islands.",
        "explore_blurb": "Accessible coastal refuge for birding and wildlife discovery.",
    },
    "piedmont-national-wildlife-refuge": {
        "recarea_id": "1565",
        "website": "https://www.fws.gov/refuge/piedmont",
        "city": "Juliette",
        "short_description": "A central Georgia refuge anchor that adds forest-road, wildlife, and hunting-adjacent public-land context between metro and South Georgia.",
        "planning_notes": "Use as a central-Georgia public-land parent row for wildlife drives, trails, and broader refuge discovery outside the mountain corridor.",
        "explore_blurb": "Central Georgia refuge anchor with forest and wildlife value.",
    },
    "sapelo-island-national-estuarine-research-reserve": {
        "recarea_id": "3099",
        "website": "https://gacoast.uga.edu/research/long-term-ecological-research/sapelo-island/",
        "city": "Sapelo Island",
        "short_description": "A high-distinction Georgia coast anchor that adds estuarine ecology, ferry-access exploration, and island day-trip context beyond standard beach and swamp inventory.",
        "planning_notes": "Use as a coastal science-and-nature parent anchor. Promotion should stay honest about ferry logistics and limited-access island conditions.",
        "explore_blurb": "Ferry-access estuarine reserve with strong Georgia coast distinction.",
    },
    "bond-swamp-national-wildlife-refuge": {
        "recarea_id": "4148",
        "website": "https://www.fws.gov/refuge/bond-swamp",
        "city": "Macon",
        "short_description": "A Macon-area refuge anchor that strengthens Yonder's middle-Georgia nature layer with wetland, wildlife, and low-key public-land value.",
        "planning_notes": "Use as a middle-Georgia wildlife and nature-drive parent row, especially for broadening Yonder beyond North Georgia gravity.",
        "explore_blurb": "Macon-area refuge anchor for wetlands and wildlife.",
    },
    "walter-f-george-lake": {
        "recarea_id": "449",
        "website": "https://www.sam.usace.army.mil/Missions/Civil-Works/Recreation/Walter-F-George-Lake/",
        "city": "Fort Gaines",
        "short_description": "A major west-southwest Georgia Corps lake that extends Yonder's camping, boating, and shoreline-recreation backbone deeper into the state.",
        "planning_notes": "Use as a parent lake anchor for campground, boat-ramp, fishing, and day-use nodes on the Chattahoochee border corridor.",
        "explore_blurb": "West Georgia Corps lake anchor for camping and shoreline recreation.",
    },
    "george-w-andrews-lake": {
        "recarea_id": "451",
        "website": "https://www.sam.usace.army.mil/Missions/Civil-Works/Recreation/George-W-Andrews-Lake/",
        "city": "Fort Gaines",
        "short_description": "A lower Chattahoochee Corps lake that helps Yonder cover south-facing water recreation instead of clustering everything around north-metro reservoirs.",
        "planning_notes": "Use as a southern river-lake parent anchor for fishing, boating, and quieter shoreline recreation discovery.",
        "explore_blurb": "Lower Chattahoochee lake anchor for fishing and water access.",
    },
}


def fetch_ridb_recarea(recarea_id: str) -> dict | None:
    response = requests.get(
        f"{RIDB_BASE_URL}/recareas/{recarea_id}",
        headers={"apikey": RIDB_API_KEY, "User-Agent": "LostCity Yonder Seed"},
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


def build_payload(slug: str, row: dict, config: dict) -> dict:
    return {
        "name": row.get("RecAreaName"),
        "slug": slug,
        "city": config["city"],
        "state": "GA",
        "lat": float(row["RecAreaLatitude"]) if row.get("RecAreaLatitude") not in (None, "", 0, "0") else None,
        "lng": float(row["RecAreaLongitude"]) if row.get("RecAreaLongitude") not in (None, "", 0, "0") else None,
        "venue_type": "park",
        "spot_type": "park",
        "explore_category": "outdoors",
        "active": True,
        "website": config["website"],
        "short_description": config["short_description"],
        "description": row.get("RecAreaDescription") or "",
        "planning_notes": config["planning_notes"],
        "parking_note": "Use current agency guidance for access, visitor centers, and public-land logistics.",
        "typical_duration_minutes": 240,
        "explore_blurb": config["explore_blurb"],
    }


def find_existing_venue(slug: str, name: str) -> dict | None:
    existing = get_venue_by_slug(slug)
    if existing:
        return existing
    client = get_client()
    result = client.table("venues").select("*").eq("name", name).limit(1).execute()
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
            "lat",
            "lng",
            "website",
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Yonder federal backbone wave 3.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Federal Backbone Wave 3")
    print("=" * 72)
    print(f"Mode: {'apply' if args.apply else 'dry-run'}")
    print(f"Refresh existing: {args.refresh_existing}")
    print("")

    for slug, config in RIDB_TARGETS.items():
        row = fetch_ridb_recarea(config["recarea_id"])
        if not row:
            print(f"MISS source row: {slug}")
            skipped += 1
            continue
        payload = build_payload(slug, row, config)
        existing = find_existing_venue(slug, payload["name"])
        if not existing:
            created_id = None
            if args.apply:
                created_id = get_or_create_venue(payload)
            print(f"{'CREATE' if args.apply else 'WOULD CREATE'} venue: {slug}")
            if not args.apply or created_id:
                created += 1
            continue
        if not args.refresh_existing:
            print(f"KEEP venue: {slug} (already exists)")
            skipped += 1
            continue
        updates = compute_updates(existing, payload)
        if not updates:
            print(f"KEEP venue: {slug} (no changes)")
            skipped += 1
            continue
        if args.apply:
            client.table("venues").update(updates).eq("id", existing["id"]).execute()
        print(f"{'UPDATE' if args.apply else 'WOULD UPDATE'} venue: {slug} ({len(updates)} fields)")
        updated += 1

    print("")
    print(f"Summary: created={created} updated={updated} skipped={skipped}")


if __name__ == "__main__":
    main()
