"""
Crawler for recurring weekly social events across Atlanta.

Generates events for:
- Open mics (comedy, music, poetry)
- Karaoke nights
- Game nights
- Bingo nights

Based on weekly schedules discovered from badslava.com and venue research.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlparse

from db import (
    get_client,
    get_or_create_venue,
    insert_event,
    find_existing_event_for_insert,
    find_cross_source_canonical_for_insert,
    smart_update_existing_event,
    writes_enabled,
)
from dedupe import generate_content_hash
from closed_venues import CLOSED_VENUE_SLUGS

logger = logging.getLogger(__name__)

# How many weeks ahead to generate events
WEEKS_AHEAD = 6

# Day mapping for recurrence rules
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]

# ============================================
# VENUE DEFINITIONS
# ============================================

VENUES = {
    # Karaoke venues
    "metalsome": {
        "name": "Metalsome Live Band Karaoke",
        "slug": "metalsome-live-band-karaoke",
        "address": "1092 Briarcliff Pl NE",
        "neighborhood": "Briarcliff",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
        "website": "http://metalsomelivebandkaraoke.com/",
    },
    "copper-cove": {
        "name": "Copper Cove Restaurant & Lounge",
        "slug": "copper-cove-restaurant-lounge",
        "address": "1782 Cheshire Bridge Rd NE",
        "neighborhood": "Cheshire Bridge",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30324",
        "venue_type": "restaurant",
        "website": "https://www.coppercoveatl.com/",
    },
    # "boggs" — handled by dedicated source (sources/boggs_social.py)
    "ten-atl": {
        "name": "TEN ATL",
        "slug": "ten-atl",
        "address": "495 Flat Shoals Ave SE",
        "neighborhood": "East Atlanta",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
        "website": "https://tenatl.com/",
    },
    "daiquiriville": {
        "name": "Daiquiriville",
        "slug": "daiquiriville",
        "address": "50 Upper Alabama St SW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "venue_type": "bar",
        "website": "https://daiquiriville.myportfolio.com/menu",
    },
    "roll-1-cafe": {
        "name": "Roll 1 Cafe",
        "slug": "roll-1-cafe",
        "address": "1917 Pryor Road Suite F",
        "neighborhood": "Lakewood",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30315",
        "venue_type": "cafe",
        "website": "http://roll1cafe.com/",
    },
    "your-3rd-spot": {
        "name": "Your 3rd Spot",
        "slug": "your-3rd-spot",
        "address": "400 Chattahoochee Row NW",
        "neighborhood": "Upper Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "bar",
        "website": "http://www.your3rdspot.com/",
    },
    "smiths-olde-bar": {
        "name": "Smith's Olde Bar",
        "slug": "smiths-olde-bar",
        "address": "1578 Piedmont Ave NE",
        "neighborhood": "Ansley Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30324",
        "venue_type": "bar",
        "website": "https://www.sobatl.com",
    },
    # "metro-fun-center" — PERMANENTLY CLOSED (Sept 2022)
    "metro-fun-center": {
        "name": "Metro Fun Center",
        "slug": "metro-fun-center",
        "address": "1959 Metropolitan Pkwy SW",
        "neighborhood": "Lakewood",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30315",
        "venue_type": "entertainment_venue",
        # CLOSED — do not add website
    },
    # Open mic venues
    "joes-coffeehouse": {
        "name": "Joe's Coffeehouse",
        "slug": "joes-coffeehouse",
        "address": "510 Flat Shoals Ave SE",
        "neighborhood": "East Atlanta",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "cafe",
        "website": "https://www.joescoffeehouseeav.com/",
    },
    "our-bar-atl": {
        "name": "Our Bar ATL",
        "slug": "our-bar-atl",
        "address": "339 Edgewood Ave SE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "bar",
        "website": "https://www.ourbaratl.com/",
    },
    "southern-feed-store": {
        "name": "Southern Feed Store",
        "slug": "southern-feed-store",
        "address": "1245 Glenwood Ave SE Suite 6",
        "neighborhood": "East Atlanta",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
        "website": "https://www.sfseav.com/",
    },
    # "laughing-skull" — handled by dedicated source (sources/laughing_skull.py)
    "limerick-junction": {
        "name": "Limerick Junction",
        "slug": "limerick-junction",
        "address": "822 N Highland Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
        "website": "https://www.limerickjunction.com",
    },
    "limelight-theater": {
        "name": "Limelight Theater",
        "slug": "limelight-theater",
        "address": "349 Decatur St SE",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "theater",
        "website": "https://limelight.tix.page/",
    },
    "farm-burger": {
        "name": "Farm Burger Midtown",
        "slug": "farm-burger-midtown",
        "address": "22 14th St NW Suite D",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "restaurant",
        "website": "https://farmburger.com",
    },
    "red-light-cafe": {
        "name": "Red Light Cafe",
        "slug": "red-light-cafe",
        "address": "553 Amsterdam Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "cafe",
        "website": "https://redlightcafe.com",
    },
    "pullman-yards": {
        "name": "Pullman Yards",
        "slug": "pullman-yards",
        "address": "225 Rogers St NE",
        "neighborhood": "Kirkwood",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30317",
        "venue_type": "event_venue",
        "website": "https://pullmanyards.com",
    },
    "asw-whiskey": {
        "name": "ASW Whiskey Exchange",
        "slug": "asw-whiskey-exchange",
        "address": "1000 White St SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30310",
        "venue_type": "bar",
        "website": "https://aswdistillery.com",
    },
    "atlantucky": {
        "name": "Atlantucky Brewing",
        "slug": "atlantucky-brewing",
        "address": "170 Northside Dr SW Suite 96",
        "neighborhood": "English Avenue",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "venue_type": "brewery",
        "website": "https://atlantucky.com",
    },
    "urban-grind": {
        "name": "Urban Grind",
        "slug": "urban-grind",
        "address": "962 Marietta St NW",
        "neighborhood": "Home Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "cafe",
        "website": "https://urbangrindatlanta.com",
    },
    "kats-cafe": {
        "name": "Kat's Cafe",
        "slug": "kats-cafe",
        "address": "970 Piedmont Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "cafe",
        "website": "https://katscafeatlanta.com",
    },
    "battery-atlanta": {
        "name": "The Battery Atlanta",
        "slug": "the-battery-atlanta",
        "address": "800 Battery Ave SE",
        "neighborhood": "The Battery",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30339",
        "venue_type": "entertainment_venue",
        "website": "https://batteryatl.com",
    },
    "park-bench-battery": {
        "name": "Park Bench Battery",
        "slug": "park-bench-battery",
        "address": "900 Battery Ave, Ste 1060",
        "neighborhood": "The Battery",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30339",
        "lat": 33.8905,
        "lng": -84.4680,
        "venue_type": "bar",
        "spot_type": "bar",
        "website": "https://parkbenchbattery.com",
        "vibes": ["live-music", "karaoke", "dueling-pianos", "late-night", "21+"],
    },
    "joystick": {
        "name": "Joystick Gamebar",
        "slug": "joystick-gamebar",
        "address": "427 Edgewood Ave SE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "bar",
        "website": "https://joystickgamebar.com",
    },
    "peters-street": {
        "name": "Peters Street Station",
        "slug": "peters-street-station",
        "address": "333 Peters St SW",
        "neighborhood": "Castleberry Hill",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "venue_type": "bar",
        "website": "https://www.instagram.com/petersstreetstation/",
    },
    "dynamic-el-dorado": {
        "name": "Dynamic El Dorado",
        "slug": "dynamic-el-dorado",
        "address": "572 Edgewood Ave SE #116",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "bar",
        "website": "http://dynamiceldorado.com/",
    },
    "529-bar": {
        "name": "529",
        "slug": "529-bar",
        "address": "529 Flat Shoals Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
        "website": "https://529atlanta.com",
    },
    # Game night venues
    "jasons-deli": {
        "name": "Jason's Deli Dunwoody",
        "slug": "jasons-deli-dunwoody",
        "address": "4705 Ashford Dunwoody Rd",
        "neighborhood": "Dunwoody",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30338",
        "venue_type": "restaurant",
        "website": "https://jasonsdeli.com",
    },
    "manuels-tavern": {
        "name": "Manuel's Tavern",
        "slug": "manuels-tavern",
        "address": "602 N Highland Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "bar",
        "website": "https://manuelstavern.com",
    },
    "church-epiphany": {
        "name": "Church of the Epiphany",
        "slug": "church-of-the-epiphany",
        "address": "2089 Ponce De Leon Ave NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "community_center",
        "website": "http://www.epiphany.org/",
    },
    # Bingo venues
    "punch-bowl": {
        "name": "Punch Bowl Social",
        "slug": "punch-bowl-social",
        "address": "875 Battery Ave SE Ste 720",
        "neighborhood": "The Battery",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30339",
        "venue_type": "entertainment_venue",
        "website": "https://punchbowlsocial.com",
    },
    # "blue-martini" — PERMANENTLY CLOSED (mid-2025)
    "blue-martini": {
        "name": "Blue Martini Atlanta",
        "slug": "blue-martini-atlanta",
        "address": "3402 Piedmont Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "venue_type": "bar",
        # CLOSED — do not add website
    },
    # Jazz & Blues venues
    "cafe-circa": {
        "name": "Cafe Circa",
        "slug": "cafe-circa",
        "address": "464 Edgewood Ave SE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "restaurant",
        "website": "https://www.cafecircaatlanta.com/",
    },
    "churchill-grounds": {
        "name": "Churchill Grounds",
        "slug": "churchill-grounds",
        "address": "660 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "cafe",
        "website": "https://churchillgrounds.com",
    },
    "elliott-street-pub": {
        "name": "Elliott Street Deli & Pub",
        "slug": "elliott-street-pub",
        "address": "51 Elliott St SW",
        "neighborhood": "Castleberry Hill",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "venue_type": "bar",
        "website": "https://www.facebook.com/elliottstreetdeli",
    },
    # Additional trivia venues
    "brick-store-pub": {
        "name": "Brick Store Pub",
        "slug": "brick-store-pub",
        "address": "125 E Court Square",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "venue_type": "bar",
        "website": "https://brickstorepub.com",
    },
    "the-porter": {
        "name": "The Porter Beer Bar",
        "slug": "the-porter-beer-bar",
        "address": "1156 Euclid Ave NE",
        "neighborhood": "Little Five Points",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "bar",
        "website": "https://theporterbeerbar.com",
    },
    "wrecking-bar": {
        "name": "Wrecking Bar Brewpub",
        "slug": "wrecking-bar-brewpub",
        "address": "292 Moreland Ave NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "brewery",
        "website": "https://wreckingbarbrewpub.com",
    },
    # Additional karaoke venues
    "sister-louisas": {
        "name": "Sister Louisa's Church of the Living Room & Ping Pong Emporium",
        "slug": "sister-louisas-church",
        "address": "466 Edgewood Ave SE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "bar",
        "website": "https://www.sisterlouisaschurch.com",
    },
    # ========== Phase 0b: New recurring venue additions ==========
    # Trivia venues
    "thinking-man": {
        "name": "Thinking Man Tavern",
        "slug": "thinking-man-tavern",
        "address": "537 W Howard Ave",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "venue_type": "bar",
        "website": "https://thinkingmantavern.com",
    },
    "righteous-room": {
        "name": "Righteous Room",
        "slug": "righteous-room",
        "address": "1051 Ponce De Leon Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
        "website": "http://www.stayrighteous.com",
    },
    "the-local": {
        "name": "The Local",
        "slug": "the-local-ponce-city-market",
        "address": "675 Ponce De Leon Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "bar",
        "website": "http://thelocalkaraoke.com/home.php",
    },
    "twains": {
        "name": "Twain's Billiards & Tap",
        "slug": "twains-billiards-tap",
        "address": "211 E Trinity Pl",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "venue_type": "bar",
        "website": "https://twains.net",
    },
    # DJ / nightclub venues
    "mjq-concourse": {
        "name": "MJQ Concourse",
        "slug": "mjq-concourse",
        "address": "50 Lower Alabama St",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "venue_type": "nightclub",
        "website": "https://www.mjqofficial.com/",
    },
    # The Music Room — CLOSED permanently (COVID casualty, Sep 2020)
    # "music-room": { ... },
    "johnny-hideaway": {
        "name": "Johnny's Hideaway",
        "slug": "johnnys-hideaway",
        "address": "3771 Roswell Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30342",
        "venue_type": "nightclub",
        "website": "https://johnnyshideaway.com",
    },
    # Drag venues
    "burkharts": {
        "name": "Burkhart's Pub",
        "slug": "burkharts-pub",
        "address": "1492 Piedmont Ave NE",
        "neighborhood": "Ansley Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "bar",
        "website": "https://www.burkharts.com",
    },
    "my-sisters-room": {
        "name": "My Sister's Room",
        "slug": "my-sisters-room",
        "address": "222 E Howard Ave",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "venue_type": "bar",
        "website": "https://www.mysistersroom.com",
    },
    # Fontaine's Oyster House — CLOSED permanently (removed 2026-03)
    # Live music / residency venues
    "apache-cafe": {
        "name": "Apache XLR",
        "slug": "apache-xlr",
        "address": "393 Marietta St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "venue_type": "bar",
        "website": "https://apachexlr.com/",
    },
    "dieselfillingstation": {
        "name": "Diesel Filling Station",
        "slug": "diesel-filling-station",
        "address": "870 N Highland Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
        "website": "https://www.dieselfillingstation.com",
    },
    # Farmers markets
    "piedmont-park-green-market": {
        "name": "Piedmont Park Green Market",
        "slug": "piedmont-park-green-market",
        "address": "400 Park Dr NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "farmers_market",
        "website": "https://piedmontpark.org/green-market",
    },
    "peachtree-road-farmers-market": {
        "name": "Peachtree Road Farmers Market",
        "slug": "peachtree-road-farmers-market",
        "address": "2744 Peachtree Rd NW",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "venue_type": "farmers_market",
        "website": "https://peachtreeroadfarmersmarket.com",
    },
    # Brunch / food-scene venues
    "ladybird": {
        "name": "Ladybird Grove & Mess Hall",
        "slug": "ladybird-grove-mess-hall",
        "address": "684 John Wesley Dobbs Ave NE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "bar",
        "website": "http://www.ladybirdatl.com/",
    },
    # ========== Phase 2: Neighborhood + day gap fills ==========
    # Little Five Points (the-porter and wrecking-bar defined above in trivia section)
    "elmyr": {
        "name": "Elmyr",
        "slug": "elmyr",
        "address": "1091 Euclid Ave NE",
        "neighborhood": "Little Five Points",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "restaurant",
        "website": "https://elmyr.com",
    },
    # Inman Park
    "barcelona-wine-bar": {
        "name": "Barcelona Wine Bar",
        "slug": "barcelona-wine-bar-inman-park",
        "address": "240 N Highland Ave NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "bar",
        "website": "https://barcelonawinebar.com",
    },
    "victory-sandwich-bar": {
        "name": "Victory Sandwich Bar",
        "slug": "victory-sandwich-bar",
        "address": "913 Bernina Ave NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "bar",
        "website": "https://www.vicsandwich.com",
    },
    "new-realm-brewing": {
        "name": "New Realm Brewing",
        "slug": "new-realm-brewing",
        "address": "550 Somerset Terrace NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "brewery",
        "website": "https://newrealmbrewing.com",
    },
    "krog-street-market": {
        "name": "Krog Street Market",
        "slug": "krog-street-market",
        "address": "99 Krog St NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "food_hall",
        "website": "https://www.thekrogdistrict.com",
    },
    # East Atlanta Village (expanding existing thin coverage)
    # "the-glenwood" — PERMANENTLY CLOSED (Oct 2023), moved to closed_venues.py
    "flatiron": {
        "name": "Flatiron",
        "slug": "flatiron-eav",
        "address": "520 Flat Shoals Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
        "website": "https://flatironatl.com",
    },
    "marys-bar": {
        "name": "Mary's",
        "slug": "marys-bar",
        "address": "1287 Glenwood Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
        "website": "https://www.marysatlanta.com",
    },
    # Sunday gap fills
    "northside-tavern": {
        "name": "Northside Tavern",
        "slug": "northside-tavern",
        "address": "1058 Howell Mill Rd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "bar",
        "website": "https://northsidetavern.com",
    },
    "park-tavern": {
        "name": "Park Tavern",
        "slug": "park-tavern",
        "address": "500 10th St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "bar",
        "website": "https://parktavern.com",
    },
    "the-painted-pin": {
        "name": "The Painted Pin",
        "slug": "the-painted-pin",
        "address": "737 Miami Cir NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30324",
        "venue_type": "bar",
        "website": "https://thepaintedpin.com",
    },
    # star-community-bar: handled by dedicated source (id=456) with recurring upgrade
    "fado-irish-pub": {
        "name": "Fado Irish Pub",
        "slug": "fado-irish-pub-buckhead",
        "address": "273 Buckhead Ave NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "venue_type": "bar",
        "website": "https://fadoirishpub.com/atlanta",
    },
    "steady-hand-beer": {
        "name": "Steady Hand Beer Co.",
        "slug": "steady-hand-beer",
        "address": "1611 Ellsworth Industrial Blvd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "brewery",
        "website": "https://www.steadyhandbeer.com",
    },
    "cherry-street-brewing": {
        "name": "Cherry Street Brewing",
        "slug": "cherry-street-brewing-west-midtown",
        "address": "1397 Ellsworth Industrial Blvd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "brewery",
        "website": "https://www.cherrystreetbrewing.com",
    },
    "three-taverns": {
        "name": "Three Taverns Imaginarium",
        "slug": "three-taverns-imaginarium",
        "address": "575 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "brewery",
        "website": "https://www.threetavernsbrewery.com",
    },
    "genes-bbq": {
        "name": "Gene's BBQ",
        "slug": "genes-bbq-kirkwood",
        "address": "1802 Hosea L Williams Dr NE",
        "neighborhood": "Kirkwood",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30317",
        "venue_type": "bar",
        "website": "https://www.genesgenesgenes.com",
    },
    "brewhouse-cafe": {
        "name": "Brewhouse Cafe",
        "slug": "brewhouse-cafe",
        "address": "401 Moreland Ave NE",
        "neighborhood": "Little Five Points",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "bar",
        "website": "https://www.brewhousecafe.com",
    },
    "whitehall-tavern": {
        "name": "Whitehall Tavern",
        "slug": "whitehall-tavern",
        "address": "2391 Peachtree Rd NW",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "lat": 33.8424,
        "lng": -84.3786,
        "venue_type": "bar",
        "website": "https://whitehall-tavern.com",
    },
    "irbys-tavern": {
        "name": "Irby's Tavern",
        "slug": "irbys-tavern",
        "address": "3556 Roswell Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "venue_type": "bar",
        "website": "https://irbystavern.com",
    },
    "woofs-atlanta": {
        "name": "Woofs Atlanta",
        "slug": "woofs-atlanta",
        "address": "494 Plasters Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "bar",
        "website": "https://woofsatlanta.com",
    },
    # atlanta-eagle: handled by dedicated source (id=138) with recurring upgrade
    # ========== GAMING / TABLETOP VENUES ==========
    # "battle-and-brew": handled by dedicated source (sources/battle_and_brew.py)
    "east-atlanta-comics": {
        "name": "East Atlanta Comics",
        "slug": "east-atlanta-comics",
        "address": "508 Flat Shoals Ave SE",
        "neighborhood": "East Atlanta",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "record_store",
        "website": "https://www.eastatlantacomics.com",
    },
    "giga-bites-cafe": {
        "name": "Giga-Bites Cafe",
        "slug": "giga-bites-cafe",
        "address": "1851 Roswell Rd",
        "neighborhood": "Marietta",
        "city": "Marietta",
        "state": "GA",
        "zip": "30062",
        "venue_type": "gaming",
        "website": "http://www.giga-bitescafe.com/",
    },
    "bone-lick-bbq": {
        "name": "Bone Lick BBQ",
        "slug": "bone-lick-bbq",
        "address": "1133 Huff Rd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "restaurant",
        "website": "https://bonelickbarbecue.com",
    },
    "my-parents-basement": {
        "name": "My Parents' Basement",
        "slug": "my-parents-basement",
        "address": "22 N Avondale Rd",
        "neighborhood": "Avondale Estates",
        "city": "Avondale Estates",
        "state": "GA",
        "zip": "30002",
        "venue_type": "bar",
        "website": "https://www.myparentsbasementcbcb.com",
    },
    # ========== RUN CLUB VENUES ==========
    # "ponce-city-market": handled by dedicated source (sources/ponce_city_market.py)
    "big-peach-running-midtown": {
        "name": "Big Peach Running Co - Midtown",
        "slug": "big-peach-running-midtown",
        "address": "800 Peachtree St NE Ste B",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "organization",
        "website": "https://www.bigpeachrunningco.com",
    },
    "milltown-arms-tavern": {
        "name": "Milltown Arms Tavern",
        "slug": "milltown-arms-tavern",
        "address": "180 Carroll St SE",
        "neighborhood": "Cabbagetown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "bar",
        "website": "https://www.milltownarmstavern.com/",
    },
    "elbow-room-buckhead": {
        "name": "Elbow Room",
        "slug": "elbow-room-buckhead",
        "address": "248 Pharr Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "venue_type": "bar",
        "website": "https://www.elbowroomatlanta.com",
    },
    # ========== DANCE VENUES ==========
    "tongue-and-groove": {
        "name": "Tongue and Groove",
        "slug": "tongue-and-groove",
        "address": "565 Main St NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30324",
        "venue_type": "nightclub",
        "website": "https://www.tandgclub.com",
    },
    # "the-heretic": handled by dedicated source (sources/the_heretic.py)
    "hot-jam-atlanta": {
        "name": "Hot Jam Atlanta",
        "slug": "hot-jam-atlanta",
        "address": "585 Wells St SW",
        "neighborhood": "Castleberry Hill",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "event_space",
        "website": "https://www.instagram.com/hotjamatl/",
    },
    # ========== SPORTS / WELLNESS VENUES ==========
    # "piedmont-park": handled by dedicated source (sources/piedmont_park.py)
    "woodruff-park": {
        "name": "Woodruff Park",
        "slug": "woodruff-park",
        "address": "91 Peachtree St NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "venue_type": "park",
        "website": "https://www.woodruffpark.org",
    },
    # ========== CYCLING / OUTDOOR VENUES ==========
    "inman-park-station": {
        "name": "Inman Park Station",
        "slug": "inman-park-station",
        "address": "133 Hurt St NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "park",
        "website": "https://www.instagram.com/bonafideriders/",
    },
    "97-estoria": {
        "name": "97 Estoria",
        "slug": "97-estoria",
        "address": "727 Wylie St SE",
        "neighborhood": "Cabbagetown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
        "website": "https://www.estoriabar.com/",  # 97estoria.com was hijacked; estoriabar.com is official
    },
    "avondale-estates-art-lot": {
        "name": "Avondale Estates Art Lot",
        "slug": "avondale-estates-art-lot",
        "address": "64 N Avondale Rd",
        "neighborhood": "Avondale Estates",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30002",
        "lat": 33.7712,
        "lng": -84.2668,
        "venue_type": "park",
        "website": "https://atlptn.com/rides/pizza-ride",
    },
    "glenlake-tennis-center": {
        "name": "Glenlake Tennis Center",
        "slug": "glenlake-tennis-center",
        "address": "1121 Church St",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "venue_type": "fitness_center",
        "website": "https://www.decaturga.com/parks-recreation",
    },
    "broad-street-boardwalk": {
        "name": "Broad Street Boardwalk",
        "slug": "broad-street-boardwalk",
        "address": "Broad St NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7568,
        "lng": -84.3912,
        "venue_type": "park",
        "website": "https://www.atlantadowntown.com/broad-street-boardwalk",
    },
    "grant-park": {
        "name": "Grant Park",
        "slug": "grant-park-park",
        "address": "625 Park Ave SE",
        "neighborhood": "Grant Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30315",
        "venue_type": "park",
        "website": "https://www.atlantaga.gov/?navid=470",
    },
    # ========== FOOD & DRINK SPECIALS VENUES ==========
    "the-optimist": {
        "name": "The Optimist",
        "slug": "the-optimist",
        "address": "914 Howell Mill Rd",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "restaurant",
        "website": "https://www.theoptimistrestaurant.com",
    },
    "watchmans-seafood": {
        "name": "Watchman's Seafood & Spirits",
        "slug": "watchmans-seafood-spirits",
        "address": "99 Krog St NE, Suite Y",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "restaurant",
        "website": "https://www.watchmans.com",
    },
    "iberian-pig-decatur": {
        "name": "The Iberian Pig",
        "slug": "iberian-pig-decatur",
        "address": "121 Sycamore St",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "venue_type": "restaurant",
        "website": "https://www.iberianpig.com",
    },
    "lloyds-atl": {
        "name": "Lloyd's Restaurant & Lounge",
        "slug": "lloyds-restaurant-lounge",
        "address": "900 DeKalb Ave NE, Unit 100",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "restaurant",
        "website": "https://www.facebook.com/lloydsinmanpark",
    },
    "antico-pizza": {
        "name": "Antico Pizza Napoletana",
        "slug": "antico-pizza",
        "address": "1093 Hemphill Ave NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "restaurant",
        "website": "https://littleitalia.com/antico/",
    },
    "bartaco-inman-park": {
        "name": "Bartaco",
        "slug": "bartaco-inman-park",
        "address": "299 N Highland Ave NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "restaurant",
        "website": "https://www.bartaco.com",
    },
    "taverna-buckhead": {
        "name": "Taverna",
        "slug": "taverna-buckhead",
        "address": "280 Buckhead Ave NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "venue_type": "restaurant",
        "website": "https://www.instagram.com/tavernarestaurantgroup/",
    },
    "pure-taqueria-inman-park": {
        "name": "Pure Taqueria",
        "slug": "pure-taqueria-inman-park",
        "address": "3589 Durden Dr",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "restaurant",
        "website": "https://www.puretaqueria.com",
    },
    "tin-lizzys-midtown": {
        "name": "Tin Lizzy's Cantina",
        "slug": "tin-lizzys-midtown",
        "address": "77 12th St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "restaurant",
        "website": "https://tinlizzyscantina.com",
    },
    "forza-storico": {
        "name": "Forza Storico",
        "slug": "forza-storico",
        "address": "1198 Howell Mill Rd",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "restaurant",
        "website": "https://forzastorico.com",
    },
    "cypress-street-pint": {
        "name": "Cypress Street Pint & Plate",
        "slug": "cypress-street-pint-plate",
        "address": "817 W Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "bar",
        "website": "http://cypressatl.com/",
    },
    "beso-buckhead": {
        "name": "Beso Buckhead",
        "slug": "beso-buckhead",
        "address": "3035 Peachtree Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "venue_type": "restaurant",
        "website": "https://besoatl.com",
    },
    # "fontaines-oyster-house" — use existing key "fontaines" (added in Phase 0b)
    "beetlecat": {
        "name": "BeetleCat",
        "slug": "beetlecat",
        "address": "299 N Highland Ave NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "restaurant",
        "website": "https://beetlecatatl.com",
    },
    "pielands": {
        "name": "Pielands Sub & Slice",
        "slug": "pielands-virginia-highland",
        "address": "1021 Virginia Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "restaurant",
        "website": "https://www.pielands.com",
    },
    "wild-heaven-avondale": {
        "name": "Wild Heaven Beer (Avondale)",
        "slug": "wild-heaven-avondale",
        "address": "135 Maple St",
        "neighborhood": "Avondale Estates",
        "city": "Decatur",
        "state": "GA",
        "zip": "30002",
        "venue_type": "brewery",
        "website": "https://wildheavenbeer.com",
    },
    "wild-heaven-toco-hills": {
        "name": "Wild Heaven x Fox Bros (Toco Hills)",
        "slug": "wild-heaven-toco-hills",
        "address": "2935B N Druid Hills Rd NE",
        "neighborhood": "Toco Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "venue_type": "brewery",
        "website": "https://wildheavenbeer.com",
    },
    "superica-krog": {
        "name": "Superica",
        "slug": "superica-krog-street",
        "address": "99 Krog St NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "restaurant",
        "website": "https://superica.com",
    },
    # "fado-irish-pub" key = Buckhead location (273 Buckhead Ave NE) — already exists
    "fado-midtown": {
        "name": "Fado Irish Pub",
        "slug": "fado-irish-pub-midtown",
        "address": "933 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "bar",
        "website": "https://www.fadoirishpub.com/atlanta",
    },
    # ========== Regular Hangs buildout ==========
    # Poker venues
    # "aces-up-atlanta" — removed, not a venue (bar poker league that plays at various bars)
    "eddies-attic": {
        "name": "Eddie's Attic",
        "slug": "eddies-attic",
        "address": "515-B N McDonough St",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "venue_type": "music_venue",
        "website": "https://eddiesattic.com",
    },
    # Improv venues
    "dads-garage": {
        "name": "Dad's Garage Theatre",
        "slug": "dads-garage-theatre",
        "address": "569 Ezzard St SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "theater",
        "website": "https://dadsgarage.com",
    },
    # "village-theatre" — REMOVED, cannot verify (Squarespace expired, no evidence of current operation)
    "whole-world-improv": {
        "name": "Whole World Improv Theatre",
        "slug": "whole-world-improv-theatre",
        "address": "1216 Spring St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "theater",
        "website": "https://wholeworldtheatre.com",
    },
    # Skate venues
    "cascade-skating": {
        "name": "Cascade Family Skating",
        "slug": "cascade-family-skating",
        "address": "3335 Martin Luther King Jr Dr SW",
        "neighborhood": "Cascade",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30331",
        "venue_type": "entertainment_venue",
        "website": "https://cascadefamilyskating.com",
    },
    "sparkles-kennesaw": {
        "name": "Sparkles Family Fun Center",
        "slug": "sparkles-family-fun-center-kennesaw",
        "address": "1000 McCollum Pkwy NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "entertainment_venue",
        "website": "https://www.sparkles.com",
    },
    # Latin night venues — uses same slug as dedicated crawler (havana_club.py)
    "havana-club": {
        "name": "Havana Club",
        "slug": "havana-club",
        "address": "3112 Piedmont Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "venue_type": "nightclub",
        "website": "https://www.havanaclubatl.com",
    },
    # "el-bar" — PERMANENTLY CLOSED, replaced by Bar ANA (2026-03)
    "el-bar": {
        "name": "El Bar",
        "slug": "el-bar",
        "address": "939 Ponce De Leon Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
        # CLOSED — do not add website
    },
    # Viewing party / sports bar venues
    "hudson-grille-midtown": {
        "name": "Hudson Grille Midtown",
        "slug": "hudson-grille-midtown",
        "address": "942 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "sports_bar",
        "website": "https://hudsongrille.com",
    },
    "stats-brewpub": {
        "name": "STATS Brewpub",
        "slug": "stats-brewpub",
        "address": "300 Marietta St NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "venue_type": "sports_bar",
        "website": "http://www.statsatl.com/",
    },
    # Additional bingo venue
    "monday-night-garage": {
        "name": "Monday Night Brewing Garage",
        "slug": "monday-night-brewing-garage",
        "address": "933 Lee St SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30310",
        "venue_type": "brewery",
        "website": "https://mondaynightbrewing.com",
    },
    # ========== LISTENING BARS / VINYL ==========
    "commune": {
        "name": "Commune",
        "slug": "commune",
        "address": "6 Olive St, Ste 113",
        "neighborhood": "Avondale Estates",
        "city": "Avondale Estates",
        "state": "GA",
        "zip": "30002",
        "venue_type": "bar",
        "website": "https://www.communeatl.com",
    },
    "westside-motor-lounge": {
        "name": "Westside Motor Lounge",
        "slug": "westside-motor-lounge",
        "address": "725 Echo St NW",
        "neighborhood": "English Avenue",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "bar",
        "website": "https://www.westsidemotorlounge.com",
    },
    "stereo-atl": {
        "name": "Stereo",
        "slug": "stereo-atl",
        "address": "900 DeKalb Ave NE",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "bar",
        "website": "https://www.stereoatl.com",
    },
    # ========== PUB RUNS / CYCLING ==========
    "midway-pub": {
        "name": "Midway Pub",
        "slug": "midway-pub",
        "address": "552 Flat Shoals Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
        "website": "https://www.themidwaypub.com",
    },
    # ========== BOOKSTORES ==========
    "charis-books": {
        "name": "Charis Books & More",
        "slug": "charis-books-and-more",
        "address": "184 S Candler St",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "venue_type": "bookstore",
        "website": "https://www.charisbooksandmore.com",
    },
    "a-cappella-books": {
        "name": "A Cappella Books",
        "slug": "a-cappella-books",
        "address": "484 Moreland Ave NE",
        "neighborhood": "Little Five Points",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "bookstore",
        "website": "https://www.acappellabooks.com",
    },
    # ========== OUTDOOR MOVIES ==========
    "colony-square": {
        "name": "Colony Square",
        "slug": "colony-square",
        "address": "1197 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30361",
        "venue_type": "event_space",
        "website": "https://www.colonysquare.com",
    },
    "atlantic-station": {
        "name": "Atlantic Station",
        "slug": "atlantic-station",
        "address": "1380 Atlantic Dr NW",
        "neighborhood": "Atlantic Station",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30363",
        "venue_type": "event_space",
        "website": "https://www.atlanticstation.com",
    },
    # ========== Tasting venues ==========
    "reverence-epicurean": {
        "name": "Reverence at Epicurean Atlanta",
        "slug": "reverence-epicurean",
        "address": "1117 West Peachtree St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "restaurant",
        "website": "https://reverenceatlanta.com",
    },
    "3-parks-wine-shop": {
        "name": "3 Parks Wine Shop",
        "slug": "3-parks-wine-shop",
        "address": "451 Bill Kennedy Way SE",
        "neighborhood": "Glenwood Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "wine_bar",
        "website": "https://3parkswine.com",
    },
    "city-winery-atlanta": {
        "name": "City Winery Atlanta",
        "slug": "city-winery-atlanta",
        "address": "650 North Ave NE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "wine_bar",
        "website": "https://citywinery.com/atlanta",
    },
    "vinoteca-atl": {
        "name": "VinoTeca ATL",
        "slug": "vinoteca-atl",
        "address": "299 N Highland Ave NE, Suite T",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "venue_type": "wine_bar",
        "website": "https://www.shopvinoteca.com",
    },
    "taste-wine-bar": {
        "name": "Taste Wine Bar and Market",
        "slug": "taste-wine-bar-and-market",
        "address": "202 Chattahoochee Row NW, Suite B",
        "neighborhood": "Upper Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "wine_bar",
        "website": "https://www.tastewinebarandmarket.com",
    },
    # ========== Sports watch party venues ==========
    "der-biergarten": {
        "name": "Der Biergarten",
        "slug": "der-biergarten",
        "address": "300 Marietta St NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "venue_type": "bar",
        "website": "https://derbiergarten.com",
    },
    "ri-ra-midtown": {
        "name": "Ri Ra Irish Pub Midtown",
        "slug": "ri-ra-irish-pub-midtown",
        "address": "1080 Peachtree St NE, Suite 1",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "bar",
        "website": "https://www.rirairishpub.com",
    },
    # "hudson-grille-midtown" — duplicate key removed (already defined at line 1320)
    # ========== SOMETHING DIFFERENT / ODDBALL VENUES ==========
    "petite-violette": {
        "name": "Petite Violette",
        "slug": "petite-violette",
        "address": "2948 Clairmont Rd NE",
        "neighborhood": "Brookhaven",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "venue_type": "restaurant",
        "website": "https://www.petitevioletterestaurant.com",
    },
    "the-pigalle": {
        "name": "The Pigalle Theater & Speakeasy",
        "slug": "the-pigalle",
        "address": "50 Lower Alabama St, Suite 104",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "venue_type": "theater",
        "website": "https://thepigalle.com",
    },
    "national-anthem": {
        "name": "National Anthem",
        "slug": "national-anthem",
        "address": "2625 Circle 75 Pkwy SE",
        "neighborhood": "The Battery",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30339",
        "venue_type": "restaurant",
        "website": "https://www.omnihotels.com/hotels/atlanta-battery/dining/national-anthem",
    },
    "the-supermarket-bakery": {
        "name": "The Supermarket",
        "slug": "the-supermarket-bakery-atlanta",
        "address": "638 N Highland Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "event_space",
        "website": "https://www.thebakeryatlanta.com",
    },
    "wwa4": {
        "name": "WWA4 Pro Wrestling",
        "slug": "wwa4-pro-wrestling",
        "address": "4375 Commerce Dr",
        "neighborhood": "South Fulton",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30336",
        "venue_type": "venue",
        "website": "https://www.wwa4.com",
    },
}

# ============================================
# EVENT SCHEDULE
# Day of week: 0=Monday, 6=Sunday
#
# Optional scheduling fields per template:
#   frequency:       "weekly" (default), "biweekly", "monthly"
#   active_months:   list of 1-12 ints — only generate during these months
#   week_of_month:   int 1-4 or -1 (last) — for monthly events (e.g. 2nd Saturday)
#   biweekly_anchor: "YYYY-MM-DD" — reference date for biweekly cadence
# ============================================

EVENT_TEMPLATES = [
    # ========== KARAOKE ==========
    {
        "venue_key": "metalsome",
        "day": 0,  # Monday
        "title": "Live Band Karaoke",
        "description": "Weekly live band karaoke night at Metalsome. Sing your favorite songs backed by a live band.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "live-music", "nightlife", "weekly"],
    },
    {
        "venue_key": "copper-cove",
        "day": 1,  # Tuesday
        "title": "Karaoke at Copper Cove",
        "description": "Weekly karaoke night at Copper Cove Restaurant & Lounge on Cheshire Bridge.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly"],
    },
    # Boggs Social: handled by dedicated source (sources/boggs_social.py) with recurring schedule
    # TEN ATL verified events (not karaoke as badslava listed)
    {
        "venue_key": "ten-atl",
        "day": 0,  # Monday
        "title": "Monday Night Jazz Jam",
        "description": "Weekly jazz jam session at TEN ATL in East Atlanta Village. Live jazz every Monday night.",
        "start_time": "22:00",
        "category": "music",
        "subcategory": "music.jazz",
        "tags": ["jazz", "live-music", "jam-session", "weekly"],
    },
    {
        "venue_key": "ten-atl",
        "day": 2,  # Wednesday
        "title": "Bourbon & Blues Wednesday",
        "description": "Weekly Bourbon & Blues night at TEN ATL. Premium hookah, fine bourbon, and blues music in an intimate setting.",
        "start_time": "20:00",
        "category": "music",
        "subcategory": "music.blues",
        "tags": ["blues", "live-music", "nightlife", "weekly"],
    },
    {
        "venue_key": "ten-atl",
        "day": 3,  # Thursday
        "title": "R&B Thursday Vibez",
        "description": "Thursday night R&B vibes at TEN ATL with DJ KASHii. Happy hour 8-10PM, music starts at 10PM.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "nightlife", "weekly"],
    },
    {
        "venue_key": "daiquiriville",
        "day": 3,  # Thursday
        "title": "Karaoke at Daiquiriville",
        "description": "Weekly karaoke at Daiquiriville in Downtown Atlanta.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly"],
    },
    {
        "venue_key": "roll-1-cafe",
        "day": 3,  # Thursday
        "title": "Karaoke at Roll 1 Cafe",
        "description": "Weekly karaoke at Roll 1 Cafe.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly"],
    },
    {
        "venue_key": "your-3rd-spot",
        "day": 3,  # Thursday
        "title": "Karaoke at Your 3rd Spot",
        "description": "Weekly karaoke at Your 3rd Spot on the Upper Westside.",
        "start_time": "20:30",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly"],
    },
    {
        "venue_key": "smiths-olde-bar",
        "day": 3,  # Thursday
        "title": "Karaoke at Smith's Olde Bar",
        "description": "Weekly karaoke at Smith's Olde Bar, Atlanta's legendary live music venue.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly"],
    },
    # "metro-fun-center" karaoke — REMOVED, venue permanently closed (Sept 2022)
    # ========== OPEN MICS ==========
    {
        "venue_key": "joes-coffeehouse",
        "day": 0,  # Monday
        "title": "Open Mic at Joe's Coffeehouse",
        "description": "Weekly open mic at Joe's Coffeehouse in East Atlanta. All performers welcome — music, poetry, spoken word.",
        "start_time": "17:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "poetry", "spoken-word", "weekly"],
    },
    {
        "venue_key": "our-bar-atl",
        "day": 0,  # Monday
        "title": "Open Mic at Our Bar ATL",
        "description": "Monday open mic at Our Bar ATL on Edgewood Ave. Music, comedy, and spoken word.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "nightlife", "weekly"],
    },
    {
        "venue_key": "southern-feed-store",
        "day": 1,  # Tuesday
        "title": "Open Mic at Southern Feed Store",
        "description": "Tuesday open mic at Southern Feed Store in East Atlanta. Music, comedy, and poetry welcome.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "nightlife", "weekly"],
    },
    # Laughing Skull: handled by dedicated source (sources/laughing_skull.py) with full 7-day recurring schedule
    {
        "venue_key": "limerick-junction",
        "day": 1,  # Tuesday
        "title": "Free Comedy Night at Limerick Junction",
        "description": "Tuesday free comedy show at Limerick Junction in Virginia-Highland. Local and touring comedians in a classic Irish pub on N Highland Ave.",
        "start_time": "21:00",
        "category": "comedy",
        "subcategory": "comedy.standup",
        "tags": ["comedy", "stand-up", "weekly", "free", "virginia-highland"],
    },
    {
        "venue_key": "limelight-theater",
        "day": 1,  # Tuesday
        "title": "Late Night Open Mic",
        "description": "Late night open mic at Limelight Theater in Downtown Atlanta. Mixed format — comedy, music, spoken word.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "nightlife", "weekly", "late-night"],
    },
    # Farm Burger Midtown — removed, implausible open mic venue (burger restaurant)
    # red-light-cafe Wed Jazz Jam: handled by dedicated source (sources/red_light_cafe.py)
    # Smith's Olde Bar verified events
    {
        "venue_key": "smiths-olde-bar",
        "day": 0,  # Monday
        "title": "Open Mic Live Band Night",
        "description": "Monday open mic with live band backing at Smith's Olde Bar. Legendary Atlanta music venue since 1994.",
        "start_time": "19:30",
        "category": "music",
        "subcategory": "music.rock",
        "tags": ["open-mic", "live-music", "live-band", "weekly"],
    },
    {
        "venue_key": "smiths-olde-bar",
        "day": 2,  # Wednesday
        "title": "Open Mic Comedy Night",
        "description": "Wednesday comedy open mic at Smith's Olde Bar. Atlanta's legendary music venue since 1994.",
        "start_time": "19:30",
        "category": "comedy",
        "subcategory": "comedy.standup",
        "tags": ["open-mic", "comedy", "standup", "weekly"],
    },
    {
        "venue_key": "smiths-olde-bar",
        "day": 3,  # Thursday
        "title": "Team Trivia",
        "description": "Thursday Team Trivia night at Smith's Olde Bar. Test your knowledge before karaoke starts at 10PM.",
        "start_time": "19:30",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    # Pullman Yards — removed, implausible weekly open mic (event space, not regular bar)
    {
        "venue_key": "asw-whiskey",
        "day": 3,  # Thursday
        "title": "Open Mic at ASW Whiskey Exchange",
        "description": "Thursday open mic at ASW Whiskey Exchange in West End. Live music in the tasting room.",
        "start_time": "18:00",
        "category": "music",
        "subcategory": None,
        "tags": ["open-mic", "live-music", "weekly"],
    },
    {
        "venue_key": "atlantucky",
        "day": 3,  # Thursday
        "title": "Open Mic at Atlantucky Brewing",
        "description": "Thursday open mic at Atlantucky Brewing.",
        "start_time": "18:30",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "nightlife", "weekly", "brewery"],
    },
    {
        "venue_key": "urban-grind",
        "day": 3,  # Thursday
        "title": "Open Mic at Urban Grind",
        "description": "Thursday open mic at Urban Grind coffee shop. Poetry and spoken word.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "poetry", "spoken-word", "weekly"],
    },
    {
        "venue_key": "kats-cafe",
        "day": 3,  # Thursday
        "title": "Open Mic at Kat's Cafe",
        "description": "Thursday open mic at Kat's Cafe in Midtown. Poetry and spoken word.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "poetry", "spoken-word", "weekly"],
    },
    # Battery Atlanta open mic — REMOVED, implausible (800 Battery Ave is a retail district, not a stage)
    # Park Bench Battery — verified weekly events from parkbenchbattery.com/calendar/
    {
        "venue_key": "park-bench-battery",
        "day": 2,  # Wednesday
        "title": "Karaoke at Park Bench Battery",
        "description": "Wednesday karaoke night at Park Bench Battery in The Battery Atlanta. Step into the spotlight — all genres welcome. No cover, 21+.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly", "free"],
        "is_free": True,
    },
    {
        "venue_key": "park-bench-battery",
        "day": 3,  # Thursday
        "title": "Country Karaoke Night",
        "description": "Thursday country karaoke at Park Bench Battery. Requests and performances, all country hits. No cover, 21+.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "country", "nightlife", "weekly", "free"],
        "is_free": True,
    },
    {
        "venue_key": "park-bench-battery",
        "day": 4,  # Friday
        "title": "Vegas-Style Piano Show",
        "description": "Friday night Vegas-style piano show at Park Bench Battery. High-energy rapid-fire piano melodies and sing-alongs. No cover, 21+.",
        "start_time": "21:00",
        "category": "music",
        "subcategory": None,
        "tags": ["dueling-pianos", "piano", "live-music", "weekly", "free"],
        "is_free": True,
    },
    {
        "venue_key": "park-bench-battery",
        "day": 5,  # Saturday
        "title": "Dueling Pianos",
        "description": "Saturday night dueling pianos at Park Bench Battery in The Battery. Interactive all-night piano show — request your favorite songs. No cover, 21+.",
        "start_time": "19:30",
        "category": "music",
        "subcategory": None,
        "tags": ["dueling-pianos", "piano", "live-music", "weekly", "free"],
        "is_free": True,
    },
    # Joystick verified from Instagram: Wednesday gaming, Thursday karaoke (NOT open mic as badslava listed)
    {
        "venue_key": "joystick",
        "day": 2,  # Wednesday
        "title": "Press Start Gaming Night",
        "description": "Wednesday gaming night at Joystick Gamebar. Rotating video games each week including Rock Band, fighting games, and more. 7PM-11PM.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.bar_games",
        "tags": ["games", "video-games", "arcade", "nightlife", "weekly"],
    },
    {
        "venue_key": "joystick",
        "day": 3,  # Thursday
        "title": "Regular A$$ Karaoke",
        "description": "Thursday karaoke night at Joystick Gamebar, hosted by Grant. Nerdy dive bar vibes on Edgewood Ave.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly"],
    },
    {
        "venue_key": "peters-street",
        "day": 3,  # Thursday
        "title": "Open Mic at Peters Street Station",
        "description": "Thursday open mic at Peters Street Station in Castleberry Hill.",
        "start_time": "20:30",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "nightlife", "weekly"],
    },
    {
        "venue_key": "dynamic-el-dorado",
        "day": 4,  # Friday
        "title": "Late Night Open Mic",
        "description": "Friday late night open mic at Dynamic El Dorado.",
        "start_time": "23:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "nightlife", "weekly", "late-night"],
    },
    # 529 verified: Saturday 3PM Open Mic Comedy (website: 529atlanta.com, not 529atl.com which is hijacked)
    {
        "venue_key": "529-bar",
        "day": 5,  # Saturday
        "title": "3PM Open Mic Comedy",
        "description": "Saturday afternoon open mic comedy at 529 in East Atlanta Village. 3:00-5:30pm, hosted by Kelly Mendez.",
        "start_time": "15:00",
        "category": "comedy",
        "subcategory": "comedy.standup",
        "tags": ["open-mic", "comedy", "standup", "weekly", "afternoon"],
    },
    # ========== GAME NIGHTS ==========
    {
        "venue_key": "jasons-deli",
        "day": 0,  # Monday
        "title": "Board Game Night at Jason's Deli",
        "description": "Weekly board game night at Jason's Deli in Dunwoody. Bring your own games or join others.",
        "start_time": "17:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["games", "board-games", "weekly", "family-friendly"],
    },
    # Manuel's Tavern verified: Sunday Team Trivia at 7PM (NOT Wednesday game night as badslava listed)
    {
        "venue_key": "manuels-tavern",
        "day": 6,  # Sunday
        "title": "Team Trivia",
        "description": "Sunday Team Trivia at Manuel's Tavern, Atlanta's legendary political bar since 1956. Categories include Sports, History, Music, Science, TV, and Movies.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    {
        "venue_key": "church-epiphany",
        "day": 5,  # Saturday
        "title": "Community Game Night at Church of the Epiphany",
        "description": "Saturday community game night at Church of the Epiphany in Decatur. All ages, all welcome — board games, card games, snacks. Free.",
        "start_time": "18:00",
        "category": "community",
        "subcategory": None,
        "tags": ["games", "board-games", "weekly", "family-friendly", "community"],
    },
    # ========== BINGO ==========
    {
        "venue_key": "punch-bowl",
        "day": 3,  # Thursday
        "title": "Bingo at Punch Bowl Social",
        "description": "Thursday bingo night at Punch Bowl Social at The Battery.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.bingo",
        "tags": ["bingo", "games", "weekly"],
    },
    # "blue-martini" bingo — REMOVED, venue permanently closed (mid-2025)
    # ========== JAZZ & BLUES NIGHTS ==========
    {
        "venue_key": "cafe-circa",
        "day": 4,  # Friday
        "title": "Live Jazz Friday",
        "description": "Friday night live jazz at Cafe Circa on Edgewood Ave. Full bar and late-night menu.",
        "start_time": "21:00",
        "category": "music",
        "subcategory": "music.jazz",
        "tags": ["jazz", "live-music", "nightlife", "weekly", "date-night"],
    },
    {
        "venue_key": "cafe-circa",
        "day": 5,  # Saturday
        "title": "Saturday Jazz & Soul",
        "description": "Saturday night jazz and soul music at Cafe Circa on Edgewood Ave.",
        "start_time": "21:00",
        "category": "music",
        "subcategory": "music.jazz",
        "tags": ["jazz", "soul", "live-music", "nightlife", "weekly", "date-night"],
    },
    # Churchill Grounds — CLOSED permanently (removed Feb 2026)
    {
        "venue_key": "elliott-street-pub",
        "day": 4,  # Friday
        "title": "Blues Night at Elliott Street Pub",
        "description": "Friday blues night at Elliott Street Deli & Pub in Castleberry Hill.",
        "start_time": "21:00",
        "category": "music",
        "subcategory": "music.blues",
        "tags": ["blues", "live-music", "nightlife", "weekly"],
    },
    # Sister Louisa's karaoke — handled by dedicated source (sources/sister_louisas.py)
    # ========== ADDITIONAL TRIVIA ==========
    {
        "venue_key": "brick-store-pub",
        "day": 1,  # Tuesday
        "title": "Trivia at Brick Store Pub",
        "description": "Tuesday trivia at Brick Store Pub in downtown Decatur. Award-winning beer selection and pub trivia.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly", "craft-beer"],
    },
    # "the-porter" trivia — handled by dedicated source (sources/the_porter.py)
    # "wrecking-bar" trivia — handled by dedicated source (sources/wrecking_bar.py)
    # ==================================================================
    # Phase 0b: NEW RECURRING EVENTS
    # ==================================================================
    # ========== ADDITIONAL TRIVIA ==========
    {
        "venue_key": "thinking-man",
        "day": 1,  # Tuesday
        "title": "Team Trivia",
        "description": "Tuesday team trivia at Thinking Man Tavern in Decatur. Every Tuesday at 7:30pm.",
        "start_time": "19:30",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    {
        "venue_key": "righteous-room",
        "day": 3,  # Thursday
        "title": "Trivia at Righteous Room",
        "description": "Thursday trivia at Righteous Room on Ponce. Dive bar trivia in Virginia Highland.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    {
        "venue_key": "the-local",
        "day": 2,  # Wednesday
        "title": "Trivia at The Local",
        "description": "Wednesday trivia at The Local in Ponce City Market.",
        "start_time": "19:30",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    {
        "venue_key": "twains",
        "day": 0,  # Monday
        "title": "Team Trivia",
        "description": "Monday night team trivia at Twain's Brewpub & Billiards in Decatur. Starts at 8pm. Bring your smartest crew.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    # Diesel Filling Station: permanently closed end of 2021, replaced by Dad's bar
    # {
    #     "venue_key": "dieselfillingstation",
    #     "day": 1,  # Tuesday
    #     "title": "Trivia Night",
    #     ...
    # },
    # ========== DJ NIGHTS / DANCE ==========
    {
        "venue_key": "mjq-concourse",
        "day": 3,  # Thursday
        "title": "MJQ Thursday",
        "description": "Thursday DJ night at MJQ Concourse at Underground Atlanta. One of Atlanta's longest-running dance nights, now in the former Dante's Down the Hatch space.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "dance", "nightlife", "weekly", "late-night", "high-energy"],
    },
    {
        "venue_key": "mjq-concourse",
        "day": 4,  # Friday
        "title": "MJQ Friday",
        "description": "Friday DJ night at MJQ Concourse at Underground Atlanta. Atlanta's legendary dance club.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "dance", "nightlife", "weekly", "late-night", "high-energy"],
    },
    {
        "venue_key": "mjq-concourse",
        "day": 5,  # Saturday
        "title": "MJQ Saturday",
        "description": "Saturday DJ night at MJQ Concourse at Underground Atlanta. The best dance floor in Atlanta.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "dance", "nightlife", "weekly", "late-night", "high-energy"],
    },
    # The Music Room — CLOSED, events removed (Sep 2020)
    # Johnny's Hideaway — Dance Night dupes removed; specific "Country & Line Dancing" events below
    # ========== DRAG SHOWS ==========
    {
        "venue_key": "burkharts",
        "day": 4,  # Friday
        "title": "Drag Show Friday",
        "description": "Friday drag show at Burkhart's Pub in Ansley Park. One of Atlanta's longest-running LGBTQ bars.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.drag",
        "tags": ["drag", "nightlife", "weekly", "lgbtq-friendly"],
    },
    {
        "venue_key": "burkharts",
        "day": 5,  # Saturday
        "title": "Drag Show Saturday",
        "description": "Saturday drag show at Burkhart's Pub. Multiple performers, no cover before 10PM.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.drag",
        "tags": ["drag", "nightlife", "weekly", "lgbtq-friendly"],
    },
    {
        "venue_key": "my-sisters-room",
        "day": 4,  # Friday
        "title": "Friday Night Show",
        "description": "Friday night drag and live entertainment at My Sister's Room in Decatur. Atlanta's welcoming LGBTQ neighborhood bar.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": "nightlife.drag",
        "tags": ["drag", "nightlife", "weekly", "lgbtq-friendly"],
    },
    {
        "venue_key": "my-sisters-room",
        "day": 5,  # Saturday
        "title": "Saturday Night Show",
        "description": "Saturday night drag and entertainment at My Sister's Room in Decatur.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": "nightlife.drag",
        "tags": ["drag", "nightlife", "weekly", "lgbtq-friendly"],
    },
    # ========== LIVE MUSIC RESIDENCIES ==========
    # Fontaine's Oyster House — CLOSED, events removed (2026-03)
    {
        "venue_key": "apache-cafe",
        "day": 3,  # Thursday
        "title": "Open Mic & Poetry Slam",
        "description": "Thursday open mic and poetry slam at Apache XLR in Midtown. Atlanta's creative arts and spoken word staple.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "poetry", "spoken-word", "poetry-slam", "weekly"],
    },
    {
        "venue_key": "ladybird",
        "day": 5,  # Saturday
        "title": "DJ Brunch",
        "description": "Saturday DJ brunch at Ladybird Grove & Mess Hall on the BeltLine. DJs, brunch cocktails, and outdoor vibes.",
        "start_time": "11:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["brunch", "dj", "outdoor", "weekly"],
    },
    {
        "venue_key": "ladybird",
        "day": 2,  # Wednesday
        "title": "Chess Night at Ladybird",
        "description": "Wednesday chess night at Ladybird Grove & Mess Hall on the BeltLine. Boards provided, all skill levels welcome.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": "nightlife.bar_games",
        "tags": ["chess", "board-games", "games", "bar-games", "weekly", "beltline"],
    },
    # ========== FARMERS MARKETS ==========
    {
        "venue_key": "piedmont-park-green-market",
        "day": 5,  # Saturday
        "title": "Piedmont Park Green Market",
        "description": "Saturday green market at Piedmont Park. Year-round farmers market with local produce, artisan goods, and prepared foods.",
        "start_time": "09:00",
        "category": "markets",
        "subcategory": None,
        "tags": ["farmers-market", "outdoor", "weekly", "family-friendly"],
    },
    # Peachtree Road Farmers Market — handled by dedicated source (sources/farmers_markets.py) with correct season gate
    # ==================================================================
    # Phase 2: NEIGHBORHOOD + DAY GAP FILLS
    # ==================================================================
    # ========== LITTLE FIVE POINTS ==========
    # Elmyr Taco Tuesday — venue attribute, not a programmed event (moved to venue_specials)
    # ========== INMAN PARK ==========
    # Barcelona Wine Wednesday — venue attribute, not a programmed event (moved to venue_specials)
    {
        "venue_key": "barcelona-wine-bar",
        "day": 3,  # Thursday
        "title": "Live Music Thursday",
        "description": "Thursday live music at Barcelona Wine Bar in Inman Park. Acoustic sets, tapas, and cocktails on the patio.",
        "start_time": "20:00",
        "category": "music",
        "subcategory": "music.acoustic",
        "tags": ["live-music", "acoustic", "weekly", "date-night"],
    },
    {
        "venue_key": "victory-sandwich-bar",
        "day": 1,  # Tuesday
        "title": "Trivia at Victory Sandwich Bar",
        "description": "Tuesday trivia at Victory Sandwich Bar in Inman Park. Craft cocktails, sandwiches, and pub trivia.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    # New Realm Thursday trivia — handled by dedicated source (sources/new_realm_brewing.py)
    {
        "venue_key": "new-realm-brewing",
        "day": 4,  # Friday
        "title": "Live Music Friday",
        "description": "Friday live music at New Realm Brewing on the BeltLine. Local bands on the rooftop patio.",
        "start_time": "19:00",
        "category": "music",
        "subcategory": None,
        "tags": ["live-music", "weekly", "brewery", "beltline"],
    },
    # krog-street-market Sat live music + Tue trivia: handled by dedicated source (sources/krog_street_market.py)
    # ========== EAST ATLANTA VILLAGE ==========
    # "the-glenwood" trivia + DJ night — REMOVED, venue permanently closed (Oct 2023)
    {
        "venue_key": "flatiron",
        "day": 3,  # Thursday
        "title": "Thursday DJ Night",
        "description": "Thursday DJ night at Flatiron in East Atlanta Village. Rotating DJs and late-night vibes.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "nightlife", "weekly", "late-night"],
    },
    # marys-bar Fri drag + Sat DJ: handled by dedicated source (sources/marys.py)
    # ========== SUNDAY GAP FILLS ==========
    # Northside Tavern blues (Sun/Fri/Sat) — handled by dedicated source (sources/northside_tavern.py)
    # park-tavern Sun live music: handled by dedicated source (sources/park_tavern.py)
    {
        "venue_key": "ladybird",
        "day": 6,  # Sunday
        "title": "Sunday DJ Brunch",
        "description": "Sunday DJ brunch at Ladybird Grove on the BeltLine. DJs, brunch cocktails, and patio vibes.",
        "start_time": "11:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["brunch", "dj", "outdoor", "weekly", "beltline"],
    },
    {
        "venue_key": "the-painted-pin",
        "day": 6,  # Sunday
        "title": "Sunday Brunch & DJs",
        "description": "Sunday brunch with DJ sets at The Painted Pin in Buckhead. Brunch cocktails, bowling, and beats.",
        "start_time": "11:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["brunch", "dj", "weekly", "games"],
    },
    {
        "venue_key": "apache-cafe",
        "day": 6,  # Sunday
        "title": "Sunday Open Mic at Apache Cafe",
        "description": "Sunday open mic at Apache XLR in Midtown. Poetry, spoken word, and acoustic sets.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "poetry", "spoken-word", "weekly"],
    },
    # Wrecking Bar Sunday Brunch — venue attribute, not a programmed event (moved to venue_specials)
    # NOTE: Sister Louisa's bingo + karaoke handled by dedicated sources
    # (sister-louisas-church for Drag Bingo, sister-louisas for karaoke)
    # ========== DISCOVERED FROM VENUE WEBSITES (Feb 2026) ==========
    # Star Community Bar: handled by dedicated source upgrade (star_community_bar.py)
    # Fado Irish Pub — Buckhead
    {
        "venue_key": "fado-irish-pub",
        "day": 2,  # Wednesday
        "title": "Pub Quiz with Dirty South Trivia",
        "description": "Wednesday pub quiz at Fado Irish Pub hosted by Dirty South Trivia. Win prizes and pub cash.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    # Steady Hand Beer — West Midtown
    {
        "venue_key": "steady-hand-beer",
        "day": 2,  # Wednesday
        "title": "Themed Trivia Night",
        "description": "Wednesday themed trivia at Steady Hand Beer Co. hosted by Lights Up Entertainment. Rotating pop culture themes with prizes.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly", "brewery"],
    },
    # Cherry Street Brewing — West Midtown
    {
        "venue_key": "cherry-street-brewing",
        "day": 2,  # Wednesday
        "title": "Open Mic at Cherry Street Brewing",
        "description": "Wednesday open mic at Cherry Street Brewing taproom. Live music from local performers.",
        "start_time": "19:00",
        "category": "music",
        "subcategory": None,
        "tags": ["open-mic", "live-music", "weekly", "brewery"],
    },
    {
        "venue_key": "cherry-street-brewing",
        "day": 4,  # Friday
        "title": "Live Music at Cherry Street Brewing",
        "description": "Live music every Friday at Cherry Street Brewing taproom.",
        "start_time": "19:00",
        "category": "music",
        "subcategory": None,
        "tags": ["live-music", "weekly", "brewery"],
    },
    {
        "venue_key": "cherry-street-brewing",
        "day": 5,  # Saturday
        "title": "Saturday Live Music",
        "description": "Live music every Saturday at Cherry Street Brewing taproom.",
        "start_time": "19:00",
        "category": "music",
        "subcategory": None,
        "tags": ["live-music", "weekly", "brewery"],
    },
    # Three Taverns Imaginarium — Reynoldstown
    {
        "venue_key": "three-taverns",
        "day": 0,  # Monday
        "title": "Mental Mondays Trivia",
        "description": "Monday trivia night at Three Taverns Imaginarium in Reynoldstown.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly", "brewery"],
    },
    {
        "venue_key": "three-taverns",
        "day": 1,  # Tuesday
        "title": "Mario Kart Night",
        "description": "Tuesday Mario Kart N64 gaming night at Three Taverns Imaginarium. Play in the upstairs loft.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.bar_games",
        "tags": ["games", "game-night", "nightlife", "weekly", "brewery"],
    },
    # Gene's BBQ — Kirkwood
    {
        "venue_key": "genes-bbq",
        "day": 1,  # Tuesday
        "title": "Kiki Casino Bingo",
        "description": "Tuesday bingo night at Gene's BBQ hosted by Kiki Casino with DJ. Free to play with prizes.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.bingo",
        "tags": ["bingo", "dj", "nightlife", "weekly", "free"],
    },
    {
        "venue_key": "genes-bbq",
        "day": 3,  # Thursday
        "title": "Homestar Karaoke",
        "description": "Thursday karaoke at Gene's BBQ. All classics, no filler.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly"],
    },
    # Brewhouse Cafe — Little Five Points
    {
        "venue_key": "brewhouse-cafe",
        "day": 4,  # Friday
        "title": "DJ Jen $5 Fridays",
        "description": "Friday DJ night at Brewhouse Cafe in Little Five Points. DJ Jen with $5 drafts and margaritas.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "nightlife", "weekly", "drink-specials"],
    },
    # Whitehall Tavern — Buckhead
    {
        "venue_key": "whitehall-tavern",
        "day": 2,  # Wednesday
        "title": "Trivia at Whitehall Tavern",
        "description": "Wednesday trivia night at Whitehall Tavern in Buckhead.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    {
        "venue_key": "whitehall-tavern",
        "day": 3,  # Thursday
        "title": "Trivia at Whitehall Tavern",
        "description": "Thursday trivia night at Whitehall Tavern in Buckhead.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    # Irby's Tavern — Buckhead
    {
        "venue_key": "irbys-tavern",
        "day": 2,  # Wednesday
        "title": "Whiskey Wednesdays & Trivia",
        "description": "Wednesday trivia with whiskey specials at Irby's Tavern in Buckhead.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly", "drink-specials"],
    },
    # Woofs Atlanta — Midtown
    {
        "venue_key": "woofs-atlanta",
        "day": 4,  # Friday
        "title": "Drag Race Viewing Party",
        "description": "Friday RuPaul's Drag Race viewing party at Woofs Atlanta.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": "nightlife.drag",
        "tags": ["drag", "viewing-party", "nightlife", "weekly", "lgbtq-friendly"],
    },
    # Atlanta Eagle: handled by dedicated source upgrade (atlanta_eagle.py)
    # ==================================================================
    # GAMING / TABLETOP / D&D (Feb 2026)
    # ==================================================================
    # Joystick Gamebar — Edgewood (ITP)
    # Note: uses "joystick" key (existing entry with slug "joystick-gamebar")
    {
        "venue_key": "joystick",
        "day": 0,  # Monday
        "title": "ATL D&D Drop-In",
        "description": "Free drop-in D&D 5e at Joystick Gamebar on Edgewood Ave. New players welcome — free pre-gen characters and dice provided. All ages before 8pm.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": "nightlife.bar_games",
        "tags": ["dnd", "tabletop", "games", "weekly", "free"],
    },
    {
        "venue_key": "joystick",
        "day": 1,  # Tuesday
        "title": "ATL D&D Drop-In",
        "description": "Free drop-in D&D 5e at Joystick Gamebar on Edgewood Ave. New players welcome — free pre-gen characters and dice provided. All ages before 8pm.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": "nightlife.bar_games",
        "tags": ["dnd", "tabletop", "games", "weekly", "free"],
    },
    # Bone Lick BBQ — West Midtown (ITP)
    {
        "venue_key": "bone-lick-bbq",
        "day": 3,  # Thursday
        "title": "ATL D&D Drop-In",
        "description": "Thursday D&D at Bone Lick BBQ in West Midtown. Happy hour at 6pm, official start at 7pm, games begin ~7:30. Free drop-in D&D 5e.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": "nightlife.bar_games",
        "tags": ["dnd", "tabletop", "games", "weekly", "free"],
    },
    # Battle & Brew — handled by dedicated source (sources/battle_and_brew.py)
    # Giga-Bites Cafe — Marietta (OTP but destination)
    {
        "venue_key": "giga-bites-cafe",
        "day": 1,  # Tuesday
        "title": "Open Board Game Night",
        "description": "Tuesday open board game night at Giga-Bites Cafe. Large game library available. All welcome.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": "nightlife.bar_games",
        "tags": ["board-games", "tabletop", "games", "weekly"],
    },
    {
        "venue_key": "giga-bites-cafe",
        "day": 2,  # Wednesday
        "title": "D&D Adventurers League",
        "description": "Official D&D Adventurers League play at Giga-Bites Cafe. Arrive by 6:30pm, tables assigned 6:45, games at 7.",
        "start_time": "18:30",
        "category": "nightlife",
        "subcategory": "nightlife.bar_games",
        "tags": ["dnd", "tabletop", "games", "weekly"],
    },
    {
        "venue_key": "giga-bites-cafe",
        "day": 4,  # Friday
        "title": "Warhammer 40k Friday Night Fights",
        "description": "Friday night organized Warhammer 40k games at Giga-Bites Cafe. Competitive and casual tables available.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": "nightlife.bar_games",
        "tags": ["warhammer", "40k", "miniatures", "tabletop", "weekly"],
    },
    {
        "venue_key": "giga-bites-cafe",
        "day": 0,  # Monday
        "title": "Warhammer 40k Casual Night",
        "description": "Monday evening casual Warhammer 40k games at Giga-Bites Cafe in Marietta. All skill levels welcome, terrain and tables provided.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": "nightlife.bar_games",
        "tags": ["warhammer", "40k", "miniatures", "tabletop", "weekly"],
    },
    {
        "venue_key": "giga-bites-cafe",
        "day": 6,  # Sunday
        "title": "Kids D&D at Giga-Bites",
        "description": "Sunday afternoon youth D&D sessions at Giga-Bites Cafe in Marietta. Ages 8-16, beginner-friendly. Noon-3pm.",
        "start_time": "12:00",
        "category": "family",
        "subcategory": None,
        "is_class": True,
        "tags": ["dnd", "kids", "tabletop", "weekly"],
    },
    # My Parents' Basement — Avondale Estates
    {
        "venue_key": "my-parents-basement",
        "day": 1,  # Tuesday
        "title": "Comic Book Trivia Night",
        "description": "Tuesday trivia night at My Parents' Basement in Avondale Estates. Comics, sci-fi, pop culture. Free to play with 20 pinball machines and board games available.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "comics", "geek", "pinball", "weekly", "free"],
        "is_free": True,
    },
    # East Atlanta Comics — MTG
    {
        "venue_key": "east-atlanta-comics",
        "day": 0,  # Monday
        "title": "MTG Commander League",
        "description": "Monday evening Magic: The Gathering Commander League at East Atlanta Comics. All skill levels welcome.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": "nightlife.bar_games",
        "tags": ["mtg", "magic-the-gathering", "commander", "card-games", "weekly"],
    },
    {
        "venue_key": "east-atlanta-comics",
        "day": 2,  # Wednesday
        "title": "MTG Pauper League",
        "description": "Wednesday evening Magic: The Gathering Pauper League at East Atlanta Comics.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": "nightlife.bar_games",
        "tags": ["mtg", "magic-the-gathering", "pauper", "card-games", "weekly"],
    },
    # ==================================================================
    # RUN CLUBS (Feb 2026)
    # ==================================================================
    # Atlanta Run Club at Ponce City Market — handled by dedicated source (sources/ponce_city_market.py)
    # BeltLine Run Club at New Realm Brewing
    # Note: uses "new-realm-brewing" key (existing entry)
    {
        "venue_key": "new-realm-brewing",
        "day": 3,  # Thursday
        "title": "Atlanta BeltLine Run Club",
        "description": "Thursday BeltLine run/walk organized by Atlanta Track Club. 2 or 4 miles. Gather 6:15pm, start 6:30. Free. Post-run food and beer specials.",
        "start_time": "18:15",
        "category": "fitness",
        "subcategory": "fitness.running",
        "tags": ["running", "run-club", "beltline", "free", "weekly", "brewery"],
    },
    # Big Peach Running Co — Midtown
    {
        "venue_key": "big-peach-running-midtown",
        "day": 1,  # Tuesday
        "title": "Big Peach Group Run",
        "description": "Tuesday group run from Big Peach Running Co Midtown through Piedmont Park. Changing rooms and showers available.",
        "start_time": "18:30",
        "category": "fitness",
        "subcategory": "fitness.running",
        "tags": ["running", "run-club", "free", "weekly"],
    },
    {
        "venue_key": "big-peach-running-midtown",
        "day": 5,  # Saturday
        "title": "Big Peach Saturday Run",
        "description": "Saturday morning group run from Big Peach Running Co Midtown. All levels welcome.",
        "start_time": "07:30",
        "category": "fitness",
        "subcategory": "fitness.running",
        "tags": ["running", "run-club", "free", "weekly"],
    },
    # Cabbagetown Running Club
    {
        "venue_key": "milltown-arms-tavern",
        "day": 3,  # Thursday
        "title": "Cabbagetown Running Club",
        "description": "Thursday group run from Milltown Arms Tavern in Cabbagetown. All levels welcome. Running continuously since December 2005.",
        "start_time": "19:00",
        "category": "fitness",
        "subcategory": "fitness.running",
        "tags": ["running", "run-club", "weekly"],
    },
    # Running for Brews — Buckhead
    {
        "venue_key": "elbow-room-buckhead",
        "day": 0,  # Monday
        "title": "Running for Brews 5K",
        "description": "Monday social 5K run from Elbow Room in Buckhead. Run a route through Buckhead then return for beers and socializing.",
        "start_time": "19:00",
        "category": "fitness",
        "subcategory": "fitness.running",
        "tags": ["running", "run-club", "social", "weekly"],
    },
    # ==================================================================
    # SOCIAL DANCE NIGHTS (Feb 2026)
    # ==================================================================
    # Latin Wednesdays — Tongue & Groove
    {
        "venue_key": "tongue-and-groove",
        "day": 2,  # Wednesday
        "title": "Latin Wednesdays",
        "description": "Salsa and bachata night at Tongue & Groove. Free lesson 9-10pm. No cover before 10pm (mention Salsa ATL). Rotating DJs, 21+.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": "nightlife.latin_night",
        "tags": ["salsa", "bachata", "latin", "dance", "free-lesson", "weekly"],
    },
    # Hot Jam Atlanta — Lindy Hop Monday
    {
        "venue_key": "hot-jam-atlanta",
        "day": 0,  # Monday
        "title": "Lindy Hop Social Dance",
        "description": "Monday swing dance at Hot Jam Atlanta. Free beginner solo jazz class at 7pm, free intro swing class at 7:30, social dance after. $12 DJ nights, $20 live band.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.dance",
        "tags": ["swing", "lindy-hop", "dance", "jazz", "weekly"],
    },
    # DanceOut — The Heretic (Country Dance) — handled by dedicated source (sources/the_heretic.py)
    # ==================================================================
    # PICKLEBALL & PICKUP SPORTS (Feb 2026)
    # ==================================================================
    # Piedmont Park events — handled by dedicated source (sources/piedmont_park.py)
    # ==================================================================
    # YOGA & WELLNESS (Feb 2026)
    # ==================================================================
    # Woodruff Park Free Yoga (outdoor, Mar–Nov)
    {
        "venue_key": "woodruff-park",
        "day": 5,  # Saturday
        "title": "Free Yoga in Woodruff Park",
        "description": "Free Saturday morning vinyasa flow yoga in Woodruff Park downtown. All levels welcome. Bring your own mat.",
        "start_time": "10:00",
        "category": "fitness",
        "subcategory": None,
        "tags": ["yoga", "free", "outdoor", "weekly"],
        "active_months": [3, 4, 5, 6, 7, 8, 9, 10, 11],
    },
    # ==================================================================
    # CYCLING GROUPS (Feb 2026)
    # ==================================================================
    # Bonafide Riders — Monday social ride
    {
        "venue_key": "inman-park-station",
        "day": 0,  # Monday
        "title": "Bonafide Riders — Monday Social Ride",
        "description": "Monday evening social bike ride with Bonafide Riders from Inman Park Station. 20+ miles, beginner-friendly pace. Free, all welcome. Meet 6pm, roll 6:15pm.",
        "start_time": "18:00",
        "category": "fitness",
        "subcategory": "fitness.cycling",
        "tags": ["cycling", "bike-ride", "free", "social", "weekly", "beltline"],
        "is_free": True,
    },
    # Pizza Ride — Thursday fast group ride
    {
        "venue_key": "avondale-estates-art-lot",
        "day": 3,  # Thursday
        "title": "The Pizza Ride",
        "description": "Thursday evening fast-paced group bike ride from Avondale Estates. 40-50 riders, challenging hills. An Atlanta cycling institution. Free, experienced riders.",
        "start_time": "18:00",
        "category": "fitness",
        "subcategory": "fitness.cycling",
        "tags": ["cycling", "bike-ride", "free", "competitive", "weekly"],
        "is_free": True,
    },
    # Midweek Roll — REMOVED, biweekly event (every other Wednesday) can't be represented in weekly generator
    # ==================================================================
    # TENNIS (Feb 2026)
    # ==================================================================
    {
        "venue_key": "glenlake-tennis-center",
        "day": 5,  # Saturday
        "title": "ATTA Open Play Tennis",
        "description": "Saturday afternoon drop-in doubles tennis at Glenlake Tennis Center hosted by Atlanta Team Tennis Association. Mix-and-match partners, all skill levels. First visit free, then $5-$10.",
        "start_time": "13:00",
        "category": "fitness",
        "subcategory": "fitness.tennis",
        "tags": ["tennis", "drop-in", "social", "weekly"],
        "price_min": 5,
        "price_max": 10,
    },
    # ==================================================================
    # MARKETS (Feb 2026)
    # ==================================================================
    {
        "venue_key": "broad-street-boardwalk",
        "day": 3,  # Thursday
        "title": "Amateur Flea Market",
        "description": "Thursday flea market on Broad Street Boardwalk in Downtown Atlanta. Curated vintage clothing, accessories, and goods. 11am-2:30pm. Free admission.",
        "start_time": "11:00",
        "category": "entertainment",
        "subcategory": None,
        "tags": ["vintage", "shopping", "free", "weekly", "market"],
        "is_free": True,
    },
    # ==================================================================
    # VOLUNTEER (Feb 2026)
    # ==================================================================
    # Grant Park Volunteer Workday — removed, monthly event (2nd Saturday only)
    # can't be represented in weekly generator; would create 6x instances per month
    # ==================================================================
    # FOOD & DRINK SPECIALS — REMOVED (2026-03)
    # Product decision: venue specials (happy hours, taco tuesdays, wine nights,
    # oyster hours, brunches, half-price deals) are venue ATTRIBUTES, not
    # programmed events. They belong in venue_specials table, not the event feed.
    # Removed: Lloyd's Crab Night, Taverna wine, Wild Heaven margaritas,
    # Pure Taqueria / Tin Lizzy's / Elmyr taco tuesdays, Forza Storico wine,
    # Antico wine, Pielands wings, Beso oysters, Cypress Street wine,
    # Optimist oysters (3x), Iberian Pig happy hour (3x), Bartaco HH (2x),
    # Superica HH (2x), BeetleCat oysters (5x), Fado bottomless brunch (2x),
    # Barcelona Wine Wednesday, Wrecking Bar Sunday Brunch
    # ==================================================================
    # ========== Regular Hangs buildout: new categories ==========
    # ---------- POKER ----------
    # Eddie's Attic poker — REMOVED, factually implausible (Eddie's is an acoustic listening room)
    {
        "venue_key": "joystick",
        "day": 2,  # Wednesday
        "title": "Aces Up Bar Poker — Freeroll",
        "description": "Wednesday freeroll poker night at Joystick Gamebar on Edgewood Ave, hosted by Aces Up Atlanta. No buy-in, prizes awarded.",
        "start_time": "19:30",
        "category": "nightlife",
        "subcategory": "nightlife.poker",
        "tags": ["poker", "freeroll", "bar-poker", "nightlife", "weekly"],
        "is_free": True,
    },
    {
        "venue_key": "your-3rd-spot",
        "day": 3,  # Thursday
        "title": "Aces Up Bar Poker Night",
        "description": "Thursday bar poker night at Your 3rd Spot on the Westside, hosted by Aces Up Atlanta. Free to play with prizes.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.poker",
        "tags": ["poker", "freeroll", "bar-poker", "nightlife", "weekly"],
        "is_free": True,
    },
    # ---------- LINE DANCING ----------
    {
        "venue_key": "johnny-hideaway",
        "day": 4,  # Friday
        "title": "Country & Line Dancing",
        "description": "Country and line dancing at Johnny's Hideaway, Atlanta's legendary Buckhead dance club since 1979. Two-stepping, line dances, and classic country hits all night.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.line_dancing",
        "tags": ["line-dancing", "country-dance", "dance", "nightlife", "weekly"],
    },
    {
        "venue_key": "johnny-hideaway",
        "day": 5,  # Saturday
        "title": "Saturday Night Country Dance",
        "description": "Saturday night country and line dancing at Johnny's Hideaway in Buckhead. Atlanta's iconic venue for two-stepping and boot-scootin'.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.line_dancing",
        "tags": ["line-dancing", "country-dance", "dance", "nightlife", "weekly"],
    },
    # ---------- IMPROV ----------
    {
        "venue_key": "dads-garage",
        "day": 4,  # Friday
        "title": "Improv Night at Dad's Garage",
        "description": "Friday improv and sketch comedy at Dad's Garage Theatre in Reynoldstown. Atlanta's home for off-the-wall comedy since 1995.",
        "start_time": "20:00",
        "category": "comedy",
        "subcategory": "comedy.improv",
        "tags": ["improv", "comedy", "sketch-comedy", "weekly"],
    },
    {
        "venue_key": "dads-garage",
        "day": 5,  # Saturday
        "title": "Saturday Night Improv",
        "description": "Saturday night improv show at Dad's Garage Theatre. Unscripted comedy from one of Atlanta's longest-running improv troupes.",
        "start_time": "20:00",
        "category": "comedy",
        "subcategory": "comedy.improv",
        "tags": ["improv", "comedy", "weekly"],
    },
    {
        "venue_key": "whole-world-improv",
        "day": 4,  # Friday
        "title": "Friday Improv Showcase",
        "description": "Friday improv showcase at Whole World Improv Theatre in Midtown. Fast-paced, audience-driven comedy every week.",
        "start_time": "20:00",
        "category": "comedy",
        "subcategory": "comedy.improv",
        "tags": ["improv", "comedy", "weekly"],
    },
    {
        "venue_key": "whole-world-improv",
        "day": 5,  # Saturday
        "title": "Weekend Improv Show",
        "description": "Saturday evening improv at Whole World Improv Theatre. Interactive comedy with audience suggestions shaping every scene.",
        "start_time": "19:30",
        "category": "comedy",
        "subcategory": "comedy.improv",
        "tags": ["improv", "comedy", "weekly"],
    },
    # Village Theatre — REMOVED, venue unverifiable (Squarespace expired)
    # ---------- SKATE NIGHT ----------
    {
        "venue_key": "cascade-skating",
        "day": 4,  # Friday
        "title": "Friday Family Skate Night",
        "description": "Friday night roller skating at Cascade Family Skating. A Southwest Atlanta staple for decades with DJ-powered skate sessions.",
        "start_time": "19:00",
        "category": "entertainment",
        "subcategory": None,
        "tags": ["skating", "roller-skating", "family-friendly", "weekly"],
    },
    {
        "venue_key": "cascade-skating",
        "day": 5,  # Saturday
        "title": "Saturday Night Skate",
        "description": "Saturday night skating session at Cascade Family Skating. Music, lights, and wheels on the iconic Cascade Rd rink.",
        "start_time": "19:00",
        "category": "entertainment",
        "subcategory": None,
        "tags": ["skating", "roller-skating", "family-friendly", "weekly"],
    },
    {
        "venue_key": "sparkles-kennesaw",
        "day": 4,  # Friday
        "title": "Friday Night Skating",
        "description": "Friday night roller skating at Sparkles Family Fun Center in Kennesaw. DJ, lights, and family-friendly skating fun.",
        "start_time": "19:00",
        "category": "entertainment",
        "subcategory": None,
        "tags": ["skating", "roller-skating", "family-friendly", "weekly"],
    },
    {
        "venue_key": "sparkles-kennesaw",
        "day": 5,  # Saturday
        "title": "Saturday Skate Session",
        "description": "Saturday afternoon skating at Sparkles Family Fun Center in Kennesaw. Open skate with music and arcade games.",
        "start_time": "14:00",
        "category": "entertainment",
        "subcategory": None,
        "tags": ["skating", "roller-skating", "family-friendly", "weekly"],
    },
    # ---------- BINGO ----------
    {
        "venue_key": "monday-night-garage",
        "day": 2,  # Wednesday
        "title": "Brewery Bingo Night",
        "description": "Wednesday bingo night at Monday Night Brewing Garage in West End. Free to play with craft beer specials and prizes.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.bingo",
        "tags": ["bingo", "brewery", "nightlife", "weekly", "free"],
        "is_free": True,
    },
    {
        "venue_key": "wild-heaven-avondale",
        "day": 3,  # Thursday
        "title": "Bingo & Brews",
        "description": "Thursday bingo night at Wild Heaven Avondale. Free bingo rounds with craft beer specials in the taproom.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.bingo",
        "tags": ["bingo", "brewery", "nightlife", "weekly", "free"],
        "is_free": True,
    },
    {
        "venue_key": "wild-heaven-toco-hills",
        "day": 2,  # Wednesday
        "title": "Music Bingo",
        "description": "Wednesday music bingo at Wild Heaven x Fox Bros Toco Hills. Free to play with prizes.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.bingo",
        "tags": ["bingo", "music-bingo", "brewery", "nightlife", "weekly", "free"],
        "is_free": True,
    },
    # Note: Gene's BBQ already has Tuesday bingo (Kiki Casino Bingo, day=1) — no duplicate needed
    # ---------- LATIN NIGHT ----------
    {
        "venue_key": "havana-club",
        "day": 4,  # Friday
        "title": "Havana Nights — Latin Dance Party",
        "description": "Friday Latin dance party at Havana Club ATL in Buckhead. Salsa, bachata, reggaeton, and merengue all night with resident DJs.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.latin_night",
        "tags": ["latin-night", "bachata", "salsa-night", "dance", "nightlife", "weekly"],
    },
    # havana-club Sat latin: handled by dedicated source (sources/havana_club.py)
    # "el-bar" Latin Thursdays — REMOVED, venue permanently closed (replaced by Bar ANA)
    # Note: Tongue & Groove already has Latin Wednesdays (day=2) — no duplicate needed
    # ---------- VIEWING PARTY (NFL season: Sep–Feb) ----------
    {
        "venue_key": "hudson-grille-midtown",
        "day": 6,  # Sunday
        "title": "NFL Sunday Watch Party",
        "description": "NFL Sunday watch party at Hudson Grille Midtown. Big screens, drink specials, and game-day atmosphere on Peachtree.",
        "start_time": "13:00",
        "category": "sports",
        "subcategory": None,
        "tags": ["viewing-party", "sports", "football", "nfl", "weekly"],
        "active_months": [9, 10, 11, 12, 1, 2],
    },
    {
        "venue_key": "hudson-grille-midtown",
        "day": 0,  # Monday
        "title": "Monday Night Football",
        "description": "Monday Night Football at Hudson Grille Midtown. Wings, beer specials, and every game on the big screens.",
        "start_time": "19:00",
        "category": "sports",
        "subcategory": None,
        "tags": ["viewing-party", "sports", "football", "nfl", "weekly"],
        "active_months": [9, 10, 11, 12, 1],
    },
    # Game Day at STATS — duplicate of NFL Sunday at STATS Brewpub (line ~3185), removed
    {
        "venue_key": "stats-brewpub",
        "day": 3,  # Thursday
        "title": "Thursday Night Football",
        "description": "Thursday Night Football at STATS Brewpub downtown. Craft beer and game-day food specials with every NFL Thursday game.",
        "start_time": "19:00",
        "category": "sports",
        "subcategory": None,
        "tags": ["viewing-party", "sports", "football", "nfl", "weekly"],
        "active_months": [9, 10, 11, 12, 1],
    },
    # ==================================================================
    # VINYL / LISTENING NIGHTS
    # ==================================================================
    {
        "venue_key": "commune",
        "day": 3,  # Thursday
        "title": "Vinyl Listening Session",
        "description": "Thursday evening vinyl listening session at Commune in Avondale Estates. Nationally recognized hi-fi listening bar with curated vinyl selections and rotating guest selectors.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["vinyl", "listening-party", "hi-fi", "nightlife", "weekly"],
    },
    {
        "venue_key": "commune",
        "day": 4,  # Friday
        "title": "Friday Night Vinyl",
        "description": "Friday vinyl session at Commune. Hi-fi listening bar with curated sound and craft cocktails.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["vinyl", "listening-party", "hi-fi", "nightlife", "weekly"],
    },
    {
        "venue_key": "commune",
        "day": 5,  # Saturday
        "title": "Saturday Night Vinyl",
        "description": "Saturday vinyl session at Commune. Rotating selectors on the hi-fi system.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["vinyl", "listening-party", "hi-fi", "nightlife", "weekly"],
    },
    {
        "venue_key": "westside-motor-lounge",
        "day": 4,  # Friday
        "title": "Echo Room Vinyl Session",
        "description": "Friday vinyl listening session at the Echo Room inside Westside Motor Lounge. Curated by Atlanta's top selectors including DJ Kemit and Kai Alce.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["vinyl", "listening-party", "dj", "nightlife", "weekly"],
    },
    {
        "venue_key": "westside-motor-lounge",
        "day": 5,  # Saturday
        "title": "Echo Room Saturday Sessions",
        "description": "Saturday evening vinyl and DJ showcase at the Echo Room inside Westside Motor Lounge.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["vinyl", "listening-party", "dj", "nightlife", "weekly"],
    },
    {
        "venue_key": "stereo-atl",
        "day": 3,  # Thursday
        "title": "Vinyl Night at Stereo",
        "description": "Thursday vinyl night at Stereo in Inman Park. Coffee shop by day, listening bar by night. Curated vinyl on a hi-fi system with craft cocktails.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["vinyl", "listening-party", "hi-fi", "nightlife", "weekly"],
    },
    {
        "venue_key": "stereo-atl",
        "day": 5,  # Saturday
        "title": "Saturday Vinyl Session",
        "description": "Saturday evening vinyl session at Stereo in Inman Park. Rotating selectors and deep crate digs.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["vinyl", "listening-party", "hi-fi", "nightlife", "weekly"],
    },
    # ==================================================================
    # PUB RUNS / SOCIAL CYCLING
    # ==================================================================
    {
        "venue_key": "midway-pub",
        "day": 2,  # Wednesday
        "title": "Run! EAV",
        "description": "Wednesday group run starting and ending at Midway Pub in East Atlanta Village. 3-mile route through the neighborhood followed by post-run beers.",
        "start_time": "18:30",
        "category": "fitness",
        "subcategory": None,
        "tags": ["run-club", "running", "weekly", "brewery"],
    },
    # ==================================================================
    # BOOK CLUBS / LITERARY EVENTS
    # ==================================================================
    # ========== MONTHLY EVENTS ==========
    {
        "venue_key": "charis-books",
        "day": 5,  # Saturday
        "title": "Charis Book Club",
        "description": "Monthly book club at Charis Books & More in Decatur. Community reading and discussion. Check website for current selection.",
        "start_time": "14:00",
        "category": "words",
        "subcategory": None,
        "tags": ["book-club", "reading", "community", "monthly"],
        "frequency": "monthly",
        "week_of_month": 1,  # 1st Saturday
    },
    {
        "venue_key": "a-cappella-books",
        "day": 5,  # Saturday
        "title": "A Cappella Book Club",
        "description": "Monthly book club at A Cappella Books in Little Five Points. Curated reading and lively discussion.",
        "start_time": "15:00",
        "category": "words",
        "subcategory": None,
        "tags": ["book-club", "reading", "community", "monthly"],
        "frequency": "monthly",
        "week_of_month": 3,  # 3rd Saturday
    },
    # ========== BIWEEKLY EVENTS ==========
    {
        "venue_key": "inman-park-station",
        "day": 2,  # Wednesday
        "title": "Midweek Roll",
        "description": "Biweekly Wednesday night group bike ride through Atlanta. Social pace, 15-20 miles. Meet at the BeltLine Eastside Trail near Inman Park.",
        "start_time": "19:00",
        "category": "fitness",
        "subcategory": "fitness.cycling",
        "tags": ["cycling", "bike-ride", "free", "social", "biweekly"],
        "is_free": True,
        "frequency": "biweekly",
        "biweekly_anchor": "2026-03-11",  # Known ride date
    },
    # ========== SEASONAL EVENTS ==========
    {
        "venue_key": "colony-square",
        "day": 3,  # Thursday
        "title": "Movies on the Square",
        "description": "Free outdoor movie night at Colony Square in Midtown. Blankets, lawn chairs, and a big screen under the stars.",
        "start_time": "20:30",
        "category": "film",
        "subcategory": None,
        "tags": ["outdoor-movies", "free", "weekly", "family-friendly"],
        "is_free": True,
        "active_months": [5, 6, 7, 8, 9, 10],
    },
    {
        "venue_key": "atlantic-station",
        "day": 3,  # Thursday
        "title": "Screen on the Green",
        "description": "Free outdoor movie screening at Atlantic Station. Bring a blanket and enjoy a film on the Central Park lawn.",
        "start_time": "20:30",
        "category": "film",
        "subcategory": None,
        "tags": ["outdoor-movies", "free", "weekly", "family-friendly"],
        "is_free": True,
        "active_months": [5, 6, 7, 8, 9, 10],
    },
    # ========== WINE & SPIRITS TASTINGS ==========
    {
        "venue_key": "reverence-epicurean",
        "day": 2,  # Wednesday
        "title": "Wine Down Wednesday at Reverence",
        "description": "Weekly wine tasting at Reverence inside Epicurean Atlanta. Interactive tasting with rotating grape varieties and themes. Wine Spectator Award of Excellence winner. $10 per person.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["wine", "wine-tasting", "weekly", "date-night"],
        "is_free": False,
    },
    {
        "venue_key": "3-parks-wine-shop",
        "day": 2,  # Wednesday
        "title": "Wednesday Wine Tasting at 3 Parks",
        "description": "Educational wine tasting at 3 Parks Wine Shop in Glenwood Park. Sample 3-4 bottles with discussion of grapes, regions, and producers. $10-15 per person.",
        "start_time": "17:30",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["wine", "wine-tasting", "weekly", "chill"],
        "is_free": False,
    },
    {
        "venue_key": "city-winery-atlanta",
        "day": 5,  # Saturday
        "title": "Winery Tour & Tasting at City Winery",
        "description": "Saturday winery tour and tasting at City Winery Atlanta in Old Fourth Ward. Led by resident sommelier. Sample wines produced on-site plus selections from around the world, paired with curated charcuterie.",
        "start_time": "15:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["wine", "wine-tasting", "weekly", "date-night"],
        "is_free": False,
    },
    {
        "venue_key": "vinoteca-atl",
        "day": 3,  # Thursday
        "title": "Weekly Wine Tasting at VinoTeca",
        "description": "Curated selection of three wines at VinoTeca ATL in Inman Park. Staff-selected pours rotate weekly. Indoor and outdoor seating. $15 per person.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["wine", "wine-tasting", "weekly", "chill"],
        "is_free": False,
    },
    {
        "venue_key": "taste-wine-bar",
        "day": 1,  # Tuesday
        "title": "Taste of The Blues at Taste Wine Bar",
        "description": "Tuesday evening wine tasting with live blues at Taste Wine Bar and Market on the Upper Westside. 48 wines on tap via self-service Enomatic machines. Live music 6-9pm.",
        "start_time": "18:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["wine", "wine-tasting", "live-music", "blues", "weekly"],
        "is_free": False,
    },
    # ========== SPORTS WATCH PARTIES ==========
    {
        "venue_key": "brewhouse-cafe",
        "day": 5,  # Saturday
        "title": "EPL Saturday Morning Watch at Brewhouse Cafe",
        "description": "Premier League Saturday morning watch at Brewhouse Cafe in Little Five Points. Voted America's Best Soccer Bar. 27 large-screen TVs, opens early for EPL, Bundesliga, and Champions League matches.",
        "start_time": "07:30",
        "category": "sports",
        "subcategory": None,
        "tags": ["viewing-party", "soccer", "weekly"],
        "is_free": True,
        "active_months": [1, 2, 3, 4, 5, 8, 9, 10, 11, 12],
    },
    {
        "venue_key": "brewhouse-cafe",
        "day": 6,  # Sunday
        "title": "EPL Sunday Morning Watch at Brewhouse Cafe",
        "description": "Premier League Sunday morning matches at Brewhouse Cafe in Little Five Points. America's Best Soccer Bar opens early for all major European football leagues.",
        "start_time": "09:00",
        "category": "sports",
        "subcategory": None,
        "tags": ["viewing-party", "soccer", "weekly"],
        "is_free": True,
        "active_months": [1, 2, 3, 4, 5, 8, 9, 10, 11, 12],
    },
    {
        "venue_key": "fado-midtown",
        "day": 5,  # Saturday
        "title": "EPL Morning Watch at Fado Midtown",
        "description": "Premier League Saturday morning watch party at Fado Irish Pub Midtown. Official Atlanta United Pub Partner and home of Manchester United Supporters Club Atlanta. Opens early for EPL, Bundesliga, and La Liga.",
        "start_time": "07:30",
        "category": "sports",
        "subcategory": None,
        "tags": ["viewing-party", "soccer", "weekly"],
        "is_free": True,
        "active_months": [1, 2, 3, 4, 5, 8, 9, 10, 11, 12],
    },
    {
        "venue_key": "ri-ra-midtown",
        "day": 5,  # Saturday
        "title": "EPL Morning Watch at Ri Ra",
        "description": "Premier League Saturday morning watch at Ri Ra Irish Pub Midtown. Official Atlanta United Pub Partner. Popular with Chelsea FC fans. Opens early for all EPL and European matches.",
        "start_time": "07:30",
        "category": "sports",
        "subcategory": None,
        "tags": ["viewing-party", "soccer", "weekly"],
        "is_free": True,
        "active_months": [1, 2, 3, 4, 5, 8, 9, 10, 11, 12],
    },
    {
        "venue_key": "park-tavern",
        "day": 6,  # Sunday
        "title": "NFL Sunday Watch Party at Park Tavern",
        "description": "NFL Sunday watch party at Park Tavern overlooking Piedmont Park. 25+ HD TVs with all games. Official Atlanta United Pub Partner. Large projection screen for marquee matchups.",
        "start_time": "13:00",
        "category": "sports",
        "subcategory": None,
        "tags": ["viewing-party", "football", "nfl", "weekly"],
        "is_free": True,
        "active_months": [1, 2, 9, 10, 11, 12],
    },
    # Hudson Grille NFL Sunday — duplicate removed (already at line 3144)
    {
        "venue_key": "stats-brewpub",
        "day": 6,  # Sunday
        "title": "NFL Sunday at STATS Brewpub",
        "description": "NFL Sunday watch party at STATS Brewpub Downtown. 16,000 sq ft with 70 HD TVs across five bars. Part of Atlanta Falcons and Hawks Bar Networks. Self-pour beer tap system.",
        "start_time": "13:00",
        "category": "sports",
        "subcategory": None,
        "tags": ["viewing-party", "football", "nfl", "weekly"],
        "is_free": True,
        "active_months": [1, 2, 9, 10, 11, 12],
    },
    {
        "venue_key": "der-biergarten",
        "day": 5,  # Saturday
        "title": "Soccer Saturday at Der Biergarten",
        "description": "Soccer watch party at Der Biergarten Downtown. Official Atlanta United Pub Partner and longtime supporters headquarters. 7,000 sq ft beer hall with big screens. Opens early for EPL and international fixtures.",
        "start_time": "10:00",
        "category": "sports",
        "subcategory": None,
        "tags": ["viewing-party", "soccer", "weekly"],
        "is_free": True,
        "active_months": [1, 2, 3, 4, 5, 8, 9, 10, 11, 12],
    },
    # ==================================================================
    # SOMETHING DIFFERENT / ODDBALL EVENTS (Mar 2026)
    # ==================================================================
    # Sister Louisa's Tarot Tuesday — handled by dedicated source (sources/sister_louisas.py)
    # Red Light Cafe burlesque/variety — handled by dedicated source (sources/red_light_cafe.py)
    # Atlanta Eagle cabaret — handled by dedicated source (sources/atlanta_eagle.py)
    # Lips Atlanta drag brunch — handled by dedicated source (sources/lips_atlanta.py)
    # ---------- MURDER MYSTERY ----------
    {
        "venue_key": "petite-violette",
        "day": 4,  # Friday
        "title": "Murder, Mystery & Mayhem at Petite Violette",
        "description": "Interactive murder mystery dinner at Petite Violette in Brookhaven. Live actors, audience participation, and a four-course French dinner. Check-in 6:45pm, show at 7:30pm. $75/person.",
        "start_time": "19:30",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["murder-mystery", "variety-show", "date-night", "weekly"],
        "is_free": False,
        "price_min": 75,
        "price_max": 75,
    },
    {
        "venue_key": "petite-violette",
        "day": 5,  # Saturday
        "title": "Murder, Mystery & Mayhem at Petite Violette",
        "description": "Saturday murder mystery dinner at Petite Violette. Interactive whodunit with live actors and a four-course French dinner. Check-in 6:15pm, show at 7pm. $75/person.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["murder-mystery", "variety-show", "date-night", "weekly"],
        "is_free": False,
        "price_min": 75,
        "price_max": 75,
    },
    # ---------- OPERA DINNER (monthly, 3rd Tuesday) ----------
    {
        "venue_key": "petite-violette",
        "day": 1,  # Tuesday
        "title": "Dinner and a Diva at Petite Violette",
        "description": "Monthly opera dinner at Petite Violette featuring Capitol City Opera Company. Four-course French dinner with live opera performances. Cocktails at 6:15pm, dinner and show at 7pm. $75/person.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["variety-show", "cabaret", "date-night", "monthly"],
        "is_free": False,
        "price_min": 75,
        "price_max": 75,
        "frequency": "monthly",
        "week_of_month": 3,  # 3rd Tuesday
    },
    # ---------- BURLESQUE / SPEAKEASY ----------
    {
        "venue_key": "the-pigalle",
        "day": 5,  # Saturday
        "title": "Saturday Night Burlesque at The Pigalle",
        "description": "Live-band burlesque at The Pigalle Theater & Speakeasy in Underground Atlanta. In-house jazz band, variety acts, and absinthe cocktails in a Parisian speakeasy setting.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["burlesque", "variety-show", "cabaret", "jazz", "date-night", "weekly"],
    },
    {
        "venue_key": "the-pigalle",
        "day": 4,  # Friday
        "title": "Chanteuse & Cocktails at The Pigalle",
        "description": "Friday night chanteuse performances at The Pigalle in Underground Atlanta. Live vocals, cocktails, and intimate speakeasy atmosphere.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["cabaret", "variety-show", "date-night", "weekly"],
    },
    # ---------- SILENT DISCO ----------
    {
        "venue_key": "punch-bowl",
        "day": 5,  # Saturday
        "title": "Silent Disco at Punch Bowl Social",
        "description": "Monthly silent disco at Punch Bowl Social at The Battery. Three DJs on separate wireless headphone channels — you pick your vibe. Headphones provided.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["silent-disco", "dj", "dance", "nightlife", "monthly"],
        "frequency": "monthly",
        "week_of_month": 3,  # 3rd Saturday
        "active_months": [3, 4, 5, 6, 7, 8, 9],
    },
    # ---------- MURDER MYSTERY (monthly at Hudson Grille) ----------
    {
        "venue_key": "hudson-grille-midtown",
        "day": 4,  # Friday
        "title": "Murder Mystery Dinner at Hudson Grille",
        "description": "Monthly interactive murder mystery dinner at Hudson Grille Midtown. Three-course dinner and two-hour show with live actors. Guests play suspects and detectives.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["murder-mystery", "variety-show", "date-night", "monthly"],
        "frequency": "monthly",
        "week_of_month": 1,  # varies — approximating 1st Friday
    },
    # ---------- YAPPY HOUR ----------
    {
        "venue_key": "national-anthem",
        "day": 6,  # Sunday
        "title": "Yappy Hour at National Anthem",
        "description": "Sunday afternoon yappy hour at National Anthem at The Battery. Dog-friendly patio with pup snack menu and human cocktails. 3-5pm.",
        "start_time": "15:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["yappy-hour", "outdoor", "weekly"],
        "active_months": [3, 4, 5, 6, 7, 8, 9, 10],
    },
    # ---------- FIGURE DRAWING ----------
    {
        "venue_key": "the-supermarket-bakery",
        "day": 2,  # Wednesday
        "title": "Figure Drawing Night at The Supermarket",
        "description": "Monthly live figure drawing session at The Supermarket in Virginia-Highland. Short and long poses with a live model. BYO art supplies, all skill levels. $15/person. Drinks available.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["figure-drawing", "monthly"],
        "is_free": False,
        "price_min": 15,
        "price_max": 15,
        "frequency": "monthly",
        "week_of_month": 1,  # 1st Wednesday
    },
    # ---------- PRO WRESTLING ----------
    {
        "venue_key": "wwa4",
        "day": 3,  # Thursday
        "title": "WWA4 Live Pro Wrestling",
        "description": "Free weekly live pro wrestling at WWA4 in South Fulton. Atlanta's indie wrestling school puts on live shows with trained performers every Thursday at 8pm. Running since 1995.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["pro-wrestling", "free", "weekly"],
        "is_free": True,
    },
]


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a weekday (0=Monday, 6=Sunday)."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def _generate_dates(
    today: datetime, event_template: dict, weeks_ahead: int
) -> list[datetime]:
    """Generate event dates based on frequency, season, and schedule rules.

    Returns a list of datetime dates when this event should occur.
    """
    frequency = event_template.get("frequency", "weekly")
    active_months = event_template.get("active_months")
    day = event_template["day"]

    if frequency == "weekly":
        next_date = get_next_weekday(today, day)
        dates = [next_date + timedelta(weeks=w) for w in range(weeks_ahead)]

    elif frequency == "biweekly":
        anchor_str = event_template.get("biweekly_anchor")
        if not anchor_str:
            logger.warning(
                f"Biweekly event '{event_template['title']}' missing biweekly_anchor, skipping"
            )
            return []
        anchor = datetime.strptime(anchor_str, "%Y-%m-%d")
        next_date = get_next_weekday(today, day)
        # Align to the biweekly cadence from the anchor
        days_since_anchor = (next_date - anchor).days
        weeks_off = days_since_anchor // 7
        if weeks_off % 2 != 0:
            next_date += timedelta(weeks=1)
        dates = [next_date + timedelta(weeks=w * 2) for w in range(weeks_ahead)]

    elif frequency == "monthly":
        week_of_month = event_template.get("week_of_month", 1)
        dates = []
        for month_offset in range(weeks_ahead):  # generate N months ahead
            month = today.month + month_offset
            year = today.year + (month - 1) // 12
            month = ((month - 1) % 12) + 1
            d = _nth_weekday_of_month(year, month, day, week_of_month)
            if d and d >= today:
                dates.append(d)
    else:
        logger.warning(
            f"Unknown frequency '{frequency}' for '{event_template['title']}', skipping"
        )
        return []

    # Apply seasonal gate
    if active_months:
        dates = [d for d in dates if d.month in active_months]

    return dates


def _nth_weekday_of_month(
    year: int, month: int, weekday: int, n: int
) -> datetime | None:
    """Get the nth occurrence of a weekday in a given month.

    Args:
        weekday: 0=Monday, 6=Sunday
        n: 1=first, 2=second, ... -1=last
    """
    import calendar

    if n == -1:
        # Last occurrence: start from end of month
        last_day = calendar.monthrange(year, month)[1]
        d = datetime(year, month, last_day)
        while d.weekday() != weekday:
            d -= timedelta(days=1)
        return d

    # nth occurrence: find first, then add (n-1) weeks
    first = datetime(year, month, 1)
    days_ahead = weekday - first.weekday()
    if days_ahead < 0:
        days_ahead += 7
    first_occurrence = first + timedelta(days=days_ahead)
    result = first_occurrence + timedelta(weeks=n - 1)
    if result.month != month:
        return None  # e.g. 5th Tuesday doesn't exist
    return result


def _build_recurrence_rule(event_template: dict) -> str:
    """Build an iCal RRULE string from a template's scheduling fields."""
    frequency = event_template.get("frequency", "weekly")
    day_code = DAY_CODES[event_template["day"]]

    if frequency == "weekly":
        return f"FREQ=WEEKLY;BYDAY={day_code}"
    elif frequency == "biweekly":
        return f"FREQ=WEEKLY;INTERVAL=2;BYDAY={day_code}"
    elif frequency == "monthly":
        week_of_month = event_template.get("week_of_month", 1)
        if week_of_month == -1:
            return f"FREQ=MONTHLY;BYDAY=-1{day_code}"
        return f"FREQ=MONTHLY;BYDAY={week_of_month}{day_code}"
    return f"FREQ=WEEKLY;BYDAY={day_code}"


