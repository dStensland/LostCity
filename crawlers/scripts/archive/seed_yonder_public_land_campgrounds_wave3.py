#!/usr/bin/env python3
"""
Seed Yonder's third public-land campground wave.

Wave 3 is limited to clearly official/public operators confirmed from primary
sources after the first two broad waves.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_campgrounds_wave3.py
    python3 scripts/seed_yonder_public_land_campgrounds_wave3.py --apply
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

CACHE_PATH = Path(__file__).resolve().parent / ".cache" / "yonder-public-land-camp_sites.json"

WAVE_3_CAMPGROUNDS = [
    {
        "name": "DeSoto Falls Campground",
        "slug": "desoto-falls-campground",
        "website": "https://www.fs.usda.gov/r08/chattahoochee-oconee/recreation/desoto-falls-recreation-area",
        "short_description": "A high-signal Forest Service campground paired with one of North Georgia's most recognizable waterfall areas.",
        "description": "DeSoto Falls Campground is exactly the kind of official public-land campground Yonder should keep adding: high-signal, trip-worthy, and clearly tied to a real outdoor payoff. It improves both campground breadth and destination-to-campground coherence.",
        "planning_notes": "Best used for campground-first weekend planning around DeSoto Falls and nearby mountain hiking. Reservations and seasonal conditions matter.",
        "parking_note": "Follow current Forest Service recreation-area and campground parking guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Official USFS campground tied to a signature waterfall area.",
    },
    {
        "name": "Lake Conasauga Campground",
        "slug": "lake-conasauga-campground",
        "website": "https://www.fs.usda.gov/r08/chattahoochee-oconee/recreation/lake-conasauga",
        "short_description": "A high-elevation official campground that adds distinct mountain-lake public-land coverage to Yonder.",
        "description": "Lake Conasauga Campground strengthens Yonder's campground layer with a clearly official Forest Service site and a distinctive mountain-lake setting. It is a high-value addition because it broadens the shape of public camping options rather than repeating the same park template.",
        "planning_notes": "Use for mountain-lake campground comparisons and public-land weekend planning. Check current seasonal and closure status before promotion.",
        "parking_note": "Use official Forest Service campground access guidance and current closure notices.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Official mountain-lake campground with strong public-land identity.",
    },
    {
        "name": "Blythe Island Regional Park Campground",
        "slug": "blythe-island-regional-park-campground",
        "website": "https://www.glynncounty.org/government/departments/blythe-island-regional-park/blythe-island-regional-park-camping",
        "short_description": "A county-managed coastal campground that expands Yonder's camping graph beyond the North Georgia mountain bias.",
        "description": "Blythe Island Regional Park Campground is strategically important because it adds a clearly official coastal campground to Yonder's shared graph. That broadens the camping substrate geographically and proves the workstream is not limited to the mountain corridor.",
        "planning_notes": "Use for coastal campground coverage, county-park camping comparisons, and broader statewide camping credibility.",
        "parking_note": "Follow current Glynn County campground guidance for site access, parking, and reservation rules.",
        "typical_duration_minutes": 960,
        "explore_blurb": "Official coastal campground that broadens statewide range.",
    },
    {
        "name": "Joe Kurz WMA Campground",
        "slug": "joe-kurtz-wma-campground",
        "website": "https://georgiawildlife.com/joe-kurz-wma",
        "short_description": "A wildlife-management-area campground that starts to represent state WMA camping inside Yonder's graph.",
        "description": "Joe Kurz WMA Campground helps Yonder move from a park-and-forest camping graph toward a fuller public-land model that also includes wildlife-management areas. That matters if the portal wants to feel more structurally complete over time.",
        "planning_notes": "Best used as a public-land campground with stronger WMA / permit context than standard park camping. Check current WMA rules before promotion.",
        "parking_note": "Use current Georgia DNR / WMA access guidance and respect any seasonal restrictions.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Official WMA campground that broadens public-land coverage.",
    },
]


def load_probe_index() -> dict[str, dict]:
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
    payload.setdefault("state", "GA")
    payload.setdefault("venue_type", "campground")
    payload.setdefault("spot_type", "campground")
    payload.setdefault("explore_category", "outdoors")
    payload.setdefault("active", True)

    source_names = {
        "Blythe Island Regional Park Campground": "Blythe Island",
        "Joe Kurz WMA Campground": "Joe Kurtz WMA Campground",
    }
    probe_name = source_names.get(seed["name"], seed["name"])
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
    parser = argparse.ArgumentParser(description="Seed Yonder public-land campground wave 3.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    probe_index = load_probe_index()
    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    logger.info("=" * 72)
    logger.info("Yonder Public-Land Campground Wave 3")
    logger.info("=" * 72)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for seed in WAVE_3_CAMPGROUNDS:
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
