#!/usr/bin/env python3
"""
Import workshop studios and creative spaces in the Atlanta metro area.

~10 venues: Painting With a Twist, Board & Brush, The Loaded Brush,
Highland Woodworking, Glazed and Amused, Pinot's Palette, etc.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_workshop_studios.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

WORKSHOP_STUDIOS = [
    {
        "name": "Painting With a Twist - Brookhaven",
        "slug": "painting-with-a-twist-brookhaven",
        "address": "2484 Briarcliff Rd NE Suite 35",
        "neighborhood": "Brookhaven",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.8213,
        "lng": -84.3293,
        "venue_type": "studio",
        "spot_type": "studio",
        "website": "https://www.paintingwithatwist.com/studio/brookhaven/",
        "vibes": ["workshop", "creative", "hands-on", "date-night", "paint-and-sip"],
    },
    {
        "name": "Painting With a Twist - Sandy Springs",
        "slug": "painting-with-a-twist-sandy-springs",
        "address": "6690 Roswell Rd NE Suite 170",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9383,
        "lng": -84.3521,
        "venue_type": "studio",
        "spot_type": "studio",
        "website": "https://www.paintingwithatwist.com/studio/sandy-springs/",
        "vibes": ["workshop", "creative", "hands-on", "date-night", "paint-and-sip"],
    },
    {
        "name": "Board & Brush Buckhead",
        "slug": "board-and-brush-buckhead",
        "address": "3167 Peachtree Rd NE Suite M",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "lat": 33.8453,
        "lng": -84.3660,
        "venue_type": "studio",
        "spot_type": "studio",
        "website": "https://boardandbrush.com/buckhead/",
        "vibes": ["workshop", "creative", "hands-on", "date-night", "diy", "woodworking"],
    },
    {
        "name": "The Loaded Brush",
        "slug": "the-loaded-brush-decatur",
        "address": "110 E Court Square Suite 176",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7748,
        "lng": -84.2963,
        "venue_type": "studio",
        "spot_type": "studio",
        "website": "https://www.theloadedbrush.com",
        "vibes": ["workshop", "creative", "hands-on", "date-night", "paint-and-sip"],
    },
    {
        "name": "Highland Woodworking",
        "slug": "highland-woodworking",
        "address": "1045 N Highland Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7878,
        "lng": -84.3504,
        "venue_type": "studio",
        "spot_type": "studio",
        "website": "https://www.highlandwoodworking.com",
        "vibes": ["workshop", "hands-on", "woodworking", "classes", "tools"],
    },
    {
        "name": "Glazed and Amused",
        "slug": "glazed-and-amused",
        "address": "5920 Roswell Rd NE Suite B115",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9313,
        "lng": -84.3536,
        "venue_type": "studio",
        "spot_type": "studio",
        "website": "https://www.glazedandamused.com",
        "vibes": ["workshop", "creative", "hands-on", "family-friendly", "pottery", "ceramics"],
    },
    {
        "name": "Pinot's Palette Duluth",
        "slug": "pinots-palette-duluth",
        "address": "2180 Pleasant Hill Rd Suite D4",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9555,
        "lng": -84.1437,
        "venue_type": "studio",
        "spot_type": "studio",
        "website": "https://www.pinotspalette.com/duluth",
        "vibes": ["workshop", "creative", "hands-on", "date-night", "paint-and-sip"],
    },
    {
        "name": "Color Me Mine Buckhead",
        "slug": "color-me-mine-buckhead",
        "address": "3393 Peachtree Rd NE Suite 3050B",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30326",
        "lat": 33.8487,
        "lng": -84.3621,
        "venue_type": "studio",
        "spot_type": "studio",
        "website": "https://buckhead.colormemine.com",
        "vibes": ["workshop", "creative", "hands-on", "family-friendly", "pottery", "ceramics"],
    },
    {
        "name": "Candle Bar Atlanta",
        "slug": "candle-bar-atlanta",
        "address": "675 Ponce De Leon Ave NE Suite N200",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7735,
        "lng": -84.3619,
        "venue_type": "studio",
        "spot_type": "studio",
        "website": "https://www.candlebaratl.com",
        "vibes": ["workshop", "creative", "hands-on", "date-night", "candle-making"],
    },
    {
        "name": "AR Workshop Atlanta",
        "slug": "ar-workshop-atlanta",
        "address": "1197 Peachtree St NE Suite 420",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30361",
        "lat": 33.7871,
        "lng": -84.3825,
        "venue_type": "studio",
        "spot_type": "studio",
        "website": "https://www.arworkshop.com/atlanta",
        "vibes": ["workshop", "creative", "hands-on", "date-night", "diy", "woodworking"],
    },
]


def main():
    """Import workshop studio venues to database."""
    added = 0
    skipped = 0

    logger.info("=" * 60)
    logger.info("Importing Atlanta Workshop Studios & Creative Spaces")
    logger.info("=" * 60)
    logger.info(f"Processing {len(WORKSHOP_STUDIOS)} venues...")
    logger.info("")

    for venue in WORKSHOP_STUDIOS:
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
    logger.info(f"Total: {len(WORKSHOP_STUDIOS)} workshop studios")


if __name__ == "__main__":
    main()
