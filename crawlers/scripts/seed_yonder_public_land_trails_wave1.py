#!/usr/bin/env python3
"""
Seed Yonder's first public-land trail wave into the shared venue graph.

This wave focuses on canonical named trail systems that materially improve
Georgia outdoor breadth rather than small connector paths.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_public_land_trails_wave1.py
    python3 scripts/seed_yonder_public_land_trails_wave1.py --apply
    python3 scripts/seed_yonder_public_land_trails_wave1.py --apply --refresh-existing
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

WAVE_1_TRAILS = [
    {
        "name": "Appalachian Trail",
        "slug": "appalachian-trail",
        "website": "https://appalachiantrail.org/",
        "city": "Blairsville",
        "state": "GA",
        "short_description": "The defining long-distance trail in the Southeast and the clearest possible signal that Yonder understands Georgia's real mountain hiking landscape.",
        "description": "The Appalachian Trail is a canonical long-distance hiking route and a foundational public-land trail entity for Yonder's Georgia graph. It matters less as a single destination card than as a backbone concept that anchors summit hikes, trailheads, and quest-worthy mountain objectives.",
        "planning_notes": "Use as a canonical trail-system row, not a generic weekend suggestion. Best for trail-identity, route context, and connections to Georgia mountain objectives like Blood Mountain and Springer Mountain.",
        "parking_note": "Access varies by trailhead. Pair with specific trailheads or associated destinations when promoting a concrete outing.",
        "typical_duration_minutes": 360,
        "explore_blurb": "Georgia's most iconic long-distance trail system.",
    },
    {
        "name": "Benton MacKaye Trail",
        "slug": "benton-mackaye-trail",
        "website": "https://bmta.org/",
        "city": "Blue Ridge",
        "state": "GA",
        "short_description": "A canonical long-distance mountain trail that broadens Yonder beyond the same handful of state-park hikes.",
        "description": "The Benton MacKaye Trail gives Yonder a second major long-distance Georgia trail identity beyond the Appalachian Trail. It is strategically useful because it makes the trail graph feel like real public-land infrastructure instead of a collection of park pages.",
        "planning_notes": "Best treated as a canonical trail system and route context layer. Use it to support deeper mountain-hiking discovery and future trail-linked quest logic.",
        "parking_note": "Access varies by segment and trailhead. Pair with specific trailheads or nearby mountain anchors for concrete recommendations.",
        "typical_duration_minutes": 360,
        "explore_blurb": "Major Georgia mountain trail system beyond the AT.",
    },
    {
        "name": "Bartram Trail",
        "slug": "bartram-trail",
        "website": "https://www.fs.usda.gov/conf",
        "city": "Clayton",
        "state": "GA",
        "short_description": "A high-signal public-land trail system that adds real federal-land hiking identity to Yonder's North Georgia layer.",
        "description": "The Bartram Trail helps Yonder represent the federal-land hiking network more credibly. It is a canonical named trail with real regional significance, which is exactly the kind of entity the venue graph still lacks.",
        "planning_notes": "Use as a trail-system row and as context for deeper North Georgia hiking discovery. Better for graph completeness and route identity than for broad-audience homepage promotion on its own.",
        "parking_note": "Access varies by segment and Forest Service trailhead.",
        "typical_duration_minutes": 300,
        "explore_blurb": "Canonical federal-land trail system in North Georgia.",
    },
    {
        "name": "Arkaquah Trail",
        "slug": "arkaquah-trail",
        "website": "https://www.fs.usda.gov/conf",
        "city": "Hiawassee",
        "state": "GA",
        "short_description": "A named North Georgia mountain trail that strengthens Yonder's trail depth around Brasstown Bald and nearby ridgelines.",
        "description": "Arkaquah Trail adds a specific named mountain trail to Yonder's graph, which is more useful than another generic park anchor when the goal is trail completeness. It helps connect summit destinations to the actual trail systems that define the experience.",
        "planning_notes": "Best used as a committed mountain-hiking row and in support of deeper North Georgia trail discovery near Brasstown Bald.",
        "parking_note": "Use official Forest Service or associated trailhead access guidance before promotion.",
        "typical_duration_minutes": 300,
        "explore_blurb": "Named mountain trail tied to Brasstown Bald country.",
    },
    {
        "name": "Chattooga River Trail",
        "slug": "chattooga-river-trail",
        "website": "https://www.fs.usda.gov/conf",
        "city": "Clayton",
        "state": "GA",
        "short_description": "A river-focused public-land trail that helps Yonder build more than summit-and-waterfall hiking.",
        "description": "Chattooga River Trail gives Yonder a named river-trail entity inside the public-land graph, which improves both hiking breadth and water-adjacent trail discovery. It helps break the current over-reliance on state-park branding alone.",
        "planning_notes": "Useful for river-corridor hiking context and for users looking for trail experiences with stronger water identity than a generic mountain route.",
        "parking_note": "Access varies by segment and trailhead along the river corridor.",
        "typical_duration_minutes": 300,
        "explore_blurb": "River-corridor trail that broadens the hiking mix.",
    },
    {
        "name": "Johns Mountain Trail",
        "slug": "johns-mountain-trail",
        "website": "https://www.fs.usda.gov/conf",
        "city": "Villanow",
        "state": "GA",
        "short_description": "A named Conasauga trail that adds credible mountain-route depth in Northwest Georgia.",
        "description": "Johns Mountain Trail helps Yonder move beyond marquee parks and into real named route coverage. It is strategically valuable because canonical trail systems are what separate a serious outdoor graph from a branded destination shelf.",
        "planning_notes": "Best used as a mountain-route row and tied to more committed trail recommendations in Northwest Georgia.",
        "parking_note": "Use trailhead or overlook access guidance from the Forest Service before promotion.",
        "typical_duration_minutes": 300,
        "explore_blurb": "Northwest Georgia mountain route with real trail identity.",
    },
    {
        "name": "Keown Falls Trail",
        "slug": "keown-falls-trail",
        "website": "https://www.fs.usda.gov/conf",
        "city": "Villanow",
        "state": "GA",
        "short_description": "A named waterfall trail that adds route-level specificity to Yonder's Northwest Georgia hiking layer.",
        "description": "Keown Falls Trail is the right kind of named route for Yonder: specific enough to matter, public-land grounded, and directly useful for users comparing hikes rather than generic destinations.",
        "planning_notes": "Use for waterfall-hike comparisons and route-level coverage in the Conasauga / Johns Mountain area.",
        "parking_note": "Follow current Forest Service trailhead and recreation-area access guidance.",
        "typical_duration_minutes": 240,
        "explore_blurb": "Named waterfall route that improves trail-level specificity.",
    },
    {
        "name": "Hitchiti Loop Trail",
        "slug": "hitchiti-loop-trail",
        "website": "https://www.fs.usda.gov/conf",
        "city": "Juliette",
        "state": "GA",
        "short_description": "A central-Georgia named trail that prevents Yonder's trail graph from collapsing entirely into North Georgia mountain coverage.",
        "description": "Hitchiti Loop Trail adds valuable regional variety to Yonder's trail graph. That matters because trail breadth should not mean only mountain routes; it should also represent the distinct public-land systems elsewhere in Georgia.",
        "planning_notes": "Best used as a named regional trail row and as a signal that Yonder's trail graph reaches beyond the mountain corridor.",
        "parking_note": "Use official Oconee Ranger District trailhead guidance when promoting a concrete route.",
        "typical_duration_minutes": 240,
        "explore_blurb": "Named regional trail outside the usual mountain pattern.",
    },
    {
        "name": "Hitchiti Trail",
        "slug": "hitchiti-trail",
        "website": "https://www.fs.usda.gov/conf",
        "city": "Juliette",
        "state": "GA",
        "short_description": "A canonical Oconee trail that adds public-land hiking depth in central Georgia.",
        "description": "Hitchiti Trail strengthens Yonder's statewide trail graph by adding a named Oconee route with real public-land identity. It is useful precisely because it broadens the trail map beyond the same branded weekend anchors.",
        "planning_notes": "Use for central-Georgia trail coverage and route-level completeness, especially when building a less mountain-exclusive hiking graph.",
        "parking_note": "Access varies by segment and official trailhead guidance.",
        "typical_duration_minutes": 240,
        "explore_blurb": "Canonical Oconee route that broadens statewide trail depth.",
    },
    {
        "name": "Homestead Trail",
        "slug": "homestead-trail",
        "website": "https://gastateparks.org/FortMountain",
        "city": "Chatsworth",
        "state": "GA",
        "short_description": "A named trail within the Fort Mountain system that improves Yonder's route specificity around an existing weekend anchor.",
        "description": "Homestead Trail is a good example of the next layer Yonder needs: named routes inside important destination systems. That makes the graph more precise and more useful for hikers who care about trails, not just park names.",
        "planning_notes": "Use as a support trail row beneath Fort Mountain and for users looking for route-level hiking context.",
        "parking_note": "Use Fort Mountain State Park trail access guidance.",
        "typical_duration_minutes": 180,
        "explore_blurb": "Named Fort Mountain route that sharpens trail specificity.",
    },
    {
        "name": "Big Rock Trail",
        "slug": "big-rock-trail",
        "website": "https://gastateparks.org/FortMountain",
        "city": "Chatsworth",
        "state": "GA",
        "short_description": "A named Fort Mountain trail that helps Yonder connect weekend anchors to actual route inventory.",
        "description": "Big Rock Trail improves Yonder's trail graph in the most practical way: by converting an existing destination anchor into more explicit trail-level coverage. That is the right direction if Yonder wants to feel more definitive over time.",
        "planning_notes": "Best used as route-level support under Fort Mountain and for trail-specific hiking recommendations.",
        "parking_note": "Use official Fort Mountain State Park access and trailhead guidance.",
        "typical_duration_minutes": 180,
        "explore_blurb": "Route-level Fort Mountain coverage for better trail depth.",
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
    parser = argparse.ArgumentParser(description="Seed Yonder public-land trail wave 1.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing rows with Wave 1 trail fields.",
    )
    args = parser.parse_args()

    probe_index = load_probe_index()
    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    logger.info("=" * 72)
    logger.info("Yonder Public-Land Trail Wave 1")
    logger.info("=" * 72)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for seed in WAVE_1_TRAILS:
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
            client.table("venues").update(updates).eq("id", existing["id"]).execute()
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
