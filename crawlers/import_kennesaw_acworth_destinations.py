#!/usr/bin/env python3
"""
Import curated destinations for Kennesaw and Acworth, GA.
Northwest Cobb County - family-friendly suburbs with lake lifestyle.
Sources: TripAdvisor, Atlanta Eats, local guides
"""

from db import get_client

DESTINATIONS = [
    # === KENNESAW ===
    {
        "name": "Capers Restaurant & Bar",
        "slug": "capers-kennesaw",
        "address": "1635 Old 41 Hwy NW Suite 403",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30152",
        "lat": 34.0280,
        "lng": -84.6200,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.capersonmain.com",
        "description": "Family-friendly fine dining staple for 20 years - fresh seafood and New American.",
    },
    {
        "name": "Crispina Ristorante & Pizzeria",
        "slug": "crispina-ristorante",
        "address": "425 Ernest W Barrett Pkwy NW Suite 1000",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "lat": 33.9950,
        "lng": -84.5750,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Authentic Southern Italian with imported wood-fired pizza ovens and handmade pasta.",
    },
    {
        "name": "Horned Owl Brewing",
        "slug": "horned-owl-brewing",
        "address": "2960 Cherokee St NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "lat": 34.0240,
        "lng": -84.6165,
        "venue_type": "brewery",
        "spot_type": "brewery",
        "website": "https://hornedowlbrewing.com",
        "description": "2,600 sq ft taproom with outdoor patio, craft IPAs, and live music.",
    },
    {
        "name": "Tinto's Coffee House",
        "slug": "tintos-coffee",
        "address": "2952 Cherokee St NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "lat": 34.0238,
        "lng": -84.6163,
        "venue_type": "cafe",
        "spot_type": "coffee_shop",
        "website": None,
        "description": "100% Colombian single-origin specialty coffee - popular with students and remote workers.",
    },
    {
        "name": "Big Pie in the Sky",
        "slug": "big-pie-in-the-sky",
        "address": "2090 Baker Rd NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "lat": 34.0150,
        "lng": -84.6100,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://bigpieinthesky.com",
        "description": "Famous for crispy-crust specialty pizzas and the Carnivore Challenge.",
    },
    {
        "name": "Rotisserie Shop",
        "slug": "rotisserie-shop-kennesaw",
        "address": "840 Ernest W Barrett Pkwy",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "lat": 33.9980,
        "lng": -84.5800,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Slow-cooked brined rotisserie chicken, pork poutine, and shrimp and grits.",
    },
    {
        "name": "Honeysuckle Biscuits and Bakery",
        "slug": "honeysuckle-biscuits",
        "address": "2936 Cherokee St NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "lat": 34.0235,
        "lng": -84.6160,
        "venue_type": "cafe",
        "spot_type": "bakery",
        "website": None,
        "description": "Fresh hot coffee and artisan baked goods in downtown Kennesaw.",
    },
    # === ACWORTH ===
    {
        "name": "Red Top Brewhouse",
        "slug": "red-top-brewhouse",
        "address": "4637 S Main Street",
        "neighborhood": "Acworth",
        "city": "Acworth",
        "state": "GA",
        "zip": "30101",
        "lat": 34.0650,
        "lng": -84.6765,
        "venue_type": "brewery",
        "spot_type": "brewery",
        "website": "https://www.redtopbrewhouse.com",
        "description": "Family/dog-friendly brewery with taproom, full restaurant, rooftop porch, and fire pit.",
    },
    {
        "name": "Henry's Louisiana Grill",
        "slug": "henrys-louisiana-grill",
        "address": "4849 North Main Street",
        "neighborhood": "Acworth",
        "city": "Acworth",
        "state": "GA",
        "zip": "30101",
        "lat": 34.0680,
        "lng": -84.6780,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Authentic New Orleans-inspired Cajun cuisine - gumbo, oysters, po'boys.",
    },
    {
        "name": "Fish Thyme Restaurant",
        "slug": "fish-thyme-acworth",
        "address": "3979 S Main Street",
        "neighborhood": "Acworth",
        "city": "Acworth",
        "state": "GA",
        "zip": "30101",
        "lat": 34.0640,
        "lng": -84.6760,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Fresh seafood focus in charming downtown Acworth location.",
    },
    {
        "name": "AG SteakHouse",
        "slug": "ag-steakhouse-acworth",
        "address": "5145 North Main Street",
        "neighborhood": "Acworth",
        "city": "Acworth",
        "state": "GA",
        "zip": "30101",
        "lat": 34.0720,
        "lng": -84.6800,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Spectacular Lake Allatoona views with upscale steakhouse, seafood, and sushi.",
    },
    {
        "name": "Center Street Tavern",
        "slug": "center-street-tavern",
        "address": "4381 Center Street",
        "neighborhood": "Acworth",
        "city": "Acworth",
        "state": "GA",
        "zip": "30101",
        "lat": 34.0655,
        "lng": -84.6768,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": None,
        "description": "Downtown bar open until 2 AM weekends - local gathering spot.",
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

    print(f"\nImported {added}/{len(DESTINATIONS)} Kennesaw/Acworth destinations")


if __name__ == "__main__":
    main()
