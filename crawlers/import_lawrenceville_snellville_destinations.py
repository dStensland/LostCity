#!/usr/bin/env python3
"""
Import curated destinations for Lawrenceville and Snellville, GA.
East Gwinnett County - revitalized downtown and diverse cuisines.
Sources: TripAdvisor, Access Atlanta, Explore Gwinnett
"""

from db import get_client

DESTINATIONS = [
    # === LAWRENCEVILLE - DOWNTOWN SQUARE ===
    {
        "name": "Local Republic",
        "slug": "local-republic-lawrenceville",
        "address": "139 N Perry St",
        "neighborhood": "Lawrenceville",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30046",
        "lat": 33.9565,
        "lng": -83.9875,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Industrial-chic gastropub - epicenter of downtown's dining renaissance.",
    },
    {
        "name": "Perry Street Chophouse",
        "slug": "perry-street-chophouse",
        "address": "125 N Perry St",
        "neighborhood": "Lawrenceville",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30046",
        "lat": 33.9563,
        "lng": -83.9873,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.perrystreetchophouse.com",
        "description": "Elegant upscale steakhouse with prime cuts and fresh seafood on Perry Street.",
    },
    {
        "name": "Rreal Tacos",
        "slug": "rreal-tacos-lawrenceville",
        "address": "30 S Clayton St Suite 100",
        "neighborhood": "Lawrenceville",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30046",
        "lat": 33.9555,
        "lng": -83.9880,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://rrealtacos.com",
        "description": "Le Cordon Bleu Paris-trained chef elevating Mexican street food since 2015.",
    },
    {
        "name": "McCray's Tavern on the Square",
        "slug": "mccrays-tavern-lawrenceville",
        "address": "100 N Perry St",
        "neighborhood": "Lawrenceville",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30046",
        "lat": 33.9560,
        "lng": -83.9870,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Rooftop patio overlooking courthouse square with live music Friday & Saturday.",
    },
    {
        "name": "Foggy Bottom BBQ",
        "slug": "foggy-bottom-bbq",
        "address": "202 W Crogan St",
        "neighborhood": "Lawrenceville",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30046",
        "lat": 33.9558,
        "lng": -83.9890,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Classic neighborhood BBQ spot with traditional smoked meats.",
    },
    {
        "name": "D'Floridian Cuban Cuisine",
        "slug": "dfloridian-cuban",
        "address": "110 S Perry St",
        "neighborhood": "Lawrenceville",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30046",
        "lat": 33.9550,
        "lng": -83.9872,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Tropical Caribbean dishes and handcrafted cocktails with Saturday live music.",
    },
    {
        "name": "Break Coffee Roasters",
        "slug": "break-coffee-lawrenceville",
        "address": "114 S Clayton St",
        "neighborhood": "Lawrenceville",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30046",
        "lat": 33.9552,
        "lng": -83.9878,
        "venue_type": "cafe",
        "spot_type": "coffee_shop",
        "website": "https://breakroasters.com",
        "description": "Fresh small-batch roasted coffee in community-focused cafe and roastery.",
    },
    {
        "name": "Boulder Creek Coffee",
        "slug": "boulder-creek-coffee",
        "address": "105 E Crogan St",
        "neighborhood": "Lawrenceville",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30046",
        "lat": 33.9560,
        "lng": -83.9865,
        "venue_type": "cafe",
        "spot_type": "coffee_shop",
        "website": None,
        "description": "Charming historic home serving ethically-sourced Counter Culture Coffee.",
    },
    # === SNELLVILLE ===
    {
        "name": "Provino's Italian Restaurant",
        "slug": "provinos-snellville",
        "address": "2250 E Main Street",
        "neighborhood": "Snellville",
        "city": "Snellville",
        "state": "GA",
        "zip": "30078",
        "lat": 33.8575,
        "lng": -84.0100,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Classic Italian dinner with complimentary garlic rolls - ideal for date nights.",
    },
    {
        "name": "Cuckoo Café",
        "slug": "cuckoo-cafe-snellville",
        "address": "1987 Scenic Highway N Suite 101",
        "neighborhood": "Snellville",
        "city": "Snellville",
        "state": "GA",
        "zip": "30078",
        "lat": 33.8620,
        "lng": -84.0050,
        "venue_type": "cafe",
        "spot_type": "cafe",
        "website": None,
        "description": "Hidden gem with boba tea, Taiwanese chicken, donuts, and bento boxes.",
    },
    {
        "name": "EscovitcheZ",
        "slug": "escovitchez-snellville",
        "address": "1350 Scenic Highway S Suite 804",
        "neighborhood": "Snellville",
        "city": "Snellville",
        "state": "GA",
        "zip": "30078",
        "lat": 33.8530,
        "lng": -84.0150,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Caribbean hidden gem - jerk chicken nachos, curried goat, French toast brunch.",
    },
    {
        "name": "Main Street Restaurant",
        "slug": "main-street-restaurant-snellville",
        "address": "2420 Wisteria Dr SW #6",
        "neighborhood": "Snellville",
        "city": "Snellville",
        "state": "GA",
        "zip": "30078",
        "lat": 33.8560,
        "lng": -84.0120,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Family-owned diner for 20+ years - retro vibe and comfort food classics.",
    },
]


def main():
    client = get_client()
    added = 0

    for dest in DESTINATIONS:
        try:
            result = client.table("venues").upsert(dest, on_conflict="slug").execute()
            added += 1
            print(f"✓ {dest['name']} ({dest['city']})")
        except Exception as e:
            print(f"✗ {dest['name']}: {e}")

    print(f"\nImported {added}/{len(DESTINATIONS)} Lawrenceville/Snellville destinations")


if __name__ == "__main__":
    main()
