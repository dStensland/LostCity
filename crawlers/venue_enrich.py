"""
Venue Enrichment Script
Enriches venue data using Google Places API.
"""

import os
import re
import time
import math
import requests
from typing import Optional
from dotenv import load_dotenv
from db import get_client

# Load .env file
load_dotenv()

# Google Places API (New) configuration
GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
GOOGLE_PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places"

# Field mask for API requests
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
    "places.googleMapsUri",
    "places.outdoorSeating",
])

# ITP Atlanta neighborhoods with coordinates
ITP_NEIGHBORHOODS = [
    {"id": "downtown", "name": "Downtown", "lat": 33.749, "lng": -84.388, "radius": 2000},
    {"id": "midtown", "name": "Midtown", "lat": 33.784, "lng": -84.383, "radius": 2000},
    {"id": "buckhead", "name": "Buckhead", "lat": 33.838, "lng": -84.379, "radius": 2500},
    {"id": "old-fourth-ward", "name": "Old Fourth Ward", "lat": 33.769, "lng": -84.362, "radius": 1500},
    {"id": "east-atlanta-village", "name": "East Atlanta Village", "lat": 33.740, "lng": -84.341, "radius": 1000},
    {"id": "little-five-points", "name": "Little Five Points", "lat": 33.764, "lng": -84.349, "radius": 1000},
    {"id": "decatur", "name": "Decatur", "lat": 33.775, "lng": -84.296, "radius": 2000},
    {"id": "west-midtown", "name": "West Midtown", "lat": 33.791, "lng": -84.422, "radius": 2000},
    {"id": "virginia-highland", "name": "Virginia Highland", "lat": 33.774, "lng": -84.356, "radius": 1200},
    {"id": "inman-park", "name": "Inman Park", "lat": 33.761, "lng": -84.352, "radius": 1200},
    {"id": "grant-park", "name": "Grant Park", "lat": 33.738, "lng": -84.370, "radius": 1500},
    {"id": "cabbagetown", "name": "Cabbagetown", "lat": 33.749, "lng": -84.353, "radius": 800},
    {"id": "reynoldstown", "name": "Reynoldstown", "lat": 33.749, "lng": -84.340, "radius": 1000},
    {"id": "kirkwood", "name": "Kirkwood", "lat": 33.756, "lng": -84.318, "radius": 1500},
    {"id": "candler-park", "name": "Candler Park", "lat": 33.764, "lng": -84.336, "radius": 1200},
    {"id": "edgewood", "name": "Edgewood", "lat": 33.752, "lng": -84.331, "radius": 1000},
    {"id": "west-end", "name": "West End", "lat": 33.736, "lng": -84.413, "radius": 1500},
    {"id": "atlantic-station", "name": "Atlantic Station", "lat": 33.791, "lng": -84.395, "radius": 1000},
    {"id": "poncey-highland", "name": "Poncey-Highland", "lat": 33.772, "lng": -84.348, "radius": 1000},
    {"id": "castleberry-hill", "name": "Castleberry Hill", "lat": 33.748, "lng": -84.401, "radius": 800},
    {"id": "sweet-auburn", "name": "Sweet Auburn", "lat": 33.755, "lng": -84.376, "radius": 1000},
]

