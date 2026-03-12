#!/usr/bin/env python3
"""
Seed Atlanta-owned venue_features overlays for the second activity wave.

Usage:
    python3 scripts/seed_atlanta_activity_overlays_wave2.py
    python3 scripts/seed_atlanta_activity_overlays_wave2.py --apply
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
    "stone-summit": {
        "name": "Central Rock Gym Atlanta",
        "slug": "stone-summit",
        "address": "3701 Presidential Pkwy",
        "neighborhood": "South Atlanta",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30340",
        "lat": 33.8898,
        "lng": -84.2571,
        "venue_type": "gym",
        "spot_type": "climbing_gym",
        "website": "https://centralrockgym.com/kennesaw/",
    }
}


ATLANTA_ACTIVITY_OVERLAYS_WAVE2: dict[str, list[dict[str, Any]]] = {
    "world-of-coca-cola": [
        {
            "slug": "vault-of-the-secret-formula",
            "title": "Vault of the Secret Formula",
            "feature_type": "attraction",
            "description": "Signature branded attraction that makes World of Coca-Cola feel like a destination outing, not just a quick museum pass-through.",
            "price_note": "Included with general admission",
            "url": "https://www.worldofcoca-cola.com/",
            "sort_order": 10,
        },
        {
            "slug": "taste-it-global-sampling",
            "title": "Taste It! Global Sampling",
            "feature_type": "experience",
            "description": "Interactive tasting zone that gives the venue much of its repeat-visit and group-friendly appeal.",
            "price_note": "Included with general admission",
            "url": "https://www.worldofcoca-cola.com/",
            "sort_order": 20,
        },
        {
            "slug": "bottling-line-experience",
            "title": "Bottling Line Experience",
            "feature_type": "experience",
            "description": "Factory-style viewing and beverage-storytelling layer that helps the attraction work for mixed-age visitors.",
            "price_note": "Included with general admission",
            "url": "https://www.worldofcoca-cola.com/",
            "sort_order": 30,
        },
    ],
    "delta-flight-museum": [
        {
            "slug": "historic-aircraft-collection",
            "title": "Historic Aircraft Collection",
            "feature_type": "collection",
            "description": "Plane-focused museum experience that gives Delta Flight Museum its strongest all-ages aviation appeal.",
            "price_note": "Included with museum admission",
            "url": "https://www.deltamuseum.org/",
            "sort_order": 10,
        },
        {
            "slug": "aviation-exhibit-halls",
            "title": "Aviation Exhibit Halls",
            "feature_type": "collection",
            "description": "Core aviation history exhibits that make the museum useful for school-break and niche family outings.",
            "price_note": "Included with museum admission",
            "url": "https://www.deltamuseum.org/",
            "sort_order": 20,
        },
        {
            "slug": "cockpit-and-simulator-experiences",
            "title": "Cockpit and Simulator Experiences",
            "feature_type": "experience",
            "description": "Interactive aviation moments that help the museum feel more active for kids and tweens than a static history stop.",
            "price_note": "Some simulator offerings may require a separate reservation or add-on",
            "url": "https://www.deltamuseum.org/",
            "sort_order": 30,
        },
    ],
    "college-football-hall-of-fame": [
        {
            "slug": "indoor-playing-field",
            "title": "Indoor Playing Field",
            "feature_type": "experience",
            "description": "Hands-on field space that gives the Hall of Fame stronger family outing value than a display-only museum.",
            "price_note": "Included with admission as offered",
            "url": "https://www.cfbhall.com/",
            "sort_order": 10,
        },
        {
            "slug": "interactive-football-exhibits",
            "title": "Interactive Football Exhibits",
            "feature_type": "experience",
            "description": "Skill-based and media-rich football exhibits that are more likely to hold older kids and sports-focused families.",
            "price_note": "Included with admission",
            "url": "https://www.cfbhall.com/",
            "sort_order": 20,
        },
        {
            "slug": "team-tradition-gallery",
            "title": "Team Tradition Gallery",
            "feature_type": "collection",
            "description": "School and team-history displays that give the venue broader fan-destination appeal beyond the activity floor.",
            "price_note": "Included with admission",
            "url": "https://www.cfbhall.com/",
            "sort_order": 30,
        },
    ],
    "illuminarium-atlanta": [
        {
            "slug": "immersive-projection-environments",
            "title": "Immersive Projection Environments",
            "feature_type": "experience",
            "description": "Large-format light, sound, and projection spaces that define Illuminarium as a destination experience rather than a standard museum visit.",
            "price_note": "Ticketing varies by experience",
            "url": "https://www.illuminarium.com/atlanta",
            "sort_order": 10,
        },
        {
            "slug": "walk-through-show-experiences",
            "title": "Walk-Through Show Experiences",
            "feature_type": "experience",
            "description": "Room-scale immersive experiences that work best as a special outing rather than an everyday fallback destination.",
            "price_note": "Ticketing varies by experience",
            "url": "https://www.illuminarium.com/atlanta",
            "sort_order": 20,
        },
        {
            "slug": "select-family-friendly-showtimes",
            "title": "Select Family-Friendly Showtimes",
            "feature_type": "experience",
            "description": "Daytime and family-appropriate show windows that may make the venue relevant to Hooky only when age-fit rules are explicit.",
            "price_note": "Check current public schedule before recommending to families",
            "url": "https://www.illuminarium.com/atlanta",
            "sort_order": 30,
        },
    ],
    "stone-summit": [
        {
            "slug": "bouldering-and-climbing-walls",
            "title": "Bouldering and Climbing Walls",
            "feature_type": "attraction",
            "description": "Core climbing surfaces that make Central Rock Gym Atlanta a real indoor adventure destination for active families and tweens.",
            "price_note": "Admission and gear policies vary",
            "url": "https://centralrockgym.com/kennesaw/",
            "sort_order": 10,
        },
        {
            "slug": "youth-climbing-programs",
            "title": "Youth Climbing Programs",
            "feature_type": "experience",
            "description": "Structured youth-oriented climbing options that make the venue useful for family planning beyond adult gym visits.",
            "price_note": "Program access and pricing vary",
            "url": "https://centralrockgym.com/kennesaw/",
            "sort_order": 20,
        },
        {
            "slug": "fitness-and-training-areas",
            "title": "Fitness and Training Areas",
            "feature_type": "amenity",
            "description": "Supporting training zones that broaden the venue from a one-note climb stop into a fuller indoor movement destination.",
            "price_note": "Access depends on admission and membership rules",
            "url": "https://centralrockgym.com/kennesaw/",
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

    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS_WAVE2.items():
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
        description="Seed Atlanta venue_features overlays for the second activity-wave destinations"
    )
    parser.add_argument("--apply", action="store_true", help="Commit writes (default: dry-run)")
    args = parser.parse_args()
    seed_overlays(apply=args.apply)


if __name__ == "__main__":
    main()
