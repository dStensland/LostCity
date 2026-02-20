#!/usr/bin/env python3
"""
Master script to import all curated venues and hydrate with Foursquare data.

Usage:
    python import_all_venues.py              # Add venues + hydrate
    python import_all_venues.py --import     # Only import venues
    python import_all_venues.py --hydrate    # Only hydrate existing
    python import_all_venues.py --dry-run    # Preview without changes
"""

import argparse
import subprocess
import sys
import os
import logging

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Get the directory where this script lives
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def run_script(name: str, dry_run: bool = False):
    """Run a Python script in the crawlers directory."""
    script_path = os.path.join(SCRIPT_DIR, name)

    if not os.path.exists(script_path):
        logger.warning(f"  Script not found: {name}")
        return False

    cmd = [sys.executable, script_path]
    if dry_run and name == "hydrate_venues_foursquare.py":
        cmd.append("--dry-run")

    try:
        result = subprocess.run(cmd, cwd=SCRIPT_DIR)
        return result.returncode == 0
    except Exception as e:
        logger.error(f"  Error running {name}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Import and hydrate Atlanta venues")
    parser.add_argument("--import-only", action="store_true", help="Only import venues, don't hydrate")
    parser.add_argument("--hydrate-only", action="store_true", help="Only hydrate existing venues")
    parser.add_argument("--dry-run", action="store_true", help="Preview without making changes")
    parser.add_argument("--limit", type=int, default=100, help="Limit venues to hydrate")
    args = parser.parse_args()

    logger.info("")
    logger.info("=" * 70)
    logger.info("   LOSTCITY VENUE IMPORT & HYDRATION")
    logger.info("=" * 70)
    logger.info("")

    # Import phase
    if not args.hydrate_only:
        logger.info("PHASE 1: IMPORTING CURATED VENUES")
        logger.info("-" * 70)

        import_scripts = [
            ("Eater Atlanta (restaurants, bars, cocktails)", "add_eater_venues.py"),
            ("Coffee Shops", "add_coffee_shops.py"),
            ("Breweries & Nightlife", "add_breweries_nightlife.py"),
            ("Parks, Music Venues, Makers", "add_venues.py"),
            ("Major Atlanta Hotels (destinations)", "import_major_atlanta_hotels_destinations.py"),
        ]

        for description, script in import_scripts:
            logger.info(f"\n>>> {description}")
            run_script(script, args.dry_run)

        logger.info("")

    # Hydration phase
    if not args.import_only:
        logger.info("PHASE 2: HYDRATING WITH FOURSQUARE DATA")
        logger.info("-" * 70)

        foursquare_key = os.environ.get("FOURSQUARE_API_KEY")
        if not foursquare_key:
            logger.warning("")
            logger.warning("⚠️  FOURSQUARE_API_KEY not set!")
            logger.warning("   Set it to hydrate venues with hours, photos, etc.")
            logger.warning("   export FOURSQUARE_API_KEY='your-key-here'")
            logger.warning("")
        else:
            # Build hydration command
            cmd = [
                sys.executable,
                os.path.join(SCRIPT_DIR, "hydrate_venues_foursquare.py"),
                "--limit", str(args.limit),
            ]
            if args.dry_run:
                cmd.append("--dry-run")

            logger.info(f"\nHydrating up to {args.limit} venues...")
            subprocess.run(cmd, cwd=SCRIPT_DIR)

    logger.info("")
    logger.info("=" * 70)
    logger.info("   COMPLETE")
    logger.info("=" * 70)
    logger.info("")

    if not args.import_only and not args.dry_run:
        logger.info("Next steps:")
        logger.info("  1. Review venues in the database")
        logger.info("  2. Run again to hydrate more venues: python import_all_venues.py --hydrate-only --limit 200")
        logger.info("  3. Manually curate any missing data")
        logger.info("")


if __name__ == "__main__":
    main()
