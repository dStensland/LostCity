"""
Clean up venue vibes in the database.

Uses the canonical VALID_VIBES from tags.py as the single source of truth.
Normalizes non-canonical vibes to canonical ones where possible, converts
activity-type vibes to venue genres, and removes everything else.

Usage:
    # Dry run (show changes without applying them)
    python3 scripts/cleanup_vibes.py --dry-run

    # Apply changes to database
    python3 scripts/cleanup_vibes.py
"""

from __future__ import annotations

import sys
import os
import argparse
import logging
from typing import Dict, List, Optional, Set, Tuple
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client
from tags import VALID_VIBES
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Normalization map: non-canonical vibe -> canonical vibe
VIBE_NORMALIZATION: Dict[str, str] = {
    # Atmosphere synonyms
    "chill": "casual",
    "cozy": "intimate",
    "gritty": "divey",
    "eclectic": "artsy",
    "laid-back": "casual",
    "quirky": "artsy",
    "vintage": "historic",
    "classic": "historic",
    "industrial": "artsy",
    "bohemian": "artsy",
    "creative": "artsy",
    "indie": "artsy",
    # Scene → canonical
    "dive-bar": "divey",
    "dive": "divey",
    "dive-y": "divey",
    "hole-in-the-wall": "divey",
    "boutique": "upscale",
    # Social synonyms
    "romantic-ambiance": "date-spot",
    "romantic": "date-spot",
    "date-friendly": "date-spot",
    "date-night": "date-spot",
    "group-friendly": "good-for-groups",
    "groups": "good-for-groups",
    "group-hangout": "good-for-groups",
    "group-activity": "good-for-groups",
    "family": "family-friendly",
    "kid-friendly": "family-friendly",
    "kids": "family-friendly",
    "lgbtq": "lgbtq-friendly",
    "queer-friendly": "lgbtq-friendly",
    "gay-bar": "lgbtq-friendly",
    # Feature synonyms
    "cocktails": "craft-cocktails",
    "outdoor": "outdoor-seating",
    "patio-dining": "patio",
    "late-night-eats": "late-night",
    "parking": "free-parking",
    "lively-energy": "casual",
    "cozy-atmosphere": "intimate",
    # Ownership near-synonyms
    "local": "casual",  # "local" is too vague for a vibe
    "locally-owned": "casual",  # not in canonical, closest match
}

# Activity vibes that should be converted to venue genres instead
VIBE_TO_GENRE: Dict[str, str] = {
    "dj": "dj",
    "karaoke": "karaoke",
    "trivia": "trivia",
    "games": "game-night",
    "game-night": "game-night",
    "dancing": "dance-party",
    "craft-beer": "beer",
    "natural-wine": "wine",
    "paint-and-sip": "painting",
    "escape-room": "escape-room",
    "brunch": "brunch",
    "happy-hour": "happy-hour",
    "open-mic": "open-mic",
    "poetry-slam": "poetry",
    "bingo": "bingo",
    "pool": "pool",
    "darts": "darts",
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
    "speakeasy",
    # Activities that don't map to genres
    "roller-derby", "roller-skating", "women-sports", "live-sports", "sports",
    # Meaningless/generic
    "unique", "curator-vetted", "community-focused", "community", "cars", "entertainment",
    "venue", "events", "fun", "exciting", "amazing", "popular", "trendy", "vibrant",
    "lively", "modern", "high-energy", "rowdy",
    "neighborhood-spot", "destination", "hidden-gem", "local-favorite", "tourist-friendly",
    "locals-hangout", "solo-friendly",
    "good-coffee", "cheap-eats", "free-wifi", "valet", "24-hour", "byob",
    "hands-on", "workshop", "interactive", "educational", "browsing", "treasure-hunting",
    "veteran-owned",
    "iconic", "tours", "comics", "records", "vinyl", "antiques", "boutique",
    # Editorial/list-specific tags
    "atlanta-institution", "nashville-institution", "eater-nashville-38",
    "eater-atlanta-38", "michelin", "best-of", "top-rated", "award-winning",
}