# Google type to our spot_type mapping
GOOGLE_TYPE_MAP = {
    "night_club": "club",
    "bar": "bar",
    "restaurant": "restaurant",
    "cafe": "coffee_shop",
    "coffee_shop": "coffee_shop",
    "movie_theater": "cinema",
    "performing_arts_theater": "theater",
    "art_gallery": "gallery",
    "museum": "museum",
    "stadium": "arena",
    "bowling_alley": "games",
    "amusement_center": "games",
    "gym": "fitness",
    "spa": "wellness",
    "book_store": "bookstore",
    "library": "library",
    "park": "park",
    "brewery": "brewery",
    "wine_bar": "bar",
    "pub": "bar",
}


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in meters between two points."""
    R = 6371000  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def determine_neighborhood(lat: float, lng: float) -> Optional[str]:
    """Find which neighborhood a point belongs to."""
    for hood in ITP_NEIGHBORHOODS:
        distance = haversine_distance(lat, lng, hood["lat"], hood["lng"])
        if distance <= hood["radius"]:
            return hood["name"]
    return None


def search_google_places(query: str, location_bias: Optional[dict] = None) -> Optional[dict]:
    """Search for a place using Google Places API (New)."""
    if not GOOGLE_API_KEY:
        print("Warning: GOOGLE_PLACES_API_KEY not set")
        return None

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
    }

    body = {
        "textQuery": query,
        "maxResultCount": 5,
    }

    # Add location bias if provided
    if location_bias:
        body["locationBias"] = {
            "circle": {
                "center": {
                    "latitude": location_bias.get("lat", 33.749),
                    "longitude": location_bias.get("lng", -84.388),
                },
                "radius": location_bias.get("radius", 50000),  # 50km default
            }
        }
    else:
        # Default to Atlanta center
        body["locationBias"] = {
            "circle": {
                "center": {"latitude": 33.749, "longitude": -84.388},
                "radius": 50000,
            }
        }

    try:
        response = requests.post(GOOGLE_PLACES_URL, headers=headers, json=body, timeout=10)
        response.raise_for_status()
        data = response.json()

        places = data.get("places", [])
        if places:
            return places[0]  # Return best match
        return None

    except Exception as e:
        print(f"Google Places API error: {e}")
        return None


def map_google_to_spot_type(google_types: list[str]) -> Optional[str]:
    """Map Google place types to our spot_type."""
    for gtype in google_types:
        if gtype in GOOGLE_TYPE_MAP:
            return GOOGLE_TYPE_MAP[gtype]
    return None


def map_google_to_spot_types(google_types: list[str]) -> list[str]:
    """Map Google place types to our spot_types array."""
    our_types = []
    for gtype in google_types:
        if gtype in GOOGLE_TYPE_MAP:
            mapped = GOOGLE_TYPE_MAP[gtype]
            if mapped not in our_types:
                our_types.append(mapped)
    return our_types


def map_google_to_vibes(place: dict) -> list[str]:
    """Extract vibes from Google place data."""
    vibes = []

    if place.get("outdoorSeating"):
        vibes.append("outdoor-seating")

    # Check hours for late-night
    hours = place.get("regularOpeningHours", {})
    if hours:
        periods = hours.get("periods", [])
        for period in periods:
            close = period.get("close", {})
            if close:
                hour = close.get("hour", 0)
                if hour >= 0 and hour <= 4:  # Closes between midnight and 4am
                    if "late-night" not in vibes:
                        vibes.append("late-night")

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


def enrich_venue(venue_id: int, google_place: dict, dry_run: bool = False) -> dict:
    """
    Enrich a venue with Google Places data.
    Returns the update dict.
    """
    location = google_place.get("location", {})
    lat = location.get("latitude")
    lng = location.get("longitude")

    # Determine neighborhood from coordinates
    neighborhood = None
    if lat and lng:
        neighborhood = determine_neighborhood(lat, lng)

    google_types = google_place.get("types", [])

    updates = {
        "address": google_place.get("formattedAddress"),
        "lat": lat,
        "lng": lng,
        "neighborhood": neighborhood,
        "website": google_place.get("websiteUri"),
    }

    # Map types
    spot_type = map_google_to_spot_type(google_types)
    if spot_type:
        updates["spot_type"] = spot_type

    spot_types = map_google_to_spot_types(google_types)
    if spot_types:
        updates["spot_types"] = spot_types

    # Map vibes
    vibes = map_google_to_vibes(google_place)
    if vibes:
        updates["vibes"] = vibes

    # Map price level
    price_level = map_price_level(google_place.get("priceLevel"))
    if price_level:
        updates["price_level"] = price_level

    if not dry_run:
        client = get_client()
        client.table("venues").update(updates).eq("id", venue_id).execute()

    return updates


def enrich_venue_by_name(venue: dict, dry_run: bool = False) -> Optional[dict]:
    """
    Try to enrich a venue by searching for it on Google.
    """
    name = venue.get("name", "")
    address = venue.get("address", "")

    # Build search query
    if address:
        query = f"{name}, {address}, Atlanta, GA"
    else:
        query = f"{name}, Atlanta, GA"

    print(f"  Searching: {query}")

    # Search Google Places
    place = search_google_places(query)

    if not place:
        print("  No results found")
        return None

    found_name = place.get("displayName", {}).get("text", "")
    found_address = place.get("formattedAddress", "")
    print(f"  Found: {found_name} at {found_address}")

    # Enrich the venue
    updates = enrich_venue(venue["id"], place, dry_run=dry_run)

    return updates


def enrich_incomplete_venues(limit: int = 50, dry_run: bool = False) -> dict:
    """
    Find and enrich venues missing critical data.

    Returns stats about the enrichment run.
    """
    client = get_client()

    # Find incomplete venues (missing neighborhood, type, or coordinates)
    result = client.table("venues").select("*").eq("active", True).or_(
        "neighborhood.is.null,spot_type.is.null,lat.is.null"
    ).order("name").limit(limit).execute()

    venues = result.data or []

    stats = {
        "total": len(venues),
        "enriched": 0,
        "failed": 0,
        "skipped": 0,
    }

    print(f"\nFound {len(venues)} venues to enrich")
    print("=" * 60)

    for i, venue in enumerate(venues, 1):
        print(f"\n[{i}/{len(venues)}] {venue['name']}")

        # Skip if already has coordinates and neighborhood
        if venue.get("lat") and venue.get("lng") and venue.get("neighborhood") and venue.get("spot_type"):
            print("  Skipping: already complete")
            stats["skipped"] += 1
            continue

        try:
            result = enrich_venue_by_name(venue, dry_run=dry_run)
            if result:
                stats["enriched"] += 1
                if dry_run:
                    print(f"  [DRY RUN] Would update with: neighborhood={result.get('neighborhood')}, type={result.get('spot_type')}")
                else:
                    print(f"  Updated: neighborhood={result.get('neighborhood')}, type={result.get('spot_type')}")
            else:
                stats["failed"] += 1
        except Exception as e:
            print(f"  Error: {e}")
            stats["failed"] += 1

        # Rate limit: 1 request per second
        time.sleep(1)

    return stats


def enrich_address_venues(limit: int = 50, dry_run: bool = False) -> dict:
    """
    Find venues that look like addresses and try to find the real venue name.
    """
    client = get_client()

    # Get all incomplete venues
    result = client.table("venues").select("*").eq("active", True).or_(
        "neighborhood.is.null,spot_type.is.null"
    ).order("name").execute()

    venues = result.data or []

    # Filter to address-like names
    address_pattern = re.compile(r'^\d+\s+[\w\s]+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Pkwy|Circle|Court|Ct|Place|Pl)', re.IGNORECASE)
    address_venues = [v for v in venues if address_pattern.match(v.get("name", ""))][:limit]

    stats = {
        "total": len(address_venues),
        "enriched": 0,
        "failed": 0,
        "renamed": 0,
    }

    print(f"\nFound {len(address_venues)} address-like venues to process")
    print("=" * 60)

    for i, venue in enumerate(address_venues, 1):
        print(f"\n[{i}/{len(address_venues)}] {venue['name']}")

        try:
            place = search_google_places(f"{venue['name']}, Atlanta, GA")

            if place:
                found_name = place.get("displayName", {}).get("text", "")
                found_address = place.get("formattedAddress", "")

                # Check if Google found a real venue (not just the address)
                google_types = place.get("types", [])
                is_establishment = any(t in google_types for t in [
                    "bar", "restaurant", "cafe", "night_club", "museum", "art_gallery",
                    "performing_arts_theater", "movie_theater", "bowling_alley", "gym",
                    "book_store", "brewery", "stadium", "park"
                ])

                if is_establishment and found_name != venue["name"]:
                    print(f"  Found venue: {found_name}")
                    print(f"  Address: {found_address}")

                    updates = enrich_venue(venue["id"], place, dry_run=dry_run)

                    # Also update the name if it's different
                    if not dry_run:
                        # Generate new slug
                        new_slug = re.sub(r'[^a-z0-9]+', '-', found_name.lower()).strip('-')
                        client.table("venues").update({
                            "name": found_name,
                            "slug": new_slug,
                        }).eq("id", venue["id"]).execute()

                    stats["enriched"] += 1
                    stats["renamed"] += 1
                    print(f"  {'[DRY RUN] Would rename' if dry_run else 'Renamed'}: {venue['name']} -> {found_name}")
                else:
                    print("  No establishment found at this address")
                    stats["failed"] += 1
            else:
                print("  No Google results")
                stats["failed"] += 1

        except Exception as e:
            print(f"  Error: {e}")
            stats["failed"] += 1

        time.sleep(1)

    return stats


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Enrich venue data via Google Places")
    parser.add_argument("--limit", type=int, default=50, help="Max venues to process")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually update database")
    parser.add_argument("--addresses", action="store_true", help="Process address-like venue names")

    args = parser.parse_args()

    if not GOOGLE_API_KEY:
        print("Error: GOOGLE_PLACES_API_KEY environment variable not set")
        print("Set it with: export GOOGLE_PLACES_API_KEY=your_key_here")
        exit(1)

    if args.addresses:
        stats = enrich_address_venues(limit=args.limit, dry_run=args.dry_run)
    else:
        stats = enrich_incomplete_venues(limit=args.limit, dry_run=args.dry_run)

    print("\n" + "=" * 60)
    print("ENRICHMENT COMPLETE")
    print("=" * 60)
    print(f"Total processed: {stats['total']}")
    print(f"Enriched: {stats['enriched']}")
    print(f"Failed: {stats['failed']}")
    if "renamed" in stats:
        print(f"Renamed: {stats['renamed']}")
    if "skipped" in stats:
        print(f"Skipped: {stats['skipped']}")
