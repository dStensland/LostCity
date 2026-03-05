#!/usr/bin/env python3
"""
Import family-friendly attractions near Emory Healthcare facilities.

For out-of-town families staying near Emory hospitals during multi-day treatment.
Includes museums, parks, entertainment venues, bookstores, extended-stay hotels.

~20 venues: CDC Museum, Lullwater Preserve, Botanical Garden, movie theaters,
parks, bookstores, extended-stay hotels near Emory, St. Joseph's, Johns Creek.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_emory_family_attractions.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Museums & Attractions (near Druid Hills/Decatur)
MUSEUMS_AND_ATTRACTIONS = [
    {
        "name": "David J. Sencer CDC Museum",
        "slug": "cdc-museum",
        "address": "1600 Clifton Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.7988,
        "lng": -84.3270,
        "venue_type": "museum",
        "spot_type": "museum",
        "website": "https://www.cdc.gov/museum",
    },
    {
        "name": "Lullwater Preserve",
        "slug": "lullwater-preserve",
        "address": "1463 Clifton Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7910,
        "lng": -84.3185,
        "venue_type": "park",
        "spot_type": "park",
        "website": "https://www.emory.edu/home/about/visit/lullwater.html",
    },
    {
        "name": "Atlanta Botanical Garden",
        "slug": "atlanta-botanical-garden",
        "address": "1345 Piedmont Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7897,
        "lng": -84.3731,
        "venue_type": "garden",
        "spot_type": "garden",
        "website": "https://www.atlantabg.org",
    },
    {
        "name": "Fernbank Science Center",
        "slug": "fernbank-science-center",
        "address": "156 Heaton Park Dr NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7830,
        "lng": -84.3110,
        "venue_type": "museum",
        "spot_type": "museum",
        "website": "https://www.fernbankscience.org",
    },
    {
        "name": "Callanwolde Fine Arts Center",
        "slug": "callanwolde-fine-arts-center",
        "address": "980 Briarcliff Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7898,
        "lng": -84.3385,
        "venue_type": "gallery",
        "spot_type": "gallery",
        "website": "https://www.callanwolde.org",
    },
]

# Parks & Green Spaces
PARKS = [
    {
        "name": "Olmsted Linear Park",
        "slug": "olmsted-linear-park",
        "address": "Ponce de Leon Ave",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.785,
        "lng": -84.325,
        "venue_type": "park",
        "spot_type": "park",
        "website": None,
    },
    {
        "name": "Mason Mill Park",
        "slug": "mason-mill-park",
        "address": "1340 McConnell Dr",
        "neighborhood": "North Druid Hills",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "lat": 33.803,
        "lng": -84.298,
        "venue_type": "park",
        "spot_type": "park",
        "website": None,
    },
    {
        "name": "Medlock Park",
        "slug": "medlock-park",
        "address": "874 Gaylemont Circle",
        "neighborhood": "North Druid Hills",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "lat": 33.796,
        "lng": -84.305,
        "venue_type": "park",
        "spot_type": "park",
        "website": None,
    },
    {
        "name": "Candler Park",
        "slug": "candler-park",
        "address": "1500 McLendon Ave NE",
        "neighborhood": "Candler Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7658,
        "lng": -84.3350,
        "venue_type": "park",
        "spot_type": "park",
        "website": "https://www.atlantaga.gov/government/departments/parks-recreation/parks-facilities/parks-recreation-centers/candler-park",
    },
]

# Entertainment & Shopping
ENTERTAINMENT = [
    {
        "name": "Toco Hills Shopping Center",
        "slug": "toco-hills-shopping-center",
        "address": "2945 N Druid Hills Rd",
        "neighborhood": "Toco Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.815,
        "lng": -84.313,
        "venue_type": "venue",
        "spot_type": "venue",
        "website": None,
    },
    {
        "name": "AMC Dine-In North DeKalb 16",
        "slug": "amc-north-dekalb-16",
        "address": "2042 Lawrenceville Hwy",
        "neighborhood": "North Druid Hills",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "lat": 33.793,
        "lng": -84.278,
        "venue_type": "cinema",
        "spot_type": "cinema",
        "website": "https://www.amctheatres.com/movie-theatres/atlanta/amc-dine-in-north-dekalb-16",
    },
    {
        "name": "Regal Perimeter Pointe",
        "slug": "regal-perimeter-pointe",
        "address": "1155 Mount Vernon Hwy",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30338",
        "lat": 33.930,
        "lng": -84.345,
        "venue_type": "cinema",
        "spot_type": "cinema",
        "website": "https://www.regmovies.com",
    },
    {
        "name": "AMC Johns Creek 14",
        "slug": "amc-johns-creek-14",
        "address": "11471 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.053,
        "lng": -84.175,
        "venue_type": "cinema",
        "spot_type": "cinema",
        "website": "https://www.amctheatres.com/movie-theatres/atlanta/amc-johns-creek-14",
    },
]

# Bookstores
BOOKSTORES = [
    {
        "name": "Little Shop of Stories",
        "slug": "little-shop-of-stories",
        "address": "133 E Court Sq",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7748,
        "lng": -84.2950,
        "venue_type": "bookstore",
        "spot_type": "bookstore",
        "website": "https://www.littleshopofstories.com",
    },
    {
        "name": "Eagle Eye Book Shop",
        "slug": "eagle-eye-book-shop",
        "address": "2076 N Decatur Rd",
        "neighborhood": "North Druid Hills",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "lat": 33.805,
        "lng": -84.302,
        "venue_type": "bookstore",
        "spot_type": "bookstore",
        "website": "https://www.eagleeyebooks.com",
    },
]

# Extended-Stay Hotels (for multi-week treatment stays)
EXTENDED_STAY_HOTELS = [
    {
        "name": "Residence Inn Atlanta Decatur",
        "slug": "residence-inn-decatur",
        "address": "1 W Court Sq",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7738,
        "lng": -84.2962,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.marriott.com/en-us/hotels/atldn-residence-inn-atlanta-decatur/overview/",
    },
    {
        "name": "Homewood Suites Decatur",
        "slug": "homewood-suites-decatur",
        "address": "130 Clairemont Ave",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.774,
        "lng": -84.296,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.hilton.com/en/hotels/decathw-homewood-suites-atlanta-decatur/",
    },
    {
        "name": "Extended Stay America Perimeter",
        "slug": "extended-stay-america-perimeter",
        "address": "1050 Hammond Dr",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.920,
        "lng": -84.345,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.extendedstayamerica.com",
    },
    {
        "name": "Staybridge Suites Perimeter",
        "slug": "staybridge-suites-perimeter",
        "address": "4601 Ridgeview Rd",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30338",
        "lat": 33.926,
        "lng": -84.344,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.ihg.com/staybridge/hotels/us/en/atlanta/atlsb/hoteldetail",
    },
    {
        "name": "Residence Inn Johns Creek",
        "slug": "residence-inn-johns-creek",
        "address": "11010 Haynes Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.058,
        "lng": -84.180,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.marriott.com/en-us/hotels/atljc-residence-inn-atlanta-north-johns-creek/overview/",
    },
]

ALL_VENUES = (
    MUSEUMS_AND_ATTRACTIONS + PARKS + ENTERTAINMENT + BOOKSTORES + EXTENDED_STAY_HOTELS
)


def main():
    """Import Emory family attraction venues to database."""
    added = 0
    skipped = 0

    logger.info("=" * 60)
    logger.info("Importing Emory Family Attractions")
    logger.info("=" * 60)
    logger.info(f"Processing {len(ALL_VENUES)} venues...")
    logger.info("")

    # Process by category for organized logging
    categories = [
        ("Museums & Attractions", MUSEUMS_AND_ATTRACTIONS),
        ("Parks & Green Spaces", PARKS),
        ("Entertainment & Shopping", ENTERTAINMENT),
        ("Bookstores", BOOKSTORES),
        ("Extended-Stay Hotels", EXTENDED_STAY_HOTELS),
    ]

    for category_name, venues in categories:
        logger.info(f"\n{category_name} ({len(venues)} venues):")
        for venue in venues:
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
    logger.info(f"Total: {len(ALL_VENUES)} family-friendly venues")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
