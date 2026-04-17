"""
Fetch venue photos from Google Places API (New).

Targets venues that need image enrichment — either no image_url, or
no gallery_urls in their place_profile. Captures multiple photos per
place (default top 6 by resolution) and persists to:

- places.image_url  (first photo, only if currently NULL)
- place_profile.hero_image_url  (first photo, only if currently NULL)
- place_profile.gallery_urls  (top N photos as array, only if currently NULL)

Idempotent — safe to re-run; skips fields that are already populated.

Uses the Google Places (New) API v1 to search for the venue,
then fetches photo URLs via the media endpoint.
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

# Default cap on photos persisted to place_profile.gallery_urls
DEFAULT_MAX_PHOTOS = 6


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

    Uses skipHttpRedirect to get the photoUri from the JSON response.
    """
    url = f"https://places.googleapis.com/v1/{photo_name}/media"
    params = {
        "maxWidthPx": PHOTO_MAX_WIDTH,
        "key": GOOGLE_API_KEY,
        "skipHttpRedirect": "true",
    }

    try:
        resp = requests.get(url, params=params, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("photoUri")
        return None

    except Exception as e:
        print(f"  Photo fetch error: {e}")
        return None


def _collect_photo_urls(photos: list[dict], max_count: int) -> list[str]:
    """Resolve up to max_count usable photo URLs from a Google Places photos list,
    sorted by resolution descending. Returns the resolved CDN URLs."""
    sorted_photos = sorted(
        photos,
        key=lambda p: p.get("widthPx", 0) * p.get("heightPx", 0),
        reverse=True,
    )
    urls: list[str] = []
    # Try up to 2x the cap to allow for failures, then trim to cap
    for photo in sorted_photos[: max_count * 2]:
        photo_name = photo.get("name")
        if not photo_name:
            continue
        url = get_photo_url(photo_name)
        if url:
            urls.append(url)
            if len(urls) >= max_count:
                break
    return urls


def fetch_venue_photos(
    limit: int = 50,
    venue_type: Optional[str] = None,
    dry_run: bool = False,
    skip_with_website: bool = False,
    max_photos: int = DEFAULT_MAX_PHOTOS,
    include_with_image: bool = False,
) -> dict:
    """
    Fetch photos from Google Places for venues that need image enrichment.

    Default behavior: only places with NULL image_url.
    With include_with_image=True: also processes places that have image_url
    but no place_profile.gallery_urls (gallery backfill mode).
    """
    client = get_client()

    # Build query — for gallery backfill, get all active places
    query = (
        client.table("places")
        .select("id,name,slug,address,city,state,website,image_url,place_type")
        .eq("is_active", True)
    )

    if not include_with_image:
        # Default: only places without any image
        query = query.is_("image_url", "null")

    if venue_type:
        query = query.eq("place_type", venue_type)

    if skip_with_website:
        # Only venues without websites (website scraping should handle those)
        query = query.is_("website", "null")

    result = query.order("name").limit(limit).execute()
    venues = result.data or []

    # Gallery backfill mode: filter out places that already have gallery_urls
    if include_with_image and venues:
        venue_ids = [v["id"] for v in venues]
        profiles = (
            client.table("place_profile")
            .select("place_id,gallery_urls")
            .in_("place_id", venue_ids)
            .not_.is_("gallery_urls", "null")
            .execute()
        )
        with_gallery = {p["place_id"] for p in (profiles.data or [])}
        venues = [v for v in venues if v["id"] not in with_gallery]
        print(
            f"Gallery backfill mode: filtered to {len(venues)} places without gallery_urls"
        )

    stats = {
        "total": len(venues),
        "found": 0,
        "failed": 0,
        "skipped": 0,
    }

    print(f"\n{'=' * 60}")
    print("Fetching Google Places Photos")
    if venue_type:
        print(f"Venue type: {venue_type}")
    if skip_with_website:
        print("Skipping venues with websites")
    print(f"Found {len(venues)} venues without images")
    print(f"{'=' * 60}")

    # Filter out address-like names (e.g. "1013 Fatherland St")
    address_pattern = re.compile(r'^\d+\s+[\w\s]+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Pkwy|Hwy|Circle|Ct|Pl|Cir)\b', re.IGNORECASE)
    venues = [v for v in venues if not address_pattern.match(v.get("name", ""))]
    stats["total"] = len(venues)
    print(f"After filtering address-like names: {len(venues)} venues")

    for i, venue in enumerate(venues, 1):
        name = venue["name"]
        venue.get("address", "")
        city = venue.get("city", "Atlanta")
        state = venue.get("state", "GA")

        # Always use name + city — full addresses cause Google to match the
        # address itself (which has no photos) instead of the business.
        search_query = f"{name}, {city}, {state}"

        print(f"\n[{i}/{len(venues)}] {name}")

        # Search for photos
        photos = search_place_photos(search_query)

        if not photos:
            print("  No photos found")
            stats["failed"] += 1
            time.sleep(0.5)
            continue

        # Resolve top-N usable photo URLs (sorted by resolution)
        photo_urls = _collect_photo_urls(photos, max_photos)

        if not photo_urls:
            print("  Could not resolve any photo URLs")
            stats["failed"] += 1
            time.sleep(0.5)
            continue

        hero = photo_urls[0]
        print(f"  FOUND {len(photo_urls)} photos — hero: {hero[:70]}...")

        if not dry_run:
            # 1. places.image_url — only if currently NULL (backward compat)
            if not venue.get("image_url"):
                client.table("places").update({"image_url": hero}).eq(
                    "id", venue["id"]
                ).execute()

            # 2. place_profile — upsert hero_image_url + gallery_urls
            existing = (
                client.table("place_profile")
                .select("place_id,hero_image_url,gallery_urls")
                .eq("place_id", venue["id"])
                .execute()
            )
            if existing.data:
                # Update only NULL fields (idempotent)
                row = existing.data[0]
                update_fields: dict = {}
                if not row.get("hero_image_url"):
                    update_fields["hero_image_url"] = hero
                if not row.get("gallery_urls"):
                    update_fields["gallery_urls"] = photo_urls
                if update_fields:
                    client.table("place_profile").update(update_fields).eq(
                        "place_id", venue["id"]
                    ).execute()
            else:
                # No profile row yet — insert with hero + gallery
                client.table("place_profile").insert(
                    {
                        "place_id": venue["id"],
                        "hero_image_url": hero,
                        "gallery_urls": photo_urls,
                    }
                ).execute()
            print("  Updated!")

        stats["found"] += 1

        # Rate limit: Google Places API
        time.sleep(0.5)

    print(f"\n{'=' * 60}")
    print("RESULTS")
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
    parser.add_argument(
        "--max-photos",
        type=int,
        default=DEFAULT_MAX_PHOTOS,
        help=f"Cap photos per place (default {DEFAULT_MAX_PHOTOS})",
    )
    parser.add_argument(
        "--include-with-image",
        action="store_true",
        help="Also process places that already have image_url (gallery backfill mode)",
    )

    args = parser.parse_args()

    if not GOOGLE_API_KEY:
        print("Error: GOOGLE_PLACES_API_KEY not set")
        exit(1)

    fetch_venue_photos(
        limit=args.limit,
        venue_type=args.venue_type,
        dry_run=args.dry_run,
        skip_with_website=args.no_website,
        max_photos=args.max_photos,
        include_with_image=args.include_with_image,
    )
