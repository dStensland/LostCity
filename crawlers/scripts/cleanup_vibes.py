"""
Clean up venue vibes in the database.

This script removes invalid vibes (neighborhoods, venue types, activities) and
normalizes vibes to a curated list of valid atmosphere, scene, social, and feature tags.

Valid vibes categories:
- Atmosphere: chill, upscale, intimate, high-energy, artsy, cozy, gritty, trendy, historic, eclectic, etc.
- Scene: dive-bar, speakeasy, rooftop, patio, late-night, neighborhood-spot, destination, hidden-gem, etc.
- Social: date-spot, group-friendly, solo-friendly, lgbtq-friendly, family-friendly, locals-hangout, etc.
- Features: live-music, outdoor-seating, dog-friendly, craft-beer, natural-wine, dancing, good-coffee, etc.
- Ownership: black-owned, woman-owned, veteran-owned, locally-owned
- Other: iconic, indie, boutique, vintage, tours, comics, records, vinyl, etc.

Removes:
- Neighborhood names (midtown, buckhead, decatur, etc.)
- Venue types (brewery, museum, restaurant, etc. - these go in venue_type field)
- Activities (trivia, karaoke, bingo, etc. - these go in genres/categories)
- Editorial tags (curator-vetted, atlanta-institution, eater-nashville-38, etc.)
- Meaningless tags (unique, community-focused, fun, popular, etc.)

Normalizes:
- "cocktails" -> "craft-cocktails"
- "local" -> "locals-hangout"
- "lgbtq" -> "lgbtq-friendly"
- "neighborhood" -> "neighborhood-spot"
- "kids" -> "family-friendly"
- etc.

Usage:
    # Dry run (show changes without applying them)
    python3 scripts/cleanup_vibes.py --dry-run

    # Apply changes to database
    python3 scripts/cleanup_vibes.py

Example output:
    Total venues processed: 1172
    Venues updated: 678
    Vibes kept: 2175
    Vibes normalized: 44
    Vibes removed: 722
"""

import sys
import os
import argparse
import logging
from typing import Dict, List, Set, Tuple
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Valid vibes to KEEP (curated list)
VALID_VIBES: Set[str] = {
    # Atmosphere
    "chill", "upscale", "intimate", "high-energy", "artsy", "cozy", "gritty",
    "trendy", "historic", "eclectic", "casual", "laid-back", "vibrant", "lively",
    "quirky", "vintage", "classic", "modern", "industrial", "bohemian", "creative",
    # Scene
    "dive-bar", "speakeasy", "rooftop", "patio", "late-night", "neighborhood-spot",
    "destination", "hidden-gem", "local-favorite", "tourist-friendly", "hole-in-the-wall",
    # Social
    "date-spot", "date-night", "group-friendly", "solo-friendly", "lgbtq-friendly",
    "family-friendly", "locals-hangout", "group-activity",
    # Features
    "live-music", "outdoor-seating", "dog-friendly", "craft-beer", "natural-wine",
    "dancing", "good-coffee", "craft-cocktails", "cheap-eats", "games", "game-night",
    "outdoor", "patio-dining", "wheelchair-accessible", "late-night-eats", "brunch",
    "happy-hour", "dj", "pool", "darts", "free-wifi", "parking", "valet",
    # Activity/Experience
    "hands-on", "workshop", "interactive", "educational", "browsing", "treasure-hunting",
    "24-hour", "paint-and-sip", "escape-room", "byob", "karaoke", "trivia",
    # Ownership/Culture
    "black-owned", "woman-owned", "veteran-owned", "locally-owned",
    # Other
    "dive", "divey", "indie", "boutique", "antiques", "good-for-groups",
    "iconic", "tours", "comics", "records", "vinyl",
}


