#!/usr/bin/env python3
"""
Seed Yonder's fourteenth destination wave — North Carolina expansion.

North Carolina's mountains, waterfalls, and gorges — the Asheville orbit
and western NC highlands.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave14_nc_expansion.py
    python3 scripts/seed_yonder_wave14_nc_expansion.py --apply
    python3 scripts/seed_yonder_wave14_nc_expansion.py --apply --refresh-existing
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
WAVE_14_DESTINATIONS = [
    {
        "venue": {
            "name": "Linville Falls",
            "slug": "linville-falls-nc",
            "address": "7308 NC-181",
            "city": "Linville Falls",
            "state": "NC",
            "zip": "28647",
            "lat": 35.9554,
            "lng": -81.9280,
            "website": "https://www.nps.gov/blri/planyourvisit/linville-falls.htm",
            "venue_type": "park",
            "short_description": "Most-photographed waterfall in NC with multiple overlooks from the Blue Ridge Parkway.",
            "description": "Linville Falls is the most-photographed waterfall in North Carolina, dropping 45 feet into the rugged Linville Gorge. Multiple overlooks are accessible from the Blue Ridge Parkway visitor center via trails ranging from 0.4 to 1.6 miles. The upper and lower falls offer dramatically different perspectives on the same cascade.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
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
            "fee_note": "Free NPS access",
        },
    },
    {
        "venue": {
            "name": "Linville Gorge Wilderness",
            "slug": "linville-gorge-wilderness",
            "address": "Pisgah National Forest, Newland",
            "city": "Newland",
            "state": "NC",
            "zip": "28657",
            "lat": 35.9417,
            "lng": -81.9039,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48982",
            "venue_type": "park",
            "short_description": "The \"Grand Canyon of the East\" — permit-required wilderness with 12,000 acres of challenging trails in Pisgah NF.",
            "description": "Linville Gorge Wilderness is called the \"Grand Canyon of the East\" for its dramatic 2,000-foot walls enclosing 12,000 acres in Pisgah National Forest. Weekend and holiday access requires a permit (free, limited). Trails descend steeply to the river with remote backcountry campsites. One of the most rugged and least-visited wild places in the Southern Appalachians.",
            "typical_duration_minutes": 480,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "wilderness",
            "primary_activity": "hiking",
            "difficulty_level": "hard",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["dry-weather", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "no",
            "reservation_required": True,
            "fee_note": "Free permit required weekends/holidays May–Oct",
        },
    },
    {
        "venue": {
            "name": "Grandfather Mountain",
            "slug": "grandfather-mountain",
            "address": "2050 Blowing Rock Hwy",
            "city": "Linville",
            "state": "NC",
            "zip": "28646",
            "lat": 36.0978,
            "lng": -81.8205,
            "website": "https://grandfather.com/",
            "venue_type": "park",
            "short_description": "Mile High Swinging Bridge, environmental habitats, and rugged hiking on one of the oldest mountains on earth.",
            "description": "Grandfather Mountain is a UNESCO International Biosphere Reserve with the famous Mile High Swinging Bridge, native animal habitats, and exceptional hiking on the Profile Trail and Wilson Creek ridgeline. At 5,946 feet, it's one of the oldest mountains on earth and has protected status as North Carolina's most-visited private attraction. Dramatic exposed ridge scrambles reward strong hikers.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "mountain",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season", "cool-weather"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$25/adult admission",
        },
    },
    {
        "venue": {
            "name": "Chimney Rock State Park",
            "slug": "chimney-rock-state-park",
            "address": "431 Main St",
            "city": "Chimney Rock",
            "state": "NC",
            "zip": "28720",
            "lat": 35.4363,
            "lng": -82.2459,
            "website": "https://www.chimneyrockpark.com/",
            "venue_type": "park",
            "short_description": "535-million-year-old granite monolith with an elevator inside the mountain and 404-foot Hickory Nut Falls.",
            "description": "Chimney Rock State Park is built around a 535-million-year-old granite monolith rising 315 feet above the Rocky Broad River. An elevator cut through the rock reaches the summit, where trails fan out to overlooks and 404-foot Hickory Nut Falls — the location for The Last of the Mohicans. One of western NC's most dramatic natural landmarks.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season", "all-season"],
            "parking_type": "paid_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$17/adult admission",
        },
    },
    {
        "venue": {
            "name": "Max Patch",
            "slug": "max-patch-nc",
            "address": "Max Patch Rd",
            "city": "Hot Springs",
            "state": "NC",
            "zip": "28743",
            "lat": 35.7957,
            "lng": -82.9600,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48982",
            "venue_type": "park",
            "short_description": "Iconic AT bald summit with 360-degree views of the Black Mountains — legendary sunset destination.",
            "description": "Max Patch is a 4,629-foot bald mountain on the Appalachian Trail with unobstructed 360-degree views of the Black Mountains, Great Smoky Mountains, and surrounding ranges. The easy 1.5-mile loop from the trailhead summit is one of the most beloved short hikes in the South. The summit is particularly famous for its golden-hour sunsets.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "mountain",
            "primary_activity": "summit_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["clear-day", "leaf-season", "all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free USFS access; timed entry permit required during peak periods",
        },
    },
    {
        "venue": {
            "name": "Mount Mitchell State Park",
            "slug": "mount-mitchell-state-park",
            "address": "2388 State Hwy 128",
            "city": "Burnsville",
            "state": "NC",
            "zip": "28714",
            "lat": 35.7651,
            "lng": -82.2652,
            "website": "https://www.ncparks.gov/mount-mitchell-state-park",
            "venue_type": "park",
            "short_description": "Highest peak east of the Mississippi at 6,684 feet — observation deck, restaurant, and spruce-fir forest.",
            "description": "Mount Mitchell State Park reaches 6,684 feet — the highest point east of the Mississippi River. The observation tower provides views across the Black Mountain Range and, on clear days, into multiple states. A restaurant, museum, and campground serve visitors, and the summit can be reached by car on NC-128 off the Blue Ridge Parkway or via strenuous trails.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "summit_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["clear-day", "cool-weather", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free NC State Parks admission",
        },
    },
    {
        "venue": {
            "name": "Craggy Gardens",
            "slug": "craggy-gardens-nc",
            "address": "Blue Ridge Parkway Milepost 364",
            "city": "Asheville",
            "state": "NC",
            "zip": "28804",
            "lat": 35.7014,
            "lng": -82.3806,
            "website": "https://www.nps.gov/blri/planyourvisit/craggy-gardens.htm",
            "venue_type": "park",
            "short_description": "Rhododendron-covered balds at 5,500 feet — one of the Blue Ridge Parkway's most spectacular short hikes.",
            "description": "Craggy Gardens sits at 5,500 feet on the Blue Ridge Parkway north of Asheville, blanketed in Catawba rhododendron that blooms in vivid purple in late June. Short trails (1–2 miles) lead to panoramic views of the Black Mountains and surrounding balds. The picnic area and visitor center are open seasonally.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "scenic_area",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free NPS access",
        },
    },
    {
        "venue": {
            "name": "Lake Lure",
            "slug": "lake-lure-nc",
            "address": "2930 Memorial Hwy",
            "city": "Lake Lure",
            "state": "NC",
            "zip": "28746",
            "lat": 35.4298,
            "lng": -82.2020,
            "website": "https://www.townoflakelure.com/",
            "venue_type": "park",
            "short_description": "Scenic mountain lake from Dirty Dancing filming — beach, boat tours, and views of Chimney Rock.",
            "description": "Lake Lure is a 720-acre mountain reservoir surrounded by the Blue Ridge foothills. The town beach offers swimming, boat and kayak rentals, and a waterslide. Guided boat tours circle the lake and point out the coves used in filming Dirty Dancing (1987). Chimney Rock rises dramatically above the southern shore.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "lake",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "clear-day"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Beach admission $6/person; boat tours ~$20/person",
        },
    },
    {
        "venue": {
            "name": "Panthertown Valley",
            "slug": "panthertown-valley",
            "address": "Salt Rock Gap Trailhead, Breedlove Rd",
            "city": "Sapphire",
            "state": "NC",
            "zip": "28774",
            "lat": 35.1627,
            "lng": -83.0466,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48995",
            "venue_type": "park",
            "short_description": "\"Yosemite of the East\" — granite domes, waterfalls, and swimming holes across 6,300 acres in Nantahala NF.",
            "description": "Panthertown Valley is a 6,300-acre backcountry area in Nantahala National Forest often called the \"Yosemite of the East\" for its open granite domes, cascading waterfalls, and swimming holes. 36 miles of trail loop through the valley. Spectacular destinations include Schoolhouse Falls, the iconic Panthertown Valley overlook, and multiple backcountry campsites.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "wilderness",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["dry-weather", "summer-friendly", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
            "fee_note": "Free USFS access",
        },
    },
    {
        "venue": {
            "name": "Whiteside Mountain",
            "slug": "whiteside-mountain-nc",
            "address": "US-64",
            "city": "Highlands",
            "state": "NC",
            "zip": "28741",
            "lat": 35.0742,
            "lng": -83.1939,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=49005",
            "venue_type": "park",
            "short_description": "Dramatic 750-foot sheer cliffs on a 2-mile loop trail with jaw-dropping overlooks in Nantahala NF.",
            "description": "Whiteside Mountain features some of the most dramatic cliff scenery in the eastern United States — sheer granite walls dropping 750 feet make it one of the tallest cliffs east of the Rockies. The 2-mile loop trail is accessible from US-64 and gains 400 feet to two overlooks above the vertical face. Peregrine falcons nest on the cliffs in spring.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "mountain",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 150,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["clear-day", "cool-weather", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
            "fee_note": "Free USFS access",
        },
    },
    {
        "venue": {
            "name": "Devil's Courthouse",
            "slug": "devils-courthouse-nc",
            "address": "Blue Ridge Parkway Milepost 422.4",
            "city": "Asheville",
            "state": "NC",
            "zip": "28776",
            "lat": 35.3157,
            "lng": -82.9322,
            "website": "https://www.nps.gov/blri/planyourvisit/devils-courthouse.htm",
            "venue_type": "park",
            "short_description": "Steep 0.5-mile trail to a panoramic 360-degree summit steeped in Cherokee legend — one of the BRP's best quick hikes.",
            "description": "Devil's Courthouse is a rocky summit at 5,462 feet on the Blue Ridge Parkway near Brevard. The 0.5-mile trail gains 200 feet steeply through spruce forest to a bald rocky top with one of the most expansive views on the entire Parkway — four states on a clear day. Cherokee legend holds that the underworld spirit Judaculla holds court inside the mountain.",
            "typical_duration_minutes": 60,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "summit",
            "primary_activity": "summit_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["clear-day", "all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free NPS access",
        },
    },
    {
        "venue": {
            "name": "Black Balsam Knob",
            "slug": "black-balsam-knob-nc",
            "address": "Black Balsam Rd, Blue Ridge Parkway Milepost 420.2",
            "city": "Asheville",
            "state": "NC",
            "zip": "28776",
            "lat": 35.3313,
            "lng": -82.8963,
            "website": "https://www.nps.gov/blri/planyourvisit/art-loeb-trail.htm",
            "venue_type": "park",
            "short_description": "Easy hike to a 6,200-foot grassy bald connecting to the Art Loeb Trail — sweeping Shining Rock Wilderness views.",
            "description": "Black Balsam Knob sits at 6,214 feet in the Black Balsam area of the Pisgah National Forest, accessible via a short trail from the Blue Ridge Parkway. The grassy bald summit offers panoramic views across Shining Rock Wilderness and connects to the Art Loeb Trail for longer excursions. One of the best easy high-altitude hikes in the Southern Appalachians.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "mountain",
            "primary_activity": "summit_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["clear-day", "cool-weather", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free NPS/USFS access",
        },
    },
    {
        "venue": {
            "name": "Catawba Falls",
            "slug": "catawba-falls-nc",
            "address": "Catawba Falls Rd",
            "city": "Old Fort",
            "state": "NC",
            "zip": "28762",
            "lat": 35.6354,
            "lng": -82.2070,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48957",
            "venue_type": "park",
            "short_description": "Stunning multi-tier waterfall reached by an improved 1.5-mile trail — heavily upgraded and reopened in recent years.",
            "description": "Catawba Falls is a multi-tiered 100-foot waterfall in Pisgah National Forest accessed via a recently improved 1.5-mile trail in the Catawba River gorge. After years of trail damage and closure, a major USFS restoration project rebuilt bridges and rerouted the trail. Rewarding destination with minimal effort near Old Fort, NC.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "waterfall",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "easy",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free USFS access",
        },
    },
    {
        "venue": {
            "name": "Dry Falls",
            "slug": "dry-falls-nc",
            "address": "US-64 West",
            "city": "Highlands",
            "state": "NC",
            "zip": "28741",
            "lat": 35.0824,
            "lng": -83.2291,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48956",
            "venue_type": "park",
            "short_description": "Walk behind a 75-foot waterfall right off US-64 on the Highlands Waterfall Byway.",
            "description": "Dry Falls is a 75-foot waterfall on the Cullasaja River where visitors can walk behind the curtain of water on a paved path — without getting wet when flow is moderate. Located just off US-64 west of Highlands, it's one of the most accessible walk-behind waterfalls in the Southeast and part of the famous Nantahala National Forest Waterfall Byway.",
            "typical_duration_minutes": 45,
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
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$3 USFS day-use",
        },
    },
    {
        "venue": {
            "name": "Cullasaja Falls",
            "slug": "cullasaja-falls-nc",
            "address": "US-64 West (Macon County)",
            "city": "Highlands",
            "state": "NC",
            "zip": "28741",
            "lat": 35.0618,
            "lng": -83.2653,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48971",
            "venue_type": "park",
            "short_description": "250-foot roadside cascade along US-64's Waterfall Byway — one of the most dramatic roadside waterfalls in the Southeast.",
            "description": "Cullasaja Falls is a 250-foot cascade of the Cullasaja River visible from a roadside pullout on US-64 between Highlands and Franklin. The gorge here is too steep for trails, making the roadside view the only access — but the scale and drama of the falls are unmistakable. One of the anchor sights on the Highlands Waterfall Byway.",
            "typical_duration_minutes": 30,
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
            "fee_note": "Free roadside pullout",
        },
    },
    {
        "venue": {
            "name": "Bridal Veil Falls",
            "slug": "bridal-veil-falls-nc",
            "address": "US-64 West",
            "city": "Highlands",
            "state": "NC",
            "zip": "28741",
            "lat": 35.0868,
            "lng": -83.2340,
            "website": "https://www.fs.usda.gov/recarea/nfsnc/recarea/?recid=48958",
            "venue_type": "park",
            "short_description": "Drive-behind waterfall on US-64 — a classic quick stop on the Nantahala Waterfall Byway.",
            "description": "Bridal Veil Falls is a 120-foot waterfall on the Cullasaja River where an old section of US-64 passes directly behind the cascade. Visitors can drive or walk the short loop behind the waterfall. One of the most accessible novelty stops in the NC mountains and a natural companion to Dry Falls, two miles west on the same highway.",
            "typical_duration_minutes": 30,
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
            "fee_note": "Free access",
        },
    },
    {
        "venue": {
            "name": "South Mountains State Park",
            "slug": "south-mountains-state-park",
            "address": "3001 South Mountains State Park Ave",
            "city": "Connelly Springs",
            "state": "NC",
            "zip": "28612",
            "lat": 35.5833,
            "lng": -81.6286,
            "website": "https://www.ncparks.gov/south-mountains-state-park",
            "venue_type": "park",
            "short_description": "80-foot High Shoals Falls, premier NC mountain biking, and backcountry camping with a remote wilderness feel.",
            "description": "South Mountains State Park covers 18,000 acres of the South Mountains — a remote, rugged range distinct from the Blue Ridge. The park features 80-foot High Shoals Falls (accessible via a 2.7-mile trail), one of North Carolina's best mountain biking networks, equestrian trails, and backcountry camping. Less visited than Blue Ridge destinations despite outstanding terrain.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 210,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["dry-weather", "cool-weather", "after-rain"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free NC State Parks admission",
        },
    },
    {
        "venue": {
            "name": "Stone Mountain State Park (NC)",
            "slug": "stone-mountain-state-park-nc",
            "address": "3042 Frank Pkwy",
            "city": "Roaring Gap",
            "state": "NC",
            "zip": "28668",
            "lat": 36.3904,
            "lng": -81.0485,
            "website": "https://www.ncparks.gov/stone-mountain-state-park",
            "venue_type": "park",
            "short_description": "600-foot granite dome with waterfalls and backcountry camping in NC's Blue Ridge foothills — not the Georgia one.",
            "description": "North Carolina's Stone Mountain State Park is built around a massive 600-foot granite dome rising above the Piedmont foothills. The 4.5-mile Stone Mountain Loop Trail climbs the exposed dome face and visits three waterfalls including 200-foot Stone Mountain Falls. National Natural Landmark designation, backcountry campsites, and trout fishing. Not to be confused with Stone Mountain, Georgia.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 240,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["clear-day", "dry-weather", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free NC State Parks admission",
        },
    },
    {
        "venue": {
            "name": "Lake James State Park",
            "slug": "lake-james-state-park-nc",
            "address": "6883 Harmony Grove Church Rd",
            "city": "Nebo",
            "state": "NC",
            "zip": "28761",
            "lat": 35.7279,
            "lng": -81.8987,
            "website": "https://www.ncparks.gov/lake-james-state-park",
            "venue_type": "park",
            "short_description": "Mountain lake with sandy beaches, paddleboard and kayak rentals, and trailhead access to Catawba Falls.",
            "description": "Lake James State Park wraps around 150 miles of shoreline on a mountain reservoir in the Pisgah National Forest foothills. The park has sandy swimming beaches, canoe and kayak rentals, paddleboard access, and camping. It also serves as the gateway trailhead for Catawba Falls. The Tablerock Unit across the lake adds more hiking terrain.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "lake",
            "primary_activity": "paddling",
            "difficulty_level": "easy",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free NC State Parks admission; rental fees vary",
        },
    },
    {
        "venue": {
            "name": "Cradle of Forestry",
            "slug": "cradle-of-forestry-nc",
            "address": "11250 Pisgah Hwy",
            "city": "Pisgah Forest",
            "state": "NC",
            "zip": "28768",
            "lat": 35.3527,
            "lng": -82.7688,
            "website": "https://cradleofforestry.com/",
            "venue_type": "park",
            "short_description": "Birthplace of American forestry — historic 1890s campus, interpretive trails, and working sawmill in Pisgah NF.",
            "description": "The Cradle of Forestry is a National Historic Site marking where Gifford Pinchot and Carl Schenck established America's first forestry school in 1898 on the Vanderbilt estate that became Pisgah National Forest. Two paved interpretive trails (1 mile each) wind past restored 1890s buildings including a sawmill, engine house, and schoolmaster's cottage. Living history demonstrations run seasonally.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "historic_site",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 180,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["all-season", "clear-day"],
            "parking_type": "free_lot",
            "dog_friendly": False,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/adult admission",
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
        description="Seed Yonder Wave 14 North Carolina expansion destinations."
    )
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 14 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0
    details_upserted = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 14 North Carolina Expansion Destination Seed")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for entry in WAVE_14_DESTINATIONS:
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
