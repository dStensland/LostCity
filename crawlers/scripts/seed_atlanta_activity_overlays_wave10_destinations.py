#!/usr/bin/env python3
"""
Seed Atlanta-owned venue rows and venue_features overlays for a final destination batch.

Usage:
    python3 scripts/seed_atlanta_activity_overlays_wave10_destinations.py
    python3 scripts/seed_atlanta_activity_overlays_wave10_destinations.py --apply
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
    "main-event-atlanta": {
        "name": "Main Event Atlanta",
        "slug": "main-event-atlanta",
        "address": "250 Cobb Pkwy S",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30339",
        "venue_type": "entertainment",
        "spot_type": "entertainment",
        "website": "https://www.mainevent.com/locations/georgia/atlanta/",
    },
    "stars-and-strikes-woodstock": {
        "name": "Stars and Strikes Woodstock",
        "slug": "stars-and-strikes-woodstock",
        "address": "10010 Hwy 92",
        "city": "Woodstock",
        "state": "GA",
        "zip": "30188",
        "venue_type": "games",
        "spot_type": "games",
        "website": "https://starsandstrikes.com/locations/woodstock-ga/",
    },
    "great-wolf-lodge-georgia": {
        "name": "Great Wolf Lodge Georgia",
        "slug": "great-wolf-lodge-georgia",
        "address": "150 Tom Hall Pkwy",
        "city": "LaGrange",
        "state": "GA",
        "zip": "30240",
        "venue_type": "attraction",
        "spot_type": "attraction",
        "website": "https://www.greatwolf.com/georgia",
    },
}


ATLANTA_ACTIVITY_OVERLAYS_WAVE10: dict[str, list[dict[str, Any]]] = {
    "main-event-atlanta": [
        {
            "slug": "bowling-arcade-and-games-floor",
            "title": "Bowling, Arcade, and Games Floor",
            "feature_type": "attraction",
            "description": "Bowling, arcade, and broad indoor game-floor value make Main Event Atlanta a clear all-weather family fallback with stronger range than a single-activity venue.",
            "price_note": "Bowling, arcade, and game pricing vary by attraction and package",
            "url": "https://www.mainevent.com/locations/georgia/atlanta/",
            "sort_order": 10,
        },
        {
            "slug": "laser-tag-gravity-ropes-and-attractions",
            "title": "Laser Tag, Gravity Ropes, and Attractions",
            "feature_type": "experience",
            "description": "Laser tag, ropes-style attractions, and side attractions give Main Event stronger tween and mixed-age family utility than a standard arcade.",
            "price_note": "Attraction access depends on venue offerings and package choice",
            "url": "https://www.mainevent.com/locations/georgia/atlanta/",
            "sort_order": 20,
        },
        {
            "slug": "birthday-and-group-outing-format",
            "title": "Birthday and Group Outing Format",
            "feature_type": "experience",
            "description": "Birthday and group-outing positioning makes Main Event useful for Hooky beyond same-day casual discovery.",
            "price_note": "Party and group package pricing varies",
            "url": "https://www.mainevent.com/locations/georgia/atlanta/",
            "sort_order": 30,
        },
    ],
    "stars-and-strikes-woodstock": [
        {
            "slug": "bowling-lanes-and-arcade-core",
            "title": "Bowling Lanes and Arcade Core",
            "feature_type": "attraction",
            "description": "Bowling lanes and arcade value make Stars and Strikes Woodstock a strong weather-proof family fallback in north metro.",
            "price_note": "Bowling, arcade, and timed deals vary by day and session",
            "url": "https://starsandstrikes.com/locations/woodstock-ga/",
            "sort_order": 10,
        },
        {
            "slug": "laser-tag-vr-and-family-attractions",
            "title": "Laser Tag, VR, and Family Attractions",
            "feature_type": "experience",
            "description": "Laser tag, VR, and attraction mix give the venue broader sibling-range utility than a simple bowling center.",
            "price_note": "Attractions and experience bundles vary by location and season",
            "url": "https://starsandstrikes.com/locations/woodstock-ga/",
            "sort_order": 20,
        },
        {
            "slug": "parties-events-and-group-play",
            "title": "Parties, Events, and Group Play",
            "feature_type": "experience",
            "description": "Birthday, event, and group-play positioning makes this a repeat-use family venue rather than a one-off entertainment option.",
            "price_note": "Party and event packages are separately priced",
            "url": "https://starsandstrikes.com/locations/woodstock-ga/",
            "sort_order": 30,
        },
    ],
    "great-wolf-lodge-georgia": [
        {
            "slug": "indoor-water-park-and-slide-complex",
            "title": "Indoor Water Park and Slide Complex",
            "feature_type": "attraction",
            "description": "The indoor water park gives Great Wolf Lodge Georgia a distinctive year-round family-destination role that few regional operators can match.",
            "price_note": "Room bundles, passes, and package pricing vary by date and demand",
            "url": "https://www.greatwolf.com/georgia",
            "sort_order": 10,
        },
        {
            "slug": "dry-play-and-family-attraction-mix",
            "title": "Dry Play and Family Attraction Mix",
            "feature_type": "experience",
            "description": "Dry-play attractions, themed activities, and indoor resort entertainment make Great Wolf more than a water-only family trip.",
            "price_note": "Some dry attractions are separately ticketed or package-based",
            "url": "https://www.greatwolf.com/georgia",
            "sort_order": 20,
        },
        {
            "slug": "overnight-getaway-and-school-break-value",
            "title": "Overnight Getaway and School-Break Value",
            "feature_type": "experience",
            "description": "Overnight resort format gives Great Wolf strong school-break, birthday, and visitor utility that complements Hooky's shorter local outing layer.",
            "price_note": "Overnight and package pricing vary widely by season",
            "url": "https://www.greatwolf.com/georgia",
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

    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS_WAVE10.items():
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
        description="Seed Atlanta venue_features overlays for the tenth destination activity wave"
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
