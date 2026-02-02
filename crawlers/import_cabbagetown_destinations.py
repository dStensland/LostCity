#!/usr/bin/env python3
"""
Import Cabbagetown destinations (restaurants, bars, shops, cultural spots).
Run once to populate the database with neighborhood spots.
"""

import sys
sys.path.insert(0, '.')

from db import get_or_create_venue

CABBAGETOWN_DESTINATIONS = [
    # Restaurants & Cafes
    {
        "name": "JenChan's",
        "slug": "jenchans-cabbagetown",
        "address": "229 Carroll St SE",
        "neighborhood": "Cabbagetown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7540,
        "lng": -84.3640,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://jenchans.com",
        "description": "Pan-Asian restaurant with sushi, ramen, and creative cocktails in a cozy Cabbagetown setting.",
    },
    {
        "name": "Carroll Street Cafe",
        "slug": "carroll-street-cafe",
        "address": "208 Carroll St SE",
        "neighborhood": "Cabbagetown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7538,
        "lng": -84.3645,
        "venue_type": "restaurant",
        "spot_type": "cafe",
        "website": None,
        "description": "Beloved neighborhood cafe serving breakfast and lunch in the heart of Cabbagetown.",
    },
    {
        "name": "Little's Food Store",
        "slug": "littles-food-store",
        "address": "198 Carroll St SE",
        "neighborhood": "Cabbagetown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7536,
        "lng": -84.3648,
        "venue_type": "restaurant",
        "spot_type": "deli",
        "website": "https://littlesfoodstore.com",
        "description": "Corner store and deli with gourmet sandwiches, craft beer, and neighborhood vibes.",
    },
    {
        "name": "Muchacho",
        "slug": "muchacho-cabbagetown",
        "address": "304 Carroll St SE",
        "neighborhood": "Cabbagetown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7545,
        "lng": -84.3632,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.muchacho.us",
        "description": "Tex-Mex coffee shop and restaurant with breakfast tacos, burritos, and great coffee.",
    },
    # Bars
    {
        "name": "Octopus Bar",
        "slug": "octopus-bar",
        "address": "560 Gresham Ave SE",
        "neighborhood": "Cabbagetown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7490,
        "lng": -84.3580,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": None,
        "description": "Intimate cocktail bar with creative drinks and a laid-back Cabbagetown atmosphere.",
    },
    {
        "name": "Milltown Arms Tavern",
        "slug": "milltown-arms-tavern",
        "address": "180 Carroll St SE",
        "neighborhood": "Cabbagetown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7534,
        "lng": -84.3650,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": None,
        "description": "Neighborhood pub with pool tables, darts, and cold beer. A Cabbagetown institution.",
    },
    # Cultural & Historic
    {
        "name": "The Patch Works Art & History Center",
        "slug": "patch-works-art-history-center",
        "address": "170 Boulevard SE",
        "neighborhood": "Cabbagetown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7550,
        "lng": -84.3660,
        "venue_type": "museum",
        "spot_type": "museum",
        "website": "https://thepatchworks.org",
        "description": "Community art and history center preserving Cabbagetown's Fulton Bag and Cotton Mill heritage.",
    },
    # Parks & Outdoor
    {
        "name": "Cabbagetown Park",
        "slug": "cabbagetown-park",
        "address": "177 Carroll St SE",
        "neighborhood": "Cabbagetown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7537,
        "lng": -84.3646,
        "venue_type": "park",
        "spot_type": "park",
        "website": None,
        "description": "Neighborhood park and gathering space, home to Chomp & Stomp festival and community events.",
    },
    {
        "name": "Historic Fourth Ward Skatepark",
        "slug": "fourth-ward-skatepark",
        "address": "830 Willoughby Way NE",
        "neighborhood": "Cabbagetown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7610,
        "lng": -84.3640,
        "venue_type": "park",
        "spot_type": "park",
        "website": None,
        "description": "Popular skatepark along the BeltLine Eastside Trail, adjacent to Historic Fourth Ward Park.",
    },
]

def main():
    print("Importing Cabbagetown destinations...")

    for dest in CABBAGETOWN_DESTINATIONS:
        try:
            venue_id = get_or_create_venue(dest)
            print(f"  ✓ {dest['name']} (ID: {venue_id})")
        except Exception as e:
            print(f"  ✗ {dest['name']}: {e}")

    print(f"\nImported {len(CABBAGETOWN_DESTINATIONS)} Cabbagetown destinations.")

if __name__ == "__main__":
    main()
