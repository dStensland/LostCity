#!/usr/bin/env python3
"""
Import destinations near Emory Saint Joseph's Hospital (Sandy Springs/Perimeter area).

For healthcare portal — patients, visitors, caregivers, hospital staff need:
- Nearby food (restaurants, coffee shops)
- Lodging (hotels)
- Essential services (grocery, pharmacy)

Coverage: Sandy Springs, Dunwoody, Perimeter area
Hospital location: 5665 Peachtree Dunwoody Rd, Sandy Springs (33.9082, -84.3525)

Categories:
- Restaurants (15+): Goldberg's, Alon's, Farm Burger, Taqueria del Sol, etc.
- Coffee Shops (5+): Starbucks, Land of a Thousand Hills, etc.
- Hotels (6+): Crowne Plaza, Le Meridien, Hampton Inn, etc.
- Essentials (4+): Publix, Kroger, CVS, Walgreens

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_emory_sandy_springs_destinations.py
"""

import logging
import argparse
from db import get_or_create_venue, get_venue_by_slug
from destination_import_flow import add_enrichment_args, run_post_import_enrichment

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Restaurants near Emory Saint Joseph's Hospital
RESTAURANTS = [
    {
        "name": "Goldberg's Fine Foods",
        "slug": "goldbergs-fine-foods-perimeter",
        "address": "4383 Roswell Rd",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30342",
        "lat": 33.9123,
        "lng": -84.3698,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.goldbergsbagels.com",
        "vibes": ["deli", "bagels", "casual", "family-friendly", "comfort-food"],
    },
    {
        "name": "Alon's Bakery & Market",
        "slug": "alons-bakery-dunwoody",
        "address": "1394 N Highland Ave NE",
        "neighborhood": "Dunwody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30319",
        "lat": 33.9058,
        "lng": -84.3425,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.alons.com",
        "vibes": ["bakery", "french", "upscale-casual", "brunch", "cafe"],
    },
    {
        "name": "Farm Burger Dunwoody",
        "slug": "farm-burger-dunwoody",
        "address": "1248 Dunwoody Village Pkwy",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "lat": 33.9365,
        "lng": -84.3345,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://farmburger.net",
        "vibes": ["burgers", "local", "farm-to-table", "casual", "family-friendly"],
    },
    {
        "name": "Taqueria del Sol - Sandy Springs",
        "slug": "taqueria-del-sol-sandy-springs",
        "address": "5811 Roswell Rd",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9175,
        "lng": -84.3785,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.taqueriadelsol.com",
        "vibes": ["mexican", "tacos", "casual", "affordable", "local"],
    },
    {
        "name": "Marlow's Tavern - Perimeter",
        "slug": "marlows-tavern-perimeter",
        "address": "4880 Ashford Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "lat": 33.9258,
        "lng": -84.3425,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.marlowstavern.com",
        "vibes": ["american", "casual-dining", "date-night", "local", "craft-cocktails"],
    },
    {
        "name": "Ted's Montana Grill - Perimeter",
        "slug": "teds-montana-grill-perimeter",
        "address": "1165 Perimeter Center W",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "lat": 33.9285,
        "lng": -84.3475,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.tedsmontanagrill.com",
        "vibes": ["american", "steakhouse", "bison", "casual-dining", "family-friendly"],
    },
    {
        "name": "True Food Kitchen - Perimeter",
        "slug": "true-food-kitchen-perimeter",
        "address": "4540 Ashford Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30346",
        "lat": 33.9238,
        "lng": -84.3385,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.truefoodkitchen.com",
        "vibes": ["healthy", "farm-to-table", "vegetarian-friendly", "upscale-casual", "trendy"],
    },
    {
        "name": "Seasons 52 - Perimeter",
        "slug": "seasons-52-perimeter",
        "address": "4600 Ashford Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30346",
        "lat": 33.9248,
        "lng": -84.3398,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.seasons52.com",
        "vibes": ["american", "upscale-casual", "seasonal", "healthy", "date-night"],
    },
    {
        "name": "Le Madeleine - Perimeter",
        "slug": "le-madeleine-perimeter",
        "address": "4600 Ashford Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30346",
        "lat": 33.9248,
        "lng": -84.3395,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.lemadeleine.com",
        "vibes": ["french", "cafe", "bakery", "casual", "family-friendly"],
    },
    {
        "name": "Corner Bakery Cafe - Perimeter",
        "slug": "corner-bakery-cafe-perimeter",
        "address": "4600 Ashford Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30346",
        "lat": 33.9248,
        "lng": -84.3392,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.cornerbakerycafe.com",
        "vibes": ["cafe", "bakery", "casual", "breakfast", "family-friendly"],
    },
    {
        "name": "Chick-fil-A - Perimeter Pointe",
        "slug": "chick-fil-a-perimeter-pointe",
        "address": "1155 Mt Vernon Hwy",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "lat": 33.9285,
        "lng": -84.3505,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.chick-fil-a.com",
        "vibes": ["fast-food", "chicken", "family-friendly", "quick-bite"],
    },
    {
        "name": "Chick-fil-A - Roswell Road",
        "slug": "chick-fil-a-roswell-road-sandy-springs",
        "address": "5975 Roswell Rd",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9195,
        "lng": -84.3815,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.chick-fil-a.com",
        "vibes": ["fast-food", "chicken", "family-friendly", "quick-bite"],
    },
    {
        "name": "Panera Bread - Perimeter",
        "slug": "panera-bread-perimeter",
        "address": "1155 Perimeter Center W",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "lat": 33.9282,
        "lng": -84.3475,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.panerabread.com",
        "vibes": ["cafe", "bakery", "casual", "healthy", "quick-bite"],
    },
    {
        "name": "The Cheesecake Factory - Perimeter",
        "slug": "cheesecake-factory-perimeter",
        "address": "4400 Ashford Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30346",
        "lat": 33.9218,
        "lng": -84.3365,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.thecheesecakefactory.com",
        "vibes": ["american", "casual-dining", "desserts", "large-portions", "family-friendly"],
    },
    {
        "name": "J. Alexander's - Perimeter",
        "slug": "j-alexanders-perimeter",
        "address": "5975 Roswell Rd",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9195,
        "lng": -84.3815,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.jalexanders.com",
        "vibes": ["american", "upscale-casual", "steakhouse", "date-night"],
    },
]

