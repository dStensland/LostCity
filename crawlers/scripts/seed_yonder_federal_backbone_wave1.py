#!/usr/bin/env python3
"""
Seed Yonder's first federal park / recreation-area backbone wave.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_federal_backbone_wave1.py
    python3 scripts/seed_yonder_federal_backbone_wave1.py --apply
    python3 scripts/seed_yonder_federal_backbone_wave1.py --apply --refresh-existing
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

NPS_API_KEY = (os.getenv("NPS_API_KEY") or "").strip()
RIDB_API_KEY = (os.getenv("RIDB_API_KEY") or "").strip()
NPS_BASE_URL = "https://developer.nps.gov/api/v1"
RIDB_BASE_URL = "https://ridb.recreation.gov/api/v1"

NPS_TARGETS = {
    "cumberland-island-national-seashore": {
        "park_code": "cuis",
        "website": "https://www.nps.gov/cuis/index.htm",
        "city": "St. Marys",
        "short_description": "Georgia's barrier-island national seashore and one of the strongest federal outdoor anchors Yonder can add for hiking, beaches, and backcountry camping context.",
        "planning_notes": "Use as a federal coastal destination anchor. Ferry logistics, wilderness permits, and beach-to-campground planning all ladder up under this parent row.",
        "explore_blurb": "Barrier-island national seashore with trails, wilderness camps, and major coastal value.",
    },
    "kennesaw-mountain-national-battlefield-park": {
        "park_code": "kemo",
        "website": "https://www.nps.gov/kemo/index.htm",
        "city": "Kennesaw",
        "short_description": "A major metro hiking anchor whose outdoor value extends well beyond its Civil War designation.",
        "planning_notes": "Use as a high-utility hike and overlook anchor for metro users. The historical designation matters, but the outdoor hiking utility is the main Yonder use.",
        "explore_blurb": "Major metro hiking park with strong trail and overlook value.",
    },
}

RIDB_TARGETS = {
    "chattahoochee-oconee-national-forest": {
        "recarea_id": "1040",
        "website": "https://www.fs.usda.gov/conf",
        "city": "Suches",
        "short_description": "The core federal forest backbone for North Georgia hiking, camping, waterfalls, and mountain-road-trip discovery.",
        "planning_notes": "Use as a major public-land parent anchor spanning campgrounds, waterfalls, trail systems, and mountain recreation areas across North Georgia.",
        "explore_blurb": "North Georgia's defining federal forest anchor.",
    },
    "okefenokee-national-wildlife-refuge": {
        "recarea_id": "1544",
        "website": "https://www.fws.gov/refuge/okefenokee",
        "city": "Folkston",
        "short_description": "Georgia's signature swamp wilderness anchor and a major wildlife/paddle destination that broadens Yonder beyond mountains and lakes.",
        "planning_notes": "Use as a wildlife, paddling, and swamp-ecology parent anchor. This should broaden Yonder's outdoors graph geographically and experientially.",
        "explore_blurb": "Signature swamp-wilderness anchor for paddling and wildlife discovery.",
    },
    "allatoona-lake": {
        "recarea_id": "440",
        "website": "https://www.sam.usace.army.mil/Missions/Civil-Works/Recreation/Allatoona-Lake/",
        "city": "Cartersville",
        "short_description": "A high-utility Corps lake close to metro Atlanta with boating, paddling, shoreline recreation, and campground support value.",
        "planning_notes": "Use as a major lake-recreation parent row and attach campground/day-use nodes beneath it over time.",
        "explore_blurb": "Major metro-adjacent Corps lake for water and day-use discovery.",
    },
    "lake-sidney-lanier": {
        "recarea_id": "442",
        "website": "https://www.sam.usace.army.mil/Missions/Civil-Works/Recreation/Lake-Lanier/",
        "city": "Buford",
        "short_description": "The dominant North Georgia lake-recreation anchor and an important parent row for Lanier campground and day-use inventory.",
        "planning_notes": "Use as the parent lake anchor for Lanier camping, swimming, boating, and shoreline park discovery rather than as a single monolithic destination.",
        "explore_blurb": "North Georgia's biggest lake-recreation parent anchor.",
    },
    "carters-lake": {
        "recarea_id": "443",
        "website": "https://www.sam.usace.army.mil/Missions/Civil-Works/Recreation/Carters-Lake/",
        "city": "Ellijay",
        "short_description": "A scenic mountain lake that strengthens Yonder's federal water-recreation backbone beyond the Lanier pattern.",
        "planning_notes": "Use as a parent row for hiking, paddling, and shoreline recreation around the Carters Lake system.",
        "explore_blurb": "Scenic mountain lake anchor for water and trail discovery.",
    },
}


def fetch_nps_park(park_code: str) -> dict | None:
    response = requests.get(
        f"{NPS_BASE_URL}/parks",
        params={"parkCode": park_code, "limit": "1", "api_key": NPS_API_KEY},
        headers={"User-Agent": "LostCity Yonder Seed"},
        timeout=20,
    )
    response.raise_for_status()
    data = (response.json() or {}).get("data") or []
    return data[0] if data else None


def fetch_ridb_recarea(recarea_id: str) -> dict | None:
    response = requests.get(
        f"{RIDB_BASE_URL}/recareas/{recarea_id}",
        headers={"apikey": RIDB_API_KEY, "User-Agent": "LostCity Yonder Seed"},
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


def build_nps_payload(slug: str, row: dict, config: dict) -> dict:
    return {
        "name": row.get("fullName"),
        "slug": slug,
        "city": config["city"],
        "state": "GA",
        "lat": float(row["latitude"]) if row.get("latitude") else None,
        "lng": float(row["longitude"]) if row.get("longitude") else None,
        "venue_type": "park",
        "spot_type": "park",
        "explore_category": "outdoors",
        "active": True,
        "website": config["website"],
        "short_description": config["short_description"],
        "description": row.get("description") or "",
        "planning_notes": config["planning_notes"],
        "parking_note": "Use current NPS directions and access guidance before promotion.",
        "typical_duration_minutes": 240,
        "explore_blurb": config["explore_blurb"],
    }


def build_ridb_payload(slug: str, row: dict, config: dict) -> dict:
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
        "parking_note": "Use current agency guidance for access, visitor centers, and recreation-area logistics.",
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
    parser = argparse.ArgumentParser(description="Seed Yonder federal backbone wave 1.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Federal Backbone Wave 1")
    print("=" * 72)
    print(f"Mode: {'apply' if args.apply else 'dry-run'}")
    print(f"Refresh existing: {args.refresh_existing}")
    print("")

    for slug, config in NPS_TARGETS.items():
        row = fetch_nps_park(config["park_code"])
        if not row:
            print(f"MISS source row: {slug}")
            skipped += 1
            continue
        payload = build_nps_payload(slug, row, config)
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
            client.table('venues').update(updates).eq('id', existing['id']).execute()
        print(f"{'UPDATE' if args.apply else 'WOULD UPDATE'} venue: {slug} ({len(updates)} fields)")
        updated += 1

    for slug, config in RIDB_TARGETS.items():
        row = fetch_ridb_recarea(config["recarea_id"])
        if not row:
            print(f"MISS source row: {slug}")
            skipped += 1
            continue
        payload = build_ridb_payload(slug, row, config)
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
            client.table('venues').update(updates).eq('id', existing['id']).execute()
        print(f"{'UPDATE' if args.apply else 'WOULD UPDATE'} venue: {slug} ({len(updates)} fields)")
        updated += 1

    print("")
    print(f"Summary: created={created} updated={updated} skipped={skipped}")


if __name__ == "__main__":
    main()
