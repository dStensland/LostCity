#!/usr/bin/env python3
"""
Import outdoor recreation venues in the Atlanta metro area.

Venues: Stone Summit Climbing, REI Atlanta, Sweetwater Creek State Park,
Chattahoochee River NRA, Atlanta Whitewater Park, etc.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_outdoor_recreation.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

OUTDOOR_VENUES = [
    {
        "name": "Stone Summit Climbing",
        "slug": "stone-summit-climbing-midtown",
        "address": "3701 Presidential Pkwy",
        "neighborhood": "Brookhaven",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30340",
        "lat": 33.8609,
        "lng": -84.3044,
        "venue_type": "fitness_center",
        "spot_type": "fitness",
        "website": "https://www.ssclimbing.com",
        "vibes": ["climbing", "fitness", "indoor", "group-activity", "date-night"],
    },
    {
        "name": "Stone Summit Kennesaw",
        "slug": "stone-summit-climbing-kennesaw",
        "address": "3010 George Busbee Pkwy NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "lat": 34.0254,
        "lng": -84.5822,
        "venue_type": "fitness_center",
        "spot_type": "fitness",
        "website": "https://www.ssclimbing.com",
        "vibes": ["climbing", "fitness", "indoor", "group-activity"],
    },
    {
        "name": "REI Atlanta",
        "slug": "rei-atlanta-perimeter",
        "address": "1800 Northeast Expy NE",
        "neighborhood": "Brookhaven",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.8244,
        "lng": -84.3275,
        "venue_type": "retail",
        "spot_type": "retail",
        "website": "https://www.rei.com/stores/atlanta-perimeter.html",
        "vibes": ["outdoor", "classes", "hiking", "camping", "adventure"],
    },
    {
        "name": "Sweetwater Creek State Park",
        "slug": "sweetwater-creek-state-park",
        "address": "1750 Mt Vernon Rd",
        "neighborhood": "Lithia Springs",
        "city": "Lithia Springs",
        "state": "GA",
        "zip": "30122",
        "lat": 33.7649,
        "lng": -84.6221,
        "venue_type": "park",
        "spot_type": "park",
        "website": "https://gastateparks.org/SweetwaterCreek",
        "vibes": ["hiking", "nature", "outdoor", "family-friendly", "scenic"],
    },
    {
        "name": "Chattahoochee River National Recreation Area",
        "slug": "chattahoochee-river-nra",
        "address": "1978 Island Ford Pkwy",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30350",
        "lat": 33.9939,
        "lng": -84.3333,
        "venue_type": "park",
        "spot_type": "park",
        "website": "https://www.nps.gov/chat",
        "vibes": ["hiking", "nature", "outdoor", "kayaking", "fishing", "scenic"],
    },
    {
        "name": "Shoot the Hooch at Powers Island",
        "slug": "shoot-the-hooch-powers-island",
        "address": "5765 Interstate N Pkwy",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9297,
        "lng": -84.4229,
        "venue_type": "park",
        "spot_type": "park",
        "website": None,
        "vibes": ["kayaking", "tubing", "outdoor", "nature", "summer", "group-activity"],
    },
    {
        "name": "Arabia Mountain National Heritage Area",
        "slug": "arabia-mountain",
        "address": "3787 Klondike Rd",
        "neighborhood": "Stonecrest",
        "city": "Lithonia",
        "state": "GA",
        "zip": "30038",
        "lat": 33.6630,
        "lng": -84.1224,
        "venue_type": "park",
        "spot_type": "park",
        "website": "https://arabiaalliance.org",
        "vibes": ["hiking", "nature", "outdoor", "scenic", "unique-landscape"],
    },
    {
        "name": "Whitewater Express",
        "slug": "whitewater-express-columbus",
        "address": "1000 Bay Ave",
        "neighborhood": "Downtown",
        "city": "Columbus",
        "state": "GA",
        "zip": "31901",
        "lat": 32.4712,
        "lng": -84.9932,
        "venue_type": "park",
        "spot_type": "park",
        "website": "https://whitewaterexpress.com",
        "vibes": ["whitewater", "rafting", "kayaking", "outdoor", "adventure", "group-activity"],
    },
    {
        "name": "Escape Outdoors Atlanta",
        "slug": "escape-outdoors-roswell",
        "address": "1395 S Marietta Pkwy SE",
        "neighborhood": "Roswell",
        "city": "Roswell",
        "state": "GA",
        "zip": "30067",
        "lat": 33.9307,
        "lng": -84.5169,
        "venue_type": "retail",
        "spot_type": "retail",
        "website": "https://escapeoutdoors.com",
        "vibes": ["outdoor", "kayaking", "paddleboard", "rental", "adventure"],
    },
]


def main():
    """Import outdoor recreation venues to database."""
    added = 0
    skipped = 0

    logger.info("=" * 60)
    logger.info("Importing Atlanta Outdoor Recreation Venues")
    logger.info("=" * 60)
    logger.info(f"Processing {len(OUTDOOR_VENUES)} venues...")
    logger.info("")

    for venue in OUTDOOR_VENUES:
        existing = get_venue_by_slug(venue["slug"])
        if existing:
            logger.info(f"  SKIP: {venue['name']} (already exists)")
            skipped += 1
            continue

        try:
            venue_id = get_or_create_venue(venue)
            logger.info(f"  ADD:  {venue['name']} -> ID {venue_id}")
            added += 1
        except Exception as e:
            logger.error(f"  ERROR: {venue['name']}: {e}")

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Done! Added {added} venues, skipped {skipped} existing.")
    logger.info(f"Total: {len(OUTDOOR_VENUES)} outdoor recreation venues")


if __name__ == "__main__":
    main()
