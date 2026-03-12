#!/usr/bin/env python3
"""
Seed Yonder's second public-land trail wave into the shared venue graph.

Wave 2 focuses on canonical named trails with clear official or institutional
source surfaces. This keeps the trail graph expanding without importing noisy
map-only path names.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_trails_wave2.py
    python3 scripts/seed_yonder_public_land_trails_wave2.py --apply
    python3 scripts/seed_yonder_public_land_trails_wave2.py --apply --refresh-existing
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

WAVE_2_TRAILS = [
    {
        "name": "Pinhoti Trail",
        "slug": "pinhoti-trail",
        "website": "https://www.fs.usda.gov/r08/chattahoochee-oconee/recreation/pinhoti-trail-georgia",
        "city": "Chatsworth",
        "state": "GA",
        "short_description": "One of Georgia's defining long-distance mountain trails and a major missing piece in Yonder's public-land hiking graph.",
        "description": "The Pinhoti Trail is a canonical Georgia long-distance route with real statewide significance for hikers, backpackers, and route planning. Adding it moves Yonder closer to a serious hiking graph instead of a collection of scenic park anchors.",
        "planning_notes": "Use as a canonical trail-system row for route identity, backpacking context, and connections to Northwest Georgia trailheads and longer mountain objectives.",
        "parking_note": "Access varies by trailhead and section. Pair with specific trailheads or nearby anchors when recommending a concrete outing.",
        "typical_duration_minutes": 360,
        "explore_blurb": "Canonical Georgia long-distance trail with real backpacking identity.",
    },
    {
        "name": "Gahuti Trail",
        "slug": "gahuti-trail",
        "website": "https://gastateparks.org/FortMountain/Trails",
        "city": "Chatsworth",
        "state": "GA",
        "short_description": "Fort Mountain's signature backcountry trail and one of the clearest route-level hiking upgrades Yonder can make.",
        "description": "Gahuti Trail gives Yonder explicit coverage for one of Fort Mountain's most important hikes rather than forcing everything through the park anchor alone. That improves route specificity and makes the trail graph more useful for actual hikers.",
        "planning_notes": "Best used for committed day hikes, backcountry context, and trail-level support beneath Fort Mountain recommendations.",
        "parking_note": "Use official Fort Mountain trailhead and park-access guidance. Backcountry campsites along the trail require planning.",
        "typical_duration_minutes": 300,
        "explore_blurb": "Fort Mountain's signature backcountry loop.",
    },
    {
        "name": "Amadahy Trail",
        "slug": "amadahy-trail",
        "website": "https://www.sam.usace.army.mil/Missions/Civil-Works/Recreation/Carters-Lake/Biking/",
        "city": "Ellijay",
        "state": "GA",
        "short_description": "A Carters Lake loop trail that broadens Yonder's graph into Corps-managed public land, not just forests and state parks.",
        "description": "Amadahy Trail is a strong Yonder addition because it represents a different public-land family and a different hiking shape than the usual mountain summit route. It makes the trail graph more structurally complete and less repetitive.",
        "planning_notes": "Use for Carters Lake hiking, lake-view trail discovery, and public-land variety beyond the standard state-park lane.",
        "parking_note": "Trailhead parking is associated with Woodring Branch access. Follow current USACE guidance before promotion.",
        "typical_duration_minutes": 90,
        "explore_blurb": "Carters Lake loop trail with real public-land variety.",
    },
    {
        "name": "Moody Forest Tavia's Trail",
        "slug": "moody-forest-tavias-trail",
        "website": "https://www.nature.org/en-us/get-involved/how-to-help/places-we-protect/moody-forest-natural-area/",
        "city": "Baxley",
        "state": "GA",
        "short_description": "A three-mile preserve trail that adds Coastal Plain habitat and conservation-land hiking to Yonder's trail graph.",
        "description": "Moody Forest Tavia's Trail gives Yonder something it still lacks: a named trail tied to a high-value conservation landscape outside the mountain corridor. That matters if statewide trail coverage is supposed to feel intentional rather than purely alpine.",
        "planning_notes": "Use for preserve hiking, habitat-rich trail discovery, and a broader statewide trail mix that includes the Coastal Plain.",
        "parking_note": "Use current preserve guidance and seasonal access rules before promotion.",
        "typical_duration_minutes": 120,
        "explore_blurb": "Conservation-land loop that broadens Georgia trail coverage beyond the mountains.",
    },
]

SOURCE_NAME_ALIASES = {
    "Gahuti Trail": "Gahuti",
}


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
    parser = argparse.ArgumentParser(description="Seed Yonder public-land trail wave 2.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing rows with Wave 2 trail fields.",
    )
    args = parser.parse_args()

    probe_index = load_probe_index()
    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    logger.info("=" * 72)
    logger.info("Yonder Public-Land Trail Wave 2")
    logger.info("=" * 72)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for seed in WAVE_2_TRAILS:
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
