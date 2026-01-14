"""
Add new venues from content strategy.
Parks, music venues, maker spaces, bookstores.
"""

from db import get_client


def slugify(name: str) -> str:
    """Convert name to URL-friendly slug."""
    import re
    slug = name.lower()
    slug = re.sub(r"[''']s\b", "s", slug)  # Remove apostrophe in possessives
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug


PARKS = [
    {"name": "Piedmont Park", "neighborhood": "Midtown", "lat": 33.7879, "lng": -84.3733, "spot_type": "park"},
    {"name": "Grant Park", "neighborhood": "Grant Park", "lat": 33.7398, "lng": -84.3707, "spot_type": "park"},
    {"name": "Westside Park", "neighborhood": "Westside", "lat": 33.7959, "lng": -84.4382, "spot_type": "park"},
    {"name": "Historic Fourth Ward Park", "neighborhood": "Old Fourth Ward", "lat": 33.7698, "lng": -84.3634, "spot_type": "park"},
    {"name": "Freedom Park", "neighborhood": "Poncey-Highland", "lat": 33.7678, "lng": -84.3478, "spot_type": "park"},
    {"name": "Chastain Park", "neighborhood": "Chastain Park", "lat": 33.8667, "lng": -84.3922, "spot_type": "park"},
    {"name": "Chastain Park Amphitheatre", "neighborhood": "Chastain Park", "lat": 33.8640, "lng": -84.3935, "spot_type": "music_venue"},
    {"name": "Sweetwater Creek State Park", "neighborhood": None, "lat": 33.7558, "lng": -84.6300, "spot_type": "park"},
    {"name": "Arabia Mountain", "neighborhood": None, "lat": 33.6653, "lng": -84.1231, "spot_type": "park"},
    {"name": "Cascade Springs Nature Preserve", "neighborhood": "Cascade Heights", "lat": 33.7117, "lng": -84.4844, "spot_type": "park"},
    {"name": "Constitution Lakes", "neighborhood": None, "lat": 33.6839, "lng": -84.3467, "spot_type": "park"},
    {"name": "Mason Mill Park", "neighborhood": "Decatur", "lat": 33.7889, "lng": -84.2956, "spot_type": "park"},
    {"name": "Olmsted Linear Park", "neighborhood": "Druid Hills", "lat": 33.7833, "lng": -84.3333, "spot_type": "park"},
]

MUSIC_VENUES = [
    {"name": "Boggs Social & Supply", "neighborhood": "West End", "spot_type": "music_venue", "vibes": ["late-night", "live-music", "divey"]},
    {"name": "The Sound Table", "neighborhood": "Old Fourth Ward", "spot_type": "music_venue", "vibes": ["late-night", "live-music", "craft-cocktails"]},
    {"name": "Mama & Baby O Lounge", "neighborhood": "Old Fourth Ward", "spot_type": "music_venue", "vibes": ["late-night", "live-music"]},
    {"name": "Waller's Coffee Shop", "neighborhood": "Decatur", "spot_type": "coffee_shop", "vibes": ["live-music"]},
    {"name": "Blind Willie's", "neighborhood": "Virginia-Highland", "spot_type": "music_venue", "vibes": ["live-music", "late-night"]},
    {"name": "Northside Tavern", "neighborhood": "Westside", "spot_type": "music_venue", "vibes": ["live-music", "divey", "late-night"]},
    {"name": "Red Clay Music Foundry", "neighborhood": None, "spot_type": "music_venue", "vibes": ["live-music"]},
    {"name": "Iron Factory", "neighborhood": "Westside", "spot_type": "music_venue", "vibes": ["live-music", "late-night"]},
    {"name": "Relapse Theatre", "neighborhood": "Midtown", "spot_type": "comedy_club", "vibes": ["late-night"]},
    {"name": "Village Theatre", "neighborhood": "East Atlanta Village", "spot_type": "comedy_club", "vibes": ["late-night"]},
    {"name": "Highland Ballroom", "neighborhood": "Virginia-Highland", "spot_type": "music_venue", "vibes": ["late-night", "live-music"]},
]

