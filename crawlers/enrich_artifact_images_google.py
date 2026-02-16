#!/usr/bin/env python3
"""
Enrich remaining artifact images via Google Places API.

Targets the 19 artifacts that were too obscure for Wikipedia/Wikimedia Commons.
Google Places photos are user-contributed under Google's ToS.

NOTE: Google Places photo URLs are session-based and expire. If we want
permanent images, we'd need to download and re-host them. For now, these
URLs work for display purposes.

Usage:
    python3 enrich_artifact_images_google.py --dry-run
    python3 enrich_artifact_images_google.py
"""

import os
import sys
import time
import argparse
import requests
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client

GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
PHOTO_MAX_WIDTH = 800

PHOTO_FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.photos",
])

# The 19 remaining slugs and their Google search queries
REMAINING_ARTIFACTS = {
    "two-headed-calf-moon-rocks": "Fernbank Science Center two-headed calf Atlanta",
    "autoeater": "Autoeater sculpture Atlanta Midtown",
    "the-great-fish": "Atlanta Fish Market giant fish sculpture Buckhead",
    "jack-smith-armchair-statue": "Oakland Cemetery Atlanta armchair statue",
    "the-storyteller-stag-man": "Storyteller statue Buckhead Library Atlanta",
    "giant-hands-of-dr-sid": "Giant Hands sculpture Marietta Georgia",
    "whittier-mill-tower": "Whittier Mill Village Atlanta tower",
    "world-athletes-monument": "World Athletes Monument Atlanta Midtown",
    "hoo-hoo-monument": "Hoo-Hoo monument Piedmont Park Atlanta",
    "54-columns": "54 Columns Sol LeWitt Atlanta Old Fourth Ward",
    "sideways-the-dogs-grave": "Sideways dog grave Georgia Tech campus",
    "one-person-jail-cell": "one person jail cell Inman Park Atlanta Delta Park",
    "elvis-shrine-vault": "Star Community Bar Elvis shrine vault Atlanta",
    "confessional-photobooth": "Sister Louisa's Church confessional Atlanta",
    "owl-rock": "Owl Rock Campbellton Road Atlanta church cemetery",
    "dr-bombays-underwater-tea-party": "Dr Bombay's Underwater Tea Party Atlanta",
    "cascade-springs-earthworks": "Cascade Springs Nature Preserve Atlanta",
    "eav-totem-pole": "East Atlanta Village totem pole Flat Shoals",
    "bridge-over-nothing": "Freedom Parkway bridge Atlanta Old Fourth Ward",
}


def search_place_photos(query: str) -> list[dict]:
    """Search Google Places and return photo references."""
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": PHOTO_FIELD_MASK,
    }
    body = {
        "textQuery": query,
        "maxResultCount": 1,
        "locationBias": {
            "circle": {
                "center": {"latitude": 33.749, "longitude": -84.388},
                "radius": 50000,
            }
        },
    }
    try:
        resp = requests.post(GOOGLE_PLACES_URL, headers=headers, json=body, timeout=10)
        if resp.status_code != 200:
            print(f"  API {resp.status_code}: {resp.text[:200]}")
            return []
        data = resp.json()
        places = data.get("places", [])
        if not places:
            return []
        return places[0].get("photos", [])
    except requests.exceptions.HTTPError as e:
        print(f"  API error: {e}")
        print(f"  Response: {e.response.text[:200] if e.response else 'N/A'}")
        return []
    except Exception as e:
        print(f"  API error: {e}")
        return []


def get_photo_url(photo_name: str) -> Optional[str]:
    """Resolve a Google Places photo reference to a URL."""
    url = f"https://places.googleapis.com/v1/{photo_name}/media"
    params = {"maxWidthPx": PHOTO_MAX_WIDTH, "key": GOOGLE_API_KEY}
    try:
        resp = requests.get(url, params=params, timeout=10, allow_redirects=False)
        if resp.status_code in (301, 302, 303, 307, 308):
            return resp.headers.get("Location")
        resp = requests.get(url, params=params, timeout=10, allow_redirects=True)
        if resp.status_code == 200:
            return resp.url
        return None
    except Exception as e:
        print(f"  Photo fetch error: {e}")
        return None


def main(dry_run: bool = False):
    if not GOOGLE_API_KEY:
        print("Error: GOOGLE_PLACES_API_KEY not set in environment")
        sys.exit(1)

    client = get_client()
    slugs = list(REMAINING_ARTIFACTS.keys())

    # Fetch venues by slug
    result = client.table("venues").select(
        "id, name, slug, image_url"
    ).in_("slug", slugs).execute()

    venues = {v["slug"]: v for v in (result.data or [])}
    print(f"Found {len(venues)}/{len(slugs)} venues in DB\n")

    found = 0
    failed = 0

    for slug, search_query in REMAINING_ARTIFACTS.items():
        venue = venues.get(slug)
        if not venue:
            print(f"  SKIP {slug} — not in DB")
            continue

        if venue.get("image_url"):
            print(f"  SKIP {venue['name']} — already has image")
            continue

        print(f"  Searching: {venue['name']} -> \"{search_query}\"")

        photos = search_place_photos(search_query)
        if not photos:
            print(f"    No Google Places results")
            failed += 1
            time.sleep(0.5)
            continue

        # Sort by resolution, try top 3
        photos.sort(key=lambda p: p.get("widthPx", 0) * p.get("heightPx", 0), reverse=True)

        photo_url = None
        for photo in photos[:3]:
            photo_name = photo.get("name")
            if not photo_name:
                continue
            url = get_photo_url(photo_name)
            if url:
                photo_url = url
                break

        if not photo_url:
            print(f"    Could not resolve photo URL")
            failed += 1
            time.sleep(0.5)
            continue

        print(f"    FOUND: {photo_url[:80]}...")
        found += 1

        if not dry_run:
            client.table("venues").update(
                {"image_url": photo_url}
            ).eq("id", venue["id"]).execute()
            print(f"    Updated venue {venue['id']}")

        time.sleep(0.5)

    print(f"\n{'DRY RUN ' if dry_run else ''}RESULTS:")
    print(f"  Found:  {found}")
    print(f"  Failed: {failed}")
    print(f"  Total:  {found + failed}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
