#!/usr/bin/env python3
"""
Seed Yonder's eighth destination wave — Ring 3 (2-3 hour from Atlanta) multi-state expansion.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave8_ring3_multistate.py
    python3 scripts/seed_yonder_wave8_ring3_multistate.py --apply
    python3 scripts/seed_yonder_wave8_ring3_multistate.py --apply --refresh-existing
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
WAVE_8_DESTINATIONS = [
    {
        "venue": {
            "name": "Ocoee River (Middle Section)",
            "slug": "ocoee-river-middle",
            "address": "4590 US-64",
            "city": "Ducktown",
            "state": "TN",
            "zip": "37326",
            "lat": 35.0825,
            "lng": -84.5392,
            "website": "https://noc.com/ocoee-river-rafting/",
            "venue_type": "park",
            "short_description": "1996 Olympic whitewater venue and America's most popular rafting trip — 5 miles of Class III-IV rapids.",
            "description": "The Middle Ocoee is America's most popular whitewater rafting trip and the venue for 1996 Olympic canoe/kayak slalom. Five miles of continuous Class III-IV rapids through Cherokee National Forest. Multiple outfitters including NOC, Whitewater Express, and Ocoee Outdoors.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "river",
            "primary_activity": "rafting",
            "difficulty_level": "moderate",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "caution",
            "reservation_required": True,
            "fee_note": "$35-65/person with outfitter",
        },
    },
    {
        "venue": {
            "name": "Lake Jocassee",
            "slug": "lake-jocassee",
            "address": "161 Holcombe Circle",
            "city": "Salem",
            "state": "SC",
            "zip": "29676",
            "lat": 34.9607,
            "lng": -82.9237,
            "website": "https://southcarolinaparks.com/devils-fork",
            "venue_type": "park",
            "short_description": "National Geographic top-50 destination with crystal blue water and boat-access-only waterfalls in the Blue Ridge foothills.",
            "description": "Lake Jocassee is a 7,500-acre mountain reservoir with crystal blue water accessible through Devil's Fork State Park. USA TODAY's Best Lake for Swimming. Waterfalls visible only from the water, cliff jumping spots, and exceptional underwater visibility. Boat and kayak rentals through Eclectic Sun.",
            "typical_duration_minutes": 420,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "lake",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "clear-day"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": True,
            "fee_note": "Devil's Fork SP parking $6/day, boat rentals $50-120",
        },
    },
    {
        "venue": {
            "name": "Cheaha State Park",
            "slug": "cheaha-state-park",
            "address": "19644 AL-281",
            "city": "Delta",
            "state": "AL",
            "zip": "36258",
            "lat": 33.4858,
            "lng": -85.8093,
            "website": "https://www.alapark.com/parks/cheaha-state-park",
            "venue_type": "park",
            "short_description": "Alabama's highest point at 2,407 feet with Pinhoti Trail access, cliffside restaurant, and 360-degree views from Cheaha summit.",
            "description": "Cheaha State Park sits atop Alabama's highest point at 2,407 feet, surrounded by 394,000 acres of Talladega National Forest. Cliffside restaurant, swimming pool, full campground, cabins, and lodge. The Pinhoti Trail passes through with excellent mountain biking and hiking sections.",
            "typical_duration_minutes": 420,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["cool-weather", "leaf-season", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Fall Creek Falls State Park",
            "slug": "fall-creek-falls",
            "address": "2009 Village Camp Rd",
            "city": "Spencer",
            "state": "TN",
            "zip": "38585",
            "lat": 35.6627,
            "lng": -85.3518,
            "website": "https://tnstateparks.com/parks/fall-creek-falls",
            "venue_type": "park",
            "short_description": "256-foot free-fall waterfall — tallest in eastern North America — in Tennessee's largest state park.",
            "description": "Fall Creek Falls State Park is the largest state park in the eastern US, anchored by the 256-foot Fall Creek Falls — the tallest free-fall waterfall east of the Rockies. Cane Creek Gorge adds multiple waterfalls, serious hiking, and swimming holes. Campground, cabins, and resort lodge available.",
            "typical_duration_minutes": 420,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "state_park",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "moderate",
            "drive_time_minutes": 135,
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
            "name": "Savage Gulf State Natural Area",
            "slug": "savage-gulf",
            "address": "3177 SR-399",
            "city": "Palmer",
            "state": "TN",
            "zip": "37365",
            "lat": 35.4580,
            "lng": -85.5882,
            "website": "https://tnstateparks.com/parks/south-cumberland",
            "venue_type": "park",
            "short_description": "Three dramatic gorges with 50+ miles of backcountry trail — Tennessee's crown jewel for serious backpacking.",
            "description": "Savage Gulf State Natural Area is part of the South Cumberland State Park complex. Three gorges, 50+ miles of backcountry trail, and some of Tennessee's most dramatic canyon scenery. One of the best multi-day backpacking destinations in the Southeast. Primitive campsites along the rim.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "hard",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["dry-weather", "cool-weather", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "no",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Caesars Head State Park",
            "slug": "caesars-head-state-park",
            "address": "8155 Geer Hwy",
            "city": "Cleveland",
            "state": "SC",
            "zip": "29635",
            "lat": 35.1092,
            "lng": -82.6249,
            "website": "https://southcarolinaparks.com/caesars-head",
            "venue_type": "park",
            "short_description": "2,000-foot escarpment with panoramic views, Raven Cliff Falls trail, and spectacular fall hawk migration.",
            "description": "Caesars Head State Park sits atop a 2,000-foot granite escarpment with panoramic views of the Blue Ridge. Part of the 17,000-acre Mountain Bridge Wilderness with Jones Gap State Park. Raven Cliff Falls trail leads to a 420-foot waterfall. September-October hawk migration draws thousands of raptors daily.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 135,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free admission",
        },
    },
    {
        "venue": {
            "name": "Jones Gap State Park",
            "slug": "jones-gap-state-park",
            "address": "303 Jones Gap Rd",
            "city": "Marietta",
            "state": "SC",
            "zip": "29661",
            "lat": 35.1225,
            "lng": -82.5735,
            "website": "https://southcarolinaparks.com/jones-gap",
            "venue_type": "park",
            "short_description": "Part of the 17,000-acre Mountain Bridge Wilderness with 30+ miles of trails along South Carolina's first scenic river.",
            "description": "Jones Gap State Park is the other half of the Mountain Bridge Wilderness with Caesars Head. 30+ miles of trails, the Middle Saluda River (SC's first designated scenic river), Rainbow Falls, and excellent trout fishing. Primitive campground. Less crowded than Caesars Head.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 135,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["cool-weather", "after-rain"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Table Rock State Park",
            "slug": "table-rock-state-park",
            "address": "158 E Ellison Ln",
            "city": "Pickens",
            "state": "SC",
            "zip": "29671",
            "lat": 35.0237,
            "lng": -82.7160,
            "website": "https://southcarolinaparks.com/table-rock",
            "venue_type": "park",
            "short_description": "Dominant 3,124-foot summit with a rigorous 7-mile trail, swimming lake, CCC-era cabins, and campground.",
            "description": "Table Rock State Park is defined by its dominant granite summit at 3,124 feet. The Table Rock Trail is a rigorous 7-mile roundtrip with 2,000+ feet of elevation gain. Swimming lake, CCC-built cabins, campground, and nature center. On the Cherokee Foothills Scenic Highway.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "summit_hike",
            "difficulty_level": "hard",
            "drive_time_minutes": 140,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["clear-day", "cool-weather", "leaf-season"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
            "fee_note": "$6/adult admission",
        },
    },
    {
        "venue": {
            "name": "Chattooga Wild & Scenic River",
            "slug": "chattooga-wild-scenic-river",
            "address": "US-76 Bridge",
            "city": "Clayton",
            "state": "GA",
            "zip": "30525",
            "lat": 34.8154,
            "lng": -83.3127,
            "website": "https://noc.com/chattooga-river-rafting/",
            "venue_type": "park",
            "short_description": "Federally protected Wild & Scenic River with Class II-V whitewater — filming location for Deliverance.",
            "description": "The Chattooga River has been a protected Wild & Scenic River since 1974. Section III offers full-day Class II-IV rafting through a spectacular gorge. Section IV is expert-only Class IV-V including Bull Sluice. NOC operates guided trips. Filming location for Deliverance.",
            "typical_duration_minutes": 420,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "river",
            "primary_activity": "rafting",
            "difficulty_level": "hard",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "after-rain"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "no",
            "reservation_required": True,
            "fee_note": "Section III $100-130/person guided",
        },
    },
    {
        "venue": {
            "name": "Hiwassee River",
            "slug": "hiwassee-river-outpost",
            "address": "Spring Creek Rd",
            "city": "Reliance",
            "state": "TN",
            "zip": "37369",
            "lat": 35.2172,
            "lng": -84.5311,
            "website": "https://www.hiwasseeoutfitters.com/",
            "venue_type": "park",
            "short_description": "Gentle Class I-II scenic float through Cherokee National Forest — one of the South's best beginner paddling rivers.",
            "description": "The Hiwassee River in Cherokee National Forest is one of the South's most beautiful scenic float rivers. Class I-II water is perfect for beginner kayakers and canoeists. The old Hiwassee Rail Trail parallels the river. Multiple outfitters offer tube, kayak, and canoe rentals near Reliance.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "river",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 105,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$20-40 kayak/canoe rental",
        },
    },
    {
        "venue": {
            "name": "Ruby Falls",
            "slug": "ruby-falls",
            "address": "1720 Scenic Hwy",
            "city": "Chattanooga",
            "state": "TN",
            "zip": "37409",
            "lat": 35.0189,
            "lng": -85.3393,
            "website": "https://www.rubyfalls.com/",
            "venue_type": "museum",
            "short_description": "Underground waterfall 1,120 feet below Lookout Mountain — the most visited underground waterfall in the US.",
            "description": "Ruby Falls is an underground waterfall located 1,120 feet below the surface of Lookout Mountain. Guided cave tours lead through geological formations to the 145-foot waterfall illuminated by colored lights. The most visited underground waterfall in the United States.",
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
            "fee_note": "$25/adult admission",
        },
    },
    {
        "venue": {
            "name": "Raccoon Mountain Caverns",
            "slug": "raccoon-mountain-caverns",
            "address": "319 W Hills Dr",
            "city": "Chattanooga",
            "state": "TN",
            "zip": "37419",
            "lat": 35.0310,
            "lng": -85.3975,
            "website": "https://www.raccoonmountain.com/",
            "venue_type": "museum",
            "short_description": "5.5+ miles of cave passages with Crystal Palace guided tours and wild caving expeditions — including underground camping.",
            "description": "Raccoon Mountain Caverns offers 5.5+ miles of cave passages. The Crystal Palace guided tour (45 min) covers developed formations. Wild caving expeditions explore undeveloped passages for 3-6 hours. Underground camping experiences available. Near Chattanooga.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "cavern",
            "primary_activity": "caving",
            "difficulty_level": "moderate",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "caution",
            "reservation_required": True,
            "fee_note": "$19-75/person depending on tour",
        },
    },
    {
        "venue": {
            "name": "The Lost Sea Adventure",
            "slug": "the-lost-sea",
            "address": "140 Lost Sea Rd",
            "city": "Sweetwater",
            "state": "TN",
            "zip": "37874",
            "lat": 35.5706,
            "lng": -84.6250,
            "website": "https://thelostsea.com/",
            "venue_type": "museum",
            "short_description": "World's second-largest non-subglacial underground lake with glass-bottom boat tours through Craighead Caverns.",
            "description": "The Lost Sea is the world's second-largest non-subglacial underground lake — over 13 acres charted with no end found. Glass-bottom boat tours glide over the crystal-clear lake inside Craighead Caverns. Cherokee artifacts and jaguar fossils were discovered on-site.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
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
            "fee_note": "$22/adult",
        },
    },
    {
        "venue": {
            "name": "Coldwater Mountain",
            "slug": "coldwater-mountain",
            "address": "Coldwater Mountain Rd",
            "city": "Anniston",
            "state": "AL",
            "zip": "36201",
            "lat": 33.7869,
            "lng": -85.7742,
            "website": "https://www.coldwatermountain.com/",
            "venue_type": "trail",
            "short_description": "IMBA Ride Center with some of the best flow trail mountain biking in the Southeast.",
            "description": "Coldwater Mountain is an IMBA-designated Ride Center near Anniston, Alabama. Outstanding flow trails and technical options make it one of the best mountain biking destinations in the Southeast. Chronically undervisited by Atlanta riders despite being only 2 hours away.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "trail",
            "primary_activity": "mountain_biking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 135,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["dry-weather", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "no",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Etowah Indian Mounds",
            "slug": "etowah-indian-mounds",
            "address": "813 Indian Mounds Rd SE",
            "city": "Cartersville",
            "state": "GA",
            "zip": "30120",
            "lat": 34.1249,
            "lng": -84.8006,
            "website": "https://gastateparks.org/EtowahMounds",
            "venue_type": "museum",
            "short_description": "National Historic Landmark with 6 Mississippian-era earthen mounds dating to 1000-1550 AD on the Etowah River.",
            "description": "Etowah Indian Mounds is a National Historic Landmark preserving 6 earthen mounds of the Mississippian culture (1000-1550 AD). The 54-acre site along the Etowah River includes a museum with artifacts, a nature trail, and the largest mound at 63 feet tall. One of the most intact prehistoric sites in the Southeast.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "landmark",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 50,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["dry-weather", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$6/adult",
        },
    },
    {
        "venue": {
            "name": "Bald River Falls",
            "slug": "bald-river-falls",
            "address": "Tellico River Rd",
            "city": "Tellico Plains",
            "state": "TN",
            "zip": "37385",
            "lat": 35.3208,
            "lng": -84.1589,
            "website": "https://www.fs.usda.gov/recarea/cherokee/recarea/?recid=35110",
            "venue_type": "park",
            "short_description": "100-foot roadside waterfall in Cherokee National Forest — rare drive-to waterfall of serious scale.",
            "description": "Bald River Falls is a 100-foot waterfall visible directly from the road in Cherokee National Forest. One of the rare waterfalls of serious scale that requires zero hiking — you drive alongside it. Swimming below the falls when water is low. On the scenic Tellico River corridor.",
            "typical_duration_minutes": 60,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 140,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Virgin Falls",
            "slug": "virgin-falls",
            "address": "Scotts Gulf Rd",
            "city": "Sparta",
            "state": "TN",
            "zip": "38583",
            "lat": 35.8256,
            "lng": -85.3917,
            "website": "https://tnstateparks.com/parks/virgin-falls",
            "venue_type": "trail",
            "short_description": "110-foot waterfall that emerges from a cave and disappears into a sinkhole — unique geological phenomenon.",
            "description": "Virgin Falls is one of the most unique waterfalls in North America. Water emerges from a cave at the top, drops 110 feet, and then disappears into a sinkhole at the base. The 8-mile roundtrip hike through Tennessee backcountry is moderate to strenuous with multiple stream crossings.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "hard",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["after-rain", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "no",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Whitewater Falls",
            "slug": "whitewater-falls",
            "address": "NC-281",
            "city": "Sapphire",
            "state": "NC",
            "zip": "28774",
            "lat": 35.0275,
            "lng": -83.0050,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48963",
            "venue_type": "park",
            "short_description": "At 411 feet, the tallest waterfall east of the Mississippi — visible from a short walk to the overlook.",
            "description": "Whitewater Falls is the tallest waterfall east of the Mississippi River at 411 feet. Upper Falls is accessible via a short 0.1-mile walk to the overlook. Lower Falls requires a more strenuous hike. Located in Nantahala National Forest near the NC/SC border.",
            "typical_duration_minutes": 60,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 165,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "all-season"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$3 USFS day-use",
        },
    },
    {
        "venue": {
            "name": "Oconee State Park",
            "slug": "oconee-state-park",
            "address": "624 State Park Rd",
            "city": "Mountain Rest",
            "state": "SC",
            "zip": "29664",
            "lat": 34.8603,
            "lng": -83.1118,
            "website": "https://southcarolinaparks.com/oconee",
            "venue_type": "park",
            "short_description": "CCC-built mountain lake park with cabins, Chattooga River access, and Foothills Trail connection.",
            "description": "Oconee State Park is a CCC-built mountain park with a swimming lake, 20 cabins, campground, and hiking access to the Chattooga Wild & Scenic River and Foothills Trail. Quieter and more affordable than most mountain destinations. Near Walhalla, SC.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["cool-weather", "summer-friendly"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Russell-Brasstown Scenic Byway",
            "slug": "russell-brasstown-scenic-byway",
            "address": "GA-348 / GA-180",
            "city": "Hiawassee",
            "state": "GA",
            "zip": "30546",
            "lat": 34.8050,
            "lng": -83.8075,
            "website": "https://www.fs.usda.gov/detail/conf/home/?cid=stelprdb5364757",
            "venue_type": "park",
            "short_description": "40-mile National Scenic Byway through Chattahoochee National Forest crossing the Appalachian Trail at Hogpen Gap.",
            "description": "The Russell-Brasstown Scenic Byway is a 40-mile driving loop through Chattahoochee National Forest. Richard Russell Scenic Highway (GA-348) is a designated National Scenic Byway. Crosses the AT at Hogpen Gap, connects to Brasstown Bald, and passes through peak fall color country.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "scenic_drive",
            "primary_activity": "scenic_drive",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
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
        description="Seed Yonder Wave 8 Ring 3 multi-state expansion destinations."
    )
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 8 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0
    details_upserted = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 8 Ring 3 Multi-State Expansion Destination Seed")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for entry in WAVE_8_DESTINATIONS:
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
