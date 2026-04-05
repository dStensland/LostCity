#!/usr/bin/env python3
"""
Backfill vibes from venue_type for venues with empty vibes.

Vibes power search filters and discovery pills. This script infers reasonable
default vibes from venue_type so venues become discoverable by attribute.

These are sensible defaults — crawlers should override with richer vibes from
actual page scraping when available. The script only fills EMPTY vibes, never
overwrites existing ones.

Usage:
    python3 scripts/backfill_vibes_from_type.py --dry-run
    python3 scripts/backfill_vibes_from_type.py --type museum --dry-run
    python3 scripts/backfill_vibes_from_type.py --allow-production-writes
"""

import argparse
import logging
import sys

sys.path.insert(0, ".")
from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ── Vibes inference by venue_type ──
# These are defaults — crawlers should capture richer vibes from the source.
VIBES_BY_TYPE = {
    # T3 types
    "museum": ["museum", "culture", "educational", "exhibits"],
    "zoo": ["family-friendly", "outdoor", "animals", "educational"],
    "aquarium": ["family-friendly", "indoor", "animals", "educational"],
    "theme_park": ["family-friendly", "outdoor", "rides", "entertainment"],
    "arena": ["sports", "concerts", "large-venue"],
    "stadium": ["sports", "live-events", "large-venue"],
    "convention_center": ["conventions", "conferences", "large-venue"],

    # T2 types
    "brewery": ["craft-beer", "casual", "taproom"],
    "distillery": ["spirits", "tours", "tasting"],
    "winery": ["wine", "tours", "tasting"],
    "cinema": ["movies", "entertainment", "date-night"],
    "entertainment": ["interactive", "entertainment", "group-friendly"],
    "bowling": ["bowling", "entertainment", "group-friendly", "casual"],
    "arcade": ["arcade", "gaming", "entertainment", "interactive"],
    "food_hall": ["food-hall", "diverse-cuisine", "casual", "group-friendly"],
    "farmers_market": ["farmers-market", "outdoor", "local", "fresh"],
    "sports_bar": ["sports", "bar", "casual", "game-day"],
    "comedy_club": ["comedy", "live-shows", "nightlife"],
    "nightclub": ["nightlife", "dancing", "late-night", "dj"],
    "music_venue": ["live-music", "concerts", "nightlife"],
    "rooftop": ["rooftop", "views", "cocktails"],
    "attraction": ["interactive", "entertainment", "destination"],
    "escape_room": ["escape-room", "interactive", "group-friendly", "puzzles"],
    "games": ["gaming", "entertainment", "interactive"],
    "gaming": ["gaming", "entertainment", "interactive"],
    "club": ["nightlife", "dancing", "late-night"],
    "amphitheater": ["live-music", "outdoor", "concerts"],
    "lounge": ["lounge", "cocktails", "chill"],
    "wine_bar": ["wine", "intimate", "date-night"],
    "cocktail_bar": ["cocktails", "intimate", "date-night"],
    "pool_hall": ["billiards", "bar", "casual"],
    "karaoke": ["karaoke", "nightlife", "entertainment"],

    # T1 types
    "restaurant": ["dining"],
    "bar": ["bar", "nightlife"],
    "coffee_shop": ["coffee", "casual", "workspace"],
    "gallery": ["art", "gallery", "culture"],
    "theater": ["theater", "performing-arts", "live-shows"],
    "bookstore": ["books", "quiet", "browsing"],
    "library": ["library", "quiet", "community"],
    "park": ["outdoor", "nature", "relaxing"],
    "garden": ["garden", "outdoor", "peaceful"],
    "fitness_center": ["fitness", "active", "health"],
    "studio": ["creative", "classes", "workshops"],
    "hotel": ["hotel", "accommodations"],
    "rec_center": ["community", "recreation", "active"],
    "arts_center": ["art", "culture", "community"],
    "recreation": ["recreation", "active", "community"],
    "dance_studio": ["dance", "classes", "active"],
    "cafe": ["coffee", "casual", "cozy"],
    "nature_center": ["nature", "outdoor", "educational"],
    "historic_site": ["historic", "culture", "landmark"],
    "landmark": ["landmark", "culture", "sightseeing"],
    "outdoor_venue": ["outdoor", "live-events"],
}


def fetch_venues_without_vibes(client, *, venue_type=None):
    """Fetch active venues with null or empty vibes."""
    all_venues = []
    offset = 0
    while True:
        q = client.table("places").select("id,name,place_type,vibes").eq("is_active", True)
        if venue_type:
            q = q.eq("place_type", venue_type)
        q = q.order("id").range(offset, offset + 999)
        r = q.execute()
        if not r.data:
            break
        for v in r.data:
            vibes = v.get("vibes")
            if not vibes or not isinstance(vibes, list) or len(vibes) == 0:
                all_venues.append(v)
        if len(r.data) < 1000:
            break
        offset += 1000
    return all_venues


def main():
    parser = argparse.ArgumentParser(description="Backfill vibes from venue_type")
    parser.add_argument("--type", dest="venue_type", help="Filter by venue_type")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--allow-production-writes", action="store_true", help="Actually write to DB")
    args = parser.parse_args()

    write = args.allow_production_writes and not args.dry_run

    client = get_client()
    venues = fetch_venues_without_vibes(client, venue_type=args.venue_type)

    if not venues:
        print("No venues with empty vibes found.")
        return

    # Group by type for reporting
    by_type = {}
    for v in venues:
        vtype = v.get("venue_type", "unknown")
        by_type.setdefault(vtype, []).append(v)

    fillable = 0
    skipped = 0
    filled = 0

    for vtype, type_venues in sorted(by_type.items(), key=lambda x: -len(x[1])):
        label = vtype or "(no type)"
        template_vibes = VIBES_BY_TYPE.get(vtype) if vtype else None
        if not template_vibes:
            skipped += len(type_venues)
            if len(type_venues) >= 5:
                print(f"  SKIP {label:<22} {len(type_venues):>4} venues (no vibe template)")
            continue

        fillable += len(type_venues)
        print(f"  FILL {label:<22} {len(type_venues):>4} venues -> {template_vibes}")

        if write:
            for v in type_venues:
                try:
                    client.table("places").update({"vibes": template_vibes}).eq("id", v["id"]).execute()
                    filled += 1
                except Exception as e:
                    logger.error(f"  Failed to update venue {v['id']} ({v['name']}): {e}")

    print(f"\n{'─' * 50}")
    print(f"Total venues with empty vibes: {len(venues)}")
    print(f"Fillable (have template):      {fillable}")
    print(f"Skipped (no template):         {skipped}")
    if write:
        print(f"Actually filled:               {filled}")
    else:
        print("\n  DRY RUN — use --allow-production-writes to apply")


if __name__ == "__main__":
    main()
