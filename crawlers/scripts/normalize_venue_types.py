"""
Normalize non-standard venue types to the valid taxonomy.

Valid types (from CLAUDE.md):
  bar, restaurant, music_venue, nightclub, comedy_club, gallery, museum, brewery,
  coffee_shop, bookstore, library, arena, cinema, park, garden, food_hall,
  farmers_market, convention_center, venue, organization, festival, church,
  event_space, sports_bar, distillery, winery, hotel, rooftop, coworking,
  record_store, studio, fitness_center, community_center, college, university
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client

# Direct venue type remaps
REMAPS = {
    # Merge into existing valid types
    "nonprofit_hq": "organization",
    "nonprofit": "organization",
    "network": "organization",
    "radio_station": "organization",
    "military": "organization",

    "stadium": "arena",
    "amphitheater": "arena",

    "fitness": "fitness_center",
    "wellness": "fitness_center",

    "cafe": "coffee_shop",
    "bakery": "restaurant",
    "wine_bar": "bar",

    "arts_center": "venue",
    "performing_arts": "venue",
    "concert_hall": "music_venue",
    "cultural_center": "venue",

    "entertainment_venue": "venue",
    "entertainment": "venue",
    "club": "nightclub",

    "recreation": "venue",
    "games": "venue",
    "gaming_lounge": "venue",
    "esports_arena": "venue",

    "retail": "venue",
    "shopping": "venue",
    "shopping_center": "venue",

    "attraction": "venue",
    "water_park": "venue",
    "plaza": "venue",

    "outdoor_space": "park",
    "arts": "gallery",
    "community": "community_center",

    "theater": "venue",  # "theater" is close but not in the valid list; map to venue
    "virtual": "organization",
}

# Types to DELETE (not real venues)
DELETE_TYPES = ["neighborhood", "city", "arts_district", "entertainment_district"]


def main():
    dry_run = "--dry-run" in sys.argv
    client = get_client()
    total_updated = 0
    total_deleted = 0

    # Step 1: Direct remaps
    print("=== Venue Type Normalization ===\n")
    for old_type, new_type in REMAPS.items():
        r = client.table("venues").select("id", count="exact").eq("venue_type", old_type).execute()
        if r.count > 0:
            if not dry_run:
                batch = client.table("venues").select("id").eq("venue_type", old_type).limit(500).execute()
                ids = [v["id"] for v in batch.data]
                client.table("venues").update({"venue_type": new_type}).in_("id", ids).execute()
            print(f"  {old_type:25s} -> {new_type:20s}: {r.count} venues {'updated' if not dry_run else '(dry run)'}")
            total_updated += r.count

    # Step 2: Remove non-venue entities
    print(f"\n=== Non-Venue Entities ===")
    for del_type in DELETE_TYPES:
        r = client.table("venues").select("id,name", count="exact").eq("venue_type", del_type).execute()
        if r.count > 0:
            print(f"  {del_type:25s}: {r.count} entries")
            for v in r.data[:5]:
                print(f"    - {v['name']}")
            if not dry_run:
                # Don't delete, just set to inactive — they may have events pointing to them
                ids = [v["id"] for v in r.data]
                client.table("venues").update({"active": False, "venue_type": "venue"}).in_("id", ids).execute()
                print(f"    -> Deactivated and set type to 'venue'")
            total_deleted += r.count

    # Step 3: Check remaining null types
    r = client.table("venues").select("id", count="exact").is_("venue_type", "null").execute()
    print(f"\n=== Remaining null venue_type: {r.count} ===")

    print(f"\nTotal: {total_updated} remapped, {total_deleted} deactivated")


if __name__ == "__main__":
    main()
