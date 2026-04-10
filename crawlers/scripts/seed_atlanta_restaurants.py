"""
Seed Atlanta's top restaurants from Google Places API.

Queries Google Places Text Search for restaurants in Atlanta neighborhoods,
creates place records with hours, price level, photos, and descriptions.
Uses get_or_create_place() to avoid duplicates.

Usage:
  python -m scripts.seed_atlanta_restaurants --dry-run
  python -m scripts.seed_atlanta_restaurants --neighborhood "Midtown Atlanta" --limit 10 --dry-run
  python -m scripts.seed_atlanta_restaurants --all --limit 20
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from typing import Optional

import requests
from dotenv import load_dotenv

# Load env vars — check both the project root .env and web/.env.local
# (Google Places key may live in either location)
_repo_root = os.path.join(os.path.dirname(__file__), "..", "..")
load_dotenv(os.path.join(_repo_root, ".env"))
load_dotenv(os.path.join(_repo_root, "web", ".env.local"), override=False)

from config import get_config  # noqa: E402 — must follow dotenv load
from db import get_or_create_place  # noqa: E402
from db.client import configure_write_mode, writes_enabled  # noqa: E402

logger = logging.getLogger(__name__)

# ===== Google Places API =====

GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"

FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.types",
    "places.primaryType",
    "places.rating",
    "places.userRatingCount",
    "places.priceLevel",
    "places.regularOpeningHours",
    "places.websiteUri",
    "places.nationalPhoneNumber",
    "places.photos",
    "places.editorialSummary",
])

# ===== Neighborhoods =====

NEIGHBORHOODS = [
    "Midtown Atlanta",
    "Downtown Atlanta",
    "Buckhead Atlanta",
    "Inman Park Atlanta",
    "Old Fourth Ward Atlanta",
    "Virginia-Highland Atlanta",
    "Decatur Georgia",
    "East Atlanta Village",
    "Little Five Points Atlanta",
    "Westside Atlanta",
    "Poncey-Highland Atlanta",
    "Grant Park Atlanta",
    "Kirkwood Atlanta",
    "Edgewood Atlanta",
    "Castleberry Hill Atlanta",
    "West Midtown Atlanta",
    "Reynoldstown Atlanta",
    "Cabbagetown Atlanta",
    "Summerhill Atlanta",
    "Avondale Estates Georgia",
]

# Friendly display name for a neighborhood query string
def _neighborhood_display(hood: str) -> str:
    return (
        hood.replace(" Atlanta", "")
            .replace(" Georgia", "")
    )


# ===== Type mapping =====

# Maps Google primaryType to our place_type taxonomy
_PRIMARY_TYPE_MAP: dict[str, str] = {
    "restaurant": "restaurant",
    "bar": "bar",
    "cafe": "coffee_shop",
    "coffee_shop": "coffee_shop",
    "bakery": "restaurant",
    "meal_delivery": "restaurant",
    "meal_takeaway": "restaurant",
    "fast_food_restaurant": "restaurant",
    "pizza_restaurant": "restaurant",
    "hamburger_restaurant": "restaurant",
    "sandwich_shop": "restaurant",
    "seafood_restaurant": "restaurant",
    "steak_house": "restaurant",
    "sushi_restaurant": "restaurant",
    "thai_restaurant": "restaurant",
    "chinese_restaurant": "restaurant",
    "mexican_restaurant": "restaurant",
    "italian_restaurant": "restaurant",
    "japanese_restaurant": "restaurant",
    "indian_restaurant": "restaurant",
    "korean_restaurant": "restaurant",
    "american_restaurant": "restaurant",
    "barbecue_restaurant": "restaurant",
    "brunch_restaurant": "restaurant",
    "wine_bar": "bar",
    "cocktail_bar": "bar",
    "pub": "bar",
    "brewery": "brewery",
    "food_court": "food_hall",
}

# ===== Price level =====

_PRICE_LEVEL_MAP: dict[str, int] = {
    "PRICE_LEVEL_FREE": 1,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}

_PRICE_DISPLAY: dict[str, str] = {
    "PRICE_LEVEL_FREE": "free",
    "PRICE_LEVEL_INEXPENSIVE": "$",
    "PRICE_LEVEL_MODERATE": "$$",
    "PRICE_LEVEL_EXPENSIVE": "$$$",
    "PRICE_LEVEL_VERY_EXPENSIVE": "$$$$",
}


# ===== Hours parsing =====

_DAY_MAP: dict[int, str] = {
    0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat"
}


def _parse_hours(place: dict) -> Optional[dict]:
    """
    Convert Google Places regularOpeningHours to our hours format.

    Google format: {"periods": [{"open": {"day": 0, "hour": 11, "minute": 0},
                                  "close": {"day": 0, "hour": 22, "minute": 0}}, ...]}
    Our format: {"mon": {"open": "11:00", "close": "22:00"}, ...}

    Day mapping: 0=Sunday, 1=Monday, ..., 6=Saturday
    Midnight/next-day close (hour=0, minute=0) is normalised to "23:59".
    """
    hours_data = place.get("regularOpeningHours", {})
    if not hours_data:
        return None

    periods = hours_data.get("periods", [])
    if not periods:
        return None

    result: dict[str, dict] = {}
    for period in periods:
        open_info = period.get("open", {})
        close_info = period.get("close", {})

        day_num = open_info.get("day")
        if day_num is None:
            continue

        day_key = _DAY_MAP.get(day_num)
        if not day_key:
            continue

        open_str = f"{open_info.get('hour', 0):02d}:{open_info.get('minute', 0):02d}"

        if close_info:
            close_hour = close_info.get("hour", 0)
            close_min = close_info.get("minute", 0)
            # Midnight / next-day close => treat as end-of-day
            close_str = "23:59" if (close_hour == 0 and close_min == 0) else f"{close_hour:02d}:{close_min:02d}"
        else:
            # No close means 24-hour operation
            close_str = "23:59"

        result[day_key] = {"open": open_str, "close": close_str}

    return result or None


# ===== Photo URL =====

def _photo_url(place: dict, api_key: str) -> Optional[str]:
    """Build the Google Places photo media URL for the first photo."""
    photos = place.get("photos", [])
    if not photos:
        return None
    photo_name = photos[0].get("name")
    if not photo_name:
        return None
    return f"https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=800&key={api_key}"


# ===== Address parsing =====

def _street_address(formatted: str) -> Optional[str]:
    """Extract the street address component (before the first comma)."""
    if not formatted:
        return None
    return formatted.split(",")[0].strip() or None


# ===== Core functions =====

def search_restaurants(neighborhood: str, limit: int, api_key: str) -> list[dict]:
    """Search Google Places Text Search for restaurants in a neighborhood."""
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": FIELD_MASK,
    }
    body = {
        "textQuery": f"best restaurants in {neighborhood}",
        "maxResultCount": min(limit, 20),  # Google Places API caps at 20 per request
        "languageCode": "en",
    }

    try:
        resp = requests.post(GOOGLE_PLACES_URL, headers=headers, json=body, timeout=30)
        resp.raise_for_status()
        return resp.json().get("places", [])
    except requests.HTTPError as exc:
        logger.error("Google Places API HTTP error for %r: %s", neighborhood, exc)
        return []
    except Exception as exc:
        logger.error("Google Places API error for %r: %s", neighborhood, exc)
        return []


def map_place_to_venue_data(place: dict, neighborhood: str, api_key: str) -> Optional[dict]:
    """
    Convert a Google Places result to a venue_data dict for get_or_create_place().

    Returns None if the result lacks a name (minimum required field).
    """
    name = (place.get("displayName") or {}).get("text", "").strip()
    if not name:
        return None

    location = place.get("location", {})
    lat = location.get("latitude")
    lng = location.get("longitude")

    formatted_address = place.get("formattedAddress", "")
    street = _street_address(formatted_address)

    primary_type = place.get("primaryType", "restaurant")
    place_type = _PRIMARY_TYPE_MAP.get(primary_type, "restaurant")

    hours = _parse_hours(place)
    image_url = _photo_url(place, api_key)

    price_raw = place.get("priceLevel")
    price_level = _PRICE_LEVEL_MAP.get(price_raw) if price_raw else None

    description = (place.get("editorialSummary") or {}).get("text") or None

    neighborhood_display = _neighborhood_display(neighborhood)

    # Generate slug from name
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:80]

    return {
        "name": name,
        "slug": slug,
        "address": street,
        "neighborhood": neighborhood_display,
        "city": "Atlanta",
        "state": "GA",
        "lat": lat,
        "lng": lng,
        "place_type": place_type,
        "spot_type": place_type,
        "website": place.get("websiteUri") or None,
        "phone": place.get("nationalPhoneNumber") or None,
        "description": description,
        "image_url": image_url,
        "hours": hours,
        "vibes": [],
    }


def seed_neighborhood(
    neighborhood: str,
    limit: int,
    api_key: str,
    dry_run: bool,
) -> tuple[int, int]:
    """
    Fetch and upsert restaurants for one neighborhood.

    Returns (found, created_or_updated).
    """
    logger.info("Searching restaurants in %r ...", neighborhood)
    places = search_restaurants(neighborhood, limit, api_key)

    found = 0
    upserted = 0

    for place in places:
        venue_data = map_place_to_venue_data(place, neighborhood, api_key)
        if not venue_data:
            logger.debug("Skipping result with no name in %r", neighborhood)
            continue

        found += 1

        if dry_run:
            price_raw = place.get("priceLevel", "")
            price_display = _PRICE_DISPLAY.get(price_raw, "?")
            rating = place.get("rating", "?")
            has_hours = "Y" if venue_data.get("hours") else "N"
            has_img = "Y" if venue_data.get("image_url") else "N"
            has_desc = "Y" if venue_data.get("description") else "N"
            print(
                f"  [{price_display:4s}] {venue_data['name']:<45s} "
                f"rating={rating:<4} hours={has_hours} img={has_img} desc={has_desc}"
            )
        else:
            place_id = get_or_create_place(venue_data)
            if place_id:
                upserted += 1

    return found, upserted


# ===== CLI =====

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed Atlanta restaurants from Google Places API"
    )
    parser.add_argument(
        "--neighborhood",
        metavar="NAME",
        help='Single neighborhood to seed (e.g. "Midtown Atlanta")',
    )
    parser.add_argument(
        "--all",
        action="store_true",
        dest="all_neighborhoods",
        help="Seed all 20 Atlanta neighborhoods",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        metavar="N",
        help="Max restaurants per neighborhood query (max 20, Google API cap)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch from Google and print results without writing to DB",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
        datefmt="%H:%M:%S",
    )

    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    if not api_key:
        logger.error(
            "GOOGLE_PLACES_API_KEY not set. "
            "Add it to .env or export it before running."
        )
        sys.exit(1)

    if args.dry_run:
        configure_write_mode(False, "dry-run")
        logger.info("DRY RUN — no DB writes will occur")

    # Determine which neighborhoods to process
    if args.all_neighborhoods:
        neighborhoods = NEIGHBORHOODS
    elif args.neighborhood:
        neighborhoods = [args.neighborhood]
    else:
        # Default: first 3 neighborhoods as a quick sanity check
        neighborhoods = NEIGHBORHOODS[:3]
        logger.info(
            "No --neighborhood or --all specified. "
            "Defaulting to first 3 neighborhoods. Use --all to seed all 20."
        )

    limit = max(1, min(args.limit, 20))  # clamp to Google's cap

    total_found = 0
    total_upserted = 0

    for i, hood in enumerate(neighborhoods):
        found, upserted = seed_neighborhood(
            neighborhood=hood,
            limit=limit,
            api_key=api_key,
            dry_run=args.dry_run,
        )
        total_found += found
        total_upserted += upserted

        logger.info(
            "%s: %d found, %d %s",
            _neighborhood_display(hood),
            found,
            upserted,
            "would create/update" if args.dry_run else "created/updated",
        )

        # Rate-limit between neighborhoods — Google Places has per-minute quotas
        if i < len(neighborhoods) - 1:
            time.sleep(2)

    print(
        f"\nDone: {total_found} restaurants found, "
        f"{total_upserted} {'would be ' if args.dry_run else ''}created/updated "
        f"across {len(neighborhoods)} neighborhood(s)."
    )


if __name__ == "__main__":
    main()
