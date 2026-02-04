#!/usr/bin/env python3
"""
Import karaoke venues in the Atlanta metro area.

~6 venues: Jeju Sauna, iKrave Karaoke, Karaoke Melody, Coin Karaoke,
Suzi Wong's, etc.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_karaoke_venues.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

KARAOKE_VENUES = [
    {
        "name": "Jeju Sauna",
        "slug": "jeju-sauna-duluth",
        "address": "3555 Gwinnett Pl Dr NW",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9615,
        "lng": -84.1480,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": "https://www.jejusauna.com",
        "vibes": ["karaoke", "nightlife", "group-activity", "late-night", "korean"],
    },
    {
        "name": "iKrave Karaoke",
        "slug": "ikrave-karaoke-duluth",
        "address": "2550 Pleasant Hill Rd Suite 116",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9588,
        "lng": -84.1429,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": "https://www.ikravekaraoke.com",
        "vibes": ["karaoke", "nightlife", "group-activity", "late-night", "private-rooms"],
    },
    {
        "name": "Karaoke Melody",
        "slug": "karaoke-melody-doraville",
        "address": "5495 Jimmy Carter Blvd Suite 102",
        "neighborhood": "Doraville",
        "city": "Doraville",
        "state": "GA",
        "zip": "30340",
        "lat": 33.9069,
        "lng": -84.2560,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": None,
        "vibes": ["karaoke", "nightlife", "group-activity", "late-night", "korean"],
    },
    {
        "name": "Coin Operated Karaoke",
        "slug": "coin-karaoke-doraville",
        "address": "6035 Peachtree Rd Suite C218",
        "neighborhood": "Doraville",
        "city": "Doraville",
        "state": "GA",
        "zip": "30360",
        "lat": 33.9268,
        "lng": -84.2807,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": None,
        "vibes": ["karaoke", "nightlife", "group-activity", "late-night", "private-rooms"],
    },
    {
        "name": "Suzi Wong's Karaoke Bar",
        "slug": "suzi-wongs-brookhaven",
        "address": "4038 Peachtree Rd NE Suite B",
        "neighborhood": "Brookhaven",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30319",
        "lat": 33.8630,
        "lng": -84.3390,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": None,
        "vibes": ["karaoke", "nightlife", "group-activity", "late-night", "dive-bar"],
    },
    {
        "name": "Fantasm Karaoke",
        "slug": "fantasm-karaoke-duluth",
        "address": "2160 Duluth Hwy Suite 2",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0015,
        "lng": -84.1481,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": None,
        "vibes": ["karaoke", "nightlife", "group-activity", "late-night", "private-rooms"],
    },
]


def main():
    """Import karaoke venues to database."""
    added = 0
    skipped = 0

    logger.info("=" * 60)
    logger.info("Importing Atlanta Karaoke Venues")
    logger.info("=" * 60)
    logger.info(f"Processing {len(KARAOKE_VENUES)} venues...")
    logger.info("")

    for venue in KARAOKE_VENUES:
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
    logger.info(f"Total: {len(KARAOKE_VENUES)} karaoke venues")


if __name__ == "__main__":
    main()