# Coffee Shops near Emory Saint Joseph's Hospital
COFFEE_SHOPS = [
    {
        "name": "Starbucks - Perimeter Center",
        "slug": "starbucks-perimeter-center",
        "address": "4600 Ashford Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30346",
        "lat": 33.9248,
        "lng": -84.3395,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://www.starbucks.com",
        "vibes": ["coffee", "cafe", "wifi", "casual"],
    },
    {
        "name": "Starbucks - Hammond Drive",
        "slug": "starbucks-hammond-drive",
        "address": "4279 Roswell Rd",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30342",
        "lat": 33.9105,
        "lng": -84.3675,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://www.starbucks.com",
        "vibes": ["coffee", "cafe", "wifi", "casual"],
    },
    {
        "name": "Starbucks - Dunwoody Village",
        "slug": "starbucks-dunwoody-village",
        "address": "1250 Dunwoody Village Pkwy",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "lat": 33.9365,
        "lng": -84.3348,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://www.starbucks.com",
        "vibes": ["coffee", "cafe", "wifi", "casual"],
    },
    {
        "name": "Land of a Thousand Hills Coffee - Dunwoody",
        "slug": "land-of-a-thousand-hills-dunwoody",
        "address": "5505 Chamblee Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "lat": 33.9198,
        "lng": -84.3265,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://www.landofathousandhills.com",
        "vibes": ["coffee", "specialty-coffee", "local", "ethical", "wifi"],
    },
    {
        "name": "Reveille Coffee - Sandy Springs",
        "slug": "reveille-coffee-sandy-springs",
        "address": "6025 Sandy Springs Cir",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9215,
        "lng": -84.3835,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://www.reveillecoffee.com",
        "vibes": ["coffee", "specialty-coffee", "local", "wifi", "casual"],
    },
]

