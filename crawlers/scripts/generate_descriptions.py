#!/usr/bin/env python3
"""
Generate venue descriptions from existing metadata.

For venues missing descriptions, synthesizes a concise 1-2 sentence description
from: venue_type, neighborhood, vibes, hours, occasions, and venue name.

This is a legitimate enrichment case — many venues don't have websites or their
websites lack meta descriptions. The venue data we already have (type, vibes,
neighborhood) is enough to generate a useful description for discovery.

Usage:
    python3 scripts/generate_descriptions.py --dry-run
    python3 scripts/generate_descriptions.py --type restaurant --dry-run
    python3 scripts/generate_descriptions.py --allow-production-writes
    python3 scripts/generate_descriptions.py --allow-production-writes --limit 500
"""

import argparse
import logging
import random
import sys
from typing import Optional

sys.path.insert(0, ".")
from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


# ── Description templates by venue_type ──
# Each type has multiple templates for variety. Placeholders:
#   {name} - venue name
#   {neighborhood} - neighborhood or city
#   {vibes_phrase} - natural language from vibes array
#   {location} - "in {neighborhood}" or empty

def _vibes_phrase(vibes: list) -> str:
    """Convert vibes array to natural language."""
    if not vibes:
        return ""
    # Map vibe slugs to readable phrases
    VIBE_MAP = {
        "craft-beer": "craft beer",
        "live-music": "live music",
        "date-night": "date night",
        "date-spot": "date night",
        "family-friendly": "a family-friendly atmosphere",
        "dog-friendly": "a dog-friendly atmosphere",
        "outdoor": "outdoor space",
        "outdoor-seating": "outdoor seating",
        "late-night": "late-night hours",
        "casual": "a casual vibe",
        "cozy": "a cozy atmosphere",
        "intimate": "an intimate setting",
        "lively": "a lively atmosphere",
        "upscale": "an upscale setting",
        "dive-bar": "a classic dive bar feel",
        "sports": "sports viewing",
        "nightlife": "nightlife",
        "dancing": "dancing",
        "dj": "DJ sets",
        "comedy": "comedy shows",
        "karaoke": "karaoke",
        "rooftop": "rooftop views",
        "views": "scenic views",
        "cocktails": "craft cocktails",
        "wine": "wine",
        "nature": "natural surroundings",
        "relaxing": "a relaxing atmosphere",
        "historic": "historic character",
        "artsy": "an artsy atmosphere",
        "educational": "educational experiences",
        "interactive": "interactive experiences",
        "exhibits": "exhibits",
        "culture": "cultural experiences",
        "museum": "curated exhibits",
        "art": "art",
        "gallery": "gallery exhibitions",
        "theater": "live theater",
        "performing-arts": "performing arts",
        "books": "books",
        "fitness": "fitness",
        "creative": "creative programming",
        "gaming": "gaming",
        "entertainment": "entertainment",
        "dining": "dining",
        "food-hall": "multiple food vendors",
        "community": "community programming",
    }
    readable = []
    for v in vibes[:4]:  # Limit to 4 vibes
        if v in VIBE_MAP:
            readable.append(VIBE_MAP[v])
        else:
            readable.append(v.replace("-", " "))

    if not readable:
        return ""
    if len(readable) == 1:
        return readable[0]
    return ", ".join(readable[:-1]) + " and " + readable[-1]


def _location_phrase(neighborhood: str) -> str:
    if not neighborhood:
        return ""
    return f" in {neighborhood}"


