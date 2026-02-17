#!/usr/bin/env python3
"""
Backfill parking and transit info for existing venues.

Two-pass approach:
  1. Website scraping — extract parking info from venue websites
  2. OSM fallback — for venues without website parking info, find nearest
     parking facilities from OpenStreetMap data

Usage:
    python3 enrich_parking.py                     # Backfill all venues missing parking
    python3 enrich_parking.py --dry-run            # Preview without writing
    python3 enrich_parking.py --limit 20           # Process at most 20 venues
    python3 enrich_parking.py --slug fox-theatre   # Single venue
    python3 enrich_parking.py --osm-only           # Only run OSM pass (skip scraping)
    python3 enrich_parking.py --force              # Re-enrich even if already populated
"""

from __future__ import annotations

import sys
import json
import math
import time
import logging
import argparse
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))

from db import get_client
from parking_extract import extract_parking_info

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OSM parking data
# ---------------------------------------------------------------------------

OSM_CACHE_PATH = Path(__file__).parent / ".osm_parking_cache.json"

# Atlanta bounding box
ATL_BBOX = (33.60, -84.60, 33.95, -84.20)

OVERPASS_QUERY = """
[out:json][timeout:30];
nwr["amenity"="parking"]({s},{w},{n},{e});
out center tags;
""".strip()


def _fetch_osm_parking() -> list[dict]:
    """Fetch all parking facilities from OSM via Overpass API. Cached to disk."""
    if OSM_CACHE_PATH.exists():
        age_hours = (time.time() - OSM_CACHE_PATH.stat().st_mtime) / 3600
        if age_hours < 24 * 7:  # Cache for 1 week
            logger.info(f"Using cached OSM data ({OSM_CACHE_PATH})")
            with open(OSM_CACHE_PATH) as f:
                return json.load(f)

    import requests

    logger.info("Fetching OSM parking data for Atlanta metro...")
    s, w, n, e = ATL_BBOX
    query = OVERPASS_QUERY.format(s=s, w=w, n=n, e=e)

    resp = requests.post(
        "https://overpass-api.de/api/interpreter",
        data={"data": query},
        timeout=60,
    )
    resp.raise_for_status()
    elements = resp.json().get("elements", [])

    # Normalize to simple dicts with coords
    parking = []
    for el in elements:
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if not lat or not lon:
            continue
        tags = el.get("tags", {})
        parking.append(
            {
                "lat": lat,
                "lon": lon,
                "type": tags.get("parking", "unknown"),
                "fee": tags.get("fee"),
                "access": tags.get("access"),
                "name": tags.get("name", tags.get("operator")),
                "capacity": tags.get("capacity"),
            }
        )

    # Cache to disk
    with open(OSM_CACHE_PATH, "w") as f:
        json.dump(parking, f)
    logger.info(f"Cached {len(parking)} OSM parking facilities")

    return parking


def _haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3959  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def _walk_minutes(miles: float) -> int:
    """Estimate walking time. ~3 mph average walking speed."""
    return max(1, round(miles * 20))


# Map OSM parking types to our types
OSM_TYPE_MAP = {
    "surface": "lot",
    "multi-storey": "deck",
    "underground": "garage",
    "street_side": "street",
    "lane": "street",
    "garage": "garage",
    "rooftop": "deck",
}


def _osm_parking_for_venue(
    venue_lat: float, venue_lng: float, osm_data: list[dict], radius_miles: float = 0.3
) -> Optional[dict]:
    """Find nearest parking from OSM data and generate a parking note."""
    nearby = []
    for p in osm_data:
        dist = _haversine_miles(venue_lat, venue_lng, p["lat"], p["lon"])
        if dist <= radius_miles:
            nearby.append((dist, p))

    if not nearby:
        return None

    nearby.sort(key=lambda x: x[0])

    # Classify what's available
    parking_types: list[str] = []
    has_free = False
    has_paid = False
    closest_dist = nearby[0][0]
    closest_walk = _walk_minutes(closest_dist)

    for dist, p in nearby[:10]:  # Look at up to 10 nearest
        ptype = OSM_TYPE_MAP.get(p["type"], "available")
        if ptype not in parking_types:
            parking_types.append(ptype)
        if p.get("fee") == "no":
            has_free = True
        elif p.get("fee") == "yes":
            has_paid = True

    if not parking_types:
        parking_types = ["available"]

    # Build a human-readable note
    parts = []
    # Mention closest
    closest_type = OSM_TYPE_MAP.get(nearby[0][1]["type"], "parking")
    closest_name = nearby[0][1].get("name")
    if closest_name:
        parts.append(f"Nearest: {closest_name} ({closest_type}, {closest_walk} min walk)")
    else:
        parts.append(f"Nearest {closest_type} is {closest_walk} min walk")

    # Count by type
    type_counts: dict[str, int] = {}
    for _, p in nearby:
        t = OSM_TYPE_MAP.get(p["type"], "other")
        type_counts[t] = type_counts.get(t, 0) + 1

    type_summary = ", ".join(
        f"{count} {t}{'s' if count > 1 else ''}" for t, count in type_counts.items() if t != "other"
    )
    if type_summary:
        parts.append(f"{len(nearby)} options within walking distance ({type_summary})")

    if has_free:
        parts.append("Free parking available nearby")
    elif has_paid:
        parts.append("Paid parking nearby")

    parking_free: Optional[bool] = None
    if has_free:
        parking_free = True
    elif has_paid and not has_free:
        parking_free = False

    return {
        "parking_note": ". ".join(parts),
        "parking_type": parking_types,
        "parking_free": parking_free,
        "parking_source": "osm",
        "transit_note": None,
    }


