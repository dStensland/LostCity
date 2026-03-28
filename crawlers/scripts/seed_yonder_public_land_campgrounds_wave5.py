#!/usr/bin/env python3
"""
Seed Yonder's fifth public-land campground wave.

Wave 5 is intentionally tiny: it only includes official public campground rows
that still remain after the broader queue has been qualified.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_campgrounds_wave5.py
    python3 scripts/seed_yonder_public_land_campgrounds_wave5.py --apply
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

WAVE_5_CAMPGROUNDS = [
    {
        "name": "Ducket Mill",
        "slug": "ducket-mill",
        "website": "https://www.recreation.gov/camping/campgrounds/232578",
        "short_description": "An official Lake Lanier campground on Recreation.gov that strengthens Yonder's Corps-managed lake camping layer.",
        "description": "Ducket Mill is a clean public-land addition because it is clearly official, explicitly campground inventory, and part of the same Lake Sidney Lanier booking ecosystem as other high-signal public camping rows. It expands Yonder's campground breadth without introducing fuzzy operator quality.",
        "planning_notes": "Use for lake-camping and public-booking comparisons. Keep it framed as a Corps-managed Recreation.gov campground rather than a general park mention.",
        "parking_note": "Follow current Recreation.gov and on-site campground guidance for access, trailers, and overnight rules.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Official Lake Lanier campground with real public booking infrastructure.",
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
    parser = argparse.ArgumentParser(description="Seed Yonder public-land campground wave 5.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    probe_index = load_probe_index()
    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    logger.info("=" * 72)
    logger.info("Yonder Public-Land Campground Wave 5")
    logger.info("=" * 72)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for seed in WAVE_5_CAMPGROUNDS:
        payload = build_payload(seed, probe_index)
        existing = find_existing_venue(seed)
        if not existing:
            created_id = None
            if args.apply:
                created_id = get_or_create_place(payload)
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
            client.table("places").update(updates).eq("id", existing["id"]).execute()
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