def normalize_vibe(vibe: str) -> Tuple[str, str, Optional[str]]:
    """
    Normalize a single vibe.

    Returns:
        Tuple of (normalized_vibe, action, genre_value) where:
        - action: "keep", "normalize", "to_genre", or "remove"
        - genre_value: if action is "to_genre", the genre slug to add
    """
    vibe = vibe.strip().lower()

    # Check if it should be normalized to a different vibe
    if vibe in VIBE_NORMALIZATION:
        target = VIBE_NORMALIZATION[vibe]
        if target in VALID_VIBES:
            return target, "normalize", None
        else:
            return vibe, "remove", None

    # Check if it should be converted to a genre
    if vibe in VIBE_TO_GENRE:
        return vibe, "to_genre", VIBE_TO_GENRE[vibe]

    # Check if it's explicitly invalid
    if vibe in INVALID_VIBES:
        return vibe, "remove", None

    # Check if it's in the canonical valid list
    if vibe in VALID_VIBES:
        return vibe, "keep", None

    # Unknown vibe - remove to be safe
    return vibe, "remove", None


def clean_venue_vibes(vibes: List[str]) -> Tuple[List[str], List[str], Dict[str, int]]:
    """
    Clean a venue's vibes array.

    Returns:
        Tuple of (cleaned_vibes, new_genres, action_counts)
    """
    if not vibes:
        return [], [], {"kept": 0, "normalized": 0, "to_genre": 0, "removed": 0}

    cleaned = []
    new_genres = []
    seen_vibes = set()
    seen_genres = set()
    action_counts = {"kept": 0, "normalized": 0, "to_genre": 0, "removed": 0}

    for vibe in vibes:
        if not vibe or not isinstance(vibe, str):
            continue

        normalized, action, genre_value = normalize_vibe(vibe)

        if action == "remove":
            action_counts["removed"] += 1
            continue

        if action == "to_genre":
            action_counts["to_genre"] += 1
            if genre_value and genre_value not in seen_genres:
                seen_genres.add(genre_value)
                new_genres.append(genre_value)
            continue

        if action == "normalize":
            action_counts["normalized"] += 1
        else:
            action_counts["kept"] += 1

        if normalized not in seen_vibes:
            seen_vibes.add(normalized)
            cleaned.append(normalized)

    cleaned.sort()
    new_genres.sort()

    return cleaned, new_genres, action_counts


