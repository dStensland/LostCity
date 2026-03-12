#!/usr/bin/env python3
"""
Seed Yonder's fourth public-land campground wave.

This wave is intentionally narrow: only clearly official campground rows from
the qualified backlog, excluding ambiguous day-use / picnic facilities.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_campgrounds_wave4.py
    python3 scripts/seed_yonder_public_land_campgrounds_wave4.py --apply
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

WAVE_4_CAMPGROUNDS = [
    {
        "name": "Lake Conasauga Overflow Campground",
        "slug": "lake-conasauga-overflow-campground",
        "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10463",
        "short_description": "An overflow campground for the Lake Conasauga area that adds more official mountain-lake camping depth to Yonder.",
        "description": "Lake Conasauga Overflow Campground extends Yonder's Lake Conasauga coverage from a single official campground row into a more realistic recreation-area camping setup. That kind of child-depth matters if the camping graph is going to feel operationally useful.",
        "planning_notes": "Use as overflow / secondary campground support beneath Lake Conasauga camping recommendations. Check current seasonal status before promotion.",
        "parking_note": "Follow current Forest Service campground access and overflow-area guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Official overflow campground that deepens Lake Conasauga coverage.",
    },
    {
        "name": "Hickey Gap Forest Service Camping Area",
        "slug": "hickey-gap-forest-service-camping-area",
        "website": "https://www.fs.usda.gov/recarea/conf/recreation/recarea/?recid=10458",
        "short_description": "A named Forest Service camping area that helps Yonder keep expanding the federal public-land camping layer.",
        "description": "Hickey Gap Forest Service Camping Area is the kind of official, lower-profile public camping row that steadily improves the substrate. Yonder needs these if it wants to become genuinely useful for public-land camping discovery rather than only highlight a few marquee destinations.",
        "planning_notes": "Use as a federal camping-area row in broader public-land comparisons and keep access guidance current.",
        "parking_note": "Follow current Forest Service camping-area access and parking guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Official Forest Service camping area for deeper public-land breadth.",
    },
    {
        "name": "Old Federal Campground",
        "slug": "old-federal-campground",
        "website": "https://www.recreation.gov/camping/campgrounds/232657",
        "short_description": "A Recreation.gov Lake Lanier campground that broadens Yonder's public camping layer into the Corps-managed lake system.",
        "description": "Old Federal Campground is a strong addition because it is clearly official, bookable, and structurally different from the mountain-park pattern. It helps Yonder expand into lake-reservoir camping with real public booking infrastructure behind it.",
        "planning_notes": "Best used for lake camping comparisons and as a Corps / Recreation.gov campground row rather than a mountain-weekend substitute.",
        "parking_note": "Use current Recreation.gov and local campground guidance for access, rules, and check-in details.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Official Lake Lanier campground with real booking infrastructure.",
    },
    {
        "name": "Bolding Mill Campground",
        "slug": "bolding-mill-campground",
        "website": "https://www.recreation.gov/camping/campgrounds/232531?tab=info",
        "short_description": "A Recreation.gov campground that strengthens Yonder's Lake Lanier public-camping coverage with another official row.",
        "description": "Bolding Mill Campground matters because Yonder needs multiple official lake-system campground rows, not just one. That is how the shared graph starts to feel useful for actual camping comparison instead of isolated examples.",
        "planning_notes": "Use for lake camping and official booking-surface comparisons. Pair with current Recreation.gov guidance on availability and facility rules.",
        "parking_note": "Follow Recreation.gov and local campground access guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Another official Lake Lanier campground for real comparison depth.",
    },
    {
        "name": "Toto Creek Campground",
        "slug": "toto-creek-campground",
        "website": "https://www.recreation.gov/camping/campgrounds/255286?tab=campsites",
        "short_description": "A Recreation.gov campground that broadens Yonder's official Lake Lanier camping surface beyond a single cluster of examples.",
        "description": "Toto Creek Campground gives Yonder another clearly official public campground row in the Lake Lanier system. That matters because the graph gets more credible each time an official public operator family gains density.",
        "planning_notes": "Use as part of the lake-camping comparison set and keep it framed as an official bookable campground rather than a generic park mention.",
        "parking_note": "Use current Recreation.gov campground access and site guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Official lake campground that adds more public-booking depth.",
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
    probe_row = probe_index.get(seed["name"].lower())
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
    parser = argparse.ArgumentParser(description="Seed Yonder public-land campground wave 4.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    probe_index = load_probe_index()
    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    logger.info("=" * 72)
    logger.info("Yonder Public-Land Campground Wave 4")
    logger.info("=" * 72)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for seed in WAVE_4_CAMPGROUNDS:
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