# Normalization map for vibes that need renaming
VIBE_NORMALIZATION: Dict[str, str] = {
    "lively-energy": "high-energy",
    "cozy-atmosphere": "cozy",
    "romantic-ambiance": "date-spot",
    "romantic": "date-spot",
    "date-friendly": "date-spot",
    "family": "family-friendly",
    "lgbtq": "lgbtq-friendly",
    "queer-friendly": "lgbtq-friendly",
    "gay-bar": "lgbtq-friendly",
    "kid-friendly": "family-friendly",
    "kids": "family-friendly",
    "local": "locals-hangout",
    "neighborhood": "neighborhood-spot",
    "cocktails": "craft-cocktails",
    "beer-garden": "craft-beer",
    "beer": "craft-beer",
    "wine": "natural-wine",
    "wine-bar": "natural-wine",
    "dive-y": "divey",
    "groups": "good-for-groups",
    "group-hangout": "good-for-groups",
}


# Vibes to explicitly REMOVE (invalid categories)
INVALID_VIBES: Set[str] = {
    # Neighborhoods/locations
    "kennesaw", "west-end", "midtown", "buckhead", "downtown", "uptown", "eastside",
    "westside", "northside", "southside", "old-fourth-ward", "virginia-highland",
    "little-five-points", "east-atlanta-village", "decatur", "inman-park",
    "east-nashville", "the-gulch", "12-south", "germantown", "green-hills",
    # Venue types (belong in venue_type field)
    "brewery", "brewpub", "distillery", "winery", "taproom", "museum", "gallery",
    "theater", "cinema", "arena", "stadium", "park", "garden", "library", "bookstore",
    "coffee-shop", "restaurant", "bar", "nightclub", "music-venue", "comedy-club",
    "fitness", "fitness-center", "gym", "studio", "entertainment-center", "diner",
    # Activities (belong in genres or categories)
    "roller-derby", "roller-skating", "women-sports", "live-sports", "sports",
    "bingo", "open-mic", "poetry-slam",
    # Meaningless/generic
    "unique", "curator-vetted", "community-focused", "community", "cars", "entertainment",
    "venue", "events", "fun", "exciting", "amazing", "popular",
    # Editorial/list-specific tags
    "atlanta-institution", "nashville-institution", "eater-nashville-38",
    "eater-atlanta-38", "michelin", "best-of", "top-rated", "award-winning",
}


def normalize_vibe(vibe: str) -> Tuple[str, str]:
    """
    Normalize a single vibe.

    Returns:
        Tuple of (normalized_vibe, action) where action is:
        - "keep": vibe is valid, keep as-is
        - "normalize": vibe was normalized to a different value
        - "remove": vibe should be removed
    """
    vibe = vibe.strip().lower()

    # Check if it should be normalized to a different vibe
    if vibe in VIBE_NORMALIZATION:
        return VIBE_NORMALIZATION[vibe], "normalize"

    # Check if it's explicitly invalid
    if vibe in INVALID_VIBES:
        return vibe, "remove"

    # Check if it's in the valid list
    if vibe in VALID_VIBES:
        return vibe, "keep"

    # Unknown vibe - remove to be safe
    return vibe, "remove"


def clean_venue_vibes(vibes: List[str]) -> Tuple[List[str], Dict[str, int]]:
    """
    Clean a venue's vibes array.

    Returns:
        Tuple of (cleaned_vibes, action_counts) where action_counts is a dict
        with keys "kept", "normalized", "removed"
    """
    if not vibes:
        return [], {"kept": 0, "normalized": 0, "removed": 0}

    cleaned = []
    seen = set()
    action_counts = {"kept": 0, "normalized": 0, "removed": 0}

    for vibe in vibes:
        if not vibe or not isinstance(vibe, str):
            continue

        normalized, action = normalize_vibe(vibe)

        if action == "remove":
            action_counts["removed"] += 1
            continue

        if action == "normalize":
            action_counts["normalized"] += 1
        else:
            action_counts["kept"] += 1

        # Dedupe - if we've already added this vibe, skip
        if normalized in seen:
            continue

        seen.add(normalized)
        cleaned.append(normalized)

    # Sort for consistency
    cleaned.sort()

    return cleaned, action_counts


