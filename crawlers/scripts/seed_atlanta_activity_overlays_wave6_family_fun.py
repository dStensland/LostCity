#!/usr/bin/env python3
"""
Seed Atlanta-owned venue rows and venue_features overlays for a family-fun wave.

Usage:
    python3 scripts/seed_atlanta_activity_overlays_wave6_family_fun.py
    python3 scripts/seed_atlanta_activity_overlays_wave6_family_fun.py --apply
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
    "fun-spot-america-atlanta": {
        "name": "Fun Spot America Atlanta",
        "slug": "fun-spot-america-atlanta",
        "address": "1675 Hwy 85 N",
        "city": "Fayetteville",
        "state": "GA",
        "zip": "30214",
        "venue_type": "attraction",
        "spot_type": "attraction",
        "website": "https://funspotamericaatlanta.com/",
    },
    "southern-belle-farm": {
        "name": "Southern Belle Farm",
        "slug": "southern-belle-farm",
        "address": "1658 Turner Church Rd",
        "city": "McDonough",
        "state": "GA",
        "zip": "30252",
        "venue_type": "outdoor_venue",
        "spot_type": "outdoor_venue",
        "website": "https://www.southernbellefarm.com/",
    },
    "monster-mini-golf-marietta": {
        "name": "Monster Mini Golf Marietta",
        "slug": "monster-mini-golf-marietta",
        "address": "2505 Chastain Meadows Pkwy NW",
        "city": "Marietta",
        "state": "GA",
        "zip": "30066",
        "venue_type": "entertainment",
        "spot_type": "games",
        "website": "https://monsterminigolf.com/locations/us/ga/marietta/",
    },
    "puttshack-atlanta": {
        "name": "Puttshack Atlanta",
        "slug": "puttshack-atlanta",
        "address": "1115 Howell Mill Rd",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "entertainment",
        "spot_type": "games",
        "website": "https://www.puttshack.com/locations/atlanta/",
    },
}


ATLANTA_ACTIVITY_OVERLAYS_WAVE6: dict[str, list[dict[str, Any]]] = {
    "fun-spot-america-atlanta": [
        {
            "slug": "go-karts-and-coaster-thrills",
            "title": "Go Karts and Coaster Thrills",
            "feature_type": "attraction",
            "description": "Go-kart tracks and headline coaster value that give Fun Spot real older-kid and mixed-age family pull beyond a one-off event calendar.",
            "price_note": "Admission to the park is free, but rides and passes are paid",
            "url": "https://funspotamericaatlanta.com/",
            "sort_order": 10,
        },
        {
            "slug": "kids-rides-and-family-attractions",
            "title": "Kids' Rides and Family Attractions",
            "feature_type": "experience",
            "description": "Family rides, kids' rides, and indoor attractions that make the park more flexible than a thrill-only destination.",
            "price_note": "Ride access depends on ticket or pass selection",
            "url": "https://funspotamericaatlanta.com/",
            "sort_order": 20,
        },
        {
            "slug": "arcade-and-free-admission-flexibility",
            "title": "Arcade and Free-Admission Flexibility",
            "feature_type": "experience",
            "description": "Arcade, midway, and free-entry format that make Fun Spot useful for spontaneous family plans without a full-day commitment.",
            "price_note": "Food, arcade play, and attractions are separately priced",
            "url": "https://funspotamericaatlanta.com/",
            "sort_order": 30,
        },
    ],
    "southern-belle-farm": [
        {
            "slug": "u-pick-fields-and-harvest-seasons",
            "title": "U-Pick Fields and Harvest Seasons",
            "feature_type": "attraction",
            "description": "Spring and summer berry, flower, and peach-picking value that makes Southern Belle Farm a durable family outing rather than just a fall attraction.",
            "price_note": "Seasonal admission and produce pricing vary by activity",
            "url": "https://www.southernbellefarm.com/",
            "sort_order": 10,
        },
        {
            "slug": "fall-festival-and-corn-maze",
            "title": "Fall Festival and Corn Maze",
            "feature_type": "experience",
            "description": "Pumpkin patch, corn maze, and broader fall-festival play that make the farm one of the clearest seasonal family anchors south of Atlanta.",
            "price_note": "Fall festival dates and attraction pricing vary by season",
            "url": "https://www.southernbellefarm.com/fall/",
            "sort_order": 20,
        },
        {
            "slug": "christmas-and-family-traditions",
            "title": "Christmas and Family Traditions",
            "feature_type": "experience",
            "description": "Christmas programming, Santa visits, and family-tradition positioning that keep the farm relevant outside harvest season.",
            "price_note": "Holiday experiences are seasonal and separately scheduled",
            "url": "https://www.southernbellefarm.com/christmas/",
            "sort_order": 30,
        },
    ],
    "monster-mini-golf-marietta": [
        {
            "slug": "glow-in-the-dark-mini-golf",
            "title": "Glow-in-the-Dark Mini Golf",
            "feature_type": "attraction",
            "description": "Indoor glow-in-the-dark mini golf gives Monster Mini Golf a clear rainy-day and birthday-outing role for younger kids and mixed-age families.",
            "price_note": "General pricing is published for little monsters and big monsters",
            "url": "https://monsterminigolf.com/locations/us/ga/marietta/mini-golf/",
            "sort_order": 10,
        },
        {
            "slug": "arcade-and-vr-attractions",
            "title": "Arcade and VR Attractions",
            "feature_type": "experience",
            "description": "Arcade and virtual-reality add-ons give the venue broader outing value than mini golf alone and help it work for sibling-age spread.",
            "price_note": "Arcade and VR combinations are priced separately from golf",
            "url": "https://monsterminigolf.com/locations/us/ga/marietta/",
            "sort_order": 20,
        },
        {
            "slug": "birthday-and-group-play-format",
            "title": "Birthday and Group Play Format",
            "feature_type": "experience",
            "description": "Birthday, field-trip, and group-event positioning makes Monster Mini Golf more useful to Hooky than a basic one-off game venue.",
            "price_note": "Party and group packages vary",
            "url": "https://monsterminigolf.com/locations/us/ga/marietta/",
            "sort_order": 30,
        },
    ],
    "puttshack-atlanta": [
        {
            "slug": "tech-driven-mini-golf-courses",
            "title": "Tech-Driven Mini Golf Courses",
            "feature_type": "attraction",
            "description": "Tech-enabled mini golf gives Puttshack a distinctive family-and-groups position for older kids, tweens, and visitors in town.",
            "price_note": "Game pricing varies by time and booking format",
            "url": "https://www.puttshack.com/locations/atlanta/",
            "sort_order": 10,
        },
        {
            "slug": "kids-value-and-flex-play-windows",
            "title": "Kids' Value and Flex-Play Windows",
            "feature_type": "experience",
            "description": "Offers like all-you-can-putt windows and kid pricing make Puttshack more family-usable than a generic nightlife-only venue.",
            "price_note": "Family-friendly pricing windows and offers vary by date",
            "url": "https://www.puttshack.com/locations/atlanta/",
            "sort_order": 20,
        },
        {
            "slug": "food-drink-and-group-outing-format",
            "title": "Food, Drink, and Group Outing Format",
            "feature_type": "experience",
            "description": "Food, private-event, and group-outing format help Puttshack work for older-kid family plans, visitors, and mixed social groups.",
            "price_note": "Dining and event packages are separately priced",
            "url": "https://www.puttshack.com/locations/atlanta/",
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

    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS_WAVE6.items():
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
        description="Seed Atlanta venue_features overlays for the sixth family-fun activity wave"
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
