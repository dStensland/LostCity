#!/usr/bin/env python3
"""
Seed Atlanta-owned venue rows and venue_features overlays for a trampoline-and-farms wave.

Usage:
    python3 scripts/seed_atlanta_activity_overlays_wave9_trampoline_and_farms.py
    python3 scripts/seed_atlanta_activity_overlays_wave9_trampoline_and_farms.py --apply
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import (  # noqa: E402
    configure_write_mode,
    get_client,
    get_or_create_place,
    upsert_venue_feature,
    venues_support_features_table,
)

logger = logging.getLogger(__name__)


ENSURE_VENUES: dict[str, dict[str, Any]] = {
    "sky-zone-atlanta": {
        "name": "Sky Zone Atlanta",
        "slug": "sky-zone-atlanta",
        "address": "425 Ernest W Barrett Pkwy NW",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "entertainment",
        "spot_type": "entertainment",
        "website": "https://www.skyzone.com/atlanta/",
    },
    "sky-zone-roswell": {
        "name": "Sky Zone Roswell",
        "slug": "sky-zone-roswell",
        "address": "1425 Market Blvd",
        "city": "Roswell",
        "state": "GA",
        "zip": "30076",
        "venue_type": "entertainment",
        "spot_type": "entertainment",
        "website": "https://www.skyzone.com/roswell/",
    },
    "uncle-shucks-corn-maze-and-pumpkin-patch": {
        "name": "Uncle Shuck's Corn Maze and Pumpkin Patch",
        "slug": "uncle-shucks-corn-maze-and-pumpkin-patch",
        "address": "125 Bannister Rd",
        "city": "Dawsonville",
        "state": "GA",
        "zip": "30534",
        "venue_type": "outdoor_venue",
        "spot_type": "outdoor_venue",
        "website": "https://uncleshucks.com/",
    },
    "warbington-farms": {
        "name": "Warbington Farms",
        "slug": "warbington-farms",
        "address": "5555 Crow Rd",
        "city": "Cumming",
        "state": "GA",
        "zip": "30041",
        "venue_type": "outdoor_venue",
        "spot_type": "outdoor_venue",
        "website": "https://www.warbingtonfarms.com/",
    },
}


ATLANTA_ACTIVITY_OVERLAYS_WAVE9: dict[str, list[dict[str, Any]]] = {
    "sky-zone-atlanta": [
        {
            "slug": "wall-to-wall-trampolines-and-open-jump",
            "title": "Wall-to-Wall Trampolines and Open Jump",
            "feature_type": "attraction",
            "description": "Core trampoline courts and open-jump format give Sky Zone one of the clearest all-weather energy-burn roles in the metro family layer.",
            "price_note": "Jump ticket pricing varies by session length and time window",
            "url": "https://www.skyzone.com/atlanta/",
            "sort_order": 10,
        },
        {
            "slug": "climbing-and-challenge-attractions",
            "title": "Climbing and Challenge Attractions",
            "feature_type": "experience",
            "description": "Challenge-zone attractions and climbing-style play make Sky Zone more useful than a one-note trampoline park for sibling-age spread.",
            "price_note": "Specific attractions vary by park and admission format",
            "url": "https://www.skyzone.com/atlanta/",
            "sort_order": 20,
        },
        {
            "slug": "toddler-programs-and-group-parties",
            "title": "Toddler Programs and Group Parties",
            "feature_type": "experience",
            "description": "Little-leaper style younger-kid windows and party/group positioning make the venue relevant beyond casual teen drop-ins.",
            "price_note": "Program windows and party packages vary",
            "url": "https://www.skyzone.com/atlanta/",
            "sort_order": 30,
        },
    ],
    "sky-zone-roswell": [
        {
            "slug": "wall-to-wall-trampolines-and-open-jump",
            "title": "Wall-to-Wall Trampolines and Open Jump",
            "feature_type": "attraction",
            "description": "Core trampoline courts and open-jump format give Sky Zone one of the clearest all-weather energy-burn roles in the metro family layer.",
            "price_note": "Jump ticket pricing varies by session length and time window",
            "url": "https://www.skyzone.com/roswell/",
            "sort_order": 10,
        },
        {
            "slug": "climbing-and-challenge-attractions",
            "title": "Climbing and Challenge Attractions",
            "feature_type": "experience",
            "description": "Challenge-zone attractions and climbing-style play make Sky Zone more useful than a one-note trampoline park for sibling-age spread.",
            "price_note": "Specific attractions vary by park and admission format",
            "url": "https://www.skyzone.com/roswell/",
            "sort_order": 20,
        },
        {
            "slug": "toddler-programs-and-group-parties",
            "title": "Toddler Programs and Group Parties",
            "feature_type": "experience",
            "description": "Little-leaper style younger-kid windows and party/group positioning make the venue relevant beyond casual teen drop-ins.",
            "price_note": "Program windows and party packages vary",
            "url": "https://www.skyzone.com/roswell/",
            "sort_order": 30,
        },
    ],
    "uncle-shucks-corn-maze-and-pumpkin-patch": [
        {
            "slug": "corn-maze-and-pumpkin-patch-core",
            "title": "Corn Maze and Pumpkin Patch Core",
            "feature_type": "attraction",
            "description": "The corn maze and pumpkin patch make Uncle Shuck's one of the clearest seasonal fall family anchors in the north-metro outing layer.",
            "price_note": "Seasonal admission and attraction pricing vary by date and event window",
            "url": "https://uncleshucks.com/",
            "sort_order": 10,
        },
        {
            "slug": "hayrides-slides-and-farm-play",
            "title": "Hayrides, Slides, and Farm Play",
            "feature_type": "experience",
            "description": "Hayrides, slides, and broader farm-play elements make the destination stronger than a simple photo-op pumpkin patch.",
            "price_note": "Included attractions and add-ons vary by season",
            "url": "https://uncleshucks.com/",
            "sort_order": 20,
        },
        {
            "slug": "night-maze-and-holiday-seasonality",
            "title": "Night Maze and Holiday Seasonality",
            "feature_type": "experience",
            "description": "Night-maze and holiday-season positioning widen Uncle Shuck's beyond daytime fall family visits alone.",
            "price_note": "Night and holiday experiences run only on seasonal schedules",
            "url": "https://uncleshucks.com/",
            "sort_order": 30,
        },
    ],
    "warbington-farms": [
        {
            "slug": "fall-farm-and-pumpkin-play",
            "title": "Fall Farm and Pumpkin Play",
            "feature_type": "attraction",
            "description": "Pumpkin patch and fall-farm play make Warbington one of the stronger north-metro seasonal family outing options.",
            "price_note": "Seasonal admission and attraction pricing vary",
            "url": "https://www.warbingtonfarms.com/",
            "sort_order": 10,
        },
        {
            "slug": "petting-farm-and-kid-attractions",
            "title": "Petting Farm and Kid Attractions",
            "feature_type": "experience",
            "description": "Animal interactions and younger-kid farm attractions broaden the venue beyond a quick seasonal stop.",
            "price_note": "Animal and attraction access varies by season or event package",
            "url": "https://www.warbingtonfarms.com/",
            "sort_order": 20,
        },
        {
            "slug": "sunflower-and-seasonal-festival-value",
            "title": "Sunflower and Seasonal Festival Value",
            "feature_type": "experience",
            "description": "Sunflower fields and special seasonal programming make Warbington more useful than a single pumpkin-season destination.",
            "price_note": "Festival windows and event pricing vary by season",
            "url": "https://www.warbingtonfarms.com/",
            "sort_order": 30,
        },
    ],
}


def _get_or_create_target_venue(venue_slug: str, apply: bool) -> dict[str, Any] | None:
    client = get_client()
    venue_res = (
        client.table("venues").select("id,name,slug").eq("slug", venue_slug).limit(1).execute()
    )
    if venue_res.data:
        return venue_res.data[0]

    payload = ENSURE_VENUES.get(venue_slug)
    if not payload:
        logger.warning("Venue slug '%s' not found and no ensure payload exists; skipping", venue_slug)
        return None

    temp_or_real_id = get_or_create_place(payload)
    if apply:
        venue_res = (
            client.table("venues").select("id,name,slug").eq("slug", venue_slug).limit(1).execute()
        )
        if venue_res.data:
            return venue_res.data[0]

    return {"id": temp_or_real_id, "name": payload["name"], "slug": venue_slug}


def seed_overlays(apply: bool = False) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    if not venues_support_features_table():
        logger.error("venue_features table missing; run migration 275_venue_features.sql first.")
        return

    configure_write_mode(apply, "" if apply else "dry-run")
    total = 0
    venue_total = 0

    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS_WAVE9.items():
        venue = _get_or_create_target_venue(venue_slug, apply)
        if not venue:
            continue

        venue_total += 1
        logger.info(
            "%s (%s): processing %d features",
            venue["name"],
            venue["slug"],
            len(features),
        )

        for feature in features:
            result = upsert_venue_feature(venue["id"], feature)
            action = "upserted" if apply else "would upsert"
            logger.info("  %s feature '%s' (id=%s)", action, feature["title"], result)
            total += 1

    mode = "APPLIED" if apply else "DRY RUN"
    logger.info("[%s] Processed %d venue feature overlays across %d venues", mode, total, venue_total)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed Atlanta venue_features overlays for the ninth trampoline-and-farms activity wave"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist changes to the database (default is dry-run mode)",
    )
    args = parser.parse_args()
    seed_overlays(apply=args.apply)


if __name__ == "__main__":
    main()