MAKER_SPACES = [
    {"name": "Spruill Center for the Arts", "neighborhood": "Dunwoody", "spot_type": "gallery", "vibes": ["date-spot"]},
    {"name": "Callanwolde Fine Arts Center", "neighborhood": "Druid Hills", "spot_type": "gallery", "vibes": ["date-spot", "outdoor-seating"]},
    {"name": "Decatur Makers", "neighborhood": "Decatur", "spot_type": "gallery", "vibes": ["good-for-groups"]},
    {"name": "Mudfire Ceramic Studio", "neighborhood": "Decatur", "spot_type": "gallery", "vibes": ["date-spot"]},
    {"name": "The Bakery Atlanta", "neighborhood": "Westside", "spot_type": "music_venue", "vibes": ["late-night"]},
    {"name": "Cook's Warehouse - Midtown", "neighborhood": "Midtown", "spot_type": "restaurant", "vibes": ["date-spot", "good-for-groups"]},
    {"name": "Atlanta Printmakers Studio", "neighborhood": "Westside", "spot_type": "gallery", "vibes": ["date-spot"]},
]

BOOKSTORES = [
    {"name": "Wuxtry Records", "neighborhood": "Decatur", "spot_type": "bar", "vibes": []},  # Record store
    {"name": "Criminal Records", "neighborhood": "Little Five Points", "spot_type": "bar", "vibes": []},  # Record store
    {"name": "Book Nook Atlanta", "neighborhood": "East Atlanta Village", "spot_type": "bar", "vibes": []},  # Bookstore
]


def add_venues(venues: list, category: str, dry_run: bool = False) -> int:
    """Add venues to database."""
    client = get_client()
    added = 0
    skipped = 0

    for venue in venues:
        slug = slugify(venue["name"])

        # Check if already exists
        existing = client.table("venues").select("id").eq("slug", slug).execute()
        if existing.data:
            print(f"  [SKIP] {venue['name']} (already exists)")
            skipped += 1
            continue

        record = {
            "name": venue["name"],
            "slug": slug,
            "neighborhood": venue.get("neighborhood"),
            "spot_type": venue.get("spot_type"),
            "vibes": venue.get("vibes", []),
            "city": "Atlanta",
            "state": "GA",
            "active": True,
        }

        if "lat" in venue:
            record["lat"] = venue["lat"]
            record["lng"] = venue["lng"]

        if dry_run:
            print(f"  [DRY RUN] Would add: {venue['name']}")
        else:
            try:
                client.table("venues").insert(record).execute()
                print(f"  [ADDED] {venue['name']}")
                added += 1
            except Exception as e:
                print(f"  [ERROR] {venue['name']}: {e}")

    return added, skipped


def main(dry_run: bool = False):
    print("\n" + "=" * 60)
    print("ADDING NEW VENUES FROM CONTENT STRATEGY")
    print("=" * 60)

    total_added = 0
    total_skipped = 0

    print(f"\n--- PARKS ({len(PARKS)} venues) ---")
    added, skipped = add_venues(PARKS, "parks", dry_run)
    total_added += added
    total_skipped += skipped

    print(f"\n--- MUSIC VENUES ({len(MUSIC_VENUES)} venues) ---")
    added, skipped = add_venues(MUSIC_VENUES, "music", dry_run)
    total_added += added
    total_skipped += skipped

    print(f"\n--- MAKER SPACES ({len(MAKER_SPACES)} venues) ---")
    added, skipped = add_venues(MAKER_SPACES, "makers", dry_run)
    total_added += added
    total_skipped += skipped

    print(f"\n--- BOOKSTORES/RECORD STORES ({len(BOOKSTORES)} venues) ---")
    added, skipped = add_venues(BOOKSTORES, "books", dry_run)
    total_added += added
    total_skipped += skipped

    print("\n" + "=" * 60)
    print(f"COMPLETE: Added {total_added}, Skipped {total_skipped}")
    print("=" * 60)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Don't actually add to database")
    args = parser.parse_args()

    main(dry_run=args.dry_run)
