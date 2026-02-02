#!/usr/bin/env python3
"""
Add essential Atlanta spots that locals expect to find.
Iconic restaurants, rooftops, date spots, hidden gems.
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Iconic Atlanta spots
ICONIC_SPOTS = [
    {
        "name": "Mary Mac's Tea Room",
        "slug": "mary-macs-tea-room",
        "address": "224 Ponce De Leon Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7718,
        "lng": -84.3758,
        "venue_type": "restaurant",
        "website": "https://marymacs.com",
    },
    {
        "name": "Colonnade Restaurant",
        "slug": "colonnade-restaurant",
        "address": "1879 Cheshire Bridge Rd NE",
        "neighborhood": "Cheshire Bridge",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30324",
        "lat": 33.8108,
        "lng": -84.3548,
        "venue_type": "restaurant",
        "website": "https://colonnadeatlanta.com",
    },
    {
        "name": "Ponce City Market",
        "slug": "ponce-city-market",
        "address": "675 Ponce De Leon Ave NE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7725,
        "lng": -84.3555,
        "venue_type": "event_space",
        "website": "https://poncecitymarket.com",
    },
    {
        "name": "Krog Street Market",
        "slug": "krog-street-market",
        "address": "99 Krog St NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7581,
        "lng": -84.3636,
        "venue_type": "event_space",
        "website": "https://krogstreetmarket.com",
    },
    {
        "name": "Sweet Auburn Curb Market",
        "slug": "sweet-auburn-curb-market",
        "address": "209 Edgewood Ave SE",
        "neighborhood": "Sweet Auburn",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7538,
        "lng": -84.3808,
        "venue_type": "event_space",
        "website": "https://thecurbmarket.com",
    },
    {
        "name": "Buford Highway Farmers Market",
        "slug": "buford-highway-farmers-market",
        "address": "5600 Buford Hwy NE",
        "neighborhood": "Doraville",
        "city": "Doraville",
        "state": "GA",
        "zip": "30340",
        "lat": 33.9038,
        "lng": -84.2818,
        "venue_type": "retail",
        "website": "https://aofwc.com",
    },
]

# Rooftop bars
ROOFTOPS = [
    {
        "name": "9 Mile Station",
        "slug": "9-mile-station",
        "address": "675 Ponce De Leon Ave NE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7725,
        "lng": -84.3555,
        "venue_type": "bar",
        "website": "https://9milestation.com",
    },
    {
        "name": "Whiskey Blue",
        "slug": "whiskey-blue",
        "address": "3377 Peachtree Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30326",
        "lat": 33.8488,
        "lng": -84.3628,
        "venue_type": "bar",
        "website": "https://gerbergroup.com/venue/whiskey-blue-atlanta",
    },
    {
        "name": "O-Ku Atlanta",
        "slug": "o-ku-atlanta",
        "address": "1085 Howell Mill Rd NW",
        "neighborhood": "Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7855,
        "lng": -84.4078,
        "venue_type": "restaurant",
        "website": "https://o-kusushi.com",
    },
    {
        "name": "SkyLounge",
        "slug": "skylounge-atl",
        "address": "120 Ralph McGill Blvd NE",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7628,
        "lng": -84.3818,
        "venue_type": "bar",
        "website": None,
    },
]

# Asian cuisine (Buford Highway gems)
BUFORD_HWY = [
    {
        "name": "Pho Dai Loi 2",
        "slug": "pho-dai-loi-2",
        "address": "4186 Buford Hwy NE",
        "neighborhood": "Buford Highway",
        "city": "Chamblee",
        "state": "GA",
        "zip": "30341",
        "lat": 33.8858,
        "lng": -84.2948,
        "venue_type": "restaurant",
        "website": None,
    },
    {
        "name": "Masterpiece",
        "slug": "masterpiece-buford",
        "address": "3940 Buford Hwy NE",
        "neighborhood": "Buford Highway",
        "city": "Chamblee",
        "state": "GA",
        "zip": "30341",
        "lat": 33.8808,
        "lng": -84.2968,
        "venue_type": "restaurant",
        "website": None,
    },
    {
        "name": "Crawfish Shack",
        "slug": "crawfish-shack-buford",
        "address": "4337 Buford Hwy NE",
        "neighborhood": "Buford Highway",
        "city": "Chamblee",
        "state": "GA",
        "zip": "30341",
        "lat": 33.8878,
        "lng": -84.2928,
        "venue_type": "restaurant",
        "website": "https://crawfishshackseafood.com",
    },
    {
        "name": "Northern China Eatery",
        "slug": "northern-china-eatery",
        "address": "5141 Buford Hwy NE",
        "neighborhood": "Doraville",
        "city": "Doraville",
        "state": "GA",
        "zip": "30340",
        "lat": 33.8968,
        "lng": -84.2878,
        "venue_type": "restaurant",
        "website": None,
    },
    {
        "name": "Cafe 101",
        "slug": "cafe-101-buford",
        "address": "4300 Buford Hwy NE Suite 105",
        "neighborhood": "Buford Highway",
        "city": "Chamblee",
        "state": "GA",
        "zip": "30341",
        "lat": 33.8868,
        "lng": -84.2938,
        "venue_type": "restaurant",
        "website": None,
    },
    {
        "name": "Lee's Bakery",
        "slug": "lees-bakery",
        "address": "4005 Buford Hwy NE",
        "neighborhood": "Buford Highway",
        "city": "Chamblee",
        "state": "GA",
        "zip": "30345",
        "lat": 33.8818,
        "lng": -84.2958,
        "venue_type": "restaurant",
        "website": None,
    },
    {
        "name": "Great Wall Supermarket",
        "slug": "great-wall-supermarket",
        "address": "5039 Buford Hwy NE",
        "neighborhood": "Doraville",
        "city": "Doraville",
        "state": "GA",
        "zip": "30340",
        "lat": 33.8948,
        "lng": -84.2888,
        "venue_type": "retail",
        "website": None,
    },
    {
        "name": "Quoc Huong Banh Mi",
        "slug": "quoc-huong-banh-mi",
        "address": "5150 Buford Hwy NE",
        "neighborhood": "Doraville",
        "city": "Doraville",
        "state": "GA",
        "zip": "30340",
        "lat": 33.8968,
        "lng": -84.2898,
        "venue_type": "restaurant",
        "website": None,
    },
    {
        "name": "Com Dunwoody",
        "slug": "com-dunwoody",
        "address": "5159 Buford Hwy NE",
        "neighborhood": "Doraville",
        "city": "Doraville",
        "state": "GA",
        "zip": "30340",
        "lat": 33.8968,
        "lng": -84.2895,
        "venue_type": "restaurant",
        "website": None,
    },
]

# Date night spots
DATE_SPOTS = [
    {
        "name": "Barcelona Wine Bar - Westside",
        "slug": "barcelona-westside",
        "address": "1000 Marietta St NW Suite 300",
        "neighborhood": "Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7798,
        "lng": -84.4108,
        "venue_type": "restaurant",
        "website": "https://barcelonawinebar.com",
    },
    {
        "name": "Sotto Sotto",
        "slug": "sotto-sotto",
        "address": "313 N Highland Ave NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7608,
        "lng": -84.3548,
        "venue_type": "restaurant",
        "website": "https://sottosottoatl.com",
    },
    {
        "name": "Umi",
        "slug": "umi-buckhead",
        "address": "3050 Peachtree Rd NW",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "lat": 33.8398,
        "lng": -84.3778,
        "venue_type": "restaurant",
        "website": "https://umiatlanta.com",
    },
    {
        "name": "Ecco Midtown",
        "slug": "ecco-midtown",
        "address": "40 7th St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7748,
        "lng": -84.3848,
        "venue_type": "restaurant",
        "website": "https://ecco-atlanta.com",
    },
    {
        "name": "Nakato Japanese Restaurant",
        "slug": "nakato-japanese",
        "address": "1776 Cheshire Bridge Rd NE",
        "neighborhood": "Cheshire Bridge",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30324",
        "lat": 33.8088,
        "lng": -84.3558,
        "venue_type": "restaurant",
        "website": "https://nakatojapaneserestaurant.com",
    },
    {
        "name": "No Mas! Cantina",
        "slug": "no-mas-cantina",
        "address": "180 Walker St SW",
        "neighborhood": "Castleberry Hill",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "lat": 33.7508,
        "lng": -84.4048,
        "venue_type": "restaurant",
        "website": "https://nomascantina.com",
    },
]

# Popular pizza spots
PIZZA = [
    {
        "name": "Ammazza",
        "slug": "ammazza-edgewood",
        "address": "591 Edgewood Ave SE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7558,
        "lng": -84.3658,
        "venue_type": "restaurant",
        "website": "https://ammazza.com",
    },
    {
        "name": "O4W Pizza",
        "slug": "o4w-pizza",
        "address": "652 North Ave NE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7698,
        "lng": -84.3638,
        "venue_type": "restaurant",
        "website": "https://o4wpizza.com",
    },
    {
        "name": "Varasano's Pizzeria",
        "slug": "varasanos",
        "address": "2171 Peachtree Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.8128,
        "lng": -84.3618,
        "venue_type": "restaurant",
        "website": "https://varasanos.com",
    },
]


def main():
    """Add essential Atlanta spots."""
    added = 0
    skipped = 0

    all_venues = ICONIC_SPOTS + ROOFTOPS + BUFORD_HWY + DATE_SPOTS + PIZZA

    logger.info("=" * 60)
    logger.info("Adding Essential Atlanta Spots")
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


if __name__ == "__main__":
    main()
