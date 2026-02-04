#!/usr/bin/env python3
"""
Import escape room venues in the Atlanta metro area.

~10 venues: Paranoia Quest, Escape the Room, Big Escape Rooms, The Escape Game,
Breakout Games, 60 Out, All In Adventures, etc.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_escape_rooms.py
"""

import logging
from db import get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

ESCAPE_ROOMS = [
    {
        "name": "Paranoia Quest Escape Room",
        "slug": "paranoia-quest",
        "address": "1039 Grant St SE Suite B10",
        "neighborhood": "Grant Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30315",
        "lat": 33.7345,
        "lng": -84.3719,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": "https://www.paranoiaquest.com",
        "vibes": ["escape-room", "games", "group-activity", "date-night"],
    },
    {
        "name": "Escape the Room Atlanta",
        "slug": "escape-the-room-atlanta",
        "address": "3255 Peachtree Rd NE Suite 23",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "lat": 33.8466,
        "lng": -84.3621,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": "https://escapetheroom.com/atlanta",
        "vibes": ["escape-room", "games", "group-activity", "date-night"],
    },
    {
        "name": "Big Escape Rooms",
        "slug": "big-escape-rooms",
        "address": "5920 Roswell Rd Suite A209",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9313,
        "lng": -84.3536,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": "https://www.bigescaperooms.com",
        "vibes": ["escape-room", "games", "group-activity"],
    },
    {
        "name": "The Escape Game Atlanta",
        "slug": "the-escape-game-atlanta",
        "address": "5046 Peachtree Blvd Suite 810",
        "neighborhood": "Peachtree Corners",
        "city": "Peachtree Corners",
        "state": "GA",
        "zip": "30092",
        "lat": 33.9671,
        "lng": -84.2426,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": "https://theescapegame.com",
        "vibes": ["escape-room", "games", "group-activity", "family-friendly"],
    },
    {
        "name": "Breakout Games Atlanta",
        "slug": "breakout-games-atlanta",
        "address": "2839 Paces Ferry Rd SE Suite 450",
        "neighborhood": "Vinings",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30339",
        "lat": 33.8707,
        "lng": -84.4687,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": "https://breakoutgames.com/atlanta",
        "vibes": ["escape-room", "games", "group-activity", "family-friendly"],
    },
    {
        "name": "60 Out Escape Rooms Atlanta",
        "slug": "60out-atlanta",
        "address": "725 Ponce De Leon Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7741,
        "lng": -84.3584,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": "https://www.60out.com",
        "vibes": ["escape-room", "games", "group-activity", "date-night"],
    },
    {
        "name": "All In Adventures Atlanta",
        "slug": "all-in-adventures-atlanta",
        "address": "3500 Peachtree Rd NE Suite R1",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30326",
        "lat": 33.8502,
        "lng": -84.3620,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": "https://www.allinadventures.com",
        "vibes": ["escape-room", "games", "group-activity", "family-friendly"],
    },
    {
        "name": "Beat the Room Atlanta",
        "slug": "beat-the-room-atlanta",
        "address": "195 Arizona Ave NE Suite 1",
        "neighborhood": "Inman Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7618,
        "lng": -84.3526,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": "https://www.beattheroom.com",
        "vibes": ["escape-room", "games", "group-activity"],
    },
    {
        "name": "Escape Room Atlanta",
        "slug": "escape-room-atlanta-tucker",
        "address": "2291 Main St",
        "neighborhood": "Tucker",
        "city": "Tucker",
        "state": "GA",
        "zip": "30084",
        "lat": 33.8548,
        "lng": -84.2171,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": "https://www.escaperoomatlanta.com",
        "vibes": ["escape-room", "games", "group-activity"],
    },
    {
        "name": "Quest Quest Escape Room",
        "slug": "quest-quest-escape-room",
        "address": "3101 Clairmont Rd Suite C",
        "neighborhood": "Brookhaven",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30329",
        "lat": 33.8191,
        "lng": -84.3329,
        "venue_type": "entertainment_venue",
        "spot_type": "entertainment",
        "website": "https://www.questquestatl.com",
        "vibes": ["escape-room", "games", "group-activity"],
    },
]


def main():
    """Import escape room venues to database."""
    added = 0
    skipped = 0

    logger.info("=" * 60)
    logger.info("Importing Atlanta Escape Room Venues")
    logger.info("=" * 60)
    logger.info(f"Processing {len(ESCAPE_ROOMS)} venues...")
    logger.info("")

    for venue in ESCAPE_ROOMS:
        existing = get_venue_by_slug(venue["slug"])
        if existing:
            logger.info(f"  SKIP: {venue['name']} (already exists)")
            skipped += 1
            continue

        try:
            venue_id = get_or_create_venue(venue)
            logger.info(f"  ADD:  {venue['name']} -> ID {venue_id}")
            added += 1
        except Exception as e:
            logger.error(f"  ERROR: {venue['name']}: {e}")

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Done! Added {added} venues, skipped {skipped} existing.")
    logger.info(f"Total: {len(ESCAPE_ROOMS)} escape rooms")


if __name__ == "__main__":
    main()
