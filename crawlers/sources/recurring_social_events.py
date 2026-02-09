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

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# How many weeks ahead to generate events
WEEKS_AHEAD = 6

# Day mapping for recurrence rules
DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

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
    "boggs": {
        "name": "Boggs Social & Supply",
        "slug": "boggs-social-supply",
        "address": "1310 White St SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30310",
        "venue_type": "bar",
    },
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
        "website": "https://www.smithsoldebar.com",
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
    },
    "laughing-skull": {
        "name": "Laughing Skull Lounge",
        "slug": "laughing-skull-lounge",
        "address": "878 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "comedy_club",
        "website": "https://laughingskulllounge.com",
    },
    "limerick-junction": {
        "name": "Limerick Junction",
        "slug": "limerick-junction",
        "address": "822 N Highland Ave NE",
        "neighborhood": "Virginia Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
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
        "website": "https://bluemartinilounge.com",
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
    {
        "venue_key": "boggs",
        "day": 2,  # Wednesday
        "title": "Karaoke Night W/ Music Mike",
        "description": "Weekly karaoke night with Music Mike at Boggs Social & Supply in West End.",
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly"],
    },
    # TEN ATL verified events (not karaoke as badslava listed)
    {
        "venue_key": "ten-atl",
        "day": 0,  # Monday
        "title": "Monday Night Jazz Jam",
        "description": "Weekly jazz jam session at TEN ATL featuring the Churchill Grounds Trio. Keeping jazz alive one Monday at a time.",
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
        "tags": ["r&b", "dj", "nightlife", "weekly"],
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
        "description": "Weekly open mic at Joe's Coffeehouse in East Atlanta. All performers welcome.",
        "start_time": "17:00",
        "category": "community",
        "subcategory": None,
        "tags": ["open-mic", "comedy", "music", "poetry", "weekly"],
    },
    {
        "venue_key": "our-bar-atl",
        "day": 0,  # Monday
        "title": "Open Mic Night",
        "description": "Monday open mic at Our Bar ATL on Edgewood Ave.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "comedy", "music", "weekly"],
    },
    {
        "venue_key": "southern-feed-store",
        "day": 1,  # Tuesday
        "title": "Open Mic Night",
        "description": "Tuesday open mic at Southern Feed Store in East Atlanta. Comedy, music, and poetry welcome.",
        "start_time": "19:00",
        "category": "community",
        "subcategory": None,
        "tags": ["open-mic", "comedy", "music", "poetry", "weekly"],
    },
    # Laughing Skull verified: Open mics Mon-Wed at 8PM, $15
    {
        "venue_key": "laughing-skull",
        "day": 0,  # Monday
        "title": "Open Mic Comedy Night",
        "description": "Weekly comedy open mic at Laughing Skull Lounge, Atlanta's premier comedy club in Midtown. $15 cover.",
        "start_time": "20:00",
        "category": "comedy",
        "subcategory": "comedy.standup",
        "tags": ["open-mic", "comedy", "standup", "weekly"],
        "price_min": 15,
        "price_max": 15,
    },
    {
        "venue_key": "laughing-skull",
        "day": 1,  # Tuesday
        "title": "Open Mic Comedy Night",
        "description": "Weekly comedy open mic at Laughing Skull Lounge, Atlanta's premier comedy club in Midtown. $15 cover.",
        "start_time": "20:00",
        "category": "comedy",
        "subcategory": "comedy.standup",
        "tags": ["open-mic", "comedy", "standup", "weekly"],
        "price_min": 15,
        "price_max": 15,
    },
    {
        "venue_key": "laughing-skull",
        "day": 2,  # Wednesday
        "title": "Open Mic Comedy Night",
        "description": "Weekly comedy open mic at Laughing Skull Lounge, Atlanta's premier comedy club in Midtown. $15 cover.",
        "start_time": "20:00",
        "category": "comedy",
        "subcategory": "comedy.standup",
        "tags": ["open-mic", "comedy", "standup", "weekly"],
        "price_min": 15,
        "price_max": 15,
    },
    {
        "venue_key": "limerick-junction",
        "day": 1,  # Tuesday
        "title": "Open Mic Night",
        "description": "Tuesday open mic at Limerick Junction in Virginia Highland.",
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "comedy", "music", "weekly"],
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
    {
        "venue_key": "farm-burger",
        "day": 2,  # Wednesday
        "title": "Open Mic Night",
        "description": "Wednesday open mic at Farm Burger Midtown.",
        "start_time": "19:00",
        "category": "community",
        "subcategory": None,
        "tags": ["open-mic", "comedy", "music", "weekly"],
    },
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
        "category": "community",
        "subcategory": None,
        "tags": ["trivia", "games", "weekly"],
    },
    {
        "venue_key": "pullman-yards",
        "day": 2,  # Wednesday
        "title": "Open Mic Night",
        "description": "Wednesday open mic at Pullman Yards in Kirkwood.",
        "start_time": "20:00",
        "category": "community",
        "subcategory": None,
        "tags": ["open-mic", "comedy", "music", "weekly"],
    },
    {
        "venue_key": "asw-whiskey",
        "day": 3,  # Thursday
        "title": "Open Mic Night",
        "description": "Thursday open mic at ASW Whiskey Exchange in West End.",
        "start_time": "18:00",
        "category": "community",
        "subcategory": None,
        "tags": ["open-mic", "comedy", "music", "weekly"],
    },
    {
        "venue_key": "atlantucky",
        "day": 3,  # Thursday
        "title": "Open Mic Night",
        "description": "Thursday open mic at Atlantucky Brewing.",
        "start_time": "18:30",
        "category": "community",
        "subcategory": None,
        "tags": ["open-mic", "comedy", "music", "weekly", "brewery"],
    },
    {
        "venue_key": "urban-grind",
        "day": 3,  # Thursday
        "title": "Open Mic Night",
        "description": "Thursday open mic at Urban Grind coffee shop.",
        "start_time": "19:00",
        "category": "community",
        "subcategory": None,
        "tags": ["open-mic", "poetry", "music", "weekly"],
    },
    {
        "venue_key": "kats-cafe",
        "day": 3,  # Thursday
        "title": "Open Mic Night",
        "description": "Thursday open mic at Kat's Cafe in Midtown.",
        "start_time": "19:00",
        "category": "community",
        "subcategory": None,
        "tags": ["open-mic", "poetry", "music", "weekly"],
    },
    {
        "venue_key": "battery-atlanta",
        "day": 3,  # Thursday
        "title": "Open Mic Night",
        "description": "Thursday open mic at The Battery Atlanta entertainment district.",
        "start_time": "19:00",
        "category": "community",
        "subcategory": None,
        "tags": ["open-mic", "comedy", "music", "weekly"],
    },
    # Joystick verified from Instagram: Wednesday gaming, Thursday karaoke (NOT open mic as badslava listed)
    {
        "venue_key": "joystick",
        "day": 2,  # Wednesday
        "title": "Press Start Gaming Night",
        "description": "Wednesday gaming night at Joystick Gamebar. Rotating video games each week including Rock Band, fighting games, and more. 7PM-11PM.",
        "start_time": "19:00",
        "category": "community",
        "subcategory": None,
        "tags": ["games", "video-games", "arcade", "weekly"],
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
        "category": "community",
        "subcategory": None,
        "tags": ["open-mic", "comedy", "music", "weekly"],
    },
    {
        "venue_key": "dynamic-el-dorado",
        "day": 4,  # Friday
        "title": "Late Night Open Mic",
        "description": "Friday late night open mic at Dynamic El Dorado.",
        "start_time": "23:00",
        "category": "nightlife",
        "subcategory": None,
        "tags": ["open-mic", "comedy", "music", "weekly", "late-night"],
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
        "category": "community",
        "subcategory": None,
        "tags": ["trivia", "games", "weekly"],
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
    {
        "venue_key": "churchill-grounds",
        "day": 3,  # Thursday
        "title": "Jazz Night",
        "description": "Weekly jazz night at Churchill Grounds, Midtown's intimate jazz cafe. Live performances in a cozy setting.",
        "start_time": "20:00",
        "category": "music",
        "subcategory": "music.jazz",
        "tags": ["jazz", "live-music", "weekly", "intimate", "date-night"],
    },
    {
        "venue_key": "churchill-grounds",
        "day": 5,  # Saturday
        "title": "Saturday Jazz Sessions",
        "description": "Saturday jazz sessions at Churchill Grounds in Midtown. Atlanta's longest-running jazz venue.",
        "start_time": "20:00",
        "category": "music",
        "subcategory": "music.jazz",
        "tags": ["jazz", "live-music", "weekly", "date-night"],
    },
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
        "category": "community",
        "subcategory": None,
        "tags": ["trivia", "games", "weekly", "craft-beer"],
    },
    {
        "venue_key": "the-porter",
        "day": 2,  # Wednesday
        "title": "Trivia Night",
        "description": "Wednesday trivia at The Porter Beer Bar in Little Five Points.",
        "start_time": "20:00",
        "category": "community",
        "subcategory": None,
        "tags": ["trivia", "games", "weekly", "craft-beer"],
    },
    {
        "venue_key": "wrecking-bar",
        "day": 2,  # Wednesday
        "title": "Trivia Night",
        "description": "Wednesday trivia at Wrecking Bar Brewpub in Little Five Points. House-brewed beers and pub trivia.",
        "start_time": "19:30",
        "category": "community",
        "subcategory": None,
        "tags": ["trivia", "games", "weekly", "brewery"],
    },
]


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a weekday (0=Monday, 6=Sunday)."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate recurring weekly events for all configured venues."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    logger.info(f"Generating recurring social events for next {WEEKS_AHEAD} weeks")
    logger.info(f"Processing {len(WEEKLY_EVENTS)} event templates across {len(VENUES)} venues")

    # Cache venue IDs
    venue_ids = {}

    for event_template in WEEKLY_EVENTS:
        venue_key = event_template["venue_key"]
        venue_data = VENUES.get(venue_key)

        if not venue_data:
            logger.warning(f"Unknown venue key: {venue_key}")
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
                event_template["title"],
                venue_name,
                start_date
            )

            if find_event_by_hash(content_hash):
                events_updated += 1
                continue

            # Support optional price fields in event templates
            price_min = event_template.get("price_min")
            price_max = event_template.get("price_max")
            is_free = price_min is None and price_max is None

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": event_template["title"],
                "description": event_template["description"],
                "start_date": start_date,
                "start_time": event_template["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": event_template["category"],
                "subcategory": event_template.get("subcategory"),
                "tags": event_template["tags"],
                "price_min": price_min,
                "price_max": price_max,
                "price_note": event_template.get("price_note"),
                "is_free": is_free,
                "source_url": venue_data.get("website", "https://badslava.com/"),
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{event_template['title']} at {venue_name} - {start_date}",
                "extraction_confidence": 0.90,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={DAY_CODES[event_template['day']]}",
                "content_hash": content_hash,
            }

            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            series_hint = {
                "series_type": "recurring_show",
                "series_title": event_template["title"],
                "frequency": "weekly",
                "day_of_week": day_names[event_template["day"]],
                "description": event_template["description"],
            }

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.debug(f"Added: {event_template['title']} at {venue_name} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert {event_template['title']} at {venue_name}: {e}")

    logger.info(
        f"Recurring social events crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
    )

    return events_found, events_new, events_updated
