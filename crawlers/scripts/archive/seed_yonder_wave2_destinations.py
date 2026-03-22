#!/usr/bin/env python3
"""
Seed Yonder's second regional destination wave into the venue graph.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave2_destinations.py
    python3 scripts/seed_yonder_wave2_destinations.py --apply
    python3 scripts/seed_yonder_wave2_destinations.py --apply --refresh-existing
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from copy import deepcopy

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

WAVE_2_DESTINATIONS = [
    {
        "name": "DeSoto Falls Recreation Area",
        "slug": "desoto-falls",
        "address": "Desoto Falls Rd",
        "city": "Suches",
        "state": "GA",
        "zip": "30572",
        "lat": 34.7079,
        "lng": -83.9151,
        "website": "https://www.recreation.gov/camping/gateways/2555",
        "venue_type": "trail",
        "spot_type": "trail",
        "short_description": "A classic North Georgia waterfall stop that helps Yonder build a deeper scenic day-trip shelf.",
        "description": "DeSoto Falls gives Yonder another high-signal waterfall destination close enough to reuse often and distinctive enough to support future waterfall clusters and seasonal recommendation logic.",
        "planning_notes": "Best promoted after rain and in cooler-weather windows. Useful as a broad-audience scenic day trip rather than an extreme effort hike.",
        "parking_note": "Recreation-area parking near the falls access area. Expect busier lots during peak foliage weekends.",
        "typical_duration_minutes": 240,
        "explore_category": "outdoors",
        "explore_blurb": "High-signal waterfall stop that deepens the scenic day-trip shelf.",
        "vibes": ["family-friendly"],
    },
    {
        "name": "Helton Creek Falls",
        "slug": "helton-creek-falls",
        "address": "Helton Creek Falls Trailhead, Helton Creek Rd",
        "city": "Blairsville",
        "state": "GA",
        "zip": "30512",
        "lat": 34.7482,
        "lng": -83.9074,
        "website": "https://www.atlantatrails.com/hiking-trails/helton-creek-falls/",
        "venue_type": "trail",
        "spot_type": "trail",
        "short_description": "A lower-friction waterfall destination with fast payoff and wide audience appeal.",
        "description": "Helton Creek Falls broadens Yonder's waterfall inventory with a scenic hit that feels more accessible than some harder North Georgia hikes. It is strategically useful for recommendations that need mountain energy without full-on summit effort.",
        "planning_notes": "Useful for scenic full-day prompts and easier mountain recommendations. Rain boosts payoff, but the destination still works outside peak flow weeks.",
        "parking_note": "Trailhead pull-off parking near Helton Creek Road access.",
        "typical_duration_minutes": 180,
        "explore_category": "outdoors",
        "explore_blurb": "Lower-friction waterfall payoff for a broader audience.",
        "vibes": ["family-friendly"],
    },
    {
        "name": "Rabun Bald",
        "slug": "rabun-bald",
        "address": "Beegum Gap Trailhead, Hale Ridge Rd",
        "city": "Dillard",
        "state": "GA",
        "zip": "30537",
        "lat": 34.9634,
        "lng": -83.2971,
        "website": "https://www.atlantatrails.com/hiking-trails/rabun-bald-bartram-trail/",
        "venue_type": "trail",
        "spot_type": "trail",
        "short_description": "A true summit mission with tower-view payoff for high-intent hikers.",
        "description": "Rabun Bald gives Yonder a harder-hike summit anchor that deepens the portal's mountain ladder beyond the most obvious North Georgia benchmarks. It matters for serving users who want a more committed effort-reward day.",
        "planning_notes": "Best used for clear-weather and cool-weather summit recommendations. Position as a committed hike, not a generic scenic stop.",
        "parking_note": "Common access runs through Beegum Gap and nearby trailheads. Confirm route conditions before heavier promotion.",
        "typical_duration_minutes": 330,
        "explore_category": "outdoors",
        "explore_blurb": "Hard-hike summit mission with serious payoff.",
        "vibes": [],
    },
    {
        "name": "Black Rock Mountain State Park",
        "slug": "black-rock-mountain",
        "address": "3085 Black Rock Mountain Pkwy",
        "city": "Mountain City",
        "state": "GA",
        "zip": "30562",
        "lat": 34.9067,
        "lng": -83.4116,
        "website": "https://gastateparks.org/BlackRockMountain",
        "venue_type": "park",
        "spot_type": "park",
        "short_description": "An overlook-heavy mountain park that expands Yonder's scenic weekend and full-day range.",
        "description": "Black Rock Mountain gives Yonder another camp-capable mountain-park anchor with overlook payoff, foliage strength, and wider scenic appeal than a hike-only destination. It keeps the weekend layer from feeling too narrow.",
        "planning_notes": "Best on clear days and during foliage windows. Useful for scenic weekend prompts and lower-barrier mountain recommendations.",
        "parking_note": "State park overlook and trail parking available. Georgia state park parking pass required.",
        "typical_duration_minutes": 300,
        "explore_category": "outdoors",
        "explore_blurb": "Overlook-heavy mountain park with strong scenic weekend range.",
        "vibes": ["family-friendly"],
    },
    {
        "name": "Cohutta Overlook",
        "slug": "cohutta-overlook",
        "address": "GA-52",
        "city": "Chatsworth",
        "state": "GA",
        "zip": "30705",
        "lat": 34.7852,
        "lng": -84.6269,
        "website": "https://www.exploregeorgia.org/chatsworth/outdoors-nature/scenic-drives-trails-tours/cohutta-overlook",
        "venue_type": "viewpoint",
        "spot_type": "trail",
        "short_description": "A high-payoff overlook that starts to make Yonder's wilderness-edge weekend layer feel broader.",
        "description": "Cohutta Overlook gives Yonder a scenic-drive and viewpoint anchor tied to larger wilderness identity. It is especially useful because it expands weekend and overlook recommendations without depending on a hard hike every time.",
        "planning_notes": "Best promoted on clear days, during foliage windows, and when users want scenic payoff more than mileage.",
        "parking_note": "Roadside overlook access off GA-52; conditions and visibility matter to the experience.",
        "typical_duration_minutes": 180,
        "explore_category": "outdoors",
        "explore_blurb": "Wilderness-edge overlook with scenic-drive appeal.",
        "vibes": ["family-friendly"],
    },
]


def fetch_website_metadata(url: str) -> dict[str, str]:
    try:
        response = requests.get(url, headers=HEADERS, timeout=20)
        response.raise_for_status()
    except Exception as exc:
        logger.debug("Metadata fetch failed for %s: %s", url, exc)
        return {}

    soup = BeautifulSoup(response.text, "html.parser")

    def _meta(*pairs: tuple[str, str]) -> str:
        for attr, value in pairs:
            tag = soup.find("meta", attrs={attr: value})
            if tag and tag.get("content"):
                return " ".join(tag.get("content", "").split())
        return ""

    image_url = _meta(("property", "og:image"), ("name", "twitter:image"))
    description = _meta(
        ("property", "og:description"),
        ("name", "description"),
        ("name", "twitter:description"),
    )
    return {
        "image_url": image_url,
        "description": description,
    }


def build_payload(seed: dict) -> dict:
    payload = deepcopy(seed)
    meta = fetch_website_metadata(seed["website"])

    image_url = meta.get("image_url")
    if image_url and not payload.get("image_url"):
        payload["image_url"] = image_url
    if image_url and not payload.get("hero_image_url"):
        payload["hero_image_url"] = image_url

    if not payload.get("description") and meta.get("description"):
        payload["description"] = meta["description"]

    payload.setdefault("active", True)
    return payload


def find_existing_venue(seed: dict) -> dict | None:
    existing = get_venue_by_slug(seed["slug"])
    if existing:
        return existing

    client = get_client()
    result = (
        client.table("venues")
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
            "image_url",
            "hero_image_url",
            "website",
            "typical_duration_minutes",
        } and current != value:
            updates[key] = value
    return updates


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Yonder Wave 2 regional destinations.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 2 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 2 Regional Destination Seed")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", "yes" if args.refresh_existing else "no")
    logger.info("")

    for seed in WAVE_2_DESTINATIONS:
        payload = build_payload(seed)
        existing = find_existing_venue(seed)

        if existing:
            if not args.refresh_existing:
                logger.info("SKIP existing: %s", seed["name"])
                skipped += 1
                continue

            updates = compute_updates(existing, payload)
            if not updates:
                logger.info("KEEP existing: %s (no changes)", seed["name"])
                skipped += 1
                continue

            if args.apply:
                client.table("venues").update(updates).eq("id", existing["id"]).execute()
            logger.info(
                "%s existing: %s (%s fields)",
                "UPDATE" if args.apply else "WOULD UPDATE",
                seed["name"],
                len(updates),
            )
            updated += 1
            continue

        if args.apply:
            get_or_create_venue(payload)
        logger.info("%s new: %s", "ADD" if args.apply else "WOULD ADD", seed["name"])
        created += 1

    logger.info("")
    logger.info("Summary: created=%s updated=%s skipped=%s", created, updated, skipped)


if __name__ == "__main__":
    main()