# ---------------------------------------------------------------------------
# Main backfill logic
# ---------------------------------------------------------------------------


def backfill(
    dry_run: bool = False,
    limit: int = 0,
    slug: Optional[str] = None,
    osm_only: bool = False,
    force: bool = False,
) -> dict:
    client = get_client()
    stats = {"scraped": 0, "osm": 0, "skipped": 0, "failed": 0, "total": 0}

    # Fetch venues to process
    # Try with parking columns first; fall back if migration hasn't run yet
    has_parking_cols = True
    try:
        query = client.table("venues").select(
            "id, name, slug, website, lat, lng, parking_note, parking_source"
        )
        if slug:
            query = query.eq("slug", slug)
        if not force:
            query = query.is_("parking_note", "null")
        result = query.order("id").execute()
    except Exception:
        has_parking_cols = False
        logger.info("parking columns not found — run migration first for filtering")
        query = client.table("venues").select(
            "id, name, slug, website, lat, lng"
        )
        if slug:
            query = query.eq("slug", slug)
        result = query.order("id").execute()

    venues = result.data or []

    if limit:
        venues = venues[:limit]

    stats["total"] = len(venues)
    logger.info(f"Processing {len(venues)} venues")

    # Load OSM data (needed for fallback)
    osm_data: list[dict] = []
    if not osm_only:
        # Will load lazily if needed
        pass

    for i, venue in enumerate(venues):
        name = venue.get("name", "?")
        vid = venue["id"]

        if i > 0 and i % 50 == 0:
            logger.info(f"  ...processed {i}/{len(venues)}")

        # Pass 1: Try website scraping
        parking_info = None
        if not osm_only and venue.get("website"):
            try:
                parking_info = extract_parking_info(venue["website"])
                if parking_info:
                    parking_info["parking_source"] = "scraped"
            except Exception as e:
                logger.debug(f"  Scrape failed for {name}: {e}")

            # Rate-limit website fetches
            time.sleep(0.3)

        # Pass 2: OSM fallback
        if not parking_info and venue.get("lat") and venue.get("lng"):
            if not osm_data:
                osm_data = _fetch_osm_parking()
            try:
                parking_info = _osm_parking_for_venue(
                    float(venue["lat"]), float(venue["lng"]), osm_data
                )
            except Exception as e:
                logger.debug(f"  OSM lookup failed for {name}: {e}")

        if not parking_info:
            stats["skipped"] += 1
            continue

        source = parking_info.get("parking_source", "unknown")
        note_preview = parking_info["parking_note"][:80]
        logger.info(f"  [{source}] {name}: {note_preview}")

        if dry_run:
            if source == "scraped":
                stats["scraped"] += 1
            else:
                stats["osm"] += 1
            continue

        # Write to database
        try:
            update_data: dict = {
                "parking_note": parking_info["parking_note"],
                "parking_type": parking_info["parking_type"],
                "parking_free": parking_info["parking_free"],
                "parking_source": parking_info["parking_source"],
            }
            if parking_info.get("transit_note"):
                update_data["transit_note"] = parking_info["transit_note"]

            client.table("venues").update(update_data).eq("id", vid).execute()

            if source == "scraped":
                stats["scraped"] += 1
            else:
                stats["osm"] += 1
        except Exception as e:
            logger.warning(f"  Failed to update {name}: {e}")
            stats["failed"] += 1

    logger.info(
        f"\nDone: {stats['scraped']} scraped, {stats['osm']} OSM, "
        f"{stats['skipped']} skipped, {stats['failed']} failed "
        f"(of {stats['total']} total)"
    )
    return stats


def main():
    parser = argparse.ArgumentParser(description="Backfill venue parking info")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--limit", type=int, default=0, help="Max venues to process (0=all)")
    parser.add_argument("--slug", type=str, help="Only process this venue slug")
    parser.add_argument("--osm-only", action="store_true", help="Skip website scraping, only use OSM")
    parser.add_argument("--force", action="store_true", help="Re-enrich even if parking data exists")
    args = parser.parse_args()

    backfill(
        dry_run=args.dry_run,
        limit=args.limit,
        slug=args.slug,
        osm_only=args.osm_only,
        force=args.force,
    )


if __name__ == "__main__":
    main()
