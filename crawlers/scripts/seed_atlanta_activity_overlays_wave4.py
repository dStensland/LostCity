#!/usr/bin/env python3
"""
Seed Atlanta-owned venue rows and venue_features overlays for the fourth activity wave.

Usage:
    python3 scripts/seed_atlanta_activity_overlays_wave4.py
    python3 scripts/seed_atlanta_activity_overlays_wave4.py --apply
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
    "ready-set-fun": {
        "name": "Ready Set Fun",
        "slug": "ready-set-fun",
        "address": "6331 Roswell Rd",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "place_type": "games",
        "spot_type": "entertainment",
        "website": "https://readysetfun.com/",
    },
    "yellow-river-wildlife-sanctuary": {
        "name": "Yellow River Wildlife Sanctuary",
        "slug": "yellow-river-wildlife-sanctuary",
        "address": "4525 US Highway 78",
        "city": "Lilburn",
        "state": "GA",
        "zip": "30047",
        "place_type": "attraction",
        "spot_type": "zoo",
        "website": "https://yellowriverwildlifesanctuary.com/",
    },
    "treetop-quest-dunwoody": {
        "name": "Treetop Quest Dunwoody",
        "slug": "treetop-quest-dunwoody",
        "address": "2341 Peeler Road",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "place_type": "park",
        "spot_type": "park",
        "website": "https://www.treetopquest.com/dunwoody/",
    },
    "treetop-quest-gwinnett": {
        "name": "Treetop Quest Gwinnett",
        "slug": "treetop-quest-gwinnett",
        "address": "2020 Clean Water Drive",
        "city": "Buford",
        "state": "GA",
        "zip": "30519",
        "place_type": "park",
        "spot_type": "park",
        "website": "https://www.treetopquest.com/gwinnett/",
    },
}


ATLANTA_ACTIVITY_OVERLAYS_WAVE4: dict[str, list[dict[str, Any]]] = {
    "ready-set-fun": [
        {
            "slug": "indoor-playground-zones",
            "title": "Indoor Playground Zones",
            "feature_type": "attraction",
            "description": "Core indoor play areas that make Ready Set Fun one of the strongest younger-kid rainy-day options in the metro.",
            "price_note": "Play pricing and package access vary",
            "url": "https://readysetfun.com/",
            "sort_order": 10,
        },
        {
            "slug": "imagination-and-art-play",
            "title": "Imagination and Art Play",
            "feature_type": "experience",
            "description": "Creative play spaces like sandbox, art, and pretend-play areas that broaden the outing beyond pure energy burn.",
            "price_note": "Included with eligible play admissions or programs",
            "url": "https://readysetfun.com/",
            "sort_order": 20,
        },
        {
            "slug": "camp-and-parents-night-out",
            "title": "Camp and Parents Night Out",
            "feature_type": "experience",
            "description": "Programmed add-ons like camps and parent-night-out windows that make the venue especially relevant to Hooky planning moments.",
            "price_note": "Program schedules and pricing vary",
            "url": "https://readysetfun.com/",
            "sort_order": 30,
        },
    ],
    "yellow-river-wildlife-sanctuary": [
        {
            "slug": "animal-walkthrough-and-petting-zoo",
            "title": "Animal Walkthrough and Petting Zoo",
            "feature_type": "attraction",
            "description": "Animal encounter and petting-zoo value that gives Yellow River a distinctive family-destination role in the metro.",
            "price_note": "General admission required",
            "url": "https://yellowriverwildlifesanctuary.com/",
            "sort_order": 10,
        },
        {
            "slug": "guided-tours-and-encounters",
            "title": "Guided Tours and Encounters",
            "feature_type": "experience",
            "description": "Guided tours and animal encounter formats that make the sanctuary stronger than a simple walk-through attraction.",
            "price_note": "Specific tours or encounters may vary in availability",
            "url": "https://yellowriverwildlifesanctuary.com/",
            "sort_order": 20,
        },
        {
            "slug": "field-trip-and-learning-value",
            "title": "Field-Trip and Learning Value",
            "feature_type": "experience",
            "description": "Educational animal and habitat value that supports school-break, visitor, and mixed-age family planning.",
            "price_note": "Educational offerings may vary by season and group format",
            "url": "https://yellowriverwildlifesanctuary.com/",
            "sort_order": 30,
        },
    ],
    "treetop-quest-dunwoody": [
        {
            "slug": "zipline-and-obstacle-courses",
            "title": "Zipline and Obstacle Courses",
            "feature_type": "attraction",
            "description": "Core ropes-course and zipline experience that gives Treetop Quest real outdoor family-adventure value.",
            "price_note": "Ticket pricing is based on age and course eligibility",
            "url": "https://www.treetopquest.com/dunwoody/",
            "sort_order": 10,
        },
        {
            "slug": "age-banded-climbing-levels",
            "title": "Age-Banded Climbing Levels",
            "feature_type": "experience",
            "description": "Structured age-banded course system, including young-kid and older-kid tracks, that makes family fit more legible than many adventure parks.",
            "price_note": "Course access depends on age and safety rules",
            "url": "https://www.treetopquest.com/dunwoody/",
            "sort_order": 20,
        },
        {
            "slug": "birthday-and-group-adventure-outings",
            "title": "Birthday and Group Adventure Outings",
            "feature_type": "experience",
            "description": "Birthday and group-friendly adventure positioning that makes the park useful for Hooky beyond casual weekend discovery.",
            "price_note": "Group offerings and seasonality vary",
            "url": "https://www.treetopquest.com/dunwoody/",
            "sort_order": 30,
        },
    ],
    "treetop-quest-gwinnett": [
        {
            "slug": "zipline-and-obstacle-courses",
            "title": "Zipline and Obstacle Courses",
            "feature_type": "attraction",
            "description": "Core ropes-course and zipline experience that gives Treetop Quest real outdoor family-adventure value.",
            "price_note": "Ticket pricing is based on age and course eligibility",
            "url": "https://www.treetopquest.com/gwinnett/",
            "sort_order": 10,
        },
        {
            "slug": "spider-quest-and-younger-kid-play",
            "title": "Spider Quest and Younger-Kid Play",
            "feature_type": "experience",
            "description": "Distinct younger-kid and harness-free play elements that improve the family range compared with one-note thrill parks.",
            "price_note": "Height and age rules apply",
            "url": "https://www.treetopquest.com/gwinnett/",
            "sort_order": 20,
        },
        {
            "slug": "birthday-and-group-adventure-outings",
            "title": "Birthday and Group Adventure Outings",
            "feature_type": "experience",
            "description": "Birthday and group-friendly adventure positioning that makes the park useful for Hooky beyond casual weekend discovery.",
            "price_note": "Group offerings and seasonality vary",
            "url": "https://www.treetopquest.com/gwinnett/",
            "sort_order": 30,
        },
    ],
}


def _get_or_create_target_venue(venue_slug: str, apply: bool) -> dict[str, Any] | None:
    client = get_client()
    venue_res = (
        client.table("places").select("id,name,slug").eq("slug", venue_slug).limit(1).execute()
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
            client.table("places").select("id,name,slug").eq("slug", venue_slug).limit(1).execute()
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

    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS_WAVE4.items():
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
        description="Seed Atlanta venue_features overlays for the fourth activity-wave destinations"
    )
    parser.add_argument("--apply", action="store_true", help="Commit writes (default: dry-run)")
    args = parser.parse_args()
    seed_overlays(apply=args.apply)


if __name__ == "__main__":
    main()
