#!/usr/bin/env python3
"""
Import Madison Yards destinations (restaurants, cafes, fitness, shops).
Mixed-use development at Memorial Dr & Boulevard in Reynoldstown,
right off the Beltline Eastside Trail. Run once to populate the database.
"""

import argparse
import sys
sys.path.insert(0, '.')

from db import get_or_create_venue
from destination_import_flow import add_enrichment_args, run_post_import_enrichment

MADISON_YARDS_DESTINATIONS = [
    # Restaurants
    {
        "name": "Taqueria Tsunami",
        "slug": "taqueria-tsunami-madison-yards",
        "address": "975 Memorial Dr SE Suite 100",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7471,
        "lng": -84.3567,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.taqueriatsunami.com",
        "description": "Asian-Latin fusion tacos and burritos with creative combinations and craft cocktails.",
    },
    {
        "name": "Curry Up Now",
        "slug": "curry-up-now-madison-yards",
        "address": "975 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7471,
        "lng": -84.3567,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.curryupnow.com",
        "description": "Indian street food with a modern twist — tikka masala burritos, naan wraps, and craft cocktails.",
    },
    {
        "name": "First Watch",
        "slug": "first-watch-madison-yards",
        "address": "975 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7471,
        "lng": -84.3567,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.firstwatch.com",
        "description": "Daytime brunch and breakfast spot with fresh juices, avocado toast, and seasonal specials.",
    },
    {
        "name": "Salata",
        "slug": "salata-madison-yards",
        "address": "975 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7471,
        "lng": -84.3567,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.salata.com",
        "description": "Build-your-own salad and wrap bar with fresh ingredients and house-made dressings.",
    },
    # Cafes & Sweets
    {
        "name": "Daily Dose Coffee",
        "slug": "daily-dose-coffee-madison-yards",
        "address": "975 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7471,
        "lng": -84.3567,
        "venue_type": "cafe",
        "spot_type": "coffee",
        "website": None,
        "description": "Coffee shop in the Madison Yards development serving specialty drinks and pastries.",
    },
    {
        "name": "Kilwins",
        "slug": "kilwins-madison-yards",
        "address": "975 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7471,
        "lng": -84.3567,
        "venue_type": "restaurant",
        "spot_type": "dessert",
        "website": "https://www.kilwins.com",
        "description": "Handcrafted chocolates, fudge, and ice cream made in-store with a nostalgic candy shop vibe.",
    },
    {
        "name": "Eden Smoothies",
        "slug": "eden-smoothies-madison-yards",
        "address": "975 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7471,
        "lng": -84.3567,
        "venue_type": "cafe",
        "spot_type": "coffee",
        "website": None,
        "description": "Fresh smoothies and juice bar inside the Madison Yards development.",
    },
    # Fitness & Wellness
    {
        "name": "Orangetheory Fitness Madison Yards",
        "slug": "orangetheory-madison-yards",
        "address": "975 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7471,
        "lng": -84.3567,
        "venue_type": "fitness_center",
        "spot_type": "fitness",
        "website": "https://www.orangetheory.com",
        "description": "Heart-rate-based group fitness classes mixing treadmill, rowing, and floor work.",
    },
    {
        "name": "Highland Yoga Madison Yards",
        "slug": "highland-yoga-madison-yards",
        "address": "975 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7471,
        "lng": -84.3567,
        "venue_type": "fitness_center",
        "spot_type": "fitness",
        "website": "https://www.highlandyoga.com",
        "description": "Yoga studio offering heated and unheated vinyasa, yin, and restorative classes.",
    },
    {
        "name": "solidcore Madison Yards",
        "slug": "solidcore-madison-yards",
        "address": "975 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7471,
        "lng": -84.3567,
        "venue_type": "fitness_center",
        "spot_type": "fitness",
        "website": "https://www.solidcore.co",
        "description": "High-intensity, low-impact Pilates-inspired workout on the Megaformer machine.",
    },
    {
        "name": "The Sky Barre",
        "slug": "sky-barre-madison-yards",
        "address": "975 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7471,
        "lng": -84.3567,
        "venue_type": "fitness_center",
        "spot_type": "fitness",
        "website": None,
        "description": "Barre fitness studio offering full-body sculpting classes.",
    },
    # Retail (discovery-worthy)
    {
        "name": "Girl Diver",
        "slug": "girl-diver-madison-yards",
        "address": "975 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7471,
        "lng": -84.3567,
        "venue_type": "venue",
        "spot_type": "shopping",
        "website": None,
        "description": "Boutique retail shop in the Madison Yards development.",
    },
    {
        "name": "Lucky & Lady",
        "slug": "lucky-and-lady-madison-yards",
        "address": "975 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7471,
        "lng": -84.3567,
        "venue_type": "venue",
        "spot_type": "shopping",
        "website": None,
        "description": "Fashion and lifestyle boutique in Reynoldstown's Madison Yards.",
    },
]

def main():
    parser = argparse.ArgumentParser(
        description="Import Madison Yards destinations and run enrichment"
    )
    add_enrichment_args(parser)
    args = parser.parse_args()

    print("Importing Madison Yards destinations...")

    for dest in MADISON_YARDS_DESTINATIONS:
        try:
            venue_id = get_or_create_venue(dest)
            print(f"  ✓ {dest['name']} (ID: {venue_id})")
        except Exception as e:
            print(f"  ✗ {dest['name']}: {e}")

    print(f"\nImported {len(MADISON_YARDS_DESTINATIONS)} Madison Yards destinations.")
    run_post_import_enrichment(
        slugs=[dest["slug"] for dest in MADISON_YARDS_DESTINATIONS],
        skip_enrich=args.skip_enrich,
        enrich_dry_run=args.enrich_dry_run,
    )

if __name__ == "__main__":
    main()
