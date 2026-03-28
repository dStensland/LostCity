#!/usr/bin/env python3
"""
Seed Yonder's second federal park / recreation-area backbone wave.

Wave 2 closes the remaining high-signal Corps lake anchors from the first
federal backbone audit.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_federal_backbone_wave2.py
    python3 scripts/seed_yonder_federal_backbone_wave2.py --apply
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

from db import get_client, get_or_create_place, get_venue_by_slug

RIDB_API_KEY = (os.getenv("RIDB_API_KEY") or "").strip()
RIDB_BASE_URL = "https://ridb.recreation.gov/api/v1"

RIDB_TARGETS = {
    "hartwell-lake": {
        "recarea_id": "454",
        "website": "https://www.sas.usace.army.mil/Missions/Civil-Works/Recreation/Hartwell-Lake/",
        "city": "Hartwell",
        "short_description": "A major Corps lake on Georgia's northeast edge that extends Yonder's water-recreation backbone beyond the metro and North Georgia core.",
        "planning_notes": "Use as a parent lake row for shoreline parks, campgrounds, boating, and fishing discovery in far Northeast Georgia.",
        "explore_blurb": "Major Northeast Georgia lake-recreation anchor.",
    },
    "richard-b-russell-lake": {
        "recarea_id": "455",
        "website": "https://www.sas.usace.army.mil/Missions/Civil-Works/Recreation/Richard-B-Russell-Lake/",
        "city": "Elberton",
        "short_description": "A quieter Corps lake that broadens Yonder's lake-recreation graph into East Georgia with a more low-key public-land character.",
        "planning_notes": "Use as a parent lake row for public recreation areas, shoreline access, and a less built-up alternative to the busiest Corps lakes.",
        "explore_blurb": "East Georgia Corps lake with quieter public-land character.",
    },
    "west-point-lake": {
        "recarea_id": "450",
        "website": "https://www.sam.usace.army.mil/Missions/Civil-Works/Recreation/West-Point-Lake/",
        "city": "West Point",
        "short_description": "A major west Georgia lake anchor that adds fishing, paddling, and campground support value to Yonder's federal day-use graph.",
        "planning_notes": "Use as a parent lake anchor for campground, fishing, boating, and shoreline recreation discovery on the Alabama border corridor.",
        "explore_blurb": "West Georgia Corps lake anchor for fishing and shoreline recreation.",
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
    parser = argparse.ArgumentParser(description="Seed Yonder federal backbone wave 2.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder Federal Backbone Wave 2")
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
                created_id = get_or_create_place(payload)
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
