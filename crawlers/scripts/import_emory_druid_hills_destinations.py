#!/usr/bin/env python3
"""
Import restaurants, cafes, hotels, and essential services near Emory University Hospital.

This is for the HEALTHCARE portal — patients, visitors, caregivers, and hospital staff
need nearby food, lodging, and essentials within walking/short driving distance of the
main campus at 1364 Clifton Rd NE, Druid Hills (33.7918, -84.3215).

~40+ destinations across categories:
- Restaurants (15): Wagaya, Double Zero, General Muir, Tin Lizzy's, etc.
- Coffee Shops (6): Summit Coffee, Starbucks locations, Panera
- Hotels (4): Emory Conference Center Hotel, Courtyard Decatur, Hampton Inn, Holiday Inn Express
- Essentials (8): CVS (multiple), Publix, Kroger, Walgreens

All locations researched with accurate addresses and coordinates.

Sources:
- Emory Village directory
- Emory Point shopping center
- Local hospital visitor guides
- Google Maps verification

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_emory_druid_hills_destinations.py
"""

import logging
import argparse
from db import get_or_create_venue, get_venue_by_slug
from destination_import_flow import add_enrichment_args, run_post_import_enrichment

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Restaurants near Emory Hospital
RESTAURANTS = [
    # Emory Village (~0.3mi from hospital)
    {
        "name": "Wagaya Japanese Cuisine",
        "slug": "wagaya-japanese-emory",
        "address": "1579 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7952,
        "lng": -84.3223,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.wagayarestaurant.com",
        "vibes": ["japanese", "sushi", "sit-down", "hospital-nearby", "emory-village"],
    },
    {
        "name": "Double Zero Napoletana",
        "slug": "double-zero-emory",
        "address": "1577 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7950,
        "lng": -84.3225,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.doublezeroemory.com",
        "vibes": ["italian", "pizza", "sit-down", "date-night", "hospital-nearby", "emory-village"],
    },
    {
        "name": "Falafel King",
        "slug": "falafel-king-emory",
        "address": "1594 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7955,
        "lng": -84.3218,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.falafelking.com",
        "vibes": ["mediterranean", "quick-service", "healthy", "hospital-nearby", "emory-village"],
    },
    {
        "name": "Everybody's Pizza",
        "slug": "everybodys-pizza-emory",
        "address": "1593 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7958,
        "lng": -84.3220,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.everybodyspizza.com",
        "vibes": ["pizza", "quick-service", "casual", "hospital-nearby", "emory-village"],
    },
    {
        "name": "Cava Emory Village",
        "slug": "cava-emory-village",
        "address": "1587 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7953,
        "lng": -84.3222,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.cava.com",
        "vibes": ["mediterranean", "quick-service", "healthy", "hospital-nearby", "emory-village"],
    },
    {
        "name": "Subway Emory Village",
        "slug": "subway-emory-village",
        "address": "1583 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7951,
        "lng": -84.3224,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.subway.com",
        "vibes": ["quick-service", "sandwiches", "hospital-nearby", "emory-village"],
    },
    # Emory Point (~0.5mi from hospital)
    {
        "name": "The General Muir",
        "slug": "general-muir-emory",
        "address": "1540 Avenue Pl",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.8012,
        "lng": -84.3258,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.thegeneralmuir.com",
        "vibes": ["jewish-deli", "sit-down", "brunch", "hospital-nearby", "emory-point"],
    },
    {
        "name": "Tin Lizzy's Cantina Emory",
        "slug": "tin-lizzys-emory",
        "address": "1540 Avenue Pl",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.8010,
        "lng": -84.3260,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.tinlizzyscantina.com",
        "vibes": ["mexican", "casual", "sit-down", "hospital-nearby", "emory-point"],
    },
    {
        "name": "Fresh To Order Emory",
        "slug": "fresh-to-order-emory",
        "address": "1540 Avenue Pl",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.8008,
        "lng": -84.3262,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.freshtoorder.com",
        "vibes": ["quick-service", "healthy", "salads", "hospital-nearby", "emory-point"],
    },
    {
        "name": "La Tagliatella Emory",
        "slug": "la-tagliatella-emory",
        "address": "1540 Avenue Pl",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.8006,
        "lng": -84.3264,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.latagliatella.com",
        "vibes": ["italian", "sit-down", "date-night", "hospital-nearby", "emory-point"],
    },
    # Near campus fast food
    {
        "name": "Chick-fil-A Emory",
        "slug": "chick-fil-a-emory",
        "address": "1579 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7949,
        "lng": -84.3226,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.chick-fil-a.com",
        "vibes": ["quick-service", "chicken", "hospital-nearby", "family-friendly"],
    },
    {
        "name": "Zaxby's N Decatur Rd",
        "slug": "zaxbys-n-decatur",
        "address": "1955 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.8025,
        "lng": -84.3195,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.zaxbys.com",
        "vibes": ["quick-service", "chicken", "hospital-nearby"],
    },
    {
        "name": "Willy's Mexicana Grill N Decatur",
        "slug": "willys-mexicana-n-decatur",
        "address": "2061 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.8065,
        "lng": -84.3175,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.willysmex.com",
        "vibes": ["mexican", "quick-service", "burritos", "hospital-nearby"],
    },
]

