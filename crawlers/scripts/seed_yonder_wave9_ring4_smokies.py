#!/usr/bin/env python3
"""
Seed Yonder's ninth destination wave — Ring 4 (3-4 hour from Atlanta): Smokies,
Asheville area, Pisgah, Nantahala.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave9_ring4_smokies.py
    python3 scripts/seed_yonder_wave9_ring4_smokies.py --apply
    python3 scripts/seed_yonder_wave9_ring4_smokies.py --apply --refresh-existing
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from copy import deepcopy

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, get_or_create_place, get_venue_by_slug
from db.place_vertical import upsert_place_vertical_details

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Each entry is a (venue_seed, destination_details) pair.
# venue_seed fields go into `venues`; details go into `venue_destination_details`.
WAVE_9_DESTINATIONS = [
    (
        {
            "name": "Great Smoky Mountains National Park (Sugarlands)",
            "slug": "great-smoky-mountains-sugarlands",
            "address": "1420 Fighting Creek Gap Rd",
            "city": "Gatlinburg",
            "state": "TN",
            "zip": "37738",
            "lat": 35.6881,
            "lng": -83.5346,
            "website": "https://www.nps.gov/grsm/",
            "venue_type": "park",
            "short_description": (
                "America's most visited national park — 800+ miles of trails, "
                "72 miles of the AT, and the highest peaks in the eastern US."
            ),
            "description": (
                "Great Smoky Mountains National Park is the most visited national park "
                "in the US with 800+ miles of trails, a 72-mile section of the "
                "Appalachian Trail, and peaks reaching 6,643 feet. Highlights include "
                "Clingmans Dome, Charlies Bunion, Andrews Bald, Alum Cave Trail to Mt. "
                "LeConte, and Laurel Falls. No entrance fee."
            ),
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "national_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["cool-weather", "leaf-season", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "practical_notes": (
                "Dogs only on 3 frontcountry trails. Parking tags required at many "
                "trailheads — reserve at recreation.gov."
            ),
        },
    ),
    (
        {
            "name": "Nantahala River",
            "slug": "nantahala-river-rafting",
            "address": "13077 US-19",
            "city": "Bryson City",
            "state": "NC",
            "zip": "28713",
            "lat": 35.3342,
            "lng": -83.5937,
            "website": "https://noc.com/nantahala-river-rafting/",
            "venue_type": "park",
            "short_description": (
                "NOC's flagship river — 8 miles of Class I-II rapids finishing "
                "with the Class III Nantahala Falls at the takeout."
            ),
            "description": (
                "The Nantahala River is NOC's flagship whitewater trip and one of the "
                "most-run rivers in the South. Eight miles of Class I-II rapids are "
                "accessible for beginners, finishing with the Class III Nantahala Falls "
                "at the takeout. The Appalachian Trail crosses the river at Wesser. "
                "NOC's main campus has dining, lodging, and outdoor retail."
            ),
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "river",
            "primary_activity": "rafting",
            "difficulty_level": "moderate",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": True,
            "fee_note": "$40-65/person with NOC",
        },
    ),
    (
        {
            "name": "Sliding Rock",
            "slug": "sliding-rock",
            "address": "7690 Pisgah Hwy",
            "city": "Brevard",
            "state": "NC",
            "zip": "28712",
            "lat": 35.2766,
            "lng": -82.7688,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48112",
            "venue_type": "park",
            "short_description": (
                "Natural 60-foot waterslide into an 8-foot swimming pool in Pisgah "
                "National Forest — a Southeast summer bucket list item."
            ),
            "description": (
                "Sliding Rock is a natural 60-foot slick rock waterslide that dumps "
                "into an 8-foot deep swimming pool in Pisgah National Forest. One of "
                "the most fun outdoor experiences in the Southeast. $5 entry. "
                "Lifeguards on duty in summer. Water temperature stays around "
                "50-60°F year-round."
            ),
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "water_access",
            "primary_activity": "swimming",
            "difficulty_level": "easy",
            "drive_time_minutes": 210,
            "best_seasons": ["summer"],
            "weather_fit_tags": ["summer-friendly"],
            "parking_type": "paid_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/person",
        },
    ),
    (
        {
            "name": "Dupont State Recreational Forest",
            "slug": "dupont-state-forest",
            "address": "89 Buck Forest Rd",
            "city": "Cedar Mountain",
            "state": "NC",
            "zip": "28718",
            "lat": 35.2017,
            "lng": -82.6117,
            "website": "https://dupontstaterecreationalforest.com/",
            "venue_type": "park",
            "short_description": (
                "10,400 acres with 90+ miles of multi-use trails and 3 major "
                "waterfalls — Hunger Games filming location."
            ),
            "description": (
                "Dupont State Recreational Forest spans 10,400 acres near Brevard, NC "
                "with 90+ miles of trails for hiking, mountain biking, and horseback "
                "riding. Three major waterfalls — Triple Falls, Hooker Falls, and High "
                "Falls — were used as filming locations for The Hunger Games. "
                "Outstanding multi-use destination."
            ),
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["dry-weather", "summer-friendly", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Tsali Recreation Area",
            "slug": "tsali-recreation-area",
            "address": "Tsali Rd",
            "city": "Bryson City",
            "state": "NC",
            "zip": "28713",
            "lat": 35.3605,
            "lng": -83.5696,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48975",
            "venue_type": "trail",
            "short_description": (
                "Top-tier mountain biking on four trail loops with Lake Fontana views "
                "in Nantahala National Forest."
            ),
            "description": (
                "Tsali Recreation Area offers four mountain bike trail loops (Left "
                "Loop, Right Loop, Thompson Loop, Mouse Branch) in Nantahala National "
                "Forest. Alternating-day use keeps horse and bike traffic separated. "
                "Lake Fontana views throughout. One of the most scenic mountain bike "
                "settings in the South."
            ),
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": [],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "trail",
            "primary_activity": "mountain_biking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["dry-weather", "cool-weather", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "no",
            "reservation_required": False,
            "fee_note": "$3 USFS day-use",
        },
    ),
    (
        {
            "name": "Fontana Lake",
            "slug": "fontana-lake",
            "address": "Fontana Dam Rd",
            "city": "Fontana Dam",
            "state": "NC",
            "zip": "28733",
            "lat": 35.4444,
            "lng": -83.8042,
            "website": "https://www.nps.gov/grsm/planyourvisit/fontana-lake.htm",
            "venue_type": "park",
            "short_description": (
                "30-mile reservoir surrounded entirely by GSMNP and Nantahala NF — "
                "backcountry boat camping at its finest."
            ),
            "description": (
                "Fontana Lake is a 30-mile reservoir created by Fontana Dam (480 feet "
                "tall — tallest dam in eastern US). Completely surrounded by Great "
                "Smoky Mountains National Park and Nantahala National Forest. "
                "Backcountry boat-in camping on the north shore. Tsali Recreation Area "
                "on the south. Exceptional remoteness for its accessibility."
            ),
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "lake",
            "primary_activity": "paddling",
            "difficulty_level": "moderate",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Cherohala Skyway",
            "slug": "cherohala-skyway",
            "address": "Cherohala Skyway",
            "city": "Tellico Plains",
            "state": "TN",
            "zip": "37385",
            "lat": 35.3583,
            "lng": -84.0569,
            "website": "https://cherohala.com/",
            "venue_type": "park",
            "short_description": (
                "36-mile high-elevation scenic drive reaching 5,400 feet between "
                "Cherokee and Nantahala National Forests."
            ),
            "description": (
                "The Cherohala Skyway is a 36-mile National Scenic Byway connecting "
                "Tellico Plains, TN to Robbinsville, NC. Reaches 5,400 feet elevation "
                "with dramatic mountain vistas. More scenic and far less crowded than "
                "Newfound Gap Road. Connects Cherokee and Nantahala National Forests. "
                "Popular with motorcyclists."
            ),
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "scenic_drive",
            "primary_activity": "scenic_drive",
            "difficulty_level": "easy",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Looking Glass Falls",
            "slug": "looking-glass-falls",
            "address": "US-276",
            "city": "Brevard",
            "state": "NC",
            "zip": "28712",
            "lat": 35.2966,
            "lng": -82.7709,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48112",
            "venue_type": "park",
            "short_description": (
                "60-foot roadside waterfall in Pisgah National Forest — one of the "
                "most accessible and photographed waterfalls in the Southeast."
            ),
            "description": (
                "Looking Glass Falls is a 60-foot waterfall visible directly from the "
                "road in Pisgah National Forest. Wheelchair-accessible viewing area "
                "makes it one of the most accessible major waterfalls in the region. "
                "Swimming possible at the base pool. One of the most photographed "
                "waterfalls in the Southeast."
            ),
            "typical_duration_minutes": 30,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Gorges State Park",
            "slug": "gorges-state-park",
            "address": "NC-281 S",
            "city": "Sapphire",
            "state": "NC",
            "zip": "28774",
            "lat": 35.0878,
            "lng": -82.9541,
            "website": "https://www.ncparks.gov/state-parks/gorges-state-park",
            "venue_type": "park",
            "short_description": (
                "4 waterfalls including Turtleback Falls natural slide, Class V river, "
                "and some of NC's most dramatic gorge scenery."
            ),
            "description": (
                "Gorges State Park is one of North Carolina's most dramatic parks. "
                "Four waterfalls accessible by trail including Turtleback Falls (a "
                "swimmable natural slide waterfall), Frozen Creek Falls, and Staircase "
                "Falls. The Horsepasture River has Class V whitewater for expert "
                "kayakers. 3 hours from Atlanta but feels a world away."
            ),
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": [],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "state_park",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "moderate",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Blue Ridge Parkway (Asheville Section)",
            "slug": "blue-ridge-parkway-asheville",
            "address": "Milepost 382 Blue Ridge Pkwy",
            "city": "Asheville",
            "state": "NC",
            "zip": "28803",
            "lat": 35.5117,
            "lng": -82.4884,
            "website": "https://www.nps.gov/blri/",
            "venue_type": "park",
            "short_description": (
                "America's most-visited National Parkway — Craggy Gardens, Mount "
                "Pisgah, Graveyard Fields, and 469 miles of mountain ridge driving."
            ),
            "description": (
                "The Blue Ridge Parkway is America's most-visited linear park at "
                "469 miles. The Asheville section (Milepost 355-420) offers Craggy "
                "Gardens (rhododendron bloom in June), Mount Pisgah hiking, Graveyard "
                "Fields waterfall trail with wild blueberries, and the Folk Art "
                "Center. No entrance fee."
            ),
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "scenic_drive",
            "primary_activity": "scenic_drive",
            "difficulty_level": "easy",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Congaree National Park",
            "slug": "congaree-national-park",
            "address": "100 National Park Rd",
            "city": "Hopkins",
            "state": "SC",
            "zip": "29061",
            "lat": 33.7948,
            "lng": -80.7821,
            "website": "https://www.nps.gov/cong/",
            "venue_type": "park",
            "short_description": (
                "The only old-growth bottomland hardwood forest in the Southeast — "
                "boardwalk trails through ancient record-size trees."
            ),
            "description": (
                "Congaree National Park protects the largest intact expanse of "
                "old-growth bottomland hardwood forest in the southeastern US. "
                "Boardwalk trail through ancient trees — some of national record size. "
                "Kayak/canoe the Cedar Creek paddle trail. Firefly synchronous display "
                "in May-June. No entrance fee."
            ),
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "national_park",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Pisgah National Forest (Brevard Area)",
            "slug": "pisgah-national-forest-brevard",
            "address": "1600 Pisgah Hwy",
            "city": "Pisgah Forest",
            "state": "NC",
            "zip": "28768",
            "lat": 35.2764,
            "lng": -82.7447,
            "website": "https://www.fs.usda.gov/nfsnc",
            "venue_type": "park",
            "short_description": (
                "Bucket-list mountain biking, 3 major waterfalls, and Sliding Rock "
                "in the heart of Western North Carolina."
            ),
            "description": (
                "Pisgah National Forest near Brevard is a multi-sport adventure "
                "destination. Black Mountain Trail and Thrift Cove are bucket-list "
                "MTB. Looking Glass Falls, Sliding Rock, and multiple swimming holes "
                "provide water recreation. Davidson River offers excellent trout "
                "fishing. The outdoor recreation capital of Western NC."
            ),
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "national_park",
            "primary_activity": "mountain_biking",
            "difficulty_level": "hard",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["dry-weather", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Deals Gap / The Dragon (US-129)",
            "slug": "deals-gap-the-dragon",
            "address": "17548 Tapoco Rd",
            "city": "Robbinsville",
            "state": "NC",
            "zip": "28771",
            "lat": 35.4592,
            "lng": -83.9297,
            "website": "https://tailofthedragon.com/",
            "venue_type": "park",
            "short_description": (
                "11 miles, 318 curves — the most famous driving road in America "
                "at the Tennessee/North Carolina border."
            ),
            "description": (
                "US-129 through Deals Gap — known as The Dragon or Tail of the Dragon "
                "— is the most famous driving and motorcycling road in America. "
                "11 miles with 318 curves, no intersections, and no driveways. At "
                "Chilhowee Lake near the NC/TN border. The Dragon Store and Deals Gap "
                "Motorcycle Resort serve as base camp."
            ),
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": [],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "scenic_drive",
            "primary_activity": "scenic_drive",
            "difficulty_level": "moderate",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["dry-weather", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "no",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Mammoth Cave National Park",
            "slug": "mammoth-cave-national-park",
            "address": "1 Mammoth Cave Pkwy",
            "city": "Mammoth Cave",
            "state": "KY",
            "zip": "42259",
            "lat": 37.1870,
            "lng": -86.1006,
            "website": "https://www.nps.gov/maca/",
            "venue_type": "park",
            "short_description": (
                "World's longest known cave system at 400+ miles — UNESCO World "
                "Heritage Site with multiple tour options."
            ),
            "description": (
                "Mammoth Cave National Park protects the world's longest known cave "
                "system with over 400 miles mapped and counting. UNESCO World Heritage "
                "Site. Multiple tour options from 0.25-mile walks to 5-mile wild cave "
                "crawling tours. Above ground: 80+ miles of trails, Green River "
                "kayaking, and campground. No park entrance fee."
            ),
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "national_park",
            "primary_activity": "caving",
            "difficulty_level": "easy",
            "drive_time_minutes": 240,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": True,
            "fee_note": "Cave tours $6-60/person, reserve at recreation.gov",
        },
    ),
    (
        {
            "name": "Graveyard Fields",
            "slug": "graveyard-fields",
            "address": "Milepost 418 Blue Ridge Pkwy",
            "city": "Canton",
            "state": "NC",
            "zip": "28716",
            "lat": 35.3215,
            "lng": -82.8479,
            "website": "https://www.nps.gov/blri/",
            "venue_type": "trail",
            "short_description": (
                "Highland bog and waterfall trail off the Blue Ridge Parkway with "
                "wild blueberries in season at 5,100 feet."
            ),
            "description": (
                "Graveyard Fields is a popular trail off the Blue Ridge Parkway at "
                "Milepost 418. Easy hike to Second Falls (50 feet) through a highland "
                "bog landscape at 5,100 feet elevation. Wild blueberries ripen in late "
                "July. Unique high-altitude landscape unlike typical Appalachian "
                "forest. Often combined with a Parkway drive."
            ),
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 220,
            "best_seasons": ["summer", "fall"],
            "weather_fit_tags": ["clear-day", "cool-weather", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    ),
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
            "website",
            "typical_duration_minutes",
        } and current != value:
            updates[key] = value
    return updates


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed Yonder Wave 9 Ring 4 (Smokies/Asheville/Pisgah/Nantahala) destinations."
    )
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 9 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0
    details_written = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 9 Ring 4 Destination Seed (Smokies / Asheville / Pisgah / Nantahala)")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for seed, details in WAVE_9_DESTINATIONS:
        payload = build_payload(seed)
        existing = find_existing_venue(seed)

        if not existing:
            if args.apply:
                venue_id = get_or_create_place(payload)
                upsert_place_vertical_details(venue_id, details)
                details_written += 1
            logger.info("%s venue: %s", "CREATE" if args.apply else "WOULD CREATE", seed["slug"])
            created += 1
            continue

        venue_id = existing["id"]

        if not args.refresh_existing:
            logger.info("KEEP venue: %s (already exists)", seed["slug"])
            skipped += 1
            # Still upsert destination details even when skipping venue updates.
            if args.apply:
                upsert_place_vertical_details(venue_id, details)
                details_written += 1
            continue

        updates = compute_updates(existing, payload)
        if not updates:
            logger.info("KEEP venue: %s (no changes)", seed["slug"])
            skipped += 1
        else:
            if args.apply:
                client.table("venues").update(updates).eq("id", venue_id).execute()
            logger.info(
                "%s venue: %s (%s fields)",
                "UPDATE" if args.apply else "WOULD UPDATE",
                seed["slug"],
                len(updates),
            )
            updated += 1

        if args.apply:
            upsert_place_vertical_details(venue_id, details)
            details_written += 1

    logger.info("")
    logger.info(
        "Summary: created=%s updated=%s skipped=%s details_written=%s",
        created,
        updated,
        skipped,
        details_written,
    )


if __name__ == "__main__":
    main()