# Hotels near Emory Saint Joseph's Hospital
HOTELS = [
    {
        "name": "Crowne Plaza Atlanta Perimeter at Ravinia",
        "slug": "crowne-plaza-atlanta-perimeter-ravinia",
        "address": "4355 Ashford Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30346",
        "lat": 33.9208,
        "lng": -84.3355,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.ihg.com/crowneplaza",
        "vibes": ["hotel", "business", "full-service"],
    },
    {
        "name": "Le Meridien Atlanta Perimeter",
        "slug": "le-meridien-atlanta-perimeter",
        "address": "111 Perimeter Center W",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30346",
        "lat": 33.9265,
        "lng": -84.3445,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.marriott.com/lematl",
        "vibes": ["hotel", "upscale", "full-service", "business"],
    },
    {
        "name": "Hampton Inn Atlanta Perimeter Center",
        "slug": "hampton-inn-atlanta-perimeter",
        "address": "1155 Hammond Dr NE",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9285,
        "lng": -84.3595,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.hilton.com/hampton",
        "vibes": ["hotel", "mid-range", "business", "family-friendly"],
    },
    {
        "name": "Hilton Atlanta Perimeter Suites",
        "slug": "hilton-atlanta-perimeter-suites",
        "address": "6120 Peachtree Dunwoody Rd",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9125,
        "lng": -84.3515,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.hilton.com",
        "vibes": ["hotel", "suites", "business", "full-service"],
    },
    {
        "name": "Courtyard by Marriott Perimeter Center",
        "slug": "courtyard-marriott-perimeter-center",
        "address": "6250 Peachtree Dunwoody Rd",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9155,
        "lng": -84.3535,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.marriott.com/courtyard",
        "vibes": ["hotel", "mid-range", "business", "family-friendly"],
    },
    {
        "name": "Holiday Inn Express Dunwoody",
        "slug": "holiday-inn-express-dunwoody",
        "address": "4575 Ashford Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30346",
        "lat": 33.9245,
        "lng": -84.3405,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.ihg.com/holidayinnexpress",
        "vibes": ["hotel", "budget-friendly", "business", "family-friendly"],
    },
]

# Essential Services near Emory Saint Joseph's Hospital
ESSENTIALS = [
    {
        "name": "Publix - Hammond Drive",
        "slug": "publix-hammond-drive",
        "address": "1245 Hammond Dr NE",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9315,
        "lng": -84.3615,
        "venue_type": "grocery",
        "spot_type": "essentials",
        "website": "https://www.publix.com",
        "vibes": ["grocery", "pharmacy", "essentials"],
    },
    {
        "name": "Kroger - Dunwoody",
        "slug": "kroger-dunwoody",
        "address": "1230 Dunwoody Village Pkwy",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "lat": 33.9365,
        "lng": -84.3335,
        "venue_type": "grocery",
        "spot_type": "essentials",
        "website": "https://www.kroger.com",
        "vibes": ["grocery", "pharmacy", "essentials"],
    },
    {
        "name": "CVS Pharmacy - Perimeter Center",
        "slug": "cvs-perimeter-center",
        "address": "4615 Ashford Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30346",
        "lat": 33.9252,
        "lng": -84.3415,
        "venue_type": "pharmacy",
        "spot_type": "essentials",
        "website": "https://www.cvs.com",
        "vibes": ["pharmacy", "essentials", "convenience"],
    },
    {
        "name": "Walgreens - Roswell Road",
        "slug": "walgreens-roswell-road-sandy-springs",
        "address": "5975 Roswell Rd",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9195,
        "lng": -84.3815,
        "venue_type": "pharmacy",
        "spot_type": "essentials",
        "website": "https://www.walgreens.com",
        "vibes": ["pharmacy", "essentials", "convenience"],
    },
]


def main():
    """Import all Emory Saint Joseph's Hospital area destinations to database."""
    parser = argparse.ArgumentParser(
        description="Import Emory Sandy Springs destinations and run enrichment"
    )
    add_enrichment_args(parser)
    args = parser.parse_args()

    added = 0
    skipped = 0

    all_venues = RESTAURANTS + COFFEE_SHOPS + HOTELS + ESSENTIALS

    logger.info("=" * 60)
    logger.info("Importing Emory Saint Joseph's Hospital Area Destinations")
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
    logger.info(f"  Coffee Shops: {len(COFFEE_SHOPS)}")
    logger.info(f"  Hotels: {len(HOTELS)}")
    logger.info(f"  Essentials: {len(ESSENTIALS)}")
    logger.info(f"  Total: {len(all_venues)}")
    run_post_import_enrichment(
        slugs=[venue["slug"] for venue in all_venues],
        skip_enrich=args.skip_enrich,
        enrich_dry_run=args.enrich_dry_run,
        logger=logger,
    )


if __name__ == "__main__":
    main()
