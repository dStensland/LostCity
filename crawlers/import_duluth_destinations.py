#!/usr/bin/env python3
"""
Import curated destinations for Duluth, GA.
Known for one of the largest Korean communities in the Southeast.
Sources: Eater Atlanta, Atlanta Magazine, Explore Gwinnett
"""

from db import get_client

DESTINATIONS = [
    # === KOREAN BBQ ===
    {
        "name": "Kang's Kitchen Korean BBQ",
        "slug": "kangs-kitchen",
        "address": "2255 Pleasant Hill Rd Suite 400",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9570,
        "lng": -84.1420,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://kangskitchen.com",
        "description": "Authentic all-you-can-grill Korean BBQ with premium marinated meats.",
    },
    {
        "name": "Honey Pig Korean BBQ",
        "slug": "honey-pig-duluth",
        "address": "3473 Old Norcross Rd",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9545,
        "lng": -84.1380,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.honeypigusa.com",
        "description": "Traditional Korean cauldron-lid BBQ method - only spot in Georgia offering this authentic technique.",
    },
    {
        "name": "Breakers Korean BBQ",
        "slug": "breakers-korean-bbq",
        "address": "2550 Pleasant Hill Rd",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9585,
        "lng": -84.1435,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Upscale smokeless Korean BBQ with paper-thin brisket and extensive banchan.",
    },
    {
        "name": "9292 Korean BBQ",
        "slug": "9292-korean-bbq",
        "address": "2625 Pleasant Hill Rd",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9590,
        "lng": -84.1440,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Beloved Korean BBQ with delicious meats and endless banchan side dishes.",
    },
    # === KOREAN TRADITIONAL ===
    {
        "name": "Naju Myunok",
        "slug": "naju-myunok",
        "address": "3505 Gwinnett Pl Dr NW Suite 101",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9560,
        "lng": -84.1400,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Casual Korean noodles and soups open until 2 AM on Fridays - authentic comfort fare.",
    },
    # === CHINESE / DIM SUM ===
    {
        "name": "Royal China Restaurant",
        "slug": "royal-china-duluth",
        "address": "3960 Venture Dr",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9520,
        "lng": -84.1350,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Among the best Cantonese food in greater Atlanta - fancy décor, excellent dim sum.",
    },
    {
        "name": "Canton House Restaurant",
        "slug": "canton-house-duluth",
        "address": "2255 Pleasant Hill Rd",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9572,
        "lng": -84.1422,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.cantonhouserestaurant.com",
        "description": "Rare all-day dim sum service in spacious chandeliered dining room.",
    },
    # === VIETNAMESE ===
    {
        "name": "Pho Dai Loi #3",
        "slug": "pho-dai-loi-duluth",
        "address": "1500 Pleasant Hill Rd",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9540,
        "lng": -84.1390,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Highly-rated pho destination known for generous portions and savory broth.",
    },
    {
        "name": "Banh Mi Café",
        "slug": "banh-mi-cafe-duluth",
        "address": "3512 Satellite Blvd Suite 7",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9480,
        "lng": -84.1300,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "15 authentic Vietnamese sandwiches, pho, and popular Vietnamese coffee.",
    },
    {
        "name": "Bun Bo Hue Kitchen",
        "slug": "bun-bo-hue-kitchen",
        "address": "3640 Satellite Blvd",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9485,
        "lng": -84.1305,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": None,
        "description": "Specialized in authentic Bun Bo Hue - Buford Highway corridor staple.",
    },
    # === HOT POT ===
    {
        "name": "Chubby Cattle Shabu",
        "slug": "chubby-cattle-duluth",
        "address": "2180 Pleasant Hill Rd Suite B20",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9565,
        "lng": -84.1415,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.chubbycattle.com",
        "description": "Interactive hot pot experience with individual table burners - open until 11 PM.",
    },
    # === FINE DINING ===
    {
        "name": "Noona Meat & Seafood",
        "slug": "noona-duluth",
        "address": "3105 Main St",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 34.0010,
        "lng": -84.1450,
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.noonaduluth.com",
        "description": "Award-winning steakhouse/seafood - Gwinnett Magazine Best of Best 2019-2024.",
    },
    # === BREWERY ===
    {
        "name": "Good Word Brewing",
        "slug": "good-word-brewing",
        "address": "3077 Main St",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 34.0008,
        "lng": -84.1448,
        "venue_type": "brewery",
        "spot_type": "brewery",
        "website": "https://goodwordbrewing.com",
        "description": "Handcrafted brews with full-service restaurant in downtown Duluth.",
    },
    # === CAFES / BAKERIES ===
    {
        "name": "Cafe Mozart Bakery",
        "slug": "cafe-mozart-duluth",
        "address": "2131 Pleasant Hill Rd Suite 148",
        "neighborhood": "Duluth",
        "city": "Duluth",
        "state": "GA",
        "zip": "30096",
        "lat": 33.9562,
        "lng": -84.1412,
        "venue_type": "cafe",
        "spot_type": "bakery",
        "website": "https://www.cafemozartbakery.com",
        "description": "Incredible cakes, macarons, and quality coffees - open until midnight weekends.",
    },
]


def main():
    client = get_client()
    added = 0

    for dest in DESTINATIONS:
        try:
            result = client.table("venues").upsert(dest, on_conflict="slug").execute()
            added += 1
            print(f"✓ {dest['name']} ({dest.get('description', '')[:40]}...)")
        except Exception as e:
            print(f"✗ {dest['name']}: {e}")

    print(f"\nImported {added}/{len(DESTINATIONS)} Duluth destinations")
    print("🍜 Seoul of the South represented!")


if __name__ == "__main__":
    main()
