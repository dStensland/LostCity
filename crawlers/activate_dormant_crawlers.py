"""
Activate dormant crawlers that are ready to run.

Two operations:
1. Reactivate existing inactive source records (is_active = false → true)
2. Create new source records for crawlers with no DB entry

Usage:
    cd crawlers/
    python activate_dormant_crawlers.py [--dry-run]
"""

from __future__ import annotations
import argparse
import logging

from db import get_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ============================================================================
# TIER 1: Reactivate existing inactive records
# ============================================================================

REACTIVATE_SLUGS = [
    # Comedy / Improv (biggest content gap)
    "whole-world-improv",
    "uptown-comedy",
    # Music venues with residencies
    "blind-willies",
    "venkmans",
    "529",
    "city-winery-atlanta",
    # Fitness / Wellness
    "highland-yoga",
    "vista-yoga",
    "yonder-yoga",
    "forward-warrior",
    # Breweries
    "orpheus-brewing",
    "pontoon-brewing",
    "three-taverns",
    "second-self-brewing",
    # ITP bar destinations (venue-only crawlers, fill neighborhood coverage)
    "the-porter",          # Little Five Points
    "elmyr",               # Little Five Points
    "criminal-records",    # Little Five Points
    "church-atlanta",      # Little Five Points
    "the-vortex",          # Little Five Points
    "nonis",               # Edgewood
    "mother-bar",          # Edgewood
    "church-bar",          # Edgewood
    "joystick-gamebar",    # Edgewood
    "flatiron",            # East Atlanta
    "the-glenwood",        # East Atlanta
    "midway-pub",          # East Atlanta Village
    "moes-and-joes",       # Virginia-Highland
    "atkins-park",         # Virginia-Highland
    "bookhouse-pub",       # Poncey-Highland
    "sidebar",             # Downtown
    "der-biergarten",      # Downtown
    "johnnys-hideaway",    # Buckhead
    "bulldogs-atlanta",    # Midtown
    "the-square-pub",      # Decatur
    "brick-store-pub",     # Decatur
    "leons-full-service",  # Decatur
    "victory-sandwich-bar",  # Inman Park
    "wrecking-bar",        # Inman Park
    "northside-tavern",    # West Midtown
]

# ============================================================================
# TIER 2: Create new source records
# ============================================================================

NEW_SOURCES = [
    # Entertainment venues
    {"slug": "seven-stages", "name": "7 Stages", "source_type": "venue", "crawl_frequency": "daily"},
    {"slug": "the-bakery", "name": "The Bakery", "source_type": "venue", "crawl_frequency": "daily"},
    {"slug": "southern-feedstore", "name": "Southern Feedstore", "source_type": "venue", "crawl_frequency": "daily"},
    {"slug": "goat-farm", "name": "Goat Farm Arts Center", "source_type": "venue", "crawl_frequency": "daily"},
    {"slug": "illuminarium", "name": "Illuminarium Atlanta", "source_type": "venue", "crawl_frequency": "daily"},
    {"slug": "gateway-center-arena", "name": "Gateway Center Arena", "source_type": "venue", "crawl_frequency": "daily"},
    {"slug": "trap-music-museum", "name": "Trap Music Museum", "source_type": "venue", "crawl_frequency": "weekly"},
    # Craft / Workshop studios
    {"slug": "all-fired-up", "name": "All Fired Up Art Studio", "source_type": "venue", "crawl_frequency": "daily"},
    {"slug": "candlelit-atl", "name": "Candlelit ATL", "source_type": "venue", "crawl_frequency": "daily"},
    {"slug": "ellis-station", "name": "Ellis Station Candle Co", "source_type": "venue", "crawl_frequency": "daily"},
    {"slug": "the-craftivist", "name": "The Craftivist", "source_type": "venue", "crawl_frequency": "daily"},
    {"slug": "beehive-atl", "name": "The Beehive ATL", "source_type": "venue", "crawl_frequency": "daily"},
    # Venue-only destinations
    {"slug": "barcelona-wine-bar", "name": "Barcelona Wine Bar", "source_type": "venue", "crawl_frequency": "weekly"},
    {"slug": "sweetwater-brewery", "name": "SweetWater Brewing Company", "source_type": "venue", "crawl_frequency": "weekly"},
    {"slug": "two-urban-licks", "name": "Two Urban Licks", "source_type": "venue", "crawl_frequency": "weekly"},
    {"slug": "village-corner", "name": "Village Corner German Restaurant", "source_type": "venue", "crawl_frequency": "weekly"},
]


def activate(dry_run: bool = False) -> None:
    client = get_client()
    
    # --- Tier 1: Reactivate ---
    reactivated = 0
    for slug in REACTIVATE_SLUGS:
        if dry_run:
            logger.info(f"[DRY RUN] Would reactivate: {slug}")
            reactivated += 1
            continue
        try:
            result = (
                client.table("sources")
                .update({"is_active": True})
                .eq("slug", slug)
                .eq("is_active", False)
                .execute()
            )
            if result.data:
                reactivated += 1
                logger.info(f"Reactivated: {slug}")
            else:
                logger.debug(f"No change for {slug} (already active or not found)")
        except Exception as exc:
            logger.error(f"Failed to reactivate {slug}: {exc}")

    # --- Tier 2: Create new records ---
    created = 0
    for source in NEW_SOURCES:
        if dry_run:
            logger.info(f"[DRY RUN] Would create: {source['slug']} ({source['name']})")
            created += 1
            continue
        try:
            # Check if already exists
            existing = (
                client.table("sources")
                .select("id")
                .eq("slug", source["slug"])
                .execute()
            )
            if existing.data:
                logger.debug(f"Already exists: {source['slug']}")
                continue

            record = {
                "slug": source["slug"],
                "name": source["name"],
                "source_type": source.get("source_type", "venue"),
                "crawl_frequency": source.get("crawl_frequency", "daily"),
                "is_active": True,
                "url": "",
            }
            client.table("sources").insert(record).execute()
            created += 1
            logger.info(f"Created: {source['slug']} ({source['name']})")
        except Exception as exc:
            logger.error(f"Failed to create {source['slug']}: {exc}")

    logger.info(
        f"Activation complete: {reactivated} reactivated, {created} created"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Activate dormant crawlers")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()
    activate(dry_run=args.dry_run)
