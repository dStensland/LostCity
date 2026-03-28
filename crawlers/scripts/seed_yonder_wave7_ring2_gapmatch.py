#!/usr/bin/env python3
"""
Seed Yonder's seventh destination wave — Ring 2 (1-2 hour from Atlanta) gap-fill.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave7_ring2_gapmatch.py
    python3 scripts/seed_yonder_wave7_ring2_gapmatch.py --apply
    python3 scripts/seed_yonder_wave7_ring2_gapmatch.py --apply --refresh-existing
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

# Each entry is a (venue_seed, destination_details) pair.
# venue_seed fields go into `venues`; details go into `venue_destination_details`.
WAVE_7_DESTINATIONS = [
    (
        {
            "name": "Lake Rabun",
            "slug": "lake-rabun",
            "address": "Lake Rabun Rd",
            "city": "Lakemont",
            "state": "GA",
            "zip": "30552",
            "lat": 34.7574,
            "lng": -83.4559,
            "website": "https://gastateparks.org/Moccasin-Creek",
            "venue_type": "park",
            "short_description": (
                "Turquoise mountain lake surrounded by Chattahoochee National Forest "
                "with kayaking, swimming, and Minnehaha Falls nearby."
            ),
            "description": (
                "Lake Rabun is one of North Georgia's most beautiful lakes — smaller, "
                "cleaner, and less crowded than Lanier. Turquoise water surrounded by "
                "national forest. Kayak, SUP, and swim access via Moccasin Creek State "
                "Park. Minnehaha Falls trailhead nearby."
            ),
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "fullday",
            "destination_type": "lake",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 100,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Lake Burton",
            "slug": "lake-burton",
            "address": "Moccasin Creek Rd",
            "city": "Clayton",
            "state": "GA",
            "zip": "30525",
            "lat": 34.8160,
            "lng": -83.5241,
            "website": "https://gastateparks.org/Moccasin-Creek",
            "venue_type": "park",
            "short_description": (
                "Emerald green 2,775-acre lake surrounded by Chattahoochee National "
                "Forest in Rabun County."
            ),
            "description": (
                "Lake Burton is Georgia's most scenic mountain lake. 2,775 acres of "
                "emerald green water surrounded by Chattahoochee National Forest. "
                "Excellent for fishing, kayaking, and paddleboarding. Public beach "
                "access available. Less developed than most Georgia reservoirs."
            ),
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "fullday",
            "destination_type": "lake",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 105,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Lake Blue Ridge",
            "slug": "lake-blue-ridge",
            "address": "6050 Appalachian Hwy",
            "city": "Blue Ridge",
            "state": "GA",
            "zip": "30513",
            "lat": 34.8622,
            "lng": -84.2830,
            "website": "https://www.tva.com/environment/recreation/lake-blue-ridge",
            "venue_type": "park",
            "short_description": (
                "TVA reservoir with marina access and Georgia's best trout fishing "
                "on the Toccoa River tailwater below the dam."
            ),
            "description": (
                "Lake Blue Ridge is a Tennessee Valley Authority reservoir with "
                "excellent marina access, kayak rentals, and camping. The Toccoa River "
                "tailwater below the dam is considered the best trout fishing water in "
                "Georgia. Near downtown Blue Ridge for dining and shopping."
            ),
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "fullday",
            "destination_type": "lake",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 105,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Carters Lake",
            "slug": "carters-lake",
            "address": "711 Carters Lake Rd",
            "city": "Chatsworth",
            "state": "GA",
            "zip": "30705",
            "lat": 34.6267,
            "lng": -84.6450,
            "website": (
                "https://www.sam.usace.army.mil/Missions/Civil-Works/Recreation/"
                "Carters-Lake/"
            ),
            "venue_type": "park",
            "short_description": (
                "Georgia's deepest lake at 450 feet with marina, camping, and a "
                "quieter alternative to Lake Lanier."
            ),
            "description": (
                "Carters Lake is Georgia's deepest reservoir at 450 feet, managed by "
                "the Army Corps of Engineers. Two marinas, multiple campgrounds, boat "
                "rentals, and scenic loop roads. Far quieter and less developed than "
                "Lanier — the insider alternative for serious lake recreation."
            ),
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "fullday",
            "destination_type": "lake",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Helen Tubing on the Chattahoochee",
            "slug": "helen-tubing-chattahoochee",
            "address": "590 Edelweiss Strasse",
            "city": "Helen",
            "state": "GA",
            "zip": "30545",
            "lat": 34.7029,
            "lng": -83.7282,
            "website": "https://www.coolrivertubing.com/",
            "venue_type": "park",
            "short_description": (
                "Gentle 1.5-2.5 hour float through Alpine Helen on the "
                "Chattahoochee River headwaters."
            ),
            "description": (
                "Tubing the Chattahoochee through Helen is a quintessential North "
                "Georgia summer experience. Cool River Tubing and Helen Tubing offer "
                "1.5-2.5 hour floats on gentle water through the alpine-themed town. "
                "Seasonal: Memorial Day through Labor Day."
            ),
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "fullday",
            "destination_type": "water_access",
            "primary_activity": "tubing",
            "difficulty_level": "easy",
            "drive_time_minutes": 100,
            "best_seasons": ["summer"],
            "weather_fit_tags": ["summer-friendly"],
            "parking_type": "paid_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$12-16/person, seasonal only",
        },
    ),
    (
        {
            "name": "Bull Mountain / Jake Mountain Trail System",
            "slug": "bull-jake-mountain-trails",
            "address": "USFS Rd 77",
            "city": "Dahlonega",
            "state": "GA",
            "zip": "30533",
            "lat": 34.6622,
            "lng": -84.0175,
            "website": (
                "https://www.mtbproject.com/trail/523830/"
                "bull-and-jake-mountain-imba-epic"
            ),
            "venue_type": "trail",
            "short_description": (
                "IMBA Epic-designated mountain biking with 30+ miles of singletrack "
                "through Chattahoochee National Forest."
            ),
            "description": (
                "Bull and Jake Mountain Trail System holds IMBA's Epic designation — "
                "the highest honor in mountain biking. 30+ miles of combined "
                "singletrack, gravel, and converted forest roads. Bull Mountain side "
                "is steep and technical; Jake Mountain offers more approachable riding."
            ),
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": [],
            "active": True,
        },
        {
            "commitment_tier": "fullday",
            "destination_type": "trail",
            "primary_activity": "mountain_biking",
            "difficulty_level": "hard",
            "drive_time_minutes": 75,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["dry-weather", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "no",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Toccoa Falls",
            "slug": "toccoa-falls",
            "address": "107 Kincaid Dr",
            "city": "Toccoa",
            "state": "GA",
            "zip": "30577",
            "lat": 34.5830,
            "lng": -83.3339,
            "website": "https://tfrec.com/",
            "venue_type": "park",
            "short_description": (
                "186-foot single-drop waterfall on Toccoa Falls College campus — "
                "taller than Niagara by drop height."
            ),
            "description": (
                "Toccoa Falls is a 186-foot single-drop waterfall on the private "
                "campus of Toccoa Falls College. Taller than Niagara Falls by drop "
                "height. A short paved walk from the parking area makes this one of "
                "the most accessible major waterfalls in Georgia. $3 entrance fee."
            ),
            "typical_duration_minutes": 60,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "fullday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["after-rain", "all-season"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$3/person entrance",
        },
    ),
    (
        {
            "name": "Anna Ruby Falls",
            "slug": "anna-ruby-falls",
            "address": "3455 Anna Ruby Falls Rd",
            "city": "Helen",
            "state": "GA",
            "zip": "30545",
            "lat": 34.7396,
            "lng": -83.7139,
            "website": (
                "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10505"
            ),
            "venue_type": "trail",
            "short_description": (
                "Rare double waterfall — Curtis Creek at 150 feet and York Creek at "
                "50 feet — via a 0.5-mile paved trail near Helen."
            ),
            "description": (
                "Anna Ruby Falls is a rare double waterfall in Unicoi State Park. "
                "Curtis Creek drops 150 feet and York Creek drops 50 feet, merging "
                "at the base. A 0.5-mile paved, wheelchair-accessible trail leads to "
                "the viewing platform. One of the most unique waterfall formations in "
                "the Southeast."
            ),
            "typical_duration_minutes": 90,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "fullday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 105,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "all-season"],
            "parking_type": "paid_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/person day-use",
        },
    ),
    (
        {
            "name": "Gibbs Gardens",
            "slug": "gibbs-gardens",
            "address": "1987 Gibbs Dr",
            "city": "Ball Ground",
            "state": "GA",
            "zip": "30107",
            "lat": 34.3505,
            "lng": -84.3762,
            "website": "https://www.gibbsgardens.com/",
            "venue_type": "garden",
            "short_description": (
                "300-acre private botanical garden with one of America's largest "
                "daffodil displays and an award-winning Japanese Garden."
            ),
            "description": (
                "Gibbs Gardens is a 300-acre private estate garden with themed display "
                "areas. Known nationally for its massive daffodil season (one of the "
                "largest displays in the US), an award-winning Japanese Garden, and "
                "seasonal wildflower meadows. $22/person admission."
            ),
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "halfday",
            "destination_type": "nature_center",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 65,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["dry-weather", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": True,
            "fee_note": "$22/person",
        },
    ),
    (
        {
            "name": "Callaway Gardens",
            "slug": "callaway-gardens",
            "address": "17800 US-27",
            "city": "Pine Mountain",
            "state": "GA",
            "zip": "31822",
            "lat": 32.8421,
            "lng": -84.8534,
            "website": "https://www.callawaygardens.com/",
            "venue_type": "park",
            "short_description": (
                "2,500-acre resort with formal gardens, butterfly center, beach, and "
                "miles of nature trails southwest of Atlanta."
            ),
            "description": (
                "Callaway Gardens is a 2,500-acre resort and garden complex featuring "
                "the Cecil B. Day Butterfly Center, formal display gardens, Robin Lake "
                "Beach, and extensive walking trails. Azalea and holly collections are "
                "nationally significant. Resort lodging available."
            ),
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "fullday",
            "destination_type": "nature_center",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 75,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["dry-weather", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$20/adult admission",
        },
    ),
    (
        {
            "name": "Mercier Orchards",
            "slug": "mercier-orchards",
            "address": "8660 Blue Ridge Dr",
            "city": "Blue Ridge",
            "state": "GA",
            "zip": "30513",
            "lat": 34.8275,
            "lng": -84.2964,
            "website": "https://www.mercier-orchards.com/",
            "venue_type": "park",
            "short_description": (
                "North Georgia's largest apple orchard with u-pick fruit, massive "
                "market, cider house, and mountain views."
            ),
            "description": (
                "Mercier Orchards is North Georgia's largest apple orchard and one of "
                "the top agritourism destinations in the state. U-pick apples in fall, "
                "peaches in summer. Massive market with fresh cider, baked goods, and "
                "local goods. Cider house with hard cider and wine."
            ),
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "fullday",
            "destination_type": "farm",
            "primary_activity": "agritourism",
            "difficulty_level": "easy",
            "drive_time_minutes": 105,
            "best_seasons": ["summer", "fall"],
            "weather_fit_tags": ["dry-weather", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Rocktown Bouldering Area",
            "slug": "rocktown-bouldering",
            "address": "Pigeon Mountain WMA Rd",
            "city": "LaFayette",
            "state": "GA",
            "zip": "30728",
            "lat": 34.6603,
            "lng": -85.3698,
            "website": "https://www.seclimbers.org/project/rocktown/",
            "venue_type": "park",
            "short_description": (
                "One of the Southeast's best bouldering areas with sandstone problems "
                "on Pigeon Mountain in Walker County."
            ),
            "description": (
                "Rocktown is widely considered one of the best bouldering destinations "
                "in the southeastern United States. Sandstone boulders on Pigeon "
                "Mountain WMA offer slopers, crimps, huecos, and committing top-outs. "
                "Hunting/fishing license required to access the WMA."
            ),
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": [],
            "active": True,
        },
        {
            "commitment_tier": "fullday",
            "destination_type": "climbing_area",
            "primary_activity": "climbing",
            "difficulty_level": "hard",
            "drive_time_minutes": 100,
            "best_seasons": ["fall", "winter", "spring"],
            "weather_fit_tags": ["dry-weather", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "no",
            "reservation_required": False,
            "permit_required": True,
            "fee_note": "GA hunting/fishing license required for WMA access",
        },
    ),
    (
        {
            "name": "Lake Winfield Scott",
            "slug": "lake-winfield-scott",
            "address": "236 Lake Winfield Scott Rd",
            "city": "Suches",
            "state": "GA",
            "zip": "30572",
            "lat": 34.7313,
            "lng": -83.9956,
            "website": (
                "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10530"
            ),
            "venue_type": "park",
            "short_description": (
                "Quiet 18-acre mountain lake with camping and Appalachian Trail "
                "access via Jarrard Gap Trail."
            ),
            "description": (
                "Lake Winfield Scott is a hidden gem — an 18-acre mountain lake with "
                "18 campsites, a 4-mile lake loop trail, and direct access to the "
                "Appalachian Trail via Jarrard Gap Trail. Far quieter than most North "
                "Georgia campgrounds. Feels more remote than its drive time suggests."
            ),
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": [],
            "active": True,
        },
        {
            "commitment_tier": "weekend",
            "destination_type": "lake",
            "primary_activity": "camping_base",
            "difficulty_level": "easy",
            "drive_time_minutes": 100,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["cool-weather", "all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$10/night campsite",
        },
    ),
    (
        {
            "name": "State Botanical Garden of Georgia",
            "slug": "state-botanical-garden-georgia",
            "address": "2450 S Milledge Ave",
            "city": "Athens",
            "state": "GA",
            "zip": "30605",
            "lat": 33.9010,
            "lng": -83.3855,
            "website": "https://botgarden.uga.edu/",
            "venue_type": "garden",
            "short_description": (
                "313-acre botanical garden on the UGA campus with 5 miles of nature "
                "trails and themed display gardens."
            ),
            "description": (
                "The State Botanical Garden of Georgia spans 313 acres on the "
                "University of Georgia campus. Five miles of nature trails wind "
                "through native forest, themed display gardens, a conservatory, and "
                "a children's garden. Free admission with year-round programming."
            ),
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
            "active": True,
        },
        {
            "commitment_tier": "fullday",
            "destination_type": "nature_center",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 75,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["dry-weather", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    ),
    (
        {
            "name": "Toccoa River Tailwater",
            "slug": "toccoa-river-tailwater",
            "address": "Blue Ridge Dam Rd",
            "city": "Blue Ridge",
            "state": "GA",
            "zip": "30513",
            "lat": 34.8671,
            "lng": -84.2927,
            "website": "https://www.georgiawildtrout.com/",
            "venue_type": "park",
            "short_description": (
                "Georgia's best trout fishing on the cold-water tailrace below "
                "Lake Blue Ridge Dam."
            ),
            "description": (
                "The Toccoa River tailwater below Lake Blue Ridge Dam is considered "
                "the premier trout fishing destination in Georgia. Consistent cold "
                "water produces excellent catch rates for rainbow and brown trout. "
                "Float trips available through local outfitters. Best accessed with "
                "guide services."
            ),
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": [],
            "active": True,
        },
        {
            "commitment_tier": "fullday",
            "destination_type": "water_access",
            "primary_activity": "fishing",
            "difficulty_level": "moderate",
            "drive_time_minutes": 105,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
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
        description="Seed Yonder Wave 7 Ring 2 gap-fill destinations."
    )
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 7 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0
    details_written = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 7 Ring 2 Gap-Fill Destination Seed")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for seed, details in WAVE_7_DESTINATIONS:
        payload = build_payload(seed)
        existing = find_existing_venue(seed)

        if not existing:
            if args.apply:
                venue_id = get_or_create_venue(payload)
                upsert_venue_destination_details(venue_id, details)
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
                upsert_venue_destination_details(venue_id, details)
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
            upsert_venue_destination_details(venue_id, details)
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
