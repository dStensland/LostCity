#!/usr/bin/env python3
"""
Seed Yonder's sixth destination wave — Ring 1 (0-1 hour from Atlanta) gap-fill.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave6_ring1_gapmatch.py
    python3 scripts/seed_yonder_wave6_ring1_gapmatch.py --apply
    python3 scripts/seed_yonder_wave6_ring1_gapmatch.py --apply --refresh-existing
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

# Each entry has a "venue" block (fields for the venues table) and a
# "details" block (fields for venue_destination_details).
WAVE_6_DESTINATIONS = [
    {
        "venue": {
            "name": "Sawnee Mountain Preserve",
            "slug": "sawnee-mountain-preserve",
            "address": "4075 Spot Rd",
            "city": "Cumming",
            "state": "GA",
            "zip": "30040",
            "lat": 34.2175,
            "lng": -84.1403,
            "website": "https://www.forsythco.com/Departments-Offices/Parks-Recreation/Parks-Facilities/Sawnee-Mountain-Preserve",
            "venue_type": "park",
            "short_description": "Rocky summit with Indian Seats overlook and 12 miles of trails through 683 acres of Forsyth County forest.",
            "description": "Sawnee Mountain Preserve offers one of the best summit views within an hour of Atlanta. The Indian Seats overlook provides panoramic views of the North Georgia foothills. 12 miles of well-maintained trails range from easy lakeside strolls to moderate rocky climbs.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["family-friendly", "dog-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "trail",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 40,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["cool-weather", "clear-day", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "High Falls State Park",
            "slug": "high-falls-state-park",
            "address": "76 High Falls Park Dr",
            "city": "Jackson",
            "state": "GA",
            "zip": "30233",
            "lat": 33.1768,
            "lng": -83.8544,
            "website": "https://gastateparks.org/HighFalls",
            "venue_type": "park",
            "short_description": "Towaliga River waterfalls, 650-acre lake, and camping just 47 minutes south of Atlanta.",
            "description": "High Falls State Park features cascading waterfalls on the Towaliga River, a 650-acre lake for fishing and paddling, and 4.5 miles of trails. Two campgrounds plus a primitive paddle-in campsite make this an accessible overnight option south of the city.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 47,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5 parking pass",
        },
    },
    {
        "venue": {
            "name": "Blankets Creek Trail System",
            "slug": "blankets-creek-trail-system",
            "address": "2261 Sixes Rd",
            "city": "Woodstock",
            "state": "GA",
            "zip": "30188",
            "lat": 34.1206,
            "lng": -84.4872,
            "website": "https://www.sorbawoodstock.org/trails",
            "venue_type": "park",
            "short_description": "Premier metro Atlanta mountain biking with 19 miles of singletrack across 6 trails from beginner to expert.",
            "description": "Blankets Creek is the most-ridden mountain bike trail system in the Southeast. 19 miles of SORBA-maintained singletrack across 6 named trails accommodate every skill level. Adjacent to Rope Mill Park for combined riding sessions.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["dog-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "trail",
            "primary_activity": "mountain_biking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 40,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["dry-weather", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Lake Allatoona",
            "slug": "lake-allatoona",
            "address": "250 Marina Way",
            "city": "Cartersville",
            "state": "GA",
            "zip": "30121",
            "lat": 34.1620,
            "lng": -84.6985,
            "website": "https://www.sam.usace.army.mil/Missions/Civil-Works/Recreation/Allatoona-Lake/",
            "venue_type": "park",
            "short_description": "12,000-acre reservoir with kayaking, swimming beaches, and a hidden waterfall accessible only by boat.",
            "description": "Lake Allatoona offers 12,000 acres of water recreation just 35 minutes from Atlanta. Kayak rentals, multiple swimming beaches, fishing, and a hidden waterfall reachable only by boat. Red Top Mountain State Park sits on its shores.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "lake",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 35,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Historic Banning Mills",
            "slug": "historic-banning-mills",
            "address": "205 Horseshoe Dam Rd",
            "city": "Whitesburg",
            "state": "GA",
            "zip": "30185",
            "lat": 33.5073,
            "lng": -84.9397,
            "website": "https://www.historicbanningmills.com/",
            "venue_type": "park",
            "short_description": "Guinness World Record zip line canopy course with 100+ zip lines spanning over 11 miles of forested gorge.",
            "description": "Historic Banning Mills holds the Guinness World Record for the longest continuous zip line canopy course. Over 100 zip lines, suspension bridges, and rappelling stations span Snake Creek Gorge. Resort lodging available for overnight adventures.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "zipline_park",
            "primary_activity": "zip_lining",
            "difficulty_level": "moderate",
            "drive_time_minutes": 60,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["dry-weather", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "caution",
            "reservation_required": True,
            "fee_note": "Zip tours $89-189/person",
        },
    },
    {
        "venue": {
            "name": "Rope Mill Park",
            "slug": "rope-mill-park",
            "address": "690 Rope Mill Rd",
            "city": "Woodstock",
            "state": "GA",
            "zip": "30188",
            "lat": 34.1130,
            "lng": -84.5020,
            "website": "https://www.cherokeecountyga.gov/292/Rope-Mill-Park",
            "venue_type": "park",
            "short_description": "Mountain bike trails and Etowah River access adjacent to Blankets Creek in Cherokee County.",
            "description": "Rope Mill Park combines mountain bike singletrack with Etowah River access for kayaking and fishing. Adjacent to Blankets Creek trail system, making it ideal for a combined half-day riding session.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["dog-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "trail",
            "primary_activity": "mountain_biking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 40,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["dry-weather", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Treetop Quest Dunwoody",
            "slug": "treetop-quest-dunwoody",
            "address": "4770 N Peachtree Rd",
            "city": "Dunwoody",
            "state": "GA",
            "zip": "30338",
            "lat": 33.9312,
            "lng": -84.3293,
            "website": "https://treetopquest.com/",
            "venue_type": "park",
            "short_description": "60+ obstacles and zip lines in a mature forest canopy at Brook Run Park, 30 minutes from downtown Atlanta.",
            "description": "Treetop Quest offers 60+ aerial obstacles and zip lines through the forest canopy of Brook Run Park. Multiple courses range from kid-friendly to challenging adult courses. One of the closest aerial adventure experiences to downtown Atlanta.",
            "typical_duration_minutes": 150,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "zipline_park",
            "primary_activity": "zip_lining",
            "difficulty_level": "moderate",
            "drive_time_minutes": 30,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["dry-weather", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": True,
            "fee_note": "$35-55/person",
        },
    },
    {
        "venue": {
            "name": "Panther Creek Trail",
            "slug": "panther-creek-trail",
            "address": "Historic US-441",
            "city": "Clarkesville",
            "state": "GA",
            "zip": "30523",
            "lat": 34.6561,
            "lng": -83.5089,
            "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10519",
            "venue_type": "trail",
            "short_description": "7.5-mile trail to a spectacular waterfall with multiple swimming holes along the route through Chattahoochee National Forest.",
            "description": "Panther Creek Trail is a 7.5-mile out-and-back through Chattahoochee National Forest ending at the stunning Panther Creek Falls. Multiple swimming holes along the creek make this a prime warm-weather destination. Best March through May.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["dog-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "moderate",
            "drive_time_minutes": 55,
            "best_seasons": ["spring", "summer"],
            "weather_fit_tags": ["after-rain", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
            "fee_note": "$5 USFS day-use fee",
        },
    },
    {
        "venue": {
            "name": "Elachee Nature Science Center",
            "slug": "elachee-nature-science-center",
            "address": "2125 Elachee Dr",
            "city": "Gainesville",
            "state": "GA",
            "zip": "30504",
            "lat": 34.2897,
            "lng": -83.8198,
            "website": "https://www.elachee.org/",
            "venue_type": "park",
            "short_description": "1,400 acres of protected forest with 12 miles of trails and nature science education in the Chicopee Woods corridor.",
            "description": "Elachee Nature Science Center protects 1,400 acres of Chicopee Woods with 12 miles of hiking trails through diverse forest habitats. Education programs and museum exhibits complement the trail network. One of metro Atlanta's most undervisited natural areas.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["family-friendly", "dog-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "trail",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 50,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["cool-weather", "all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Southern Belle Farm",
            "slug": "southern-belle-farm",
            "address": "1658 Turner Church Rd",
            "city": "McDonough",
            "state": "GA",
            "zip": "30252",
            "lat": 33.3969,
            "lng": -84.1578,
            "website": "https://southernbellefarm.com/",
            "venue_type": "park",
            "short_description": "Year-round agritourism with strawberries, sunflowers, corn maze, and pumpkins south of Atlanta.",
            "description": "Southern Belle Farm is one of metro Atlanta's most complete agritourism destinations. Strawberry picking in spring, sunflower fields in summer, corn maze and pumpkin patch in fall. Playground, farm animals, and hayrides round out a family-friendly half day.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "farm",
            "primary_activity": "agritourism",
            "difficulty_level": "easy",
            "drive_time_minutes": 40,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["dry-weather", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Seasonal admission varies",
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
        description="Seed Yonder Wave 6 Ring 1 gap-fill destinations."
    )
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 6 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0
    details_upserted = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 6 Ring 1 Gap-Fill Destination Seed")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for entry in WAVE_6_DESTINATIONS:
        venue_seed = entry["venue"]
        details = entry["details"]
        payload = build_payload(venue_seed)
        existing = find_existing_venue(venue_seed)

        venue_id = None

        if not existing:
            if args.apply:
                venue_id = get_or_create_place(payload)
            logger.info("%s venue: %s", "CREATE" if args.apply else "WOULD CREATE", venue_seed["slug"])
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
            result = upsert_place_vertical_details(venue_id, details)
            if result:
                details_upserted += 1
                logger.info("  -> destination_details upserted for venue_id=%s", venue_id)
            else:
                logger.warning("  -> destination_details upsert FAILED for venue_id=%s", venue_id)
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
