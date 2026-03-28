#!/usr/bin/env python3
"""
Seed Yonder's fifth destination wave into the venue graph.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave5_destinations.py
    python3 scripts/seed_yonder_wave5_destinations.py --apply
    python3 scripts/seed_yonder_wave5_destinations.py --apply --refresh-existing
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from copy import deepcopy

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, get_or_create_place, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

WAVE_5_DESTINATIONS = [
    {
        "name": "Red Top Mountain State Park",
        "slug": "red-top-mountain-state-park",
        "address": "50 Lodge Rd SE",
        "city": "Cartersville",
        "state": "GA",
        "zip": "30121",
        "lat": 34.1422,
        "lng": -84.7072,
        "website": "https://gastateparks.org/RedTopMountain",
        "place_type": "park",
        "spot_type": "park",
        "short_description": "A close-in lake-and-camp weekend anchor that gives Yonder a realistic first overnight answer without the North Georgia drive.",
        "description": "Red Top Mountain State Park gives Yonder a highly reachable weekend base with lake access, cabin-and-campsite energy, and broad audience appeal. It is strategically useful because it makes the weekend shelf feel more repeatable and less dependent on mountain-only destinations.",
        "planning_notes": "Best used for reachable weekend escapes, lower-friction overnighters, and lake-adjacent outdoor plans. Strong fallback when users want a real getaway without committing to a long mountain drive.",
        "parking_note": "Use state park day-use, trail, or lodge-area lots. Georgia state park parking pass required.",
        "typical_duration_minutes": 300,
        "explore_category": "outdoors",
        "explore_blurb": "Reachable lake weekend with real overnight potential.",
        "vibes": ["family-friendly"],
    },
    {
        "name": "Hard Labor Creek State Park",
        "slug": "hard-labor-creek-state-park",
        "address": "5 Hard Labor Creek Rd",
        "city": "Rutledge",
        "state": "GA",
        "zip": "30663",
        "lat": 33.6264,
        "lng": -83.5847,
        "website": "https://gastateparks.org/HardLaborCreek",
        "place_type": "park",
        "spot_type": "park",
        "short_description": "A quieter east-metro camping base that helps Yonder build a weekend layer beyond the same handful of mountain parks.",
        "description": "Hard Labor Creek State Park gives Yonder a calmer weekend basecamp option with cabins, campsites, and enough outdoor range to support a real overnight prompt. It matters because it broadens the weekend shelf without requiring dramatic-scenery-only framing every time.",
        "planning_notes": "Best for lower-key weekend escapes, first overnighters, and users who want camp-capable options without the heaviest drive burden. Useful when the weekend shelf needs variety instead of another overlook card.",
        "parking_note": "Use state park recreation-area parking. Georgia state park parking pass required.",
        "typical_duration_minutes": 300,
        "explore_category": "outdoors",
        "explore_blurb": "Quieter camp-capable weekend base east of Atlanta.",
        "vibes": ["family-friendly"],
    },
    {
        "name": "Fort Yargo State Park",
        "slug": "fort-yargo-state-park",
        "address": "210 S Broad St",
        "city": "Winder",
        "state": "GA",
        "zip": "30680",
        "lat": 33.9869,
        "lng": -83.7349,
        "website": "https://gastateparks.org/FortYargo",
        "place_type": "park",
        "spot_type": "park",
        "short_description": "A lake-centered state park that adds another realistic weekend base for cabins, campsites, and broad-audience outdoor plans.",
        "description": "Fort Yargo State Park helps Yonder build a more repeatable overnight layer by adding a reachable lake park with family-friendly range, cabin adjacency, and easier logistics than the farthest regional anchors. It keeps the weekend shelf from feeling like the same mountain template in rotation.",
        "planning_notes": "Best used for approachable weekend escapes, beginner-friendly camp-capable prompts, and broad family or crew planning. Good counterweight when mountain-heavy recommendations feel too repetitive.",
        "parking_note": "Use state park day-use and trail-area parking. Georgia state park parking pass required.",
        "typical_duration_minutes": 300,
        "explore_category": "outdoors",
        "explore_blurb": "Reachable lake-park weekend base with broad appeal.",
        "vibes": ["family-friendly"],
    },
    {
        "name": "Don Carter State Park",
        "slug": "don-carter-state-park",
        "address": "5000 N Browning Bridge Rd",
        "city": "Gainesville",
        "state": "GA",
        "zip": "30506",
        "lat": 34.3662,
        "lng": -83.8807,
        "website": "https://gastateparks.org/DonCarter",
        "place_type": "park",
        "spot_type": "park",
        "short_description": "A Lake Lanier state park that gives Yonder a cleaner weekend answer for paddling, cabins, and warm-weather overnighters.",
        "description": "Don Carter State Park adds a water-forward weekend base with campsites, cabin adjacency, and lake access that feels meaningfully different from Yonder's mountain park pattern. It is important because it strengthens both the water lane and the overnight layer at the same time.",
        "planning_notes": "Best used for warm-weather weekend prompts, paddling-adjacent trips, and users who want cabin-or-camp potential with strong lake context. Especially useful when Yonder needs an overnight water answer rather than another river access point.",
        "parking_note": "Use state park lake and day-use parking. Georgia state park parking pass required.",
        "typical_duration_minutes": 300,
        "explore_category": "outdoors",
        "explore_blurb": "Lake-forward weekend base that strengthens the overnight water lane.",
        "vibes": ["family-friendly"],
    },
    {
        "name": "Unicoi State Park & Lodge",
        "slug": "unicoi-state-park",
        "address": "1788 GA-356",
        "city": "Helen",
        "state": "GA",
        "zip": "30545",
        "lat": 34.7165,
        "lng": -83.7274,
        "website": "https://www.unicoilodge.com/",
        "place_type": "park",
        "spot_type": "park",
        "short_description": "A Helen-adjacent lodge and lake base that gives Yonder a stronger cabin-capable weekend option in North Georgia.",
        "description": "Unicoi State Park & Lodge gives Yonder a more accommodation-friendly North Georgia weekend anchor with lake access, lodge logic, and easy linkage to Helen and nearby mountain activity. It makes the weekend shelf feel more varied than pure hike-or-camp destinations alone.",
        "planning_notes": "Best for cabin-capable and lodge-capable weekend prompts, warm-weather lake plans, and users who want a softer landing than campsite-only recommendations. Useful bridge between scenic North Georgia and easier booking-oriented escapes.",
        "parking_note": "Use lodge and recreation-area parking. Check current lake and lodging access details before heavy promotion.",
        "typical_duration_minutes": 300,
        "explore_category": "outdoors",
        "explore_blurb": "North Georgia lodge-and-lake weekend with softer logistics.",
        "vibes": ["family-friendly"],
    },
]


def build_payload(seed: dict) -> dict:
    payload = deepcopy(seed)
    payload.setdefault("active", True)
    return payload


def find_existing_venue(seed: dict) -> dict | None:
    existing = get_venue_by_slug(seed["slug"])
    if existing:
        return existing

    client = get_client()
    result = (
        client.table("places")
        .select("*")
        .eq("name", seed["name"])
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


def compute_updates(existing: dict, payload: dict) -> dict:
    updates: dict = {}
    for key, value in payload.items():
        if value in (None, "", []):
            continue
        current = existing.get(key)
        if current in (None, "", []):
            updates[key] = value
            continue
        if key in {
            "slug",
            "address",
            "city",
            "state",
            "zip",
            "lat",
            "lng",
            "venue_type",
            "spot_type",
            "short_description",
            "description",
            "planning_notes",
            "parking_note",
            "explore_blurb",
            "explore_category",
            "website",
            "typical_duration_minutes",
        } and current != value:
            updates[key] = value
    return updates


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Yonder Wave 5 destinations.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 5 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 5 Destination Seed")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for seed in WAVE_5_DESTINATIONS:
        payload = build_payload(seed)
        existing = find_existing_venue(seed)

        if not existing:
            if args.apply:
                get_or_create_place(payload)
            logger.info("%s venue: %s", "CREATE" if args.apply else "WOULD CREATE", seed["slug"])
            created += 1
            continue

        if not args.refresh_existing:
            logger.info("KEEP venue: %s (already exists)", seed["slug"])
            skipped += 1
            continue

        updates = compute_updates(existing, payload)
        if not updates:
            logger.info("KEEP venue: %s (no changes)", seed["slug"])
            skipped += 1
            continue

        if args.apply:
            client.table("places").update(updates).eq("id", existing["id"]).execute()
        logger.info(
            "%s venue: %s (%s fields)",
            "UPDATE" if args.apply else "WOULD UPDATE",
            seed["slug"],
            len(updates),
        )
        updated += 1

    logger.info("")
    logger.info("Summary: created=%s updated=%s skipped=%s", created, updated, skipped)


if __name__ == "__main__":
    main()
