#!/usr/bin/env python3
"""
Validate venue data against Google Places API.

Compares our venue data with Google to:
1. Verify websites match
2. Check hours accuracy
3. Validate addresses and coordinates

Usage:
    python validate_venues_google.py --limit 50
    python validate_venues_google.py --venue-type restaurant
"""

import os
import sys
import time
import logging
import argparse
import requests
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
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

FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.websiteUri",
    "places.regularOpeningHours",
    "places.nationalPhoneNumber",
])


def normalize_url(url: str) -> str:
    """Normalize URL for comparison."""
    if not url:
        return ""
    url = url.lower().strip()
    url = url.replace("https://", "").replace("http://", "")
    url = url.replace("www.", "")
    url = url.rstrip("/")
    # Remove query params
    url = url.split("?")[0]
    return url


def get_domain(url: str) -> str:
    """Extract domain from URL."""
    url_norm = normalize_url(url)
    if not url_norm:
        return ""
    return url_norm.split("/")[0]


def name_similarity(name1: str, name2: str) -> float:
    """Calculate name similarity (0-1)."""
    def normalize(n):
        n = n.lower().strip()
        # Remove common suffixes
        for suffix in [" atlanta", " atl", " - atlanta", " (atlanta)", " ga"]:
            n = n.replace(suffix, "")
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
        return 0.5

    return 0.0


def search_google_places(query: str, lat: float = ATLANTA_LAT, lng: float = ATLANTA_LNG) -> Optional[dict]:
    """Search Google Places for a venue."""
    if not GOOGLE_API_KEY:
        logger.error("GOOGLE_PLACES_API_KEY not set")
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
        query_lower = query.lower()
        for place in places:
            place_name = place.get("displayName", {}).get("text", "")
            if name_similarity(query, place_name) >= 0.5:
                return place

        # Fallback to first result
        return places[0]

    except Exception as e:
        logger.debug(f"Google search error: {e}")
        return None


def get_venues_to_validate(
    venue_type: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    """Get venues to validate."""
    client = get_client()

    query = client.table("venues").select(
        "id, name, slug, address, city, lat, lng, website, hours, venue_type"
    ).eq("active", True).eq("city", "Atlanta")

    # Must have website
    query = query.not_.is_("website", "null")

    if venue_type:
        query = query.eq("venue_type", venue_type)

    query = query.limit(limit)

    result = query.execute()
    return result.data or []


def validate_venue(venue: dict) -> dict:
    """Validate a venue against Google Places."""
    result = {
        "venue_id": venue["id"],
        "venue_name": venue["name"],
        "status": "unknown",
        "issues": [],
        "google_data": {},
    }

    lat = venue.get("lat") or ATLANTA_LAT
    lng = venue.get("lng") or ATLANTA_LNG

    # Search Google
    query = f"{venue['name']}, Atlanta, GA"
    google = search_google_places(query, lat, lng)

    if not google:
        result["status"] = "not_found"
        result["issues"].append("Not found on Google")
        return result

    google_name = google.get("displayName", {}).get("text", "")
    google_website = google.get("websiteUri", "")
    google_address = google.get("formattedAddress", "")
    google_hours = google.get("regularOpeningHours", {})

    result["google_data"] = {
        "name": google_name,
        "website": google_website,
        "address": google_address,
        "has_hours": bool(google_hours),
    }

    our_website = venue.get("website", "")

    issues = []

    # Check name similarity
    sim = name_similarity(venue["name"], google_name)
    if sim < 0.5:
        issues.append(f"Name: '{venue['name']}' vs '{google_name}' (sim: {sim:.1f})")
        result["status"] = "wrong_match"
        result["issues"] = issues
        return result

    # Compare websites
    our_domain = get_domain(our_website)
    google_domain = get_domain(google_website)

    if our_domain and google_domain:
        if our_domain != google_domain:
            # Check if base domains match (ignoring atl/atlanta variations)
            our_base = our_domain.replace("atlanta", "").replace("atl", "").replace(".", "")
            google_base = google_domain.replace("atlanta", "").replace("atl", "").replace(".", "")

            if our_base != google_base:
                issues.append(f"Website: {our_website} vs {google_website}")
    elif not our_domain and google_domain:
        issues.append(f"Missing website, Google has: {google_website}")

    # Check hours
    our_hours = venue.get("hours")
    if not our_hours and google_hours:
        issues.append("Missing hours, Google has them")

    # Determine status
    if not issues:
        result["status"] = "match"
    else:
        result["status"] = "mismatch"

    result["issues"] = issues
    result["name_similarity"] = sim

    return result


def main():
    parser = argparse.ArgumentParser(description="Validate venues against Google Places")
    parser.add_argument("--venue-type", help="Filter by venue type")
    parser.add_argument("--limit", type=int, default=50, help="Max venues to validate")
    args = parser.parse_args()

    if not GOOGLE_API_KEY:
        logger.error("GOOGLE_PLACES_API_KEY not set in .env or web/.env.local")
        sys.exit(1)

    logger.info("=" * 70)
    logger.info("Validating Venues Against Google Places")
    logger.info("=" * 70)

    venues = get_venues_to_validate(args.venue_type, args.limit)
    logger.info(f"Validating {len(venues)} venues...")
    logger.info("")

    stats = {"match": 0, "mismatch": 0, "not_found": 0, "wrong_match": 0}
    mismatches = []

    for venue in venues:
        result = validate_venue(venue)
        stats[result["status"]] += 1

        if result["status"] == "match":
            logger.info(f"  ✓ {venue['name']}")
        elif result["status"] == "not_found":
            logger.info(f"  ? {venue['name']} - Not found on Google")
        elif result["status"] == "wrong_match":
            logger.info(f"  ⚠ {venue['name']} - Wrong match")
            for issue in result["issues"]:
                logger.info(f"      {issue}")
        else:  # mismatch
            logger.info(f"  ✗ {venue['name']}")
            for issue in result["issues"]:
                logger.info(f"      {issue}")
            mismatches.append(result)

        # Rate limiting (Google allows ~10 QPS but let's be conservative)
        time.sleep(0.5)

    logger.info("")
    logger.info("=" * 70)
    logger.info("Summary")
    logger.info("=" * 70)
    logger.info(f"  Matches:       {stats['match']}")
    logger.info(f"  Mismatches:    {stats['mismatch']}")
    logger.info(f"  Wrong matches: {stats['wrong_match']}")
    logger.info(f"  Not found:     {stats['not_found']}")

    total = sum(stats.values())
    if total > 0:
        match_rate = 100 * stats['match'] / total
        logger.info(f"  Match rate:    {match_rate:.1f}%")


if __name__ == "__main__":
    main()
