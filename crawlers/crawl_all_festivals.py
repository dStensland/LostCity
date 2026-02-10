#!/usr/bin/env python3
"""
Batch festival program enrichment.

Iterates over festivals and extracts rich program data (sessions, authors,
experiences) using the LLM-powered enrich_festival_program pipeline.

Usage:
    python crawl_all_festivals.py                     # Crawl all with websites
    python crawl_all_festivals.py --dry-run           # Preview without inserting
    python crawl_all_festivals.py --render-js         # Use Playwright
    python crawl_all_festivals.py --limit 10          # Cap number of festivals
    python crawl_all_festivals.py --upcoming-only     # Only festivals with future dates
    python crawl_all_festivals.py --min-sessions 5    # Skip festivals with 5+ sessions
    python crawl_all_festivals.py --simple             # Use old crawl_festival_schedule
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from datetime import date
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))

from db import get_client, get_source_by_slug, get_or_create_venue
from utils import setup_logging, slugify

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def _ensure_source_record(festival: dict) -> Optional[dict]:
    """Get or auto-create a minimal source record for a festival. Returns source dict."""
    source = get_source_by_slug(festival["slug"])
    if source:
        return source

    client = get_client()
    website = festival.get("website")
    if not website:
        return None

    # Check for URL overlap with existing active sources (dupe prevention)
    existing = (
        client.table("sources")
        .select("id,slug,name")
        .eq("url", website)
        .execute()
    )
    if existing.data:
        existing_slug = existing.data[0]["slug"]
        logger.warning(
            f"  SKIP source creation for {festival['slug']} — "
            f"URL already used by source '{existing_slug}'"
        )
        return None

    # Auto-create a minimal source record
    source_data = {
        "slug": festival["slug"],
        "name": festival["name"],
        "url": website,
        "source_type": "website",
        "integration_method": "llm",
        "is_active": False,  # Don't auto-run in regular pipeline
    }
    try:
        result = client.table("sources").insert(source_data).execute()
        logger.info(f"  Auto-created source record: {festival['slug']}")
        return result.data[0]
    except Exception as e:
        logger.warning(f"  Failed to create source record: {e}")
        return None


def _ensure_venue(festival: dict, source: dict) -> Optional[int]:
    """Resolve or create a venue for the festival. Returns venue_id."""
    # Check if source already has a venue
    venue_id = source.get("venue_id")
    if venue_id:
        return venue_id

    client = get_client()

    # Try to find venue by festival location name
    location = festival.get("location")
    if location:
        venue_slug = slugify(location)
        result = client.table("venues").select("id").eq("slug", venue_slug).execute()
        if result.data:
            return result.data[0]["id"]

        # Fuzzy search on key words
        words = [w for w in location.split() if len(w) > 3]
        if len(words) >= 2:
            pattern = f"%{words[0]}%{words[-1]}%"
            result = (
                client.table("venues")
                .select("id, name")
                .ilike("name", pattern)
                .limit(1)
                .execute()
            )
            if result.data:
                return result.data[0]["id"]

    # Try to find venue by festival name
    fest_venue_slug = slugify(festival["name"])
    result = client.table("venues").select("id").eq("slug", fest_venue_slug).execute()
    if result.data:
        return result.data[0]["id"]

    # Create a minimal venue from festival data
    venue_data = {
        "name": location or festival["name"],
        "slug": slugify(location or festival["name"]),
        "city": "Atlanta",
        "state": "GA",
        "venue_type": "event_space",
        "website": festival.get("website"),
    }
    try:
        return get_or_create_venue(venue_data)
    except Exception as e:
        logger.warning(f"  Failed to create venue: {e}")
        return None


def _count_existing_sessions(festival_slug: str) -> int:
    """Count events linked to this festival via series."""
    client = get_client()
    result = (
        client.table("series")
        .select("id")
        .eq("festival_id", festival_slug)
        .eq("series_type", "festival_program")
        .execute()
    )
    if not result.data:
        return 0

    series_id = result.data[0]["id"]
    count_result = (
        client.table("events")
        .select("id", count="exact")
        .eq("series_id", series_id)
        .execute()
    )
    return count_result.count or 0


def main():
    parser = argparse.ArgumentParser(description="Batch festival program enrichment")
    parser.add_argument("--dry-run", action="store_true", help="Preview without inserting")
    parser.add_argument("--render-js", action="store_true", help="Use Playwright for JS-heavy sites")
    parser.add_argument("--limit", type=int, default=0, help="Max festivals to process")
    parser.add_argument("--upcoming-only", action="store_true", help="Only festivals with future announced dates")
    parser.add_argument("--min-sessions", type=int, default=0, help="Skip festivals with N+ existing sessions")
    parser.add_argument("--simple", action="store_true", help="Use old crawl_festival_schedule instead of LLM enrichment")
    parser.add_argument("--verbose", action="store_true", help="Debug logging")
    args = parser.parse_args()

    setup_logging()
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    client = get_client()

    # Query festivals with websites
    query = (
        client.table("festivals")
        .select("slug,name,website,announced_start,announced_end,location,image_url,description,categories")
        .not_.is_("website", "null")
        .order("name")
    )

    result = query.execute()
    festivals = result.data or []

    if args.upcoming_only:
        today = date.today().isoformat()
        festivals = [
            f for f in festivals
            if f.get("announced_start") and f["announced_start"] >= today
        ]

    if args.limit:
        festivals = festivals[:args.limit]

    total = len(festivals)
    stats = {
        "total": total,
        "festivals_enriched": 0,
        "festivals_skipped_sessions": 0,
        "festivals_skipped_no_source": 0,
        "festivals_skipped_no_venue": 0,
        "festivals_failed": 0,
        "festivals_empty": 0,
        "total_sessions_found": 0,
        "total_sessions_inserted": 0,
        "total_authors_found": 0,
        "total_pages_crawled": 0,
        "llm_calls": 0,
    }

    mode_label = "SIMPLE" if args.simple else "LLM ENRICHMENT"
    logger.info(f"Festival Program Batch Enrichment")
    logger.info(f"{'=' * 70}")
    logger.info(f"Festivals to process: {total}")
    logger.info(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'} | {mode_label} | JS: {args.render_js}")
    if args.min_sessions:
        logger.info(f"Skipping festivals with {args.min_sessions}+ existing sessions")
    logger.info(f"{'=' * 70}\n")

    if args.simple:
        # Legacy path: use crawl_festival_schedule
        from crawl_festival_schedule import crawl_festival_schedule

        for i, f in enumerate(festivals, 1):
            slug = f["slug"]
            name = f["name"]
            website = f["website"]
            prefix = f"[{i:3d}/{total}] {name[:40]:<40}"

            try:
                found, new, skipped = crawl_festival_schedule(
                    slug=slug,
                    url=website,
                    render_js=args.render_js,
                    use_llm=False,
                    dry_run=args.dry_run,
                )
                stats["total_sessions_found"] += found
                stats["total_sessions_inserted"] += new
                if found > 0:
                    stats["festivals_enriched"] += 1
                    logger.info(f"{prefix} {found} found, {new} new, {skipped} dups")
                else:
                    stats["festivals_empty"] += 1
                    logger.info(f"{prefix} no schedule data")
            except Exception as e:
                stats["festivals_failed"] += 1
                logger.info(f"{prefix} FAILED: {str(e)[:60]}")

            time.sleep(1.0)
    else:
        # LLM enrichment path
        from enrich_festival_program import enrich_festival_program

        for i, f in enumerate(festivals, 1):
            slug = f["slug"]
            name = f["name"]
            prefix = f"[{i:3d}/{total}] {name[:40]:<40}"

            # Skip if already has enough sessions
            if args.min_sessions:
                existing = _count_existing_sessions(slug)
                if existing >= args.min_sessions:
                    stats["festivals_skipped_sessions"] += 1
                    logger.info(f"{prefix} SKIP ({existing} sessions exist)")
                    continue

            # Ensure source record exists
            source = _ensure_source_record(f)
            if not source:
                stats["festivals_skipped_no_source"] += 1
                logger.info(f"{prefix} SKIP (no source, no website)")
                continue

            # Ensure venue exists
            venue_id = _ensure_venue(f, source)
            if not venue_id:
                stats["festivals_skipped_no_venue"] += 1
                logger.info(f"{prefix} SKIP (no venue resolved)")
                continue

            try:
                enrichment_stats = enrich_festival_program(
                    slug=slug,
                    render_js=args.render_js,
                    dry_run=args.dry_run,
                )

                sessions_found = enrichment_stats.get("sessions_found", 0)
                sessions_inserted = enrichment_stats.get("sessions_inserted", 0)
                authors_found = enrichment_stats.get("authors_found", 0)
                pages_crawled = enrichment_stats.get("pages_crawled", 0)

                stats["total_sessions_found"] += sessions_found
                stats["total_sessions_inserted"] += sessions_inserted
                stats["total_authors_found"] += authors_found
                stats["total_pages_crawled"] += pages_crawled
                # Each page with LLM extraction = ~1 LLM call
                stats["llm_calls"] += pages_crawled

                if sessions_found > 0 or authors_found > 0:
                    stats["festivals_enriched"] += 1
                    logger.info(
                        f"{prefix} {sessions_found} sessions ({sessions_inserted} new), "
                        f"{authors_found} authors, {pages_crawled} pages"
                    )
                else:
                    stats["festivals_empty"] += 1
                    logger.info(f"{prefix} no program data found")

            except ValueError as e:
                stats["festivals_failed"] += 1
                logger.info(f"{prefix} FAILED: {str(e)[:60]}")
            except Exception as e:
                stats["festivals_failed"] += 1
                logger.info(f"{prefix} FAILED: {str(e)[:60]}")

            # Longer sleep between LLM-enriched festivals (rate limiting)
            time.sleep(3.0)

    # Summary
    logger.info(f"\n{'=' * 70}")
    logger.info(f"RESULTS")
    logger.info(f"{'=' * 70}")
    logger.info(f"Festivals processed:  {stats['total']}")
    logger.info(f"With data:            {stats['festivals_enriched']}")
    logger.info(f"Empty (no data):      {stats['festivals_empty']}")
    logger.info(f"Failed:               {stats['festivals_failed']}")
    if not args.simple:
        logger.info(f"Skipped (sessions):   {stats['festivals_skipped_sessions']}")
        logger.info(f"Skipped (no source):  {stats['festivals_skipped_no_source']}")
        logger.info(f"Skipped (no venue):   {stats['festivals_skipped_no_venue']}")
    logger.info(f"Sessions found:       {stats['total_sessions_found']}")
    logger.info(f"Sessions inserted:    {stats['total_sessions_inserted']}")
    if not args.simple:
        logger.info(f"Authors found:        {stats['total_authors_found']}")
        logger.info(f"Pages crawled:        {stats['total_pages_crawled']}")
        logger.info(f"LLM calls (~):        {stats['llm_calls']}")
    if args.dry_run:
        logger.info(f"\nDRY RUN — no data written to database")


if __name__ == "__main__":
    main()
