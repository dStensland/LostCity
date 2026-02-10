"""
Normalize non-standard event categories to the valid taxonomy.

Valid categories (from CRAWLER_STRATEGY.md):
  music, comedy, theater, film, art, food_drink, sports, community,
  nightlife, fitness, family, literary, tech, outdoor, holiday,
  lgbtq, wellness, learning

This script handles:
1. Direct remaps (outdoors -> outdoor, performing-arts -> theater, etc.)
2. Venue-type-based inference for 'other' category events
3. Title keyword inference for remaining 'other' events
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client

# Direct category remaps
DIRECT_REMAPS = {
    "outdoors": "outdoor",
    "performing-arts": "theater",
    "film-and-media": "film",
    "education": "learning",
    "workshop": "learning",
    "lifestyle": "wellness",
    "markets": "food_drink",
    "fashion": "art",
    "gaming": "community",
}

# Venue-type -> category mapping for 'other' events
VENUE_TYPE_TO_CATEGORY = {
    "music_venue": "music",
    "concert_hall": "music",
    "amphitheater": "music",
    "nightclub": "nightlife",
    "comedy_club": "comedy",
    "cinema": "film",
    "theater": "theater",
    "gallery": "art",
    "museum": "art",
    "brewery": "food_drink",
    "restaurant": "food_drink",
    "bar": "nightlife",
    "sports_bar": "sports",
    "stadium": "sports",
    "arena": "sports",
    "park": "outdoor",
    "garden": "outdoor",
    "library": "community",
    "bookstore": "literary",
    "church": "community",
    "community_center": "community",
    "fitness_center": "fitness",
    "coffee_shop": "community",
}

# Title keyword patterns for remaining 'other' events
TITLE_KEYWORDS = {
    "sports": ["vs ", "vs.", "game", "match", "tournament", "baseball", "basketball", "football", "soccer", "hockey", "predators", "hawks", "braves", "falcons", "titans", "nashville sc", "gladiators"],
    "music": ["concert", "live music", "dj ", "band", "orchestra", "symphony", "choir"],
    "comedy": ["comedy", "stand-up", "stand up", "improv", "comedian"],
    "food_drink": ["tasting", "dinner", "brunch", "food", "wine", "beer", "cocktail", "chef"],
    "community": ["meetup", "meet up", "networking", "volunteer", "fundraiser", "gala", "benefit"],
    "art": ["exhibit", "exhibition", "gallery", "art show", "opening reception"],
    "family": ["kids", "children", "family", "storytime"],
    "fitness": ["run ", "race", "marathon", "5k", "10k", "yoga", "workout"],
}


def infer_from_title(title: str):
    title_lower = title.lower()
    for category, keywords in TITLE_KEYWORDS.items():
        for kw in keywords:
            if kw in title_lower:
                return category
    return None


def main():
    dry_run = "--dry-run" in sys.argv
    client = get_client()

    total_updated = 0

    # Step 1: Direct remaps
    print("=== Step 1: Direct category remaps ===")
    for old_cat, new_cat in DIRECT_REMAPS.items():
        r = client.table("events").select("id", count="exact").gte("start_date", "2026-02-09").eq("category", old_cat).execute()
        count = r.count
        if count > 0:
            if not dry_run:
                # Update in batches
                updated = 0
                while updated < count:
                    batch = client.table("events").select("id").gte("start_date", "2026-02-09").eq("category", old_cat).limit(500).execute()
                    if not batch.data:
                        break
                    ids = [e["id"] for e in batch.data]
                    client.table("events").update({"category": new_cat}).in_("id", ids).execute()
                    updated += len(ids)
                print(f"  {old_cat:25s} -> {new_cat:15s}: {count} events updated")
            else:
                print(f"  {old_cat:25s} -> {new_cat:15s}: {count} events (dry run)")
            total_updated += count

    # Step 2: Remap 'meetup' -> 'community'
    print("\n=== Step 2: meetup -> community ===")
    r = client.table("events").select("id", count="exact").gte("start_date", "2026-02-09").eq("category", "meetup").execute()
    if r.count > 0:
        if not dry_run:
            batch = client.table("events").select("id").gte("start_date", "2026-02-09").eq("category", "meetup").limit(500).execute()
            ids = [e["id"] for e in batch.data]
            client.table("events").update({"category": "community"}).in_("id", ids).execute()
        print(f"  meetup -> community: {r.count} events {'updated' if not dry_run else '(dry run)'}")
        total_updated += r.count

    # Step 3: Remap 'business' -> 'community'
    print("\n=== Step 3: business -> community ===")
    r = client.table("events").select("id", count="exact").gte("start_date", "2026-02-09").eq("category", "business").execute()
    if r.count > 0:
        if not dry_run:
            batch = client.table("events").select("id").gte("start_date", "2026-02-09").eq("category", "business").limit(500).execute()
            ids = [e["id"] for e in batch.data]
            client.table("events").update({"category": "community"}).in_("id", ids).execute()
        print(f"  business -> community: {r.count} events {'updated' if not dry_run else '(dry run)'}")
        total_updated += r.count

    # Step 4: Remap 'dance' -> 'music'
    print("\n=== Step 4: dance -> music ===")
    r = client.table("events").select("id", count="exact").gte("start_date", "2026-02-09").eq("category", "dance").execute()
    if r.count > 0:
        if not dry_run:
            batch = client.table("events").select("id").gte("start_date", "2026-02-09").eq("category", "dance").limit(500).execute()
            ids = [e["id"] for e in batch.data]
            client.table("events").update({"category": "music"}).in_("id", ids).execute()
        print(f"  dance -> music: {r.count} events {'updated' if not dry_run else '(dry run)'}")
        total_updated += r.count

    # Step 5: Recategorize 'other' using venue type
    print("\n=== Step 5: Recategorize 'other' via venue type ===")
    r = client.table("events").select("id,title,venue_id").gte("start_date", "2026-02-09").eq("category", "other").execute()
    other_events = r.data
    print(f"  Total 'other' events: {len(other_events)}")

    # Get venue types
    venue_ids = list(set(e["venue_id"] for e in other_events if e.get("venue_id")))
    venue_types = {}
    for i in range(0, len(venue_ids), 50):
        batch = venue_ids[i:i+50]
        vr = client.table("venues").select("id,venue_type").in_("id", batch).execute()
        for v in vr.data:
            venue_types[v["id"]] = v.get("venue_type")

    by_new_cat = {}
    still_other = []
    for e in other_events:
        vt = venue_types.get(e.get("venue_id"))
        new_cat = VENUE_TYPE_TO_CATEGORY.get(vt)
        if not new_cat:
            # Try title inference
            new_cat = infer_from_title(e.get("title", ""))
        if new_cat:
            by_new_cat.setdefault(new_cat, []).append(e["id"])
        else:
            still_other.append(e)

    for new_cat, ids in by_new_cat.items():
        if not dry_run:
            for i in range(0, len(ids), 500):
                batch = ids[i:i+500]
                client.table("events").update({"category": new_cat}).in_("id", batch).execute()
        print(f"  other -> {new_cat:15s}: {len(ids)} events {'updated' if not dry_run else '(dry run)'}")
        total_updated += len(ids)

    print(f"  Remaining as 'other': {len(still_other)} events")
    if still_other:
        print("  Sample remaining 'other' titles:")
        for e in still_other[:10]:
            print(f"    - {e['title'][:70]}")

    print(f"\n=== TOTAL: {total_updated} events recategorized ===")


if __name__ == "__main__":
    main()
