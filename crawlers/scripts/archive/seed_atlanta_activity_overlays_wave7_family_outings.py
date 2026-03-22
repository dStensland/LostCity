#!/usr/bin/env python3
"""
Seed Atlanta-owned venue rows and venue_features overlays for a family-outings wave.

Usage:
    python3 scripts/seed_atlanta_activity_overlays_wave7_family_outings.py
    python3 scripts/seed_atlanta_activity_overlays_wave7_family_outings.py --apply
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
    get_or_create_venue,
    upsert_venue_feature,
    venues_support_features_table,
)

logger = logging.getLogger(__name__)


ENSURE_VENUES: dict[str, dict[str, Any]] = {
    "sparkles-family-fun-center-kennesaw": {
        "name": "Sparkles Family Fun Center (Kennesaw)",
        "slug": "sparkles-family-fun-center-kennesaw",
        "address": "1000 McCollum Pkwy NW",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "arena",
        "spot_type": "games",
        "website": "https://sparkleskennesaw.com/activities/",
    },
    "noahs-ark-animal-sanctuary": {
        "name": "Noah's Ark Animal Sanctuary",
        "slug": "noahs-ark-animal-sanctuary",
        "address": "712 LG Griffin Rd",
        "city": "Locust Grove",
        "state": "GA",
        "zip": "30248",
        "venue_type": "attraction",
        "spot_type": "zoo",
        "website": "https://www.noahs-ark.org/",
    },
    "yule-forest": {
        "name": "Yule Forest",
        "slug": "yule-forest",
        "address": "3565 Hwy 155 N",
        "city": "Stockbridge",
        "state": "GA",
        "zip": "30281",
        "venue_type": "outdoor_venue",
        "spot_type": "outdoor_venue",
        "website": "https://yuleforest.com/",
    },
}


ATLANTA_ACTIVITY_OVERLAYS_WAVE7: dict[str, list[dict[str, Any]]] = {
    "sparkles-family-fun-center-kennesaw": [
        {
            "slug": "roller-skating-floor-and-lessons",
            "title": "Roller Skating Floor and Lessons",
            "feature_type": "attraction",
            "description": "Core roller-skating floor with lessons for kids, teens, and adults gives Sparkles durable all-weather family value beyond a one-note party venue.",
            "price_note": "Admission, skate rental, and lesson pricing vary by session",
            "url": "https://sparkleskennesaw.com/activities/",
            "sort_order": 10,
        },
        {
            "slug": "playground-and-laser-tag-mix",
            "title": "Playground and Laser Tag Mix",
            "feature_type": "experience",
            "description": "Playground, toddler area, and two-story laser tag give the venue real sibling-range and mixed-age outing utility.",
            "price_note": "Playground-only and attraction pricing vary",
            "url": "https://sparkleskennesaw.com/activities/",
            "sort_order": 20,
        },
        {
            "slug": "arcade-and-birthday-format",
            "title": "Arcade and Birthday Format",
            "feature_type": "experience",
            "description": "Arcade, cafe, and birthday-group positioning make Sparkles useful for Hooky beyond casual skating nights.",
            "price_note": "Arcade game cards and party packages are separately priced",
            "url": "https://sparkleskennesaw.com/activities/",
            "sort_order": 30,
        },
    ],
    "noahs-ark-animal-sanctuary": [
        {
            "slug": "animal-habitats-and-sanctuary-walk",
            "title": "Animal Habitats and Sanctuary Walk",
            "feature_type": "attraction",
            "description": "Large sanctuary grounds and animal habitats give Noah's Ark a distinctive family outing role that is more educational and rescue-focused than a standard zoo.",
            "price_note": "General admission is $10 per person beginning April 1, 2026",
            "url": "https://www.noahs-ark.org/visit/",
            "sort_order": 10,
        },
        {
            "slug": "resident-animal-learning-value",
            "title": "Resident Animal Learning Value",
            "feature_type": "experience",
            "description": "Resident animal stories and species learning make the sanctuary especially strong for mixed-age educational visits and no-school outings.",
            "price_note": "Learning value is included with general admission; some programs vary",
            "url": "https://www.noahs-ark.org/",
            "sort_order": 20,
        },
        {
            "slug": "guided-programs-and-family-events",
            "title": "Guided Programs and Family Events",
            "feature_type": "experience",
            "description": "Programs, guided visits, and family events make Noah's Ark more than a passive walk-through destination.",
            "price_note": "Program registration and special-event terms vary",
            "url": "https://www.noahs-ark.org/",
            "sort_order": 30,
        },
    ],
    "yule-forest": [
        {
            "slug": "pumpkin-patch-and-fall-farm-fun",
            "title": "Pumpkin Patch and Fall Farm Fun",
            "feature_type": "attraction",
            "description": "Pumpkin patch and broader fall farm activity make Yule Forest one of the clearest seasonal family outing anchors on the south side of metro Atlanta.",
            "price_note": "Seasonal admission and attraction pricing vary by event window",
            "url": "https://yuleforest.com/",
            "sort_order": 10,
        },
        {
            "slug": "christmas-tree-farm-traditions",
            "title": "Christmas Tree Farm Traditions",
            "feature_type": "experience",
            "description": "Christmas tree farm and holiday-tradition positioning give Yule Forest durable winter family relevance, not just a fall spike.",
            "price_note": "Christmas tree and holiday offerings are seasonal",
            "url": "https://yuleforest.com/",
            "sort_order": 20,
        },
        {
            "slug": "tulip-festival-and-spring-visit-value",
            "title": "Tulip Festival and Spring Visit Value",
            "feature_type": "experience",
            "description": "Spring tulip festival and hands-on farm experiences widen Yule Forest into a multi-season family destination rather than a single-occasion farm.",
            "price_note": "Spring event access and ticketing vary by year",
            "url": "https://yuleforest.com/",
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

    temp_or_real_id = get_or_create_venue(payload)
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

    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS_WAVE7.items():
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
        description="Seed Atlanta venue_features overlays for the seventh family-outings activity wave"
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
