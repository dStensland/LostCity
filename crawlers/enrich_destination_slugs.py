#!/usr/bin/env python3
"""
Targeted destination enrichment for a list of venue slugs.

Enrichment steps (best-effort, non-destructive):
1. Geocode missing coordinates from address (Nominatim)
2. Foursquare search + details (hours, image, website/phone/instagram, descriptions)
3. Parking backfill (website extraction, then OSM fallback)
4. Transit accessibility fields (MARTA/BeltLine score)

Usage:
    python3 enrich_destination_slugs.py --slugs slug-a,slug-b
    python3 enrich_destination_slugs.py --slugs-file /tmp/slugs.txt
    python3 enrich_destination_slugs.py --slugs slug-a,slug-b --dry-run
"""

from __future__ import annotations

import argparse
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

from db import get_client
from geocode_venues import geocode_address
from hydrate_venues_foursquare import (
    ATLANTA_LAT,
    ATLANTA_LNG,
    CATEGORY_MAP,
    parse_foursquare_hours,
    parse_foursquare_photo,
    search_foursquare,
)
from parking_extract import extract_parking_info
from enrich_parking import _fetch_osm_parking, _osm_parking_for_venue
from enrich_transit import (
    compute_beltline_proximity,
    compute_nearest_marta,
    compute_transit_score,
)

# Load .env from repo root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

FOURSQUARE_API_KEY = os.environ.get("FOURSQUARE_API_KEY", "")
FOURSQUARE_API_BASE = "https://places-api.foursquare.com"
FOURSQUARE_API_VERSION = "2025-06-17"


def _read_slugs_from_file(path: str) -> List[str]:
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    return [line.strip() for line in lines if line.strip() and not line.strip().startswith("#")]


def _safe_update(client: Any, venue_id: int, updates: Dict[str, Any], dry_run: bool) -> None:
    if not updates:
        return
    if dry_run:
        return
    client.table("venues").update(updates).eq("id", venue_id).execute()


def _maybe_geocode(venue: Dict[str, Any]) -> Dict[str, Any]:
    if venue.get("lat") is not None and venue.get("lng") is not None:
        return {}
    address = venue.get("address")
    if not address:
        return {}
    coords = geocode_address(
        address=address,
        city=venue.get("city") or "Atlanta",
        state=venue.get("state") or "GA",
    )
    if not coords:
        return {}
    lat, lng = coords
    return {"lat": lat, "lng": lng}


def _maybe_foursquare_enrich(venue: Dict[str, Any]) -> Dict[str, Any]:
    if not FOURSQUARE_API_KEY:
        return {}

    lat = venue.get("lat") if venue.get("lat") is not None else ATLANTA_LAT
    lng = venue.get("lng") if venue.get("lng") is not None else ATLANTA_LNG
    query_name = venue.get("name") or ""

    search_result = search_foursquare(
        query=query_name,
        lat=float(lat),
        lng=float(lng),
        categories=CATEGORY_MAP.get(venue.get("venue_type")),
    )
    if not search_result:
        return {}

    updates: Dict[str, Any] = {}
    fsq_id = search_result.get("fsq_place_id") or search_result.get("fsq_id")
    if fsq_id:
        updates["foursquare_id"] = fsq_id

    details = _get_foursquare_details_with_backoff(fsq_id) if fsq_id else None
    payload = details or search_result

    # Hours
    if not venue.get("hours"):
        hours, hours_display = parse_foursquare_hours(payload.get("hours"))
        if hours:
            updates["hours"] = hours
        if hours_display:
            updates["hours_display"] = hours_display

    # Image
    if not venue.get("image_url"):
        photo = parse_foursquare_photo(payload.get("photos"))
        if photo:
            updates["image_url"] = photo

    # Website/phone/instagram
    if not venue.get("website"):
        website = payload.get("website")
        if website:
            updates["website"] = website
    if not venue.get("phone"):
        phone = payload.get("tel") or payload.get("nationalPhoneNumber")
        if phone:
            updates["phone"] = phone
    if not venue.get("instagram"):
        social = payload.get("social_media") or {}
        ig = social.get("instagram")
        if ig:
            updates["instagram"] = ig

    # Descriptions
    if not venue.get("short_description"):
        desc = payload.get("description")
        if desc:
            updates["short_description"] = desc[:500]
    if not venue.get("description"):
        short_desc = payload.get("description")
        if short_desc:
            updates["description"] = short_desc[:1000]

    return updates


def _get_foursquare_details_with_backoff(fsq_id: str) -> Optional[Dict[str, Any]]:
    if not fsq_id or not FOURSQUARE_API_KEY:
        return None

    fields = "fsq_place_id,name,location,hours,photos,price,rating,description,tel,website,social_media"
    backoffs = [3, 6, 12]
    for attempt in range(len(backoffs) + 1):
        try:
            response = requests.get(
                f"{FOURSQUARE_API_BASE}/places/{fsq_id}",
                params={"fields": fields},
                headers={
                    "Authorization": f"Bearer {FOURSQUARE_API_KEY}",
                    "Accept": "application/json",
                    "X-Places-Api-Version": FOURSQUARE_API_VERSION,
                },
                timeout=12,
            )
            if response.status_code == 429:
                if attempt < len(backoffs):
                    delay = backoffs[attempt]
                    logger.warning("Foursquare 429 for %s, retrying in %ss", fsq_id, delay)
                    time.sleep(delay)
                    continue
                return None

            response.raise_for_status()
            return response.json()
        except Exception:
            if attempt < len(backoffs):
                delay = backoffs[attempt]
                time.sleep(delay)
                continue
            return None

    return None


