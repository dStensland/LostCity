#!/usr/bin/env python3
"""
Seed Yonder's twelfth destination wave — Georgia waterfalls, lakes, mountains,
and urban nature preserves.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave12_ga_waterfalls_nature.py
    python3 scripts/seed_yonder_wave12_ga_waterfalls_nature.py --apply
    python3 scripts/seed_yonder_wave12_ga_waterfalls_nature.py --apply --refresh-existing
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from copy import deepcopy

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, get_or_create_venue, get_venue_by_slug
from db.destination_details import upsert_venue_destination_details

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Each entry has a "venue" block (fields for the venues table) and a
# "details" block (fields for venue_destination_details).
WAVE_12_DESTINATIONS = [
    {
        "venue": {
            "name": "DeSoto Falls",
            "slug": "desoto-falls-dahlonega",
            "address": "DeSoto Falls Scenic Area, US-19",
            "city": "Dahlonega",
            "state": "GA",
            "zip": "30533",
            "lat": 34.7257,
            "lng": -83.9498,
            "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10463",
            "venue_type": "park",
            "short_description": "Two-tiered waterfall pair on an easy 2-mile loop trail in Chattahoochee National Forest near Dahlonega.",
            "description": "DeSoto Falls Scenic Area in Chattahoochee National Forest offers an easy 2-mile loop trail that visits both upper and lower waterfalls cascading through a steep hardwood gorge. The lower falls is the more dramatic of the two. A small campground sits at the trailhead.",
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
        },
    },
    {
        "venue": {
            "name": "Dukes Creek Falls",
            "slug": "dukes-creek-falls",
            "address": "GA-348, Richard B. Russell Scenic Hwy",
            "city": "Helen",
            "state": "GA",
            "zip": "30545",
            "lat": 34.7437,
            "lng": -83.8645,
            "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10459",
            "venue_type": "park",
            "short_description": "340-foot cascade with observation platforms on a moderate 2-mile trail through old-growth forest near Helen.",
            "description": "Dukes Creek Falls drops 340 feet in a series of cascades visible from multiple observation platforms along a moderate 2-mile trail. The path winds through old-growth forest in Chattahoochee National Forest with impressive views at several vantage points. One of the most photographed waterfalls in North Georgia.",
            "typical_duration_minutes": 150,
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
            "weather_fit_tags": ["after-rain", "summer-friendly", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Helton Creek Falls",
            "slug": "helton-creek-falls",
            "address": "Helton Creek Rd",
            "city": "Blairsville",
            "state": "GA",
            "zip": "30512",
            "lat": 34.8363,
            "lng": -83.9872,
            "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10458",
            "venue_type": "park",
            "short_description": "Double waterfall reachable by an easy 0.4-mile walk — ideal family stop in the North Georgia mountains.",
            "description": "Helton Creek Falls is a double-tiered waterfall reached by a short, easy 0.4-mile trail near Blairsville in Chattahoochee National Forest. Upper and lower falls are both visible and accessible, making it one of the most family-friendly waterfall hikes in Georgia.",
            "typical_duration_minutes": 60,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
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
        },
    },
    {
        "venue": {
            "name": "Raven Cliff Falls",
            "slug": "raven-cliff-falls",
            "address": "GA-356, Raven Cliff Falls Trail",
            "city": "Helen",
            "state": "GA",
            "zip": "30545",
            "lat": 34.7627,
            "lng": -83.8262,
            "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10462",
            "venue_type": "trail",
            "short_description": "100-foot waterfall splitting through a cliff face — the dramatic payoff at the end of a 5.5-mile moderate hike.",
            "description": "Raven Cliff Falls is a striking 100-foot waterfall that splits and cascades through a narrow crevice in a granite cliff face. The 5.5-mile out-and-back trail follows Dodd Creek through Chattahoochee National Forest with multiple smaller cascades along the way before the main payoff.",
            "typical_duration_minutes": 240,
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
            "weather_fit_tags": ["after-rain", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Minnehaha Falls",
            "slug": "minnehaha-falls-rabun",
            "address": "Lake Rabun Rd",
            "city": "Clayton",
            "state": "GA",
            "zip": "30525",
            "lat": 34.7494,
            "lng": -83.5218,
            "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10456",
            "venue_type": "park",
            "short_description": "100-foot waterfall with an easy short trail near Lake Rabun in Rabun County — a quick scenic stop.",
            "description": "Minnehaha Falls is a 100-foot waterfall tucked into the Rabun County mountains near scenic Lake Rabun. The short, easy trail makes it accessible to all skill levels. Often combined with a stop at the lake for swimming or paddling.",
            "typical_duration_minutes": 60,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
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
        },
    },
    {
        "venue": {
            "name": "Cascade Springs Nature Preserve",
            "slug": "cascade-springs-nature-preserve",
            "address": "2852 Cascade Rd SW",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30311",
            "lat": 33.7031,
            "lng": -84.4783,
            "website": "https://www.atlantaga.gov/government/departments/parks-recreation/parks/cascade-springs-nature-preserve",
            "venue_type": "park",
            "short_description": "135-acre urban nature preserve in SW Atlanta with springs, a waterfall, Civil War-era ruins, and creek trails.",
            "description": "Cascade Springs Nature Preserve is a 135-acre forested retreat in southwest Atlanta, one of the city's best-kept outdoor secrets. The preserve features natural springs, a small waterfall, creek-side trails, and the ruins of a historic spa resort. Just 15 minutes from downtown Atlanta.",
            "typical_duration_minutes": 90,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "trail",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 15,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Constitution Lakes Park",
            "slug": "constitution-lakes-park",
            "address": "1305 Clifton Church Rd SE",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30316",
            "lat": 33.7015,
            "lng": -84.3237,
            "website": "https://www.dekalbcountyga.gov/parks-recreation/constitution-lakes-park",
            "venue_type": "park",
            "short_description": "SE Atlanta wetlands park with a one-of-a-kind Doll's Head Trail art installation and old brick factory ruins.",
            "description": "Constitution Lakes Park is a hidden gem in southeast Atlanta featuring the unique Doll's Head Trail — a community folk art installation built from found objects in the woods. A wetlands boardwalk, migratory bird habitat, and ruins of the old Atlanta Brick Company factory round out this unusual urban escape.",
            "typical_duration_minutes": 90,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "trail",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 15,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Morningside Nature Preserve",
            "slug": "morningside-nature-preserve",
            "address": "1700 Mclendon Ave NE",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30307",
            "lat": 33.7847,
            "lng": -84.3495,
            "website": "https://www.atlantaga.gov/government/departments/parks-recreation/parks/morningside-nature-preserve",
            "venue_type": "park",
            "short_description": "Hidden urban forest with creek trails along South Fork Peachtree Creek, 10 minutes from Ponce City Market.",
            "description": "Morningside Nature Preserve is an intown forest tucked into the Morningside neighborhood with winding creek trails along the South Fork of Peachtree Creek. Less than 10 minutes from Ponce City Market, it offers a genuine forest escape in the middle of Atlanta.",
            "typical_duration_minutes": 60,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "trail",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 10,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "street",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "East Palisades Trail",
            "slug": "east-palisades-trail-crnra",
            "address": "Indian Trail Rd NW",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30327",
            "lat": 33.8814,
            "lng": -84.4496,
            "website": "https://www.nps.gov/chat/planyourvisit/east-palisades.htm",
            "venue_type": "trail",
            "short_description": "Bamboo forest and river rock outcrops along the Chattahoochee River NRA, 20 minutes from Midtown.",
            "description": "East Palisades is one of the most scenic units of the Chattahoochee River National Recreation Area, featuring a famous bamboo forest tunnel trail, dramatic rock outcrops along the Chattahoochee River, and easy river access for wading. The trailhead is about 20 minutes from Midtown Atlanta.",
            "typical_duration_minutes": 90,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "trail",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 20,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Cochran Shoals",
            "slug": "cochran-shoals-crnra",
            "address": "Interstate North Pkwy SE",
            "city": "Sandy Springs",
            "state": "GA",
            "zip": "30339",
            "lat": 33.8973,
            "lng": -84.4580,
            "website": "https://www.nps.gov/chat/planyourvisit/cochran-shoals.htm",
            "venue_type": "trail",
            "short_description": "3-mile fitness trail along the Chattahoochee River — the most-visited unit of CRNRA with river shoals and open meadows.",
            "description": "Cochran Shoals is the most-visited unit of the Chattahoochee River National Recreation Area. The flat 3-mile fitness trail loops through river bottomland and past the dramatic shoals of the Chattahoochee, making it a top spot for joggers, dog walkers, and weekend cyclists within the metro.",
            "typical_duration_minutes": 90,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "trail",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 20,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Vickery Creek Trail",
            "slug": "vickery-creek-trail-roswell",
            "address": "Riverside Rd",
            "city": "Roswell",
            "state": "GA",
            "zip": "30075",
            "lat": 34.0227,
            "lng": -84.3622,
            "website": "https://www.nps.gov/chat/planyourvisit/vickery-creek.htm",
            "venue_type": "trail",
            "short_description": "Civil War-era mill ruins, a waterfall, and a historic covered bridge along Vickery Creek in Roswell.",
            "description": "Vickery Creek Trail winds past the ruins of the Roswell Mill — a Civil War-era textile factory burned by Union troops — alongside a dramatic waterfall and a historic covered footbridge. Part of the Chattahoochee River NRA. About 30 minutes from Atlanta.",
            "typical_duration_minutes": 90,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "trail",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 30,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Sope Creek Trail",
            "slug": "sope-creek-trail-crnra",
            "address": "Paper Mill Rd SE",
            "city": "Marietta",
            "state": "GA",
            "zip": "30067",
            "lat": 33.9283,
            "lng": -84.4609,
            "website": "https://www.nps.gov/chat/planyourvisit/sope-creek.htm",
            "venue_type": "trail",
            "short_description": "1850s paper mill ruins alongside Sope Creek — a popular trail running and history loop 25 minutes from Atlanta.",
            "description": "Sope Creek Trail loops past the ruins of a paper mill dating to the 1850s along a rocky Chattahoochee tributary. Part of the Chattahoochee River NRA, the trail is a favorite for trail runners and history buffs. Creek crossings add a bit of adventure. About 25 minutes northwest of Atlanta.",
            "typical_duration_minutes": 90,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "trail",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 25,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Lake Lanier",
            "slug": "lake-lanier",
            "address": "2150 Buford Dam Rd",
            "city": "Buford",
            "state": "GA",
            "zip": "30518",
            "lat": 34.1731,
            "lng": -83.9732,
            "website": "https://www.recreation.gov/camping/gateways/2626",
            "venue_type": "park",
            "short_description": "38,000-acre reservoir with 690 miles of shoreline — Atlanta's primary lake for swimming, boating, and island camping.",
            "description": "Lake Lanier is a 38,000-acre U.S. Army Corps of Engineers reservoir with 690 miles of Georgia shoreline, multiple swim beaches, campgrounds, and Lake Lanier Islands resort. The closest major lake to Atlanta, it draws millions of visitors annually for boating, paddling, fishing, and weekend getaways.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "lake",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 60,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "clear-day"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Beach day-use and campsite fees vary by location",
        },
    },
    {
        "venue": {
            "name": "Lake Oconee",
            "slug": "lake-oconee",
            "address": "1071 Greensboro Hwy",
            "city": "Greensboro",
            "state": "GA",
            "zip": "30642",
            "lat": 33.4723,
            "lng": -83.3694,
            "website": "https://www.georgiapower.com/company/energy-education/lake-parks/lake-oconee.html",
            "venue_type": "park",
            "short_description": "19,000-acre Georgia Power reservoir with golf, fishing, paddling, and lakeside resorts 90 minutes from Atlanta.",
            "description": "Lake Oconee is a 19,000-acre reservoir managed by Georgia Power in the Georgia Piedmont. It offers fishing, paddling, and golf at Reynolds Lake Oconee resort. A quieter, less crowded alternative to Lake Lanier with multiple public access points and boat ramps.",
            "typical_duration_minutes": 360,
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
        },
    },
    {
        "venue": {
            "name": "Springer Mountain",
            "slug": "springer-mountain",
            "address": "Amicalola Falls State Park, 418 Amicalola Falls State Park Rd",
            "city": "Dawsonville",
            "state": "GA",
            "zip": "30534",
            "lat": 34.6278,
            "lng": -84.1946,
            "website": "https://gastateparks.org/AmicalolaFalls",
            "venue_type": "trail",
            "short_description": "Southern terminus of the Appalachian Trail — an 8.5-mile approach hike from Amicalola Falls to the AT's starting plaque.",
            "description": "Springer Mountain is the southern terminus of the Appalachian Trail, where the AT's 2,190-mile journey to Maine begins. Most hikers approach via the 8.5-mile AT Approach Trail from Amicalola Falls State Park, passing the 729-foot Amicalola Falls en route. The summit plaque draws day hikers and thru-hiker hopefuls alike.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "summit",
            "primary_activity": "summit_hike",
            "difficulty_level": "hard",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["clear-day", "cool-weather"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
            "fee_note": "Amicalola Falls SP parking fee $5/day",
        },
    },
    {
        "venue": {
            "name": "Pine Mountain Trail",
            "slug": "pine-mountain-trail-fdr",
            "address": "FDR State Park, 498 GA-190",
            "city": "Pine Mountain",
            "state": "GA",
            "zip": "31822",
            "lat": 32.8505,
            "lng": -84.8769,
            "website": "https://gastateparks.org/FDRoosevelt",
            "venue_type": "trail",
            "short_description": "Georgia's longest single-track trail — a 23-mile through-route across FDR State Park in the Pine Mountain ridge.",
            "description": "The Pine Mountain Trail is Georgia's longest single-track trail, covering 23 miles across F.D. Roosevelt State Park in western Georgia. The trail traverses the Pine Mountain ridge through hardwood forests, past scenic overlooks, and along rocky creek corridors. FDR himself helped design sections of the park.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "trail",
            "primary_activity": "hiking",
            "difficulty_level": "hard",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["cool-weather", "dry-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Currahee Mountain",
            "slug": "currahee-mountain",
            "address": "Currahee Mountain Rd",
            "city": "Toccoa",
            "state": "GA",
            "zip": "30577",
            "lat": 34.5685,
            "lng": -83.3214,
            "website": "https://www.toccoa.com/currahee-mountain",
            "venue_type": "trail",
            "short_description": "WWII Band of Brothers training mountain — 3-mile out-and-back to a hilltop memorial above Toccoa, 1.5 hours from Atlanta.",
            "description": "Currahee Mountain is where the 506th Parachute Infantry Regiment — the Band of Brothers — trained in WWII with their famous 'three miles up, three miles down' runs. The 3-mile out-and-back trail climbs to a memorial at the top with views over Toccoa and the Georgia Piedmont.",
            "typical_duration_minutes": 150,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "summit",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["clear-day", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Panola Mountain State Park",
            "slug": "panola-mountain-state-park",
            "address": "2600 Highway 155 SW",
            "city": "Stockbridge",
            "state": "GA",
            "zip": "30281",
            "lat": 33.6215,
            "lng": -84.1751,
            "website": "https://gastateparks.org/PanolaMountain",
            "venue_type": "park",
            "short_description": "Protected granite monadnock 30 minutes from Atlanta — guided hikes to the summit, paved paths, and a nature center.",
            "description": "Panola Mountain is a 100-acre granite monadnock in a protected state park near Stockbridge, Georgia. The summit is accessible only on ranger-led guided hikes to protect rare lichen and plant communities. Self-guided paved paths circle the base and a nature center interprets the site.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "nature_center",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 30,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": True,
            "fee_note": "Guided summit hikes require advance registration, free admission",
        },
    },
    {
        "venue": {
            "name": "Ocmulgee Mounds National Historical Park",
            "slug": "ocmulgee-mounds-nhp",
            "address": "1207 Emery Hwy",
            "city": "Macon",
            "state": "GA",
            "zip": "31217",
            "lat": 32.8394,
            "lng": -83.5958,
            "website": "https://www.nps.gov/ocmu/index.htm",
            "venue_type": "museum",
            "short_description": "17,000 years of human habitation preserved at a NPS site — walk into a reconstructed 1,000-year-old Earth Lodge.",
            "description": "Ocmulgee Mounds National Historical Park in Macon preserves one of the oldest continuously occupied archaeological sites in North America with 17,000 years of documented human habitation. The Great Temple Mound, Lesser Temple Mound, and the reconstructed Earth Lodge — an original council chamber with intact clay floor dating to 900 AD — are the highlights.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "landmark",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
        },
    },
    {
        "venue": {
            "name": "Boat Rock",
            "slug": "boat-rock-atlanta",
            "address": "Boat Rock Rd SW",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30331",
            "lat": 33.7054,
            "lng": -84.5113,
            "website": "https://www.mountainproject.com/area/106028535/boat-rock",
            "venue_type": "park",
            "short_description": "Urban bouldering area in SW Atlanta with 200+ problems on granite — a local favorite 15 minutes from downtown.",
            "description": "Boat Rock is Atlanta's best-known bouldering area, tucked into a southwest Atlanta neighborhood with 200+ problems ranging from beginner to expert on granite outcrops. Managed cooperatively by the Atlanta Climbing Club. One of the few technical climbing destinations accessible from within city limits.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "climbing_area",
            "primary_activity": "climbing",
            "difficulty_level": "moderate",
            "drive_time_minutes": 15,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["dry-weather", "cool-weather"],
            "parking_type": "street",
            "dog_friendly": True,
            "family_suitability": "caution",
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
        description="Seed Yonder Wave 12 Georgia waterfalls, lakes, mountains, and urban nature destinations."
    )
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 12 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0
    details_upserted = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 12 — GA Waterfalls, Lakes, Mountains & Urban Nature")
    logger.info("=" * 68)
    logger.info("Wave: Georgia waterfalls, lakes, mountains, and urban nature — from")
    logger.info("      100-foot cascades to hidden intown preserves.")
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for entry in WAVE_12_DESTINATIONS:
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
