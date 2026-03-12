#!/usr/bin/env python3
"""
Seed Atlanta-owned venue rows and venue_features overlays for Catch Air Georgia locations.

Usage:
    python3 scripts/seed_atlanta_activity_overlays_wave5_catch_air.py
    python3 scripts/seed_atlanta_activity_overlays_wave5_catch_air.py --apply
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
    "catch-air-marietta": {
        "name": "Catch Air Marietta",
        "slug": "catch-air-marietta",
        "address": "2505 Chastain Meadows Pkwy NW #103",
        "city": "Marietta",
        "state": "GA",
        "zip": "30066",
        "venue_type": "games",
        "spot_type": "games",
        "website": "https://catchair.com/geo_location/marietta-ga/",
    },
    "catch-air-dacula": {
        "name": "Catch Air Dacula",
        "slug": "catch-air-dacula",
        "address": "1152 Auburn Rd #301",
        "city": "Dacula",
        "state": "GA",
        "zip": "30019",
        "venue_type": "games",
        "spot_type": "games",
        "website": "https://catchair.com/geo_location/dacula-ga/",
    },
    "catch-air-johns-creek": {
        "name": "Catch Air Johns Creek",
        "slug": "catch-air-johns-creek",
        "address": "10950 State Bridge Rd",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30022",
        "venue_type": "games",
        "spot_type": "games",
        "website": "https://catchair.com/geo_location/johns-creek-ga/",
    },
    "catch-air-snellville": {
        "name": "Catch Air Snellville",
        "slug": "catch-air-snellville",
        "address": "1957 Scenic Hwy S",
        "city": "Snellville",
        "state": "GA",
        "zip": "30078",
        "venue_type": "games",
        "spot_type": "games",
        "website": "https://catchair.com/geo_location/snellville-ga/",
    },
    "catch-air-tucker": {
        "name": "Catch Air Tucker",
        "slug": "catch-air-tucker",
        "address": "4023 Lavista Rd #230",
        "city": "Tucker",
        "state": "GA",
        "zip": "30084",
        "venue_type": "games",
        "spot_type": "games",
        "website": "https://catchair.com/geo_location/tucker-ga/",
    },
}


CATCH_AIR_OVERLAYS: dict[str, list[dict[str, Any]]] = {
    "catch-air-marietta": [
        {
            "slug": "indoor-soft-play-castle",
            "title": "Indoor Soft-Play Castle",
            "feature_type": "attraction",
            "description": "Large indoor soft-play structure that makes Catch Air a strong weather-proof option for younger kids.",
            "price_note": "Walk-in pricing varies by child age and day",
            "url": "https://catchair.com/geo_location/marietta-ga/",
            "sort_order": 10,
        },
        {
            "slug": "toddler-and-preschool-play-zones",
            "title": "Toddler and Preschool Play Zones",
            "feature_type": "experience",
            "description": "Age-friendly play areas that make the venue especially useful for toddler and preschool family planning.",
            "price_note": "Best fit is younger kids rather than older tweens",
            "url": "https://catchair.com/geo_location/marietta-ga/",
            "sort_order": 20,
        },
        {
            "slug": "parties-and-field-trip-format",
            "title": "Parties and Field Trip Format",
            "feature_type": "experience",
            "description": "Party, group, and field-trip positioning that makes Catch Air relevant for more than casual drop-in play.",
            "price_note": "Group programs and parties vary by booking format",
            "url": "https://catchair.com/geo_location/marietta-ga/",
            "sort_order": 30,
        },
    ],
    "catch-air-dacula": [
        {
            "slug": "indoor-soft-play-castle",
            "title": "Indoor Soft-Play Castle",
            "feature_type": "attraction",
            "description": "Large indoor soft-play structure that makes Catch Air a strong weather-proof option for younger kids.",
            "price_note": "Walk-in pricing varies by child age and day",
            "url": "https://catchair.com/geo_location/dacula-ga/",
            "sort_order": 10,
        },
        {
            "slug": "toddler-and-preschool-play-zones",
            "title": "Toddler and Preschool Play Zones",
            "feature_type": "experience",
            "description": "Age-friendly play areas that make the venue especially useful for toddler and preschool family planning.",
            "price_note": "Best fit is younger kids rather than older tweens",
            "url": "https://catchair.com/geo_location/dacula-ga/",
            "sort_order": 20,
        },
        {
            "slug": "parties-and-field-trip-format",
            "title": "Parties and Field Trip Format",
            "feature_type": "experience",
            "description": "Party, group, and field-trip positioning that makes Catch Air relevant for more than casual drop-in play.",
            "price_note": "Group programs and parties vary by booking format",
            "url": "https://catchair.com/geo_location/dacula-ga/",
            "sort_order": 30,
        },
    ],
    "catch-air-johns-creek": [
        {
            "slug": "indoor-soft-play-castle",
            "title": "Indoor Soft-Play Castle",
            "feature_type": "attraction",
            "description": "Large indoor soft-play structure that makes Catch Air a strong weather-proof option for younger kids.",
            "price_note": "Walk-in pricing varies by child age and day",
            "url": "https://catchair.com/geo_location/johns-creek-ga/",
            "sort_order": 10,
        },
        {
            "slug": "toddler-and-preschool-play-zones",
            "title": "Toddler and Preschool Play Zones",
            "feature_type": "experience",
            "description": "Age-friendly play areas that make the venue especially useful for toddler and preschool family planning.",
            "price_note": "Best fit is younger kids rather than older tweens",
            "url": "https://catchair.com/geo_location/johns-creek-ga/",
            "sort_order": 20,
        },
        {
            "slug": "parties-and-field-trip-format",
            "title": "Parties and Field Trip Format",
            "feature_type": "experience",
            "description": "Party, group, and field-trip positioning that makes Catch Air relevant for more than casual drop-in play.",
            "price_note": "Group programs and parties vary by booking format",
            "url": "https://catchair.com/geo_location/johns-creek-ga/",
            "sort_order": 30,
        },
    ],
    "catch-air-snellville": [
        {
            "slug": "indoor-soft-play-castle",
            "title": "Indoor Soft-Play Castle",
            "feature_type": "attraction",
            "description": "Large indoor soft-play structure that makes Catch Air a strong weather-proof option for younger kids.",
            "price_note": "Walk-in pricing varies by child age and day",
            "url": "https://catchair.com/geo_location/snellville-ga/",
            "sort_order": 10,
        },
        {
            "slug": "toddler-and-preschool-play-zones",
            "title": "Toddler and Preschool Play Zones",
            "feature_type": "experience",
            "description": "Age-friendly play areas that make the venue especially useful for toddler and preschool family planning.",
            "price_note": "Best fit is younger kids rather than older tweens",
            "url": "https://catchair.com/geo_location/snellville-ga/",
            "sort_order": 20,
        },
        {
            "slug": "parties-and-field-trip-format",
            "title": "Parties and Field Trip Format",
            "feature_type": "experience",
            "description": "Party, group, and field-trip positioning that makes Catch Air relevant for more than casual drop-in play.",
            "price_note": "Group programs and parties vary by booking format",
            "url": "https://catchair.com/geo_location/snellville-ga/",
            "sort_order": 30,
        },
    ],
    "catch-air-tucker": [
        {
            "slug": "indoor-soft-play-castle",
            "title": "Indoor Soft-Play Castle",
            "feature_type": "attraction",
            "description": "Large indoor soft-play structure that makes Catch Air a strong weather-proof option for younger kids.",
            "price_note": "Walk-in pricing varies by child age and day",
            "url": "https://catchair.com/geo_location/tucker-ga/",
            "sort_order": 10,
        },
        {
            "slug": "toddler-and-preschool-play-zones",
            "title": "Toddler and Preschool Play Zones",
            "feature_type": "experience",
            "description": "Age-friendly play areas that make the venue especially useful for toddler and preschool family planning.",
            "price_note": "Best fit is younger kids rather than older tweens",
            "url": "https://catchair.com/geo_location/tucker-ga/",
            "sort_order": 20,
        },
        {
            "slug": "parties-and-field-trip-format",
            "title": "Parties and Field Trip Format",
            "feature_type": "experience",
            "description": "Party, group, and field-trip positioning that makes Catch Air relevant for more than casual drop-in play.",
            "price_note": "Group programs and parties vary by booking format",
            "url": "https://catchair.com/geo_location/tucker-ga/",
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

    for venue_slug, features in CATCH_AIR_OVERLAYS.items():
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
        description="Seed Atlanta venue_features overlays for Catch Air Georgia locations"
    )
    parser.add_argument("--apply", action="store_true", help="Commit writes (default: dry-run)")
    args = parser.parse_args()
    seed_overlays(apply=args.apply)


if __name__ == "__main__":
    main()