def _format_time_label(time_24: str) -> str:
    try:
        return datetime.strptime(time_24, "%H:%M").strftime("%-I:%M %p")
    except Exception:
        return time_24


def _build_recurring_description(event_template: dict, venue_data: dict, source_url: str) -> str:
    base = " ".join(str(event_template.get("description") or "").split()).strip()
    day_name = DAY_NAMES[int(event_template["day"])]
    time_label = _format_time_label(str(event_template.get("start_time") or ""))
    venue_name = str(venue_data.get("name") or "").strip()
    neighborhood = str(venue_data.get("neighborhood") or "").strip()
    city = str(venue_data.get("city") or "Atlanta").strip()
    state = str(venue_data.get("state") or "GA").strip()
    category = str(event_template.get("category") or "event").replace("_", " ")

    location = venue_name
    if neighborhood:
        location = f"{location} in {neighborhood}"
    location = f"{location}, {city}, {state}"

    parts = []
    if base:
        parts.append(base if base.endswith(".") else f"{base}.")
    parts.append(
        f"Recurring weekly {category} event every {day_name} at {time_label}."
    )
    parts.append(f"Location: {location}.")

    price_min = event_template.get("price_min")
    price_max = event_template.get("price_max")
    if event_template.get("is_free") is True:
        parts.append("Typically free to attend.")
    elif price_min is not None and price_max is not None and price_min == price_max:
        parts.append(f"Typical cost: ${price_min}.")
    elif price_min is not None or price_max is not None:
        low = "?" if price_min is None else str(price_min)
        high = "?" if price_max is None else str(price_max)
        parts.append(f"Typical cost range: ${low}-${high}.")
    else:
        parts.append("Cover charge and specials may vary by week.")

    parts.append(
        f"Check venue channels for current lineup, hosts, and any weekly schedule changes ({source_url})."
    )
    return " ".join(parts)[:1400]


