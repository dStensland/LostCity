#!/usr/bin/env python3
"""
Seed Atlanta-owned venue_features overlays for the third activity wave.

Usage:
    python3 scripts/seed_atlanta_activity_overlays_wave3.py
    python3 scripts/seed_atlanta_activity_overlays_wave3.py --apply
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


ATLANTA_ACTIVITY_OVERLAYS_WAVE3: dict[str, list[dict[str, Any]]] = {
    "andretti-marietta": [
        {
            "slug": "indoor-karting-tracks",
            "title": "Indoor Karting Tracks",
            "feature_type": "attraction",
            "description": "High-energy indoor karting that gives Andretti one of the strongest tween, teen, and mixed-age family outing hooks in the metro.",
            "price_note": "Ride access and height requirements vary by attraction",
            "url": "https://andrettikarting.com/marietta/",
            "sort_order": 10,
        },
        {
            "slug": "arcade-and-game-floor",
            "title": "Arcade and Game Floor",
            "feature_type": "experience",
            "description": "Game-floor activity that helps the venue work for groups with mixed ages and energy levels, not just kart riders.",
            "price_note": "Arcade play typically requires a game card or separate spend",
            "url": "https://andrettikarting.com/marietta/",
            "sort_order": 20,
        },
        {
            "slug": "ropes-and-attraction-mix",
            "title": "Ropes and Attraction Mix",
            "feature_type": "attraction",
            "description": "Additional attraction mix like ropes, simulators, or active-play elements that broaden Andretti beyond racing-only appeal.",
            "price_note": "Attraction access depends on package and safety rules",
            "url": "https://andrettikarting.com/marietta/",
            "sort_order": 30,
        },
    ],
    "andretti-buford": [
        {
            "slug": "indoor-karting-tracks",
            "title": "Indoor Karting Tracks",
            "feature_type": "attraction",
            "description": "High-energy indoor karting that gives Andretti one of the strongest tween, teen, and mixed-age family outing hooks in the metro.",
            "price_note": "Ride access and height requirements vary by attraction",
            "url": "https://andrettikarting.com/buford/",
            "sort_order": 10,
        },
        {
            "slug": "arcade-and-game-floor",
            "title": "Arcade and Game Floor",
            "feature_type": "experience",
            "description": "Game-floor activity that helps the venue work for groups with mixed ages and energy levels, not just kart riders.",
            "price_note": "Arcade play typically requires a game card or separate spend",
            "url": "https://andrettikarting.com/buford/",
            "sort_order": 20,
        },
        {
            "slug": "ropes-and-attraction-mix",
            "title": "Ropes and Attraction Mix",
            "feature_type": "attraction",
            "description": "Additional attraction mix like ropes, simulators, or active-play elements that broaden Andretti beyond racing-only appeal.",
            "price_note": "Attraction access depends on package and safety rules",
            "url": "https://andrettikarting.com/buford/",
            "sort_order": 30,
        },
    ],
    "main-event-alpharetta": [
        {
            "slug": "bowling-lanes",
            "title": "Bowling Lanes",
            "feature_type": "attraction",
            "description": "Core bowling attraction that gives Main Event broad multigenerational and mixed-age family usefulness.",
            "price_note": "Lane pricing and promotions vary",
            "url": "https://www.mainevent.com/locations/georgia/alpharetta",
            "sort_order": 10,
        },
        {
            "slug": "arcade-and-redemption-games",
            "title": "Arcade and Redemption Games",
            "feature_type": "experience",
            "description": "Indoor arcade floor that makes the venue a strong rainy-day and boredom-breaker option for families.",
            "price_note": "Game-card pricing varies",
            "url": "https://www.mainevent.com/locations/georgia/alpharetta",
            "sort_order": 20,
        },
        {
            "slug": "activity-attractions-mix",
            "title": "Activity Attractions Mix",
            "feature_type": "attraction",
            "description": "Additional attractions like gravity ropes, laser tag, or challenge elements that broaden the stop beyond bowling.",
            "price_note": "Attraction access depends on package and current offerings",
            "url": "https://www.mainevent.com/locations/georgia/alpharetta",
            "sort_order": 30,
        },
    ],
    "stars-and-strikes-dacula": [
        {
            "slug": "bowling-and-lane-play",
            "title": "Bowling and Lane Play",
            "feature_type": "attraction",
            "description": "Bowling-led destination value that makes Stars and Strikes a durable group and family fallback outing.",
            "price_note": "Lane pricing and specials vary",
            "url": "https://starsandstrikes.com/",
            "sort_order": 10,
        },
        {
            "slug": "arcade-and-games",
            "title": "Arcade and Games",
            "feature_type": "experience",
            "description": "Arcade and indoor game floor that broadens the stop for siblings and mixed-age groups.",
            "price_note": "Arcade spend varies",
            "url": "https://starsandstrikes.com/",
            "sort_order": 20,
        },
        {
            "slug": "laser-tag-and-family-attractions",
            "title": "Laser Tag and Family Attractions",
            "feature_type": "attraction",
            "description": "Family-fun attraction layer that helps the venue work as a longer stay destination instead of a single-activity stop.",
            "price_note": "Attraction access varies by package and site",
            "url": "https://starsandstrikes.com/",
            "sort_order": 30,
        },
    ],
    "stars-and-strikes-cumming": [
        {
            "slug": "bowling-and-lane-play",
            "title": "Bowling and Lane Play",
            "feature_type": "attraction",
            "description": "Bowling-led destination value that makes Stars and Strikes a durable group and family fallback outing.",
            "price_note": "Lane pricing and specials vary",
            "url": "https://starsandstrikes.com/",
            "sort_order": 10,
        },
        {
            "slug": "arcade-and-games",
            "title": "Arcade and Games",
            "feature_type": "experience",
            "description": "Arcade and indoor game floor that broadens the stop for siblings and mixed-age groups.",
            "price_note": "Arcade spend varies",
            "url": "https://starsandstrikes.com/",
            "sort_order": 20,
        },
        {
            "slug": "laser-tag-and-family-attractions",
            "title": "Laser Tag and Family Attractions",
            "feature_type": "attraction",
            "description": "Family-fun attraction layer that helps the venue work as a longer stay destination instead of a single-activity stop.",
            "price_note": "Attraction access varies by package and site",
            "url": "https://starsandstrikes.com/",
            "sort_order": 30,
        },
    ],
    "shoot-the-hooch-powers-island": [
        {
            "slug": "river-tubing-runs",
            "title": "River Tubing Runs",
            "feature_type": "attraction",
            "description": "Seasonal tubing experience that gives the Atlanta activity layer a distinct warm-weather family-adventure lane.",
            "price_note": "Seasonal pricing and water conditions vary",
            "url": "https://shootthehooch.com/",
            "sort_order": 10,
        },
        {
            "slug": "shuttle-and-river-launch-access",
            "title": "Shuttle and River Launch Access",
            "feature_type": "amenity",
            "description": "Practical launch-and-return structure that makes the river outing more usable for families and visitors.",
            "price_note": "Availability varies by trip type and season",
            "url": "https://shootthehooch.com/",
            "sort_order": 20,
        },
        {
            "slug": "summer-outdoor-group-outings",
            "title": "Summer Outdoor Group Outings",
            "feature_type": "experience",
            "description": "Strong group and summer-break outing value that helps fill the family portal's warm-weather activity gap.",
            "price_note": "Best treated as a seasonal outing, not a year-round fallback",
            "url": "https://shootthehooch.com/",
            "sort_order": 30,
        },
    ],
    "white-water-atlanta": [
        {
            "slug": "water-slides-and-thrill-rides",
            "title": "Water Slides and Thrill Rides",
            "feature_type": "attraction",
            "description": "Large-format water attractions that give White Water one of the strongest summer destination identities in the metro.",
            "price_note": "Admission and seasonal pass pricing vary",
            "url": "https://www.sixflags.com/whitewater",
            "sort_order": 10,
        },
        {
            "slug": "family-water-play-areas",
            "title": "Family Water Play Areas",
            "feature_type": "attraction",
            "description": "Family-oriented splash and water-play zones that make the park more useful beyond older thrill-seekers.",
            "price_note": "Included with park admission",
            "url": "https://www.sixflags.com/whitewater",
            "sort_order": 20,
        },
        {
            "slug": "summer-day-trip-destination",
            "title": "Summer Day-Trip Destination",
            "feature_type": "experience",
            "description": "High-commitment summer outing value that belongs in Hooky as a seasonal destination rather than an everyday fallback.",
            "price_note": "Best surfaced during warm-weather planning moments",
            "url": "https://www.sixflags.com/whitewater",
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

    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS_WAVE3.items():
        venue_res = (
            client.table("venues").select("id,name,slug").eq("slug", venue_slug).limit(1).execute()
        )
        if not venue_res.data:
            logger.warning("Venue slug '%s' not found; skipping", venue_slug)
            continue

        venue = venue_res.data[0]
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
        description="Seed Atlanta venue_features overlays for the third activity-wave destinations"
    )
    parser.add_argument("--apply", action="store_true", help="Commit writes (default: dry-run)")
    args = parser.parse_args()
    seed_overlays(apply=args.apply)


if __name__ == "__main__":
    main()
