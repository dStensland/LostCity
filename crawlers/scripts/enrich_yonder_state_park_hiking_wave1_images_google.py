#!/usr/bin/env python3
"""
Backfill image coverage for Yonder's first state-park hiking wave via Google Places.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/enrich_yonder_state_park_hiking_wave1_images_google.py --dry-run
    python3 scripts/enrich_yonder_state_park_hiking_wave1_images_google.py
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
PHOTO_FIELD_MASK = ",".join(["places.id", "places.displayName", "places.formattedAddress", "places.photos"])
PHOTO_MAX_WIDTH = 1200

TARGET_QUERIES = {
    "fd-roosevelt-state-park": "F.D. Roosevelt State Park Georgia",
    "fd-roosevelt-state-park-campground": "FDR State Park Campground Georgia",
    "pine-mountain-trail": "Pine Mountain Trail F.D. Roosevelt State Park Georgia",
}


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
        client.table("places")
        .select("id,slug,name,image_url,hero_image_url")
        .in_("slug", list(TARGET_QUERIES.keys()))
        .execute()
    )
    venues = {row["slug"]: row for row in (result.data or [])}

    found = 0
    updated = 0
    skipped = 0

    print("=" * 72)
    print("Yonder State-Park Hiking Wave 1 Image Enrichment (Google Places)")
    print("=" * 72)
    print(f"Mode: {'dry-run' if dry_run else 'apply'}")
    print("")

    for slug, query in TARGET_QUERIES.items():
        venue = venues.get(slug)
        if not venue:
            print(f"SKIP missing venue row: {slug}")
            skipped += 1
            continue
        if venue.get("image_url") and venue.get("hero_image_url"):
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
        if not venue.get("image_url"):
            updates["image_url"] = photo_url
        if not venue.get("hero_image_url"):
            updates["hero_image_url"] = photo_url
        print(f"{'WOULD UPDATE' if dry_run else 'UPDATE'} image: {venue['name']} -> {photo_url[:110]}")
        found += 1
        if not dry_run:
            client.table("places").update(updates).eq("id", venue["id"]).execute()
            updated += 1
        time.sleep(0.4)

    print("")
    print(f"Summary: matches={found} updated={updated} skipped={skipped}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
