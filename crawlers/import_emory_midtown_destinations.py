#!/usr/bin/env python3
"""
Import casual dining, coffee shops, and essential services near Emory University Hospital Midtown.

Focus: 550 Peachtree St NE, Midtown Atlanta area (33.7686, -84.3862)
Context: Healthcare portal - patients, families, visitors need everyday food options

Categories:
- Casual Restaurants (11): Mellow Mushroom, Doc Chey's, Willy's, Chipotle, etc.
- Coffee Shops (6): Octane, Revelator, Dancing Goats, Starbucks, etc.
- Hotels (6): Georgian Terrace, Loews, W Midtown, Four Seasons, etc.
- Essentials (3): Publix, CVS, Walgreens

Sources:
- Google Maps research around 550 Peachtree St NE
- Midtown neighborhood directories
- Healthcare visitor guides
"""

import logging
import argparse
from db import get_or_create_venue, get_venue_by_slug
from destination_import_flow import add_enrichment_args, run_post_import_enrichment

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Casual Restaurants near EUH Midtown
RESTAURANTS = [
    {
        "name": "Mellow Mushroom Midtown",
        "slug": "mellow-mushroom-midtown",
        "address": "931 Monroe Dr NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7854,
        "lng": -84.3680,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://mellowmushroom.com",
        "vibes": ["casual", "pizza", "family-friendly", "craft-beer"],
    },
    {
        "name": "Doc Chey's Noodle House",
        "slug": "doc-cheys-noodle-house",
        "address": "1424 N Highland Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7920,
        "lng": -84.3655,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://doccheys.com",
        "vibes": ["asian", "casual", "affordable", "quick-service"],
    },
    {
        "name": "Willy's Mexicana Grill Midtown",
        "slug": "willys-mexicana-grill-midtown",
        "address": "1071 Piedmont Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7838,
        "lng": -84.3757,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://willys.com",
        "vibes": ["mexican", "casual", "quick-service", "affordable"],
    },
    {
        "name": "Chipotle Midtown",
        "slug": "chipotle-midtown-10th",
        "address": "1000 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7814,
        "lng": -84.3845,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://chipotle.com",
        "vibes": ["mexican", "quick-service", "casual", "healthy-options"],
    },
    {
        "name": "Five Guys Midtown",
        "slug": "five-guys-midtown",
        "address": "1080 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7845,
        "lng": -84.3835,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://fiveguys.com",
        "vibes": ["burgers", "casual", "quick-service", "american"],
    },
    {
        "name": "Chick-fil-A Midtown",
        "slug": "chick-fil-a-midtown-peachtree",
        "address": "950 W Peachtree St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7804,
        "lng": -84.3875,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://chick-fil-a.com",
        "vibes": ["chicken", "quick-service", "casual", "southern"],
    },
    {
        "name": "Jason's Deli Midtown",
        "slug": "jasons-deli-midtown",
        "address": "1100 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7852,
        "lng": -84.3832,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://jasonsdeli.com",
        "vibes": ["deli", "sandwiches", "casual", "quick-service", "healthy-options"],
    },
    {
        "name": "Panera Bread Midtown",
        "slug": "panera-bread-midtown-colony-square",
        "address": "1197 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30361",
        "lat": 33.7887,
        "lng": -84.3818,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://panerabread.com",
        "vibes": ["bakery", "cafe", "casual", "quick-service", "healthy-options"],
    },
    {
        "name": "Shake Shack Colony Square",
        "slug": "shake-shack-colony-square",
        "address": "1197 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30361",
        "lat": 33.7887,
        "lng": -84.3818,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://shakeshack.com",
        "vibes": ["burgers", "casual", "quick-service", "trendy"],
    },
    {
        "name": "Rreal Tacos Midtown",
        "slug": "rreal-tacos-midtown",
        "address": "1133 Huff Rd NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7865,
        "lng": -84.4025,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://rrealtacos.com",
        "vibes": ["mexican", "tacos", "casual", "local"],
    },
    {
        "name": "Zoe's Kitchen Midtown",
        "slug": "zoes-kitchen-midtown",
        "address": "1080 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7845,
        "lng": -84.3835,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://zoeskitchen.com",
        "vibes": ["mediterranean", "healthy-options", "casual", "quick-service"],
    },
]

