#!/usr/bin/env python3
"""
Seed Atlanta-owned venue_features overlays for Urban Air location venues.

Usage:
    python3 scripts/seed_atlanta_activity_overlays_urban_air.py
    python3 scripts/seed_atlanta_activity_overlays_urban_air.py --apply
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
    upsert_venue_feature,
    venues_support_features_table,
)

logger = logging.getLogger(__name__)


URBAN_AIR_ACTIVITY_OVERLAYS: dict[str, list[dict[str, Any]]] = {
    "urban-air-snellville": [
        {
            "slug": "open-jump-and-trampoline-zones",
            "title": "Open Jump and Trampoline Zones",
            "feature_type": "attraction",
            "description": "Core all-weather energy-burn space that makes Urban Air useful for spontaneous family outings and bad-weather fallback days.",
            "price_note": "Admission products vary by attraction access level",
            "url": "https://www.urbanair.com/georgia-snellville/",
            "sort_order": 10,
        },
        {
            "slug": "adventure-and-climbing-attractions",
            "title": "Adventure and Climbing Attractions",
            "feature_type": "attraction",
            "description": "Higher-energy ropes, climbing, and challenge attractions that broaden the venue beyond simple trampoline play.",
            "price_note": "Some attractions depend on ticket tier, age, or height requirements",
            "url": "https://www.urbanair.com/georgia-snellville/",
            "sort_order": 20,
        },
        {
            "slug": "toddler-and-sensory-friendly-windows",
            "title": "Toddler and Sensory-Friendly Windows",
            "feature_type": "experience",
            "description": "Family-relevant windows like toddler-focused or sensory-friendly sessions that improve the venue's usefulness when timing fits.",
            "price_note": "Check the live event calendar for age-fit and sensory-fit timing",
            "url": "https://www.urbanair.com/georgia-snellville/",
            "sort_order": 30,
        },
    ],
    "urban-air-buford": [
        {
            "slug": "open-jump-and-trampoline-zones",
            "title": "Open Jump and Trampoline Zones",
            "feature_type": "attraction",
            "description": "Core all-weather energy-burn space that makes Urban Air useful for spontaneous family outings and bad-weather fallback days.",
            "price_note": "Admission products vary by attraction access level",
            "url": "https://www.urbanair.com/georgia-buford/",
            "sort_order": 10,
        },
        {
            "slug": "adventure-and-climbing-attractions",
            "title": "Adventure and Climbing Attractions",
            "feature_type": "attraction",
            "description": "Higher-energy ropes, climbing, and challenge attractions that broaden the venue beyond simple trampoline play.",
            "price_note": "Some attractions depend on ticket tier, age, or height requirements",
            "url": "https://www.urbanair.com/georgia-buford/",
            "sort_order": 20,
        },
        {
            "slug": "toddler-and-sensory-friendly-windows",
            "title": "Toddler and Sensory-Friendly Windows",
            "feature_type": "experience",
            "description": "Family-relevant windows like toddler-focused or sensory-friendly sessions that improve the venue's usefulness when timing fits.",
            "price_note": "Check the live event calendar for age-fit and sensory-fit timing",
            "url": "https://www.urbanair.com/georgia-buford/",
            "sort_order": 30,
        },
    ],
    "urban-air-kennesaw": [
        {
            "slug": "open-jump-and-trampoline-zones",
            "title": "Open Jump and Trampoline Zones",
            "feature_type": "attraction",
            "description": "Core all-weather energy-burn space that makes Urban Air useful for spontaneous family outings and bad-weather fallback days.",
            "price_note": "Admission products vary by attraction access level",
            "url": "https://www.urbanair.com/georgia-kennesaw/",
            "sort_order": 10,
        },
        {
            "slug": "adventure-and-climbing-attractions",
            "title": "Adventure and Climbing Attractions",
            "feature_type": "attraction",
            "description": "Higher-energy ropes, climbing, and challenge attractions that broaden the venue beyond simple trampoline play.",
            "price_note": "Some attractions depend on ticket tier, age, or height requirements",
            "url": "https://www.urbanair.com/georgia-kennesaw/",
            "sort_order": 20,
        },
        {
            "slug": "toddler-and-sensory-friendly-windows",
            "title": "Toddler and Sensory-Friendly Windows",
            "feature_type": "experience",
            "description": "Family-relevant windows like toddler-focused or sensory-friendly sessions that improve the venue's usefulness when timing fits.",
            "price_note": "Check the live event calendar for age-fit and sensory-fit timing",
            "url": "https://www.urbanair.com/georgia-kennesaw/",
            "sort_order": 30,
        },
    ],
}


def seed_overlays(apply: bool = False) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    if not venues_support_features_table():
        logger.error("venue_features table missing; run migration 275_venue_features.sql first.")
        return

    configure_write_mode(apply, "" if apply else "dry-run")

    client = get_client()
    total = 0
    venue_total = 0

    for venue_slug, features in URBAN_AIR_ACTIVITY_OVERLAYS.items():
        venue_res = (
            client.table("places").select("id,name,slug").eq("slug", venue_slug).limit(1).execute()
        )
        if not venue_res.data:
            logger.warning("Venue slug '%s' not found; skipping", venue_slug)
            continue

        venue_total += 1
        venue = venue_res.data[0]
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
        description="Seed Atlanta venue_features overlays for Urban Air Atlanta-area location venues"
    )
    parser.add_argument("--apply", action="store_true", help="Commit writes (default: dry-run)")
    args = parser.parse_args()
    seed_overlays(apply=args.apply)


if __name__ == "__main__":
    main()
