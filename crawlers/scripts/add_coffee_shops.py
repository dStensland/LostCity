#!/usr/bin/env python3
"""
Add top coffee shops in Atlanta.

Sources:
- Thrillist Best Coffee Shops Atlanta
- Atlanta Magazine Best Coffeehouses
- Local recommendations
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

COFFEE_SHOPS = [
    # Popular specialty coffee
    {
        "name": "Revelator Coffee",
        "slug": "revelator-coffee-westside",
        "address": "1065 Howell Mill Rd NW",
        "neighborhood": "Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7845,
        "lng": -84.4068,
        "venue_type": "coffee_shop",
        "website": "https://revelatorcoffee.com",
    },
    {
        "name": "Revelator Coffee - Krog Street",
        "slug": "revelator-coffee-krog",
        "address": "99 Krog St NE Suite J",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7581,
        "lng": -84.3636,
        "venue_type": "coffee_shop",
        "website": "https://revelatorcoffee.com",
    },
    {
        "name": "Chrome Yellow Trading Co",
        "slug": "chrome-yellow",
        "address": "515 N McDonough St",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7765,
        "lng": -84.2958,
        "venue_type": "coffee_shop",
        "website": "https://chromeyellow.com",
    },
    {
        "name": "East Pole Coffee Co",
        "slug": "east-pole-coffee",
        "address": "225 Baker St NW Suite E",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "lat": 33.7668,
        "lng": -84.3918,
        "venue_type": "coffee_shop",
        "website": "https://eastpolecoffee.com",
    },
    {
        "name": "Spiller Park Coffee",
        "slug": "spiller-park-toco-hills",
        "address": "2865 N Druid Hills Rd NE",
        "neighborhood": "Toco Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.8128,
        "lng": -84.3158,
        "venue_type": "coffee_shop",
        "website": "https://spillerpark.com",
    },
    {
        "name": "Spiller Park Coffee - PCM",
        "slug": "spiller-park-pcm",
        "address": "675 Ponce De Leon Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7725,
        "lng": -84.3555,
        "venue_type": "coffee_shop",
        "website": "https://spillerpark.com",
    },
    {
        "name": "Brash Coffee",
        "slug": "brash-coffee",
        "address": "1168 Howell Mill Rd NW",
        "neighborhood": "Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7895,
        "lng": -84.4098,
        "venue_type": "coffee_shop",
        "website": "https://drinkbrash.com",
    },
    {
        "name": "Taproom Coffee",
        "slug": "taproom-coffee-kirkwood",
        "address": "1963 Hosea L Williams Dr NE",
        "neighborhood": "Kirkwood",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30317",
        "lat": 33.7558,
        "lng": -84.3258,
        "venue_type": "coffee_shop",
        "website": "https://taproomcoffee.com",
    },
    {
        "name": "Little Tart Bakeshop",
        "slug": "little-tart-bakeshop",
        "address": "99 Krog St NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7581,
        "lng": -84.3636,
        "venue_type": "coffee_shop",
        "website": "https://littletartbakeshop.com",
    },
    {
        "name": "Octane Coffee - Grant Park",
        "slug": "octane-coffee-grant-park",
        "address": "437 Memorial Dr SE",
        "neighborhood": "Grant Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7458,
        "lng": -84.3698,
        "venue_type": "coffee_shop",
        "website": "https://octanecoffee.com",
    },
    {
        "name": "Octane Coffee - Westside",
        "slug": "octane-coffee-westside",
        "address": "1009 Marietta St NW",
        "neighborhood": "Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7798,
        "lng": -84.4108,
        "venue_type": "coffee_shop",
        "website": "https://octanecoffee.com",
    },
    {
        "name": "Dancing Goats Coffee - Ponce",
        "slug": "dancing-goats-ponce",
        "address": "630 Ponce De Leon Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7718,
        "lng": -84.3598,
        "venue_type": "coffee_shop",
        "website": "https://dancinggoats.com",
    },
    {
        "name": "Dancing Goats Coffee - Decatur",
        "slug": "dancing-goats-decatur",
        "address": "127 E Court Square",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7745,
        "lng": -84.2945,
        "venue_type": "coffee_shop",
        "website": "https://dancinggoats.com",
    },
    {
        "name": "Docent Coffee",
        "slug": "docent-coffee",
        "address": "466 Edgewood Ave SE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7548,
        "lng": -84.3705,
        "venue_type": "coffee_shop",
        "website": "https://docentcoffee.com",
    },
    {
        "name": "Joe's East Atlanta Coffee",
        "slug": "joes-east-atlanta",
        "address": "510 Flat Shoals Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7398,
        "lng": -84.3388,
        "venue_type": "coffee_shop",
        "website": None,
    },
    {
        "name": "San Francisco Coffee Roasting Co",
        "slug": "sf-coffee-roasting",
        "address": "1192 N Highland Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7898,
        "lng": -84.3508,
        "venue_type": "coffee_shop",
        "website": "https://sfcoffee.com",
    },
    {
        "name": "Muchacho",
        "slug": "muchacho-summerhill",
        "address": "73 Georgia Ave SE",
        "neighborhood": "Summerhill",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7415,
        "lng": -84.3825,
        "venue_type": "coffee_shop",
        "website": "https://muchacho.coffee",
    },
    {
        "name": "Condesa Coffee",
        "slug": "condesa-coffee",
        "address": "480 John Wesley Dobbs Ave NE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7578,
        "lng": -84.3728,
        "venue_type": "coffee_shop",
        "website": None,
    },
    {
        "name": "Hodgepodge Coffeehouse",
        "slug": "hodgepodge-coffeehouse",
        "address": "720 Moreland Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7358,
        "lng": -84.3468,
        "venue_type": "coffee_shop",
        "website": "https://hodgepodgecoffee.com",
    },
    {
        "name": "Java Jive",
        "slug": "java-jive-ponce",
        "address": "790 Ponce De Leon Pl NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7728,
        "lng": -84.3508,
        "venue_type": "coffee_shop",
        "website": None,
    },
    {
        "name": "Chattahoochee Coffee Company",
        "slug": "chattahoochee-coffee",
        "address": "3654 Chattahoochee Summit Dr SE",
        "neighborhood": "Vinings",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30339",
        "lat": 33.8518,
        "lng": -84.4628,
        "venue_type": "coffee_shop",
        "website": "https://chattcoffee.com",
    },
    {
        "name": "Prevail Union",
        "slug": "prevail-union",
        "address": "883 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7785,
        "lng": -84.3828,
        "venue_type": "coffee_shop",
        "website": "https://prevailcoffee.com",
    },
    {
        "name": "Aurora Coffee",
        "slug": "aurora-coffee-little-five",
        "address": "468 Moreland Ave NE",
        "neighborhood": "Little Five Points",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7648,
        "lng": -84.3488,
        "venue_type": "coffee_shop",
        "website": "https://auroracoffee.com",
    },
    {
        "name": "Bold Monk Brewing Co",
        "slug": "bold-monk-brewing",
        "address": "1737 Ellsworth Industrial Blvd NW",
        "neighborhood": "Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7968,
        "lng": -84.4308,
        "venue_type": "brewery",
        "website": "https://boldmonkbrewing.com",
    },
    {
        "name": "Radio Roasters Coffee",
        "slug": "radio-roasters",
        "address": "1045 Marietta St NW",
        "neighborhood": "Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7808,
        "lng": -84.4118,
        "venue_type": "coffee_shop",
        "website": "https://radioroasters.com",
    },
    {
        "name": "Steady Hand Pour House",
        "slug": "steady-hand-pour-house",
        "address": "1401 N Highland Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7978,
        "lng": -84.3488,
        "venue_type": "coffee_shop",
        "website": "https://steadyhandpourhouse.com",
    },
    {
        "name": "Civil Coffee Company",
        "slug": "civil-coffee",
        "address": "1350 Joseph E Lowery Blvd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30314",
        "lat": 33.7848,
        "lng": -84.4318,
        "venue_type": "coffee_shop",
        "website": None,
    },
    {
        "name": "Land of a Thousand Hills",
        "slug": "land-thousand-hills",
        "address": "232 19th St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30363",
        "lat": 33.7868,
        "lng": -84.3858,
        "venue_type": "coffee_shop",
        "website": "https://landofathousandhills.com",
    },
]


def main():
    """Add all coffee shops to database."""
    added = 0
    skipped = 0

    logger.info("=" * 60)
    logger.info("Adding Atlanta Coffee Shops")
    logger.info("=" * 60)
    logger.info(f"Processing {len(COFFEE_SHOPS)} coffee shops...")
    logger.info("")

    for venue in COFFEE_SHOPS:
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
    logger.info(f"Done! Added {added} coffee shops, skipped {skipped} existing.")


if __name__ == "__main__":
    main()
