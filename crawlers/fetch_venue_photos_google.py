"""
Fetch venue photos from Google Places API (New).

Targets venues that:
- Have no image_url
- Are active
- Optionally filtered by venue_type

Uses the Google Places (New) API v1 to search for the venue,
then fetches the first photo URL via the media endpoint.
"""

import os
import re
import time
import argparse
import requests
from typing import Optional
from dotenv import load_dotenv
from db import get_client

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"

# Field mask requesting photos
PHOTO_FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.photos",
])

# Skip generic/stock image patterns
SKIP_IMAGE_PATTERNS = [
    "streetviewpixels",
    "googleusercontent.com/p/AF1QipN",  # user-uploaded but usually fine
]

# Max photo width to request (good balance of quality vs size)
PHOTO_MAX_WIDTH = 800


def search_place_photos(query: str) -> list[dict]:
    """
    Search Google Places for a venue and return its photos.
    Returns list of photo dicts with 'name', 'widthPx', 'heightPx'.
    """
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
        resp.raise_for_status()
        data = resp.json()

        places = data.get("places", [])
        if not places:
            return []

        place = places[0]
        return place.get("photos", [])

    except Exception as e:
        print(f"  API error: {e}")
        return []


def get_photo_url(photo_name: str) -> Optional[str]:
    """
    Get the actual photo URL from a Google Places photo reference.

    The media endpoint returns a redirect to the image. We follow
    the redirect and return the final URL.
    """
    url = f"https://places.googleapis.com/v1/{photo_name}/media"
    params = {
        "maxWidthPx": PHOTO_MAX_WIDTH,
        "key": GOOGLE_API_KEY,
    }

    try:
        # Don't follow redirects — we want the final URL
        resp = requests.get(url, params=params, timeout=10, allow_redirects=False)

        if resp.status_code in (301, 302, 303, 307, 308):
            photo_url = resp.headers.get("Location")
            if photo_url:
                return photo_url

        # If no redirect, try following redirects and getting final URL
        resp = requests.get(url, params=params, timeout=10, allow_redirects=True)
        if resp.status_code == 200:
            return resp.url

        return None

    except Exception as e:
        print(f"  Photo fetch error: {e}")
        return None


def fetch_venue_photos(
    limit: int = 50,
    venue_type: Optional[str] = None,
    dry_run: bool = False,
    skip_with_website: bool = False,
) -> dict:
    """
    Fetch photos from Google Places for venues without images.
    """
    client = get_client()

    # Build query
    query = (
        client.table("venues")
        .select("id,name,slug,address,city,state,website,image_url,venue_type")
        .eq("active", True)
        .is_("image_url", "null")
    )

    if venue_type:
        query = query.eq("venue_type", venue_type)

    if skip_with_website:
        # Only venues without websites (website scraping should handle those)
        query = query.is_("website", "null")

    result = query.order("name").limit(limit).execute()
    venues = result.data or []

    stats = {
        "total": len(venues),
        "found": 0,
        "failed": 0,
        "skipped": 0,
    }

    print(f"\n{'=' * 60}")
    print(f"Fetching Google Places Photos")
    if venue_type:
        print(f"Venue type: {venue_type}")
    if skip_with_website:
        print(f"Skipping venues with websites")
    print(f"Found {len(venues)} venues without images")
    print(f"{'=' * 60}")

    # Filter out address-like names (e.g. "1013 Fatherland St")
    address_pattern = re.compile(r'^\d+\s+[\w\s]+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Pkwy|Hwy|Circle|Ct|Pl|Cir)\b', re.IGNORECASE)
    venues = [v for v in venues if not address_pattern.match(v.get("name", ""))]
    stats["total"] = len(venues)
    print(f"After filtering address-like names: {len(venues)} venues")

    for i, venue in enumerate(venues, 1):
        name = venue["name"]
        address = venue.get("address", "")
        city = venue.get("city", "Atlanta")
        state = venue.get("state", "GA")

        # Build search query
        if address:
            search_query = f"{name}, {address}"
        else:
            search_query = f"{name}, {city}, {state}"

        print(f"\n[{i}/{len(venues)}] {name}")

        # Search for photos
        photos = search_place_photos(search_query)

        if not photos:
            print("  No photos found")
            stats["failed"] += 1
            time.sleep(0.5)
            continue

        # Try to get a usable photo URL (prefer larger photos)
        # Sort by resolution (width * height) descending
        photos.sort(key=lambda p: p.get("widthPx", 0) * p.get("heightPx", 0), reverse=True)

        photo_url = None
        for photo in photos[:3]:  # Try top 3
            photo_name = photo.get("name")
            if not photo_name:
                continue

            url = get_photo_url(photo_name)
            if url:
                photo_url = url
                break

        if not photo_url:
            print("  Could not resolve photo URL")
            stats["failed"] += 1
            time.sleep(0.5)
            continue

        print(f"  FOUND: {photo_url[:80]}...")

        if not dry_run:
            client.table("venues").update({"image_url": photo_url}).eq("id", venue["id"]).execute()
            print("  Updated!")

        stats["found"] += 1

        # Rate limit: Google Places API
        time.sleep(0.5)

    print(f"\n{'=' * 60}")
    print(f"RESULTS")
    print(f"{'=' * 60}")
    print(f"Total processed: {stats['total']}")
    print(f"Photos found:    {stats['found']}")
    print(f"Failed:          {stats['failed']}")
    print(f"Skipped:         {stats['skipped']}")

    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch venue photos from Google Places API")
    parser.add_argument("--limit", type=int, default=50, help="Max venues to process")
    parser.add_argument("--venue-type", type=str, help="Filter by venue type")
    parser.add_argument("--dry-run", action="store_true", help="Don't update database")
    parser.add_argument("--no-website", action="store_true", help="Only venues without websites")

    args = parser.parse_args()

    if not GOOGLE_API_KEY:
        print("Error: GOOGLE_PLACES_API_KEY not set")
        exit(1)

    fetch_venue_photos(
        limit=args.limit,
        venue_type=args.venue_type,
        dry_run=args.dry_run,
        skip_with_website=args.no_website,
    )
