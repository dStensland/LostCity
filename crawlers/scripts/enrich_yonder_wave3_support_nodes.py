#!/usr/bin/env python3
"""
Enrich Yonder Wave 3 support nodes already present in the venue graph.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/enrich_yonder_wave3_support_nodes.py
    python3 scripts/enrich_yonder_wave3_support_nodes.py --apply
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

WAVE_3_UPDATES = [
    {
        "slug": "sweetwater-creek-state-park",
        "website": "https://gastateparks.org/SweetwaterCreek",
        "short_description": "Close-in state park with creekside trails, mill ruins, and enough payoff to justify a real half-day outside.",
        "planning_notes": "Best after rain and in cooler seasons. Strong for a real trail outing without the drive burden of North Georgia.",
        "typical_duration_minutes": 180,
    },
    {
        "slug": "panola-mountain",
        "website": "https://gastateparks.org/PanolaMountain",
        "short_description": "Distinct granite landscape with lower-friction hiking and one of the best close-in alternatives to the Chattahoochee corridor.",
        "planning_notes": "Best in cooler weather and clear-day windows. Good for scenic half-day recommendations that feel different from river trails.",
        "typical_duration_minutes": 150,
    },
    {
        "slug": "cochran-shoals-trail",
        "website": "https://www.nps.gov/chat/planyourvisit/cochran-shoals.htm",
        "short_description": "Reliable river-adjacent mileage with easy logistics and broad appeal for repeatable half-day outdoor plans.",
        "planning_notes": "Useful year-round and especially strong for low-friction mileage, beginner-friendly trail time, and fallback outdoor recommendations.",
        "typical_duration_minutes": 150,
    },
    {
        "slug": "shoot-the-hooch-powers-island",
        "website": "https://shootthehooch.com/",
        "short_description": "Metro Chattahoochee launch and float anchor that gives Yonder a real water lane, not just another trail card.",
        "planning_notes": "Best in warm-weather windows and group-friendly summer planning. Pair with river-safety context as Yonder's water recommendations deepen.",
        "typical_duration_minutes": 180,
    },
    {
        "slug": "island-ford-crnra-boat-ramp",
        "website": "https://www.nps.gov/chat/planyourvisit/island-ford.htm",
        "short_description": "Chattahoochee access node that helps Yonder build a true river-entry layer for paddling and float planning.",
        "planning_notes": "Best used as a support node in water-focused modules and access-point collections rather than a standalone scenic flagship.",
        "typical_duration_minutes": 120,
    },
    {
        "slug": "chattahoochee-bend-state-park",
        "website": "https://gastateparks.org/ChattahoocheeBend",
        "short_description": "Camp-capable river park that makes the weekend layer feel reachable without always sending users deep into North Georgia.",
        "planning_notes": "Useful for close-in weekend prompts, early camping-adjacent framing, and lower-friction overnighter ideas.",
        "typical_duration_minutes": 300,
    },
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich Yonder Wave 3 support nodes.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    args = parser.parse_args()

    client = get_client()
    updated = 0
    skipped = 0
    missing = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 3 Support Node Enrichment")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("")

    for payload in WAVE_3_UPDATES:
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
