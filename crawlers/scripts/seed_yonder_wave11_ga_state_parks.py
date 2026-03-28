#!/usr/bin/env python3
"""
Seed Yonder's eleventh destination wave — Georgia state parks and major trails,
filling the biggest gaps in the state that hosts the portal.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/seed_yonder_wave11_ga_state_parks.py
    python3 scripts/seed_yonder_wave11_ga_state_parks.py --apply
    python3 scripts/seed_yonder_wave11_ga_state_parks.py --apply --refresh-existing
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
WAVE_11_DESTINATIONS = [
    {
        "venue": {
            "name": "Providence Canyon State Park",
            "slug": "providence-canyon-state-park",
            "address": "8930 Canyon Rd",
            "city": "Lumpkin",
            "state": "GA",
            "zip": "31815",
            "lat": 32.0702,
            "lng": -84.9158,
            "website": "https://gastateparks.org/ProvidenceCanyon",
            "place_type": "park",
            "short_description": "Georgia's 'Little Grand Canyon' — dramatic canyon formations with vivid multi-colored soil layers.",
            "description": "Providence Canyon State Park preserves Georgia's 'Little Grand Canyon,' a network of up to 150-foot canyons carved by 19th-century farming erosion. The colorful pink, orange, red, and purple soil striations are striking. The 7-mile backpacking loop and rim trail are best hiked spring or fall when rare plumleaf azaleas bloom.",
            "typical_duration_minutes": 270,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 175,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["clear-day", "cool-weather", "leaf-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free admission; backpacking permit required for overnight",
        },
    },
    {
        "venue": {
            "name": "Cloudland Canyon State Park",
            "slug": "cloudland-canyon-state-park",
            "address": "122 Cloudland Canyon Park Rd",
            "city": "Rising Fawn",
            "state": "GA",
            "zip": "30738",
            "lat": 34.8399,
            "lng": -85.4832,
            "website": "https://gastateparks.org/CloudlandCanyon",
            "place_type": "park",
            "short_description": "Two waterfalls reached by a 600-step staircase descent, rim trail with dramatic canyon views.",
            "description": "Cloudland Canyon State Park sits on the western edge of Lookout Mountain with a deep canyon carved by Sitton Gulch Creek. A 600-step staircase descends to two waterfalls — Cherokee Falls (60 ft) and Hemlock Falls (90 ft). The west rim trail offers panoramic views of the canyon and Sand Mountain, Alabama.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "waterfall_hike",
            "difficulty_level": "moderate",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["after-rain", "cool-weather", "leaf-season"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle parking fee",
        },
    },
    {
        "venue": {
            "name": "Tallulah Gorge State Park",
            "slug": "tallulah-gorge-state-park",
            "address": "338 Jane Hurt Yarn Rd",
            "city": "Tallulah Falls",
            "state": "GA",
            "zip": "30573",
            "lat": 34.7384,
            "lng": -83.3926,
            "website": "https://gastateparks.org/TallulahGorge",
            "place_type": "park",
            "short_description": "1,000-foot deep gorge with a suspension bridge and limited daily floor permits for adventurous hikers.",
            "description": "Tallulah Gorge is two miles long and nearly 1,000 feet deep, one of the most spectacular gorges in the eastern US. Rim trails offer dramatic overlooks. A limited number of floor permits (100/day) grant access to the gorge floor via a steel suspension bridge and permit a scramble to the base of the falls. Karl Wallenda crossed it on a tightrope in 1970.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "hard",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["clear-day", "after-rain", "cool-weather"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": True,
            "fee_note": "$5/vehicle; gorge floor permit free but limited (reserve ahead)",
        },
    },
    {
        "venue": {
            "name": "Sweetwater Creek State Park",
            "slug": "sweetwater-creek-state-park",
            "address": "1750 Mt Vernon Rd",
            "city": "Lithia Springs",
            "state": "GA",
            "zip": "30122",
            "lat": 33.7575,
            "lng": -84.6249,
            "website": "https://gastateparks.org/SweetwaterCreek",
            "place_type": "park",
            "short_description": "Civil War-era mill ruins along a rocky creek with a red trail waterfall — 30 minutes from Atlanta.",
            "description": "Sweetwater Creek State Park is one of Atlanta's best quick escapes. The red-blazed factory ruins trail leads past the roofless remains of the New Manchester Manufacturing Company (burned by Sherman in 1864) to a series of shoals and a small waterfall. The park also has a fishing lake and a longer yellow trail into the backcountry.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 30,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["all-season", "after-rain"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle parking",
        },
    },
    {
        "venue": {
            "name": "Kennesaw Mountain National Battlefield Park",
            "slug": "kennesaw-mountain-battlefield",
            "address": "900 Kennesaw Mountain Dr",
            "city": "Kennesaw",
            "state": "GA",
            "zip": "30152",
            "lat": 33.9889,
            "lng": -84.5756,
            "website": "https://www.nps.gov/kemo/index.htm",
            "place_type": "park",
            "short_description": "Civil War battlefield with summit views of Atlanta skyline across 17 miles of trails.",
            "description": "Kennesaw Mountain National Battlefield Park preserves the site of the 1864 Atlanta Campaign. The park has 17 miles of trails and the summit of Kennesaw Mountain (1,808 ft) offers views of the Atlanta skyline on clear days. A free shuttle runs to the summit on weekends. Popular with local trail runners.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 30,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["clear-day", "cool-weather", "all-season"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free (NPS)",
        },
    },
    {
        "venue": {
            "name": "Stone Mountain Park",
            "slug": "stone-mountain-park",
            "address": "1000 Robert E Lee Blvd",
            "city": "Stone Mountain",
            "state": "GA",
            "zip": "30083",
            "lat": 33.8081,
            "lng": -84.1456,
            "website": "https://stonemountainpark.com",
            "place_type": "park",
            "short_description": "World's largest exposed granite monadnock with a 1.3-mile summit trail and annual laser show.",
            "description": "Stone Mountain is the world's largest mass of exposed granite, rising 825 feet above the surrounding plain. The Walk Up Trail (1.3 miles, strenuous) reaches the dome summit with wide views of Atlanta. The park also has nature trails, a beach, SkyHike adventure area, and the seasonal Lasershow Spectacular. 30 minutes from downtown.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "landmark",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 30,
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["clear-day", "all-season"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$20/vehicle general admission",
        },
    },
    {
        "venue": {
            "name": "Arabia Mountain National Heritage Area",
            "slug": "arabia-mountain-heritage-area",
            "address": "3350 Klondike Rd",
            "city": "Lithonia",
            "state": "GA",
            "zip": "30038",
            "lat": 33.6598,
            "lng": -84.1299,
            "website": "https://arabiaalliance.org",
            "place_type": "park",
            "short_description": "Flat granite flatrock with rare endemic plants, the 30-mile PATH trail, and a sister peak to Stone Mountain.",
            "description": "Arabia Mountain is a 2,564-acre national heritage area centered on a flat granite flatrock similar to Stone Mountain but wilder and free. The summit supports rare endemic plants including diamorpha and black-spored quillwort visible only in spring. The Arabia Mountain PATH multi-use trail connects to Davidson-Arabia Nature Preserve and Panola Mountain.",
            "typical_duration_minutes": 120,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "landmark",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 30,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["clear-day", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free",
        },
    },
    {
        "venue": {
            "name": "Black Rock Mountain State Park",
            "slug": "black-rock-mountain-state-park",
            "address": "3085 Black Rock Mountain Pkwy",
            "city": "Mountain City",
            "state": "GA",
            "zip": "30562",
            "lat": 34.9081,
            "lng": -83.4138,
            "website": "https://gastateparks.org/BlackRockMountain",
            "place_type": "park",
            "short_description": "Georgia's highest state park at 3,640 ft with a panoramic overlook of the Blue Ridge and valley below.",
            "description": "Black Rock Mountain State Park is Georgia's highest state park, sitting at 3,640 feet on the Eastern Continental Divide. The Tennessee Rock Trail offers some of the best panoramic views in the state — looking south over Clayton and north into North Carolina. The park has a campground, cottages, and access to the Bartram Trail.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season", "cool-weather"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle",
        },
    },
    {
        "venue": {
            "name": "Vogel State Park",
            "slug": "vogel-state-park",
            "address": "405 Vogel State Park Rd",
            "city": "Blairsville",
            "state": "GA",
            "zip": "30512",
            "lat": 34.7656,
            "lng": -83.9289,
            "website": "https://gastateparks.org/Vogel",
            "place_type": "park",
            "short_description": "One of Georgia's oldest state parks with Lake Trahlyta and a trailhead for Blood Mountain via Byron Reece.",
            "description": "Vogel State Park, one of Georgia's oldest (1931), sits at the foot of Blood Mountain in the Chattahoochee National Forest. Lake Trahlyta has a swimming beach. The Byron Herbert Reece trailhead across US-19 is the most popular starting point for Blood Mountain, highest point on the AT in Georgia. Excellent fall foliage.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season", "cool-weather"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle",
        },
    },
    {
        "venue": {
            "name": "Unicoi State Park",
            "slug": "unicoi-state-park",
            "address": "1788 GA-356",
            "city": "Helen",
            "state": "GA",
            "zip": "30545",
            "lat": 34.7116,
            "lng": -83.7216,
            "website": "https://gastateparks.org/Unicoi",
            "place_type": "park",
            "short_description": "Mountain park near Alpine Helen with Anna Ruby Falls access, lake beach, and barrel cabin lodging.",
            "description": "Unicoi State Park offers a full resort experience in the Blue Ridge foothills near the Alpine village of Helen. Unicoi Lake has a sandy beach and pedal boat rentals. The park borders Anna Ruby Falls Recreation Area (USFS, $3 separate entry), a short 0.4-mile walk to twin cascades. Barrel cabins, lodge, and campground available.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "leaf-season", "all-season"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle; Anna Ruby Falls $3 extra",
        },
    },
    {
        "venue": {
            "name": "Fort Mountain State Park",
            "slug": "fort-mountain-state-park",
            "address": "181 Fort Mountain Park Rd",
            "city": "Chatsworth",
            "state": "GA",
            "zip": "30705",
            "lat": 34.7636,
            "lng": -84.6958,
            "website": "https://gastateparks.org/FortMountain",
            "place_type": "park",
            "short_description": "A mysterious 855-foot stone wall at the summit, fire tower views, and the 8-mile Gahuti backcountry trail.",
            "description": "Fort Mountain State Park is named for a mysterious 855-foot stone wall of unknown origin near the summit. A restored CCC-era fire tower at the summit offers views of the Cohutta Wilderness. The challenging 8-mile Gahuti backpacking loop offers solitude. The park also has a lake beach and mountain biking trails.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["clear-day", "leaf-season", "cool-weather"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle",
        },
    },
    {
        "venue": {
            "name": "F.D. Roosevelt State Park",
            "slug": "fd-roosevelt-state-park",
            "address": "2970 GA-190",
            "city": "Pine Mountain",
            "state": "GA",
            "zip": "31822",
            "lat": 32.8526,
            "lng": -84.7366,
            "website": "https://gastateparks.org/FDRoosevelt",
            "place_type": "park",
            "short_description": "Georgia's largest state park with the 23-mile Pine Mountain Trail, FDR's pools, and Dowdell's Knob overlook.",
            "description": "F.D. Roosevelt State Park is the largest state park in Georgia at 9,049 acres, encompassing the Pine Mountain Ridge near Warm Springs. The 23-mile Pine Mountain Trail traverses the ridge end-to-end. FDR's warm springs swimming pools are preserved nearby. Dowdell's Knob overlook was FDR's favorite picnic spot with sweeping valley views.",
            "typical_duration_minutes": 360,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["clear-day", "cool-weather", "leaf-season"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle",
        },
    },
    {
        "venue": {
            "name": "Fort Yargo State Park",
            "slug": "fort-yargo-state-park",
            "address": "210 S Broad St",
            "city": "Winder",
            "state": "GA",
            "zip": "30680",
            "lat": 33.9886,
            "lng": -83.7320,
            "website": "https://gastateparks.org/FortYargo",
            "place_type": "park",
            "short_description": "1792 blockhouse, lake swimming beach, mountain biking trails, and Georgia's only Will-A-Way accessible recreation area.",
            "description": "Fort Yargo State Park preserves a 1792 log blockhouse built by settlers for protection. Lake Marburg has a sandy swimming beach. The park features Georgia's only Will-A-Way recreation area with fully accessible facilities. 15 miles of mountain biking trails with beginner through expert options.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "hour",
            "destination_type": "state_park",
            "primary_activity": "mountain_biking",
            "difficulty_level": "easy",
            "drive_time_minutes": 60,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "all-season"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle",
        },
    },
    {
        "venue": {
            "name": "Hard Labor Creek State Park",
            "slug": "hard-labor-creek-state-park",
            "address": "5765 Knox Chapel Rd",
            "city": "Rutledge",
            "state": "GA",
            "zip": "30663",
            "lat": 33.6345,
            "lng": -83.6238,
            "website": "https://gastateparks.org/HardLaborCreek",
            "place_type": "park",
            "short_description": "Horseback riding, public golf, Lake Rutledge, and some of Georgia's best accessible fall foliage color.",
            "description": "Hard Labor Creek State Park is best known for two things: horseback riding (equestrian campground and rental horses) and consistently excellent fall foliage — the hardwood forest turns brilliant red and orange. Lake Rutledge has a beach and fishing. The park also operates a public golf course with reasonable greens fees.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "easy",
            "drive_time_minutes": 60,
            "best_seasons": ["fall", "spring", "summer"],
            "weather_fit_tags": ["leaf-season", "clear-day", "all-season"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle",
        },
    },
    {
        "venue": {
            "name": "Don Carter State Park",
            "slug": "don-carter-state-park",
            "address": "5000 N Browning Bridge Rd",
            "city": "Gainesville",
            "state": "GA",
            "zip": "30506",
            "lat": 34.3817,
            "lng": -83.8371,
            "website": "https://gastateparks.org/DonCarter",
            "place_type": "park",
            "short_description": "Georgia's newest state park on Lake Lanier with premium paddling, mountain biking, and waterfront camping.",
            "description": "Don Carter State Park opened in 2013 as Georgia's newest state park, occupying 1,300 acres of pristine Lake Lanier shoreline. The park features 11 miles of mountain biking and hiking trails, a boat ramp and kayak launch, and premium waterfront campsites. One of the best paddling access points on Lanier with uncrowded coves.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "mountain_biking",
            "difficulty_level": "easy",
            "drive_time_minutes": 60,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "clear-day"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle",
        },
    },
    {
        "venue": {
            "name": "Tugaloo State Park",
            "slug": "tugaloo-state-park",
            "address": "1763 Tugaloo State Park Rd",
            "city": "Lavonia",
            "state": "GA",
            "zip": "30553",
            "lat": 34.4847,
            "lng": -83.0789,
            "website": "https://gastateparks.org/Tugaloo",
            "place_type": "park",
            "short_description": "Peninsula park jutting into Lake Hartwell — excellent fishing, water sports, and quiet lakeside camping.",
            "description": "Tugaloo State Park occupies a peninsula extending into Lake Hartwell on the Georgia-South Carolina border. The park is excellent for fishing (bass, catfish, bream), boating, and watersking. Mini golf, tennis, and a swimming beach round out the family appeal. Campground and cottages available right on the water.",
            "typical_duration_minutes": 300,
            "explore_category": "outdoors",
            "vibes": ["family-friendly"],
        },
        "details": {
            "commitment_tier": "weekend",
            "destination_type": "state_park",
            "primary_activity": "swimming",
            "difficulty_level": "easy",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["summer-friendly", "clear-day"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle",
        },
    },
    {
        "venue": {
            "name": "Sprewell Bluff Park",
            "slug": "sprewell-bluff-park",
            "address": "740 Sprewell Bluff Rd",
            "city": "Thomaston",
            "state": "GA",
            "zip": "30286",
            "lat": 32.9571,
            "lng": -84.4882,
            "website": "https://www.upsonco.com/departments/parks/sprewell-bluff",
            "place_type": "park",
            "short_description": "Dramatic 200-foot rocky bluffs over the Flint River with riverside hiking, swimming holes, and primitive camping.",
            "description": "Sprewell Bluff Park is an undervisited Upson County gem featuring dramatic 200-foot rocky bluffs rising directly from the Flint River. The bluffs create scenic overlooks and the riverside trail passes several swimming holes accessible when the river is calm. Primitive camping available. A quiet alternative to state park crowds.",
            "typical_duration_minutes": 240,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "state_park",
            "primary_activity": "hiking",
            "difficulty_level": "moderate",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["clear-day", "cool-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "Free (county park)",
        },
    },
    {
        "venue": {
            "name": "Brasstown Bald",
            "slug": "brasstown-bald",
            "address": "2941 GA-180 Spur",
            "city": "Hiawassee",
            "state": "GA",
            "zip": "30546",
            "lat": 34.8742,
            "lng": -83.8103,
            "website": "https://www.fs.usda.gov/recarea/conf/recreation/recarea/?recid=10638",
            "place_type": "trail",
            "short_description": "Georgia's highest point at 4,784 ft with a 360-degree observation deck overlooking four states.",
            "description": "Brasstown Bald is Georgia's highest point at 4,784 feet. The observation deck atop the summit offers a 360-degree panorama spanning Georgia, North Carolina, South Carolina, and Tennessee on clear days. A paved 0.4-mile trail climbs steeply from the parking lot to the summit visitor center, or a shuttle van runs on busy weekends.",
            "typical_duration_minutes": 180,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "fullday",
            "destination_type": "summit",
            "primary_activity": "summit_hike",
            "difficulty_level": "moderate",
            "drive_time_minutes": 120,
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["clear-day", "leaf-season", "cool-weather"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "yes",
            "reservation_required": False,
            "fee_note": "$5/vehicle USFS day-use",
        },
    },
    {
        "venue": {
            "name": "Blood Mountain",
            "slug": "blood-mountain-ga",
            "address": "3880 US-19",
            "city": "Blairsville",
            "state": "GA",
            "zip": "30512",
            "lat": 34.7408,
            "lng": -83.9374,
            "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10526",
            "place_type": "trail",
            "short_description": "Highest point on the Appalachian Trail in Georgia at 4,458 ft — strenuous 4-mile round trip from Byron Reece trailhead.",
            "description": "Blood Mountain (4,458 ft) is the highest point on the Appalachian Trail in Georgia and one of the most popular hikes in the state. The Byron Herbert Reece trailhead on US-19 provides the most direct access — 2 miles of sustained climbing to the stone summit shelter with views into North Carolina. Named for a brutal Cherokee-Creek battle fought on its slopes.",
            "typical_duration_minutes": 210,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "summit",
            "primary_activity": "summit_hike",
            "difficulty_level": "hard",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["clear-day", "cool-weather", "dry-weather"],
            "parking_type": "paid_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
            "fee_note": "$5/vehicle USFS day-use at Byron Reece trailhead",
        },
    },
    {
        "venue": {
            "name": "Yonah Mountain",
            "slug": "yonah-mountain",
            "address": "Chambers Rd",
            "city": "Cleveland",
            "state": "GA",
            "zip": "30528",
            "lat": 34.6255,
            "lng": -83.7018,
            "website": "https://www.fs.usda.gov/recarea/conf/recarea/?recid=10643",
            "place_type": "trail",
            "short_description": "Iconic granite face visible from the valley below — steep 4.4-mile summit hike popular with Atlanta hikers.",
            "description": "Yonah Mountain's sheer granite faces make it one of the most recognizable mountains in North Georgia, visible for miles across the Cleveland valley. The summit trail is 4.4 miles roundtrip with 1,600 feet of elevation gain — steep and rocky in places, but the bald summit offers sweeping views north and south. Also a popular rock climbing destination with established routes.",
            "typical_duration_minutes": 210,
            "explore_category": "outdoors",
            "vibes": [],
        },
        "details": {
            "commitment_tier": "halfday",
            "destination_type": "summit",
            "primary_activity": "summit_hike",
            "difficulty_level": "hard",
            "drive_time_minutes": 90,
            "best_seasons": ["spring", "fall"],
            "weather_fit_tags": ["clear-day", "cool-weather", "dry-weather"],
            "parking_type": "free_lot",
            "dog_friendly": True,
            "family_suitability": "caution",
            "reservation_required": False,
            "fee_note": "Free (USFS)",
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
        description="Seed Yonder Wave 11 Georgia state parks and major trails."
    )
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Update existing venues with curated Wave 11 fields.",
    )
    args = parser.parse_args()

    client = get_client()
    created = 0
    updated = 0
    skipped = 0
    details_upserted = 0

    logger.info("=" * 68)
    logger.info("Yonder Wave 11 Georgia State Parks & Major Trails Seed")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("Refresh existing: %s", args.refresh_existing)
    logger.info("")

    for entry in WAVE_11_DESTINATIONS:
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
