#!/usr/bin/env python3
"""
Import top destinations in Nashville Metro, TN.

Focuses on Nashville's iconic hot chicken, James Beard restaurants,
meat & three diners, breweries, coffee culture, bars, and cultural attractions.
Includes select Franklin destinations.

Priority Categories:
- Hot Chicken (3): Prince's, Hattie B's, Bolton's
- James Beard / Fine Dining (5): Catbird Seat, Margot, Rolf and Daughters, Bastion, 404 Kitchen
- Meat & Three (2): Swett's, Arnold's Country Kitchen
- Breweries (4): Yazoo, Bearded Iris, Southern Grist, Jackalope
- Coffee (3): Barista Parlor, Frothy Monkey, Eighth & Roast
- Bars (3): Patterson House, Attaboy, Robert's Western World
- Attractions (3): Parthenon, Cheekwood, Nashville Zoo
- Franklin (2): Gray's on Main, Puckett's Grocery

Sources:
- James Beard Foundation award winners & nominees
- Nashville Scene Best of Nashville
- The Tennessean food & drink guides
- Visit Music City recommendations
- Local curator knowledge

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_nashville_destinations.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# HOT CHICKEN (Nashville's signature dish)
HOT_CHICKEN = [
    {
        "name": "Prince's Hot Chicken Shack",
        "slug": "princes-hot-chicken",
        "address": "123 Ewing Dr",
        "neighborhood": "East Nashville",
        "city": "Nashville",
        "state": "TN",
        "zip": "37207",
        "lat": 36.1749,
        "lng": -86.7435,
        "venue_type": "restaurant",
        "website": "https://www.princeshotchicken.com",
    },
    {
        "name": "Hattie B's Hot Chicken",
        "slug": "hattie-bs-hot-chicken-midtown",
        "address": "112 19th Ave S",
        "neighborhood": "Midtown",
        "city": "Nashville",
        "state": "TN",
        "zip": "37203",
        "lat": 36.1482,
        "lng": -86.7981,
        "venue_type": "restaurant",
        "website": "https://hattieb.com",
    },
    {
        "name": "Bolton's Spicy Chicken & Fish",
        "slug": "boltons-spicy-chicken",
        "address": "624 Main St",
        "neighborhood": "East Nashville",
        "city": "Nashville",
        "state": "TN",
        "zip": "37206",
        "lat": 36.1715,
        "lng": -86.7412,
        "venue_type": "restaurant",
        "website": None,
    },
]

# JAMES BEARD & FINE DINING
FINE_DINING = [
    {
        "name": "The Catbird Seat",
        "slug": "catbird-seat-nashville",
        "address": "1711 Division St",
        "neighborhood": "Midtown",
        "city": "Nashville",
        "state": "TN",
        "zip": "37203",
        "lat": 36.1517,
        "lng": -86.7964,
        "venue_type": "restaurant",
        "website": "https://thecatbirdseatrestaurant.com",
    },
    {
        "name": "Margot Cafe & Bar",
        "slug": "margot-cafe-nashville",
        "address": "1017 Woodland St",
        "neighborhood": "East Nashville",
        "city": "Nashville",
        "state": "TN",
        "zip": "37206",
        "lat": 36.1709,
        "lng": -86.7541,
        "venue_type": "restaurant",
        "website": "https://margotcafe.com",
    },
    {
        "name": "Rolf and Daughters",
        "slug": "rolf-and-daughters",
        "address": "700 Taylor St",
        "neighborhood": "Germantown",
        "city": "Nashville",
        "state": "TN",
        "zip": "37208",
        "lat": 36.1712,
        "lng": -86.7878,
        "venue_type": "restaurant",
        "website": "https://rolfanddaughters.com",
    },
    {
        "name": "Bastion",
        "slug": "bastion-nashville",
        "address": "434 Houston St",
        "neighborhood": "Wedgewood-Houston",
        "city": "Nashville",
        "state": "TN",
        "zip": "37203",
        "lat": 36.1398,
        "lng": -86.7654,
        "venue_type": "restaurant",
        "website": "https://bastionnashville.com",
    },
    {
        "name": "404 Kitchen",
        "slug": "404-kitchen-nashville",
        "address": "507 Lea Ave",
        "neighborhood": "The Gulch",
        "city": "Nashville",
        "state": "TN",
        "zip": "37203",
        "lat": 36.1515,
        "lng": -86.7693,
        "venue_type": "restaurant",
        "website": "https://404kitchen.com",
    },
]

# MEAT & THREE (Nashville tradition)
MEAT_AND_THREE = [
    {
        "name": "Swett's Restaurant",
        "slug": "swetts-nashville",
        "address": "2725 Clifton Ave",
        "neighborhood": "North Nashville",
        "city": "Nashville",
        "state": "TN",
        "zip": "37209",
        "lat": 36.1852,
        "lng": -86.7901,
        "venue_type": "restaurant",
        "website": None,
    },
    {
        "name": "Arnold's Country Kitchen",
        "slug": "arnolds-country-kitchen",
        "address": "605 8th Ave S",
        "neighborhood": "SoBro",
        "city": "Nashville",
        "state": "TN",
        "zip": "37203",
        "lat": 36.1529,
        "lng": -86.7784,
        "venue_type": "restaurant",
        "website": None,
    },
]

# BREWERIES
BREWERIES = [
    {
        "name": "Yazoo Brewing Company",
        "slug": "yazoo-brewing-nashville",
        "address": "910 Division St",
        "neighborhood": "The Gulch",
        "city": "Nashville",
        "state": "TN",
        "zip": "37203",
        "lat": 36.1499,
        "lng": -86.7724,
        "venue_type": "brewery",
        "website": "https://yazoobrew.com",
    },
    {
        "name": "Bearded Iris Brewing",
        "slug": "bearded-iris-brewing",
        "address": "101 Van Buren St",
        "neighborhood": "Germantown",
        "city": "Nashville",
        "state": "TN",
        "zip": "37208",
        "lat": 36.1723,
        "lng": -86.7899,
        "venue_type": "brewery",
        "website": "https://beardedirisbrewing.com",
    },
    {
        "name": "Southern Grist Brewing",
        "slug": "southern-grist-nashville",
        "address": "1201 Porter Rd",
        "neighborhood": "East Nashville",
        "city": "Nashville",
        "state": "TN",
        "zip": "37206",
        "lat": 36.1735,
        "lng": -86.7412,
        "venue_type": "brewery",
        "website": "https://southerngristbrewing.com",
    },
    {
        "name": "Jackalope Brewing Company",
        "slug": "jackalope-brewing-nashville",
        "address": "701 8th Ave S",
        "neighborhood": "The Gulch",
        "city": "Nashville",
        "state": "TN",
        "zip": "37203",
        "lat": 36.1518,
        "lng": -86.7719,
        "venue_type": "brewery",
        "website": "https://jackalopebrew.com",
    },
]

# COFFEE CULTURE
COFFEE_SHOPS = [
    {
        "name": "Barista Parlor",
        "slug": "barista-parlor-east",
        "address": "519 Gallatin Ave",
        "neighborhood": "East Nashville",
        "city": "Nashville",
        "state": "TN",
        "zip": "37206",
        "lat": 36.1698,
        "lng": -86.7512,
        "venue_type": "coffee_shop",
        "website": "https://baristaparlor.com",
    },
    {
        "name": "Frothy Monkey",
        "slug": "frothy-monkey-12-south",
        "address": "2509 12th Ave S",
        "neighborhood": "12 South",
        "city": "Nashville",
        "state": "TN",
        "zip": "37204",
        "lat": 36.1245,
        "lng": -86.7853,
        "venue_type": "coffee_shop",
        "website": "https://frothymonkey.com",
    },
    {
        "name": "Eighth & Roast",
        "slug": "eighth-and-roast",
        "address": "4104 Charlotte Ave",
        "neighborhood": "Sylvan Park",
        "city": "Nashville",
        "state": "TN",
        "zip": "37209",
        "lat": 36.1591,
        "lng": -86.8142,
        "venue_type": "coffee_shop",
        "website": "https://eighthandroast.com",
    },
]

# BARS & NIGHTLIFE
BARS = [
    {
        "name": "Patterson House",
        "slug": "patterson-house-nashville",
        "address": "1711 Division St",
        "neighborhood": "Midtown",
        "city": "Nashville",
        "state": "TN",
        "zip": "37203",
        "lat": 36.1517,
        "lng": -86.7964,
        "venue_type": "bar",
        "website": "https://thepattersonnashville.com",
    },
    {
        "name": "Attaboy",
        "slug": "attaboy-nashville",
        "address": "8 McFerrin Ave",
        "neighborhood": "East Nashville",
        "city": "Nashville",
        "state": "TN",
        "zip": "37206",
        "lat": 36.1735,
        "lng": -86.7498,
        "venue_type": "bar",
        "website": None,
    },
    {
        "name": "Robert's Western World",
        "slug": "roberts-western-world",
        "address": "416 Broadway",
        "neighborhood": "Downtown",
        "city": "Nashville",
        "state": "TN",
        "zip": "37203",
        "lat": 36.1609,
        "lng": -86.7782,
        "venue_type": "bar",
        "website": "https://robertswesternworld.com",
    },
]

# ATTRACTIONS
ATTRACTIONS = [
    {
        "name": "The Parthenon",
        "slug": "parthenon-nashville",
        "address": "2500 West End Ave",
        "neighborhood": "Centennial Park",
        "city": "Nashville",
        "state": "TN",
        "zip": "37203",
        "lat": 36.1498,
        "lng": -86.8134,
        "venue_type": "attraction",
        "website": "https://www.nashvilleparthenon.com",
    },
    {
        "name": "Cheekwood Estate & Gardens",
        "slug": "cheekwood-estate",
        "address": "1200 Forrest Park Dr",
        "neighborhood": "Belle Meade",
        "city": "Nashville",
        "state": "TN",
        "zip": "37205",
        "lat": 36.0993,
        "lng": -86.8542,
        "venue_type": "attraction",
        "website": "https://cheekwood.org",
    },
    {
        "name": "Nashville Zoo",
        "slug": "nashville-zoo",
        "address": "3777 Nolensville Pike",
        "neighborhood": "South Nashville",
        "city": "Nashville",
        "state": "TN",
        "zip": "37211",
        "lat": 36.0878,
        "lng": -86.7412,
        "venue_type": "attraction",
        "website": "https://www.nashvillezoo.org",
    },
]

# FRANKLIN DESTINATIONS (Historic suburb)
FRANKLIN = [
    {
        "name": "Gray's on Main",
        "slug": "grays-on-main-franklin",
        "address": "332 Main St",
        "neighborhood": "Downtown Franklin",
        "city": "Franklin",
        "state": "TN",
        "zip": "37064",
        "lat": 35.9251,
        "lng": -86.8689,
        "venue_type": "restaurant",
        "website": "https://graysonmain.com",
    },
    {
        "name": "Puckett's Grocery & Restaurant",
        "slug": "pucketts-franklin",
        "address": "120 4th Ave S",
        "neighborhood": "Downtown Franklin",
        "city": "Franklin",
        "state": "TN",
        "zip": "37064",
        "lat": 35.9242,
        "lng": -86.8701,
        "venue_type": "restaurant",
        "website": "https://puckettsgro.com",
    },
]


def main():
    """Import all Nashville Metro destinations to database."""
    added = 0
    skipped = 0

    all_venues = (
        HOT_CHICKEN
        + FINE_DINING
        + MEAT_AND_THREE
        + BREWERIES
        + COFFEE_SHOPS
        + BARS
        + ATTRACTIONS
        + FRANKLIN
    )

    logger.info("=" * 60)
    logger.info("Importing Nashville Metro Destinations")
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
    logger.info(f"  Hot Chicken: {len(HOT_CHICKEN)}")
    logger.info(f"  Fine Dining (James Beard): {len(FINE_DINING)}")
    logger.info(f"  Meat & Three: {len(MEAT_AND_THREE)}")
    logger.info(f"  Breweries: {len(BREWERIES)}")
    logger.info(f"  Coffee Shops: {len(COFFEE_SHOPS)}")
    logger.info(f"  Bars: {len(BARS)}")
    logger.info(f"  Attractions: {len(ATTRACTIONS)}")
    logger.info(f"  Franklin: {len(FRANKLIN)}")
    logger.info(f"  Total: {len(all_venues)}")


if __name__ == "__main__":
    main()
