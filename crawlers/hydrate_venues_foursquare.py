#!/usr/bin/env python3
"""
Hydrate venue data from Foursquare Places API.

This script:
1. Finds venues missing key data (hours, photos, descriptions)
2. Searches Foursquare by name + location
3. Updates venue with rich data (hours, photos, price_level, etc.)

Usage:
    python hydrate_venues_foursquare.py              # Hydrate all venues missing data
    python hydrate_venues_foursquare.py --venue-type bar  # Only bars
    python hydrate_venues_foursquare.py --limit 50   # Process 50 venues
    python hydrate_venues_foursquare.py --dry-run    # Preview without updating
"""

import os
import sys
import time
import logging
import argparse
import requests
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from db import get_client

# Load .env file from project root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

FOURSQUARE_API_KEY = os.environ.get("FOURSQUARE_API_KEY", "")

# Atlanta center coordinates
ATLANTA_LAT = 33.749
ATLANTA_LNG = -84.388

# New Foursquare API endpoint (migrated from api.foursquare.com/v3)
FOURSQUARE_API_BASE = "https://places-api.foursquare.com"
FOURSQUARE_API_VERSION = "2025-06-17"

# Foursquare category IDs for filtering
CATEGORY_MAP = {
    "restaurant": "13065",  # Restaurant
    "bar": "13003",  # Bar
    "coffee_shop": "13032",  # Coffee Shop
    "brewery": "13029",  # Brewery
    "nightclub": "10032",  # Nightclub
    "club": "10032",
}


