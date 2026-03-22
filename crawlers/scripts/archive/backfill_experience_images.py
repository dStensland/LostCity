"""
Backfill images for 'Things to Do' venues using Google Places API.
Targets venues with no image_url in experience-type venue types.
"""

import os
import sys
import time
import requests
from dotenv import load_dotenv

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

load_dotenv()

# Import after dotenv so Supabase URL is available
sys.path.insert(0, os.path.dirname(__file__))
from db import get_client

GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
if not GOOGLE_API_KEY:
    print("Error: GOOGLE_PLACES_API_KEY not set")
    sys.exit(1)

EXPERIENCE_VENUE_TYPES = [
    "museum", "gallery", "arts_center", "park", "garden", "trail", "viewpoint",
    "theater", "cinema", "amphitheater", "arcade", "bowling", "laser_tag",
    "mini_golf", "trampoline_park", "go_kart", "escape_room", "historic_site",
    "monument", "heritage_center", "fitness", "fitness_center", "stadium",
    "zoo", "aquarium", "farmers_market", "food_hall", "bookstore", "library",
    "institution", "community_center", "outdoor_venue", "entertainment",
]


def search_place_photo(query: str):
    """Search Google Places for a venue and return its best photo URL."""
    try:
        resp = requests.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_API_KEY,
                "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
            },
            json={
                "textQuery": query,
                "maxResultCount": 1,
                "locationBias": {
                    "circle": {
                        "center": {"latitude": 33.749, "longitude": -84.388},
                        "radius": 50000,
                    }
                },
            },
            timeout=10,
        )

        if resp.status_code != 200:
            print(f"  API {resp.status_code}: {resp.text[:100]}")
            return None

        data = resp.json()
        places = data.get("places", [])
        if not places:
            return None

        photos = places[0].get("photos", [])
        if not photos:
            return None

        # Sort by resolution (prefer larger)
        photos.sort(
            key=lambda p: p.get("widthPx", 0) * p.get("heightPx", 0), reverse=True
        )

        # Try top 3 photos using skipHttpRedirect to get photoUri
        for photo in photos[:3]:
            photo_name = photo.get("name")
            if not photo_name:
                continue

            media_url = f"https://places.googleapis.com/v1/{photo_name}/media"
            params = {
                "maxWidthPx": 800,
                "key": GOOGLE_API_KEY,
                "skipHttpRedirect": "true",
            }

            try:
                media_resp = requests.get(media_url, params=params, timeout=10)
                if media_resp.status_code == 200:
                    url = media_resp.json().get("photoUri")
                    if url:
                        return url
            except Exception:
                continue

        return None
    except Exception as e:
        print(f"  API error: {e}")
        return None


def main():
    client = get_client()

    # Get venues needing images
    print("Querying venues...")
    result = (
        client.table("venues")
        .select("id,name,slug,address,city,state,venue_type")
        .eq("active", True)
        .is_("image_url", "null")
        .in_("venue_type", EXPERIENCE_VENUE_TYPES)
        .order("name")
        .limit(300)
        .execute()
    )

    venues = result.data or []
    print(f"Found {len(venues)} venues needing images\n")

    found = 0
    failed = 0

    for i, v in enumerate(venues, 1):
        name = v["name"]
        address = v.get("address", "")
        city = v.get("city", "Atlanta")
        state = v.get("state", "GA")

        # Always use name + city — full addresses cause Google to match the
        # address itself (which has no photos) instead of the business.
        query = f"{name}, {city}, {state}"

        photo_url = search_place_photo(query)

        if photo_url:
            client.table("venues").update({"image_url": photo_url}).eq(
                "id", v["id"]
            ).execute()
            found += 1
            print(f"[{i}/{len(venues)}] ✓ {name}")
        else:
            failed += 1
            print(f"[{i}/{len(venues)}] ✗ {name}")

        time.sleep(0.3)

    print(f"\nDone! Found: {found}, Failed: {failed}, Total: {len(venues)}")


if __name__ == "__main__":
    main()