def _maybe_parking_enrich(
    venue: Dict[str, Any],
    osm_data: Optional[List[Dict[str, Any]]],
) -> Dict[str, Any]:
    if venue.get("parking_note"):
        return {}

    # Website scraping first
    website = venue.get("website")
    if website:
        parking = extract_parking_info(website)
        if parking:
            updates: Dict[str, Any] = {
                "parking_note": parking.get("parking_note"),
                "parking_type": parking.get("parking_type"),
                "parking_free": parking.get("parking_free"),
                "parking_source": "scraped",
            }
            if parking.get("transit_note"):
                updates["transit_note"] = parking.get("transit_note")
            return updates

    # OSM fallback
    lat = venue.get("lat")
    lng = venue.get("lng")
    if lat is None or lng is None or not osm_data:
        return {}

    parking = _osm_parking_for_venue(float(lat), float(lng), osm_data)
    if not parking:
        return {}
    return {
        "parking_note": parking.get("parking_note"),
        "parking_type": parking.get("parking_type"),
        "parking_free": parking.get("parking_free"),
        "parking_source": parking.get("parking_source"),
    }


def _transit_updates(venue: Dict[str, Any]) -> Dict[str, Any]:
    lat = venue.get("lat")
    lng = venue.get("lng")
    if lat is None or lng is None:
        return {}

    marta = compute_nearest_marta(float(lat), float(lng))
    beltline = compute_beltline_proximity(float(lat), float(lng))
    score = compute_transit_score(
        marta=marta,
        beltline=beltline,
        parking_free=venue.get("parking_free"),
        has_parking=bool(venue.get("parking_note")),
    )

    updates: Dict[str, Any] = {"transit_score": score}
    if marta:
        updates["nearest_marta_station"] = marta["nearest_marta_station"]
        updates["marta_walk_minutes"] = marta["marta_walk_minutes"]
        updates["marta_lines"] = marta["marta_lines"]
    if beltline:
        updates["beltline_adjacent"] = True
        updates["beltline_segment"] = beltline["beltline_segment"]
        updates["beltline_walk_minutes"] = beltline["beltline_walk_minutes"]
    return updates


def enrich_slugs(slugs: List[str], dry_run: bool = False) -> Dict[str, int]:
    client = get_client()
    rows = (
        client.table("venues")
        .select("*")
        .in_("slug", slugs)
        .execute()
        .data
        or []
    )
    by_slug = {row["slug"]: row for row in rows}

    osm_data: Optional[List[Dict[str, Any]]] = None
    stats = {
        "requested": len(slugs),
        "found": len(rows),
        "updated": 0,
        "missing": 0,
    }

    for slug in slugs:
        venue = by_slug.get(slug)
        if not venue:
            logger.warning("MISSING slug: %s", slug)
            stats["missing"] += 1
            continue

        original = dict(venue)
        merged_updates: Dict[str, Any] = {}

        # 1) geocode
        geo_updates = _maybe_geocode(venue)
        if geo_updates:
            merged_updates.update(geo_updates)
            venue = {**venue, **geo_updates}

        # 2) foursquare
        fsq_updates = _maybe_foursquare_enrich(venue)
        if fsq_updates:
            merged_updates.update({k: v for k, v in fsq_updates.items() if v is not None})
            venue = {**venue, **fsq_updates}

        # 3) parking
        if venue.get("parking_note") is None:
            if osm_data is None:
                osm_data = _fetch_osm_parking()
            parking_updates = _maybe_parking_enrich(venue, osm_data)
            if parking_updates:
                merged_updates.update({k: v for k, v in parking_updates.items() if v is not None})
                venue = {**venue, **parking_updates}

        # 4) transit
        transit_updates = _transit_updates(venue)
        # Always update transit fields; they're deterministic
        if transit_updates:
            merged_updates.update(transit_updates)

        # Strip no-op updates where value is unchanged
        no_op_keys = [k for k, v in merged_updates.items() if original.get(k) == v]
        for k in no_op_keys:
            merged_updates.pop(k, None)

        if merged_updates:
            logger.info("ENRICH %-32s -> %s", slug, ", ".join(sorted(merged_updates.keys())))
            _safe_update(client, venue["id"], merged_updates, dry_run=dry_run)
            stats["updated"] += 1
        else:
            logger.info("SKIP   %-32s -> no changes", slug)

        # Respect API rate limits (Foursquare details endpoint is strict).
        time.sleep(2.0)

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Targeted enrichment for destination slugs")
    parser.add_argument("--slugs", type=str, help="Comma-separated slugs")
    parser.add_argument("--slugs-file", type=str, help="Path to newline-delimited slug file")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB updates")
    args = parser.parse_args()

    slugs: List[str] = []
    if args.slugs:
        slugs.extend([s.strip() for s in args.slugs.split(",") if s.strip()])
    if args.slugs_file:
        slugs.extend(_read_slugs_from_file(args.slugs_file))
    slugs = list(dict.fromkeys(slugs))

    if not slugs:
        raise SystemExit("No slugs provided. Use --slugs or --slugs-file.")

    logger.info("=" * 72)
    logger.info("Destination Enrichment")
    logger.info("Mode: %s", "DRY RUN" if args.dry_run else "APPLY")
    logger.info("Foursquare key: %s", "available" if FOURSQUARE_API_KEY else "missing")
    logger.info("=" * 72)

    stats = enrich_slugs(slugs=slugs, dry_run=args.dry_run)

    logger.info("")
    logger.info("=" * 72)
    logger.info("Summary")
    logger.info("Requested: %d", stats["requested"])
    logger.info("Found: %d", stats["found"])
    logger.info("Updated: %d", stats["updated"])
    logger.info("Missing: %d", stats["missing"])
    logger.info("=" * 72)


if __name__ == "__main__":
    main()
