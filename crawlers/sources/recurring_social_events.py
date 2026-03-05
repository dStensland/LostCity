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
    "metro-fun-center": {
        "name": "Metro Fun Center",
        "slug": "metro-fun-center",
        "address": "1959 Metropolitan Pkwy SW",
        "neighborhood": "Lakewood",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30315",
        "venue_type": "entertainment_venue",
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
        "neighborhood": "Virginia Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
        "website": "https://www.limerickjunction.com/events",
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
        "zip": "30306",
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
    "blue-martini": {
        "name": "Blue Martini Atlanta",
        "slug": "blue-martini-atlanta",
        "address": "3402 Piedmont Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "venue_type": "bar",
        # website removed — server unreachable, verify if still open (2026-03)
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
        "neighborhood": "Little Five Points",
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
        "neighborhood": "Virginia Highland",
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
        "address": "736 Ponce De Leon Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "nightclub",
    },
    "music-room": {
        "name": "The Music Room",
        "slug": "the-music-room",
        "address": "327 Edgewood Ave SE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "music_venue",
        "website": "https://www.facebook.com/themusicroomatl",
    },
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
        "name": "Apache Cafe",
        "slug": "apache-cafe",
        "address": "64 3rd St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "bar",
        "website": "https://apachexlr.com/",
    },
    "dieselfillingstation": {
        "name": "Diesel Filling Station",
        "slug": "diesel-filling-station",
        "address": "870 N Highland Ave NE",
        "neighborhood": "Virginia Highland",
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
    },
    "new-realm-brewing": {
        "name": "New Realm Brewing",
        "slug": "new-realm-brewing",
        "address": "550 Somerset Terrace NE",
        "neighborhood": "Inman Park",
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
    "the-glenwood": {
        "name": "The Glenwood",
        "slug": "the-glenwood",
        "address": "1263 Glenwood Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
    },
    "flatiron": {
        "name": "Flatiron",
        "slug": "flatiron-eav",
        "address": "520 Flat Shoals Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
    },
    "marys-bar": {
        "name": "Mary's Bar",
        "slug": "marys-bar-atlanta",
        "address": "1287 Glenwood Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
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
        "address": "3180 Roswell Rd NW",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
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
        "address": "318 Memorial Dr SE",
        "neighborhood": "Grant Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "venue_type": "restaurant",
        "website": "https://bonelickbbq.com",
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
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
        # website removed — domain hijacked by gambling site (2026-03)
    },
    "avondale-estates-art-lot": {
        "name": "Avondale Estates Art Lot",
        "slug": "avondale-estates-art-lot",
        "address": "64 N Avondale Rd",
        "neighborhood": "Avondale Estates",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30002",
        "venue_type": "park",
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
        "venue_type": "park",
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
    "aces-up-atlanta": {
        "name": "Aces Up Atlanta Bar Poker",
        "slug": "aces-up-atlanta-bar-poker",
        "address": "2500 N Decatur Rd",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "venue_type": "bar",
    },
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
    "village-theatre": {
        "name": "Village Theatre",
        "slug": "village-theatre",
        "address": "7509 Main St",
        "neighborhood": "Suwanee",
        "city": "Suwanee",
        "state": "GA",
        "zip": "30024",
        "venue_type": "theater",
        # website removed — Squarespace expired (2026-03)
    },
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
        "address": "3535 Cascade Rd SW",
        "neighborhood": "Cascade",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30311",
        "venue_type": "entertainment_venue",
        "website": "https://cascadefamilyskating.com",
    },
    "sparkles-kennesaw": {
        "name": "Sparkles Family Fun Center",
        "slug": "sparkles-family-fun-center-kennesaw",
        "address": "2070 Cobb Pkwy NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30152",
        "venue_type": "entertainment_venue",
        "website": "https://www.sparkles.com",
    },
    # Latin night venues
    "havana-club-atl": {
        "name": "Havana Club ATL",
        "slug": "havana-club-atl",
        "address": "3112 Piedmont Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "venue_type": "nightclub",
        "website": "https://www.havanaclubbuckhead.com",
    },
    "el-bar": {
        "name": "El Bar",
        "slug": "el-bar",
        "address": "939 Ponce De Leon Ave NE",
        "neighborhood": "Virginia Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
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
        "address": "100 N Avondale Rd",
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
        "neighborhood": "East Atlanta",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
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
}

# ============================================
# EVENT SCHEDULE
# Day of week: 0=Monday, 6=Sunday
# ============================================

WEEKLY_EVENTS = [
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
        "title": "Karaoke Night",
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
        "title": "Karaoke Night",
        "description": "Weekly karaoke at Daiquiriville in Downtown Atlanta.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly"],
    },
    {
        "venue_key": "roll-1-cafe",
        "day": 3,  # Thursday
        "title": "Karaoke Night",
        "description": "Weekly karaoke at Roll 1 Cafe.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly"],
    },
    {
        "venue_key": "your-3rd-spot",
        "day": 3,  # Thursday
        "title": "Karaoke Night",
        "description": "Weekly karaoke at Your 3rd Spot on the Upper Westside.",
        "start_time": "20:30",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly"],
    },
    {
        "venue_key": "smiths-olde-bar",
        "day": 3,  # Thursday
        "title": "Karaoke Night",
        "description": "Weekly karaoke at Smith's Olde Bar, Atlanta's legendary live music venue.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly"],
    },
    {
        "venue_key": "metro-fun-center",
        "day": 4,  # Friday
        "title": "Karaoke Night",
        "description": "Friday night karaoke at Metro Fun Center.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly", "family-friendly"],
    },
    # ========== OPEN MICS ==========
    {
        "venue_key": "joes-coffeehouse",
        "day": 0,  # Monday
        "title": "Open Mic Night",
        "description": "Weekly open mic at Joe's Coffeehouse in East Atlanta. All performers welcome — music, poetry, spoken word.",
        "start_time": "17:00",
        "category": "words",
        "subcategory": None,
        "tags": ["open-mic", "poetry", "spoken-word", "weekly"],
    },
    {
        "venue_key": "our-bar-atl",
        "day": 0,  # Monday
        "title": "Open Mic Night",
        "description": "Monday open mic at Our Bar ATL on Edgewood Ave. Music, comedy, and spoken word.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "nightlife", "weekly"],
    },
    {
        "venue_key": "southern-feed-store",
        "day": 1,  # Tuesday
        "title": "Open Mic Night",
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
        "title": "Open Mic Night",
        "description": "Tuesday open mic at Limerick Junction in Virginia Highland. Music and comedy.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "nightlife", "weekly"],
    },
    {
        "venue_key": "limelight-theater",
        "day": 1,  # Tuesday
        "title": "Late Night Open Mic",
        "description": "Late night open mic at Limelight Theater in Downtown Atlanta.",
        "start_time": "22:00",
        "category": "comedy",
        "subcategory": "comedy.standup",
        "tags": ["open-mic", "comedy", "weekly", "late-night"],
    },
    # Farm Burger Midtown — removed, implausible open mic venue (burger restaurant)
    {
        "venue_key": "red-light-cafe",
        "day": 2,  # Wednesday
        "title": "Wednesday Jazz Jam",
        "description": "Weekly jazz jam session at Red Light Cafe in Midtown. Musicians welcome to sit in. A staple of Atlanta's jazz scene since 1996.",
        "start_time": "21:00",
        "category": "music",
        "subcategory": "music.jazz",
        "tags": ["jazz", "jam-session", "live-music", "weekly"],
    },
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
        "title": "Open Mic Night",
        "description": "Thursday open mic at ASW Whiskey Exchange in West End.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "nightlife", "weekly"],
    },
    {
        "venue_key": "atlantucky",
        "day": 3,  # Thursday
        "title": "Open Mic Night",
        "description": "Thursday open mic at Atlantucky Brewing.",
        "start_time": "18:30",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "nightlife", "weekly", "brewery"],
    },
    {
        "venue_key": "urban-grind",
        "day": 3,  # Thursday
        "title": "Open Mic Night",
        "description": "Thursday open mic at Urban Grind coffee shop. Poetry and spoken word.",
        "start_time": "19:00",
        "category": "words",
        "subcategory": None,
        "tags": ["open-mic", "poetry", "spoken-word", "weekly"],
    },
    {
        "venue_key": "kats-cafe",
        "day": 3,  # Thursday
        "title": "Open Mic Night",
        "description": "Thursday open mic at Kat's Cafe in Midtown. Poetry and spoken word.",
        "start_time": "19:00",
        "category": "words",
        "subcategory": None,
        "tags": ["open-mic", "poetry", "spoken-word", "weekly"],
    },
    {
        "venue_key": "battery-atlanta",
        "day": 3,  # Thursday
        "title": "Open Mic Night",
        "description": "Thursday open mic at The Battery Atlanta entertainment district.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "nightlife", "weekly"],
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
        "title": "Open Mic Night",
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
        "title": "Board Game Night",
        "description": "Weekly board game night at Jason's Deli in Dunwoody. Bring your own games or join others.",
        "start_time": "17:00",
        "category": "community",
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
        "title": "Community Game Night",
        "description": "Saturday community game night at Church of the Epiphany. All ages welcome.",
        "start_time": "18:00",
        "category": "community",
        "subcategory": None,
        "tags": ["games", "board-games", "weekly", "family-friendly", "community"],
    },
    # ========== BINGO ==========
    {
        "venue_key": "punch-bowl",
        "day": 3,  # Thursday
        "title": "Bingo Night",
        "description": "Thursday bingo night at Punch Bowl Social at The Battery.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["bingo", "games", "weekly"],
    },
    {
        "venue_key": "blue-martini",
        "day": 6,  # Sunday
        "title": "Sunday Funday Bingo",
        "description": "Sunday bingo at Blue Martini Atlanta in Buckhead.",
        "start_time": "12:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["bingo", "games", "weekly", "brunch"],
    },
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
        "title": "Blues Night",
        "description": "Friday blues night at Elliott Street Deli & Pub in Castleberry Hill.",
        "start_time": "21:00",
        "category": "music",
        "subcategory": "music.blues",
        "tags": ["blues", "live-music", "nightlife", "weekly"],
    },
    # ========== ADDITIONAL KARAOKE ==========
    {
        "venue_key": "sister-louisas",
        "day": 2,  # Wednesday
        "title": "Karaoke Night",
        "description": "Wednesday karaoke at Sister Louisa's Church on Edgewood Ave. Sing surrounded by outsider art.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly", "lgbtq-friendly"],
    },
    # ========== ADDITIONAL TRIVIA ==========
    {
        "venue_key": "brick-store-pub",
        "day": 1,  # Tuesday
        "title": "Trivia Night",
        "description": "Tuesday trivia at Brick Store Pub in downtown Decatur. Award-winning beer selection and pub trivia.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly", "craft-beer"],
    },
    {
        "venue_key": "the-porter",
        "day": 2,  # Wednesday
        "title": "Trivia Night",
        "description": "Wednesday trivia at The Porter Beer Bar in Little Five Points.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly", "craft-beer"],
    },
    {
        "venue_key": "wrecking-bar",
        "day": 2,  # Wednesday
        "title": "Trivia Night",
        "description": "Wednesday trivia at Wrecking Bar Brewpub in Little Five Points. House-brewed beers and pub trivia.",
        "start_time": "19:30",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly", "brewery"],
    },
    # ==================================================================
    # Phase 0b: NEW RECURRING EVENTS
    # ==================================================================
    # ========== ADDITIONAL TRIVIA ==========
    {
        "venue_key": "thinking-man",
        "day": 1,  # Tuesday
        "title": "Trivia Night",
        "description": "Tuesday trivia at Thinking Man Tavern in Decatur. Neighborhood bar vibes and solid pub trivia.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    {
        "venue_key": "righteous-room",
        "day": 3,  # Thursday
        "title": "Trivia Night",
        "description": "Thursday trivia at Righteous Room on Ponce. Dive bar trivia in Virginia Highland.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    {
        "venue_key": "the-local",
        "day": 2,  # Wednesday
        "title": "Trivia Night",
        "description": "Wednesday trivia at The Local in Ponce City Market.",
        "start_time": "19:30",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    {
        "venue_key": "twains",
        "day": 2,  # Wednesday
        "title": "Team Trivia",
        "description": "Wednesday team trivia at Twain's Billiards & Tap in Decatur. Pool tables, craft beer, and pub trivia.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    {
        "venue_key": "dieselfillingstation",
        "day": 1,  # Tuesday
        "title": "Trivia Night",
        "description": "Tuesday trivia at Diesel Filling Station in Virginia Highland. Patio-friendly pub trivia.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    # ========== DJ NIGHTS / DANCE ==========
    {
        "venue_key": "mjq-concourse",
        "day": 3,  # Thursday
        "title": "MJQ Thursday",
        "description": "Thursday DJ night at MJQ Concourse. Underground dance vibes below Ponce De Leon. One of Atlanta's longest-running dance nights.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "dance", "nightlife", "weekly", "late-night", "high-energy"],
    },
    {
        "venue_key": "mjq-concourse",
        "day": 4,  # Friday
        "title": "MJQ Friday",
        "description": "Friday DJ night at MJQ Concourse. Atlanta's legendary underground dance club.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "dance", "nightlife", "weekly", "late-night", "high-energy"],
    },
    {
        "venue_key": "mjq-concourse",
        "day": 5,  # Saturday
        "title": "MJQ Saturday",
        "description": "Saturday DJ night at MJQ Concourse. The best dance floor in Atlanta, underground on Ponce.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "dance", "nightlife", "weekly", "late-night", "high-energy"],
    },
    {
        "venue_key": "music-room",
        "day": 4,  # Friday
        "title": "Friday Night DJ Set",
        "description": "Friday DJ set at The Music Room on Edgewood Ave. Rotating DJs, cocktails, and late-night vibes.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "dance", "nightlife", "weekly", "late-night"],
    },
    {
        "venue_key": "music-room",
        "day": 5,  # Saturday
        "title": "Saturday Night DJ Set",
        "description": "Saturday DJ set at The Music Room on Edgewood Ave.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "dance", "nightlife", "weekly", "late-night"],
    },
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
        "description": "Thursday open mic and poetry slam at Apache Cafe in Midtown. Atlanta's creative arts and spoken word staple.",
        "start_time": "20:00",
        "category": "words",
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
    {
        "venue_key": "peachtree-road-farmers-market",
        "day": 5,  # Saturday
        "title": "Peachtree Road Farmers Market",
        "description": "Saturday farmers market at Cathedral of St. Philip in Buckhead. Seasonal produce, baked goods, and local vendors.",
        "start_time": "08:30",
        "category": "markets",
        "subcategory": None,
        "tags": ["farmers-market", "outdoor", "weekly", "family-friendly", "seasonal"],
    },
    # ==================================================================
    # Phase 2: NEIGHBORHOOD + DAY GAP FILLS
    # ==================================================================
    # ========== LITTLE FIVE POINTS ==========
    {
        "venue_key": "elmyr",
        "day": 1,  # Tuesday
        "title": "Taco Tuesday",
        "description": "Taco Tuesday specials at Elmyr in Little Five Points. Cheap tacos and margaritas in L5P's favorite late-night taqueria.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["food-specials", "tacos", "weekly", "budget-friendly"],
    },
    # ========== INMAN PARK ==========
    {
        "venue_key": "barcelona-wine-bar",
        "day": 2,  # Wednesday
        "title": "Wine Wednesday",
        "description": "Wednesday wine specials at Barcelona Wine Bar in Inman Park. Half-off select bottles and tapas pairings.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["wine", "food-specials", "weekly", "date-night"],
    },
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
        "title": "Trivia Night",
        "description": "Tuesday trivia at Victory Sandwich Bar in Inman Park. Craft cocktails, sandwiches, and pub trivia.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    {
        "venue_key": "new-realm-brewing",
        "day": 3,  # Thursday
        "title": "Trivia Night",
        "description": "Thursday trivia at New Realm Brewing on the BeltLine. Craft beer, rooftop views, and pub trivia.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly", "brewery", "beltline"],
    },
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
    {
        "venue_key": "krog-street-market",
        "day": 5,  # Saturday
        "title": "Saturday Live Music",
        "description": "Saturday live music at Krog Street Market in Inman Park. Local performers in the food hall courtyard.",
        "start_time": "12:00",
        "category": "music",
        "subcategory": None,
        "tags": ["live-music", "weekly", "family-friendly"],
    },
    # ========== EAST ATLANTA VILLAGE ==========
    {
        "venue_key": "the-glenwood",
        "day": 2,  # Wednesday
        "title": "Trivia Night",
        "description": "Wednesday trivia at The Glenwood in East Atlanta Village. Neighborhood bar trivia with a loyal crowd.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    {
        "venue_key": "the-glenwood",
        "day": 4,  # Friday
        "title": "Friday DJ Night",
        "description": "Friday DJ night at The Glenwood in East Atlanta Village.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "nightlife", "weekly", "late-night"],
    },
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
    {
        "venue_key": "marys-bar",
        "day": 4,  # Friday
        "title": "Friday Drag Show",
        "description": "Friday drag show at Mary's in East Atlanta Village. Atlanta's beloved queer dive bar.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.drag",
        "tags": ["drag", "nightlife", "weekly", "lgbtq-friendly"],
    },
    {
        "venue_key": "marys-bar",
        "day": 5,  # Saturday
        "title": "Saturday DJ Night",
        "description": "Saturday DJ night at Mary's in East Atlanta Village. Dance floor, cheap drinks, queer dive bar energy.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "dance", "nightlife", "weekly", "lgbtq-friendly"],
    },
    # ========== SUNDAY GAP FILLS ==========
    {
        "venue_key": "northside-tavern",
        "day": 6,  # Sunday
        "title": "Sunday Blues Jam",
        "description": "Sunday blues jam at Northside Tavern in West Midtown. Atlanta's iconic juke joint — live blues every Sunday for decades.",
        "start_time": "16:00",
        "category": "music",
        "subcategory": "music.blues",
        "tags": ["blues", "live-music", "jam-session", "weekly"],
    },
    {
        "venue_key": "northside-tavern",
        "day": 4,  # Friday
        "title": "Friday Night Blues",
        "description": "Friday night live blues at Northside Tavern. Atlanta's legendary blues bar since 1973.",
        "start_time": "21:30",
        "category": "music",
        "subcategory": "music.blues",
        "tags": ["blues", "live-music", "nightlife", "weekly"],
    },
    {
        "venue_key": "northside-tavern",
        "day": 5,  # Saturday
        "title": "Saturday Night Blues",
        "description": "Saturday night live blues at Northside Tavern. The real deal — no frills, just blues.",
        "start_time": "21:30",
        "category": "music",
        "subcategory": "music.blues",
        "tags": ["blues", "live-music", "nightlife", "weekly"],
    },
    {
        "venue_key": "park-tavern",
        "day": 6,  # Sunday
        "title": "Sunday Live Music",
        "description": "Sunday live music at Park Tavern overlooking Piedmont Park. Outdoor stage, craft beer, and local bands.",
        "start_time": "15:00",
        "category": "music",
        "subcategory": None,
        "tags": ["live-music", "outdoor", "weekly", "family-friendly"],
    },
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
        "title": "Sunday Open Mic",
        "description": "Sunday open mic at Apache Cafe in Midtown. Poetry, spoken word, and acoustic sets.",
        "start_time": "19:00",
        "category": "words",
        "subcategory": None,
        "tags": ["open-mic", "poetry", "spoken-word", "weekly"],
    },
    {
        "venue_key": "wrecking-bar",
        "day": 6,  # Sunday
        "title": "Sunday Brunch",
        "description": "Sunday brunch at Wrecking Bar Brewpub in Little Five Points. House-brewed beers and brunch favorites in a historic firehouse.",
        "start_time": "10:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["brunch", "brewery", "weekly", "family-friendly"],
    },
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
        "subcategory": None,
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
        "subcategory": None,
        "tags": ["trivia", "games", "nightlife", "weekly", "brewery"],
    },
    # Cherry Street Brewing — West Midtown
    {
        "venue_key": "cherry-street-brewing",
        "day": 2,  # Wednesday
        "title": "Open Mic Night",
        "description": "Wednesday open mic at Cherry Street Brewing taproom. Live music from local performers.",
        "start_time": "19:00",
        "category": "music",
        "subcategory": None,
        "tags": ["open-mic", "live-music", "weekly", "brewery"],
    },
    {
        "venue_key": "cherry-street-brewing",
        "day": 4,  # Friday
        "title": "Friday Live Music",
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
        "subcategory": None,
        "tags": ["trivia", "games", "nightlife", "weekly", "brewery"],
    },
    {
        "venue_key": "three-taverns",
        "day": 1,  # Tuesday
        "title": "Mario Kart Night",
        "description": "Tuesday Mario Kart N64 gaming night at Three Taverns Imaginarium. Play in the upstairs loft.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
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
        "subcategory": None,
        "tags": ["bingo", "dj", "nightlife", "weekly", "free"],
    },
    {
        "venue_key": "genes-bbq",
        "day": 3,  # Thursday
        "title": "Homestar Karaoke",
        "description": "Thursday karaoke at Gene's BBQ. All classics, no filler.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": None,
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
        "subcategory": None,
        "tags": ["dj", "nightlife", "weekly", "drink-specials"],
    },
    # Whitehall Tavern — Buckhead
    {
        "venue_key": "whitehall-tavern",
        "day": 2,  # Wednesday
        "title": "Trivia Night",
        "description": "Wednesday trivia night at Whitehall Tavern in Buckhead.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["trivia", "games", "nightlife", "weekly"],
    },
    {
        "venue_key": "whitehall-tavern",
        "day": 3,  # Thursday
        "title": "Trivia Night",
        "description": "Thursday trivia night at Whitehall Tavern in Buckhead.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": None,
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
        "subcategory": None,
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
        "subcategory": None,
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
        "subcategory": None,
        "tags": ["dnd", "tabletop", "games", "weekly", "free"],
    },
    {
        "venue_key": "joystick",
        "day": 1,  # Tuesday
        "title": "ATL D&D Drop-In",
        "description": "Free drop-in D&D 5e at Joystick Gamebar on Edgewood Ave. New players welcome — free pre-gen characters and dice provided. All ages before 8pm.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["dnd", "tabletop", "games", "weekly", "free"],
    },
    # Bone Lick BBQ — Grant Park (ITP)
    {
        "venue_key": "bone-lick-bbq",
        "day": 3,  # Thursday
        "title": "ATL D&D Drop-In",
        "description": "Thursday D&D at Bone Lick BBQ. Happy hour at 6pm, official start at 7pm, games begin ~7:30. Free drop-in D&D 5e.",
        "start_time": "18:00",
        "category": "nightlife",
        "subcategory": None,
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
        "subcategory": None,
        "tags": ["board-games", "tabletop", "games", "weekly"],
    },
    {
        "venue_key": "giga-bites-cafe",
        "day": 2,  # Wednesday
        "title": "D&D Adventurers League",
        "description": "Official D&D Adventurers League play at Giga-Bites Cafe. Arrive by 6:30pm, tables assigned 6:45, games at 7.",
        "start_time": "18:30",
        "category": "nightlife",
        "subcategory": None,
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
        "tags": ["dnd", "kids", "tabletop", "weekly"],
    },
    # My Parents' Basement — Avondale Estates
    {
        "venue_key": "my-parents-basement",
        "day": 1,  # Tuesday
        "title": "Geek Trivia Night",
        "description": "Tuesday comic book and geek trivia at My Parents' Basement. 20 pinball machines and board games available.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "geek", "comics", "pinball", "games", "weekly"],
    },
    {
        "venue_key": "my-parents-basement",
        "day": 1,  # Tuesday
        "title": "Comic Book Trivia Night",
        "description": "Tuesday trivia night at My Parents Basement in Avondale Estates. Comics, sci-fi, pop culture. Free to play.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "comics", "geek", "weekly", "free"],
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
        "subcategory": None,
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
        "subcategory": None,
        "tags": ["running", "run-club", "free", "weekly"],
    },
    {
        "venue_key": "big-peach-running-midtown",
        "day": 5,  # Saturday
        "title": "Big Peach Saturday Run",
        "description": "Saturday morning group run from Big Peach Running Co Midtown. All levels welcome.",
        "start_time": "07:30",
        "category": "fitness",
        "subcategory": None,
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
        "subcategory": None,
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
        "subcategory": None,
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
    # Woodruff Park Free Yoga
    {
        "venue_key": "woodruff-park",
        "day": 5,  # Saturday
        "title": "Free Yoga in Woodruff Park",
        "description": "Free Saturday morning vinyasa flow yoga in Woodruff Park downtown. All levels welcome. Bring your own mat.",
        "start_time": "10:00",
        "category": "wellness",
        "subcategory": None,
        "tags": ["yoga", "free", "outdoor", "weekly"],
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
    # Midweek Roll — biweekly social ride (listed as weekly; description notes every other Wednesday)
    {
        "venue_key": "97-estoria",
        "day": 2,  # Wednesday
        "title": "Midweek Roll — Social Bike Ride",
        "description": "Wednesday evening social-paced bike ride from 97 Estoria in Reynoldstown. 10-12 miles at 10-12 mph. Helmets and lights required. Ends back at the bar. Every other Wednesday.",
        "start_time": "19:00",
        "category": "fitness",
        "subcategory": "fitness.cycling",
        "tags": ["cycling", "bike-ride", "free", "social", "biweekly"],
        "is_free": True,
    },
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
        "category": "food_drink",
        "subcategory": None,
        "tags": ["vintage", "shopping", "free", "weekly"],
        "is_free": True,
    },
    # ==================================================================
    # VOLUNTEER (Feb 2026)
    # ==================================================================
    # Grant Park Volunteer Workday — removed, monthly event (2nd Saturday only)
    # can't be represented in weekly generator; would create 6x instances per month
    # ==================================================================
    # FOOD & DRINK SPECIALS (Feb 2026)
    # ==================================================================
    # --- MONDAY ---
    # Lloyd's Monday Crab Night
    {
        "venue_key": "lloyds-atl",
        "day": 0,  # Monday
        "title": "Monday Crab Night",
        "description": "Monday crab legs at Lloyd's in Inman Park. $35 snow crab plate with boiled potatoes, corn, and biscuit. An Atlanta institution.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["seafood", "crab", "specials", "weekly"],
        "price_min": 35,
        "price_max": 35,
    },
    # Taverna Monday Half-Price Wine
    {
        "venue_key": "taverna-buckhead",
        "day": 0,  # Monday
        "title": "Half-Price Wine Mondays",
        "description": "All wine bottles under $90 are half price all day Monday at Taverna in Buckhead.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["wine", "specials", "half-price", "weekly"],
    },
    # Wild Heaven Avondale — Monday half-price margaritas
    {
        "venue_key": "wild-heaven-avondale",
        "day": 0,  # Monday
        "title": "Half-Price Margarita Mondays",
        "description": "Half-price margaritas all day Monday at Wild Heaven Avondale. Plus Music Bingo.",
        "start_time": "15:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["margaritas", "specials", "half-price", "brewery", "weekly"],
    },
    # --- TUESDAY (Taco Tuesday) ---
    # Pure Taqueria Taco Tuesday
    {
        "venue_key": "pure-taqueria-inman-park",
        "day": 1,  # Tuesday
        "title": "Taco Tuesday",
        "description": "Taco Tuesday at Pure Taqueria. $3.50 tacos (chipotle chicken, shredded pork, fish) and $2 Tecates all day.",
        "start_time": "11:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["tacos", "taco-tuesday", "specials", "weekly"],
    },
    # Tin Lizzy's Taco Tuesday
    {
        "venue_key": "tin-lizzys-midtown",
        "day": 1,  # Tuesday
        "title": "Taco Tuesday",
        "description": "$2 select tacos and $5 Patron shots all day at Tin Lizzy's Cantina Midtown.",
        "start_time": "11:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["tacos", "taco-tuesday", "specials", "weekly"],
    },
    # Forza Storico — Tuesday half-price wine
    {
        "venue_key": "forza-storico",
        "day": 1,  # Tuesday
        "title": "Half-Price Wine Tuesdays",
        "description": "Half-price wine bottles from 5pm at Forza Storico in West Midtown.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["wine", "specials", "half-price", "weekly"],
    },
    # --- WEDNESDAY (Wine + Wings + Oysters) ---
    # Antico Wine Wednesday
    {
        "venue_key": "antico-pizza",
        "day": 2,  # Wednesday
        "title": "Wine Wednesday",
        "description": "Half-price wine bottles with pizza purchase all day Wednesday at Antico Pizza in West Midtown.",
        "start_time": "11:30",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["wine", "pizza", "specials", "half-price", "weekly"],
    },
    # Pielands Wing Wednesday
    {
        "venue_key": "pielands",
        "day": 2,  # Wednesday
        "title": "Wing Wednesday — Half-Price Wings",
        "description": "Half-price wings all day Wednesday at Pielands in Virginia-Highland.",
        "start_time": "11:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["wings", "specials", "half-price", "weekly"],
    },
    # Beso $1 Oysters Wednesday
    {
        "venue_key": "beso-buckhead",
        "day": 2,  # Wednesday
        "title": "$1 Oyster Night",
        "description": "Dollar oysters and half-price wine bottles at Beso Buckhead every Wednesday 10pm-2am.",
        "start_time": "22:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["oysters", "specials", "late-night", "weekly"],
    },
    # Wild Heaven Toco Hills — Wednesday half-off pitchers
    {
        "venue_key": "wild-heaven-toco-hills",
        "day": 2,  # Wednesday
        "title": "Half-Off Pitchers + Music Bingo",
        "description": "Half-off beer pitchers and Music Bingo at 7pm at Wild Heaven x Fox Bros Toco Hills.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["beer", "bingo", "specials", "half-price", "weekly"],
    },
    # --- THURSDAY ---
    # Cypress Street Half-Price Wine Thursday
    {
        "venue_key": "cypress-street-pint",
        "day": 3,  # Thursday
        "title": "Half-Price Wine Night",
        "description": "Half-price wine bottles all evening at Cypress Street Pint & Plate in Midtown.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["wine", "specials", "half-price", "weekly"],
    },
    # Fontaine's Half-Price Seafood — CLOSED, removed (2026-03)
    # --- DAILY HAPPY HOURS (Mon / Wed / Fri anchors) ---
    # Watchman's $1 Oysters (Tue-Thu + Sun)
    {
        "venue_key": "watchmans-seafood",
        "day": 1,  # Tuesday
        "title": "$1 Oyster Happy Hour",
        "description": "Dollar oysters from the full raw bar menu at Watchman's in Krog Street Market. 5-6pm Tuesday through Thursday, 4-6pm Sunday.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["oysters", "specials", "dollar-oysters", "weekly"],
    },
    {
        "venue_key": "watchmans-seafood",
        "day": 2,  # Wednesday
        "title": "$1 Oyster Happy Hour",
        "description": "Dollar oysters from the full raw bar menu at Watchman's in Krog Street Market. 5-6pm Tuesday through Thursday, 4-6pm Sunday.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["oysters", "specials", "dollar-oysters", "weekly"],
    },
    {
        "venue_key": "watchmans-seafood",
        "day": 3,  # Thursday
        "title": "$1 Oyster Happy Hour",
        "description": "Dollar oysters from the full raw bar menu at Watchman's in Krog Street Market. 5-6pm Tuesday through Thursday, 4-6pm Sunday.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["oysters", "specials", "dollar-oysters", "weekly"],
    },
    {
        "venue_key": "watchmans-seafood",
        "day": 6,  # Sunday
        "title": "$1 Oyster Happy Hour",
        "description": "Dollar oysters from the full raw bar menu at Watchman's in Krog Street Market. 4-6pm Sunday.",
        "start_time": "16:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["oysters", "specials", "dollar-oysters", "weekly"],
    },
    # The Optimist $1 Oysters (Mon / Wed / Fri anchors for Mon-Fri run)
    {
        "venue_key": "the-optimist",
        "day": 0,  # Monday
        "title": "$1 Oyster Happy Hour",
        "description": "Dollar select oysters at the raw bar during happy hour at The Optimist in West Midtown. 5-6pm weekdays.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["oysters", "specials", "dollar-oysters", "weekly"],
    },
    {
        "venue_key": "the-optimist",
        "day": 2,  # Wednesday
        "title": "$1 Oyster Happy Hour",
        "description": "Dollar select oysters at the raw bar during happy hour at The Optimist in West Midtown. 5-6pm weekdays.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["oysters", "specials", "dollar-oysters", "weekly"],
    },
    {
        "venue_key": "the-optimist",
        "day": 4,  # Friday
        "title": "$1 Oyster Happy Hour",
        "description": "Dollar select oysters at the raw bar during happy hour at The Optimist in West Midtown. 5-6pm weekdays.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["oysters", "specials", "dollar-oysters", "weekly"],
    },
    # Iberian Pig Jamon Happy Hour (Mon / Wed / Fri anchors for Mon-Fri run)
    {
        "venue_key": "iberian-pig-decatur",
        "day": 0,  # Monday
        "title": "Jamon Happy Hour",
        "description": "Discounted charcuterie boards, cheese, and $5 sangria/wine at The Iberian Pig Decatur. 5-7pm weekdays.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["tapas", "wine", "sangria", "specials", "weekly"],
    },
    {
        "venue_key": "iberian-pig-decatur",
        "day": 2,  # Wednesday
        "title": "Jamon Happy Hour",
        "description": "Discounted charcuterie boards, cheese, and $5 sangria/wine at The Iberian Pig Decatur. 5-7pm weekdays.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["tapas", "wine", "sangria", "specials", "weekly"],
    },
    {
        "venue_key": "iberian-pig-decatur",
        "day": 4,  # Friday
        "title": "Jamon Happy Hour",
        "description": "Discounted charcuterie boards, cheese, and $5 sangria/wine at The Iberian Pig Decatur. 5-7pm weekdays.",
        "start_time": "17:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["tapas", "wine", "sangria", "specials", "weekly"],
    },
    # Bartaco Happy Hour (Wed + Fri anchors for Mon-Fri run)
    {
        "venue_key": "bartaco-inman-park",
        "day": 2,  # Wednesday
        "title": "$3 Tacos & $5 Margaritas Happy Hour",
        "description": "$3 tacos, $5 margaritas, and $2 sides at Bartaco Inman Park. 3-6pm Monday through Friday.",
        "start_time": "15:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["tacos", "margaritas", "happy-hour", "specials", "weekly"],
    },
    {
        "venue_key": "bartaco-inman-park",
        "day": 4,  # Friday
        "title": "$3 Tacos & $5 Margaritas Happy Hour",
        "description": "$3 tacos, $5 margaritas, and $2 sides at Bartaco Inman Park. 3-6pm Monday through Friday.",
        "start_time": "15:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["tacos", "margaritas", "happy-hour", "specials", "weekly"],
    },
    # Superica Happy Hour (Wed + Fri anchors for Mon-Fri run)
    {
        "venue_key": "superica-krog",
        "day": 2,  # Wednesday
        "title": "Happy Hour at the Bar",
        "description": "Food and drink specials at the bar and patio at Superica in Krog Street Market. 3-6pm weekdays.",
        "start_time": "15:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["happy-hour", "specials", "weekly"],
    },
    {
        "venue_key": "superica-krog",
        "day": 4,  # Friday
        "title": "Happy Hour at the Bar",
        "description": "Food and drink specials at the bar and patio at Superica in Krog Street Market. 3-6pm weekdays.",
        "start_time": "15:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["happy-hour", "specials", "weekly"],
    },
    # BeetleCat Late Night Oysters (Fri + Sat)
    {
        "venue_key": "beetlecat",
        "day": 4,  # Friday
        "title": "Late-Night Oyster Happy Hour",
        "description": "Late-night oyster and drink specials at BeetleCat in Inman Park. 11pm-2am Friday and Saturday.",
        "start_time": "23:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["oysters", "late-night", "specials", "weekly"],
    },
    {
        "venue_key": "beetlecat",
        "day": 5,  # Saturday
        "title": "Late-Night Oyster Happy Hour",
        "description": "Late-night oyster and drink specials at BeetleCat in Inman Park. 11pm-2am Friday and Saturday.",
        "start_time": "23:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["oysters", "late-night", "specials", "weekly"],
    },
    # Fado Midtown — Bottomless Mimosa Brunch (Sat + Sun)
    # Note: "fado-irish-pub" key = Buckhead location; "fado-midtown" = Midtown/Peachtree St
    {
        "venue_key": "fado-midtown",
        "day": 5,  # Saturday
        "title": "Bottomless Mimosa Brunch",
        "description": "$17 bottomless mimosas and $19 bottomless sangria at Fado Irish Pub Midtown. Until 3pm.",
        "start_time": "10:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["brunch", "mimosas", "bottomless", "specials", "weekly"],
    },
    {
        "venue_key": "fado-midtown",
        "day": 6,  # Sunday
        "title": "Bottomless Mimosa Brunch",
        "description": "$17 bottomless mimosas and $19 bottomless sangria at Fado Irish Pub Midtown. Until 3pm.",
        "start_time": "10:00",
        "category": "food_drink",
        "subcategory": None,
        "tags": ["brunch", "mimosas", "bottomless", "specials", "weekly"],
    },
    # ========== Regular Hangs buildout: new categories ==========
    # ---------- POKER ----------
    {
        "venue_key": "eddies-attic",
        "day": 1,  # Tuesday
        "title": "Aces Up Bar Poker League",
        "description": "Weekly freeroll bar poker league night at Eddie's Attic in Decatur, hosted by Aces Up Atlanta. Free to play with prizes for top finishers.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["poker", "freeroll", "bar-poker", "nightlife", "weekly"],
        "is_free": True,
    },
    {
        "venue_key": "joystick",
        "day": 2,  # Wednesday
        "title": "Aces Up Bar Poker — Freeroll",
        "description": "Wednesday freeroll poker night at Joystick Gamebar on Edgewood Ave, hosted by Aces Up Atlanta. No buy-in, prizes awarded.",
        "start_time": "19:30",
        "category": "nightlife",
        "subcategory": None,
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
        "subcategory": None,
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
        "subcategory": None,
        "tags": ["line-dancing", "country-dance", "dance", "nightlife", "weekly"],
    },
    {
        "venue_key": "johnny-hideaway",
        "day": 5,  # Saturday
        "title": "Saturday Night Country Dance",
        "description": "Saturday night country and line dancing at Johnny's Hideaway in Buckhead. Atlanta's iconic venue for two-stepping and boot-scootin'.",
        "start_time": "20:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["line-dancing", "country-dance", "dance", "nightlife", "weekly"],
    },
    # ---------- IMPROV ----------
    {
        "venue_key": "dads-garage",
        "day": 4,  # Friday
        "title": "Improv Night",
        "description": "Friday improv and sketch comedy at Dad's Garage Theatre in Reynoldstown. Atlanta's home for off-the-wall comedy since 1995.",
        "start_time": "20:00",
        "category": "comedy",
        "subcategory": None,
        "tags": ["improv", "comedy", "sketch-comedy", "weekly"],
    },
    {
        "venue_key": "dads-garage",
        "day": 5,  # Saturday
        "title": "Saturday Night Improv",
        "description": "Saturday night improv show at Dad's Garage Theatre. Unscripted comedy from one of Atlanta's longest-running improv troupes.",
        "start_time": "20:00",
        "category": "comedy",
        "subcategory": None,
        "tags": ["improv", "comedy", "weekly"],
    },
    {
        "venue_key": "whole-world-improv",
        "day": 4,  # Friday
        "title": "Friday Improv Showcase",
        "description": "Friday improv showcase at Whole World Improv Theatre in Midtown. Fast-paced, audience-driven comedy every week.",
        "start_time": "20:00",
        "category": "comedy",
        "subcategory": None,
        "tags": ["improv", "comedy", "weekly"],
    },
    {
        "venue_key": "whole-world-improv",
        "day": 5,  # Saturday
        "title": "Weekend Improv Show",
        "description": "Saturday evening improv at Whole World Improv Theatre. Interactive comedy with audience suggestions shaping every scene.",
        "start_time": "19:30",
        "category": "comedy",
        "subcategory": None,
        "tags": ["improv", "comedy", "weekly"],
    },
    {
        "venue_key": "village-theatre",
        "day": 4,  # Friday
        "title": "Friday Night Improv",
        "description": "Friday night improv comedy at Village Theatre in Suwanee. Family-friendly laughs from Atlanta's north-side comedy hub.",
        "start_time": "20:00",
        "category": "comedy",
        "subcategory": None,
        "tags": ["improv", "comedy", "weekly"],
        "price_min": 10,
        "price_max": 15,
    },
    {
        "venue_key": "village-theatre",
        "day": 5,  # Saturday
        "title": "Saturday Night Comedy & Improv",
        "description": "Saturday night comedy and improv show at Village Theatre in Suwanee. Live unscripted performances and guest comedians.",
        "start_time": "20:00",
        "category": "comedy",
        "subcategory": None,
        "tags": ["improv", "comedy", "weekly"],
        "price_min": 10,
        "price_max": 15,
    },
    # ---------- SKATE NIGHT ----------
    {
        "venue_key": "cascade-skating",
        "day": 4,  # Friday
        "title": "Friday Family Skate Night",
        "description": "Friday night roller skating at Cascade Family Skating. A Southwest Atlanta staple for decades with DJ-powered skate sessions.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["skating", "roller-skating", "nightlife", "weekly"],
    },
    {
        "venue_key": "cascade-skating",
        "day": 5,  # Saturday
        "title": "Saturday Night Skate",
        "description": "Saturday night skating session at Cascade Family Skating. Music, lights, and wheels on the iconic Cascade Rd rink.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["skating", "roller-skating", "nightlife", "weekly"],
    },
    {
        "venue_key": "sparkles-kennesaw",
        "day": 4,  # Friday
        "title": "Friday Night Skating",
        "description": "Friday night roller skating at Sparkles Family Fun Center in Kennesaw. DJ, lights, and family-friendly skating fun.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["skating", "roller-skating", "nightlife", "weekly"],
    },
    {
        "venue_key": "sparkles-kennesaw",
        "day": 5,  # Saturday
        "title": "Saturday Skate Session",
        "description": "Saturday afternoon skating at Sparkles Family Fun Center in Kennesaw. Open skate with music and arcade games.",
        "start_time": "14:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["skating", "roller-skating", "weekly"],
    },
    # ---------- BINGO ----------
    {
        "venue_key": "monday-night-garage",
        "day": 2,  # Wednesday
        "title": "Brewery Bingo Night",
        "description": "Wednesday bingo night at Monday Night Brewing Garage in West End. Free to play with craft beer specials and prizes.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
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
        "subcategory": None,
        "tags": ["bingo", "brewery", "nightlife", "weekly", "free"],
        "is_free": True,
    },
    # Note: Gene's BBQ already has Tuesday bingo (Kiki Casino Bingo, day=1) — no duplicate needed
    # ---------- LATIN NIGHT ----------
    {
        "venue_key": "havana-club-atl",
        "day": 4,  # Friday
        "title": "Havana Nights — Latin Dance Party",
        "description": "Friday Latin dance party at Havana Club ATL in Buckhead. Salsa, bachata, reggaeton, and merengue all night with resident DJs.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["latin-night", "bachata", "salsa-night", "dance", "nightlife", "weekly"],
    },
    {
        "venue_key": "havana-club-atl",
        "day": 5,  # Saturday
        "title": "Sabado Latino",
        "description": "Saturday Latin night at Havana Club ATL. Bachata, salsa, and reggaeton in Buckhead's premier Latin club.",
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["latin-night", "bachata", "salsa-night", "dance", "nightlife", "weekly"],
    },
    {
        "venue_key": "el-bar",
        "day": 3,  # Thursday
        "title": "Latin Thursdays",
        "description": "Thursday Latin night at El Bar on Ponce. Reggaeton, salsa, and bachata in Virginia Highland.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["latin-night", "bachata", "salsa-night", "reggaeton", "nightlife", "weekly"],
    },
    # Note: Tongue & Groove already has Latin Wednesdays (day=2) — no duplicate needed
    # ---------- VIEWING PARTY ----------
    {
        "venue_key": "hudson-grille-midtown",
        "day": 6,  # Sunday
        "title": "NFL Sunday Watch Party",
        "description": "NFL Sunday watch party at Hudson Grille Midtown. Big screens, drink specials, and game-day atmosphere on Peachtree.",
        "start_time": "13:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["viewing-party", "sports", "football", "nfl", "nightlife", "weekly"],
    },
    {
        "venue_key": "hudson-grille-midtown",
        "day": 0,  # Monday
        "title": "Monday Night Football",
        "description": "Monday Night Football at Hudson Grille Midtown. Wings, beer specials, and every game on the big screens.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["viewing-party", "sports", "football", "nfl", "nightlife", "weekly"],
    },
    {
        "venue_key": "stats-brewpub",
        "day": 6,  # Sunday
        "title": "Game Day at STATS",
        "description": "NFL Sunday watch party at STATS Brewpub downtown. Wall-to-wall screens and game-day specials steps from Centennial Park.",
        "start_time": "13:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["viewing-party", "sports", "football", "nfl", "nightlife", "weekly"],
    },
    {
        "venue_key": "stats-brewpub",
        "day": 3,  # Thursday
        "title": "Thursday Night Football",
        "description": "Thursday Night Football at STATS Brewpub downtown. Craft beer and game-day food specials with every NFL Thursday game.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["viewing-party", "sports", "football", "nfl", "nightlife", "weekly"],
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
        "title": "Vinyl Night",
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
    {
        "venue_key": "charis-books",
        "day": 3,  # Thursday
        "title": "Charis Book Club",
        "description": "Monthly book club at Charis Books & More in Decatur. Atlanta's oldest feminist bookstore and LGBTQ+ community hub. Open to all readers.",
        "start_time": "19:00",
        "category": "words",
        "subcategory": None,
        "tags": ["book-club", "reading", "monthly"],
    },
    {
        "venue_key": "charis-books",
        "day": 5,  # Saturday
        "title": "Author Reading & Signing",
        "description": "Saturday author events at Charis Books & More in Decatur. Readings, signings, and conversations with authors. Check website for schedule.",
        "start_time": "14:00",
        "category": "words",
        "subcategory": None,
        "tags": ["reading", "author-event", "weekly"],
    },
    {
        "venue_key": "a-cappella-books",
        "day": 6,  # Sunday
        "title": "A Cappella Book Club",
        "description": "Monthly book club at A Cappella Books in Little Five Points. Atlanta's beloved independent bookstore since 1989.",
        "start_time": "15:00",
        "category": "words",
        "subcategory": None,
        "tags": ["book-club", "reading", "monthly"],
    },
    # ==================================================================
    # OUTDOOR MOVIES (seasonal May-October)
    # ==================================================================
    {
        "venue_key": "colony-square",
        "day": 3,  # Thursday
        "title": "Movies on the Square",
        "description": "Free outdoor movies at Colony Square in Midtown. Seasonal series running May through October on select Thursdays. Bring a blanket.",
        "start_time": "20:00",
        "category": "film",
        "subcategory": None,
        "tags": ["outdoor", "free", "family-friendly", "seasonal", "weekly"],
    },
    {
        "venue_key": "atlantic-station",
        "day": 3,  # Thursday
        "title": "Screen on the Green",
        "description": "Free outdoor movie screenings at Atlantic Station. Seasonal summer series with films on the Central Lawn. Bring chairs and blankets.",
        "start_time": "20:30",
        "category": "film",
        "subcategory": None,
        "tags": ["outdoor", "free", "family-friendly", "seasonal", "weekly"],
    },
]


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a weekday (0=Monday, 6=Sunday)."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


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


def _normalize_domain(url: Optional[str]) -> Optional[str]:
    """Normalize URL domains so different source URLs can be compared reliably."""
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
    """Generate recurring weekly events for all configured venues."""
    source_id = source["id"]
    source_slug = source.get("slug", "")
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    logger.info(f"Generating recurring social events for next {WEEKS_AHEAD} weeks")
    logger.info(
        f"Processing {len(WEEKLY_EVENTS)} event templates across {len(VENUES)} venues"
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

    for event_template in WEEKLY_EVENTS:
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

        # Find next occurrence of this day
        next_date = get_next_weekday(today, event_template["day"])

        # Generate events for the next N weeks
        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")

            events_found += 1

            content_hash = generate_content_hash(
                event_template["title"], venue_name, start_date
            )

            # Support optional price fields in event templates
            price_min = event_template.get("price_min")
            price_max = event_template.get("price_max")
            is_free = (
                event_template.get("is_free", False)
                if price_min is None and price_max is None
                else False
            )

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

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": event_template["title"],
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
                "raw_text": f"{event_template['title']} at {venue_name} - {start_date}",
                "extraction_confidence": 0.90,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={DAY_CODES[event_template['day']]}",
                "content_hash": content_hash,
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            series_hint = {
                "series_type": "recurring_show",
                "series_title": event_template["title"],
                "frequency": "weekly",
                "day_of_week": DAY_NAMES[event_template["day"]],
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
