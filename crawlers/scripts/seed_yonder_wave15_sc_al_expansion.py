#!/usr/bin/env python3
"""
Seed Yonder's fifteenth destination wave — South Carolina & Alabama expansion.

South Carolina parks and Alabama's canyons, caverns, and wilderness —
completing the southern arc.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave15_sc_al_expansion.py
    python3 scripts/seed_yonder_wave15_sc_al_expansion.py --apply
    python3 scripts/seed_yonder_wave15_sc_al_expansion.py --apply --refresh-existing
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
WAVE_15_DESTINATIONS = [
    # ------------------------------------------------------------------ #
    # SOUTH CAROLINA                                                       #
    # NOTE: Table Rock State Park (Pickens SC) was already seeded in      #
    # Wave 8 under slug "table-rock-state-park". Omitted here to avoid    #
    # a duplicate record.                                                  #
    # ------------------------------------------------------------------ #
    {
        "venue": {
            "name": "Devils Fork State Park",
            "slug": "devils-fork-state-park",
            "address": "161 Holcombe Circle",
            "city": "Salem",
            "state": "SC",
            "zip": "29676",
            "lat": 34.9607,
            "lng": -82.9237,
            "website": "https://southcarolinaparks.com/devils-fork",
            "place_type": "park",
            "short_description": "Only public access to Lake Jocassee — crystal blue mountain reservoir with kayak rentals and waterfall hikes.",
            "description": "Devils Fork State Park is the sole public gateway to Lake Jocassee, a 7,500-acre mountain reservoir with exceptional water clarity and boat-access-only waterfalls. Kayak and boat rentals are available on-site. The park also connects to the Foothills Trail for serious waterfall hiking, and lakeside camping brings people back year after year.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "clear-day"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": True,
            "fee_note": "$6/day parking; kayak rentals $50–120",
        },
    },
    {
        "venue": {
            "name": "Stumphouse Tunnel & Issaqueena Falls",
            "slug": "stumphouse-tunnel-issaqueena-falls",
            "address": "222 Stumphouse Rd",
            "city": "Walhalla",
            "state": "SC",
            "zip": "29691",
            "lat": 34.8261,
            "lng": -83.1472,
            "website": "https://www.clemson.edu/public/stumphouse/",
            "place_type": "park",
            "short_description": "Unfinished pre-Civil War railroad tunnel and adjacent 100-foot waterfall — two oddities in one short stop.",
            "description": "Stumphouse Tunnel is an unfinished antebellum railroad tunnel bored 1,617 feet into a granite mountain before the Civil War halted construction. A short walk away, Issaqueena Falls drops 100 feet over a series of cascades. Both sites are free to visit and make for a quick but genuinely unusual stop in the SC upstate.",
            "typical_duration_minutes": 90,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "landmark",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season", "after-rain"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free admission",
        },
    },
    {
        "venue": {
            "name": "Keowee-Toxaway State Park",
            "slug": "keowee-toxaway-state-park",
            "address": "108 Residence Dr",
            "city": "Sunset",
            "state": "SC",
            "zip": "29685",
            "lat": 34.9956,
            "lng": -82.8803,
            "website": "https://southcarolinaparks.com/keowee-toxaway",
            "place_type": "park",
            "short_description": "Cherokee interpretation center, lakeside trails along Lake Keowee, and a quiet escape from the more-visited SC parks.",
            "description": "Keowee-Toxaway State Park preserves the history of the Cherokee Lower Towns along the shores of Lake Keowee, with an interpretation center dedicated to the Cherokee people who called the area home. The park offers lakeside hiking trails, a primitive campground, and a cabin — far less crowded than nearby Table Rock or Caesars Head.",
            "typical_duration_minutes": 210,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["cool-weather", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free admission",
        },
    },
    {
        "venue": {
            "name": "Paris Mountain State Park",
            "slug": "paris-mountain-state-park",
            "address": "2401 State Park Rd",
            "city": "Greenville",
            "state": "SC",
            "zip": "29609",
            "lat": 34.9462,
            "lng": -82.3596,
            "website": "https://southcarolinaparks.com/paris-mountain",
            "place_type": "park",
            "short_description": "Mountain lake, swimming, and 15 miles of trails minutes from downtown Greenville — a rare urban wilderness.",
            "description": "Paris Mountain State Park sits just five miles from downtown Greenville with a mountain lake, swimming, 15 miles of trails, and a mountain bike network. The park's proximity to a thriving city makes it one of the more accessible mountain escapes in the Southeast. CCC-built facilities add to the charm.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "cool-weather"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$6/adult admission",
        },
    },
    {
        "venue": {
            "name": "Kings Mountain State Park",
            "slug": "kings-mountain-state-park",
            "address": "1277 Park Rd",
            "city": "Blacksburg",
            "state": "SC",
            "zip": "29702",
            "lat": 35.1394,
            "lng": -81.3797,
            "website": "https://southcarolinaparks.com/kings-mountain",
            "place_type": "park",
            "short_description": "Adjacent to the Revolutionary War battlefield, with a 16-mile backcountry trail and a working living history farm.",
            "description": "Kings Mountain State Park shares a border with Kings Mountain National Military Park, site of a pivotal 1780 Revolutionary War battle. The park itself offers a 16-mile backcountry trail, a living history farm with costumed interpreters, and camping. A good destination for combining outdoor recreation with American history.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["cool-weather", "dry-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free admission",
        },
    },
    {
        "venue": {
            "name": "Croft State Park",
            "slug": "croft-state-park",
            "address": "450 Croft State Park Rd",
            "city": "Spartanburg",
            "state": "SC",
            "zip": "29302",
            "lat": 34.9168,
            "lng": -81.8701,
            "website": "https://southcarolinaparks.com/croft",
            "place_type": "park",
            "short_description": "Former WWII army training camp converted into a state park with equestrian trails and Lake Craig fishing.",
            "description": "Croft State Park occupies the grounds of Camp Croft, a WWII infantry training camp. The park's 7,000 acres include 20 miles of equestrian trails (with stable facilities), hiking and mountain bike trails, and Lake Craig for fishing. The transformation from military base to public land gives it a distinctive, spacious character.",
            "typical_duration_minutes": 210,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["cool-weather", "dry-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free admission",
        },
    },
    # ------------------------------------------------------------------ #
    # ALABAMA                                                              #
    # ------------------------------------------------------------------ #
    {
        "venue": {
            "name": "Little River Canyon National Preserve",
            "slug": "little-river-canyon-national-preserve",
            "address": "4322 Little River Trail NE",
            "city": "Fort Payne",
            "state": "AL",
            "zip": "35967",
            "lat": 34.3853,
            "lng": -85.6185,
            "website": "https://www.nps.gov/liri/index.htm",
            "place_type": "park",
            "short_description": "Deepest canyon east of the Mississippi — 22-mile rim drive, multiple waterfalls, and swimming at Canyon Mouth Park.",
            "description": "Little River Canyon is one of the deepest canyons east of the Mississippi, carved by the only river in the US that flows for most of its length atop a mountain. The 22-mile Canyon Rim Drive connects overlooks, waterfalls, and swimming areas. Canyon Mouth Park at the southern end has excellent river access and flat-water swimming.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "canyon",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "after-rain", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free (National Preserve, no entrance fee)",
        },
    },
    {
        "venue": {
            "name": "Noccalula Falls Park",
            "slug": "noccalula-falls-park",
            "address": "1500 Noccalula Rd",
            "city": "Gadsden",
            "state": "AL",
            "zip": "35904",
            "lat": 34.0409,
            "lng": -86.0275,
            "website": "https://www.gadsdenal.gov/noccalula-falls-park",
            "place_type": "park",
            "short_description": "90-foot waterfall in a city park with botanical gardens, a pioneer village, and Black Creek trail gorge.",
            "description": "Noccalula Falls Park centers on a 90-foot waterfall plunging into Black Creek Gorge within city limits. Below the falls, a 2-mile gorge trail follows the creek through a dramatic rock canyon. The park also has botanical gardens, a pioneer village with living history buildings, and a campground — a full afternoon's worth of activity.",
            "typical_duration_minutes": 210,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season", "after-rain"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/adult admission",
        },
    },
    {
        "venue": {
            "name": "Dismals Canyon",
            "slug": "dismals-canyon",
            "address": "901 AL-8",
            "city": "Phil Campbell",
            "state": "AL",
            "zip": "35581",
            "lat": 34.3106,
            "lng": -87.7172,
            "website": "https://www.dismalscanyon.com/",
            "place_type": "park",
            "short_description": "National Natural Landmark with bioluminescent glowworms on night tours and a pristine sandstone canyon.",
            "description": "Dismals Canyon is a federally designated National Natural Landmark — a privately owned 85-acre sandstone canyon harboring rare Phytophthora americana plants and a population of Orfelia fultoni, tiny bioluminescent larvae known as 'dismalites.' Night tours reveal the canyon floor lit by thousands of glowing organisms. Day hikes wind past waterfalls, swimming holes, and ancient petroglyphs.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "canyon",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "caution",
            "reservation_required": True,
            "fee_note": "$10/day or $15/night tour; camping available",
        },
    },
    {
        "venue": {
            "name": "Sipsey Wilderness (Bankhead NF)",
            "slug": "sipsey-wilderness-bankhead-nf",
            "address": "1070 AL-33",
            "city": "Double Springs",
            "state": "AL",
            "zip": "35553",
            "lat": 34.2336,
            "lng": -87.3908,
            "website": "https://www.fs.usda.gov/recarea/alabama/recarea/?recid=30159",
            "place_type": "park",
            "short_description": "Largest wilderness area east of the Mississippi with 100+ waterfalls and old-growth forest in Bankhead National Forest.",
            "description": "The Sipsey Wilderness in Bankhead National Forest is the largest federally designated wilderness area east of the Mississippi River. Its canyon system contains more than 100 documented waterfalls, old-growth hardwood forest, and slot canyons with steep sandstone walls. A legitimate backcountry destination that remains largely unknown outside Alabama.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "wilderness",
            "primary_activity": "hiking",
            "difficulty_level": "hard",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["after-rain", "cool-weather", "dry-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "no",
            "reservation_required": False,
            "fee_note": "Free (National Forest)",
        },
    },
    {
        "venue": {
            "name": "Monte Sano State Park",
            "slug": "monte-sano-state-park",
            "address": "5105 Nolen Ave",
            "city": "Huntsville",
            "state": "AL",
            "zip": "35801",
            "lat": 34.7467,
            "lng": -86.5122,
            "website": "https://www.alapark.com/parks/monte-sano-state-park",
            "place_type": "park",
            "short_description": "Trails above Huntsville with a natural bridge, Japanese tea garden ruins, and sweeping valley views.",
            "description": "Monte Sano State Park sits atop a mountain overlooking Huntsville with 20 miles of trails, a natural bridge formation, and the overgrown ruins of a Japanese tea garden built in the 1920s. The park serves as the backyard wilderness for the Rocket City and connects to a regional trail network. Cabins and a campground are available.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["cool-weather", "clear-day", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free admission",
        },
    },
    {
        "venue": {
            "name": "Oak Mountain State Park",
            "slug": "oak-mountain-state-park",
            "address": "200 Terrace Dr",
            "city": "Pelham",
            "state": "AL",
            "zip": "35124",
            "lat": 33.3523,
            "lng": -86.7461,
            "website": "https://www.alapark.com/parks/oak-mountain-state-park",
            "place_type": "park",
            "short_description": "Alabama's largest state park — 50+ miles of trails, a lake, BMX track, golf, and a wildlife rescue center.",
            "description": "Oak Mountain State Park is Alabama's largest at 9,940 acres, with 50+ miles of trails including serious mountain biking, a swimming lake, BMX track, golf course, treetop adventure course, and a wildlife rescue demonstration area. Just 25 miles south of Birmingham, it handles enormous visitor volume while still offering genuine wilderness in the back sections.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "cool-weather", "clear-day"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/adult admission",
        },
    },
    {
        "venue": {
            "name": "Cathedral Caverns State Park",
            "slug": "cathedral-caverns-state-park",
            "address": "637 Cave Rd",
            "city": "Woodville",
            "state": "AL",
            "zip": "35776",
            "lat": 34.5789,
            "lng": -86.1961,
            "website": "https://www.alapark.com/parks/cathedral-caverns-state-park",
            "place_type": "park",
            "short_description": "One of the largest cave openings in the world (25 ft high, 126 ft wide) with a massive interior stalagmite forest.",
            "description": "Cathedral Caverns has one of the largest cave entrances in the world — 25 feet high and 126 feet wide — opening into a cathedral-like chamber. The 1.5-mile guided tour passes through massive stalagmite formations including 'Goliath,' one of the world's largest stalagmites at 45 feet tall and 243 feet in circumference. A genuinely awe-inspiring cave without the tourist-trap atmosphere of some commercial caves.",
            "typical_duration_minutes": 150,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "cavern",
            "primary_activity": "caving",
            "difficulty_level": "easy",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": True,
            "fee_note": "$22/adult guided tour",
        },
    },
    {
        "venue": {
            "name": "Lake Martin",
            "slug": "lake-martin-al",
            "address": "1035 Martin Dam Rd",
            "city": "Alexander City",
            "state": "AL",
            "zip": "35010",
            "lat": 32.6827,
            "lng": -85.9857,
            "website": "https://www.lakemartin.org/",
            "place_type": "park",
            "short_description": "44,000-acre lake with 750 miles of shoreline, Chimney Rock hiking trail, and Alabama's premier eagle nesting habitat.",
            "description": "Lake Martin is one of the largest man-made lakes in the US — 44,000 acres with 750 miles of shoreline and exceptionally clear water. Chimney Rock provides one of Alabama's best short hikes with panoramic lake views. The lake supports one of the Southeast's densest concentrations of nesting bald eagles. Public boat launches, marinas, and waterfront dining are available throughout.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "lake",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free public access; boat rentals vary by marina",
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
        client.table("places")
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
        description="Seed Yonder Wave 15 SC & AL expansion destinations."
    )
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 15 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0
    details_upserted = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 15 SC & AL Expansion Destination Seed")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for entry in WAVE_15_DESTINATIONS:
        venue_seed = entry["venue"]
        details = entry["details"]
        payload = build_payload(venue_seed)
        existing = find_existing_venue(venue_seed)

        venue_id = None

        if not existing:
            if args.apply:
                venue_id = get_or_create_place(payload)
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
                    client.table("places").update(updates).eq("id", existing["id"]).execute()
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
