#!/usr/bin/env python3
"""
Import Reynoldstown destinations (restaurants, bars, cafes along Georgia Ave corridor).
Run once to populate the database with neighborhood spots.
"""

import sys
sys.path.insert(0, '.')

from db import get_or_create_venue

REYNOLDSTOWN_DESTINATIONS = [
    # Coffee & Cafes
    {
        "name": "Breaker Breaker",
        "slug": "breaker-breaker",
        "address": "908 Rogers St SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30317",
        "lat": 33.7490,
        "lng": -84.3520,
        "venue_type": "cafe",
        "spot_type": "coffee",
        "website": "https://www.breakerbreakerofficial.com",
        "description": "Specialty coffee shop in Reynoldstown with expertly crafted drinks and laid-back vibes.",
    },
    {
        "name": "Hero Doughnuts",
        "slug": "hero-doughnuts-reynoldstown",
        "address": "937 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7480,
        "lng": -84.3540,
        "venue_type": "restaurant",
        "spot_type": "bakery",
        "website": "https://www.herodoughnuts.com",
        "description": "Alabama-born craft doughnut shop with biscuits, breakfast sandwiches, and seriously good doughnuts.",
    },
    # Restaurants
    {
        "name": "Little Bear",
        "slug": "little-bear-atlanta",
        "address": "71 Georgia Ave SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7430,
        "lng": -84.3680,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.littlebearatl.com",
        "description": "Neighborhood restaurant with wood-fired dishes, craft cocktails, and a killer patio.",
    },
    {
        "name": "La Semilla",
        "slug": "la-semilla-atlanta",
        "address": "85 Georgia Ave SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7428,
        "lng": -84.3678,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Latin American restaurant bringing vibrant flavors to the Georgia Ave corridor.",
    },
    {
        "name": "BoccaLupo",
        "slug": "boccalupo",
        "address": "753 Edgewood Ave NE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7540,
        "lng": -84.3590,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.boccalupoatl.com",
        "description": "Handmade pasta restaurant with Italian-inspired dishes and an intimate neighborhood feel.",
    },
    {
        "name": "8ARM",
        "slug": "8arm-atlanta",
        "address": "710 Ponce de Leon Ave NE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7740,
        "lng": -84.3620,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.8armatl.com",
        "description": "Creative small plates and natural wines in a converted gas station space.",
    },
    {
        "name": "Superica",
        "slug": "superica-reynoldstown",
        "address": "99 Krog St NE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7530,
        "lng": -84.3630,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.superica.com",
        "description": "Tex-Mex restaurant with margaritas, fajitas, and a fun cantina atmosphere.",
    },
    # Bars
    {
        "name": "Florida Man",
        "slug": "florida-man-atlanta",
        "address": "990 Brady Ave NW",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7485,
        "lng": -84.3525,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": None,
        "description": "Tropical dive bar with Florida vibes, frozen drinks, and a great patio scene.",
    },
    {
        "name": "Ruby Chow's",
        "slug": "ruby-chows",
        "address": "77 Georgia Ave SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7429,
        "lng": -84.3679,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": None,
        "description": "Asian-inspired cocktail bar with inventive drinks and dim sum snacks.",
    },
    # Markets & Specialty
    {
        "name": "Krog Street Market",
        "slug": "krog-street-market",
        "address": "99 Krog St NE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7530,
        "lng": -84.3625,
        "venue_type": "food_hall",
        "spot_type": "food_hall",
        "website": "https://www.krogstreetmarket.com",
        "description": "Food hall and market in a renovated warehouse with restaurants, bars, and local vendors.",
    },
]

def main():
    print("Importing Reynoldstown destinations...")

    for dest in REYNOLDSTOWN_DESTINATIONS:
        try:
            venue_id = get_or_create_venue(dest)
            print(f"  ✓ {dest['name']} (ID: {venue_id})")
        except Exception as e:
            print(f"  ✗ {dest['name']}: {e}")

    print(f"\nImported {len(REYNOLDSTOWN_DESTINATIONS)} Reynoldstown destinations.")

if __name__ == "__main__":
    main()
