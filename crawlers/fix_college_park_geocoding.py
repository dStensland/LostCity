#!/usr/bin/env python3
"""
Fix geocoding for College Park and surrounding Airport District venues.

This script:
1. Queries all venues in College Park, East Point, and Hapeville
2. Identifies venues missing lat/lng coordinates
3. Geocodes missing coordinates using OpenStreetMap Nominatim
4. Reports on key venues that need attention
"""

import time
import logging
from typing import Optional, Tuple
import requests
from db import get_client

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "LostCity Event Discovery (contact@lostcity.ai)"

# Key venues to check
KEY_VENUES = [
    "Virgil's Gullah Kitchen & Bar",
    "The Breakfast Boys",
    "Brake Pad",
    "Gateway Center Arena",
]


def geocode_address(address: str, city: str, state: str) -> Optional[Tuple[float, float]]:
    """
    Geocode an address using OpenStreetMap Nominatim.
    Returns (lat, lng) or None if not found.
    """
    full_address = f"{address}, {city}, {state}"

    try:
        response = requests.get(
            NOMINATIM_URL,
            params={
                "q": full_address,
                "format": "json",
                "limit": 1,
                "countrycodes": "us",
            },
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
        response.raise_for_status()

        results = response.json()
        if results:
            lat = float(results[0]["lat"])
            lng = float(results[0]["lon"])
            logger.info(f"  -> Geocoded to: {lat}, {lng}")
            return (lat, lng)

        # Try without full address - just city
        logger.warning(f"  -> Specific address not found, trying city center")
        response = requests.get(
            NOMINATIM_URL,
            params={
                "q": f"{city}, {state}",
                "format": "json",
                "limit": 1,
                "countrycodes": "us",
            },
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
        response.raise_for_status()

        results = response.json()
        if results:
            lat = float(results[0]["lat"])
            lng = float(results[0]["lon"])
            logger.warning(f"  -> Using {city} center: {lat}, {lng}")
            return (lat, lng)

        return None

    except Exception as e:
        logger.error(f"  -> Geocoding error: {e}")
        return None


def main():
    client = get_client()

    logger.info("=" * 70)
    logger.info("College Park & Airport District Venue Geocoding Fix")
    logger.info("=" * 70)
    logger.info("")

    # Query all venues in the Airport District
    cities = ["College Park", "East Point", "Hapeville"]
    
    all_venues = []
    for city in cities:
        result = client.table("venues").select("*").eq("city", city).execute()
        all_venues.extend(result.data or [])

    # Also check for venues with these cities in the address
    for city in cities:
        result = client.table("venues").select("*").ilike("address", f"%{city}%").execute()
        for venue in (result.data or []):
            if venue not in all_venues:
                all_venues.append(venue)

    logger.info(f"Found {len(all_venues)} total venues in Airport District")
    logger.info("")

    # Categorize venues
    missing_coords = []
    has_coords = []
    key_venues_status = {}

    for venue in all_venues:
        if venue["lat"] is None or venue["lng"] is None:
            missing_coords.append(venue)
        else:
            has_coords.append(venue)
        
        # Track key venues
        if venue["name"] in KEY_VENUES:
            key_venues_status[venue["name"]] = {
                "id": venue["id"],
                "address": venue.get("address", "N/A"),
                "city": venue.get("city", "N/A"),
                "has_coords": venue["lat"] is not None and venue["lng"] is not None,
                "lat": venue.get("lat"),
                "lng": venue.get("lng"),
            }

    logger.info("Summary by City:")
    for city in cities:
        city_venues = [v for v in all_venues if v.get("city") == city]
        city_missing = [v for v in missing_coords if v.get("city") == city]
        logger.info(f"  {city}: {len(city_venues)} total, {len(city_missing)} missing coords")
    logger.info("")

    # Report on key venues
    logger.info("Key Venues Status:")
    for name in KEY_VENUES:
        if name in key_venues_status:
            status = key_venues_status[name]
            coords_status = "OK" if status["has_coords"] else "MISSING"
            logger.info(f"  [{coords_status}] {name}")
            logger.info(f"       Address: {status['address']}, {status['city']}")
            if status["has_coords"]:
                logger.info(f"       Coords: {status['lat']}, {status['lng']}")
        else:
            logger.info(f"  [NOT FOUND] {name}")
    logger.info("")

    # List all venues missing coordinates
    if missing_coords:
        logger.info(f"Venues Missing Coordinates ({len(missing_coords)}):")
        for venue in missing_coords:
            logger.info(f"  - {venue['name']} (ID: {venue['id']})")
            logger.info(f"    {venue.get('address', 'No address')}, {venue.get('city', 'No city')}")
        logger.info("")
    else:
        logger.info("All venues have coordinates!")
        logger.info("")

    # Fix missing coordinates
    if missing_coords:
        logger.info("=" * 70)
        logger.info(f"Geocoding {len(missing_coords)} venues...")
        logger.info("=" * 70)
        logger.info("")

        geocoded = 0
        failed = 0

        for i, venue in enumerate(missing_coords):
            logger.info(f"[{i+1}/{len(missing_coords)}] {venue['name']}")
            
            if not venue.get("address"):
                logger.warning("  -> No address, skipping")
                failed += 1
                continue

            coords = geocode_address(
                venue["address"],
                venue.get("city", "College Park"),
                venue.get("state", "GA")
            )

            if coords:
                lat, lng = coords
                client.table("venues").update({
                    "lat": lat,
                    "lng": lng
                }).eq("id", venue["id"]).execute()
                
                geocoded += 1
                logger.info(f"  -> Updated venue {venue['id']}")
            else:
                logger.warning(f"  -> Failed to geocode")
                failed += 1

            # Rate limit: 1 request per second (Nominatim policy)
            if i < len(missing_coords) - 1:
                time.sleep(1.1)

        logger.info("")
        logger.info("=" * 70)
        logger.info(f"Geocoding Complete!")
        logger.info(f"  Successfully geocoded: {geocoded}")
        logger.info(f"  Failed: {failed}")
        logger.info("=" * 70)
    
    # Final summary
    logger.info("")
    logger.info("Final Status:")
    logger.info(f"  Total Airport District venues: {len(all_venues)}")
    logger.info(f"  With coordinates: {len(has_coords)}")
    logger.info(f"  Missing coordinates: {len(missing_coords)}")
    logger.info("")
    
    # Venues needing manual attention
    needs_attention = []
    for venue in all_venues:
        if not venue.get("address") and (venue["lat"] is None or venue["lng"] is None):
            needs_attention.append(venue)
    
    if needs_attention:
        logger.info("Venues Needing Manual Attention (no address and no coords):")
        for venue in needs_attention:
            logger.info(f"  - {venue['name']} (ID: {venue['id']})")
        logger.info("")


if __name__ == "__main__":
    main()
