#!/usr/bin/env python3
"""
Enrich venue records with Google Places API attribute data.

This script fetches additional attributes from Google Places (outdoor seating,
dog-friendly, live music, accessibility, price level, etc.) and merges them
into existing venue records.

Usage:
    # Scrape venues in a corridor (lat/lng + radius)
    python enrich_google_attributes.py --lat 33.7834 --lng -84.3731 --radius 3

    # Scrape specific venues by ID
    python enrich_google_attributes.py --venue-ids 574,641,925

    # Only venues missing hours
    python enrich_google_attributes.py --missing-hours --limit 50

    # Dry run (don't write to DB)
    python enrich_google_attributes.py --lat 33.7834 --lng -84.3731 --radius 2 --dry-run
"""

import os
import sys
import time
import math
import logging
import argparse
import requests
from pathlib import Path
from typing import Optional
from datetime import datetime
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

# Field mask for API requests
FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.accessibilityOptions",
    "places.allowsDogs",
    "places.goodForChildren",
    "places.goodForGroups",
    "places.goodForWatchingSports",
    "places.liveMusic",
    "places.outdoorSeating",
    "places.reservable",
    "places.servesBeer",
    "places.servesWine",
    "places.servesCocktails",
    "places.servesBrunch",
    "places.servesCoffee",
    "places.servesVegetarianFood",
    "places.restroom",
    "places.menuForChildren",
    "places.regularOpeningHours",
    "places.websiteUri",
    "places.priceLevel",
    "places.nationalPhoneNumber",
])

# Attribute → Vibe mapping
ATTRIBUTE_TO_VIBE = {
    "allowsDogs": "dog-friendly",
    "goodForChildren": "family-friendly",
    "liveMusic": "live-music",
    "outdoorSeating": "outdoor-seating",
    "goodForWatchingSports": "sports",
}

# Day mapping for hours
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
    import re

    def normalize(n):
        n = n.lower().strip()
        # Remove special characters (®, ™, etc.)
        n = re.sub(r'[®™©]', '', n)
        # Remove common prefixes
        n = re.sub(r'^the\s+', '', n)
        # Remove location suffixes
        for suffix in [" atlanta", " atl", " - atlanta", " (atlanta)", " ga",
                       " - midtown", " - buckhead", " - decatur", " - east atlanta",
                       " - downtown", " - virginia highland", " - sandy springs",
                       " nashville", " - nashville", " (nashville)", " tn",
                       " - east nashville", " - germantown", " - the gulch",
                       " - 12 south", " - sylvan heights", " - music row"]:
            n = n.replace(suffix, "")
        # Remove location qualifiers in parens
        n = re.sub(r'\s*\([^)]+\)\s*$', '', n)
        # Remove extra whitespace
        n = re.sub(r'\s+', ' ', n).strip()
        return n

    n1 = normalize(name1)
    n2 = normalize(name2)

    if not n1 or not n2:
        return 0.0

    if n1 == n2:
        return 1.0

    if n1 in n2 or n2 in n1:
        return 0.9

    # Word overlap (good for reordered or partial names)
    words1 = set(n1.split())
    words2 = set(n2.split())
    if words1 and words2:
        overlap = len(words1 & words2)
        total = max(len(words1), len(words2))
        if overlap / total >= 0.7:
            return 0.8

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


def extract_vibes_from_attributes(place: dict) -> list[str]:
    """Extract vibes from Google Place attributes."""
    vibes = []

    # Direct attribute mappings
    for attr_key, vibe_value in ATTRIBUTE_TO_VIBE.items():
        if place.get(attr_key):
            vibes.append(vibe_value)

    # Accessibility mapping (if ANY accessibility feature is true, add the vibe)
    accessibility = place.get("accessibilityOptions", {})
    if accessibility and isinstance(accessibility, dict):
        has_accessibility = any([
            accessibility.get("wheelchairAccessibleParking"),
            accessibility.get("wheelchairAccessibleEntrance"),
            accessibility.get("wheelchairAccessibleRestroom"),
            accessibility.get("wheelchairAccessibleSeating"),
        ])
        if has_accessibility:
            vibes.append("wheelchair-accessible")

    return vibes