def update_venue_with_retry(client, venue_id: int, new_vibes: List[str], max_retries: int = 3) -> bool:
    """
    Update a venue's vibes with retry logic for stale connections.

    Returns:
        True on success, False on failure
    """
    for attempt in range(max_retries):
        try:
            client.table("venues").update({"vibes": new_vibes}).eq("id", venue_id).execute()
            return True
        except Exception as e:
            error_msg = str(e).lower()
            if "connection" in error_msg or "timeout" in error_msg:
                if attempt < max_retries - 1:
                    logger.debug(f"Connection error on venue {venue_id}, retrying (attempt {attempt + 1}/{max_retries})")
                    # Get a fresh client
                    client = get_client()
                    continue
            logger.error(f"Failed to update venue {venue_id}: {e}")
            return False

    logger.error(f"Failed to update venue {venue_id} after {max_retries} retries")
    return False


def main():
    parser = argparse.ArgumentParser(
        description="Clean up venue vibes in the database"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without making updates"
    )
    args = parser.parse_args()

    if args.dry_run:
        logger.info("=== DRY RUN MODE - No changes will be made ===")

    logger.info("Fetching venues with vibes from database...")
    client = get_client()

    # Fetch all active venues with vibes
    result = client.table("venues").select("id,name,vibes").not_.is_("vibes", "null").execute()
    venues = result.data

    logger.info(f"Found {len(venues)} venues with vibes")

    # Track statistics
    total_venues_processed = 0
    total_venues_updated = 0
    total_vibes_kept = 0
    total_vibes_normalized = 0
    total_vibes_removed = 0

    # Track specific vibes that were removed/normalized for reporting
    removed_vibes_counter = defaultdict(int)
    normalized_vibes_counter = defaultdict(int)

    # Process each venue
    for idx, venue in enumerate(venues, 1):
        venue_id = venue["id"]
        venue_name = venue["name"]
        original_vibes = venue.get("vibes") or []

        if not original_vibes:
            continue

        total_venues_processed += 1

        # Clean the vibes
        cleaned_vibes, action_counts = clean_venue_vibes(original_vibes)

        # Track removed/normalized vibes for reporting
        for vibe in original_vibes:
            if not vibe:
                continue
            normalized, action = normalize_vibe(vibe)
            if action == "remove":
                removed_vibes_counter[vibe] += 1
            elif action == "normalize":
                normalized_vibes_counter[f"{vibe} -> {normalized}"] += 1

        # Update counters
        total_vibes_kept += action_counts["kept"]
        total_vibes_normalized += action_counts["normalized"]
        total_vibes_removed += action_counts["removed"]

        # Check if anything changed
        if cleaned_vibes != original_vibes:
            total_venues_updated += 1

            if args.dry_run:
                logger.debug(
                    f"[{idx}/{len(venues)}] Would update {venue_name} (ID: {venue_id}): "
                    f"{original_vibes} -> {cleaned_vibes}"
                )
            else:
                success = update_venue_with_retry(client, venue_id, cleaned_vibes)
                if success:
                    logger.debug(
                        f"[{idx}/{len(venues)}] Updated {venue_name} (ID: {venue_id}): "
                        f"{len(original_vibes)} vibes -> {len(cleaned_vibes)} vibes"
                    )
                else:
                    logger.error(f"Failed to update venue {venue_id}")
        else:
            logger.debug(f"[{idx}/{len(venues)}] No changes needed for {venue_name}")

    # Print summary
    logger.info("\n" + "=" * 80)
    logger.info("CLEANUP SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Total venues processed: {total_venues_processed}")
    logger.info(f"Venues updated: {total_venues_updated}")
    logger.info(f"Vibes kept: {total_vibes_kept}")
    logger.info(f"Vibes normalized: {total_vibes_normalized}")
    logger.info(f"Vibes removed: {total_vibes_removed}")

    if removed_vibes_counter:
        logger.info("\nTop removed vibes:")
        for vibe, count in sorted(removed_vibes_counter.items(), key=lambda x: -x[1])[:20]:
            logger.info(f"  - {vibe}: {count} occurrences")

    if normalized_vibes_counter:
        logger.info("\nNormalized vibes:")
        for transformation, count in sorted(normalized_vibes_counter.items(), key=lambda x: -x[1]):
            logger.info(f"  - {transformation}: {count} occurrences")

    if args.dry_run:
        logger.info("\n*** DRY RUN - No changes were made to the database ***")
    else:
        logger.info("\n*** Cleanup complete ***")


if __name__ == "__main__":
    main()
