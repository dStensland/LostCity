#!/usr/bin/env python3
"""
Hydrate venue hours from Foursquare Places API.

This script specifically targets venues that already have a foursquare_id
but are missing hours. It uses the details endpoint with conservative
rate limiting to avoid 429 errors.

Usage:
    python hydrate_hours_foursquare.py --limit 30
    python hydrate_hours_foursquare.py --venue-type bar --limit 20
    python hydrate_hours_foursquare.py --dry-run
"""

import os
import sys
import time
import logging
import argparse
import requests
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from db import get_client
from hours_utils import format_hours_display, prepare_hours_update, should_update_hours

# Load .env file from project root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

FOURSQUARE_API_KEY = os.environ.get("FOURSQUARE_API_KEY", "")

# New Foursquare API endpoint
FOURSQUARE_API_BASE = "https://places-api.foursquare.com"
FOURSQUARE_API_VERSION = "2025-06-17"


def get_foursquare_hours(fsq_id: str) -> tuple[Optional[dict], Optional[str]]:
    """Get hours from Foursquare details endpoint."""
    if not FOURSQUARE_API_KEY or not fsq_id:
        return None, None

    try:
        response = requests.get(
            f"{FOURSQUARE_API_BASE}/places/{fsq_id}",
            params={"fields": "hours"},
            headers={
                "Authorization": f"Bearer {FOURSQUARE_API_KEY}",
                "Accept": "application/json",
                "X-Places-Api-Version": FOURSQUARE_API_VERSION,
            },
            timeout=10,
        )

        if response.status_code == 429:
            logger.warning("  Rate limited - waiting 30 seconds...")
            time.sleep(30)
            return None, None

        response.raise_for_status()
        data = response.json()

        hours_data = data.get("hours")
        if hours_data:
            return parse_foursquare_hours(hours_data)
        return None, None

    except Exception as e:
        logger.debug(f"Foursquare error: {e}")
        return None, None


def parse_foursquare_hours(hours_data: Optional[dict]) -> tuple[Optional[dict], Optional[str]]:
    """
    Parse Foursquare hours into our format.

    Returns:
        (hours_json, hours_display)

    hours_json format: {"mon": {"open": "11:00", "close": "23:00"}, ...}
    """
    if not hours_data:
        return None, None

    regular = hours_data.get("regular", [])
    if not regular:
        display = hours_data.get("display")
        return None, display

    day_map = {1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat", 7: "sun"}
    hours_json = {}

    for entry in regular:
        day_num = entry.get("day")
        if day_num not in day_map:
            continue
        day_name = day_map[day_num]

        open_time = entry.get("open", "")
        close_time = entry.get("close", "")

        # Convert "0900" to "09:00"
        if len(open_time) == 4:
            open_time = f"{open_time[:2]}:{open_time[2:]}"
        if len(close_time) == 4:
            close_time = f"{close_time[:2]}:{close_time[2:]}"

        if open_time and close_time:
            hours_json[day_name] = {"open": open_time, "close": close_time}

    # Generate display string
    display = hours_data.get("display")

    return hours_json if hours_json else None, display


def get_venues_needing_hours(
    venue_type: Optional[str] = None,
    limit: int = 30,
    max_age_days: int = 30,
    city: Optional[str] = None,
) -> list[dict]:
    """Get venues with foursquare_id that need hours (missing, stale, or lower-confidence)."""
    client = get_client()

    query = client.table("places").select(
        "id, name, slug, city, foursquare_id, hours, venue_type, hours_source, hours_updated_at"
    ).eq("is_active", True)

    # Must have foursquare_id
    query = query.not_.is_("foursquare_id", "null")

    if city:
        query = query.eq("city", city)

    if venue_type:
        query = query.eq("place_type", venue_type)

    query = query.limit(limit * 3)  # Over-fetch to filter client-side

    result = query.execute()
    venues = result.data or []

    # Filter: no hours, stale, or upgradeable from lower-confidence source
    now = datetime.now(timezone.utc)
    filtered = []
    for v in venues:
        # No hours — always include
        if not v.get("hours"):
            filtered.append(v)
            continue
        # Skip venues with Google hours (higher confidence) unless stale
        if v.get("hours_source") == "google":
            continue
        # Foursquare hours already present — only re-fetch if stale
        if v.get("hours_source") == "foursquare":
            if v.get("hours_updated_at"):
                try:
                    updated = datetime.fromisoformat(v["hours_updated_at"].replace("Z", "+00:00"))
                    if (now - updated).days >= max_age_days:
                        filtered.append(v)
                except (ValueError, TypeError):
                    pass
            continue
        # Lower-confidence source (website, social_bio) — include for upgrade
        if should_update_hours(v.get("hours_source"), "foursquare"):
            filtered.append(v)

    return filtered[:limit]


def update_venue_hours(venue_id: int, hours: dict, hours_display: str, dry_run: bool = False) -> bool:
    """Update venue with hours from Foursquare."""
    if dry_run:
        return True

    client = get_client()
    try:
        now = datetime.now(timezone.utc).isoformat()
        updates = {
            "hours": hours,
            "hours_source": "foursquare",
            "hours_updated_at": now,
        }
        if hours_display:
            updates["hours_display"] = hours_display

        client.table("places").update(updates).eq("id", venue_id).execute()
        return True
    except Exception as e:
        logger.error(f"    Update error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Hydrate venue hours from Foursquare")
    parser.add_argument("--venue-type", help="Filter by venue type (bar, restaurant, etc.)")
    parser.add_argument("--city", help="Filter by city")
    parser.add_argument("--limit", type=int, default=30, help="Max venues to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview without updating")
    parser.add_argument("--max-age-days", type=int, default=30, help="Re-fetch hours older than this many days (default: 30)")
    args = parser.parse_args()

    if not FOURSQUARE_API_KEY:
        logger.error("FOURSQUARE_API_KEY environment variable not set")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("Foursquare Hours Hydration")
    logger.info("=" * 60)

    venues = get_venues_needing_hours(
        args.venue_type,
        args.limit,
        max_age_days=args.max_age_days,
        city=args.city,
    )
    logger.info(f"Found {len(venues)} venues needing Foursquare hours")
    logger.info("")

    hydrated = 0
    failed = 0

    for venue in venues:
        name = venue["name"]
        fsq_id = venue["foursquare_id"]

        raw_hours, raw_display = get_foursquare_hours(fsq_id)

        if raw_hours:
            # Normalize/validate through shared pipeline
            hours, display = prepare_hours_update(
                raw_hours, source="foursquare", venue_type=venue.get("place_type"),
            )
            if not hours:
                logger.info(f"  NO HOURS: {name} (validation failed)")
                failed += 1
                time.sleep(3)
                continue
            # Prefer Foursquare's own display if we don't have one
            if not display and raw_display:
                display = raw_display

            if args.dry_run:
                logger.info(f"  FOUND: {name}")
                logger.info(f"         {display}")
            else:
                success = update_venue_hours(venue["id"], hours, display)
                if success:
                    logger.info(f"  HYDRATED: {name}")
                    logger.info(f"            {display}")
                    hydrated += 1
                else:
                    logger.info(f"  ERROR: {name}")
                    failed += 1
        else:
            logger.info(f"  NO HOURS: {name}")
            failed += 1

        # Conservative rate limiting - 3 seconds between requests
        time.sleep(3)

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Done! Hydrated: {hydrated}, No hours available: {failed}")
    if args.dry_run:
        logger.info("(Dry run - no changes made)")


if __name__ == "__main__":
    main()
