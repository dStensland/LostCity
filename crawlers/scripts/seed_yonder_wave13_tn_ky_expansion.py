#!/usr/bin/env python3
"""
Seed Yonder's thirteenth destination wave — Tennessee state parks, waterfalls,
and Kentucky's gorges, extending the adventure radius north.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave13_tn_ky_expansion.py
    python3 scripts/seed_yonder_wave13_tn_ky_expansion.py --apply
    python3 scripts/seed_yonder_wave13_tn_ky_expansion.py --apply --refresh-existing
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
WAVE_13_DESTINATIONS = [
    # ------------------------------------------------------------------ TENNESSEE
    {
        "venue": {
            "name": "Cummins Falls State Park",
            "slug": "cummins-falls-state-park",
            "address": "390 Cummins Falls Ln",
            "city": "Cookeville",
            "state": "TN",
            "zip": "38506",
            "lat": 36.2745,
            "lng": -85.6163,
            "website": "https://tnstateparks.com/parks/cummins-falls",
            "venue_type": "park",
            "short_description": "Tennessee's 8th largest waterfall, requiring a creek scramble through a gorge to reach the swimming hole at its base.",
            "description": "Cummins Falls is Tennessee's eighth largest waterfall, tucked at the end of a gorge that demands creek crossings and scrambling to reach. The payoff is a dramatic 75-foot falls with a deep gorge swimming hole below. Access requires a permit and wading through Blackburn Fork — no casual stroll to the overlook.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "hard",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "caution",
            "reservation_required": True,
            "fee_note": "Free permit required; day-use fee may apply",
        },
    },
    {
        "venue": {
            "name": "Burgess Falls State Natural Area",
            "slug": "burgess-falls",
            "address": "4000 Burgess Falls Dr",
            "city": "Sparta",
            "state": "TN",
            "zip": "38583",
            "lat": 36.0421,
            "lng": -85.6038,
            "website": "https://tnstateparks.com/parks/burgess-falls",
            "venue_type": "park",
            "short_description": "Four cascading waterfalls along Falling Water River, culminating in a 136-foot main falls — one of TN's most scenic hikes.",
            "description": "Burgess Falls State Natural Area strings four waterfalls along the Falling Water River into a single trail. The 136-foot main falls at the canyon floor is one of the most dramatic in the state. Three miles round trip with 250 feet of descent — well-graded and suitable for most hikers.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "moderate",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "summer-friendly", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Rock Island State Park",
            "slug": "rock-island-state-park",
            "address": "82 Beach Rd",
            "city": "Rock Island",
            "state": "TN",
            "zip": "38581",
            "lat": 35.8031,
            "lng": -85.6192,
            "website": "https://tnstateparks.com/parks/rock-island",
            "venue_type": "park",
            "short_description": "Great Falls dam, Twin Falls, and the legendary Blue Hole swimming spot where the Caney Fork emerges from Collins River.",
            "description": "Rock Island State Park sits at the confluence of the Collins and Caney Fork rivers below the Great Falls dam. Twin Falls drops 30 feet through twin channels into a gorge, and the Blue Hole — a crystalline pool where the Caney Fork emerges — is one of Tennessee's most famous swimming spots. Short trails, campground, and cabin rentals.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "swimming",
            "difficulty_level": "easy",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "after-rain"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Day-use parking fee may apply",
        },
    },
    {
        "venue": {
            "name": "Big South Fork NRRA",
            "slug": "big-south-fork-nrra",
            "address": "4564 Leatherwood Ford Rd",
            "city": "Oneida",
            "state": "TN",
            "zip": "37841",
            "lat": 36.4893,
            "lng": -84.7086,
            "website": "https://www.nps.gov/biso/index.htm",
            "venue_type": "park",
            "short_description": "Massive Cumberland Plateau gorge system with natural arches, rock shelters, whitewater, and 150,000 acres of backcountry.",
            "description": "Big South Fork National River and Recreation Area protects 150,000 acres of the Cumberland Plateau, carved by the Big South Fork of the Cumberland River. Dramatic sandstone bluffs, natural arches, rock shelters with petroglyphs, Class III-IV whitewater, and serious multi-day backpacking. The O&W Trail and John Muir Trail traverse the gorge.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "national_park",
            "primary_activity": "hiking",
            "difficulty_level": "hard",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["cool-weather", "dry-weather", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Frozen Head State Park",
            "slug": "frozen-head-state-park",
            "address": "964 Flat Fork Rd",
            "city": "Wartburg",
            "state": "TN",
            "zip": "37887",
            "lat": 36.1131,
            "lng": -84.4421,
            "website": "https://tnstateparks.com/parks/frozen-head",
            "venue_type": "park",
            "short_description": "Remote Appalachian wilderness on the Cumberland Plateau — home of the legendary Barkley Marathons ultrarunning race.",
            "description": "Frozen Head State Park is one of Tennessee's most remote and rugged parks, covering 24,000 acres of old-growth forest and Appalachian peaks above 3,000 feet. 75+ miles of trail range from gentle creek walks to the grueling ascent of Frozen Head summit. Famous globally as the inspiration for and home of the Barkley Marathons, the nearly impossible ultramarathon race.",
            "typical_duration_minutes": 420,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "hard",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["cool-weather", "leaf-season", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "South Cumberland State Park (Fiery Gizzard)",
            "slug": "south-cumberland-fiery-gizzard",
            "address": "11745 US-41",
            "city": "Monteagle",
            "state": "TN",
            "zip": "37356",
            "lat": 35.2215,
            "lng": -85.8271,
            "website": "https://tnstateparks.com/parks/south-cumberland",
            "venue_type": "park",
            "short_description": "Fiery Gizzard Trail — consistently ranked among the best day hikes in the Southeast — through 12 miles of canyon and waterfalls.",
            "description": "South Cumberland State Park spans 35,000 acres across the Cumberland Plateau, but the Fiery Gizzard Trail is the headline. The 12-mile point-to-point route through Grundy Forest drops into a gorge with waterfalls, slot canyons, massive boulders, and an otherworldly rock shelter called the Blue Hole. Widely considered one of the five best hikes in the Southeast.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "hard",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["cool-weather", "dry-weather", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "no",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Cades Cove",
            "slug": "cades-cove-gsmnp",
            "address": "Cades Cove Loop Rd",
            "city": "Townsend",
            "state": "TN",
            "zip": "37882",
            "lat": 35.5967,
            "lng": -83.8391,
            "website": "https://www.nps.gov/grsm/planyourvisit/cadescove.htm",
            "venue_type": "park",
            "short_description": "11-mile scenic loop through a historic Appalachian valley in the Smokies — the best wildlife viewing in the eastern US.",
            "description": "Cades Cove is an 11-mile one-way loop through a broad valley in Great Smoky Mountains National Park, surrounded by preserved 19th-century homesteads, mills, and churches. The best place in the eastern US to reliably spot black bears, white-tailed deer, wild turkey, and coyotes. The loop is open to bicycles Wednesday and Saturday mornings before noon.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "national_park",
            "primary_activity": "wildlife_viewing",
            "difficulty_level": "easy",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season", "all-season"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "GSMNP is free; no entrance fee",
        },
    },
    {
        "venue": {
            "name": "Roan Mountain State Park",
            "slug": "roan-mountain-state-park",
            "address": "1015 TN-143",
            "city": "Roan Mountain",
            "state": "TN",
            "zip": "37687",
            "lat": 36.1756,
            "lng": -82.0793,
            "website": "https://tnstateparks.com/parks/roan-mountain",
            "venue_type": "park",
            "short_description": "Grassy balds above 6,000 feet with the world's largest natural rhododendron gardens, Appalachian Trail access, and summit views.",
            "description": "Roan Mountain reaches 6,286 feet with expansive grassy balds and the world's largest natural rhododendron garden (600+ acres), which peaks in mid-June with a crimson bloom visible for miles. The Appalachian Trail runs along the ridge. State park below offers cabins, campground, and cultural programs. Spectacular in every season.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 240,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Norris Dam State Park",
            "slug": "norris-dam-state-park",
            "address": "125 Village Green Cir",
            "city": "Rocky Top",
            "state": "TN",
            "zip": "37769",
            "lat": 36.2100,
            "lng": -84.0893,
            "website": "https://tnstateparks.com/parks/norris-dam",
            "venue_type": "park",
            "short_description": "TVA's first dam, clear mountain biking trails through ridge country, and clean lake swimming — an underrated weekend escape.",
            "description": "Norris Dam State Park surrounds TVA's first major dam, built in 1936. The reservoir is famously clear and clean for swimming and paddling, and the park's 34 miles of trails are some of the best maintained in the Tennessee state park system. Mountain biking trails, campground, and the restored historical Lenoir Museum make for a full day.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    # ------------------------------------------------------------------ KENTUCKY
    {
        "venue": {
            "name": "Cumberland Falls State Resort Park",
            "slug": "cumberland-falls-state-park",
            "address": "7351 KY-90",
            "city": "Corbin",
            "state": "KY",
            "zip": "40701",
            "lat": 36.8380,
            "lng": -84.3399,
            "website": "https://parks.ky.gov/corbin/parks/resort/cumberland-falls-state-resort-park",
            "venue_type": "park",
            "short_description": "The 'Niagara of the South' and the only moonbow in the Western Hemisphere — a 125-foot curtain of falls on the Cumberland River.",
            "description": "Cumberland Falls drops 125 feet in a 68-foot-wide curtain across the Cumberland River — the largest waterfall in the eastern United States south of Niagara. On full-moon nights it produces the only moonbow in the Western Hemisphere: a rainbow formed by moonlight through the mist. The state resort park has a lodge, cabins, and multiple hiking trails.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "state_park",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 240,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["after-rain", "all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Natural Bridge State Resort Park",
            "slug": "natural-bridge-state-park",
            "address": "2135 Natural Bridge Rd",
            "city": "Slade",
            "state": "KY",
            "zip": "40376",
            "lat": 37.7761,
            "lng": -83.6779,
            "website": "https://parks.ky.gov/slade/parks/resort/natural-bridge-state-resort-park",
            "venue_type": "park",
            "short_description": "65-foot natural sandstone arch accessible by trail or sky lift, gateway to the Red River Gorge geological area.",
            "description": "Natural Bridge is a 65-foot natural sandstone arch formed by 70 million years of erosion in the Daniel Boone National Forest. A sky lift or moderate 2-mile trail reaches the arch. The state resort park serves as the southern gateway to the Red River Gorge and offers a lodge, cottages, and a pool. The whole area has world-class climbing, arches, and backcountry.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 240,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season", "cool-weather"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Sky lift fee ~$12; park admission free",
        },
    },
    {
        "venue": {
            "name": "Red River Gorge",
            "slug": "red-river-gorge",
            "address": "3451 Sky Bridge Rd",
            "city": "Slade",
            "state": "KY",
            "zip": "40376",
            "lat": 37.8110,
            "lng": -83.6827,
            "website": "https://www.fs.usda.gov/recarea/dbnf/recarea/?recid=39458",
            "venue_type": "park",
            "short_description": "World-class sport climbing with 3,000+ routes, natural arches, and sandstone towers in the Daniel Boone National Forest.",
            "description": "The Red River Gorge Geological Area in Daniel Boone National Forest is one of the premier rock climbing destinations in the world, with 3,000+ sport climbing routes on overhanging sandstone cliffs. Beyond climbing, the gorge has 100+ miles of trail, 100+ natural arches including Gray's Arch and Sky Bridge, and primitive camping throughout. A weekend getaway with serious depth.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "national_forest",
            "primary_activity": "climbing",
            "difficulty_level": "hard",
            "drive_time_minutes": 240,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["dry-weather", "cool-weather", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Clifty Wilderness (Daniel Boone NF)",
            "slug": "clifty-wilderness-daniel-boone",
            "address": "1700 Bypass Rd",
            "city": "Winchester",
            "state": "KY",
            "zip": "40391",
            "lat": 37.5281,
            "lng": -83.7964,
            "website": "https://www.fs.usda.gov/recarea/dbnf/recarea/?recid=39561",
            "venue_type": "park",
            "short_description": "Remote designated Wilderness in Daniel Boone NF with deep hemlock gorges, waterfalls, and no maintained trails — true backcountry.",
            "description": "Clifty Wilderness is a 13,000-acre designated Wilderness in the Daniel Boone National Forest, characterized by deep gorges, hemlock-lined creek drainages, and layered sandstone formations. There are no maintained trails — navigation is by map and compass. Waterfalls appear throughout the drainages in wet seasons. One of the most truly remote experiences accessible from Atlanta.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "wilderness",
            "primary_activity": "hiking",
            "difficulty_level": "hard",
            "drive_time_minutes": 240,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["cool-weather", "dry-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "no",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Watauga Lake",
            "slug": "watauga-lake",
            "address": "1167 Watauga Dam Rd",
            "city": "Hampton",
            "state": "TN",
            "zip": "37658",
            "lat": 36.1697,
            "lng": -82.0533,
            "website": "https://www.tva.com/energy/our-power-system/hydroelectric/watauga-dam-and-reservoir",
            "venue_type": "park",
            "short_description": "Consistently ranked the cleanest lake in Tennessee, surrounded by Cherokee NF — cliff jumping and crystal-clear swimming.",
            "description": "Watauga Lake is consistently measured as the cleanest lake in Tennessee, with exceptional clarity from its position entirely within Cherokee National Forest. At 6,430 acres and 900 feet elevation, the water stays cold even in summer. Popular for cliff jumping, kayaking, and primitive camping. The Iron Mountain trail system above provides serious ridge hiking.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "lake",
            "primary_activity": "swimming",
            "difficulty_level": "easy",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Dale Hollow Lake",
            "slug": "dale-hollow-lake",
            "address": "5050 Dale Hollow Dam Rd",
            "city": "Celina",
            "state": "TN",
            "zip": "38551",
            "lat": 36.5397,
            "lng": -85.4524,
            "website": "https://www.recreation.gov/camping/gateways/2627",
            "venue_type": "park",
            "short_description": "Record-breaking smallmouth bass fishing, pristine Tennessee Highland Rim water, and houseboat rentals in a quiet TVA lake.",
            "description": "Dale Hollow Lake holds the world-record smallmouth bass catch (11 lbs 15 oz, 1955) and is one of the premier bass fishing lakes in the United States. The 27,700-acre TVA reservoir on the Tennessee-Kentucky border has exceptional water clarity and a quiet, unhurried character rare for lakes this size. Houseboat rentals, marinas, and primitive camping on federal land throughout.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "lake",
            "primary_activity": "fishing",
            "difficulty_level": "easy",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Camping fees vary by site; fishing license required",
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
        description="Seed Yonder Wave 13 Tennessee & Kentucky expansion destinations."
    )
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 13 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0
    details_upserted = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 13 Tennessee & Kentucky Expansion Destination Seed")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for entry in WAVE_13_DESTINATIONS:
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
