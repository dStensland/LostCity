#!/usr/bin/env python3
"""
Lost City Crawler - Main entry point.
Orchestrates crawling, extraction, and storage of event data.
"""

import argparse
import logging
import sys
from importlib import import_module
from typing import Optional

from config import get_config
from db import get_active_sources, get_source_by_slug, create_crawl_log, update_crawl_log
from utils import setup_logging, slugify

logger = logging.getLogger(__name__)


# Map source slugs to their crawler modules
SOURCE_MODULES = {
    "eventbrite": "sources.eventbrite",
    "terminal-west": "sources.terminal_west",
    "the-earl": "sources.the_earl",
    "dads-garage": "sources.dads_garage",
    "atlanta-botanical-garden": "sources.atlanta_botanical",
    "high-museum": "sources.high_museum",
    "ticketmaster": "sources.ticketmaster",
    # Phase 1 - Critical Aggregators
    "gwcc": "sources.gwcc",
    "hands-on-atlanta": "sources.hands_on_atlanta",
    "discover-atlanta": "sources.discover_atlanta",
    # Phase 2 - High-Volume Aggregators
    "access-atlanta": "sources.access_atlanta",
    "fancons": "sources.fancons",
    "10times": "sources.tentimes",
    "beltline": "sources.beltline",
    # Phase 3 - Major Venues
    "eddies-attic": "sources.eddies_attic",
    "smiths-olde-bar": "sources.smiths_olde_bar",
    "city-winery-atlanta": "sources.city_winery",
    "laughing-skull": "sources.laughing_skull",
    "punchline": "sources.punchline",
    "atlanta-ballet": "sources.atlanta_ballet",
    "atlanta-opera": "sources.atlanta_opera",
    "puppetry-arts": "sources.puppetry_arts",
    # Film - Cinemas & Festivals
    "plaza-theatre": "sources.plaza_theatre",
    "tara-theatre": "sources.tara_theatre",
    "landmark-midtown": "sources.landmark_midtown",
    "atlanta-film-festival": "sources.atlanta_film_festival",
    "out-on-film": "sources.out_on_film",
    "ajff": "sources.ajff",
    "atlanta-film-society": "sources.atlanta_film_society",
    "atlanta-film-series": "sources.atlanta_film_series",
    "buried-alive": "sources.buried_alive",
}


def run_crawler(source: dict) -> tuple[int, int, int]:
    """
    Run crawler for a single source.

    Args:
        source: Source record from database

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    slug = source["slug"]

    if slug not in SOURCE_MODULES:
        logger.warning(f"No crawler implemented for source: {slug}")
        return 0, 0, 0

    try:
        module = import_module(SOURCE_MODULES[slug])
        return module.crawl(source)
    except ImportError as e:
        logger.error(f"Failed to import crawler module for {slug}: {e}")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Crawler failed for {slug}: {e}")
        raise


def run_source(slug: str) -> bool:
    """
    Run crawler for a specific source by slug.

    Args:
        slug: Source slug to crawl

    Returns:
        True if successful, False otherwise
    """
    source = get_source_by_slug(slug)

    if not source:
        logger.error(f"Source not found: {slug}")
        return False

    if not source["is_active"]:
        logger.warning(f"Source is not active: {slug}")
        return False

    logger.info(f"Starting crawl for: {source['name']}")
    log_id = create_crawl_log(source["id"])

    try:
        found, new, updated = run_crawler(source)
        update_crawl_log(
            log_id,
            status="success",
            events_found=found,
            events_new=new,
            events_updated=updated
        )
        logger.info(
            f"Completed {source['name']}: "
            f"{found} found, {new} new, {updated} updated"
        )
        return True

    except Exception as e:
        update_crawl_log(log_id, status="error", error_message=str(e))
        logger.error(f"Failed {source['name']}: {e}")
        return False


def run_all_sources() -> dict[str, bool]:
    """
    Run crawlers for all active sources.

    Returns:
        Dict mapping source slug to success status
    """
    sources = get_active_sources()
    results = {}

    logger.info(f"Running crawlers for {len(sources)} active sources")

    for source in sources:
        slug = source["slug"]
        results[slug] = run_source(slug)

    # Summary
    success = sum(1 for v in results.values() if v)
    failed = len(results) - success
    logger.info(f"Crawl complete: {success} succeeded, {failed} failed")

    return results


def main():
    """Main entry point."""
    setup_logging()

    parser = argparse.ArgumentParser(
        description="Lost City Event Crawler",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--source", "-s",
        help="Specific source slug to crawl (default: all active sources)"
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List available sources and exit"
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Fetch and extract but don't save to database"
    )

    args = parser.parse_args()

    if args.list:
        sources = get_active_sources()
        print("\nActive sources:")
        for source in sources:
            implemented = "✓" if source["slug"] in SOURCE_MODULES else "✗"
            print(f"  [{implemented}] {source['slug']}: {source['name']}")
        print(f"\nTotal: {len(sources)} sources")
        return 0

    if args.source:
        success = run_source(args.source)
        return 0 if success else 1
    else:
        results = run_all_sources()
        failed = sum(1 for v in results.values() if not v)
        return 1 if failed > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
