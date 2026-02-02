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
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from db import get_client

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


def format_hours_display(hours: dict) -> str:
    """Generate a human-readable hours display string."""
    if not hours:
        return ""

    day_order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    day_labels = {"mon": "Mon", "tue": "Tue", "wed": "Wed", "thu": "Thu",
                  "fri": "Fri", "sat": "Sat", "sun": "Sun"}

    lines = []
    i = 0
    while i < len(day_order):
        day = day_order[i]
        if day not in hours:
            i += 1
            continue

        times = hours[day]
        start_day = day
        end_day = day

        # Find consecutive days with same hours
        j = i + 1
        while j < len(day_order):
            next_day = day_order[j]
            if next_day in hours and hours[next_day] == times:
                end_day = next_day
                j += 1
            else:
                break

        # Format time range
        open_time = times["open"]
        close_time = times["close"]

        def to_12h(t):
            h, m = int(t[:2]), t[3:]
            period = "am" if h < 12 else "pm"
            h = h % 12 or 12
            return f"{h}:{m}{period}" if m != "00" else f"{h}{period}"

        time_str = f"{to_12h(open_time)}-{to_12h(close_time)}"

        if start_day == end_day:
            lines.append(f"{day_labels[start_day]}: {time_str}")
        else:
            lines.append(f"{day_labels[start_day]}-{day_labels[end_day]}: {time_str}")

        i = j

    return ", ".join(lines)


def get_venues_needing_hours(
    venue_type: Optional[str] = None,
    limit: int = 30,
) -> list[dict]:
    """Get venues with foursquare_id but no hours."""
    client = get_client()

    query = client.table("venues").select(
        "id, name, slug, foursquare_id, hours, venue_type"
    ).eq("active", True)

    # Must have foursquare_id
    query = query.not_.is_("foursquare_id", "null")

    # Must not have hours
    query = query.is_("hours", "null")

    if venue_type:
        query = query.eq("venue_type", venue_type)

    query = query.limit(limit)

    result = query.execute()
    return result.data or []


def update_venue_hours(venue_id: int, hours: dict, hours_display: str, dry_run: bool = False) -> bool:
    """Update venue with hours."""
    if dry_run:
        return True

    client = get_client()
    try:
        updates = {"hours": hours}
        if hours_display:
            updates["hours_display"] = hours_display

        client.table("venues").update(updates).eq("id", venue_id).execute()
        return True
    except Exception as e:
        logger.error(f"    Update error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Hydrate venue hours from Foursquare")
    parser.add_argument("--venue-type", help="Filter by venue type (bar, restaurant, etc.)")
    parser.add_argument("--limit", type=int, default=30, help="Max venues to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview without updating")
    args = parser.parse_args()

    if not FOURSQUARE_API_KEY:
        logger.error("FOURSQUARE_API_KEY environment variable not set")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("Foursquare Hours Hydration")
    logger.info("=" * 60)

    venues = get_venues_needing_hours(args.venue_type, args.limit)
    logger.info(f"Found {len(venues)} venues with Foursquare ID but no hours")
    logger.info("")

    hydrated = 0
    failed = 0

    for venue in venues:
        name = venue["name"]
        fsq_id = venue["foursquare_id"]

        hours, display = get_foursquare_hours(fsq_id)

        if hours:
            # Generate our own display if Foursquare didn't provide one
            if not display:
                display = format_hours_display(hours)

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
