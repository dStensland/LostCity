#!/usr/bin/env python3
"""
Hydrate venue hours from Google Places API.

Google has excellent hours coverage (~90% of venues).
This script finds venues missing hours and enriches them from Google.

Usage:
    python hydrate_hours_google.py --limit 50
    python hydrate_hours_google.py --venue-type restaurant --limit 100
    python hydrate_hours_google.py --dry-run
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

# Load .env files
load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent.parent / "web" / ".env.local")

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"

# Atlanta center
ATLANTA_LAT = 33.749
ATLANTA_LNG = -84.388

# Fields we need for hours
FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.regularOpeningHours",
])

# Day mapping
DAY_MAP = {
    0: "sun",
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
    6: "sat",
}


def name_similarity(name1: str, name2: str) -> float:
    """Calculate name similarity (0-1)."""
    def normalize(n):
        n = n.lower().strip()
        for suffix in [" atlanta", " atl", " - atlanta", " (atlanta)", " ga"]:
            n = n.replace(suffix, "")
        # Remove location qualifiers in parens
        import re
        n = re.sub(r'\s*\([^)]+\)\s*$', '', n)
        return n

    n1 = normalize(name1)
    n2 = normalize(name2)

    if not n1 or not n2:
        return 0.0

    if n1 == n2:
        return 1.0

    if n1 in n2 or n2 in n1:
        return 0.9

    # First N chars match
    min_len = min(len(n1), len(n2))
    match_len = 0
    for i in range(min_len):
        if n1[i] == n2[i]:
            match_len += 1
        else:
            break

    if match_len >= 10:
        return 0.8
    elif match_len >= 5:
        return 0.6

    return 0.0


def search_google_places(query: str, lat: float = ATLANTA_LAT, lng: float = ATLANTA_LNG) -> Optional[dict]:
    """Search Google Places for a venue."""
    if not GOOGLE_API_KEY:
        return None

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
    }

    body = {
        "textQuery": query,
        "maxResultCount": 3,
        "locationBias": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": 25000,
            }
        }
    }

    try:
        response = requests.post(GOOGLE_PLACES_URL, headers=headers, json=body, timeout=10)
        response.raise_for_status()
        data = response.json()

        places = data.get("places", [])
        if not places:
            return None

        # Return best match by name similarity
        for place in places:
            place_name = place.get("displayName", {}).get("text", "")
            if name_similarity(query.replace(", Atlanta, GA", ""), place_name) >= 0.6:
                return place

        return places[0]

    except Exception as e:
        logger.debug(f"Google search error: {e}")
        return None


def parse_google_hours(opening_hours: dict) -> tuple[Optional[dict], Optional[str]]:
    """
    Parse Google's regularOpeningHours into our format.

    Returns:
        (hours_json, hours_display)

    hours_json format: {"mon": {"open": "11:00", "close": "23:00"}, ...}
    """
    if not opening_hours:
        return None, None

    periods = opening_hours.get("periods", [])
    weekday_descriptions = opening_hours.get("weekdayDescriptions", [])

    if not periods:
        # Just return display if no structured periods
        display = ", ".join(weekday_descriptions) if weekday_descriptions else None
        return None, display

    hours_json = {}

    for period in periods:
        open_info = period.get("open", {})
        close_info = period.get("close", {})

        day_num = open_info.get("day")
        if day_num is None or day_num not in DAY_MAP:
            continue

        day_name = DAY_MAP[day_num]

        # Get times
        open_hour = open_info.get("hour", 0)
        open_minute = open_info.get("minute", 0)

        close_hour = close_info.get("hour", 0) if close_info else 23
        close_minute = close_info.get("minute", 0) if close_info else 59

        open_time = f"{open_hour:02d}:{open_minute:02d}"
        close_time = f"{close_hour:02d}:{close_minute:02d}"

        # Handle venues open 24 hours (open and close at same time)
        if open_time == close_time:
            close_time = "23:59"

        hours_json[day_name] = {"open": open_time, "close": close_time}

    # Generate display string from weekday descriptions
    display = None
    if weekday_descriptions:
        # Google provides nice formatted strings like "Monday: 11:00 AM – 10:00 PM"
        display = "; ".join(weekday_descriptions)

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
    limit: int = 50,
) -> list[dict]:
    """Get venues missing hours."""
    client = get_client()

    query = client.table("venues").select(
        "id, name, slug, address, city, lat, lng, hours, venue_type"
    ).eq("active", True).eq("city", "Atlanta")

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
        logger.error(f"Update error: {e}")
        return False


def hydrate_venue_hours(venue: dict, dry_run: bool = False) -> dict:
    """Hydrate hours for a single venue from Google."""
    result = {
        "venue_id": venue["id"],
        "venue_name": venue["name"],
        "status": "unknown",
        "hours": None,
    }

    lat = venue.get("lat") or ATLANTA_LAT
    lng = venue.get("lng") or ATLANTA_LNG

    # Search Google
    query = f"{venue['name']}, Atlanta, GA"
    google = search_google_places(query, lat, lng)

    if not google:
        result["status"] = "not_found"
        return result

    google_name = google.get("displayName", {}).get("text", "")

    # Verify name match
    sim = name_similarity(venue["name"], google_name)
    if sim < 0.6:
        result["status"] = "wrong_match"
        result["google_name"] = google_name
        return result

    # Parse hours
    opening_hours = google.get("regularOpeningHours")
    if not opening_hours:
        result["status"] = "no_hours"
        return result

    hours_json, hours_display = parse_google_hours(opening_hours)

    if not hours_json:
        result["status"] = "no_hours"
        return result

    # Generate our own display if needed
    if not hours_display:
        hours_display = format_hours_display(hours_json)

    result["hours"] = hours_json
    result["hours_display"] = hours_display

    # Update database
    if dry_run:
        result["status"] = "found"
    else:
        success = update_venue_hours(venue["id"], hours_json, hours_display)
        result["status"] = "updated" if success else "error"

    return result


def main():
    parser = argparse.ArgumentParser(description="Hydrate venue hours from Google Places")
    parser.add_argument("--venue-type", help="Filter by venue type")
    parser.add_argument("--limit", type=int, default=50, help="Max venues to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview without updating")
    args = parser.parse_args()

    if not GOOGLE_API_KEY:
        logger.error("GOOGLE_PLACES_API_KEY not set in .env or web/.env.local")
        sys.exit(1)

    logger.info("=" * 70)
    logger.info("Google Places Hours Hydration")
    logger.info("=" * 70)

    venues = get_venues_needing_hours(args.venue_type, args.limit)
    logger.info(f"Found {len(venues)} venues missing hours")
    logger.info("")

    stats = {"updated": 0, "not_found": 0, "no_hours": 0, "wrong_match": 0, "error": 0}

    for venue in venues:
        result = hydrate_venue_hours(venue, dry_run=args.dry_run)
        status = result["status"]

        if status == "updated" or status == "found":
            stats["updated"] += 1
            hours_display = result.get("hours_display", "")
            if args.dry_run:
                logger.info(f"  ✓ {venue['name']}")
                logger.info(f"      {hours_display[:60]}...")
            else:
                logger.info(f"  ✓ {venue['name']}")
                logger.info(f"      {hours_display[:60]}...")
        elif status == "not_found":
            stats["not_found"] += 1
            logger.info(f"  ? {venue['name']} - Not found")
        elif status == "no_hours":
            stats["no_hours"] += 1
            logger.info(f"  - {venue['name']} - No hours on Google")
        elif status == "wrong_match":
            stats["wrong_match"] += 1
            logger.info(f"  ⚠ {venue['name']} - Wrong match: {result.get('google_name', '')}")
        else:
            stats["error"] += 1
            logger.info(f"  ✗ {venue['name']} - Error")

        # Rate limiting (Google allows ~10 QPS)
        time.sleep(0.3)

    logger.info("")
    logger.info("=" * 70)
    logger.info("Summary")
    logger.info("=" * 70)
    logger.info(f"  Hours added:   {stats['updated']}")
    logger.info(f"  No hours:      {stats['no_hours']}")
    logger.info(f"  Not found:     {stats['not_found']}")
    logger.info(f"  Wrong match:   {stats['wrong_match']}")
    logger.info(f"  Errors:        {stats['error']}")

    if args.dry_run:
        logger.info("")
        logger.info("(Dry run - no changes made)")


if __name__ == "__main__":
    main()
