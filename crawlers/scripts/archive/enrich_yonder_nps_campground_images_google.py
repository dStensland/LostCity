#!/usr/bin/env python3
"""
Backfill image coverage for Yonder NPS campground rows via Google Places.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/enrich_yonder_nps_campground_images_google.py --dry-run
    python3 scripts/enrich_yonder_nps_campground_images_google.py
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "web/.env.local")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from db import get_client

GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
PHOTO_FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.photos",
    ]
)
PHOTO_MAX_WIDTH = 1200

NPS_CAMPGROUND_QUERIES = {
    "hickory-hill-wilderness-campsite": "Hickory Hill Wilderness Campsite Cumberland Island Georgia",
    "sea-camp-campground": "Sea Camp Campground Cumberland Island Georgia",
    "stafford-beach-campground": "Stafford Beach Campground Cumberland Island Georgia",
    "yankee-paradise-wilderness-campsite": "Yankee Paradise Wilderness Campsite Cumberland Island Georgia",
}

PLACEHOLDER_PATTERNS = ("usfs_placeholder", "placeholder", "default")


def is_placeholder(url: Optional[str]) -> bool:
    value = (url or "").lower()
    return any(pattern in value for pattern in PLACEHOLDER_PATTERNS)


def search_places(query: str) -> list[dict]:
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": PHOTO_FIELD_MASK,
    }
    body = {"textQuery": query, "maxResultCount": 3}
    try:
        resp = requests.post(GOOGLE_PLACES_URL, headers=headers, json=body, timeout=12)
        resp.raise_for_status()
        return (resp.json() or {}).get("places") or []
    except Exception:
        return []


def resolve_photo_url(photo_name: str) -> Optional[str]:
    endpoint = f"https://places.googleapis.com/v1/{photo_name}/media"
    params = {"maxWidthPx": PHOTO_MAX_WIDTH, "key": GOOGLE_API_KEY}
    try:
        resp = requests.get(endpoint, params=params, timeout=12, allow_redirects=False)
        if resp.status_code in (301, 302, 303, 307, 308):
            return resp.headers.get("Location")
        resp = requests.get(endpoint, params=params, timeout=12, allow_redirects=True)
        if resp.status_code == 200:
            return resp.url
    except Exception:
        return None
    return None


def choose_photo_url(query: str) -> tuple[Optional[str], str]:
    places = search_places(query)
    if not places:
        return None, "no_place_match"
    places.sort(key=lambda p: len(p.get("photos") or []), reverse=True)
    for place in places:
        photos = place.get("photos") or []
        if not photos:
            continue
        photos = sorted(
            photos,
            key=lambda p: int(p.get("widthPx") or 0) * int(p.get("heightPx") or 0),
            reverse=True,
        )
        for photo in photos[:5]:
            photo_name = photo.get("name")
            if not photo_name:
                continue
            url = resolve_photo_url(photo_name)
            if url:
                return url, "google_ok"
    return None, "photo_resolution_failed"


def main(dry_run: bool = False) -> None:
    if not GOOGLE_API_KEY:
        raise SystemExit("GOOGLE_PLACES_API_KEY not set")

    client = get_client()
    result = (
        client.table("venues")
        .select("id,slug,name,image_url,hero_image_url")
        .in_("slug", list(NPS_CAMPGROUND_QUERIES.keys()))
        .execute()
    )
    venues = {row["slug"]: row for row in (result.data or [])}

    found = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder NPS Campground Image Enrichment (Google Places)")
    print("=" * 72)
    print(f"Mode: {'dry-run' if dry_run else 'apply'}")
    print("")

    for slug, query in NPS_CAMPGROUND_QUERIES.items():
        venue = venues.get(slug)
        if not venue:
            print(f"SKIP missing venue row: {slug}")
            skipped += 1
            continue

        current_image = venue.get("image_url")
        current_hero = venue.get("hero_image_url")
        needs_image = not current_image or is_placeholder(current_image)
        needs_hero = not current_hero or is_placeholder(current_hero)
        if not needs_image and not needs_hero:
            print(f"KEEP image: {venue['name']}")
            skipped += 1
            continue

        photo_url, status = choose_photo_url(query)
        if not photo_url:
            print(f"MISS image: {venue['name']} ({status})")
            skipped += 1
            time.sleep(0.4)
            continue

        updates = {}
        if needs_image:
            updates["image_url"] = photo_url
        if needs_hero:
            updates["hero_image_url"] = photo_url
        print(f"{'WOULD UPDATE' if dry_run else 'UPDATE'} image: {venue['name']} -> {photo_url[:110]}")
        found += 1
        if not dry_run:
            client.table("venues").update(updates).eq("id", venue["id"]).execute()
            updated += 1
        time.sleep(0.4)

    print("")
    print(f"Summary: matches={found} updated={updated} skipped={skipped}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
