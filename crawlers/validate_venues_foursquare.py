#!/usr/bin/env python3
"""
Validate venue data against Foursquare Places API.

Compares our venue data with Foursquare to:
1. Verify websites match
2. Flag potential mismatches (name, address)
3. Find missing data we could fill

Usage:
    python validate_venues_foursquare.py --limit 50
    python validate_venues_foursquare.py --venue-type restaurant
    python validate_venues_foursquare.py --fix  # Apply corrections
    python validate_venues_foursquare.py --find-missing  # Find venues missing websites
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
from db import get_client

# Load .env file from project root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

FOURSQUARE_API_KEY = os.environ.get("FOURSQUARE_API_KEY", "")
FOURSQUARE_API_BASE = "https://places-api.foursquare.com"
FOURSQUARE_API_VERSION = "2025-06-17"

# Atlanta center coordinates
ATLANTA_LAT = 33.749
ATLANTA_LNG = -84.388


def normalize_url(url: str) -> str:
    """Normalize URL for comparison."""
    if not url:
        return ""
    url = url.lower().strip()
    # Remove protocol
    url = url.replace("https://", "").replace("http://", "")
    # Remove www.
    url = url.replace("www.", "")
    # Remove trailing slash
    url = url.rstrip("/")
    return url


def get_domain(url: str) -> str:
    """Extract domain from URL."""
    url_norm = normalize_url(url)
    if not url_norm:
        return ""
    # Get just the domain part
    domain = url_norm.split("/")[0]
    return domain


def normalize_name(name: str) -> str:
    """Normalize venue name for comparison."""
    if not name:
        return ""
    name = name.lower().strip()
    # Remove common suffixes
    for suffix in [" atlanta", " atl", " - atlanta", " (atlanta)"]:
        name = name.replace(suffix, "")
    # Remove location qualifiers in parens
    import re
    name = re.sub(r'\s*\([^)]+\)\s*$', '', name)
    return name


def name_similarity(name1: str, name2: str) -> float:
    """Calculate name similarity (0-1)."""
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)

    if not n1 or not n2:
        return 0.0

    # Exact match
    if n1 == n2:
        return 1.0

    # One contains the other
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


def search_foursquare(query: str, lat: float, lng: float) -> Optional[dict]:
    """Search Foursquare for a venue."""
    if not FOURSQUARE_API_KEY:
        return None

    try:
        response = requests.get(
            f"{FOURSQUARE_API_BASE}/places/search",
            params={
                "query": query,
                "ll": f"{lat},{lng}",
                "radius": 5000,  # 5km for tighter matching
                "limit": 3,  # Get top 3 to compare
            },
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
            return None

        response.raise_for_status()
        data = response.json()
        results = data.get("results", [])

        # Return best match by name
        if not results:
            return None

        # Score each result by name similarity
        query_norm = normalize_name(query)
        best_match = None
        best_score = 0

        for r in results:
            score = name_similarity(query, r.get("name", ""))
            if score > best_score:
                best_score = score
                best_match = r

        # Only return if reasonably confident match
        if best_score >= 0.5:
            return best_match

        # Fallback to first result if name starts same
        first = results[0]
        if normalize_name(first.get("name", ""))[:8] == query_norm[:8]:
            return first

        return None

    except Exception as e:
        logger.debug(f"Search error: {e}")
        return None


def get_venues_to_validate(
    venue_type: Optional[str] = None,
    limit: int = 50,
    with_website: bool = True,
    without_website: bool = False,
) -> list[dict]:
    """Get venues to validate against Foursquare."""
    client = get_client()

    query = client.table("venues").select(
        "id, name, slug, address, city, lat, lng, website, foursquare_id, venue_type"
    ).eq("active", True).eq("city", "Atlanta")

    if without_website:
        query = query.is_("website", "null")
    elif with_website:
        query = query.not_.is_("website", "null")

    if venue_type:
        query = query.eq("venue_type", venue_type)

    query = query.limit(limit)

    result = query.execute()
    return result.data or []


def update_venue(venue_id: int, updates: dict) -> bool:
    """Update venue with corrections."""
    client = get_client()
    try:
        client.table("venues").update(updates).eq("id", venue_id).execute()
        return True
    except Exception as e:
        logger.error(f"Update error: {e}")
        return False


def validate_venue(venue: dict, fix: bool = False, find_missing: bool = False) -> dict:
    """
    Validate a single venue against Foursquare.

    Returns validation result with:
    - status: 'match', 'mismatch', 'not_found', 'missing_data', 'filled'
    - issues: list of specific issues found
    - suggestions: dict of suggested fixes
    """
    result = {
        "venue_id": venue["id"],
        "venue_name": venue["name"],
        "status": "unknown",
        "issues": [],
        "suggestions": {},
    }

    lat = venue.get("lat") or ATLANTA_LAT
    lng = venue.get("lng") or ATLANTA_LNG

    # Search Foursquare
    fsq = search_foursquare(venue["name"], lat, lng)

    if not fsq:
        result["status"] = "not_found"
        result["issues"].append("Not found on Foursquare")
        return result

    fsq_name = fsq.get("name", "")
    fsq_website = fsq.get("website", "")
    fsq_id = fsq.get("fsq_place_id", "")
    fsq_location = fsq.get("location", {})
    fsq_address = fsq_location.get("address", "")

    our_website = venue.get("website", "")
    our_name = venue["name"]

    issues = []
    suggestions = {}

    # Check name similarity
    sim = name_similarity(our_name, fsq_name)
    if sim < 0.8:
        issues.append(f"Name: '{our_name}' vs '{fsq_name}' (similarity: {sim:.1f})")

    # Mode: Find missing websites
    if find_missing and not our_website:
        if fsq_website:
            suggestions["website"] = fsq_website
            result["status"] = "filled"
            result["issues"] = [f"Found website: {fsq_website}"]
            result["suggestions"] = suggestions

            if fix:
                # Also add foursquare_id if missing
                if not venue.get("foursquare_id") and fsq_id:
                    suggestions["foursquare_id"] = fsq_id
                success = update_venue(venue["id"], suggestions)
                if success:
                    result["fixed"] = True
            return result
        else:
            result["status"] = "not_found"
            result["issues"] = ["No website on Foursquare either"]
            return result

    # Normal validation mode
    our_domain = get_domain(our_website)
    fsq_domain = get_domain(fsq_website)

    if our_domain and fsq_domain:
        # Both have websites - compare domains
        if our_domain != fsq_domain:
            # Check for common variations
            our_base = our_domain.replace("atlanta", "").replace("atl", "")
            fsq_base = fsq_domain.replace("atlanta", "").replace("atl", "")

            if our_base != fsq_base:
                issues.append(f"Website: {our_website} vs {fsq_website}")
                # Only suggest if Foursquare's looks more official
                if len(fsq_domain) < len(our_domain) or "official" in fsq_website.lower():
                    suggestions["website"] = fsq_website

    elif not our_domain and fsq_domain:
        # We're missing website
        issues.append(f"Missing website, Foursquare has: {fsq_website}")
        suggestions["website"] = fsq_website

    # Check foursquare_id
    if not venue.get("foursquare_id") and fsq_id:
        suggestions["foursquare_id"] = fsq_id

    # Determine status
    if not issues:
        result["status"] = "match"
    elif suggestions and "Missing" in str(issues):
        result["status"] = "missing_data"
    elif issues:
        result["status"] = "mismatch" if sim >= 0.5 else "wrong_match"
    else:
        result["status"] = "match"

    result["issues"] = issues
    result["suggestions"] = suggestions
    result["fsq_name"] = fsq_name
    result["fsq_website"] = fsq_website
    result["name_similarity"] = sim

    # Apply fixes if requested (only for high-confidence matches)
    if fix and suggestions and sim >= 0.8:
        success = update_venue(venue["id"], suggestions)
        if success:
            result["fixed"] = True

    return result


def main():
    parser = argparse.ArgumentParser(description="Validate venues against Foursquare")
    parser.add_argument("--venue-type", help="Filter by venue type")
    parser.add_argument("--limit", type=int, default=50, help="Max venues to validate")
    parser.add_argument("--fix", action="store_true", help="Apply suggested corrections")
    parser.add_argument("--find-missing", action="store_true", help="Find websites for venues that don't have one")
    args = parser.parse_args()

    if not FOURSQUARE_API_KEY:
        logger.error("FOURSQUARE_API_KEY environment variable not set")
        sys.exit(1)

    logger.info("=" * 70)
    if args.find_missing:
        logger.info("Finding Missing Websites via Foursquare")
    else:
        logger.info("Validating Venues Against Foursquare")
    logger.info("=" * 70)

    venues = get_venues_to_validate(
        args.venue_type,
        args.limit,
        with_website=not args.find_missing,
        without_website=args.find_missing
    )
    logger.info(f"Processing {len(venues)} venues...")
    logger.info("")

    stats = {"match": 0, "mismatch": 0, "not_found": 0, "missing_data": 0, "filled": 0, "wrong_match": 0, "fixed": 0}

    for venue in venues:
        result = validate_venue(venue, fix=args.fix, find_missing=args.find_missing)
        status = result["status"]
        if status in stats:
            stats[status] += 1

        if result.get("fixed"):
            stats["fixed"] += 1

        if status == "match":
            logger.info(f"  ✓ {venue['name']}")
        elif status == "filled":
            logger.info(f"  + {venue['name']}")
            for issue in result["issues"]:
                logger.info(f"      {issue}")
            if result.get("fixed"):
                logger.info(f"      → UPDATED")
        elif status == "not_found":
            logger.info(f"  ? {venue['name']} - Not found")
        elif status == "wrong_match":
            logger.info(f"  ⚠ {venue['name']} - Wrong match on Foursquare")
            for issue in result["issues"]:
                logger.info(f"      {issue}")
        elif status == "missing_data":
            logger.info(f"  + {venue['name']}")
            for issue in result["issues"]:
                logger.info(f"      {issue}")
            if result.get("fixed"):
                logger.info(f"      → UPDATED")
        else:  # mismatch
            logger.info(f"  ✗ {venue['name']}")
            for issue in result["issues"]:
                logger.info(f"      {issue}")

        # Rate limiting
        time.sleep(1.5)

    logger.info("")
    logger.info("=" * 70)
    logger.info("Summary")
    logger.info("=" * 70)
    if args.find_missing:
        logger.info(f"  Websites found:  {stats['filled']}")
        logger.info(f"  Not on FSQ:      {stats['not_found']}")
    else:
        logger.info(f"  Matches:         {stats['match']}")
        logger.info(f"  Mismatches:      {stats['mismatch']}")
        logger.info(f"  Wrong matches:   {stats['wrong_match']}")
        logger.info(f"  Missing data:    {stats['missing_data']}")
        logger.info(f"  Not found:       {stats['not_found']}")
    if args.fix:
        logger.info(f"  Updated:         {stats['fixed']}")


if __name__ == "__main__":
    main()