def update_venue_with_retry(client, venue_id: int, new_vibes: List[str], new_genres: Optional[List[str]], max_retries: int = 3) -> bool:
    """Update a venue's vibes (and optionally genres) with retry logic."""
    for attempt in range(max_retries):
        try:
            updates: dict = {"vibes": new_vibes or None}
            if new_genres is not None:
                updates["genres"] = new_genres or None
            client.table("venues").update(updates).eq("id", venue_id).execute()
            return True
        except Exception as e:
            error_msg = str(e).lower()
            if "connection" in error_msg or "timeout" in error_msg:
                if attempt < max_retries - 1:
                    logger.debug(f"Connection error on venue {venue_id}, retrying (attempt {attempt + 1}/{max_retries})")
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

    # Fetch all active venues with vibes (include genres for merging)
    result = client.table("venues").select("id,name,vibes,genres").not_.is_("vibes", "null").execute()
    venues = result.data

    logger.info(f"Found {len(venues)} venues with vibes")

    # Track statistics
    total_venues_processed = 0
    total_venues_updated = 0
    total_vibes_kept = 0
    total_vibes_normalized = 0
    total_vibes_to_genre = 0
    total_vibes_removed = 0

    removed_vibes_counter = defaultdict(int)
    normalized_vibes_counter = defaultdict(int)
    genre_conversion_counter = defaultdict(int)

    for idx, venue in enumerate(venues, 1):
        venue_id = venue["id"]
        venue_name = venue["name"]
        original_vibes = venue.get("vibes") or []
        existing_genres = venue.get("genres") or []

        if not original_vibes:
            continue

        total_venues_processed += 1

        cleaned_vibes, new_genres, action_counts = clean_venue_vibes(original_vibes)

        # Track changes for reporting
        for vibe in original_vibes:
            if not vibe:
                continue
            _, action, genre_value = normalize_vibe(vibe)
            if action == "remove":
                removed_vibes_counter[vibe] += 1
            elif action == "normalize":
                target = VIBE_NORMALIZATION[vibe]
                normalized_vibes_counter[f"{vibe} -> {target}"] += 1
            elif action == "to_genre" and genre_value:
                genre_conversion_counter[f"{vibe} -> genre:{genre_value}"] += 1

        total_vibes_kept += action_counts["kept"]
        total_vibes_normalized += action_counts["normalized"]
        total_vibes_to_genre += action_counts["to_genre"]
        total_vibes_removed += action_counts["removed"]

        # Merge new genres with existing
        merged_genres = None
        if new_genres:
            all_genres = list(set(existing_genres + new_genres))
            all_genres.sort()
            if all_genres != existing_genres:
                merged_genres = all_genres

        # Check if anything changed
        vibes_changed = cleaned_vibes != original_vibes
        genres_changed = merged_genres is not None

        if vibes_changed or genres_changed:
            total_venues_updated += 1

            if args.dry_run:
                if vibes_changed:
                    logger.debug(
                        f"[{idx}/{len(venues)}] Would update vibes for {venue_name}: "
                        f"{original_vibes} -> {cleaned_vibes}"
                    )
                if genres_changed:
                    logger.debug(
                        f"[{idx}/{len(venues)}] Would add genres for {venue_name}: "
                        f"{existing_genres} -> {merged_genres}"
                    )
            else:
                success = update_venue_with_retry(
                    client, venue_id, cleaned_vibes,
                    merged_genres if genres_changed else None
                )
                if success:
                    logger.debug(
                        f"[{idx}/{len(venues)}] Updated {venue_name} (ID: {venue_id}): "
                        f"{len(original_vibes)} vibes -> {len(cleaned_vibes)} vibes"
                    )
                else:
                    logger.error(f"Failed to update venue {venue_id}")

    # Print summary
    logger.info("\n" + "=" * 80)
    logger.info("CLEANUP SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Total venues processed: {total_venues_processed}")
    logger.info(f"Venues updated: {total_venues_updated}")
    logger.info(f"Vibes kept: {total_vibes_kept}")
    logger.info(f"Vibes normalized: {total_vibes_normalized}")
    logger.info(f"Vibes converted to genres: {total_vibes_to_genre}")
    logger.info(f"Vibes removed: {total_vibes_removed}")

    if removed_vibes_counter:
        logger.info("\nTop removed vibes:")
        for vibe, count in sorted(removed_vibes_counter.items(), key=lambda x: -x[1])[:20]:
            logger.info(f"  - {vibe}: {count} occurrences")

    if normalized_vibes_counter:
        logger.info("\nNormalized vibes:")
        for transformation, count in sorted(normalized_vibes_counter.items(), key=lambda x: -x[1]):
            logger.info(f"  - {transformation}: {count} occurrences")

    if genre_conversion_counter:
        logger.info("\nConverted to genres:")
        for transformation, count in sorted(genre_conversion_counter.items(), key=lambda x: -x[1]):
            logger.info(f"  - {transformation}: {count} occurrences")

    if args.dry_run:
        logger.info("\n*** DRY RUN - No changes were made to the database ***")
    else:
        logger.info("\n*** Cleanup complete ***")


if __name__ == "__main__":
    main()
