#!/usr/bin/env python3
"""
Seed Yonder's first regional destination wave into the venue graph.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave1_destinations.py
    python3 scripts/seed_yonder_wave1_destinations.py --apply
    python3 scripts/seed_yonder_wave1_destinations.py --apply --refresh-existing
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

from db import get_client, get_or_create_place, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

WAVE_1_DESTINATIONS = [
    {
        "name": "Amicalola Falls State Park",
        "slug": "amicalola-falls",
        "address": "418 Amicalola Falls State Park Rd",
        "city": "Dawsonville",
        "state": "GA",
        "zip": "30534",
        "lat": 34.566883,
        "lng": -84.239113,
        "website": "https://gastateparks.org/AmicalolaFalls",
        "venue_type": "park",
        "spot_type": "park",
        "short_description": "North Georgia's signature waterfall park with a high-payoff staircase climb and Appalachian Trail energy.",
        "description": "Amicalola Falls is one of Georgia's most iconic outdoor anchors, pairing a dramatic waterfall, steep approach stairs, and fast access to broader North Georgia hiking. It is one of the clearest full-day gateway destinations for Yonder's regional adventure layer.",
        "planning_notes": "Best as a full-day outing. Expect crowds on peak fall weekends and arrive early for easier parking.",
        "parking_note": "State park parking lot near the visitor area. Georgia state park parking pass required.",
        "typical_duration_minutes": 240,
        "explore_category": "outdoors",
        "explore_blurb": "Iconic waterfall day trip with Appalachian Trail energy.",
        "vibes": ["family-friendly"],
    },
    {
        "name": "Tallulah Gorge State Park",
        "slug": "tallulah-gorge",
        "address": "338 Jane Hurt Yarn Rd",
        "city": "Tallulah Falls",
        "state": "GA",
        "zip": "30573",
        "lat": 34.733104,
        "lng": -83.389225,
        "website": "https://gastateparks.org/TallulahGorge",
        "venue_type": "park",
        "spot_type": "park",
        "short_description": "A dramatic canyon destination with suspension bridge views, steep stairs, and one of the strongest 'worth the trip' hikes in the state.",
        "description": "Tallulah Gorge gives Yonder a premium North Georgia canyon anchor with dramatic overlooks, high-reward hiking, and an unmistakable sense of scale. It is one of the clearest destinations for turning full-day motivation into real action.",
        "planning_notes": "Best as a full-day outing. Gorge-floor access is permit-controlled, so confirm current rules before promoting deep-hike itineraries.",
        "parking_note": "Main state park lots near the interpretive center. Georgia state park parking pass required.",
        "typical_duration_minutes": 300,
        "explore_category": "outdoors",
        "explore_blurb": "Premium gorge day trip with real payoff and visual drama.",
        "vibes": ["family-friendly"],
    },
    {
        "name": "Cloudland Canyon State Park",
        "slug": "cloudland-canyon",
        "address": "122 Cloudland Canyon Park Rd",
        "city": "Rising Fawn",
        "state": "GA",
        "zip": "30738",
        "lat": 34.816813,
        "lng": -85.489446,
        "website": "https://gastateparks.org/CloudlandCanyon",
        "venue_type": "park",
        "spot_type": "park",
        "short_description": "A canyon-and-waterfall anchor that makes Yonder's weekend layer feel real even before camping depth ships.",
        "description": "Cloudland Canyon is one of Georgia's highest-upside regional anchors, combining canyon overlooks, waterfall access, and strong overnight potential. It is a foundational destination for Yonder's full-day and weekend positioning.",
        "planning_notes": "Works for a long day trip or a weekend base. Stair-heavy routes make this better for users who expect a more committed effort.",
        "parking_note": "Use the state park trail and overlook lots. Georgia state park parking pass required.",
        "typical_duration_minutes": 360,
        "explore_category": "outdoors",
        "explore_blurb": "Canyon, waterfalls, and real weekend credibility.",
        "vibes": ["family-friendly"],
    },
    {
        "name": "Blood Mountain",
        "slug": "blood-mountain",
        "address": "Neel Gap, US-19/129",
        "city": "Blairsville",
        "state": "GA",
        "lat": 34.74198,
        "lng": -83.922727,
        "website": "https://appalachiantrail.org/explore/plan-and-prepare/hiking-basics/suggested-hikes/neels-gap-to-blood-mountain/",
        "venue_type": "trail",
        "spot_type": "trail",
        "short_description": "An Appalachian icon with summit payoff that gives Yonder a real North Georgia mountain benchmark.",
        "description": "Blood Mountain is one of the clearest full-day summit anchors in North Georgia, with strong Appalachian identity and broad recognition. It gives Yonder a hike that feels meaningfully bigger than metro nature inventory.",
        "planning_notes": "Promote as a committed full-day mountain hike. Weather and crowd conditions matter more here than for metro destinations.",
        "parking_note": "Common access begins around Neel Gap and nearby trailheads. Parking can fill on peak weekends.",
        "typical_duration_minutes": 300,
        "explore_category": "outdoors",
        "explore_blurb": "Appalachian summit anchor with real mountain payoff.",
        "vibes": [],
    },
    {
        "name": "Springer Mountain",
        "slug": "springer-mountain",
        "address": "Springer Mountain Trailhead, Forest Service Road 42",
        "city": "Blue Ridge",
        "state": "GA",
        "lat": 34.637512,
        "lng": -84.195343,
        "website": "https://appalachiantrail.org/explore/plan-and-prepare/hiking-basics/suggested-hikes/springer-mountain-loop/",
        "venue_type": "trail",
        "spot_type": "trail",
        "short_description": "The southern Appalachian Trail anchor that turns Yonder's quest and weekend ambition into something concrete.",
        "description": "Springer Mountain matters less for pure spectacle than for what it represents: the southern anchor of the Appalachian Trail and a true weekend-scale North Georgia adventure symbol. It is critical future quest infrastructure for Yonder.",
        "planning_notes": "Better positioned as a committed full-day or weekend adventure. Road conditions and trail access notes should be checked before heavy promotion.",
        "parking_note": "Trail access is typically oriented around Forest Service Road 42 and nearby AT trailheads.",
        "typical_duration_minutes": 360,
        "explore_category": "outdoors",
        "explore_blurb": "Appalachian Trail origin point with strong quest value.",
        "vibes": [],
    },
    {
        "name": "Brasstown Bald",
        "slug": "brasstown-bald",
        "address": "2941 GA-180 Spur",
        "city": "Hiawassee",
        "state": "GA",
        "zip": "30546",
        "lat": 34.874796,
        "lng": -83.810859,
        "website": "https://brasstownbald.com/",
        "venue_type": "viewpoint",
        "spot_type": "trail",
        "short_description": "Georgia's highest point with broad scenic payoff and one of the easiest ways to sell a regional day trip.",
        "description": "Brasstown Bald gives Yonder a top-tier summit anchor with a broad audience, strong scenic identity, and a much lower intimidation barrier than some North Georgia hikes. It is ideal for full-day discovery modules and beginner-friendly scenic recommendations.",
        "planning_notes": "Strong full-day scenic anchor, especially for foliage and clear-weather weekends. Elevation and weather visibility matter to the experience.",
        "parking_note": "Visitor-area parking available; check shuttle or access rules seasonally.",
        "typical_duration_minutes": 180,
        "explore_category": "outdoors",
        "explore_blurb": "Georgia's highest point with wide-view scenic payoff.",
        "vibes": ["family-friendly"],
    },
    {
        "name": "Raven Cliff Falls",
        "slug": "raven-cliff-falls",
        "address": "Raven Cliff Falls Trailhead, Richard B Russell Scenic Hwy",
        "city": "Helen",
        "state": "GA",
        "lat": 34.7398,
        "lng": -83.8106,
        "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10530",
        "venue_type": "trail",
        "spot_type": "trail",
        "short_description": "A classic North Georgia waterfall hike that belongs in any serious full-day Yonder shelf.",
        "description": "Raven Cliff Falls is one of the most recognizable waterfall hikes in North Georgia and gives Yonder a clean, high-signal destination for full-day outdoor recommendations. It is especially valuable because it bridges scenic payoff and broad user appeal.",
        "planning_notes": "Best positioned as a full-day waterfall hike. Rain and trail conditions can materially change the experience.",
        "parking_note": "Trailhead parking along Richard B Russell Scenic Highway. Go early on peak weekends.",
        "typical_duration_minutes": 300,
        "explore_category": "outdoors",
        "explore_blurb": "Classic North Georgia waterfall hike with broad appeal.",
        "vibes": [],
    },
    {
        "name": "Vogel State Park",
        "slug": "vogel-state-park",
        "address": "405 Vogel State Park Rd",
        "city": "Blairsville",
        "state": "GA",
        "zip": "30512",
        "lat": 34.76395,
        "lng": -83.900948,
        "website": "https://gastateparks.org/Vogel",
        "venue_type": "park",
        "spot_type": "park",
        "short_description": "A mountain lake and camping anchor that helps Yonder bridge from day trips into weekend escapes.",
        "description": "Vogel State Park gives Yonder a mountain-lake anchor with strong camping adjacency and lower-barrier scenic value. It is strategically useful because it makes the weekend layer feel more attainable before Camp Finder becomes a full product.",
        "planning_notes": "Works as a scenic day trip or weekend base. Peak-season demand is real, so lean on this more as a destination anchor than as a guarantee of easy lodging.",
        "parking_note": "State park lots and recreation-area parking available. Georgia state park parking pass required.",
        "typical_duration_minutes": 300,
        "explore_category": "outdoors",
        "explore_blurb": "Mountain lake anchor that starts to make weekends feel reachable.",
        "vibes": ["family-friendly"],
    },
    {
        "name": "Fort Mountain State Park",
        "slug": "fort-mountain-state-park",
        "address": "181 Fort Mountain Park Rd",
        "city": "Chatsworth",
        "state": "GA",
        "zip": "30705",
        "lat": 34.762284,
        "lng": -84.701934,
        "website": "https://gastateparks.org/FortMountain",
        "venue_type": "park",
        "spot_type": "park",
        "short_description": "A mountain-park anchor with scenic overlooks, long-loop hiking, and real weekend credibility.",
        "description": "Fort Mountain State Park gives Yonder a strong mountain-park destination that can support both big day hikes and weekend cabin-or-camping ambition. It helps the portal feel geographically broader without losing product focus.",
        "planning_notes": "Useful as either a big day-trip prompt or a weekend base. Seasonal visibility and foliage timing materially shape the payoff.",
        "parking_note": "State park trail and overlook lots available. Georgia state park parking pass required.",
        "typical_duration_minutes": 300,
        "explore_category": "outdoors",
        "explore_blurb": "Mountain-park anchor with scenic range and weekend upside.",
        "vibes": ["family-friendly"],
    },
    {
        "name": "Boat Rock",
        "slug": "boat-rock",
        "address": "1221 Boat Rock Rd SW",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30331",
        "lat": 33.7218781,
        "lng": -84.56408,
        "website": "https://www.seclimbers.org/projects/boat-rock",
        "venue_type": "outdoor_venue",
        "spot_type": "trail",
        "short_description": "Atlanta's defining outdoor climbing and bouldering anchor, with real community identity and local distinctiveness.",
        "description": "Boat Rock is one of the most distinctive outdoor recreation anchors in the Atlanta area, especially for climbing and bouldering culture. It matters to Yonder because it gives the portal a non-generic local adventure identity that cannot be replaced by city-park inventory.",
        "planning_notes": "Best used for dry-weather climbing and bouldering recommendations. Promote carefully and lean on stewardship framing where appropriate.",
        "parking_note": "Use the preserve access area and follow current access rules from Southeastern Climbers Coalition.",
        "typical_duration_minutes": 180,
        "explore_category": "outdoors",
        "explore_blurb": "Distinctive local climbing anchor with real community identity.",
        "vibes": [],
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
    parser = argparse.ArgumentParser(description="Seed Yonder Wave 1 regional destinations.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 1 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 1 Regional Destination Seed")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", "yes" if args.refresh_existing else "no")
    logger.info("")

    for seed in WAVE_1_DESTINATIONS:
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
            get_or_create_place(payload)
        logger.info("%s new: %s", "ADD" if args.apply else "WOULD ADD", seed["name"])
        created += 1

    logger.info("")
    logger.info("Summary: created=%s updated=%s skipped=%s", created, updated, skipped)


if __name__ == "__main__":
    main()
