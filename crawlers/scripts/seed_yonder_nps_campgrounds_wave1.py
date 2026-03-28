#!/usr/bin/env python3
"""
Seed Yonder's first NPS campground wave into the shared venue graph.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_nps_campgrounds_wave1.py
    python3 scripts/seed_yonder_nps_campgrounds_wave1.py --apply
    python3 scripts/seed_yonder_nps_campgrounds_wave1.py --apply --refresh-existing
"""

from __future__ import annotations

import argparse
import os
import sys
from copy import deepcopy
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from db import get_client, get_or_create_place, get_venue_by_slug
from utils import slugify

NPS_API_KEY = (os.getenv("NPS_API_KEY") or "").strip()
NPS_BASE_URL = "https://developer.nps.gov/api/v1"

TARGETS = {
    "hickory-hill-wilderness-campsite": {
        "park_code": "cuis",
        "website": "https://www.nps.gov/cuis/planyourvisit/hickoryhill.htm",
        "short_description": "A Cumberland Island wilderness campsite that deepens Yonder's official barrier-island camping coverage beyond the first NPS seed rows.",
        "planning_notes": "Reservation and ferry planning matter. Treat as wilderness camping with stronger logistics than drive-up public campgrounds.",
        "explore_blurb": "Official Cumberland Island wilderness campsite with real NPS planning depth.",
        "typical_duration_minutes": 1440,
    },
    "sea-camp-campground": {
        "park_code": "cuis",
        "website": "https://www.nps.gov/cuis/planyourvisit/seacamp.htm",
        "short_description": "The most accessible frontcountry campground on Cumberland Island and a high-value official camping row for Georgia coastal coverage.",
        "planning_notes": "Best used for official Cumberland Island camping comparisons. Ferry timing, reservation windows, and island logistics are core planning constraints.",
        "explore_blurb": "Official Cumberland Island frontcountry campground with strong coastal value.",
        "typical_duration_minutes": 1440,
    },
    "stafford-beach-campground": {
        "park_code": "cuis",
        "website": "https://www.nps.gov/cuis/planyourvisit/staffordbeach.htm",
        "short_description": "A Cumberland Island backcountry campground that broadens Yonder's official coastal camping graph with a more committed overnight option.",
        "planning_notes": "Use for backcountry-style coastal camping. Reservation, ferry coordination, and gear planning are essential.",
        "explore_blurb": "Official Cumberland Island backcountry campground for more committed coastal trips.",
        "typical_duration_minutes": 1440,
    },
    "yankee-paradise-wilderness-campsite": {
        "park_code": "cuis",
        "website": "https://www.nps.gov/cuis/planyourvisit/yankeeparadise.htm",
        "short_description": "A remote Cumberland Island wilderness campsite that adds serious backcountry character to Yonder's federal camping layer.",
        "planning_notes": "Treat as a wilderness camping row with high logistics and low amenities. Reservation and island access planning are mandatory.",
        "explore_blurb": "Official remote Cumberland Island wilderness campsite.",
        "typical_duration_minutes": 1440,
    },
}


def fetch_nps_campgrounds() -> dict[str, dict]:
    rows: dict[str, dict] = {}
    if not NPS_API_KEY:
        raise SystemExit("NPS_API_KEY not set")
    for park_code in sorted({v["park_code"] for v in TARGETS.values()}):
        response = requests.get(
            f"{NPS_BASE_URL}/campgrounds",
            params={"parkCode": park_code, "limit": "50", "api_key": NPS_API_KEY},
            headers={"User-Agent": "LostCity Yonder Seed"},
            timeout=20,
        )
        response.raise_for_status()
        for row in (response.json() or {}).get("data") or []:
            slug = slugify(row.get("name") or "")
            rows[slug] = row
    return rows


def build_payload(slug: str, row: dict, config: dict) -> dict:
    description = row.get("description") or ""
    reservation_url = row.get("reservationUrl")
    return {
        "name": row.get("name"),
        "slug": slug,
        "city": "St. Marys" if row.get("parkCode") == "cuis" else "Middlesboro",
        "state": "GA",
        "lat": float(row["latitude"]) if row.get("latitude") else None,
        "lng": float(row["longitude"]) if row.get("longitude") else None,
        "place_type": "campground",
        "spot_type": "campground",
        "explore_category": "outdoors",
        "active": True,
        "website": config["website"],
        "reservation_url": reservation_url,
        "short_description": config["short_description"],
        "description": description,
        "planning_notes": config["planning_notes"],
        "parking_note": "Follow current NPS campground, ferry, and access guidance before promotion.",
        "typical_duration_minutes": config["typical_duration_minutes"],
        "explore_blurb": config["explore_blurb"],
    }


def find_existing_venue(slug: str, name: str) -> dict | None:
    existing = get_venue_by_slug(slug)
    if existing:
        return existing
    client = get_client()
    result = client.table("places").select("*").eq("name", name).limit(1).execute()
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Yonder NPS campground wave 1.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    nps_rows = fetch_nps_campgrounds()
    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder NPS Campground Wave 1")
    print("=" * 72)
    print(f"Mode: {'apply' if args.apply else 'dry-run'}")
    print(f"Refresh existing: {args.refresh_existing}")
    print("")

    for slug, config in TARGETS.items():
        row = nps_rows.get(slug)
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
            client.table("places").update(updates).eq("id", existing["id"]).execute()
        print(f"{'UPDATE' if args.apply else 'WOULD UPDATE'} venue: {slug} ({len(updates)} fields)")
        updated += 1

    print("")
    print(f"Summary: created={created} updated={updated} skipped={skipped}")


if __name__ == "__main__":
    main()
