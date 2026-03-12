#!/usr/bin/env python3
"""
Seed Yonder's fourth public-land trail wave into the shared venue graph.

Wave 4 normalizes the Tallulah Gorge / Terrora trail lane to the official
Georgia State Parks trail-map names instead of the noisier OSM labels.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_trails_wave4.py
    python3 scripts/seed_yonder_public_land_trails_wave4.py --apply
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from copy import deepcopy
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

CACHE_PATH = Path(__file__).resolve().parent / ".cache" / "yonder-public-land-hiking_routes.json"
TRAIL_MAP_URL = "https://gastateparks.org/sites/default/files/parks/pdf/trailmaps/TallulahGorge_TrailMap.pdf"
SOURCE_NAME_ALIASES = {
    "Terrora Trail": "Terrora Lake Loop Trail",
    "Upper Terrora Nature Trail": "Upper Terrora Natura Trail",
}

WAVE_4_TRAILS = [
    {
        "name": "Terrora Trail",
        "slug": "terrora-trail",
        "website": TRAIL_MAP_URL,
        "city": "Tallulah Falls",
        "state": "GA",
        "short_description": "A Tallulah Gorge trail-map route along the Terrora side of the park that adds official route-level coverage beyond the rim trails.",
        "description": "Terrora Trail is worth adding because the official Tallulah Gorge trail map names it directly, which gives Yonder a cleaner and more defensible route entity than the noisier OSM label. It strengthens Tallulah's internal trail graph rather than leaving the park represented only by broad park-level coverage.",
        "planning_notes": "Use as official Tallulah route context and for trail-level support around the Terrora campground and day-use side of the park.",
        "parking_note": "Use current Tallulah Gorge State Park trail map and park-access guidance before promotion.",
        "typical_duration_minutes": 120,
        "explore_blurb": "Official Tallulah trail-map route on the Terrora side of the park.",
    },
    {
        "name": "Upper Terrora Nature Trail",
        "slug": "upper-terrora-nature-trail",
        "website": TRAIL_MAP_URL,
        "city": "Tallulah Falls",
        "state": "GA",
        "short_description": "An officially named Tallulah Gorge trail-map route that corrects the OSM naming typo and improves Yonder's internal Tallulah trail coverage.",
        "description": "Upper Terrora Nature Trail matters because it turns a typo-prone OSM row into an official Georgia State Parks route entity with the right name. That is exactly the kind of normalization work Yonder needs if it wants a trail graph that is both broader and cleaner.",
        "planning_notes": "Use for official Tallulah trail coverage and internal route context near the Terrora campground and lake area.",
        "parking_note": "Use the official Tallulah Gorge trail map and current park signage when promoting this route.",
        "typical_duration_minutes": 90,
        "explore_blurb": "Official Tallulah nature-trail row with corrected naming.",
    },
]


def load_probe_index() -> dict[str, dict]:
    if not CACHE_PATH.exists():
        raise FileNotFoundError(
            f"Missing Overpass cache at {CACHE_PATH}. Run probe_yonder_public_land_coverage.py first."
        )
    rows = json.loads(CACHE_PATH.read_text())
    index: dict[str, dict] = {}
    for row in rows:
        tags = row.get("tags", {})
        name = (tags.get("name") or "").strip()
        if name:
            index[name.lower()] = row
    return index


def build_payload(seed: dict, probe_index: dict[str, dict]) -> dict:
    payload = deepcopy(seed)
    payload.setdefault("venue_type", "trail")
    payload.setdefault("spot_type", "trail")
    payload.setdefault("explore_category", "outdoors")
    payload.setdefault("active", True)

    probe_name = SOURCE_NAME_ALIASES.get(seed["name"], seed["name"])
    probe_row = probe_index.get(probe_name.lower())
    if probe_row:
        center = probe_row.get("center") or {}
        payload.setdefault("lat", probe_row.get("lat") or center.get("lat"))
        payload.setdefault("lng", probe_row.get("lon") or center.get("lon"))
    return payload


def find_existing_venue(seed: dict) -> dict | None:
    existing = get_venue_by_slug(seed["slug"])
    if existing:
        return existing
    client = get_client()
    result = client.table("venues").select("*").eq("name", seed["name"]).limit(1).execute()
    if result.data:
        return result.data[0]
    return None


def compute_updates(existing: dict, payload: dict) -> dict:
    updates: dict = {}
    for key, value in payload.items():
        if value in (None, "", []):
            continue
        current = existing.get(key)
        if current in (None, "", []):
            updates[key] = value
            continue
        if key in {
            "slug",
            "city",
            "state",
            "lat",
            "lng",
            "website",
            "venue_type",
            "spot_type",
            "short_description",
            "description",
            "planning_notes",
            "parking_note",
            "typical_duration_minutes",
            "explore_blurb",
            "explore_category",
        } and current != value:
            updates[key] = value
    return updates


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Yonder public-land trail wave 4.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    probe_index = load_probe_index()
    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    logger.info("=" * 72)
    logger.info("Yonder Public-Land Trail Wave 4")
    logger.info("=" * 72)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for seed in WAVE_4_TRAILS:
        payload = build_payload(seed, probe_index)
        existing = find_existing_venue(seed)
        if not existing:
            created_id = None
            if args.apply:
                created_id = get_or_create_venue(payload)
            logger.info("%s venue: %s", "CREATE" if args.apply else "WOULD CREATE", seed["slug"])
            if not args.apply or created_id:
                created += 1
            continue

        if not args.refresh_existing:
            logger.info("KEEP venue: %s (already exists)", seed["slug"])
            skipped += 1
            continue

        updates = compute_updates(existing, payload)
        if not updates:
            logger.info("KEEP venue: %s (no changes)", seed["slug"])
            skipped += 1
            continue

        if args.apply:
            client.table("venues").update(updates).eq("id", existing["id"]).execute()
        logger.info(
            "%s venue: %s (%s fields)",
            "UPDATE" if args.apply else "WOULD UPDATE",
            payload["slug"],
            len(updates),
        )
        updated += 1

    logger.info("")
    logger.info("Summary: created=%s updated=%s skipped=%s", created, updated, skipped)


if __name__ == "__main__":
    main()