def map_price_level(google_price: Optional[str]) -> Optional[int]:
    """Map Google price level to our 1-4 scale."""
    if not google_price:
        return None
    mapping = {
        "PRICE_LEVEL_FREE": 1,
        "PRICE_LEVEL_INEXPENSIVE": 1,
        "PRICE_LEVEL_MODERATE": 2,
        "PRICE_LEVEL_EXPENSIVE": 3,
        "PRICE_LEVEL_VERY_EXPENSIVE": 4,
    }
    return mapping.get(google_price)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in km."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_venues(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 3.0,
    venue_ids: Optional[list[int]] = None,
    missing_hours: bool = False,
    limit: int = 200,
) -> list[dict]:
    """Fetch venues to enrich from the database."""
    client = get_client()

    query = (
        client.table("venues")
        .select("id, name, slug, city, lat, lng, vibes, hours, hours_display, menu_url, reservation_url, price_level, phone, last_verified_at")
        .eq("active", True)
        .not_.is_("lat", "null")
        .not_.is_("lng", "null")
    )

    if venue_ids:
        query = query.in_("id", venue_ids)
    elif missing_hours:
        query = query.or_("hours.is.null,hours.eq.{}")

    result = query.order("name").limit(5000).execute()
    venues = result.data or []

    # Filter by distance if lat/lng provided
    if lat is not None and lng is not None:
        venues = [
            v for v in venues
            if v.get("lat") and v.get("lng")
            and haversine_km(lat, lng, float(v["lat"]), float(v["lng"])) <= radius_km
        ]

    # Sort by distance from center if available
    if lat is not None and lng is not None:
        venues.sort(key=lambda v: haversine_km(lat, lng, float(v["lat"]), float(v["lng"])))

    return venues[:limit]


def enrich_venue(venue: dict, dry_run: bool = False) -> dict:
    """Enrich a single venue with Google Places attributes."""
    result = {
        "venue_id": venue["id"],
        "venue_name": venue["name"],
        "matched": False,
        "updates": {},
        "vibes_added": [],
    }

    lat = venue.get("lat") or ATLANTA_LAT
    lng = venue.get("lng") or ATLANTA_LNG

    # Search Google using venue's actual city
    city = venue.get("city", "Atlanta")
    query = f"{venue['name']}, {city}"
    google = search_google_places(query, lat, lng)

    if not google:
        return result

    google_name = google.get("displayName", {}).get("text", "")

    # Verify name match
    sim = name_similarity(venue["name"], google_name)
    if sim < 0.6:
        result["google_name"] = google_name
        result["similarity"] = sim
        return result

    result["matched"] = True
    result["google_name"] = google_name
    updates = {}

    # Extract vibes from attributes
    new_vibes = extract_vibes_from_attributes(google)
    if new_vibes:
        existing_vibes = venue.get("vibes") or []
        # Merge without duplicates
        combined_vibes = list(dict.fromkeys(existing_vibes + new_vibes))
        # Only update if we're adding new vibes
        added_vibes = [v for v in new_vibes if v not in existing_vibes]
        if added_vibes:
            updates["vibes"] = combined_vibes
            result["vibes_added"] = added_vibes

    # Hours: only fill if venue has no hours
    if not venue.get("hours") or venue.get("hours") == {}:
        opening_hours = google.get("regularOpeningHours")
        if opening_hours:
            hours_json, hours_display = parse_google_hours(opening_hours)
            if hours_json:
                updates["hours"] = hours_json
                if hours_display:
                    updates["hours_display"] = hours_display
                result["hours_filled"] = True

    # Menu URL: note if venue has no menu_url AND Google shows a website
    if not venue.get("menu_url") and google.get("websiteUri"):
        # Don't auto-populate menu_url (it's usually just the homepage)
        # Just flag it for manual review
        result["has_website"] = google.get("websiteUri")

    # Reservation URL: flag if reservable but no reservation_url
    if google.get("reservable") and not venue.get("reservation_url"):
        result["reservable"] = True

    # Price level: fill if missing
    if not venue.get("price_level"):
        price_level = map_price_level(google.get("priceLevel"))
        if price_level:
            updates["price_level"] = price_level
            result["price_level_added"] = price_level

    # Phone: fill if missing
    if not venue.get("phone"):
        phone = google.get("nationalPhoneNumber")
        if phone:
            updates["phone"] = phone
            result["phone_added"] = phone

    # Stamp last_verified_at on any venue that was successfully matched and updated
    if updates:
        updates["last_verified_at"] = datetime.utcnow().isoformat()

    result["updates"] = updates

    # Write to database
    if updates and not dry_run:
        client = get_client()
        client.table("venues").update(updates).eq("id", venue["id"]).execute()

    return result