TEMPLATES = {
    "restaurant": [
        "{name} is a restaurant{location} offering {vibes_phrase}.",
        "{name} serves up dining{location} with {vibes_phrase}.",
        "A dining destination{location}, {name} features {vibes_phrase}.",
    ],
    "bar": [
        "{name} is a bar{location} featuring {vibes_phrase}.",
        "A neighborhood bar{location}, {name} offers {vibes_phrase}.",
        "{name} is a go-to spot{location} for drinks, with {vibes_phrase}.",
    ],
    "coffee_shop": [
        "{name} is a coffee shop{location} with {vibes_phrase}.",
        "A neighborhood cafe{location}, {name} features {vibes_phrase}.",
    ],
    "brewery": [
        "{name} is a brewery{location} featuring {vibes_phrase}.",
        "A craft brewery{location}, {name} offers {vibes_phrase}.",
    ],
    "music_venue": [
        "{name} is a music venue{location} hosting live performances with {vibes_phrase}.",
        "A live music destination{location}, {name} features {vibes_phrase}.",
    ],
    "nightclub": [
        "{name} is a nightclub{location} featuring {vibes_phrase}.",
        "A nightlife destination{location}, {name} offers {vibes_phrase}.",
    ],
    "theater": [
        "{name} is a theater{location} presenting live performances with {vibes_phrase}.",
        "A performing arts venue{location}, {name} features {vibes_phrase}.",
    ],
    "gallery": [
        "{name} is an art gallery{location} featuring {vibes_phrase}.",
        "An art space{location}, {name} showcases {vibes_phrase}.",
    ],
    "museum": [
        "{name} is a museum{location} offering {vibes_phrase}.",
        "A museum{location}, {name} features {vibes_phrase}.",
    ],
    "cinema": [
        "{name} is a cinema{location} offering {vibes_phrase}.",
        "A movie theater{location}, {name} features {vibes_phrase}.",
    ],
    "park": [
        "{name} is a park{location} offering {vibes_phrase}.",
        "A green space{location}, {name} features {vibes_phrase}.",
    ],
    "entertainment": [
        "{name} is an entertainment venue{location} featuring {vibes_phrase}.",
        "A destination for fun{location}, {name} offers {vibes_phrase}.",
    ],
    "hotel": [
        "{name} is a hotel{location} offering {vibes_phrase}.",
        "A hotel{location}, {name} features {vibes_phrase}.",
    ],
    "library": [
        "{name} is a public library{location} serving the community with {vibes_phrase}.",
        "A library{location}, {name} offers {vibes_phrase}.",
    ],
    "fitness_center": [
        "{name} is a fitness center{location} offering {vibes_phrase}.",
        "A fitness destination{location}, {name} features {vibes_phrase}.",
    ],
    "arena": [
        "{name} is a major arena{location} hosting live events with {vibes_phrase}.",
        "A large-scale venue{location}, {name} hosts concerts, sports, and events.",
    ],
    "stadium": [
        "{name} is a stadium{location} hosting live sports and events.",
        "A major sports venue{location}, {name} features {vibes_phrase}.",
    ],
    "comedy_club": [
        "{name} is a comedy club{location} featuring {vibes_phrase}.",
        "A comedy venue{location}, {name} hosts live comedy with {vibes_phrase}.",
    ],
    "food_hall": [
        "{name} is a food hall{location} with {vibes_phrase}.",
        "A food hall{location}, {name} brings together {vibes_phrase}.",
    ],
    "bookstore": [
        "{name} is a bookstore{location} with {vibes_phrase}.",
        "An independent bookstore{location}, {name} offers {vibes_phrase}.",
    ],
    "historic_site": [
        "{name} is a historic site{location} featuring {vibes_phrase}.",
        "A landmark{location}, {name} offers {vibes_phrase}.",
    ],
    "landmark": [
        "{name} is a landmark{location} known for {vibes_phrase}.",
        "A notable destination{location}, {name} features {vibes_phrase}.",
    ],
    "arts_center": [
        "{name} is an arts center{location} offering {vibes_phrase}.",
        "A cultural hub{location}, {name} features {vibes_phrase}.",
    ],
    "convention_center": [
        "{name} is a convention center{location} hosting conferences and events.",
        "A major event space{location}, {name} hosts conventions, expos, and gatherings.",
    ],
    "escape_room": [
        "{name} is an escape room venue{location} offering {vibes_phrase}.",
        "A puzzle and adventure destination{location}, {name} features {vibes_phrase}.",
    ],
    "bowling": [
        "{name} is a bowling alley{location} with {vibes_phrase}.",
        "A bowling venue{location}, {name} offers {vibes_phrase}.",
    ],
    "sports_bar": [
        "{name} is a sports bar{location} with {vibes_phrase}.",
        "A sports-focused bar{location}, {name} features {vibes_phrase}.",
    ],
}

# Fallback for types without specific templates
DEFAULT_TEMPLATES = [
    "{name} is a venue{location} offering {vibes_phrase}.",
    "{name} is a destination{location} featuring {vibes_phrase}.",
]


