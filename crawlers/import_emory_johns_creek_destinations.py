#!/usr/bin/env python3
"""
Import destinations near Emory Johns Creek Hospital (6325 Hospital Pkwy, Johns Creek, GA).

Healthcare portal use case: patients, visitors, caregivers, and hospital staff
need nearby food, lodging, and essentials within 2-3 miles (suburban radius).

Categories:
- Restaurants (14): Stoney River, Marlow's, Uncle Jack's, 5 Seasons, etc.
- Coffee/Cafes (3): Starbucks, Café Intermezzo, Waffle House (24hr)
- Hotels (4): Hyatt Place, Courtyard, Holiday Inn Express, Hampton Inn
- Essentials (4): Publix, Kroger, CVS, Walgreens

Hospital location: 34.0700, -84.1724
Area: Johns Creek and adjacent Alpharetta (suburban)

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_emory_johns_creek_destinations.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Restaurants near Johns Creek Hospital
RESTAURANTS = [
    {
        "name": "Stoney River Steakhouse - Johns Creek",
        "slug": "stoney-river-johns-creek",
        "address": "10800 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0510,
        "lng": -84.1645,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.stoneyriver.com",
        "vibes": ["upscale", "steakhouse", "date-night", "business-dinner"],
    },
    {
        "name": "Marlow's Tavern - Johns Creek",
        "slug": "marlows-tavern-johns-creek",
        "address": "10700 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0505,
        "lng": -84.1640,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.marlowstavern.com",
        "vibes": ["casual", "american", "family-friendly", "bar"],
    },
    {
        "name": "5 Seasons Brewing - Johns Creek",
        "slug": "5-seasons-brewing-johns-creek",
        "address": "5600 Roswell Rd",
        "neighborhood": "Johns Creek",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30342",
        "lat": 33.9485,
        "lng": -84.3747,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.5seasonsbrewing.com",
        "vibes": ["brewery", "casual", "pizza", "craft-beer", "family-friendly"],
    },
    {
        "name": "Uncle Jack's Meat House - Alpharetta",
        "slug": "uncle-jacks-alpharetta",
        "address": "6300 North Point Pkwy",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30022",
        "lat": 34.0612,
        "lng": -84.2245,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.unclejacks.com",
        "vibes": ["steakhouse", "upscale", "american", "business-dinner"],
    },
    {
        "name": "Minato Japanese Restaurant - Johns Creek",
        "slug": "minato-johns-creek",
        "address": "10675 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0500,
        "lng": -84.1635,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.minatojc.com",
        "vibes": ["japanese", "sushi", "casual", "family-friendly"],
    },
    {
        "name": "Pho Bac - Johns Creek",
        "slug": "pho-bac-johns-creek",
        "address": "5230 Peachtree Pkwy",
        "neighborhood": "Johns Creek",
        "city": "Peachtree Corners",
        "state": "GA",
        "zip": "30092",
        "lat": 33.9738,
        "lng": -84.2217,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.phobacga.com",
        "vibes": ["vietnamese", "pho", "casual", "affordable"],
    },
    {
        "name": "Red Pepper Taqueria - Johns Creek",
        "slug": "red-pepper-taqueria-johns-creek",
        "address": "10675 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0502,
        "lng": -84.1638,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.redpeppertaqueria.com",
        "vibes": ["mexican", "taqueria", "casual", "affordable", "family-friendly"],
    },
    {
        "name": "Viethouse - Johns Creek",
        "slug": "viethouse-johns-creek",
        "address": "6035 Medlock Bridge Pkwy",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0455,
        "lng": -84.1612,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.viethousega.com",
        "vibes": ["vietnamese", "casual", "asian-fusion", "family-friendly"],
    },
    {
        "name": "Aqua Blue Seafood - Johns Creek",
        "slug": "aqua-blue-johns-creek",
        "address": "10800 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0508,
        "lng": -84.1642,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.aquablueseafood.com",
        "vibes": ["seafood", "upscale", "date-night", "fresh-fish"],
    },
    {
        "name": "Chick-fil-A - Johns Creek",
        "slug": "chick-fil-a-johns-creek",
        "address": "10955 State Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0338,
        "lng": -84.1535,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.chick-fil-a.com",
        "vibes": ["fast-food", "chicken", "family-friendly", "quick-bite"],
    },
    {
        "name": "Panera Bread - Johns Creek",
        "slug": "panera-bread-johns-creek",
        "address": "10850 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0512,
        "lng": -84.1648,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.panerabread.com",
        "vibes": ["bakery", "cafe", "soup-salad", "quick-bite", "wifi"],
    },
    {
        "name": "McAlister's Deli - Johns Creek",
        "slug": "mcalisters-deli-johns-creek",
        "address": "10675 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0504,
        "lng": -84.1636,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.mcalistersdeli.com",
        "vibes": ["deli", "sandwiches", "casual", "quick-bite", "family-friendly"],
    },
    {
        "name": "Zaxby's - Johns Creek",
        "slug": "zaxbys-johns-creek",
        "address": "5200 Windward Pkwy",
        "neighborhood": "Johns Creek",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30004",
        "lat": 34.0712,
        "lng": -84.2095,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.zaxbys.com",
        "vibes": ["fast-food", "chicken", "casual", "quick-bite"],
    },
    {
        "name": "Willy's Mexicana Grill - Johns Creek",
        "slug": "willys-mexicana-johns-creek",
        "address": "10675 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0506,
        "lng": -84.1639,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.willysmex.com",
        "vibes": ["mexican", "burrito-bowl", "casual", "quick-bite", "affordable"],
    },
]

# Coffee Shops & Cafes
COFFEE_SHOPS = [
    {
        "name": "Starbucks - Johns Creek Town Center",
        "slug": "starbucks-johns-creek-town-center",
        "address": "10700 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0507,
        "lng": -84.1643,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://www.starbucks.com",
        "vibes": ["coffee", "wifi", "quick-bite", "chain"],
    },
    {
        "name": "Café Intermezzo - Johns Creek",
        "slug": "cafe-intermezzo-johns-creek",
        "address": "5975 State Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0245,
        "lng": -84.1698,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://www.cafeintermezzo.com",
        "vibes": ["coffee", "desserts", "european", "date-night", "wifi"],
    },
    {
        "name": "Waffle House - Johns Creek",
        "slug": "waffle-house-johns-creek-hospital",
        "address": "11055 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0520,
        "lng": -84.1655,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.wafflehouse.com",
        "vibes": ["diner", "24hr", "breakfast", "southern", "late-night"],
    },
]

# Hotels near Johns Creek Hospital
HOTELS = [
    {
        "name": "Hyatt Place Johns Creek",
        "slug": "hyatt-place-johns-creek",
        "address": "11505 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0595,
        "lng": -84.1705,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.hyatt.com",
        "vibes": ["hotel", "lodging", "business", "family-friendly"],
    },
    {
        "name": "Courtyard by Marriott Johns Creek",
        "slug": "courtyard-marriott-johns-creek",
        "address": "11505 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0598,
        "lng": -84.1708,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.marriott.com",
        "vibes": ["hotel", "lodging", "business", "family-friendly"],
    },
    {
        "name": "Holiday Inn Express Johns Creek",
        "slug": "holiday-inn-express-johns-creek",
        "address": "11505 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0592,
        "lng": -84.1702,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.ihg.com",
        "vibes": ["hotel", "lodging", "affordable", "family-friendly"],
    },
    {
        "name": "Hampton Inn Alpharetta/Johns Creek",
        "slug": "hampton-inn-johns-creek",
        "address": "5775 Windward Pkwy",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30005",
        "lat": 34.0678,
        "lng": -84.2135,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.hilton.com",
        "vibes": ["hotel", "lodging", "business", "family-friendly"],
    },
]

# Essential Services (pharmacies, groceries)
ESSENTIALS = [
    {
        "name": "Publix - Johns Creek Town Center",
        "slug": "publix-johns-creek-town-center",
        "address": "10675 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0503,
        "lng": -84.1637,
        "venue_type": "grocery",
        "spot_type": "essentials",
        "website": "https://www.publix.com",
        "vibes": ["grocery", "pharmacy", "essentials"],
    },
    {
        "name": "Kroger - Johns Creek",
        "slug": "kroger-johns-creek",
        "address": "10955 State Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0335,
        "lng": -84.1532,
        "venue_type": "grocery",
        "spot_type": "essentials",
        "website": "https://www.kroger.com",
        "vibes": ["grocery", "pharmacy", "essentials"],
    },
    {
        "name": "CVS Pharmacy - Johns Creek",
        "slug": "cvs-pharmacy-johns-creek",
        "address": "10955 State Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0340,
        "lng": -84.1535,
        "venue_type": "pharmacy",
        "spot_type": "essentials",
        "website": "https://www.cvs.com",
        "vibes": ["pharmacy", "essentials", "24hr"],
    },
    {
        "name": "Walgreens - Johns Creek",
        "slug": "walgreens-johns-creek",
        "address": "10675 Medlock Bridge Rd",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0505,
        "lng": -84.1638,
        "venue_type": "pharmacy",
        "spot_type": "essentials",
        "website": "https://www.walgreens.com",
        "vibes": ["pharmacy", "essentials", "24hr"],
    },
]


def main():
    """Import all Johns Creek Hospital area destinations to database."""
    added = 0
    skipped = 0

    all_venues = RESTAURANTS + COFFEE_SHOPS + HOTELS + ESSENTIALS

    logger.info("=" * 60)
    logger.info("Importing Emory Johns Creek Hospital Destinations")
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
    logger.info(f"  Restaurants: {len(RESTAURANTS)}")
    logger.info(f"  Coffee/Cafes: {len(COFFEE_SHOPS)}")
    logger.info(f"  Hotels: {len(HOTELS)}")
    logger.info(f"  Essentials: {len(ESSENTIALS)}")
    logger.info(f"  Total: {len(all_venues)}")


if __name__ == "__main__":
    main()
