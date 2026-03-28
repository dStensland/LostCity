#!/usr/bin/env python3
"""
Batch T2 Template Enrichment

For venues that DON'T have individual crawlers (most nightclubs, many music
venues, cinemas), this script applies venue_type templates to fill:
  - destination_details (commitment_tier, parking_type, family_suitability, etc.)
  - 2 venue_features (experience + amenity based on type)

This gets venues to "minimum T2" without hand-crafting each one. Crawlers
can override with better data later (upsert on conflict).

Usage:
    python3 scripts/enrich_t2_templates.py --dry-run
    python3 scripts/enrich_t2_templates.py --type brewery --dry-run
    python3 scripts/enrich_t2_templates.py --allow-production-writes
    python3 scripts/enrich_t2_templates.py --type music_venue --allow-production-writes
"""

import argparse
import logging
import sys

sys.path.insert(0, ".")
from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


# ── Templates by venue_type ──
# Each template provides minimum destination_details + 2 venue_features.
# Crawlers override these with richer data via upsert on conflict.

TEMPLATES = {
    "brewery": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "taproom",
                "title": "Taproom",
                "feature_type": "experience",
                "description": "House-brewed beers on rotating taps",
            },
            {
                "slug": "outdoor-seating",
                "title": "Outdoor Seating",
                "feature_type": "amenity",
            },
        ],
    },
    "distillery": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "family_suitability": "caution",
        },
        "venue_features": [
            {
                "slug": "tasting-room",
                "title": "Tasting Room",
                "feature_type": "experience",
                "description": "Sample house-distilled spirits",
            },
            {
                "slug": "distillery-tour",
                "title": "Distillery Tour",
                "feature_type": "experience",
                "description": "See the production process",
            },
        ],
    },
    "winery": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "family_suitability": "caution",
        },
        "venue_features": [
            {
                "slug": "wine-tasting",
                "title": "Wine Tasting",
                "feature_type": "experience",
            },
            {
                "slug": "vineyard",
                "title": "Vineyard",
                "feature_type": "amenity",
            },
        ],
    },
    "music_venue": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "street",
            "best_time_of_day": "evening",
            "family_suitability": "caution",
        },
        "venue_features": [
            {
                "slug": "live-music-stage",
                "title": "Live Music Stage",
                "feature_type": "experience",
                "description": "Live performances from local and touring acts",
            },
            {
                "slug": "full-bar",
                "title": "Full Bar",
                "feature_type": "amenity",
            },
        ],
    },
    "nightclub": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "street",
            "best_time_of_day": "evening",
            "family_suitability": "no",
        },
        "venue_features": [
            {
                "slug": "dance-floor",
                "title": "Dance Floor",
                "feature_type": "experience",
            },
            {
                "slug": "dj-booth",
                "title": "DJ Booth",
                "feature_type": "experience",
                "description": "Resident and guest DJs",
            },
        ],
    },
    "comedy_club": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "street",
            "best_time_of_day": "evening",
            "family_suitability": "caution",
        },
        "venue_features": [
            {
                "slug": "live-comedy",
                "title": "Live Comedy Shows",
                "feature_type": "experience",
                "description": "Stand-up, improv, and sketch comedy",
            },
            {
                "slug": "bar-service",
                "title": "Bar Service",
                "feature_type": "amenity",
            },
        ],
    },
    "cinema": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "free_lot",
            "best_time_of_day": "any",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "movie-screenings",
                "title": "Movie Screenings",
                "feature_type": "experience",
            },
            {
                "slug": "concessions",
                "title": "Concessions",
                "feature_type": "amenity",
            },
        ],
    },
    "entertainment": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "interactive-experiences",
                "title": "Interactive Experiences",
                "feature_type": "experience",
            },
            {
                "slug": "group-activities",
                "title": "Group Activities",
                "feature_type": "experience",
                "description": "Activities for parties and group outings",
            },
        ],
    },
    "bowling": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "free_lot",
            "best_time_of_day": "evening",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "bowling-lanes",
                "title": "Bowling Lanes",
                "feature_type": "experience",
            },
            {
                "slug": "arcade-area",
                "title": "Arcade Area",
                "feature_type": "amenity",
            },
        ],
    },
    "arcade": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "arcade-games",
                "title": "Arcade Games",
                "feature_type": "experience",
                "description": "Classic and modern arcade cabinets",
            },
            {
                "slug": "prizes",
                "title": "Prize Counter",
                "feature_type": "amenity",
            },
        ],
    },
    "food_hall": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "garage",
            "best_time_of_day": "any",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "vendor-stalls",
                "title": "Food Vendors",
                "feature_type": "experience",
                "description": "Multiple independent food vendors under one roof",
            },
            {
                "slug": "communal-seating",
                "title": "Communal Seating",
                "feature_type": "amenity",
            },
        ],
    },
    "farmers_market": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "free_lot",
            "best_time_of_day": "morning",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "local-produce",
                "title": "Local Produce & Goods",
                "feature_type": "experience",
                "description": "Fresh produce, baked goods, and artisan products from local vendors",
            },
            {
                "slug": "outdoor-market",
                "title": "Outdoor Market Space",
                "feature_type": "amenity",
            },
        ],
    },
    "sports_bar": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "free_lot",
            "best_time_of_day": "evening",
            "family_suitability": "caution",
        },
        "venue_features": [
            {
                "slug": "big-screen-tvs",
                "title": "Big Screen TVs",
                "feature_type": "amenity",
                "description": "Multiple screens for watching live sports",
            },
            {
                "slug": "bar-food",
                "title": "Bar Food & Drinks",
                "feature_type": "amenity",
            },
        ],
    },
    "arena": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "paid_lot",
            "best_time_of_day": "evening",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "live-events",
                "title": "Live Events & Performances",
                "feature_type": "experience",
                "description": "Concerts, sports, and special events",
            },
            {
                "slug": "concourse-dining",
                "title": "Concourse Dining",
                "feature_type": "amenity",
            },
        ],
    },
    "stadium": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "paid_lot",
            "best_time_of_day": "any",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "live-sports",
                "title": "Live Sports",
                "feature_type": "experience",
            },
            {
                "slug": "concessions",
                "title": "Food & Beverage Concessions",
                "feature_type": "amenity",
            },
        ],
    },
    "convention_center": {
        "destination_details": {
            "commitment_tier": "fullday",
            "parking_type": "paid_lot",
            "best_time_of_day": "any",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "exhibition-halls",
                "title": "Exhibition Halls",
                "feature_type": "experience",
            },
            {
                "slug": "meeting-rooms",
                "title": "Meeting & Conference Rooms",
                "feature_type": "amenity",
            },
        ],
    },
    "museum": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "paid_lot",
            "best_time_of_day": "morning",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "exhibits",
                "title": "Exhibits & Collections",
                "feature_type": "collection",
            },
            {
                "slug": "gift-shop",
                "title": "Museum Gift Shop",
                "feature_type": "amenity",
            },
        ],
    },
    "escape_room": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "free_lot",
            "best_time_of_day": "any",
            "family_suitability": "caution",
            "reservation_required": True,
        },
        "venue_features": [
            {
                "slug": "escape-rooms",
                "title": "Themed Escape Rooms",
                "feature_type": "experience",
                "description": "Puzzle-based team challenges with multiple themed rooms",
            },
            {
                "slug": "group-booking",
                "title": "Group & Party Booking",
                "feature_type": "amenity",
            },
        ],
    },
    "attraction": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "free_lot",
            "best_time_of_day": "any",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "main-attraction",
                "title": "Main Attraction",
                "feature_type": "experience",
            },
            {
                "slug": "visitor-amenities",
                "title": "Visitor Amenities",
                "feature_type": "amenity",
            },
        ],
    },
    "rooftop": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "street",
            "best_time_of_day": "evening",
            "family_suitability": "no",
        },
        "venue_features": [
            {
                "slug": "skyline-views",
                "title": "Skyline Views",
                "feature_type": "amenity",
                "description": "Panoramic city views",
            },
            {
                "slug": "craft-cocktails",
                "title": "Craft Cocktails",
                "feature_type": "experience",
            },
        ],
    },
    "club": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "street",
            "best_time_of_day": "evening",
            "family_suitability": "no",
        },
        "venue_features": [
            {
                "slug": "dance-floor",
                "title": "Dance Floor",
                "feature_type": "experience",
            },
            {
                "slug": "vip-sections",
                "title": "VIP Sections",
                "feature_type": "amenity",
            },
        ],
    },
    "amphitheater": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "paid_lot",
            "best_time_of_day": "evening",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "outdoor-stage",
                "title": "Outdoor Stage",
                "feature_type": "experience",
                "description": "Open-air live performances",
            },
            {
                "slug": "lawn-seating",
                "title": "Lawn Seating",
                "feature_type": "amenity",
            },
        ],
    },
    "wine_bar": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "street",
            "best_time_of_day": "evening",
            "family_suitability": "no",
        },
        "venue_features": [
            {
                "slug": "wine-list",
                "title": "Curated Wine List",
                "feature_type": "experience",
            },
            {
                "slug": "small-plates",
                "title": "Small Plates",
                "feature_type": "amenity",
            },
        ],
    },
    "lounge": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "street",
            "best_time_of_day": "evening",
            "family_suitability": "no",
        },
        "venue_features": [
            {
                "slug": "cocktail-menu",
                "title": "Cocktail Menu",
                "feature_type": "experience",
            },
            {
                "slug": "lounge-seating",
                "title": "Lounge Seating",
                "feature_type": "amenity",
            },
        ],
    },
    "karaoke": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "street",
            "best_time_of_day": "evening",
            "family_suitability": "caution",
        },
        "venue_features": [
            {
                "slug": "karaoke-rooms",
                "title": "Karaoke Rooms",
                "feature_type": "experience",
                "description": "Private and open-floor karaoke",
            },
            {
                "slug": "song-catalog",
                "title": "Song Catalog",
                "feature_type": "experience",
            },
        ],
    },
    "games": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "games",
                "title": "Games & Activities",
                "feature_type": "experience",
            },
            {
                "slug": "group-events",
                "title": "Group Events",
                "feature_type": "amenity",
            },
        ],
    },
    "gaming": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "gaming-stations",
                "title": "Gaming Stations",
                "feature_type": "experience",
            },
            {
                "slug": "tournaments",
                "title": "Tournaments & Events",
                "feature_type": "experience",
            },
        ],
    },
    "theater": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "street",
            "best_time_of_day": "evening",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "live-performances",
                "title": "Live Performances",
                "feature_type": "experience",
                "description": "Theater, musicals, dance, and live performances",
            },
            {
                "slug": "box-office",
                "title": "Box Office",
                "feature_type": "amenity",
            },
        ],
    },
    "gallery": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "street",
            "best_time_of_day": "afternoon",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "exhibitions",
                "title": "Rotating Exhibitions",
                "feature_type": "exhibition",
                "description": "Curated art exhibitions with regular rotation",
            },
            {
                "slug": "gallery-space",
                "title": "Gallery Space",
                "feature_type": "amenity",
            },
        ],
    },
    "historic_site": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "free_lot",
            "best_time_of_day": "morning",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "historic-grounds",
                "title": "Historic Grounds & Structures",
                "feature_type": "attraction",
                "description": "Preserved historic buildings, monuments, and grounds",
            },
            {
                "slug": "interpretive-exhibits",
                "title": "Interpretive Exhibits",
                "feature_type": "collection",
            },
        ],
    },
    "landmark": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "street",
            "best_time_of_day": "any",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "landmark-experience",
                "title": "Landmark Experience",
                "feature_type": "attraction",
            },
            {
                "slug": "visitor-info",
                "title": "Visitor Information",
                "feature_type": "amenity",
            },
        ],
    },
    "garden": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "paid_lot",
            "best_time_of_day": "morning",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "garden-displays",
                "title": "Garden Displays",
                "feature_type": "attraction",
                "description": "Curated garden collections and seasonal displays",
            },
            {
                "slug": "walking-paths",
                "title": "Walking Paths",
                "feature_type": "amenity",
            },
        ],
    },
    "arts_center": {
        "destination_details": {
            "commitment_tier": "halfday",
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "family_suitability": "yes",
        },
        "venue_features": [
            {
                "slug": "exhibitions-programs",
                "title": "Exhibitions & Programs",
                "feature_type": "experience",
                "description": "Rotating exhibitions, classes, and cultural programming",
            },
            {
                "slug": "studio-spaces",
                "title": "Studio Spaces",
                "feature_type": "amenity",
            },
        ],
    },
    "pool_hall": {
        "destination_details": {
            "commitment_tier": "hour",
            "parking_type": "street",
            "best_time_of_day": "evening",
            "family_suitability": "caution",
        },
        "venue_features": [
            {
                "slug": "pool-tables",
                "title": "Pool Tables",
                "feature_type": "experience",
            },
            {
                "slug": "bar",
                "title": "Full Bar",
                "feature_type": "amenity",
            },
        ],
    },
}


