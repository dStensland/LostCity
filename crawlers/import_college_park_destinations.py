#!/usr/bin/env python3
"""
Import top destinations in College Park, GA.

Focuses on curator-vetted venues highlighting Black-owned businesses,
soul food, Gullah-Geechee cuisine, and the vibrant Main Street corridor.

Priority Venues (Curator-Vetted):
- Virgil's Gullah Kitchen & Bar - Gullah-Geechee cuisine
- The Breakfast Boys - Black-owned brunch
- Brake Pad - Neighborhood pub
- The Corner Grille - Creole in historic church
- Hattie Marie's Texas Style BBQ - BBQ

Additional Categories:
- Restaurants (11): Soul food, Ethiopian, Southern, BBQ
- Bars (1): Rooftop bar
- Venues (3): Gateway Center Arena, PushPush Arts, South Fulton Arts Center

Sources:
- Curator recommendations
- College Park Main Street Association
- Atlanta Magazine South Fulton guide
- Local business directories

Note on Tags:
Tags like "gullah-geechee", "black-owned", "soul-food", "brunch", "bbq" should be
added via the venue_tags system after import. This requires:
1. Tag definitions in venue_tag_definitions table
2. User authentication to add tags via venue_tags table
Tags are not stored as direct venue properties but in separate relational tables.

Usage:
    cd crawlers
    python3 import_college_park_destinations.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Curator-Vetted Priority Venues (Highest Quality)
# Note: Tags like "gullah-geechee", "black-owned", "soul-food" should be added
# via the venue_tags system after import (requires tag definitions + user auth)
PRIORITY_RESTAURANTS = [
    {
        "name": "Virgil's Gullah Kitchen & Bar",
        "slug": "virgils-gullah-kitchen",
        "address": "3721 Main St",
        "neighborhood": "Historic College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6460,
        "lng": -84.4493,
        "venue_type": "restaurant",
        "website": "https://virgilsgullah.com",
    },
    {
        "name": "The Breakfast Boys",
        "slug": "breakfast-boys-college-park",
        "address": "3387 Main St",
        "neighborhood": "Historic College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6450,
        "lng": -84.4483,
        "venue_type": "restaurant",
        "website": None,
    },
    {
        "name": "Brake Pad",
        "slug": "brake-pad-college-park",
        "address": "3403 E Main St",
        "neighborhood": "Historic College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6451,
        "lng": -84.4484,
        "venue_type": "bar",
        "website": None,
    },
    {
        "name": "The Corner Grille",
        "slug": "corner-grille-college-park",
        "address": "3823 Main St",
        "neighborhood": "Historic College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6468,
        "lng": -84.4501,
        "venue_type": "restaurant",
        "website": None,
    },
    {
        "name": "Hattie Marie's Texas Style BBQ",
        "slug": "hattie-maries-bbq",
        "address": "3699 Main St",
        "neighborhood": "Historic College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6459,
        "lng": -84.4492,
        "venue_type": "restaurant",
        "website": None,
    },
]

# Additional College Park Restaurants
RESTAURANTS = [
    {
        "name": "Big Daddy's Kitchen",
        "slug": "big-daddys-kitchen-college-park",
        "address": "5549 Old National Hwy",
        "neighborhood": "College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30349",
        "lat": 33.6358,
        "lng": -84.4578,
        "venue_type": "restaurant",
        "website": None,
    },
    {
        "name": "Bole Ethiopian",
        "slug": "bole-ethiopian-college-park",
        "address": "1583 Virginia Ave",
        "neighborhood": "College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6412,
        "lng": -84.4445,
        "venue_type": "restaurant",
        "website": None,
    },
    {
        "name": "T's Brunch Bar",
        "slug": "ts-brunch-bar-college-park",
        "address": "3700 Main St",
        "neighborhood": "Historic College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6460,
        "lng": -84.4493,
        "venue_type": "restaurant",
        "website": None,
    },
    {
        "name": "Barbecue Kitchen",
        "slug": "barbecue-kitchen-college-park",
        "address": "1437 Virginia Ave",
        "neighborhood": "College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6405,
        "lng": -84.4438,
        "venue_type": "restaurant",
        "website": None,
    },
    {
        "name": "Lickety Split Southern Kitchen",
        "slug": "lickety-split-college-park",
        "address": "3500 Main St",
        "neighborhood": "Historic College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6455,
        "lng": -84.4488,
        "venue_type": "restaurant",
        "website": None,
    },
]

# College Park Bars
BARS = [
    {
        "name": "Nouveau Bar & Grill",
        "slug": "nouveau-bar-grill-college-park",
        "address": "3775 Main St",
        "neighborhood": "Historic College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6464,
        "lng": -84.4497,
        "venue_type": "bar",
        "website": None,
    },
]

# College Park Venues & Entertainment
VENUES = [
    {
        "name": "Gateway Center Arena",
        "slug": "gateway-center-arena",
        "address": "2330 Convention Center Concourse",
        "neighborhood": "College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6520,
        "lng": -84.4425,
        "venue_type": "performing_arts",
        "website": "https://www.gatewaycenterarena.com",
    },
    {
        "name": "PushPush Arts",
        "slug": "pushpush-arts-college-park",
        "address": "1805 Harvard Ave",
        "neighborhood": "College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30337",
        "lat": 33.6428,
        "lng": -84.4458,
        "venue_type": "performing_arts",
        "website": "https://pushpusharts.org",
    },
    {
        "name": "South Fulton Arts Center",
        "slug": "south-fulton-arts-center",
        "address": "4645 Butner Rd",
        "neighborhood": "College Park",
        "city": "College Park",
        "state": "GA",
        "zip": "30349",
        "lat": 33.6238,
        "lng": -84.4658,
        "venue_type": "performing_arts",
        "website": None,
    },
]


def main():
    """Import all College Park destinations to database."""
    added = 0
    skipped = 0

    all_venues = PRIORITY_RESTAURANTS + RESTAURANTS + BARS + VENUES

    logger.info("=" * 60)
    logger.info("Importing College Park Destinations")
    logger.info("=" * 60)
    logger.info(f"Processing {len(all_venues)} venues...")
    logger.info("")

    for venue in all_venues:
        # Check if already exists
        existing = get_venue_by_slug(venue["slug"])
        if existing:
            logger.info(f"  SKIP: {venue['name']} (already exists)")
            skipped += 1
            continue

        # Add venue
        try:
            venue_id = get_or_create_venue(venue)
            logger.info(f"  ADD:  {venue['name']} -> ID {venue_id}")
            added += 1
        except Exception as e:
            logger.error(f"  ERROR: {venue['name']}: {e}")

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Done! Added {added} venues, skipped {skipped} existing.")
    logger.info("")
    logger.info("Summary by category:")
    logger.info(f"  Priority Restaurants (Curator-Vetted): {len(PRIORITY_RESTAURANTS)}")
    logger.info(f"  Additional Restaurants: {len(RESTAURANTS)}")
    logger.info(f"  Bars: {len(BARS)}")
    logger.info(f"  Venues & Arts: {len(VENUES)}")
    logger.info(f"  Total: {len(all_venues)}")


if __name__ == "__main__":
    main()
