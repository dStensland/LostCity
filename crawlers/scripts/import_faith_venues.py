#!/usr/bin/env python3
"""
Import Tier 2 faith-based venues to the LostCity database.

These are religious and spiritual destinations that should exist in our database
as places people would want to visit, even if we don't have dedicated crawlers for them.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_faith_venues.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

FAITH_VENUES = [
    {
        "name": "Big Bethel AME Church",
        "slug": "big-bethel-ame-church",
        "address": "220 Auburn Ave NE",
        "neighborhood": "Sweet Auburn",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7555,
        "lng": -84.3788,
        "venue_type": "church",
        "spot_type": "church",
        "website": "https://www.bigbethelame.org/",
        "vibes": ["faith-christian", "ame", "historic"],
        "description": "Historic African Methodist Episcopal church on Sweet Auburn Ave, home to the Heaven Bound pageant and jazz vespers series.",
    },
    {
        "name": "Hindu Temple of Atlanta",
        "slug": "hindu-temple-atlanta",
        "address": "5851 GA Highway 85",
        "neighborhood": "Riverdale",
        "city": "Riverdale",
        "state": "GA",
        "zip": "30274",
        "lat": 33.5580,
        "lng": -84.3989,
        "venue_type": "temple",
        "spot_type": "temple",
        "website": "https://hindutempleofatlanta.org/",
        "vibes": ["faith-hindu", "family-friendly", "all-ages"],
        "description": "Major Hindu temple hosting Diwali, Holi, Navaratri, and other festivals open to all.",
    },
    {
        "name": "Monastery of the Holy Spirit",
        "slug": "monastery-holy-spirit",
        "address": "2625 Highway 212 SW",
        "neighborhood": "Conyers",
        "city": "Conyers",
        "state": "GA",
        "zip": "30094",
        "lat": 33.5703,
        "lng": -84.0289,
        "venue_type": "monastery",
        "spot_type": "monastery",
        "website": "https://trappist.net/",
        "vibes": ["faith-christian", "catholic", "historic"],
        "description": "Trappist monastery with public tours, retreat center, and beautiful grounds. Monthly Highlights & Insights Tours.",
    },
    {
        "name": "Vedanta Center of Atlanta",
        "slug": "vedanta-center-atlanta",
        "address": "2331 Brockett Rd",
        "neighborhood": "Tucker",
        "city": "Tucker",
        "state": "GA",
        "zip": "30084",
        "lat": 33.8424,
        "lng": -84.2282,
        "venue_type": "temple",
        "spot_type": "temple",
        "website": "https://vedantaatlanta.org/",
        "vibes": ["faith-hindu", "intimate"],
        "description": "Center for Vedanta philosophy offering lectures, yoga, meditation, and spiritual counseling.",
    },
    {
        "name": "Greenforest Community Baptist Church",
        "slug": "greenforest-baptist-church",
        "address": "3250 Rainbow Dr",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30034",
        "lat": 33.7219,
        "lng": -84.2614,
        "venue_type": "church",
        "spot_type": "church",
        "website": "https://greenforest.org/",
        "vibes": ["faith-christian", "baptist", "family-friendly"],
        "description": "Large Decatur church hosting annual community health fairs and youth programs.",
    },
]


def main():
    """Import all faith-based venues."""
    logger.info(f"Starting import of {len(FAITH_VENUES)} faith-based venues...")

    created = 0
    existing = 0
    errors = 0

    for venue_data in FAITH_VENUES:
        venue_name = venue_data["name"]
        venue_slug = venue_data["slug"]

        try:
            # Check if venue already exists
            existing_venue = get_venue_by_slug(venue_slug)

            if existing_venue:
                logger.info(f"  ✓ {venue_name} already exists (ID: {existing_venue['id']})")
                existing += 1
            else:
                # Create new venue
                venue_id = get_or_create_venue(venue_data)
                logger.info(f"  + Created {venue_name} (ID: {venue_id})")
                created += 1

        except Exception as e:
            logger.error(f"  ✗ Error importing {venue_name}: {e}")
            errors += 1

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Import complete: {created} created, {existing} existing, {errors} errors")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
