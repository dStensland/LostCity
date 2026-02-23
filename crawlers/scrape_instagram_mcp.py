#!/usr/bin/env python3
"""
MCP Chrome Instagram post scraping helper.

This script supports targeted IG scraping via Claude-in-Chrome MCP tools for
high-value venues where Playwright headless fails (anti-bot detection).

Since MCP browser automation is driven by the Claude Code agent (not this script),
this provides:

1. `get_targets()` — Returns prioritized list of high-value venues from ig_targets.json
2. `process_venue_screenshots(venue_id, screenshot_paths, dry_run)` — Takes
   screenshots captured by Claude-in-Chrome, runs them through GPT-4o vision
   extraction, and writes specials/events/vibes to DB

MCP Chrome workflow (driven by Claude Code):
1. Open Instagram in real Chrome browser (authenticated session)
2. Navigate to venue profile
3. Screenshot the grid / individual posts
4. Pass screenshots to process_venue_screenshots()

Usage:
    # Show target list
    python3 scrape_instagram_mcp.py --list-targets

    # Process screenshots for a venue
    python3 scrape_instagram_mcp.py --venue-id 123 --screenshots /tmp/ig_*.png --dry-run

    # Process with verbose output
    python3 scrape_instagram_mcp.py --venue-id 123 --screenshots /tmp/shot1.png /tmp/shot2.png --verbose
"""

import argparse
import base64
import json
import logging
import sys
from pathlib import Path
from typing import Optional

env_path = Path(__file__).parent.parent / ".env"
from dotenv import load_dotenv
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client
from scrape_instagram_specials import (
    extract_from_images,
    upsert_specials,
    insert_events,
    update_venue_vibes,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"
TARGETS_FILE = DATA_DIR / "ig_targets.json"


def get_targets() -> list[dict]:
    """Load the curated list of high-value IG targets from ig_targets.json.

    Returns list of dicts with keys: venue_name, neighborhood, instagram
    """
    if not TARGETS_FILE.exists():
        logger.error(f"Targets file not found: {TARGETS_FILE}")
        return []

    with open(TARGETS_FILE) as f:
        data = json.load(f)

    return data.get("targets", [])


def _resolve_venue(venue_id: Optional[int] = None, instagram: Optional[str] = None) -> Optional[dict]:
    """Look up a venue by ID or Instagram handle."""
    client = get_client()

    if venue_id:
        result = client.table("venues").select(
            "id, name, slug, instagram, venue_type, website"
        ).eq("id", venue_id).execute()
    elif instagram:
        result = client.table("venues").select(
            "id, name, slug, instagram, venue_type, website"
        ).eq("instagram", instagram).execute()
    else:
        return None

    return result.data[0] if result.data else None


def _load_screenshots_as_data_uris(paths: list[str]) -> list[str]:
    """Load screenshot files from disk and convert to base64 data URIs."""
    data_uris = []
    for path_str in paths:
        path = Path(path_str)
        if not path.exists():
            logger.warning(f"  Screenshot not found: {path}")
            continue

        suffix = path.suffix.lower()
        mime = "image/png" if suffix == ".png" else "image/jpeg"

        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        data_uris.append(f"data:{mime};base64,{b64}")
        logger.debug(f"  Loaded: {path.name} ({len(b64) // 1024}KB)")

    return data_uris


def process_venue_screenshots(
    venue_id: int,
    screenshot_paths: list[str],
    dry_run: bool = False,
    verbose: bool = False,
) -> dict:
    """Process screenshots captured by Claude-in-Chrome MCP tools.

    Takes screenshot file paths, loads them as base64 data URIs, runs them through
    GPT-4o vision extraction (reusing extract_from_images from scrape_instagram_specials),
    and writes specials/events/vibes to DB.

    Returns stats dict with keys: specials_added, events_added, vibes_updated
    """
    stats = {"specials_added": 0, "events_added": 0, "vibes_updated": False}

    # Resolve venue
    venue = _resolve_venue(venue_id=venue_id)
    if not venue:
        logger.error(f"Venue {venue_id} not found in database")
        return stats

    handle = venue.get("instagram", "unknown")
    logger.info(f"Processing screenshots for {venue['name']} (@{handle})")

    # Load screenshots as data URIs
    data_uris = _load_screenshots_as_data_uris(screenshot_paths)
    if not data_uris:
        logger.error("No valid screenshots loaded")
        return stats

    logger.info(f"  Loaded {len(data_uris)} screenshots")

    # Extract via GPT-4o vision
    data = extract_from_images(data_uris, venue["name"])
    if data is None:
        logger.error("  Vision LLM extraction failed")
        return stats

    specials = data.get("specials", [])
    events = data.get("events", [])
    vibes = data.get("vibes", [])

    if not specials and not events and not vibes:
        logger.info("  Nothing actionable found in screenshots")
        return stats

    # Report and write specials
    if specials:
        for s in specials:
            days_str = ", ".join(s.get("days") or ["any day"])
            logger.info(f"  [special] {s.get('title', '?')} ({days_str})")
        count = upsert_specials(venue_id, handle, specials, dry_run=dry_run)
        stats["specials_added"] = count

    # Report and write events
    if events:
        for ev in events:
            logger.info(f"  [event] {ev.get('title', '?')} ({ev.get('date', '?')})")
        count = insert_events(venue, handle, events, dry_run=dry_run)
        stats["events_added"] = count

    # Update vibes
    if vibes:
        logger.info(f"  [vibes] {', '.join(vibes)}")
        stats["vibes_updated"] = update_venue_vibes(venue_id, vibes, dry_run=dry_run)

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="MCP Chrome Instagram helper — process screenshots or list targets"
    )
    parser.add_argument("--list-targets", action="store_true", help="Show the curated list of high-value IG targets")
    parser.add_argument("--venue-id", type=int, help="Venue ID to process screenshots for")
    parser.add_argument("--screenshots", nargs="+", help="Paths to screenshot files captured by MCP Chrome")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to database")
    parser.add_argument("--verbose", action="store_true", help="Show debug output")
    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    if args.list_targets:
        targets = get_targets()
        if not targets:
            logger.info("No targets found")
            return

        logger.info(f"{'#':<4} {'Venue':<30} {'Handle':<25} {'Neighborhood':<20}")
        logger.info("-" * 80)
        for i, t in enumerate(targets, 1):
            logger.info(f"{i:<4} {t['venue_name']:<30} @{t['instagram']:<24} {t['neighborhood']:<20}")

        # Check which targets have venue records and IG handles in DB
        client = get_client()
        handles = [t["instagram"] for t in targets]
        result = client.table("venues").select("id, instagram").in_("instagram", handles).execute()
        db_handles = {r["instagram"] for r in (result.data or [])}
        matched = sum(1 for t in targets if t["instagram"] in db_handles)

        logger.info(f"\n{matched}/{len(targets)} targets found in venues DB")
        return

    if args.venue_id and args.screenshots:
        stats = process_venue_screenshots(
            venue_id=args.venue_id,
            screenshot_paths=args.screenshots,
            dry_run=args.dry_run,
            verbose=args.verbose,
        )
        logger.info("=" * 40)
        logger.info(f"Results: {stats['specials_added']} specials, {stats['events_added']} events, vibes={'yes' if stats['vibes_updated'] else 'no'}")
        return

    parser.print_help()


if __name__ == "__main__":
    main()
