#!/usr/bin/env python3
"""
Import curated destinations for Alpharetta and Roswell, GA.
Sources: Eater Atlanta, Atlanta Magazine, The Infatuation
"""

import argparse

from db import get_client
from destination_import_flow import add_enrichment_args, run_post_import_enrichment

DESTINATIONS = [
    # === ALPHARETTA - AVALON ===
    {
        "name": "Oak Steakhouse",
        "slug": "oak-steakhouse-avalon",
        "address": "5970 Avalon Blvd",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30009",
        "lat": 34.0704,
        "lng": -84.2750,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.oaksteakhouserestaurant.com",
        "description": "Acclaimed steakhouse at Avalon with impeccable service and refined atmosphere.",
    },
    {
        "name": "South City Kitchen Avalon",
        "slug": "south-city-kitchen-avalon",
        "address": "5950 Avalon Blvd",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30009",
        "lat": 34.0702,
        "lng": -84.2748,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.southcitykitchen.com",
        "description": "Chef-driven contemporary Southern cuisine with seasonally-inspired menus.",
    },
    {
        "name": "Antico Pizza Avalon",
        "slug": "antico-pizza-avalon",
        "address": "5960 Avalon Blvd",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30009",
        "lat": 34.0703,
        "lng": -84.2749,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.anticopizza.it",
        "description": "High-quality Neapolitan pizza from Atlanta's beloved pizzeria.",
    },
    {
        "name": "CRÚ Food & Wine Bar",
        "slug": "cru-food-wine-avalon",
        "address": "5975 Avalon Blvd",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30009",
        "lat": 34.0705,
        "lng": -84.2751,
        "venue_type": "wine_bar",
        "spot_type": "bar",
        "website": "https://cruawinebar.com",
        "description": "Upscale wine bar with shareable plates and curated cheese flights.",
    },
    {
        "name": "Café Intermezzo Avalon",
        "slug": "cafe-intermezzo-avalon",
        "address": "5980 Avalon Blvd",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30009",
        "lat": 34.0706,
        "lng": -84.2752,
        "venue_type": "cafe",
        "spot_type": "coffee_shop",
        "website": "https://www.cafeintermezzo.com",
        "description": "European coffeehouse with delicious pastries and extensive beverage menu.",
    },
    # === ALPHARETTA - DOWNTOWN ===
    {
        "name": "Foundation Social Eatery",
        "slug": "foundation-social-eatery",
        "address": "55 Roswell St Suite 100",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30009",
        "lat": 34.0754,
        "lng": -84.2943,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://foundationsocialeatery.com",
        "description": "Chef-driven contemporary American with crispy fried octopus and craft cocktails.",
    },
    {
        "name": "Valor Coffee",
        "slug": "valor-coffee-alpharetta",
        "address": "44 Milton Avenue",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30009",
        "lat": 34.0748,
        "lng": -84.2940,
        "venue_type": "cafe",
        "spot_type": "coffee_shop",
        "website": "https://valorcoffee.com",
        "description": "Local coffee roaster with craft-focused espresso in downtown Alpharetta.",
    },
    {
        "name": "Currahee Brewing Company",
        "slug": "currahee-brewing",
        "address": "25 South Main Street",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30009",
        "lat": 34.0740,
        "lng": -84.2945,
        "venue_type": "brewery",
        "spot_type": "brewery",
        "website": "https://curraheebrewing.com",
        "description": "Dog-friendly downtown brewery with craft selections.",
    },
    {
        "name": "Roaring Social",
        "slug": "roaring-social",
        "address": "50 South Main Street",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30009",
        "lat": 34.0738,
        "lng": -84.2946,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://roaringsocial.com",
        "description": "1920s-themed speakeasy with live entertainment and craft cocktails.",
    },
    # === ROSWELL - CANTON STREET ===
    {
        "name": "Table & Main",
        "slug": "table-and-main",
        "address": "1028 Canton Street",
        "neighborhood": "Roswell",
        "city": "Roswell",
        "state": "GA",
        "zip": "30075",
        "lat": 34.0230,
        "lng": -84.3617,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://tableandmain.com",
        "description": "Atlanta Magazine Top 50 restaurant - simple, seasonal, Southern cuisine by Chef Woody Back.",
    },
    {
        "name": "Osteria Mattone",
        "slug": "osteria-mattone",
        "address": "1095 Canton Street",
        "neighborhood": "Roswell",
        "city": "Roswell",
        "state": "GA",
        "zip": "30075",
        "lat": 34.0235,
        "lng": -84.3620,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://osteriamattone.com",
        "description": "Regional Italian trattoria with fresh pasta and award-winning wine list.",
    },
    {
        "name": "1920 Tavern",
        "slug": "1920-tavern",
        "address": "948 Canton Street",
        "neighborhood": "Roswell",
        "city": "Roswell",
        "state": "GA",
        "zip": "30075",
        "lat": 34.0225,
        "lng": -84.3615,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://1920tavern.com",
        "description": "Historic speakeasy-style restaurant with live music Thursdays and Sundays.",
    },
    {
        "name": "Gate City Brewing Company",
        "slug": "gate-city-brewing",
        "address": "43 Magnolia Street",
        "neighborhood": "Roswell",
        "city": "Roswell",
        "state": "GA",
        "zip": "30075",
        "lat": 34.0228,
        "lng": -84.3612,
        "venue_type": "brewery",
        "spot_type": "brewery",
        "website": "https://gatecitybrewingcompany.com",
        "description": "30BBL brewhouse with 20 house-brewed beers and Artillery Room cocktail bar.",
    },
    {
        "name": "Variant Brewing",
        "slug": "variant-brewing-roswell",
        "address": "280 S Atlanta Street",
        "neighborhood": "Roswell",
        "city": "Roswell",
        "state": "GA",
        "zip": "30075",
        "lat": 34.0180,
        "lng": -84.3580,
        "venue_type": "brewery",
        "spot_type": "brewery",
        "website": "https://variantbrewing.com",
        "description": "Experimental craft brewery pushing limits with unique ingredients.",
    },
    {
        "name": "Land of a Thousand Hills Coffee",
        "slug": "land-thousand-hills-roswell",
        "address": "232 S Atlanta Street",
        "neighborhood": "Roswell",
        "city": "Roswell",
        "state": "GA",
        "zip": "30075",
        "lat": 34.0185,
        "lng": -84.3582,
        "venue_type": "cafe",
        "spot_type": "coffee_shop",
        "website": "https://landofathousandhills.com",
        "description": "Charming blue cottage with fair-trade coffee, gardens, and Friday live music.",
    },
]


def main():
    parser = argparse.ArgumentParser(
        description="Import Alpharetta/Roswell destinations and run enrichment"
    )
    add_enrichment_args(parser)
    args = parser.parse_args()

    client = get_client()
    added = 0

    for dest in DESTINATIONS:
        try:
            result = client.table("venues").upsert(dest, on_conflict="slug").execute()
            added += 1
            print(f"✓ {dest['name']} ({dest['neighborhood']})")
        except Exception as e:
            print(f"✗ {dest['name']}: {e}")

    print(f"\nImported {added}/{len(DESTINATIONS)} Alpharetta/Roswell destinations")
    run_post_import_enrichment(
        slugs=[dest["slug"] for dest in DESTINATIONS],
        skip_enrich=args.skip_enrich,
        enrich_dry_run=args.enrich_dry_run,
    )


if __name__ == "__main__":
    main()
