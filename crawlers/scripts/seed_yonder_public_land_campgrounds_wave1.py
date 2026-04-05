#!/usr/bin/env python3
"""
Seed Yonder's first public-land campground wave into the shared venue graph.

This wave is intentionally narrow:
  - canonical named campgrounds only
  - strong weekend relevance for Georgia outdoor coverage
  - official/public operator URLs where available

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_campgrounds_wave1.py
    python3 scripts/seed_yonder_public_land_campgrounds_wave1.py --apply
    python3 scripts/seed_yonder_public_land_campgrounds_wave1.py --apply --refresh-existing
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

from db import get_client, get_or_create_place, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

CACHE_PATH = Path(__file__).resolve().parent / ".cache" / "yonder-public-land-camp_sites.json"

WAVE_1_CAMPGROUNDS = [
    {
        "name": "Amicalola Falls State Park Campground",
        "slug": "amicalola-falls-state-park-campground",
        "website": "https://www.amicalolafallslodge.com/accomodations/campsites/",
        "short_description": "Campground child node for Yonder's Amicalola anchor, giving the weekend layer a real campground answer instead of a generic state-park abstraction.",
        "description": "Amicalola Falls State Park Campground gives Yonder a concrete overnight option attached to one of North Georgia's highest-signal waterfall destinations. It matters because the product now needs campground-level truth, not just park-level inspiration.",
        "planning_notes": "Best used as the campground layer beneath the Amicalola weekend and waterfall prompts. Treat as book-ahead inventory on peak spring and fall dates.",
        "parking_note": "Use designated campground parking and check current park access rules before heavy promotion.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Real campground answer for Amicalola weekends.",
    },
    {
        "name": "Bear Creek Campground",
        "slug": "bear-creek-campground",
        "website": "https://www.fs.usda.gov/recarea/conf/recreation/camping-cabins/recarea/?recid=10473",
        "short_description": "A USFS North Georgia campground that strengthens Yonder's mountain-tent-camping lane beyond the state-park system.",
        "description": "Bear Creek Campground gives Yonder a real Forest Service campground in the North Georgia mountains, which is strategically important because it expands camping coverage past Georgia State Parks and into the federal public-land layer.",
        "planning_notes": "Use for mountain tent-camping recommendations and users who want a more public-land campground feel than state-park weekend framing alone.",
        "parking_note": "Follow current USFS access, road, and parking guidance for the recreation area.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Forest Service mountain campground with real weekend utility.",
    },
    {
        "name": "Cooper Creek Recreation Area",
        "slug": "cooper-creek-recreation-area",
        "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10522",
        "short_description": "A USFS campground and recreation-area base that gives Yonder a stronger creek-and-mountain camping lane.",
        "description": "Cooper Creek Recreation Area adds a recognizable Forest Service campground to Yonder's weekend substrate, helping the portal feel more complete for users comparing public-land camping options in the mountains.",
        "planning_notes": "Best for mountain campground prompts, creekside weekends, and users who want a more public-lands feel than a state-park cabin-first comparison.",
        "parking_note": "Use recreation-area parking and check current Forest Service notices before travel.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Mountain recreation-area campground with weekend range.",
    },
    {
        "name": "Deep Hole Recreation Area",
        "slug": "deep-hole-recreation-area",
        "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10523",
        "short_description": "A USFS recreation-area campground that broadens Yonder's inventory of simple public-land mountain overnighters.",
        "description": "Deep Hole Recreation Area gives Yonder another canonical Forest Service campground option in North Georgia. It is valuable because campground breadth matters more now than another generic park anchor.",
        "planning_notes": "Use as a public-land campground option for users comparing lower-friction mountain overnighters and Forest Service recreation areas.",
        "parking_note": "Follow current Forest Service parking and access guidance for the recreation area.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Straightforward public-land mountain campground.",
    },
    {
        "name": "Dockery Lake Campground",
        "slug": "dockery-lake-campground",
        "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10545",
        "short_description": "A lake-adjacent USFS campground that helps Yonder compare public-land camping with more water-forward mountain options.",
        "description": "Dockery Lake Campground strengthens the campground graph with a named Forest Service site that feels distinct from the state-park weekend set. It helps Yonder serve users who want camping depth, not just another scenic destination card.",
        "planning_notes": "Useful for quieter campground prompts, lake-adjacent mountain weekends, and users who want a simpler public-land setup.",
        "parking_note": "Check current Forest Service access and campground notices before promotion.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Lake-adjacent Forest Service campground.",
    },
    {
        "name": "Lake Winfield Scott Campground",
        "slug": "lake-winfield-scott-campground",
        "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10528",
        "short_description": "A high-signal lake campground that gives Yonder a cleaner public-land camping answer near existing mountain-day destinations.",
        "description": "Lake Winfield Scott Campground is one of the clearest next campground additions for Yonder because it pairs a recognizable North Georgia lake setting with public-land camping utility and strong weekend relevance.",
        "planning_notes": "Use for lake-and-camp weekend prompts, beginner-friendly public-land camping ideas, and comparisons against state-park campground options.",
        "parking_note": "Follow current Forest Service campground and access guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "High-signal lake campground for weekend comparisons.",
    },
    {
        "name": "The Pocket Campground",
        "slug": "the-pocket-campground",
        "website": "https://www.fs.usda.gov/recarea/conf/recreation/camping-cabins/recarea/?recid=10460",
        "short_description": "A canonical USFS campground that helps Yonder build a more convincing public-land weekend lane in Northwest Georgia.",
        "description": "The Pocket Campground expands Yonder's campground graph into another recognizable Forest Service option, which matters because the portal needs more than state-park campground children to feel regionally credible.",
        "planning_notes": "Use for public-land weekend prompts, campground comparisons, and users who want a more rustic Northwest Georgia camping answer.",
        "parking_note": "Check Forest Service notices for access, parking, and campground conditions.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Northwest Georgia public-land campground.",
    },
    {
        "name": "Upper Stamp Creek Campground",
        "slug": "upper-stamp-creek-campground",
        "website": "https://www.recreation.gov/camping/campgrounds/232729",
        "short_description": "A Corps-managed campground that broadens Yonder's lake-and-reservoir camping coverage beyond state parks.",
        "description": "Upper Stamp Creek Campground matters because it brings a Corps-managed campground into Yonder's campground graph, which helps the portal move toward a broader public camping surface instead of over-indexing on a single operator family.",
        "planning_notes": "Best used for lake-camping comparisons and reachable weekend overnighters where users care more about the campground mix than the mountain-hike narrative.",
        "parking_note": "Use campground parking and follow current Recreation.gov or on-site access guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Lake/reservoir campground outside the state-park lane.",
    },
    {
        "name": "Red Top Mountain State Park Campground",
        "slug": "red-top-mountain-state-park-campground",
        "website": "https://gastateparks.reserveamerica.com/camping/red-top-mountain-state-park/r/campgroundDetails.do?contractCode=GA&parkId=530364",
        "short_description": "Campground child node for Red Top Mountain, converting a broad weekend park anchor into a specific campground option.",
        "description": "Red Top Mountain State Park Campground gives Yonder an explicit campground layer beneath one of its strongest close-in weekend anchors. That is strategically useful because it sharpens the difference between inspiration and actual campground choice.",
        "planning_notes": "Use under Red Top weekend recommendations and treat as a bookable campground-specific option rather than generic park inventory.",
        "parking_note": "Use campground parking and follow current Georgia State Parks booking and access guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Concrete campground child for Red Top weekends.",
    },
    {
        "name": "Terrora Campground",
        "slug": "terrora-campground",
        "website": "https://gastateparks.reserveamerica.com/camping/tallulah-gorge-state-park/r/campgroundDetails.do?contractCode=GA&parkId=530196",
        "short_description": "Campground child node for the Tallulah Gorge weekend layer, helping Yonder separate the gorge destination from the overnight option.",
        "description": "Terrora Campground gives Yonder a campground-level answer underneath Tallulah Gorge, which is important because the portal now needs overnight specificity instead of treating every weekend-capable park as a single undifferentiated object.",
        "planning_notes": "Best used beneath Tallulah Gorge weekend prompts and booking-aware overnight comparisons.",
        "parking_note": "Use campground parking and check current Georgia State Parks campground guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Tallulah campground child for booking-aware weekends.",
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
        if not name:
            continue
        index[name.lower()] = row
    return index


def build_payload(seed: dict, probe_index: dict[str, dict]) -> dict:
    payload = deepcopy(seed)
    payload.setdefault("state", "GA")
    payload.setdefault("venue_type", "campground")
    payload.setdefault("spot_type", "campground")
    payload.setdefault("explore_category", "outdoors")
    payload.setdefault("active", True)

    probe_row = probe_index.get(seed["name"].lower())
    if probe_row:
        center = probe_row.get("center") or {}
        payload.setdefault("lat", probe_row.get("lat") or center.get("lat"))
        payload.setdefault("lng", probe_row.get("lon") or center.get("lon"))
        tags = probe_row.get("tags", {})
        payload.setdefault("website", tags.get("website"))

    return payload


def find_existing_venue(seed: dict) -> dict | None:
    existing = get_venue_by_slug(seed["slug"])
    if existing:
        return existing

    client = get_client()
    result = client.table("places").select("*").eq("name", seed["name"]).limit(1).execute()
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
    parser = argparse.ArgumentParser(description="Seed Yonder public-land campground wave 1.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing rows with Wave 1 campground fields.",
    )
    args = parser.parse_args()

    probe_index = load_probe_index()
    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    logger.info("=" * 72)
    logger.info("Yonder Public-Land Campground Wave 1")
    logger.info("=" * 72)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for seed in WAVE_1_CAMPGROUNDS:
        payload = build_payload(seed, probe_index)
        existing = find_existing_venue(seed)

        if not existing:
            if args.apply:
                get_or_create_place(payload)
            logger.info("%s venue: %s", "CREATE" if args.apply else "WOULD CREATE", seed["slug"])
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
            client.table("places").update(updates).eq("id", existing["id"]).execute()
        logger.info(
            "%s venue: %s (%s fields)",
            "UPDATE" if args.apply else "WOULD UPDATE",
            seed["slug"],
            len(updates),
        )
        updated += 1

    logger.info("")
    logger.info("Summary: created=%s updated=%s skipped=%s", created, updated, skipped)


if __name__ == "__main__":
    main()