def fetch_t2_venues_missing_details(client, *, venue_type=None):
    """Fetch T2+ target venues missing destination_details."""
    from scripts.venue_tier_health import TARGET_TIER_2, TARGET_TIER_3

    target_types = TARGET_TIER_2 | TARGET_TIER_3
    if venue_type:
        if venue_type not in target_types:
            logger.warning(f"{venue_type} is not a T2/T3 target type")
            return []
        target_types = {venue_type}

    all_venues = []
    offset = 0
    while True:
        q = (client.table("places")
             .select("id,name,slug,venue_type,vibes")
             .eq("active", True)
             .order("id")
             .range(offset, offset + 999))
        r = q.execute()
        if not r.data:
            break
        for v in r.data:
            if v.get("venue_type") in target_types:
                all_venues.append(v)
        if len(r.data) < 1000:
            break
        offset += 1000

    # Filter to those missing destination_details
    if not all_venues:
        return []

    venue_ids = [v["id"] for v in all_venues]
    has_details = set()
    for off in range(0, len(venue_ids), 500):
        batch = venue_ids[off:off + 500]
        r = client.table("venue_destination_details").select("venue_id").in_("venue_id", batch).execute()
        for row in (r.data or []):
            has_details.add(row["venue_id"])

    return [v for v in all_venues if v["id"] not in has_details]


