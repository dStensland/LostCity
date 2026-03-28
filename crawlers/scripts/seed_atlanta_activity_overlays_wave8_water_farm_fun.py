#!/usr/bin/env python3
"""
Seed Atlanta-owned venue rows and venue_features overlays for a water/farm/fun wave.

Usage:
    python3 scripts/seed_atlanta_activity_overlays_wave8_water_farm_fun.py
    python3 scripts/seed_atlanta_activity_overlays_wave8_water_farm_fun.py --apply
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
    "metro-fun-center": {
        "name": "Metro Fun Center",
        "slug": "metro-fun-center",
        "address": "1959 Metropolitan Pkwy SW",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30315",
        "venue_type": "entertainment",
        "spot_type": "games",
        "website": "https://metrofuncenter.com/",
    },
    "pettit-creek-farms": {
        "name": "Pettit Creek Farms",
        "slug": "pettit-creek-farms",
        "address": "337 Cassville Rd",
        "city": "Cartersville",
        "state": "GA",
        "zip": "30120",
        "venue_type": "attraction",
        "spot_type": "zoo",
        "website": "https://pettitcreekfarms.com/",
    },
    "margaritaville-at-lanier-islands-water-park": {
        "name": "Margaritaville at Lanier Islands Water Park",
        "slug": "margaritaville-at-lanier-islands-water-park",
        "address": "7650 Lanier Islands Pkwy",
        "city": "Buford",
        "state": "GA",
        "zip": "30518",
        "venue_type": "attraction",
        "spot_type": "attraction",
        "website": "https://www.lanierislands.com/things_to_do_lake_lanier/water-lake-activities/water-park/",
    },
}


ATLANTA_ACTIVITY_OVERLAYS_WAVE8: dict[str, list[dict[str, Any]]] = {
    "metro-fun-center": [
        {
            "slug": "roller-skating-and-bowling-combo",
            "title": "Roller Skating and Bowling Combo",
            "feature_type": "attraction",
            "description": "Roller skating and large-lane bowling give Metro Fun Center durable mixed-age family value in a part of town with fewer all-weather family options.",
            "price_note": "Skating, bowling, shoes, and timed specials vary by session",
            "url": "https://metrofuncenter.com/",
            "sort_order": 10,
        },
        {
            "slug": "playland-laser-tag-and-arcade",
            "title": "Playland, Laser Tag, and Arcade",
            "feature_type": "experience",
            "description": "Playland, laser tag, arcade games, and party-oriented attractions make Metro stronger than a simple rink or bowling alley.",
            "price_note": "Playland and attraction pricing vary by package or special",
            "url": "https://metrofuncenter.com/",
            "sort_order": 20,
        },
        {
            "slug": "group-parties-and-family-flex-format",
            "title": "Group Parties and Family Flex Format",
            "feature_type": "experience",
            "description": "Birthday, reunion, and big-group positioning make Metro useful for Hooky beyond casual drop-in entertainment.",
            "price_note": "Party packages and event rentals vary",
            "url": "https://metrofuncenter.com/",
            "sort_order": 30,
        },
    ],
    "pettit-creek-farms": [
        {
            "slug": "farm-tours-and-petting-zoo",
            "title": "Farm Tours and Petting Zoo",
            "feature_type": "attraction",
            "description": "Guided farm tours and petting-zoo interaction give Pettit Creek broad family appeal beyond a single seasonal festival window.",
            "price_note": "Online farm-tour pricing starts around adult and child ticket rates and varies by add-ons",
            "url": "https://pettitcreekfarms.com/farm-tour/",
            "sort_order": 10,
        },
        {
            "slug": "camel-rides-and-hayride-experiences",
            "title": "Camel Rides and Hayride Experiences",
            "feature_type": "experience",
            "description": "Camel rides, hayrides, and unusual animal encounters make Pettit Creek one of the more distinctive animal-centered family outings in the region.",
            "price_note": "Camel rides and optional extras are separately priced or seasonally available",
            "url": "https://pettitcreekfarms.com/",
            "sort_order": 20,
        },
        {
            "slug": "holiday-and-special-event-farm-days",
            "title": "Holiday and Special-Event Farm Days",
            "feature_type": "experience",
            "description": "Holiday, fireworks, and special-event farm days make Pettit Creek useful for school-break and seasonal planning, not just routine tours.",
            "price_note": "Holiday and special-event access varies by event calendar",
            "url": "https://pettitcreekfarms.com/farm-tour/",
            "sort_order": 30,
        },
    ],
    "margaritaville-at-lanier-islands-water-park": [
        {
            "slug": "water-slides-and-water-coaster",
            "title": "Water Slides and Water Coaster",
            "feature_type": "attraction",
            "description": "Signature slides and Georgia's only water coaster give Margaritaville at Lanier Islands clear summer tentpole value for older kids and mixed-age families.",
            "price_note": "Water park admission and season-pass pricing vary",
            "url": "https://www.lanierislands.com/things_to_do_lake_lanier/water-lake-activities/water-park/",
            "sort_order": 10,
        },
        {
            "slug": "wave-pool-and-family-water-play",
            "title": "Wave Pool and Family Water Play",
            "feature_type": "experience",
            "description": "Wave pool, kids' water-play areas, and broader splash-zone value make the park useful for more than thrill-seeking teens.",
            "price_note": "Attraction availability and seasonal operations vary",
            "url": "https://www.lanierislands.com/things_to_do_lake_lanier/water-lake-activities/water-park/",
            "sort_order": 20,
        },
        {
            "slug": "summer-day-trip-and-lakeside-format",
            "title": "Summer Day-Trip and Lakeside Format",
            "feature_type": "experience",
            "description": "Lakeside resort-day positioning makes this a strong summer backup when families want a larger-format outing than a neighborhood splash pad.",
            "price_note": "Parking, add-ons, and resort-day costs vary separately from admission",
            "url": "https://www.lanierislands.com/things_to_do_lake_lanier/water-lake-activities/",
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

    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS_WAVE8.items():
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
        description="Seed Atlanta venue_features overlays for the eighth water/farm/fun activity wave"
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
