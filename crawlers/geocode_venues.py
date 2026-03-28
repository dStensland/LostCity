#!/usr/bin/env python3
"""
Geocode venues using OpenStreetMap Nominatim (free, no API key required).
Rate limited to 1 request per second per Nominatim usage policy.
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
            return (lat, lng)

        # No results — do NOT fall back to city center. City-center coordinates
        # are worse than NULL because they silently place venues at the wrong
        # location and look valid to any downstream consumer. Leave lat/lng NULL
        # so we can identify and re-attempt these venues later.
        logger.warning(f"No geocoding result for: {full_address}")
        return None

    except Exception as e:
        logger.error(f"Geocoding error for {full_address}: {e}")
        return None


def main():
    client = get_client()

    # Get venues without coordinates
    result = client.table("places").select("*").is_("lat", "null").execute()
    venues = result.data

    logger.info(f"Found {len(venues)} venues without coordinates")

    geocoded = 0
    failed = 0

    for i, venue in enumerate(venues):
        if not venue.get("address"):
            logger.warning(f"Skipping {venue['name']} - no address")
            failed += 1
            continue

        logger.info(f"[{i+1}/{len(venues)}] Geocoding: {venue['name']}")

        coords = geocode_address(
            venue["address"],
            venue.get("city", "Atlanta"),
            venue.get("state", "GA")
        )

        if coords:
            lat, lng = coords
            client.table("places").update({
                "lat": lat,
                "lng": lng
            }).eq("id", venue["id"]).execute()

            logger.info(f"  -> {lat}, {lng}")
            geocoded += 1
        else:
            logger.warning("  -> Could not geocode")
            failed += 1

        # Rate limit: 1 request per second (Nominatim policy)
        time.sleep(1.1)

    logger.info(f"\nComplete: {geocoded} geocoded, {failed} failed")


if __name__ == "__main__":
    main()