def main():
    parser = argparse.ArgumentParser(description="Enrich venues with Google Places attributes")
    parser.add_argument("--lat", type=float, help="Center latitude for corridor search")
    parser.add_argument("--lng", type=float, help="Center longitude for corridor search")
    parser.add_argument("--radius", type=float, default=3.0, help="Radius in km (default: 3)")
    parser.add_argument("--venue-ids", type=str, help="Comma-separated venue IDs")
    parser.add_argument("--missing-hours", action="store_true", help="Only venues missing hours")
    parser.add_argument("--limit", type=int, default=200, help="Max venues to process")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to database")
    args = parser.parse_args()

    if not GOOGLE_API_KEY:
        logger.error("GOOGLE_PLACES_API_KEY not set in .env or web/.env.local")
        sys.exit(1)

    logger.info("=" * 70)
    logger.info("Google Places Attribute Enrichment")
    logger.info("=" * 70)

    # Parse venue IDs
    venue_ids = None
    if args.venue_ids:
        venue_ids = [int(x.strip()) for x in args.venue_ids.split(",") if x.strip()]

    venues = get_venues(
        lat=args.lat,
        lng=args.lng,
        radius_km=args.radius,
        venue_ids=venue_ids,
        missing_hours=args.missing_hours,
        limit=args.limit,
    )

    logger.info(f"Found {len(venues)} venues to enrich")
    if args.dry_run:
        logger.info("DRY RUN — no database writes")
    logger.info("")

    stats = {
        "matched": 0,
        "updated_vibes": 0,
        "updated_hours": 0,
        "updated_price": 0,
        "updated_phone": 0,
        "skipped": 0,
    }

    for i, venue in enumerate(venues, 1):
        name = venue["name"][:50]
        dist_str = ""
        if args.lat and args.lng and venue.get("lat") and venue.get("lng"):
            dist = haversine_km(args.lat, args.lng, float(venue["lat"]), float(venue["lng"]))
            dist_str = f" ({dist:.1f}km)"

        logger.info(f"[{i}/{len(venues)}] {name}{dist_str}")

        result = enrich_venue(venue, dry_run=args.dry_run)

        if not result["matched"]:
            logger.info(f"  ✗ No Google match")
            stats["skipped"] += 1
        else:
            stats["matched"] += 1
            changes = []

            if result.get("vibes_added"):
                changes.append(f"+{', +'.join(result['vibes_added'])}")
                stats["updated_vibes"] += 1

            if result.get("hours_filled"):
                changes.append("hours filled")
                stats["updated_hours"] += 1

            if result.get("price_level_added"):
                changes.append(f"price=${result['price_level_added']}")
                stats["updated_price"] += 1

            if result.get("phone_added"):
                changes.append(f"phone:{result['phone_added']}")
                stats["updated_phone"] += 1

            if changes:
                logger.info(f"  ✓ {venue['name']}: {', '.join(changes)}")
            else:
                logger.info(f"  ✓ {venue['name']}: no new data")

        # Rate limiting (Google allows ~10 QPS)
        time.sleep(0.3)

    logger.info("")
    logger.info("=" * 70)
    logger.info("Summary")
    logger.info("=" * 70)
    logger.info(f"  Matched:       {stats['matched']}")
    logger.info(f"  Updated vibes: {stats['updated_vibes']}")
    logger.info(f"  Updated hours: {stats['updated_hours']}")
    logger.info(f"  Updated price: {stats['updated_price']}")
    logger.info(f"  Updated phone: {stats['updated_phone']}")
    logger.info(f"  Skipped:       {stats['skipped']}")

    if args.dry_run:
        logger.info("")
        logger.info("(Dry run - no changes made)")


if __name__ == "__main__":
    main()