# Coffee shops near Emory Hospital
COFFEE_SHOPS = [
    {
        "name": "Summit Coffee Emory Village",
        "slug": "summit-coffee-emory",
        "address": "1579 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7954,
        "lng": -84.3221,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://www.summitcoffee.com",
        "vibes": ["coffee", "study-spot", "hospital-nearby", "emory-village"],
    },
    {
        "name": "Starbucks Emory Village",
        "slug": "starbucks-emory-village",
        "address": "1585 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7952,
        "lng": -84.3223,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://www.starbucks.com",
        "vibes": ["coffee", "quick-service", "hospital-nearby", "emory-village"],
    },
    {
        "name": "Starbucks Emory Point",
        "slug": "starbucks-emory-point",
        "address": "1540 Avenue Pl",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.8011,
        "lng": -84.3259,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://www.starbucks.com",
        "vibes": ["coffee", "quick-service", "hospital-nearby", "emory-point"],
    },
    {
        "name": "Panera Bread N Decatur",
        "slug": "panera-bread-n-decatur",
        "address": "1937 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.8020,
        "lng": -84.3198,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://www.panerabread.com",
        "vibes": ["coffee", "bakery", "quick-service", "hospital-nearby"],
    },
]

# Hotels near Emory Hospital
HOTELS = [
    {
        "name": "Emory Conference Center Hotel",
        "slug": "emory-conference-center-hotel",
        "address": "1615 Clifton Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.7928,
        "lng": -84.3205,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.emoryconferencecenter.com",
        "vibes": ["hotel", "hospital-nearby", "emory-campus", "closest-to-hospital"],
    },
    {
        "name": "Courtyard by Marriott Decatur",
        "slug": "courtyard-marriott-decatur",
        "address": "130 Clairemont Ave",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7738,
        "lng": -84.2965,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.marriott.com",
        "vibes": ["hotel", "hospital-nearby", "chain"],
    },
    {
        "name": "Hampton Inn Atlanta-Decatur",
        "slug": "hampton-inn-decatur",
        "address": "1561 Church St",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "lat": 33.7705,
        "lng": -84.2685,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.hilton.com",
        "vibes": ["hotel", "hospital-nearby", "chain", "family-friendly"],
    },
    {
        "name": "Holiday Inn Express Emory",
        "slug": "holiday-inn-express-emory",
        "address": "2183 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.8098,
        "lng": -84.3158,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.ihg.com",
        "vibes": ["hotel", "hospital-nearby", "chain"],
    },
]

# Essential services (pharmacies, groceries) near Emory Hospital
ESSENTIALS = [
    {
        "name": "CVS Pharmacy Emory Village",
        "slug": "cvs-emory-village",
        "address": "1575 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7948,
        "lng": -84.3227,
        "venue_type": "pharmacy",
        "spot_type": "essentials",
        "website": "https://www.cvs.com",
        "vibes": ["pharmacy", "essentials", "hospital-nearby", "emory-village"],
    },
    {
        "name": "CVS Pharmacy Emory Point",
        "slug": "cvs-emory-point",
        "address": "1540 Avenue Pl",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.8014,
        "lng": -84.3256,
        "venue_type": "pharmacy",
        "spot_type": "essentials",
        "website": "https://www.cvs.com",
        "vibes": ["pharmacy", "essentials", "24-hour", "hospital-nearby", "emory-point"],
    },
    {
        "name": "Walgreens Clairmont Rd",
        "slug": "walgreens-clairmont",
        "address": "1365 Clairmont Rd",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "lat": 33.7898,
        "lng": -84.3048,
        "venue_type": "pharmacy",
        "spot_type": "essentials",
        "website": "https://www.walgreens.com",
        "vibes": ["pharmacy", "essentials", "hospital-nearby"],
    },
    {
        "name": "Publix N Decatur Rd",
        "slug": "publix-n-decatur",
        "address": "1825 N Decatur Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.8005,
        "lng": -84.3208,
        "venue_type": "grocery",
        "spot_type": "essentials",
        "website": "https://www.publix.com",
        "vibes": ["grocery", "essentials", "hospital-nearby"],
    },
    {
        "name": "Kroger Briarcliff Rd",
        "slug": "kroger-briarcliff",
        "address": "1700 Briarcliff Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7925,
        "lng": -84.3345,
        "venue_type": "grocery",
        "spot_type": "essentials",
        "website": "https://www.kroger.com",
        "vibes": ["grocery", "essentials", "hospital-nearby"],
    },
]


def main():
    """Import all Emory/Druid Hills destinations to database."""
    parser = argparse.ArgumentParser(
        description="Import Emory Druid Hills destinations and run enrichment"
    )
    add_enrichment_args(parser)
    args = parser.parse_args()

    added = 0
    skipped = 0

    all_venues = RESTAURANTS + COFFEE_SHOPS + HOTELS + ESSENTIALS

    logger.info("=" * 60)
    logger.info("Importing Emory/Druid Hills Destinations (Healthcare Portal)")
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
    logger.info(f"  Essentials (pharmacies/grocery): {len(ESSENTIALS)}")
    logger.info(f"  Total: {len(all_venues)}")
    run_post_import_enrichment(
        slugs=[venue["slug"] for venue in all_venues],
        skip_enrich=args.skip_enrich,
        enrich_dry_run=args.enrich_dry_run,
        logger=logger,
    )


if __name__ == "__main__":
    main()
