#!/usr/bin/env python3
"""
Backfill Tier 1 venue data: neighborhoods (from coords) and descriptions/images (from websites).

Targets active destination-type venues in GA that are missing these fields.

Usage:
    python3 scripts/backfill_tier1_venue_data.py --dry-run
    python3 scripts/backfill_tier1_venue_data.py --neighborhoods-only --dry-run
    python3 scripts/backfill_tier1_venue_data.py --web-metadata-only --limit 50
    python3 scripts/backfill_tier1_venue_data.py  # all fixes, production write
"""

import argparse
import logging
import sys
import time

# Add parent dir to path for imports
sys.path.insert(0, ".")

from db.client import get_client
from neighborhood_lookup import infer_neighborhood_from_coords

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

DESTINATION_TYPES = [
    "museum", "gallery", "park", "garden", "brewery", "distillery", "winery",
    "cinema", "music_venue", "comedy_club", "nightclub", "arena", "food_hall",
    "farmers_market", "convention_center", "event_space", "entertainment",
    "bowling", "arcade", "theater", "zoo", "aquarium", "theme_park",
    "sports_bar", "rec_center", "community_center", "library", "bookstore",
    "record_store", "studio", "fitness_center",
]


def fetch_destination_venues(client) -> list[dict]:
    """Fetch all active GA destination-type venues."""
    seen_ids: set[int] = set()
    venues: list[dict] = []

    for vtype in DESTINATION_TYPES:
        batch = (
            client.table("places")
            .select("id,name,slug,description,neighborhood,website,image_url,lat,lng,place_type")
            .eq("place_type", vtype)
            .eq("state", "GA")
            .eq("is_active", True)
            .limit(1000)
            .execute()
        )
        for v in (batch.data or []):
            if v["id"] not in seen_ids:
                seen_ids.add(v["id"])
                venues.append(v)

    return venues


def backfill_neighborhoods(client, venues: list[dict], *, dry_run: bool) -> dict:
    """Fill neighborhood from lat/lng for venues missing it."""
    stats = {"candidates": 0, "filled": 0, "no_match": 0}

    candidates = [v for v in venues if not v.get("neighborhood") and v.get("lat") and v.get("lng")]
    stats["candidates"] = len(candidates)
    logger.info(f"Neighborhood backfill: {len(candidates)} candidates")

    for v in candidates:
        hood = infer_neighborhood_from_coords(v["lat"], v["lng"])
        if hood:
            if dry_run:
                logger.debug(f"  [DRY] {v['name']}: → {hood}")
            else:
                client.table("places").update({"neighborhood": hood}).eq("id", v["id"]).execute()
            stats["filled"] += 1
        else:
            stats["no_match"] += 1
            logger.debug(f"  No match: {v['name']} ({v['lat']}, {v['lng']})")

    logger.info(f"Neighborhoods: {stats['filled']} filled, {stats['no_match']} no match")
    return stats


def fetch_web_metadata(url: str) -> dict:
    """Fetch description and og:image from a venue website."""
    result: dict = {"description": None, "og_image": None}
    try:
        import requests
        from bs4 import BeautifulSoup

        resp = requests.get(
            url,
            timeout=8,
            allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
        )
        if resp.status_code != 200:
            return result
        soup = BeautifulSoup(resp.text, "html.parser")

        # Description
        for attr_key, attr_val in [
            ("name", "description"),
            ("property", "og:description"),
            ("name", "twitter:description"),
        ]:
            meta = soup.find("meta", attrs={attr_key: attr_val})
            if meta and meta.get("content", "").strip():
                desc = meta["content"].strip()
                if len(desc) >= 30:
                    lower = desc.lower()
                    if any(lower.startswith(p) for p in [
                        "welcome to", "just another", "coming soon", "page not found",
                        "website coming", "under construction",
                    ]):
                        continue
                    result["description"] = desc[:500]
                    break

        # og:image
        for tag_attr in [("property", "og:image"), ("name", "twitter:image")]:
            tag = soup.find("meta", attrs={tag_attr[0]: tag_attr[1]})
            if tag:
                img = (tag.get("content") or "").strip()
                if img and img.startswith("http") and not any(x in img.lower() for x in ["placeholder", "default", "logo"]):
                    result["og_image"] = img
                    break

        return result
    except Exception:
        return result


def backfill_web_metadata(client, venues: list[dict], *, dry_run: bool, limit: int = 0) -> dict:
    """Fill description and image_url from venue websites."""
    stats = {"candidates": 0, "scraped": 0, "desc_filled": 0, "img_filled": 0, "no_data": 0, "errors": 0}

    # Venues that have a website but are missing description OR image
    # Prioritize high-value types (entertainment, dining, nightlife) over parks/orgs
    HIGH_VALUE_TYPES = {
        "music_venue", "brewery", "comedy_club", "nightclub", "cinema", "gallery",
        "museum", "food_hall", "entertainment", "theater", "arena", "sports_bar",
        "restaurant", "bar", "distillery", "winery", "coffee_shop", "bookstore",
        "record_store", "bowling", "arcade",
    }
    candidates = [
        v for v in venues
        if v.get("website")
        and (not v.get("description") or not v.get("image_url"))
        # Skip facebook/instagram URLs — they block scrapers
        and not any(x in (v.get("website") or "") for x in ["facebook.com", "instagram.com"])
    ]
    # Sort: high-value types first
    candidates.sort(key=lambda v: (0 if v.get("place_type") in HIGH_VALUE_TYPES else 1, v.get("name", "")))
    if limit:
        candidates = candidates[:limit]
    stats["candidates"] = len(candidates)
    logger.info(f"Web metadata backfill: {len(candidates)} candidates")

    for i, v in enumerate(candidates):
        if i > 0 and i % 50 == 0:
            logger.info(f"  Progress: {i}/{len(candidates)} — desc: {stats['desc_filled']}, img: {stats['img_filled']}")

        meta = fetch_web_metadata(v["website"])
        stats["scraped"] += 1

        update: dict = {}
        if meta["description"] and not v.get("description"):
            update["description"] = meta["description"]
            stats["desc_filled"] += 1
        if meta["og_image"] and not v.get("image_url"):
            update["image_url"] = meta["og_image"]
            stats["img_filled"] += 1

        if update:
            if dry_run:
                logger.debug(f"  [DRY] {v['name']}: {list(update.keys())}")
            else:
                client.table("places").update(update).eq("id", v["id"]).execute()
        else:
            stats["no_data"] += 1

        # Rate limit
        time.sleep(0.3)

    logger.info(
        f"Web metadata: {stats['desc_filled']} descriptions, {stats['img_filled']} images filled, "
        f"{stats['no_data']} no data found"
    )
    return stats


def main():
    parser = argparse.ArgumentParser(description="Backfill Tier 1 venue data")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--neighborhoods-only", action="store_true")
    parser.add_argument("--web-metadata-only", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="Max venues for web metadata (0=all)")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    client = get_client()
    venues = fetch_destination_venues(client)
    logger.info(f"Loaded {len(venues)} active GA destination venues")

    results = {}

    if not args.web_metadata_only:
        results["neighborhoods"] = backfill_neighborhoods(client, venues, dry_run=args.dry_run)

    if not args.neighborhoods_only:
        results["web_metadata"] = backfill_web_metadata(client, venues, dry_run=args.dry_run, limit=args.limit)

    print("\n=== SUMMARY ===")
    for section, stats in results.items():
        print(f"\n  {section}:")
        for k, v in stats.items():
            print(f"    {k}: {v}")


if __name__ == "__main__":
    main()
