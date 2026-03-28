#!/usr/bin/env python3
"""
Seed Yonder's tenth destination wave — hidden gems and specialty destinations
across all rings that don't fit neatly into other waves.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave10_hidden_gems.py
    python3 scripts/seed_yonder_wave10_hidden_gems.py --apply
    python3 scripts/seed_yonder_wave10_hidden_gems.py --apply --refresh-existing
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from copy import deepcopy

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, get_or_create_venue, get_venue_by_slug
from db.place_vertical import upsert_venue_destination_details

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Each entry has a "venue" block (fields for the venues table) and a
# "details" block (fields for venue_destination_details).
WAVE_10_DESTINATIONS = [
    {
        "venue": {
            "name": "Nickajack Cave (Gray Bat Colony)",
            "slug": "nickajack-cave",
            "address": "TN-156",
            "city": "Jasper",
            "state": "TN",
            "zip": "37347",
            "lat": 34.9756,
            "lng": -85.6283,
            "website": "https://www.fws.gov/refuge/nickajack-cave",
            "venue_type": "park",
            "short_description": "Hundreds of thousands of gray bats emerge at dusk from a cave mouth on the Tennessee River — accessible by kayak.",
            "description": "Nickajack Cave is a US Fish & Wildlife refuge protecting one of the largest gray bat colonies in North America. The evening bat emergence — hundreds of thousands of bats spiraling out at dusk — is a genuine natural spectacle. Best viewed by kayak (1-mile paddle to the cave mouth). No interior access (bat sanctuary).",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "landmark",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 120,
            "best_seasons": ["summer"],
            "weather_fit_tags": ["clear-day", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "conditions_notes": "Best viewing June-August at sunset. Bring a kayak or rent locally.",
        },
    },
    {
        "venue": {
            "name": "Pickett CCC Memorial State Park",
            "slug": "pickett-state-park",
            "address": "4605 Pickett Park Hwy",
            "city": "Jamestown",
            "state": "TN",
            "zip": "38556",
            "lat": 36.5566,
            "lng": -84.7992,
            "website": "https://tnstateparks.com/parks/pickett",
            "venue_type": "park",
            "short_description": "Natural arches, sandstone bluffs, and 58+ miles of backcountry trails — the best state park no one from Atlanta visits.",
            "description": "Pickett CCC Memorial State Park is a backcountry wilderness gem with natural arches (Natural Bridge, Hazard Cave), sandstone bluffs, 58+ miles of trails, and swimming holes. Consistently rated one of Tennessee's best parks but draws almost zero Atlanta visitors. CCC-built cabins, campground, and lake.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["cool-weather", "dry-weather", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Cumberland Caverns",
            "slug": "cumberland-caverns",
            "address": "1437 Cumberland Caverns Rd",
            "city": "McMinnville",
            "state": "TN",
            "zip": "37110",
            "lat": 35.6414,
            "lng": -85.7419,
            "website": "https://cumberlandcaverns.com/",
            "venue_type": "museum",
            "short_description": "30 miles of cave passages with underground concert hall — Tennessee's largest show cave.",
            "description": "Cumberland Caverns has 30 miles of explored passages, making it Tennessee's largest show cave. Regular tours and adventure spelunking options. The main hall hosts underground concerts with remarkable acoustics. Unique event venue for an unforgettable experience.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "cavern",
            "primary_activity": "caving",
            "difficulty_level": "easy",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": True,
            "fee_note": "$20-40/person",
        },
    },
    {
        "venue": {
            "name": "BJ Reece Orchards",
            "slug": "bj-reece-orchards",
            "address": "9131 GA-52 E",
            "city": "Ellijay",
            "state": "GA",
            "zip": "30540",
            "lat": 34.7146,
            "lng": -84.3867,
            "website": "https://www.bjreeceorchards.com/",
            "venue_type": "park",
            "short_description": "200+ acre apple orchard with u-pick, corn maze, pony rides, and giant slides — North Georgia's fall destination.",
            "description": "BJ Reece Orchards spans 200+ acres in the Apple Capital of Georgia. U-pick apples, pony rides, corn maze, wagon rides, giant slides, and farm animals. One of the top fall agritourism experiences in Georgia. Peak season September-November.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "farm",
            "primary_activity": "agritourism",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["fall"],
            "weather_fit_tags": ["dry-weather", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Cohutta Wilderness (Jacks River Trail)",
            "slug": "cohutta-wilderness-jacks-river",
            "address": "USFS Rd 16",
            "city": "Cisco",
            "state": "GA",
            "zip": "30708",
            "lat": 34.9150,
            "lng": -84.5400,
            "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10477",
            "venue_type": "trail",
            "short_description": "37,000-acre wilderness with 40+ river crossings on the Jacks River Trail to an 80-foot waterfall swimming hole.",
            "description": "The Cohutta Wilderness is 37,000 acres of Georgia's most remote backcountry. The Jacks River Trail (9 miles to Jacks River Falls) involves 40+ river crossings and leads to an 80-foot waterfall with a deep swimming hole. Conasauga River Trail is equally popular. No permits required. Serious backpacking territory.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "trail",
            "primary_activity": "hiking",
            "difficulty_level": "hard",
            "drive_time_minutes": 100,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "after-rain"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "no",
            "reservation_required": False,
            "seasonal_hazards": ["high-water"],
            "conditions_notes": "River crossings can be dangerous after heavy rain. Check water levels before going.",
        },
    },
    {
        "venue": {
            "name": "DeSoto Caverns",
            "slug": "desoto-caverns",
            "address": "5181 DeSoto Caverns Pkwy",
            "city": "Childersburg",
            "state": "AL",
            "zip": "35044",
            "lat": 33.3272,
            "lng": -86.3239,
            "website": "https://www.desotocaverns.com/",
            "venue_type": "museum",
            "short_description": "Commercial cavern with onyx formations and light shows — used by Native Americans for 2,000+ years.",
            "description": "DeSoto Caverns is a commercial cave attraction in central Alabama with spectacular onyx formations and multi-colored light shows. Archaeological evidence shows use by Native Americans for over 2,000 years. Above-ground adventure park with maze, gem mining, and go-karts.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "cavern",
            "primary_activity": "caving",
            "difficulty_level": "easy",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": True,
            "fee_note": "$18/adult",
        },
    },
    {
        "venue": {
            "name": "Foothills Trail (Oconee State Park Trailhead)",
            "slug": "foothills-trail",
            "address": "624 State Park Rd",
            "city": "Mountain Rest",
            "state": "SC",
            "zip": "29664",
            "lat": 34.8603,
            "lng": -83.1118,
            "website": "https://foothillstrail.org/",
            "venue_type": "trail",
            "short_description": "76-mile thru-hike through South Carolina's mountain parks — the best backpacking trail in the state.",
            "description": "The Foothills Trail is a 76-mile trail through South Carolina's Blue Ridge mountains, connecting Oconee State Park to Table Rock State Park. Considered the best backpacking trail in South Carolina. Waterfalls, gorges, lake views, and mountain summits. Can be done as a week-long thru-hike or in sections.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "trail",
            "primary_activity": "hiking",
            "difficulty_level": "hard",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["cool-weather", "dry-weather", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "no",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Cherokee Foothills Scenic Highway (SC-11)",
            "slug": "cherokee-foothills-scenic-hwy",
            "address": "SC-11",
            "city": "Gaffney",
            "state": "SC",
            "zip": "29341",
            "lat": 35.0696,
            "lng": -81.6553,
            "website": "https://discoversouthcarolina.com/articles/cherokee-foothills-scenic-highway",
            "venue_type": "park",
            "short_description": "130-mile scenic route along the Blue Ridge foothills connecting 7 state parks with outstanding fall color.",
            "description": "SC Highway 11 is a 130-mile scenic route along the base of the Blue Ridge in South Carolina. Connects Table Rock, Caesars Head, Oconee, and 4 other state parks. Outstanding fall color and wildflower viewing. Peach orchards and farm stands along the route. No commercial development.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "scenic_drive",
            "primary_activity": "scenic_drive",
            "difficulty_level": "easy",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Dawson Forest WMA",
            "slug": "dawson-forest-wma",
            "address": "Dawson Forest Rd",
            "city": "Dawsonville",
            "state": "GA",
            "zip": "30534",
            "lat": 34.4150,
            "lng": -84.2250,
            "website": "https://georgiawildlife.com/dawson-forest-wma",
            "venue_type": "park",
            "short_description": "15+ miles of mountain bike and hiking trails with Etowah River access — less crowded than Blankets Creek.",
            "description": "Dawson Forest Wildlife Management Area offers 15+ miles of mountain bike and hiking trails through managed forestland. Etowah River access for paddling. Significantly less crowded than Blankets Creek while offering similar quality singletrack. Hunting seasons may restrict access.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": ["dog-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "trail",
            "primary_activity": "mountain_biking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 65,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["dry-weather", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
            "seasonal_hazards": ["hunting-season"],
            "conditions_notes": "Check hunting season dates — some areas restricted during deer/turkey season.",
        },
    },
    {
        "venue": {
            "name": "Blue Ridge Aerial Adventure Park",
            "slug": "blue-ridge-aerial-adventure",
            "address": "6250 Aska Rd",
            "city": "Blue Ridge",
            "state": "GA",
            "zip": "30513",
            "lat": 34.8127,
            "lng": -84.2751,
            "website": "https://www.zipblueridge.com/",
            "venue_type": "park",
            "short_description": "165-acre aerial adventure park with 6,000+ feet of zip lines through Blue Ridge mountain forest.",
            "description": "Blue Ridge Aerial Adventure Park spans 165 acres with 6,000+ feet of zip line cable and over a mile of total zip distance. Multiple tour options from 7-zip introductory to 13-zip full mountain experience. Aerial challenge course adds obstacles and bridges. Mountain forest canopy setting near Blue Ridge.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "zipline_park",
            "primary_activity": "zip_lining",
            "difficulty_level": "moderate",
            "drive_time_minutes": 105,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["dry-weather", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": True,
            "fee_note": "$60-120/person",
        },
    },
]


def build_payload(venue_seed: dict) -> dict:
    payload = deepcopy(venue_seed)
    payload.setdefault("active", True)
    return payload


def find_existing_venue(venue_seed: dict) -> dict | None:
    existing = get_venue_by_slug(venue_seed["slug"])
    if existing:
        return existing

    client = get_client()
    result = (
        client.table("venues")
        .select("*")
        .eq("name", venue_seed["name"])
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
    parser = argparse.ArgumentParser(
        description="Seed Yonder Wave 10 hidden gems and specialty destinations."
    )
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 10 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0
    details_upserted = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 10 Hidden Gems Destination Seed")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for entry in WAVE_10_DESTINATIONS:
        venue_seed = entry["venue"]
        details = entry["details"]
        payload = build_payload(venue_seed)
        existing = find_existing_venue(venue_seed)

        venue_id = None

        if not existing:
            if args.apply:
                venue_id = get_or_create_venue(payload)
            logger.info(
                "%s venue: %s",
                "CREATE" if args.apply else "WOULD CREATE",
                venue_seed["slug"],
            )
            created += 1
        elif not args.refresh_existing:
            venue_id = existing["id"]
            logger.info("KEEP venue: %s (already exists)", venue_seed["slug"])
            skipped += 1
        else:
            venue_id = existing["id"]
            updates = compute_updates(existing, payload)
            if not updates:
                logger.info("KEEP venue: %s (no changes)", venue_seed["slug"])
                skipped += 1
            else:
                if args.apply:
                    client.table("venues").update(updates).eq("id", existing["id"]).execute()
                logger.info(
                    "%s venue: %s (%s fields)",
                    "UPDATE" if args.apply else "WOULD UPDATE",
                    venue_seed["slug"],
                    len(updates),
                )
                updated += 1

        # Upsert destination details whenever we have a venue_id
        if venue_id and args.apply:
            result = upsert_venue_destination_details(venue_id, details)
            if result:
                details_upserted += 1
                logger.info("  -> destination_details upserted for venue_id=%s", venue_id)
            else:
                logger.warning(
                    "  -> destination_details upsert FAILED for venue_id=%s", venue_id
                )
        elif not args.apply:
            logger.info("  -> WOULD upsert destination_details: %s", list(details.keys()))

    logger.info("")
    logger.info(
        "Summary: created=%s updated=%s skipped=%s details_upserted=%s",
        created,
        updated,
        skipped,
        details_upserted,
    )


if __name__ == "__main__":
    main()
