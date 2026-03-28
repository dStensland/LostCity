#!/usr/bin/env python3
"""
Seed Yonder's fifth public-land trail wave into the shared venue graph.

Wave 5 closes the remaining official-public-land trail backlog using OSM
relations that carry explicit USFS-import provenance, ranger-district operators,
trail refs, and route descriptions.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_trails_wave5.py
    python3 scripts/seed_yonder_public_land_trails_wave5.py --apply
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

CACHE_PATH = Path(__file__).resolve().parent / ".cache" / "yonder-public-land-hiking_routes.json"
FOREST_PARENT_SLUG = "chattahoochee-oconee-national-forest"
OFFICIAL_FOREST_URL = "https://www.fs.usda.gov/conf"

WAVE_5_TRAILS = [
    {
        "source_name": "Boarding House Trail",
        "name": "Boarding House Trail",
        "slug": "boarding-house-trail",
        "city": "Greensboro",
        "state": "GA",
        "short_description": "A short Chattahoochee-Oconee route at Scull Shoals Historic Area that adds official trail-level coverage to a public-land stop Yonder should already understand.",
        "planning_notes": "Use as official forest-trail context at Scull Shoals. This is a quick interpretive trail rather than a major destination hike.",
        "parking_note": "Use current Chattahoochee-Oconee trail and historic-area access guidance before promotion.",
        "typical_duration_minutes": 30,
        "explore_blurb": "Short official forest trail at Scull Shoals Historic Area.",
    },
    {
        "source_name": "Chickamauga Creek Trail",
        "name": "Chickamauga Creek Trail",
        "slug": "chickamauga-creek-trail",
        "city": "Chatsworth",
        "state": "GA",
        "short_description": "A longer Conasauga Ranger District loop that strengthens Yonder's canonical trail coverage in the northwest Georgia forest lane.",
        "planning_notes": "Use as a route-level forest trail row for northwest Georgia coverage and pair it with creek-crossing caution in user-facing guidance.",
        "parking_note": "Use current Chattahoochee-Oconee trail access guidance and seasonal stream-crossing caution before promotion.",
        "typical_duration_minutes": 240,
        "explore_blurb": "Official forest loop trail along scenic Chickamauga Creek.",
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


def build_payload(seed: dict, probe_index: dict[str, dict], parent_id: int | None) -> dict:
    payload = deepcopy(seed)
    payload.pop("source_name", None)
    payload.setdefault("venue_type", "trail")
    payload.setdefault("spot_type", "trail")
    payload.setdefault("explore_category", "outdoors")
    payload.setdefault("active", True)
    if parent_id:
        payload["parent_venue_id"] = parent_id

    probe_row = probe_index.get(seed["source_name"].lower())
    if probe_row:
        center = probe_row.get("center") or {}
        tags = probe_row.get("tags", {})
        payload.setdefault("lat", probe_row.get("lat") or center.get("lat"))
        payload.setdefault("lng", probe_row.get("lon") or center.get("lon"))
        payload.setdefault("website", tags.get("operator:website") or OFFICIAL_FOREST_URL)
        payload.setdefault(
            "description",
            tags.get("description")
            or f"{seed['name']} is an official Chattahoochee-Oconee National Forest route derived from the forest trail dataset.",
        )
        note_parts = []
        if tags.get("distance"):
            note_parts.append(f"Distance: {tags.get('distance')}")
        ref_bits = [tags.get("local_ref"), tags.get("ref"), tags.get("source_ref")]
        ref_note = ", ".join(bit for bit in ref_bits if bit)
        if ref_note:
            note_parts.append(f"Reference: {ref_note}")
        if note_parts:
            payload["planning_notes"] = f"{seed['planning_notes']} {' '.join(note_parts)}."
    else:
        payload.setdefault("website", OFFICIAL_FOREST_URL)
        payload.setdefault(
            "description",
            f"{seed['name']} is an official Chattahoochee-Oconee National Forest route.",
        )
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
            "parent_venue_id",
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
    parser = argparse.ArgumentParser(description="Seed Yonder public-land trail wave 5.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--refresh-existing", action="store_true", help="Refresh existing rows.")
    args = parser.parse_args()

    probe_index = load_probe_index()
    client = get_client()
    parent = get_venue_by_slug(FOREST_PARENT_SLUG)
    parent_id = parent["id"] if parent else None

    created = 0
    updated = 0
    skipped = 0

    logger.info("=" * 72)
    logger.info("Yonder Public-Land Trail Wave 5")
    logger.info("=" * 72)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("Forest parent present: %s", bool(parent_id))
    logger.info("")

    for seed in WAVE_5_TRAILS:
        payload = build_payload(seed, probe_index, parent_id)
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