_GENERIC_DOMAINS = frozenset({
    "instagram.com", "facebook.com", "twitter.com", "x.com",
    "tiktok.com", "youtube.com", "linktr.ee", "eventbrite.com",
    "ticketmaster.com", "dice.fm", "meetup.com",
})


def _normalize_domain(url: Optional[str]) -> Optional[str]:
    """Normalize URL domains so different source URLs can be compared reliably.

    Returns None for generic/social-media domains that many venues share,
    preventing false-positive suppression matches.
    """
    if not url:
        return None
    candidate = url.strip()
    if not candidate:
        return None
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    try:
        netloc = urlparse(candidate).netloc.lower()
    except Exception:
        return None
    if not netloc:
        return None
    if netloc.startswith("www."):
        netloc = netloc[4:]
    if netloc in _GENERIC_DOMAINS:
        return None
    return netloc


def _normalize_slug(slug: Optional[str]) -> str:
    return (slug or "").strip().lower().replace("_", "-")


def _slugs_related(a: Optional[str], b: Optional[str]) -> bool:
    sa = _normalize_slug(a)
    sb = _normalize_slug(b)
    if not sa or not sb:
        return False
    return sa == sb or sa.startswith(sb) or sb.startswith(sa)


def _compute_venue_suppressions(source_slug: str) -> dict[str, str]:
    """
    Determine recurring venue templates to skip because another dedicated source is active.

    This prevents overlapping recurring templates (e.g. Laughing Skull/Boggs/Smith's)
    from creating visible duplicates when direct venue crawlers are already running.
    """
    suppressions: dict[str, str] = {}

    try:
        client = get_client()
        active_sources = (
            client.table("sources")
            .select("slug,url,is_active")
            .eq("is_active", True)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        logger.warning(
            f"Could not load active sources for recurring suppression check: {exc}"
        )
        return suppressions

    # Exclude this source from overlap checks.
    candidate_sources = [
        s
        for s in active_sources
        if _normalize_slug(s.get("slug")) != _normalize_slug(source_slug)
    ]

    for venue_key, venue in VENUES.items():
        venue_slug = venue.get("slug")
        venue_domain = _normalize_domain(venue.get("website"))
        for source in candidate_sources:
            source_slug_candidate = source.get("slug")
            source_domain = _normalize_domain(source.get("url"))

            if venue_domain and source_domain and venue_domain == source_domain:
                suppressions[venue_key] = (
                    f"active source '{source_slug_candidate}' shares domain '{source_domain}'"
                )
                break

            if _slugs_related(venue_slug, source_slug_candidate) or _slugs_related(
                venue_key, source_slug_candidate
            ):
                suppressions[venue_key] = (
                    f"active source '{source_slug_candidate}' slug-overlaps venue slug '{venue_slug}'"
                )
                break

    return suppressions


def _compute_closed_venue_suppressions() -> dict[str, str]:
    """Suppress recurring templates tied to registry-closed venues."""
    suppressions: dict[str, str] = {}
    for venue_key, venue in VENUES.items():
        venue_slug = _normalize_slug(venue.get("slug"))
        if venue_slug in CLOSED_VENUE_SLUGS:
            suppressions[venue_key] = "venue is in closed_venues registry"
    return suppressions


def _remove_suppressed_future_events(
    source_id: int,
    suppressions: dict[str, str],
    today_date: str,
    venue_ids: dict[str, int],
) -> int:
    """
    Remove future recurring-social events for venues we now suppress.

    This keeps previously inserted recurring templates from lingering in feeds
    after a dedicated source is identified for that venue.
    """
    if not suppressions:
        return 0

    client = get_client()
    removed = 0

    for venue_key in suppressions.keys():
        venue_data = VENUES.get(venue_key)
        if not venue_data:
            continue
        if venue_key not in venue_ids:
            venue_ids[venue_key] = get_or_create_venue(venue_data)
        venue_id = venue_ids[venue_key]

        if not writes_enabled():
            logger.info(
                f"[DRY RUN] Would remove suppressed recurring events for venue '{venue_key}' "
                f"(id={venue_id}) from {today_date} onward"
            )
            continue

        try:
            result = (
                client.table("events")
                .delete(count="exact")
                .eq("source_id", source_id)
                .eq("venue_id", venue_id)
                .gte("start_date", today_date)
                .execute()
            )
            removed += int(result.count or 0)
        except Exception as exc:
            logger.warning(
                f"Failed to remove suppressed recurring events for venue '{venue_key}' (id={venue_id}): {exc}"
            )

    return removed


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate recurring events (weekly, biweekly, monthly, seasonal) for all configured venues."""
    source_id = source["id"]
    source_slug = source.get("slug", "")
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    logger.info(f"Generating recurring social events for next {WEEKS_AHEAD} weeks")
    logger.info(
        f"Processing {len(EVENT_TEMPLATES)} event templates across {len(VENUES)} venues"
    )

    # Cache venue IDs
    venue_ids = {}

    suppressions = _compute_venue_suppressions(source_slug)
    for venue_key, reason in _compute_closed_venue_suppressions().items():
        suppressions.setdefault(venue_key, reason)
    if suppressions:
        logger.info(
            f"Recurring suppression active for {len(suppressions)} venue(s): "
            + ", ".join(sorted(suppressions.keys()))
        )
        removed = _remove_suppressed_future_events(
            source_id=source_id,
            suppressions=suppressions,
            today_date=today.strftime("%Y-%m-%d"),
            venue_ids=venue_ids,
        )
        if removed:
            logger.info(f"Removed {removed} suppressed recurring future event(s)")

    for event_template in EVENT_TEMPLATES:
        venue_key = event_template["venue_key"]
        venue_data = VENUES.get(venue_key)

        if not venue_data:
            logger.warning(f"Unknown venue key: {venue_key}")
            continue

        if venue_key in suppressions:
            logger.debug(
                f"Skipping recurring template for venue '{venue_key}' ({event_template['title']}): "
                f"{suppressions[venue_key]}"
            )
            continue

        # Skip venues without a real website — badslava is only a research lead,
        # not a valid source URL. If we can't link to the venue, don't generate.
        if not venue_data.get("website"):
            logger.debug(
                f"Skipping venue '{venue_key}' ({event_template['title']}): "
                "no website — need a real source before generating events"
            )
            continue

        # Get or cache venue ID
        if venue_key not in venue_ids:
            venue_ids[venue_key] = get_or_create_venue(venue_data)

        venue_id = venue_ids[venue_key]
        venue_name = venue_data["name"]
        frequency = event_template.get("frequency", "weekly")

        # Generate dates based on frequency and season rules
        event_dates = _generate_dates(today, event_template, WEEKS_AHEAD)
        if not event_dates:
            continue

        # Pre-compute template-level fields (same across all dates)
        source_url = venue_data["website"]  # guaranteed by skip-check above
        description = _build_recurring_description(
            event_template,
            venue_data=venue_data,
            source_url=source_url,
        )

        # Derive genres from subcategory (e.g. "nightlife.karaoke" → ["karaoke"])
        subcategory = event_template.get("subcategory") or ""
        derived_genres = []
        if "." in subcategory:
            genre_part = subcategory.split(".", 1)[1].replace("_", "-")
            if genre_part:
                derived_genres = [genre_part]

        # Auto-append venue name to generic titles
        raw_title = event_template["title"]
        venue_words = venue_name.lower().split()
        title_lower = raw_title.lower()
        title_has_venue = any(w in title_lower for w in venue_words if len(w) > 2)
        display_title = raw_title if title_has_venue else f"{raw_title} at {venue_name}"

        price_min = event_template.get("price_min")
        price_max = event_template.get("price_max")
        is_free = (
            event_template.get("is_free", False)
            if price_min is None and price_max is None
            else False
        )

        # Build recurrence rule
        rrule = _build_recurrence_rule(event_template)

        for event_date in event_dates:
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(
                display_title, venue_name, start_date
            )

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": display_title,
                "description": description,
                "start_date": start_date,
                "start_time": event_template["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": event_template["category"],
                "subcategory": event_template.get("subcategory"),
                "genres": derived_genres,
                "tags": event_template["tags"],
                "price_min": price_min,
                "price_max": price_max,
                "price_note": event_template.get("price_note"),
                "is_free": is_free,
                "source_url": source_url,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{display_title} - {start_date}",
                "extraction_confidence": 0.90,
                "is_recurring": True,
                "is_class": event_template.get("is_class", False),
                "recurrence_rule": rrule,
                "content_hash": content_hash,
            }

            # Skip if a non-ARSE source already covers this venue+date
            canonical = find_cross_source_canonical_for_insert(event_record)
            if canonical:
                events_updated += 1
                continue

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            series_hint = {
                "series_type": "recurring_show",
                "series_title": display_title,
                "frequency": frequency,
                "day_of_week": DAY_NAMES[event_template["day"]].lower(),
                "description": description,
            }

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.debug(
                    f"Added: {event_template['title']} at {venue_name} on {start_date}"
                )
            except Exception as e:
                logger.error(
                    f"Failed to insert {event_template['title']} at {venue_name}: {e}"
                )

    logger.info(
        f"Recurring social events crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
    )

    return events_found, events_new, events_updated