def search_foursquare(
    query: str,
    lat: float = ATLANTA_LAT,
    lng: float = ATLANTA_LNG,
    categories: Optional[str] = None,
) -> Optional[dict]:
    """Search Foursquare for a place by name near a location.

    Returns search result with basic data (no separate details call needed
    to avoid rate limiting).
    """
    if not FOURSQUARE_API_KEY:
        logger.error("FOURSQUARE_API_KEY not set")
        return None

    params = {
        "query": query,
        "ll": f"{lat},{lng}",
        "radius": 25000,  # 25km
        "limit": 1,
    }
    if categories:
        params["categories"] = categories

    try:
        response = requests.get(
            f"{FOURSQUARE_API_BASE}/places/search",
            params=params,
            headers={
                "Authorization": f"Bearer {FOURSQUARE_API_KEY}",
                "Accept": "application/json",
                "X-Places-Api-Version": FOURSQUARE_API_VERSION,
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        results = data.get("results", [])
        return results[0] if results else None
    except Exception as e:
        logger.error(f"Foursquare search error: {e}")
        return None


def get_foursquare_details(fsq_id: str) -> Optional[dict]:
    """Get detailed place info from Foursquare including hours and photos."""
    if not FOURSQUARE_API_KEY:
        return None

    # Fields to request (updated for new API)
    fields = "fsq_place_id,name,location,hours,photos,price,rating,description,tel,website,social_media"

    try:
        response = requests.get(
            f"{FOURSQUARE_API_BASE}/places/{fsq_id}",
            params={"fields": fields},
            headers={
                "Authorization": f"Bearer {FOURSQUARE_API_KEY}",
                "Accept": "application/json",
                "X-Places-Api-Version": FOURSQUARE_API_VERSION,
            },
            timeout=10,
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Foursquare details error: {e}")
        return None


def parse_foursquare_hours(hours_data: Optional[dict]) -> tuple[Optional[dict], Optional[str]]:
    """
    Parse Foursquare hours into our format.

    Returns:
        (hours_json, hours_display)

    hours_json format: {"mon": {"open": "11:00", "close": "23:00"}, ...}
    """
    if not hours_data:
        return None, None

    regular = hours_data.get("regular", [])
    if not regular:
        display = hours_data.get("display")
        return None, display

    day_map = {1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat", 7: "sun"}
    hours_json = {}

    for entry in regular:
        day_num = entry.get("day")
        if day_num not in day_map:
            continue
        day_name = day_map[day_num]

        open_time = entry.get("open", "")
        close_time = entry.get("close", "")

        # Convert "0900" to "09:00"
        if len(open_time) == 4:
            open_time = f"{open_time[:2]}:{open_time[2:]}"
        if len(close_time) == 4:
            close_time = f"{close_time[:2]}:{close_time[2:]}"

        if open_time and close_time:
            hours_json[day_name] = {"open": open_time, "close": close_time}

    # Generate display string
    display = hours_data.get("display")

    return hours_json if hours_json else None, display


def parse_foursquare_photo(photos: Optional[list]) -> Optional[str]:
    """Get the best photo URL from Foursquare photos."""
    if not photos or len(photos) == 0:
        return None

    photo = photos[0]
    prefix = photo.get("prefix", "")
    suffix = photo.get("suffix", "")

    if prefix and suffix:
        # Request 500x500 image
        return f"{prefix}500x500{suffix}"

    return None


def get_venues_needing_hydration(
    venue_type: Optional[str] = None,
    limit: int = 100,
    skip_processed: bool = True,
) -> list[dict]:
    """Get venues that are missing data and haven't been processed yet."""
    client = get_client()

    query = client.table("venues").select(
        "id, name, slug, address, city, state, lat, lng, venue_type, hours, image_url, foursquare_id, website"
    ).eq("active", True).eq("city", "Atlanta")

    if venue_type:
        query = query.eq("venue_type", venue_type)

    # Skip venues that already have a foursquare_id (already processed)
    if skip_processed:
        query = query.is_("foursquare_id", "null")

    # Get venues missing website (main thing we can hydrate from search)
    query = query.is_("website", "null")
    query = query.limit(limit)

    result = query.execute()
    return result.data or []


def update_venue_with_foursquare(venue_id: int, fsq_data: dict, dry_run: bool = False) -> bool:
    """Update venue with Foursquare data."""
    client = get_client()

    updates = {}

    # Parse hours
    hours_json, hours_display = parse_foursquare_hours(fsq_data.get("hours"))
    if hours_json:
        updates["hours"] = hours_json
    if hours_display:
        updates["hours_display"] = hours_display

    # Parse photo
    photo_url = parse_foursquare_photo(fsq_data.get("photos"))
    if photo_url:
        updates["image_url"] = photo_url

    # Price level (Foursquare uses 1-4)
    price = fsq_data.get("price")
    if price:
        updates["price_level"] = price

    # Description
    description = fsq_data.get("description")
    if description:
        updates["short_description"] = description[:500] if len(description) > 500 else description

    # Website
    website = fsq_data.get("website")
    if website:
        updates["website"] = website

    # Instagram from social_media
    social = fsq_data.get("social_media", {})
    instagram = social.get("instagram")
    if instagram:
        updates["instagram"] = instagram

    # Location updates
    location = fsq_data.get("location", {})
    neighborhood = location.get("neighborhood")
    if neighborhood and isinstance(neighborhood, list) and len(neighborhood) > 0:
        updates["neighborhood"] = neighborhood[0]

    # Store Foursquare ID (new API uses fsq_place_id)
    fsq_id = fsq_data.get("fsq_place_id") or fsq_data.get("fsq_id")
    if fsq_id:
        updates["foursquare_id"] = fsq_id

    if not updates:
        return False

    if dry_run:
        logger.info(f"    Would update: {list(updates.keys())}")
        return True

    try:
        client.table("venues").update(updates).eq("id", venue_id).execute()
        return True
    except Exception as e:
        logger.error(f"    Update error: {e}")
        return False


def hydrate_venue(venue: dict, dry_run: bool = False) -> bool:
    """Hydrate a single venue with Foursquare data.

    Uses search results directly to avoid rate limiting from details endpoint.
    """
    name = venue["name"]
    lat = venue.get("lat") or ATLANTA_LAT
    lng = venue.get("lng") or ATLANTA_LNG
    venue_type = venue.get("venue_type")

    # Search Foursquare
    category = CATEGORY_MAP.get(venue_type)
    result = search_foursquare(name, lat, lng, category)

    if not result:
        logger.info(f"  NOT FOUND: {name}")
        return False

    # New API uses fsq_place_id instead of fsq_id
    fsq_id = result.get("fsq_place_id") or result.get("fsq_id")
    fsq_name = result.get("name", "")

    # Verify name match (basic fuzzy check)
    if name.lower()[:10] != fsq_name.lower()[:10]:
        logger.info(f"  MISMATCH: {name} vs {fsq_name}")
        return False

    # Use search result directly (contains tel, website, social_media, location)
    # This avoids rate limiting from the details endpoint
    success = update_venue_with_foursquare(venue["id"], result, dry_run)

    if success:
        logger.info(f"  HYDRATED: {name}")
    else:
        logger.info(f"  NO UPDATES: {name}")

    return success


def main():
    parser = argparse.ArgumentParser(description="Hydrate venues with Foursquare data")
    parser.add_argument("--venue-type", help="Filter by venue type (bar, restaurant, etc.)")
    parser.add_argument("--limit", type=int, default=100, help="Max venues to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview without updating")
    args = parser.parse_args()

    if not FOURSQUARE_API_KEY:
        logger.error("FOURSQUARE_API_KEY environment variable not set")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("Foursquare Venue Hydration")
    logger.info("=" * 60)

    venues = get_venues_needing_hydration(args.venue_type, args.limit)
    logger.info(f"Found {len(venues)} venues needing hydration")
    logger.info("")

    hydrated = 0
    failed = 0

    for venue in venues:
        success = hydrate_venue(venue, args.dry_run)
        if success:
            hydrated += 1
        else:
            failed += 1

        # Rate limit: be conservative to avoid 429 errors
        time.sleep(1.5)

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Done! Hydrated: {hydrated}, Failed/Skipped: {failed}")
    if args.dry_run:
        logger.info("(Dry run - no changes made)")


if __name__ == "__main__":
    main()
