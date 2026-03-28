#!/usr/bin/env python3
"""
Seed Yonder's sixteenth destination wave — Research Gaps.

Fills remaining coverage gaps across MTB trails, waterfalls, rivers,
agritourism, disc golf, and remote state parks across GA, TN, NC, and SC.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave16_research_gaps.py
    python3 scripts/seed_yonder_wave16_research_gaps.py --apply
    python3 scripts/seed_yonder_wave16_research_gaps.py --apply --refresh-existing
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
WAVE_16_DESTINATIONS = [
    # ------------------------------------------------------------------ #
    # GEORGIA WATERFALLS                                                   #
    # ------------------------------------------------------------------ #
    {
        "venue": {
            "name": "High Shoals Falls & Blue Hole Falls",
            "slug": "high-shoals-blue-hole-falls",
            "address": "High Shoals Scenic Area, GA-180",
            "city": "Hiawassee",
            "state": "GA",
            "zip": "30546",
            "lat": 34.8478,
            "lng": -83.9512,
            "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10618",
            "venue_type": "trail",
            "short_description": "Two waterfalls on one 2.8-mile loop — Blue Hole has a swimming hole fed by a 100-foot cascade.",
            "description": "High Shoals Scenic Area in Chattahoochee National Forest delivers two waterfalls on a single 2.8-mile loop trail off GA-180 near Hiawassee. High Shoals Falls drops 100 feet in tiers; Blue Hole Falls spills into a wide, swimmable pool. Best visited after spring rains or in early summer before the swimming crowds arrive.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "moderate",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free USFS day-use",
        },
    },
    {
        "venue": {
            "name": "Long Creek Falls (Three Forks)",
            "slug": "long-creek-falls-three-forks",
            "address": "Three Forks Trailhead, FS-58",
            "city": "Dahlonega",
            "state": "GA",
            "zip": "30533",
            "lat": 34.6623,
            "lng": -83.9981,
            "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10593",
            "venue_type": "trail",
            "short_description": "Broad curtain waterfall at the Appalachian Trail's Three Forks junction, 2 miles round trip with swimming hole.",
            "description": "Long Creek Falls sits at Three Forks, the confluence of three Appalachian Trail branches near Dahlonega. The broad curtain waterfall drops into a wide swimming hole just 1 mile from the trailhead. One of north Georgia's most accessible waterfall swims — popular with AT thru-hikers and day trippers alike.",
            "typical_duration_minutes": 150,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free",
        },
    },
    # ------------------------------------------------------------------ #
    # GEORGIA STATE PARKS                                                  #
    # ------------------------------------------------------------------ #
    {
        "venue": {
            "name": "Smithgall Woods State Park",
            "slug": "smithgall-woods-state-park",
            "address": "61 Tsalaki Trail",
            "city": "Helen",
            "state": "GA",
            "zip": "30545",
            "lat": 34.7204,
            "lng": -83.8441,
            "website": "https://gastateparks.org/SmithgallWoods",
            "venue_type": "park",
            "short_description": "Fly-fishing-only Duke's Creek reserve with guided nature walks, cottages, and restricted-access old-growth forest.",
            "description": "Smithgall Woods is Georgia's premier conservation park — 5,600 acres of old-growth forest protecting Duke's Creek, a trophy fly-fishing trout stream with controlled access limited to a few rods per day. The park offers guided walks, cottages, and a rare chance to experience north Georgia at low-impact scale. Reservations essential.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "fishing",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["cool-weather", "dry-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": True,
            "fee_note": "$5/vehicle day-use; fishing access requires advance reservation",
        },
    },
    {
        "venue": {
            "name": "Moccasin Creek State Park",
            "slug": "moccasin-creek-state-park",
            "address": "3655 GA-197",
            "city": "Clarkesville",
            "state": "GA",
            "zip": "30523",
            "lat": 34.8735,
            "lng": -83.5882,
            "website": "https://gastateparks.org/MoccasinCreek",
            "venue_type": "park",
            "short_description": "Small lakeside park on Lake Burton — hemlock forest, trout fishing stream, and easy canoe access.",
            "description": "Moccasin Creek State Park sits on the shores of Lake Burton in a hemlock-shaded cove. The park's trout-stocked creek is open year-round to anglers; a boat ramp gives quick access to Lake Burton's 2,775 acres. Compact and peaceful, it makes a great base camp for exploring the surrounding Rabun County mountains.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "fishing",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle day-use",
        },
    },
    {
        "venue": {
            "name": "George L. Smith State Park",
            "slug": "george-l-smith-state-park",
            "address": "371 George L Smith State Park Rd",
            "city": "Twin City",
            "state": "GA",
            "zip": "30471",
            "lat": 32.5618,
            "lng": -82.1528,
            "website": "https://gastateparks.org/GeorgeLSmith",
            "venue_type": "park",
            "short_description": "Cypress-draped mill pond with a covered bridge, tupelo swamp paddling, and Georgia's most picturesque kayak trail.",
            "description": "George L. Smith State Park protects a stunning cypress-tupelo mill pond in southeast Georgia, ringed by a covered bridge and grist mill dating to 1880. The kayak trail winds through flooded tupelo forest — an experience unlike anything in the mountains. Fishing, camping, and cabin rentals round out an underrated full-day destination.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["cool-weather", "dry-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle day-use; kayak rentals available",
        },
    },
    {
        "venue": {
            "name": "Indian Springs State Park",
            "slug": "indian-springs-state-park",
            "address": "678 Lake Clark Rd",
            "city": "Flovilla",
            "state": "GA",
            "zip": "30216",
            "lat": 33.2404,
            "lng": -83.9645,
            "website": "https://gastateparks.org/IndianSprings",
            "venue_type": "park",
            "short_description": "One of the oldest state parks in the US — historic mineral springs, fishing lake, and CCC-era cottages an hour from Atlanta.",
            "description": "Indian Springs State Park claims to be the oldest state park in the US, with records of mineral spring use by Creek Nation dating to the 1820s. The iron-sulfur springs still flow on-site. Lake McIntosh offers fishing and paddleboats; CCC-built cottages and a campground make it a quick family getaway from Atlanta.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 60,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle day-use",
        },
    },
    {
        "venue": {
            "name": "Magnolia Springs State Park",
            "slug": "magnolia-springs-state-park",
            "address": "1053 Magnolia Springs Dr",
            "city": "Millen",
            "state": "GA",
            "zip": "30442",
            "lat": 32.8740,
            "lng": -81.9642,
            "website": "https://gastateparks.org/MagnoliaSpringsBo-GinnNationalFishHatchery",
            "venue_type": "park",
            "short_description": "Crystal-clear spring producing 7 million gallons daily, native aquarium, and Civil War POW site in coastal Georgia.",
            "description": "Magnolia Springs State Park centers on a crystal-clear artesian spring that produces 7 million gallons of 68-degree water per day. The Bo Ginn National Fish Hatchery and Aquarium (free, on-site) displays native Georgia fish. The park was the site of Camp Lawton, a Civil War POW camp larger than Andersonville — interpretive trail explores the history.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle day-use",
        },
    },
    # ------------------------------------------------------------------ #
    # GEORGIA LAKES                                                        #
    # ------------------------------------------------------------------ #
    {
        "venue": {
            "name": "Lake Nottely",
            "slug": "lake-nottely",
            "address": "1225 Nottely Dam Rd",
            "city": "Blairsville",
            "state": "GA",
            "zip": "30512",
            "lat": 34.9235,
            "lng": -84.0578,
            "website": "https://www.tva.com/energy/lake-levels-and-recreation/lake-nottely",
            "venue_type": "park",
            "short_description": "TVA mountain lake with 106 miles of shoreline, a public swimming beach, marina, and Blue Ridge backdrop.",
            "description": "Lake Nottely is a 4,180-acre TVA reservoir ringed by the Blue Ridge Mountains near Blairsville. The lake offers 106 miles of shoreline, a public swimming beach, marina with boat rentals, and some of north Georgia's most scenic on-water views. The surrounding Union County has low crowds compared to Lake Blue Ridge.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "lake",
            "primary_activity": "swimming",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free public beach; boat rentals at marina",
        },
    },
    {
        "venue": {
            "name": "Lake Chatuge",
            "slug": "lake-chatuge",
            "address": "US-76, Towns County",
            "city": "Hiawassee",
            "state": "GA",
            "zip": "30546",
            "lat": 34.9571,
            "lng": -83.7635,
            "website": "https://www.tva.com/energy/lake-levels-and-recreation/lake-chatuge",
            "venue_type": "park",
            "short_description": "Mountain lake straddling the GA-NC border — sailing, paddling, and panoramic Blue Ridge views.",
            "description": "Lake Chatuge straddles the Georgia-North Carolina border at 1,900 feet elevation, surrounded by the Blue Ridge Mountains. The 7,050-acre TVA reservoir is popular with sailors due to consistent winds and clean water. Georgia Mountain Fairgrounds sits on its shore; hiking and paddling access points throughout Towns County.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "lake",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free public access; boat ramps available",
        },
    },
    # ------------------------------------------------------------------ #
    # GEORGIA RIVERS / PADDLING                                            #
    # ------------------------------------------------------------------ #
    {
        "venue": {
            "name": "Cartecay River",
            "slug": "cartecay-river",
            "address": "GA-52, Gilmer County",
            "city": "Ellijay",
            "state": "GA",
            "zip": "30540",
            "lat": 34.6793,
            "lng": -84.5431,
            "website": "https://www.cartecayrivertubing.com/",
            "venue_type": "park",
            "short_description": "Popular Class I-II tubing and kayaking river through apple country with multiple outfitters on Hwy 52.",
            "description": "The Cartecay River flows through the apple orchards of Gilmer County, providing one of north Georgia's most enjoyable Class I-II float experiences. Multiple outfitters along GA-52 rent tubes, kayaks, and canoes. The river runs best spring through early fall; tubing season peaks Memorial Day through Labor Day.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "river",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "summer"],
            "weather_fit_tags": ["summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$15-30 tube/kayak rental",
        },
    },
    {
        "venue": {
            "name": "Broad River Outpost",
            "slug": "broad-river-outpost",
            "address": "5 Broad River Outpost Rd",
            "city": "Danielsville",
            "state": "GA",
            "zip": "30633",
            "lat": 34.1968,
            "lng": -83.2901,
            "website": "https://broadriveroutpost.com/",
            "venue_type": "park",
            "short_description": "Guided kayak and canoe trips on a calm Class I river with camping available — 1.5 hours from Atlanta.",
            "description": "Broad River Outpost on the North Fork Broad River offers guided kayak and canoe trips through gentle Class I water in Madison County. The outpost rents equipment and provides shuttle service. Primitive riverside camping is available for those who want to stay overnight. One of the closest calm paddling destinations to Atlanta.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "river",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$25-40 kayak/canoe rental with shuttle",
        },
    },
    # ------------------------------------------------------------------ #
    # GEORGIA MTB                                                          #
    # ------------------------------------------------------------------ #
    {
        "venue": {
            "name": "Harbins Park (MTB)",
            "slug": "harbins-park-mtb",
            "address": "3720 Harbins Rd",
            "city": "Dacula",
            "state": "GA",
            "zip": "30019",
            "lat": 33.9848,
            "lng": -83.9131,
            "website": "https://www.gwinnettcounty.com/web/gwinnett/departments/communityservices/parks/regionalparks/harbinspark",
            "venue_type": "trail",
            "short_description": "SORBA-maintained singletrack and flow trails in Gwinnett County — the best MTB within 45 minutes of Atlanta.",
            "description": "Harbins Regional Park is Gwinnett County's premier mountain biking destination, with SORBA-maintained singletrack and purpose-built flow trails through wooded terrain. The trail system spans multiple difficulty levels from beginner-friendly doubletrack to technical singletrack. At 45 minutes from Atlanta, it's the closest quality MTB on the northeast side of the city.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "trail",
            "primary_activity": "mountain_biking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 45,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["dry-weather", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
            "fee_note": "Free",
        },
    },
    {
        "venue": {
            "name": "Chicopee Woods (MTB)",
            "slug": "chicopee-woods-mtb",
            "address": "2259 Calvary Church Rd",
            "city": "Gainesville",
            "state": "GA",
            "zip": "30507",
            "lat": 34.2710,
            "lng": -83.8482,
            "website": "https://www.gainesville.org/839/Chicopee-Woods-Area-Park",
            "venue_type": "trail",
            "short_description": "NE Georgia SORBA singletrack through hardwood forest — diverse terrain 1 hour from Atlanta.",
            "description": "Chicopee Woods Area Park in Gainesville offers one of northeast Georgia's best mountain biking experiences — SORBA-maintained singletrack through mature hardwood forest with varied terrain. The trail system combines flow trails with rooty technical sections. Close proximity to Lake Lanier makes it a natural pairing for a full day out.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "trail",
            "primary_activity": "mountain_biking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 60,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["dry-weather", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
            "fee_note": "Free",
        },
    },
    # ------------------------------------------------------------------ #
    # GEORGIA SPECIAL INTEREST                                             #
    # ------------------------------------------------------------------ #
    {
        "venue": {
            "name": "International Disc Golf Center",
            "slug": "international-disc-golf-center",
            "address": "3828 Dogwood Dr",
            "city": "Appling",
            "state": "GA",
            "zip": "30802",
            "lat": 33.5468,
            "lng": -82.3162,
            "website": "https://www.pdga.com/disc-golf-information/international-disc-golf-center",
            "venue_type": "park",
            "short_description": "PDGA world headquarters with 3 championship courses, the Hall of Fame museum, and the sport's origin story.",
            "description": "The International Disc Golf Center in Appling, Georgia, is the global home of disc golf — PDGA world headquarters, Hall of Fame museum, and three championship-caliber courses on one property. Annual pro events are held here. The on-site museum traces the sport from its Frisbee roots to today. A pilgrimage destination for serious disc golfers.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "nature_center",
            "primary_activity": "disc_golf",
            "difficulty_level": "moderate",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["dry-weather", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Course fees vary; museum free",
        },
    },
    {
        "venue": {
            "name": "Jaemor Farms",
            "slug": "jaemor-farms",
            "address": "4530 Level Grove Rd",
            "city": "Alto",
            "state": "GA",
            "zip": "30510",
            "lat": 34.4779,
            "lng": -83.5673,
            "website": "https://jaemorfarms.com/",
            "venue_type": "farm",
            "short_description": "500-acre family farm in the north Georgia foothills — u-pick fruit, corn maze, pumpkin patch, and farm market.",
            "description": "Jaemor Farms is a 500-acre working farm in Hall County known for peaches, apples, strawberries, and a sprawling fall corn maze. The farm stand carries seasonal produce and Georgia goods year-round. Spring strawberry picking and fall pumpkin patches draw families from across metro Atlanta. One of the closest true agritourism destinations to the city.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "farm",
            "primary_activity": "agritourism",
            "difficulty_level": "easy",
            "drive_time_minutes": 60,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free entry; u-pick priced by weight",
        },
    },
    # ------------------------------------------------------------------ #
    # TENNESSEE                                                            #
    # ------------------------------------------------------------------ #
    {
        "venue": {
            "name": "Foster Falls",
            "slug": "foster-falls",
            "address": "498 Foster Falls Rd",
            "city": "Sequatchie",
            "state": "TN",
            "zip": "37374",
            "lat": 35.2008,
            "lng": -85.6628,
            "website": "https://tnstateparks.com/parks/south-cumberland",
            "venue_type": "park",
            "short_description": "60-foot waterfall into a swimming hole at the base of the South Cumberland Plateau — 2.5 hours from Atlanta.",
            "description": "Foster Falls is one of the signature destinations in South Cumberland State Park — a 60-foot plunge waterfall into a wide swimming hole at the edge of the plateau. The trail descends into the gorge past rock climbing walls that attract Southeast climbers. Part of the South Cumberland complex, it combines well with Greeter Falls for a full day.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "moderate",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free",
        },
    },
    {
        "venue": {
            "name": "Greeter Falls",
            "slug": "greeter-falls",
            "address": "Greeter Falls Rd",
            "city": "Altamont",
            "state": "TN",
            "zip": "37301",
            "lat": 35.4412,
            "lng": -85.7103,
            "website": "https://tnstateparks.com/parks/south-cumberland",
            "venue_type": "park",
            "short_description": "Double waterfall loop in South Cumberland SP with a Blue Hole swimming area — one of Tennessee's best family hikes.",
            "description": "Greeter Falls delivers two distinct waterfalls — Upper Greeter and Lower Greeter — on a 3-mile loop trail in South Cumberland State Park. The Blue Hole at the base of Lower Greeter is a classic Tennessee swimming spot. Part of the South Cumberland complex near Altamont, it pairs well with Foster Falls for a full South Cumberland day.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free",
        },
    },
    {
        "venue": {
            "name": "Ozone Falls",
            "slug": "ozone-falls",
            "address": "Ozone Falls State Natural Area, TN-299",
            "city": "Crossville",
            "state": "TN",
            "zip": "38572",
            "lat": 35.8648,
            "lng": -84.9063,
            "website": "https://tnstateparks.com/parks/ozone-falls",
            "venue_type": "park",
            "short_description": "110-foot freefall waterfall visible from a trail overlook — easy 10-minute walk from the parking area.",
            "description": "Ozone Falls is a 110-foot freefall waterfall in a small state natural area near Crossville. The overlook trail is just 0.2 miles from the parking area, making it one of the most accessible high-impact waterfalls in Tennessee. A steeper path descends to the base pool. Quick enough to pair with other Cumberland Plateau stops.",
            "typical_duration_minutes": 60,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free",
        },
    },
    {
        "venue": {
            "name": "Obed Wild & Scenic River",
            "slug": "obed-wild-scenic-river",
            "address": "208 N Maiden St",
            "city": "Wartburg",
            "state": "TN",
            "zip": "37887",
            "lat": 36.1028,
            "lng": -84.5919,
            "website": "https://www.nps.gov/obed/index.htm",
            "venue_type": "park",
            "short_description": "NPS-protected gorge with world-class sandstone climbing, technical whitewater, and deep swimming holes.",
            "description": "The Obed Wild & Scenic River is a National Park Service site protecting one of the Southeast's premier outdoor recreation gorges. The Obed, Clear Creek, and Daddy's Creek cut 500-foot sandstone canyons with world-class trad climbing, Class III-IV whitewater, and deep emerald swimming holes. A genuine multi-sport destination that consistently surprises first-time visitors.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "climbing_area",
            "primary_activity": "rock_climbing",
            "difficulty_level": "hard",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["dry-weather", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
            "fee_note": "Free NPS day-use",
        },
    },
    {
        "venue": {
            "name": "Nolichucky River Gorge",
            "slug": "nolichucky-river-gorge",
            "address": "US-19E, Unicoi County",
            "city": "Erwin",
            "state": "TN",
            "zip": "37650",
            "lat": 36.1495,
            "lng": -82.4265,
            "website": "https://noc.com/nolichucky-river-rafting/",
            "venue_type": "park",
            "short_description": "Deepest gorge in the eastern US — Class III-IV whitewater through a remote 1,000-foot canyon in northeast Tennessee.",
            "description": "The Nolichucky River cuts the deepest gorge in the eastern United States — over 1,000 feet of canyon walls dropping to a Class III-IV whitewater run accessible only by raft or kayak. NOC and local outfitters run full-day guided trips through 8 miles of river that feels genuinely remote. One of the Southeast's most spectacular water experiences.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "river",
            "primary_activity": "rafting",
            "difficulty_level": "hard",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "after-rain"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "no",
            "reservation_required": True,
            "fee_note": "$85-120/person with outfitter",
        },
    },
    {
        "venue": {
            "name": "Hillcrest Orchards",
            "slug": "hillcrest-orchards",
            "address": "9696 GA-52 E",
            "city": "Ellijay",
            "state": "GA",
            "zip": "30536",
            "lat": 34.6981,
            "lng": -84.4232,
            "website": "https://www.hillcrestorchards.net/",
            "venue_type": "farm",
            "short_description": "Apple picking capital of Georgia — u-pick orchards, corn maze, hayrides, and live music on fall weekends.",
            "description": "Hillcrest Orchards is one of the flagship agritourism destinations in Ellijay, Georgia's apple country. The fall season runs September through November with u-pick apple orchards, a multi-acre corn maze, hayrides, and live music on weekends. The roadside market sells apple cider, fried apple pies, and local preserves. Peak season weekends draw significant crowds.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "farm",
            "primary_activity": "agritourism",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["fall"],
            "weather_fit_tags": ["clear-day", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free entry; u-pick and activities priced separately",
        },
    },
    # ------------------------------------------------------------------ #
    # NORTH CAROLINA                                                       #
    # ------------------------------------------------------------------ #
    {
        "venue": {
            "name": "Silver Run Falls",
            "slug": "silver-run-falls",
            "address": "NC-107, Jackson County",
            "city": "Cashiers",
            "state": "NC",
            "zip": "28717",
            "lat": 35.0657,
            "lng": -83.0715,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48965",
            "venue_type": "trail",
            "short_description": "Easy 0.2-mile walk to a wide, gorgeous waterfall with a popular swimming hole — most accessible swim in Cashiers.",
            "description": "Silver Run Falls is a 40-foot wide curtain waterfall on NC-107 south of Cashiers — just a 0.2-mile walk from the roadside pullout. The broad falls spill into a clear swimming hole that's among the most popular in the Cashiers-Highlands area. Early morning visits avoid weekend crowds. Part of Nantahala National Forest.",
            "typical_duration_minutes": 60,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "after-rain"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free",
        },
    },
    {
        "venue": {
            "name": "Rainbow Falls & Turtleback Falls",
            "slug": "rainbow-turtleback-falls",
            "address": "Gorges State Park, Frozen Creek Rd",
            "city": "Sapphire",
            "state": "NC",
            "zip": "28774",
            "lat": 35.0953,
            "lng": -82.9443,
            "website": "https://www.ncparks.gov/gorges-state-park",
            "venue_type": "trail",
            "short_description": "Two waterfalls on one trail in Gorges SP — Turtleback has a natural waterslide into a swimming hole.",
            "description": "Gorges State Park in Transylvania County delivers two waterfalls on a single out-and-back trail. Rainbow Falls drops 150 feet in a dramatic narrow plunge. Turtleback Falls just upstream is a sloped cascade with a natural rock waterslide into a swimmable pool — one of the most fun waterfall experiences in the Southeast. Moderate 4-mile roundtrip.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "moderate",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
            "fee_note": "Free NC state park",
        },
    },
    {
        "venue": {
            "name": "Courthouse Falls",
            "slug": "courthouse-falls",
            "address": "Courthouse Creek Rd, Transylvania County",
            "city": "Pisgah Forest",
            "state": "NC",
            "zip": "28768",
            "lat": 35.2516,
            "lng": -82.8974,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48957",
            "venue_type": "trail",
            "short_description": "45-foot circular waterfall in a natural amphitheater — short 0.6-mile trail in Pisgah National Forest.",
            "description": "Courthouse Falls drops 45 feet into a circular plunge pool surrounded by rock walls that form a natural amphitheater in Pisgah National Forest. The 0.6-mile trail from the forest road is short and straightforward, making it accessible despite the remote feel. Swimming in the pool is popular in summer. One of western NC's more photogenic lesser-known waterfalls.",
            "typical_duration_minutes": 90,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free USFS day-use",
        },
    },
    {
        "venue": {
            "name": "Crabtree Falls",
            "slug": "crabtree-falls-nc",
            "address": "Blue Ridge Pkwy MP 339.5",
            "city": "Spruce Pine",
            "state": "NC",
            "zip": "28777",
            "lat": 35.8108,
            "lng": -82.1476,
            "website": "https://www.nps.gov/blri/planyourvisit/waterfalls.htm",
            "venue_type": "trail",
            "short_description": "70-foot cascade along the Blue Ridge Parkway — 2.5-mile loop through old-growth hemlock and rhododendron.",
            "description": "Crabtree Falls at Blue Ridge Parkway Milepost 339.5 is a 70-foot cascade tucked into one of the BRP's most beautiful hollows. The 2.5-mile loop trail descends through old-growth hemlock and rhododendron tunnels to the base of the falls. Crabtree Meadows campground nearby makes it an easy overnight stop on a longer BRP road trip.",
            "typical_duration_minutes": 150,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "moderate",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "leaf-season", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free NPS day-use",
        },
    },
    {
        "venue": {
            "name": "Schoolhouse Falls (Panthertown Valley)",
            "slug": "schoolhouse-falls-panthertown",
            "address": "Breedlove Rd, Jackson County",
            "city": "Sapphire",
            "state": "NC",
            "zip": "28774",
            "lat": 35.1674,
            "lng": -83.0578,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48992",
            "venue_type": "trail",
            "short_description": "100-foot wide curtain waterfall in Panthertown Valley — the 'Yosemite of the East' with granite domes and swimming.",
            "description": "Schoolhouse Falls is the most accessible entry point into Panthertown Valley, nicknamed the 'Yosemite of the East' for its open granite domes and multiple waterfalls. The 100-foot wide curtain falls spill into a wide swimming hole just 1.5 miles from the Breedlove Road trailhead. The full valley network has 30+ miles of trails with waterfalls around every bend.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "moderate",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "summer-friendly", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free USFS day-use",
        },
    },
    # ------------------------------------------------------------------ #
    # SOUTH CAROLINA                                                       #
    # ------------------------------------------------------------------ #
    {
        "venue": {
            "name": "Yellow Branch Falls",
            "slug": "yellow-branch-falls",
            "address": "Yellow Branch Picnic Area, USFS Rd 715",
            "city": "Walhalla",
            "state": "SC",
            "zip": "29691",
            "lat": 34.8228,
            "lng": -83.1254,
            "website": "https://www.fs.usda.gov/recarea/scnfs/recarea/?recid=47441",
            "venue_type": "trail",
            "short_description": "50-foot waterfall at the end of a quiet 3-mile forested trail in Sumter National Forest near Walhalla.",
            "description": "Yellow Branch Falls is a 50-foot waterfall at the end of a peaceful 3-mile out-and-back trail in Sumter National Forest near Walhalla, SC. The trail follows Yellow Branch Creek through second-growth forest to the falls' wide, rocky base pool. Far less crowded than nearby Oconee State Park waterfall destinations, it rewards those who seek it out.",
            "typical_duration_minutes": 150,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["after-rain", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free USFS day-use",
        },
    },
    {
        "venue": {
            "name": "Twin Falls (Eastatoe Gorge)",
            "slug": "twin-falls-eastatoe",
            "address": "476 Cleo Chapman Hwy",
            "city": "Pickens",
            "state": "SC",
            "zip": "29671",
            "lat": 35.0834,
            "lng": -82.8121,
            "website": "https://www.theheritagepreserve.org/",
            "venue_type": "trail",
            "short_description": "Two side-by-side waterfalls in a pristine gorge on private preserve land with public trail access.",
            "description": "Twin Falls in the Eastatoe Gorge Heritage Preserve drops two side-by-side waterfalls into a shared plunge pool — a striking composition that's become one of upstate South Carolina's most-photographed natural scenes. The 2-mile round-trip trail is on protected Heritage Preserve land. The gorge is one of the most biologically diverse habitats in South Carolina.",
            "typical_duration_minutes": 150,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "moderate",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["after-rain", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
            "fee_note": "Free",
        },
    },
    {
        "venue": {
            "name": "Chattooga Belle Farm",
            "slug": "chattooga-belle-farm",
            "address": "454 Damascus Church Rd",
            "city": "Long Creek",
            "state": "SC",
            "zip": "29658",
            "lat": 34.7537,
            "lng": -83.2821,
            "website": "https://www.chattoogabellefarm.com/",
            "venue_type": "farm",
            "short_description": "Winery and farm on the Chattooga River — vineyard tours, craft beer, u-pick blueberries, and mountain views.",
            "description": "Chattooga Belle Farm is a winery and agritourism destination on the banks of the Chattooga River in Oconee County, SC. The estate produces wines and hard ciders from estate-grown fruit; vineyard tours and tastings run year-round. U-pick blueberry season runs June-July. The setting — river-adjacent with views of the Blue Ridge — is one of the more scenic in the Southeast.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "farm",
            "primary_activity": "agritourism",
            "difficulty_level": "easy",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["clear-day", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free entry; tasting fees apply",
        },
    },
    # ------------------------------------------------------------------ #
    # GEORGIA EXTRA                                                        #
    # ------------------------------------------------------------------ #
    {
        "venue": {
            "name": "Mistletoe State Park",
            "slug": "mistletoe-state-park",
            "address": "3723 Mistletoe Rd",
            "city": "Appling",
            "state": "GA",
            "zip": "30802",
            "lat": 33.7183,
            "lng": -82.3740,
            "website": "https://gastateparks.org/Mistletoe",
            "venue_type": "park",
            "short_description": "Strom Thurmond Lake shoreline park with paddling, fishing, cottage cabins, and mountain bike trails.",
            "description": "Mistletoe State Park sits on the shores of Strom Thurmond Lake (Clarks Hill Reservoir) — Georgia's largest lake at 70,000 acres. The park offers paddling, fishing, swimming, and a network of mountain bike trails that SORBA maintains. Cottage cabins and a campground make it a natural weekend destination. Near the International Disc Golf Center for a full Appling-area day.",
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
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle day-use",
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
        description="Seed Yonder Wave 16 Research Gaps destinations."
    )
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 16 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0
    details_upserted = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 16 Research Gaps Destination Seed")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for entry in WAVE_16_DESTINATIONS:
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
