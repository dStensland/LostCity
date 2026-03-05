#!/usr/bin/env python3
"""
Import late-night restaurants, 24hr diners, bars, and socializing spots near
Emory Healthcare campuses. These serve hospital staff working night shifts and
late evenings.

~20 venues across EUH Main (Druid Hills/Decatur), EUH Midtown, St. Joseph's
(Sandy Springs/Dunwoody), and Johns Creek Hospital.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_emory_latenight_staff.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

LATENIGHT_VENUES = [
    # ===== EUH Main (Druid Hills / Decatur) =====
    {
        "name": "Waffle House - N Decatur Rd",
        "slug": "waffle-house-n-decatur-rd",
        "address": "2455 N Decatur Rd",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.805,
        "lng": -84.318,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://locations.wafflehouse.com/ga-atlanta-2455ndecaturrd",
    },
    {
        "name": "IHOP Clairmont",
        "slug": "ihop-clairmont",
        "address": "2867 Clairmont Rd",
        "neighborhood": "North Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.816,
        "lng": -84.312,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.ihop.com",
    },
    {
        "name": "Brick Store Pub",
        "slug": "brick-store-pub",
        "address": "125 E Court Sq",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7748,
        "lng": -84.2962,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://brickstorepub.com",
    },
    {
        "name": "Leon's Full Service",
        "slug": "leons-full-service",
        "address": "131 E Ponce de Leon Ave",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7748,
        "lng": -84.2942,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://leonsfullservice.com",
    },
    {
        "name": "Victory Sandwich Bar",
        "slug": "victory-sandwich-bar-decatur",
        "address": "340 Church St",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7712,
        "lng": -84.2940,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://www.victorysandwichbar.com",
    },
    {
        "name": "SOS Tiki Bar",
        "slug": "sos-tiki-bar",
        "address": "340 Church St",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7713,
        "lng": -84.2941,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://sostikibar.com",
    },
    {
        "name": "Square Pub Decatur",
        "slug": "square-pub-decatur",
        "address": "115 Court Sq",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7750,
        "lng": -84.2955,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://www.squarepubdecatur.com",
    },
    {
        "name": "Thinking Man Tavern",
        "slug": "thinking-man-tavern",
        "address": "537 W Howard Ave",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7688,
        "lng": -84.2998,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://thinkingmantavern.com",
    },
    # ===== EUH Midtown (550 Peachtree) =====
    {
        "name": "The Vortex Midtown",
        "slug": "the-vortex-midtown",
        "address": "878 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7810,
        "lng": -84.3830,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://thevortexatl.com",
    },
    {
        "name": "Grindhouse Killer Burgers",
        "slug": "grindhouse-killer-burgers-edgewood",
        "address": "209 Edgewood Ave",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7535,
        "lng": -84.3780,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://grindhouseburgers.com",
    },
    {
        "name": "Waffle House Midtown",
        "slug": "waffle-house-midtown-juniper",
        "address": "1160 Juniper St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7830,
        "lng": -84.3810,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://locations.wafflehouse.com/ga-atlanta-1160juniperst",
    },
    {
        "name": "Hudson Grille Midtown",
        "slug": "hudson-grille-midtown",
        "address": "942 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7820,
        "lng": -84.3825,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://hudsongrille.com",
    },
    {
        "name": "Cypress Street Pint & Plate",
        "slug": "cypress-street-pint-and-plate",
        "address": "817 W Peachtree St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7785,
        "lng": -84.3870,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://cypressstreetpintandplate.com",
    },
    {
        "name": "Ri Ra Irish Pub Midtown",
        "slug": "ri-ra-irish-pub-midtown",
        "address": "1080 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7848,
        "lng": -84.3828,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://www.rira.com/atlanta",
    },
    # ===== St. Joseph's (Sandy Springs / Dunwoody) =====
    {
        "name": "Waffle House Sandy Springs",
        "slug": "waffle-house-sandy-springs-roswell",
        "address": "5920 Roswell Rd",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.920,
        "lng": -84.375,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://locations.wafflehouse.com/ga-sandysprings-5920roswellrd",
    },
    {
        "name": "Taco Mac Perimeter",
        "slug": "taco-mac-perimeter",
        "address": "1211 Ashford Crossing",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30346",
        "lat": 33.925,
        "lng": -84.340,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://tacomac.com",
    },
    {
        "name": "Mellow Mushroom Dunwoody",
        "slug": "mellow-mushroom-dunwoody",
        "address": "4779 Ashford Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "lat": 33.930,
        "lng": -84.345,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://mellowmushroom.com",
    },
    {
        "name": "Dunwoody Tavern",
        "slug": "dunwoody-tavern",
        "address": "5488 Chamblee Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "lat": 33.935,
        "lng": -84.330,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://dunwoodytavern.com",
    },
    # ===== Johns Creek Hospital =====
    {
        "name": "Waffle House Johns Creek",
        "slug": "waffle-house-johns-creek-state-bridge",
        "address": "10945 State Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30022",
        "lat": 34.045,
        "lng": -84.175,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://locations.wafflehouse.com/ga-johnscreek-10945statebridgerd",
    },
    {
        "name": "Taco Mac Johns Creek",
        "slug": "taco-mac-johns-creek",
        "address": "10900 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.053,
        "lng": -84.168,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://tacomac.com",
    },
]


def main():
    """Import late-night dining and bar venues near Emory Healthcare campuses."""
    added = 0
    skipped = 0

    logger.info("=" * 60)
    logger.info("Importing Emory Late-Night Staff Venues")
    logger.info("=" * 60)
    logger.info(f"Processing {len(LATENIGHT_VENUES)} venues...")
    logger.info("")

    for venue in LATENIGHT_VENUES:
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
    logger.info(f"Total: {len(LATENIGHT_VENUES)} late-night venues")


if __name__ == "__main__":
    main()
