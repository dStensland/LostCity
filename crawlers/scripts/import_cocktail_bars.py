#!/usr/bin/env python3
"""
Import cocktail bars and speakeasies in the Atlanta metro area.

~10 venues: Red Phone Booth, Himitsu, Paper Plane, The Consulate,
Tiny Lou's, Prohibition, Blossom Tree, Vesper, Bar Vegan, etc.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_cocktail_bars.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

COCKTAIL_BARS = [
    {
        "name": "Red Phone Booth",
        "slug": "red-phone-booth-atlanta",
        "address": "17 Andrew Young International Blvd NE",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7589,
        "lng": -84.3881,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://www.redphonebooth.com",
        "vibes": ["speakeasy", "cocktails", "date-night", "upscale", "hidden-gem"],
    },
    {
        "name": "Himitsu",
        "slug": "himitsu-atlanta",
        "address": "3050 Peachtree Rd NW Suite 2",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "lat": 33.8432,
        "lng": -84.3693,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://www.himitsuatl.com",
        "vibes": ["speakeasy", "cocktails", "date-night", "upscale", "japanese"],
    },
    {
        "name": "Paper Plane",
        "slug": "paper-plane-decatur",
        "address": "340 Church St",
        "neighborhood": "Downtown Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7748,
        "lng": -84.2963,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://paperplanecocktails.com",
        "vibes": ["cocktails", "date-night", "craft-cocktails", "intimate"],
    },
    {
        "name": "The Consulate",
        "slug": "the-consulate-atlanta",
        "address": "1100 Peachtree St NE Suite 200",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7848,
        "lng": -84.3833,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://theconsulateatlanta.com",
        "vibes": ["speakeasy", "cocktails", "date-night", "upscale", "rooftop"],
    },
    {
        "name": "Tiny Lou's",
        "slug": "tiny-lous-atlanta",
        "address": "789 Ponce De Leon Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7748,
        "lng": -84.3560,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://www.tinylous.com",
        "vibes": ["cocktails", "date-night", "upscale", "retro", "hotel-bar"],
    },
    {
        "name": "Prohibition Atlanta",
        "slug": "prohibition-atlanta",
        "address": "935 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7812,
        "lng": -84.3844,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://www.prohibitionatlanta.com",
        "vibes": ["speakeasy", "cocktails", "date-night", "live-music", "jazz"],
    },
    {
        "name": "Blossom Tree",
        "slug": "blossom-tree-atlanta",
        "address": "64 Peachtree St NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7555,
        "lng": -84.3887,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://www.blossomtreeatl.com",
        "vibes": ["speakeasy", "cocktails", "date-night", "asian-fusion"],
    },
    {
        "name": "Vesper",
        "slug": "vesper-atlanta",
        "address": "127 Peachtree St NE",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7560,
        "lng": -84.3879,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": None,
        "vibes": ["cocktails", "date-night", "upscale", "lounge"],
    },
    {
        "name": "Bar Vegan",
        "slug": "bar-vegan-atlanta",
        "address": "855 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7796,
        "lng": -84.3850,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://www.barveganatlanta.com",
        "vibes": ["cocktails", "vegan", "date-night", "trendy"],
    },
    {
        "name": "Ticonderoga Club",
        "slug": "ticonderoga-club",
        "address": "99 Krog St NE Suite W",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7584,
        "lng": -84.3634,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://www.ticonderogaclub.com",
        "vibes": ["cocktails", "date-night", "craft-cocktails", "intimate", "award-winning"],
    },
]


def main():
    """Import cocktail bar and speakeasy venues to database."""
    added = 0
    skipped = 0

    logger.info("=" * 60)
    logger.info("Importing Atlanta Cocktail Bars & Speakeasies")
    logger.info("=" * 60)
    logger.info(f"Processing {len(COCKTAIL_BARS)} venues...")
    logger.info("")

    for venue in COCKTAIL_BARS:
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
    logger.info(f"Total: {len(COCKTAIL_BARS)} cocktail bars & speakeasies")


if __name__ == "__main__":
    main()