def generate_description(venue: dict) -> Optional[str]:
    """Generate a description from venue metadata. Returns None if not enough data."""
    name = venue.get("name", "")
    vtype = venue.get("venue_type", "")
    neighborhood = venue.get("neighborhood", "")
    vibes = venue.get("vibes") or []

    if not name:
        return None

    vibes_text = _vibes_phrase(vibes)
    location = _location_phrase(neighborhood)

    # Need at least vibes or neighborhood to generate something useful
    if not vibes_text and not location:
        return None

    # If no vibes, use a simpler description
    if not vibes_text:
        type_label = vtype.replace("_", " ") if vtype else "venue"
        return f"{name} is a {type_label}{location}."

    templates = TEMPLATES.get(vtype, DEFAULT_TEMPLATES)
    template = random.choice(templates)

    desc = template.format(
        name=name,
        location=location,
        vibes_phrase=vibes_text,
    )

    # Clean up double spaces, trailing punctuation issues
    desc = " ".join(desc.split())

    return desc


def fetch_venues_missing_descriptions(client, *, venue_type=None, limit=0):
    """Fetch active venues with no real description."""
    from scripts.venue_tier_health import _is_real_description, TARGET_TIER_1, TARGET_TIER_2, TARGET_TIER_3

    # Only target T1+ venues (T0 don't need descriptions)
    target_types = TARGET_TIER_1 | TARGET_TIER_2 | TARGET_TIER_3

    all_venues = []
    offset = 0
    while True:
        q = (client.table("venues")
             .select("id,name,venue_type,neighborhood,city,vibes,description")
             .eq("active", True)
             .order("id")
             .range(offset, offset + 999))
        if venue_type:
            q = q.eq("venue_type", venue_type)
        r = q.execute()
        if not r.data:
            break
        for v in r.data:
            if v.get("venue_type") not in target_types:
                continue
            if not _is_real_description(v.get("description")):
                all_venues.append(v)
        if len(r.data) < 1000:
            break
        offset += 1000

    if limit:
        all_venues = all_venues[:limit]

    return all_venues


def main():
    parser = argparse.ArgumentParser(description="Generate descriptions from venue metadata")
    parser.add_argument("--type", dest="venue_type", help="Filter by venue_type")
    parser.add_argument("--limit", type=int, default=0, help="Max venues to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--allow-production-writes", action="store_true", help="Write to DB")
    args = parser.parse_args()

    write = args.allow_production_writes and not args.dry_run

    client = get_client()
    venues = fetch_venues_missing_descriptions(client, venue_type=args.venue_type, limit=args.limit)

    if not venues:
        print("No T1+ venues missing descriptions found.")
        return

    print(f"Found {len(venues)} T1+ venues missing descriptions")

    # Group by type
    by_type = {}
    for v in venues:
        by_type.setdefault(v.get("venue_type", "?"), []).append(v)

    generated = 0
    skipped = 0
    written = 0
    errors = 0

    for vtype, type_venues in sorted(by_type.items(), key=lambda x: -len(x[1])):
        type_gen = 0
        type_skip = 0
        for v in type_venues:
            desc = generate_description(v)
            if not desc or len(desc) < 30:
                type_skip += 1
                skipped += 1
                continue

            generated += 1
            type_gen += 1

            if write:
                try:
                    client.table("venues").update({"description": desc}).eq("id", v["id"]).execute()
                    written += 1
                except Exception as e:
                    errors += 1
                    logger.error(f"  Error {v['id']}: {e}")

        status = f"{type_gen} gen" + (f", {type_skip} skip" if type_skip else "")
        print(f"  {vtype:<22} {len(type_venues):>4} venues -> {status}")

    print(f"\n{'─' * 50}")
    print(f"Total missing descriptions: {len(venues)}")
    print(f"Generated:                  {generated}")
    print(f"Skipped (not enough data):  {skipped}")
    if write:
        print(f"Written to DB:              {written}")
        if errors:
            print(f"Errors:                     {errors}")
    else:
        print(f"\n  DRY RUN — use --allow-production-writes to apply")

    # Show samples
    if not write:
        print(f"\n{'─' * 50}")
        print("Sample generated descriptions:")
        samples = random.sample(venues, min(8, len(venues)))
        for v in samples:
            desc = generate_description(v)
            if desc:
                print(f"  [{v.get('venue_type', '?')}] {v['name']}")
                print(f"    -> {desc}")
                print()


if __name__ == "__main__":
    main()