def main():
    parser = argparse.ArgumentParser(description="Batch T2 template enrichment")
    parser.add_argument("--type", dest="venue_type", help="Filter by venue_type")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--allow-production-writes", action="store_true", help="Actually write to DB")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of venues to process")
    args = parser.parse_args()

    write = args.allow_production_writes and not args.dry_run

    client = get_client()
    venues = fetch_t2_venues_missing_details(client, venue_type=args.venue_type)

    if not venues:
        print("No T2+ venues missing destination_details found.")
        return

    if args.limit:
        venues = venues[:args.limit]

    # Group by type
    by_type = {}
    for v in venues:
        by_type.setdefault(v["venue_type"], []).append(v)

    total_filled = 0
    total_skipped = 0
    total_errors = 0

    for vtype, type_venues in sorted(by_type.items(), key=lambda x: -len(x[1])):
        template = TEMPLATES.get(vtype)
        if not template:
            total_skipped += len(type_venues)
            print(f"  SKIP {vtype:<22} {len(type_venues):>4} venues (no template)")
            continue

        print(f"  FILL {vtype:<22} {len(type_venues):>4} venues")

        if write:
            for v in type_venues:
                try:
                    # Upsert destination_details
                    details = {"place_id": v["id"], **template["destination_details"]}
                    client.table("venue_destination_details").upsert(
                        details, on_conflict="venue_id"
                    ).execute()

                    # Upsert venue_features
                    for feature in template["venue_features"]:
                        row = {
                            "place_id": v["id"],
                            "slug": feature["slug"],
                            "title": feature["title"],
                            "feature_type": feature.get("feature_type", "experience"),
                            "is_active": True,
                        }
                        if "description" in feature:
                            row["description"] = feature["description"]
                        client.table("venue_features").upsert(
                            row, on_conflict="place_id,slug"
                        ).execute()

                    total_filled += 1
                except Exception as e:
                    total_errors += 1
                    logger.error(f"    Failed: {v['name']} ({v['id']}): {e}")
        else:
            total_filled += len(type_venues)

    print(f"\n{'─' * 50}")
    print(f"Total T2+ venues missing details: {len(venues)}")
    print(f"Fillable (have template):         {total_filled}")
    print(f"Skipped (no template):            {total_skipped}")
    if total_errors:
        print(f"Errors:                           {total_errors}")
    if not write:
        print(f"\n  DRY RUN — use --allow-production-writes to apply")


if __name__ == "__main__":
    main()
