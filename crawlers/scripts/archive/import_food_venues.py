#!/usr/bin/env python3
"""
Import food halls and food truck parks in the Atlanta metro area.

~5 venues: Chattahoochee Food Works, Politan Row, Stackhouse, etc.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_food_venues.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

FOOD_VENUES = [
    {
        "name": "Chattahoochee Food Works",
        "slug": "chattahoochee-food-works",
        "address": "1235 Chattahoochee Ave NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7987,
        "lng": -84.4277,
        "venue_type": "food_hall",
        "spot_type": "restaurant",
        "website": "https://www.chattfoodworks.com",
        "vibes": ["food-hall", "date-night", "group-activity", "international", "craft-cocktails"],
    },
    {
        "name": "Politan Row",
        "slug": "politan-row-atlanta",
        "address": "1075 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7841,
        "lng": -84.3835,
        "venue_type": "food_hall",
        "spot_type": "restaurant",
        "website": "https://www.politanrow.com",
        "vibes": ["food-hall", "date-night", "international", "casual", "trendy"],
    },
    {
        "name": "Stackhouse",
        "slug": "stackhouse-decatur",
        "address": "220 E Howard Ave",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7698,
        "lng": -84.2934,
        "venue_type": "food_hall",
        "spot_type": "restaurant",
        "website": None,
        "vibes": ["food-hall", "casual", "local", "family-friendly"],
    },
    {
        "name": "The Works Atlanta",
        "slug": "the-works-atlanta",
        "address": "1235 Chattahoochee Ave NW Suite 600",
        "neighborhood": "Upper Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7991,
        "lng": -84.4285,
        "venue_type": "food_hall",
        "spot_type": "restaurant",
        "website": "https://www.theworksatl.com",
        "vibes": ["food-hall", "shopping", "entertainment", "local"],
    },
    {
        "name": "Atlanta Food Truck Park & Market",
        "slug": "atlanta-food-truck-park",
        "address": "1850 Howell Mill Rd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.8018,
        "lng": -84.4135,
        "venue_type": "food_hall",
        "spot_type": "restaurant",
        "website": None,
        "vibes": ["food-trucks", "outdoor", "casual", "family-friendly", "local"],
    },
]


def main():
    """Import food hall and food truck park venues to database."""
    added = 0
    skipped = 0

    logger.info("=" * 60)
    logger.info("Importing Atlanta Food Halls & Food Truck Parks")
    logger.info("=" * 60)
    logger.info(f"Processing {len(FOOD_VENUES)} venues...")
    logger.info("")

    for venue in FOOD_VENUES:
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
    logger.info(f"Total: {len(FOOD_VENUES)} food venues")


if __name__ == "__main__":
    main()
