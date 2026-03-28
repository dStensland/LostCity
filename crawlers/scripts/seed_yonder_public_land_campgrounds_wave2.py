#!/usr/bin/env python3
"""
Seed Yonder's second public-land campground wave.

Wave 2 stays disciplined:
  - official/public-land campgrounds only
  - no private RV parks or operator-specific one-offs
  - focus on USFS / NPS / DNR / state managed inventory that broadens Georgia coverage

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_campgrounds_wave2.py
    python3 scripts/seed_yonder_public_land_campgrounds_wave2.py --apply
    python3 scripts/seed_yonder_public_land_campgrounds_wave2.py --apply --refresh-existing
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

WAVE_2_CAMPGROUNDS = [
    {
        "name": "Frank Gross Recreation Area",
        "slug": "frank-gross-recreation-area",
        "website": "https://www.fs.usda.gov/recarea/conf/recreation/camping-cabins/recarea/?recid=10526&actid=29",
        "short_description": "A Forest Service mountain campground that expands Yonder's public-land weekend layer deeper into North Georgia.",
        "description": "Frank Gross Recreation Area gives Yonder another canonical USFS campground with strong mountain-weekend relevance. It matters because the camping graph needs real federal public-land options, not just state-park children and provider-backed park rows.",
        "planning_notes": "Use for public-land mountain camping comparisons and users who want simpler campground-driven weekend options.",
        "parking_note": "Follow current Forest Service campground and access guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Forest Service mountain campground with real weekend value.",
    },
    {
        "name": "Mulky Campground",
        "slug": "mulky-campground",
        "website": "https://www.fs.usda.gov/recarea/conf/recreation/camping-cabins/recarea/?recid=10530&actid=29",
        "short_description": "A named USFS campground that deepens Yonder's mountain camping layer with another real public-land option.",
        "description": "Mulky Campground strengthens Yonder's USFS campground coverage and helps the portal feel less dependent on the same few park systems. It is the kind of canonical public campground that should be present if Yonder wants statewide camping credibility.",
        "planning_notes": "Best for mountain campground comparisons and public-land weekend planning rather than broad family-market merchandising.",
        "parking_note": "Use current Forest Service campground access and parking guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Another real USFS campground for mountain weekends.",
    },
    {
        "name": "Toccoa River Sandy Bottoms Recreation Area",
        "slug": "toccoa-river-sandy-bottoms-recreation-area",
        "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10531",
        "short_description": "A river-focused public campground that gives Yonder more than mountain-lake repetition in its camping layer.",
        "description": "Toccoa River Sandy Bottoms Recreation Area broadens Yonder's campground mix with a river-oriented USFS site. That matters because the camping graph should eventually support distinct trip shapes, not just generic campground icons.",
        "planning_notes": "Use when the camping shelf needs a stronger river identity and a public-land option outside the same state-park pattern.",
        "parking_note": "Follow current Forest Service recreation-area access guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "River-oriented public campground with a distinct trip shape.",
    },
    {
        "name": "Brickhill Bluff",
        "slug": "brickhill-bluff-campground",
        "website": "https://www.nps.gov/cuis/planyourvisit/camping.htm",
        "short_description": "An NPS backcountry camping node that starts extending Yonder's campground graph into the coast and ferry-access public-land layer.",
        "description": "Brickhill Bluff is strategically useful because it brings National Park Service campground coverage into Yonder's shared graph. That expands the public-land camping substrate beyond mountain-weekend assumptions and proves the graph can hold more specialized public camping entities.",
        "planning_notes": "Use as a special-case public-land campground with stronger logistics and trip-planning friction than the mountain drive-up set.",
        "parking_note": "Access depends on current NPS and ferry/transport rules. Treat as a more committed campground option.",
        "typical_duration_minutes": 960,
        "explore_blurb": "NPS backcountry campground that broadens geographic range.",
    },
    {
        "name": "Buffalo Swamp Primitive Camp",
        "slug": "buffalo-swamp-primitive-camp",
        "website": "https://gastateparks.org/ProvidenceCanyon",
        "short_description": "A primitive public-land camp node that gives Yonder a truer backcountry edge in the state-managed camping lane.",
        "description": "Buffalo Swamp Primitive Camp helps Yonder represent primitive camping as a real part of the Georgia outdoor graph instead of only campground-and-cabin inventory. It is a useful signal that the camping layer is becoming more structurally honest.",
        "planning_notes": "Best for primitive-camping comparisons and more committed trip framing rather than casual weekend shelf promotion.",
        "parking_note": "Use current state guidance for access and primitive camping logistics.",
        "typical_duration_minutes": 840,
        "explore_blurb": "Primitive camp node that adds a truer backcountry edge.",
    },
    {
        "name": "Camp Hicita Group Camp",
        "slug": "camp-hicita-group-camp",
        "website": "https://gastateparks.org/IndianSprings",
        "short_description": "A state-managed group-camp option that broadens Yonder's camping graph beyond standard campground rows.",
        "description": "Camp Hicita Group Camp is important because it adds group-camp structure to the venue graph. Even if Yonder does not foreground group-camp planning yet, the underlying data model should start to represent these camping modes now.",
        "planning_notes": "Use as a group-camp support node and as evidence that Yonder's camping graph is expanding beyond tent-pad parity.",
        "parking_note": "Check current Georgia State Parks group-camp access and reservation guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "State-managed group-camp node for broader camping semantics.",
    },
    {
        "name": "Concord Campground",
        "slug": "concord-campground",
        "website": "https://www.fs.usda.gov/conf",
        "short_description": "A USFS campground that strengthens the federal public-land layer in Yonder's camping graph.",
        "description": "Concord Campground is another canonical federal campground that helps Yonder move toward actual camping breadth rather than a thin highlighted set. That is exactly the kind of steady graph expansion this workstream is meant to create.",
        "planning_notes": "Use as a federal campground row in weekend camping comparisons and future broader campground finding experiences.",
        "parking_note": "Follow current Forest Service campground access guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Additional USFS campground for broader public-land depth.",
    },
    {
        "name": "Gladesville Campground",
        "slug": "gladesville-campground",
        "website": "https://www.fs.usda.gov/conf",
        "short_description": "A public-land campground that increases Yonder's mountain camping breadth without relying on another destination-park abstraction.",
        "description": "Gladesville Campground is useful because it is another named federal public-land campground with straightforward graph value. Yonder needs many more rows like this if it wants to feel increasingly definitive over time.",
        "planning_notes": "Best used as a public-land campground comparison row and part of a broader federal-land camping surface.",
        "parking_note": "Use current Forest Service access and campground guidance.",
        "typical_duration_minutes": 720,
        "explore_blurb": "Named federal campground that builds camping breadth.",
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
        payload.setdefault("website", (probe_row.get("tags") or {}).get("website"))
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
    parser = argparse.ArgumentParser(description="Seed Yonder public-land campground wave 2.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing rows with Wave 2 campground fields.",
    )
    args = parser.parse_args()

    probe_index = load_probe_index()
    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    logger.info("=" * 72)
    logger.info("Yonder Public-Land Campground Wave 2")
    logger.info("=" * 72)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for seed in WAVE_2_CAMPGROUNDS:
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
            payload["slug"],
            len(updates),
        )
        updated += 1

    logger.info("")
    logger.info("Summary: created=%s updated=%s skipped=%s", created, updated, skipped)


if __name__ == "__main__":
    main()