# Coffee Shops near EUH Midtown
COFFEE_SHOPS = [
    {
        "name": "Octane Coffee Midtown",
        "slug": "octane-coffee-midtown",
        "address": "1009 Marietta St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7808,
        "lng": -84.3995,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://octanecoffee.com",
        "vibes": ["coffee", "local", "wifi", "coworking"],
    },
    {
        "name": "Revelator Coffee Midtown",
        "slug": "revelator-coffee-midtown",
        "address": "1133 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7865,
        "lng": -84.3828,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://revelatorcoffee.com",
        "vibes": ["coffee", "specialty", "wifi", "minimalist"],
    },
    {
        "name": "Dancing Goats Coffee Bar Midtown",
        "slug": "dancing-goats-coffee-midtown",
        "address": "1004 Virginia Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7778,
        "lng": -84.3728,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://dancinggoats.com",
        "vibes": ["coffee", "local", "cozy", "neighborhood"],
    },
    {
        "name": "Starbucks 14th & Peachtree",
        "slug": "starbucks-14th-peachtree",
        "address": "1393 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7950,
        "lng": -84.3802,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://starbucks.com",
        "vibes": ["coffee", "chain", "wifi", "quick-service"],
    },
    {
        "name": "Starbucks Colony Square",
        "slug": "starbucks-colony-square",
        "address": "1197 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30361",
        "lat": 33.7887,
        "lng": -84.3818,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": "https://starbucks.com",
        "vibes": ["coffee", "chain", "wifi", "quick-service"],
    },
    {
        "name": "Joe's East Atlanta Coffee",
        "slug": "joes-coffee-midtown",
        "address": "660 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7686,
        "lng": -84.3862,
        "venue_type": "coffee_shop",
        "spot_type": "coffee",
        "website": None,
        "vibes": ["coffee", "local", "casual"],
    },
]

# Hotels near EUH Midtown
HOTELS = [
    {
        "name": "Georgian Terrace Hotel",
        "slug": "georgian-terrace-hotel",
        "address": "659 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7689,
        "lng": -84.3859,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://thegeorgianterrace.com",
        "vibes": ["historic", "upscale", "boutique"],
    },
    {
        "name": "Loews Atlanta Hotel",
        "slug": "loews-atlanta-hotel",
        "address": "1065 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7838,
        "lng": -84.3837,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://loewshotels.com/atlanta-hotel",
        "vibes": ["upscale", "business", "modern"],
    },
    {
        "name": "W Atlanta Midtown",
        "slug": "w-atlanta-midtown",
        "address": "188 14th St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30361",
        "lat": 33.7880,
        "lng": -84.3843,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://marriott.com/hotels/travel/atlwh-w-atlanta-midtown",
        "vibes": ["luxury", "trendy", "modern"],
    },
    {
        "name": "Marriott Suites Midtown",
        "slug": "marriott-suites-midtown",
        "address": "35 14th St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7860,
        "lng": -84.3850,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://marriott.com",
        "vibes": ["business", "suites", "family-friendly"],
    },
    {
        "name": "Four Seasons Hotel Atlanta",
        "slug": "four-seasons-hotel-atlanta",
        "address": "75 14th St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7868,
        "lng": -84.3842,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://fourseasons.com/atlanta",
        "vibes": ["luxury", "upscale", "spa"],
    },
    {
        "name": "Residence Inn Midtown",
        "slug": "residence-inn-midtown",
        "address": "1041 W Peachtree St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7834,
        "lng": -84.3875,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://marriott.com",
        "vibes": ["business", "suites", "extended-stay"],
    },
]

# Essential Services near EUH Midtown
ESSENTIALS = [
    {
        "name": "Publix Midtown",
        "slug": "publix-midtown",
        "address": "650 Ponce de Leon Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7714,
        "lng": -84.3792,
        "venue_type": "grocery",
        "spot_type": "essentials",
        "website": "https://publix.com",
        "vibes": ["grocery", "pharmacy", "deli"],
    },
    {
        "name": "CVS Midtown Peachtree",
        "slug": "cvs-midtown-peachtree",
        "address": "760 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7714,
        "lng": -84.3852,
        "venue_type": "pharmacy",
        "spot_type": "essentials",
        "website": "https://cvs.com",
        "vibes": ["pharmacy", "convenience", "24-hour"],
    },
    {
        "name": "Walgreens Midtown",
        "slug": "walgreens-midtown-peachtree",
        "address": "650 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7686,
        "lng": -84.3862,
        "venue_type": "pharmacy",
        "spot_type": "essentials",
        "website": "https://walgreens.com",
        "vibes": ["pharmacy", "convenience", "24-hour"],
    },
]


def main():
    """Import all Emory Midtown destinations to database."""
    parser = argparse.ArgumentParser(
        description="Import Emory Midtown destinations and run enrichment"
    )
    add_enrichment_args(parser)
    args = parser.parse_args()

    added = 0
    skipped = 0

    all_venues = RESTAURANTS + COFFEE_SHOPS + HOTELS + ESSENTIALS

    logger.info("=" * 60)
    logger.info("Importing Emory University Hospital Midtown Destinations")
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
