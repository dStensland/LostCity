#!/usr/bin/env python3
"""
Enrich Yonder Wave 4 support nodes already present in the venue graph.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/enrich_yonder_wave4_support_nodes.py
    python3 scripts/enrich_yonder_wave4_support_nodes.py --apply
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

WAVE_4_UPDATES = [
    {
        "slug": "chattahoochee-river-nra",
        "website": "https://www.nps.gov/chat",
        "short_description": "Umbrella Chattahoochee anchor for trails, launches, and warm-weather river-day planning close to Atlanta.",
        "planning_notes": "Best used as the parent river destination when Yonder needs to orient users to the broader Chattahoochee system and then hand them to more specific access nodes.",
        "typical_duration_minutes": 180,
    },
    {
        "slug": "east-palisades-trail",
        "website": "https://www.nps.gov/chat/planyourvisit/east-palisades.htm",
        "short_description": "River-bluff trail with strong local character and one of the best short-drive Chattahoochee hikes.",
        "planning_notes": "Useful for half-day recommendations that need more scenic payoff than a standard river loop. Works across seasons and especially well for summer shade and river-adjacent trail time.",
        "typical_duration_minutes": 150,
        "spot_type": "trail",
    },
    {
        "slug": "indian-trail-entrance-east-palisades-unit-chattahoochee-nra",
        "website": "https://www.nps.gov/chat/planyourvisit/east-palisades.htm",
        "short_description": "Access-point node for East Palisades that helps Yonder make river-entry and route logic more usable.",
        "planning_notes": "Best treated as an access node inside Chattahoochee recommendations and collections rather than a broad flagship destination on its own.",
        "typical_duration_minutes": 120,
        "parking_note": "Trailhead access for East Palisades via the Indian Trail entrance. Use as a precision waypoint when route clarity matters.",
    },
    {
        "slug": "whitewater-express-columbus",
        "website": "https://whitewaterexpress.com",
        "short_description": "Operator anchor for a true Georgia whitewater day, not just a float or launch point.",
        "planning_notes": "Best used for warm-weather crew plans and bigger water-adventure prompts. Position as an operator-led trip rather than a generic destination.",
        "typical_duration_minutes": 300,
    },
    {
        "slug": "etowah-river-park",
        "city": "Canton",
        "state": "GA",
        "website": "https://www.cantonga.gov/government/departments/parks-recreation/etowah-river-park",
        "short_description": "North-metro river park that helps broaden Yonder's water lane beyond the Chattahoochee core.",
        "planning_notes": "Useful for warm-weather water access, family-friendly riverfront suggestions, and diversifying Yonder's half-day water shelf.",
        "typical_duration_minutes": 150,
    },
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich Yonder Wave 4 support nodes.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    args = parser.parse_args()

    client = get_client()
    updated = 0
    skipped = 0
    missing = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 4 Support Node Enrichment")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("")

    for payload in WAVE_4_UPDATES:
        row = get_venue_by_slug(payload["slug"])
        if not row:
            logger.info("MISS venue: %s", payload["slug"])
            missing += 1
            continue

        updates = {}
        for key, value in payload.items():
            if key == "slug":
                continue
            current = row.get(key)
            if current != value:
                updates[key] = value

        if not updates:
            logger.info("KEEP venue: %s", payload["slug"])
            skipped += 1
            continue

        if args.apply:
            client.table("places").update(updates).eq("id", row["id"]).execute()
        logger.info(
            "%s venue: %s (%s fields)",
            "UPDATE" if args.apply else "WOULD UPDATE",
            payload["slug"],
            len(updates),
        )
        updated += 1

    logger.info("")
    logger.info("Summary: updated=%s skipped=%s missing=%s", updated, skipped, missing)


if __name__ == "__main__":
    main()
