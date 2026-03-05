#!/usr/bin/env python3
"""
Import minor league and semi-pro sports venues in Atlanta metro.

Teams: Atlanta Gladiators (ECHL), Georgia Swarm (NLL), Atlanta Dream (WNBA),
Gwinnett Stripers (MiLB), Atlanta Roller Derby.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_minor_sports.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Note: Gas South Arena likely already exists from gas_south.py crawler.
# These are team/org entries and venue records for teams not yet covered.

MINOR_SPORTS = [
    # Atlanta Gladiators (ECHL Hockey) - play at Gas South Arena
    {
        "name": "Gas South Arena",
        "slug": "gas-south-arena",
        "address": "6400 Sugarloaf Pkwy",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30097",
        "lat": 33.9822,
        "lng": -84.0723,
        "venue_type": "arena",
        "spot_type": "arena",
        "website": "https://www.gassouthenarena.com",
        "vibes": ["sports", "hockey", "concert", "family-friendly"],
    },
    # Gwinnett Stripers (MiLB AAA, Braves affiliate)
    {
        "name": "Coolray Field",
        "slug": "coolray-field",
        "address": "2500 Buford Dr",
        "neighborhood": "Lawrenceville",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30043",
        "lat": 33.9601,
        "lng": -83.9891,
        "venue_type": "stadium",
        "spot_type": "arena",
        "website": "https://www.gostripers.com",
        "vibes": ["sports", "baseball", "family-friendly", "outdoor", "summer"],
    },
    # Atlanta Dream (WNBA) - play at Gateway Center Arena
    {
        "name": "Gateway Center Arena",
        "slug": "gateway-center-arena",
        "address": "2000 Convention Center Concourse",
        "neighborhood": "College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6356,
        "lng": -84.4526,
        "venue_type": "arena",
        "spot_type": "arena",
        "website": "https://gatewaycenter.com",
        "vibes": ["sports", "basketball", "concert", "family-friendly"],
    },
    # Georgia Swarm (NLL Lacrosse) - play at Gas South Arena
    # (venue already listed above, this is for reference)
    # Atlanta Roller Derby
    {
        "name": "Yaarab Shrine Center",
        "slug": "yaarab-shrine-center",
        "address": "400 Ponce De Leon Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7735,
        "lng": -84.3669,
        "venue_type": "arena",
        "spot_type": "arena",
        "website": None,
        "vibes": ["sports", "roller-derby", "alternative", "community"],
    },
    # Atlanta Hustle (AUDL Ultimate Frisbee)
    {
        "name": "Silverbacks Park",
        "slug": "silverbacks-park",
        "address": "3200 Atlanta Silverbacks Way",
        "neighborhood": "Suwanee",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30024",
        "lat": 34.0260,
        "lng": -84.0707,
        "venue_type": "stadium",
        "spot_type": "arena",
        "website": None,
        "vibes": ["sports", "ultimate-frisbee", "outdoor", "family-friendly"],
    },
]


def main():
    """Import minor league sports venues to database."""
    added = 0
    skipped = 0

    logger.info("=" * 60)
    logger.info("Importing Atlanta Minor League Sports Venues")
    logger.info("=" * 60)
    logger.info(f"Processing {len(MINOR_SPORTS)} venues...")
    logger.info("")

    for venue in MINOR_SPORTS:
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
    logger.info(f"Total: {len(MINOR_SPORTS)} sports venues")


if __name__ == "__main__":
    main()
