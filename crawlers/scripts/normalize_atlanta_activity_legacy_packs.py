#!/usr/bin/env python3
"""
Normalize legacy activity feature packs to the modern three-row overlay standard.

Usage:
    python3 scripts/normalize_atlanta_activity_legacy_packs.py
    python3 scripts/normalize_atlanta_activity_legacy_packs.py --apply
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
    writes_enabled,
)

logger = logging.getLogger(__name__)


LEGACY_PACKS: dict[str, dict[str, Any]] = {
    "chattahoochee-nature-center": {
        "deactivate": [
            "winter-gallery",
            "river-roots-science-stations",
            "spring-gallery",
            "weekend-activities",
            "birdseed-fundraiser-pick-up",
            "naturally-artistic-interactive-exhibits",
            "wildlife-walk",
            "river-boardwalk-trails",
            "interactive-nature-play",
        ],
        "features": [
            {
                "slug": "wildlife-boardwalk-and-river-trails",
                "title": "Wildlife Boardwalk and River Trails",
                "feature_type": "attraction",
                "description": "Wildlife habitats, boardwalk access, and trail mileage make Chattahoochee Nature Center one of the strongest family nature-day destinations inside the metro.",
                "price_note": "Included with general admission; member access and timed programs vary",
                "url": "https://www.chattnaturecenter.org/explore/",
                "sort_order": 10,
            },
            {
                "slug": "interactive-nature-play-and-exhibits",
                "title": "Interactive Nature Play and Exhibits",
                "feature_type": "experience",
                "description": "Interactive exhibits, hands-on science moments, and kid-friendly nature play make the center work well for elementary ages and mixed-age siblings.",
                "price_note": "Included with admission; some exhibits and family programs rotate seasonally",
                "url": "https://www.chattnaturecenter.org/explore/exhibits/",
                "sort_order": 20,
            },
            {
                "slug": "seasonal-family-programs-and-gallery-days",
                "title": "Seasonal Family Programs and Gallery Days",
                "feature_type": "experience",
                "description": "Seasonal gallery programming, weekend activations, and family events give the center repeat-use value beyond a one-time nature walk.",
                "price_note": "Special programming and event pricing vary by calendar",
                "url": "https://www.chattnaturecenter.org/nature-art-galleries/",
                "sort_order": 30,
            },
        ],
    },
    "stone-mountain-park": {
        "deactivate": [
            "mini-golf",
            "dinosaur-explore",
            "scenic-railroad",
            "summit-skyride",
            "historic-square-a-collection-of-georgia-homes-and-antiques",
            "summit-trail",
            "lakeside-and-trail-outings",
        ],
        "features": [
            {
                "slug": "signature-attractions-and-mountain-icons",
                "title": "Signature Attractions and Mountain Icons",
                "feature_type": "attraction",
                "description": "Skyride, Scenic Railroad, and other signature paid attractions make Stone Mountain Park one of the region's biggest full-format family outing destinations.",
                "price_note": "Attraction ticketing, parking, and all-attractions pass pricing vary by season",
                "url": "https://www.stonemountainpark.com/Activities/Attractions/",
                "sort_order": 10,
            },
            {
                "slug": "trails-lakeside-outings-and-outdoor-play",
                "title": "Trails, Lakeside Outings, and Outdoor Play",
                "feature_type": "experience",
                "description": "Trail access, lakeside space, and large-format outdoor wandering give Stone Mountain value even when families skip the full paid-attractions stack.",
                "price_note": "Park entry and parking policies may still apply even without attraction tickets",
                "url": "https://www.stonemountainpark.com/Activities/",
                "sort_order": 20,
            },
            {
                "slug": "seasonal-family-add-ons-and-history-format",
                "title": "Seasonal Family Add-ons and History Format",
                "feature_type": "experience",
                "description": "Mini golf, history areas, and rotating family add-ons make the park flexible for visitors, school breaks, and mixed-age family planning.",
                "price_note": "Some attractions and seasonal experiences are separately ticketed",
                "url": "https://www.stonemountainpark.com/Activities/Attractions/",
                "sort_order": 30,
            },
        ],
    },
}


def _get_venue(slug: str) -> dict[str, Any] | None:
    client = get_client()
    result = client.table("places").select("id,name,slug").eq("slug", slug).limit(1).execute()
    if result.data:
        return result.data[0]
    return None


def _deactivate_features(venue_id: int, feature_slugs: list[str], apply: bool) -> int:
    if not feature_slugs:
        return 0
    if not apply or not writes_enabled():
        for slug in feature_slugs:
            logger.info("  would deactivate legacy feature slug=%s", slug)
        return len(feature_slugs)

    client = get_client()
    result = (
        client.table("venue_features")
        .update({"is_active": False})
        .eq("place_id", venue_id)
        .in_("slug", feature_slugs)
        .execute()
    )
    return len(result.data or [])


def normalize_legacy_packs(apply: bool = False) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    if not venues_support_features_table():
        logger.error("venue_features table missing; run migration 275_venue_features.sql first.")
        return

    configure_write_mode(apply, "" if apply else "dry-run")

    for venue_slug, pack in LEGACY_PACKS.items():
        venue = _get_venue(venue_slug)
        if not venue:
            logger.warning("Venue '%s' not found; skipping", venue_slug)
            continue

        logger.info("%s (%s): normalizing legacy pack", venue["name"], venue["slug"])
        deactivated = _deactivate_features(venue["id"], pack["deactivate"], apply)
        logger.info("  %s %d legacy features", "deactivated" if apply else "would deactivate", deactivated)

        for feature in pack["features"]:
            result = upsert_venue_feature(venue["id"], feature)
            logger.info(
                "  %s feature '%s' (id=%s)",
                "upserted" if apply else "would upsert",
                feature["title"],
                result,
            )

    logger.info("[%s] Legacy-pack normalization complete", "APPLIED" if apply else "DRY RUN")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize legacy Atlanta activity packs into the modern three-row overlay standard"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist changes to the database (default is dry-run mode)",
    )
    args = parser.parse_args()
    normalize_legacy_packs(apply=args.apply)


if __name__ == "__main__":
    main()
