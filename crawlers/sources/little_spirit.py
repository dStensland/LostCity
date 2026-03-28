"""
Crawler for Little Spirit (littlespiritbar.com).
Whiskey and cocktail bar on Georgia Ave SE in Summerhill.

The domain (littlespiritbar.com) does not resolve — DNS lookup fails as of
2026-03-05. No events calendar can be scraped.

This crawler registers the destination so the venue appears in the Summerhill
neighborhood feed and any future Atlanta bar/nightlife queries. It will return
0 events until one of the following is resolved:

  - The website comes back online and exposes an events page
  - An Instagram-based crawler is wired up (@littlespiritbar)
  - Events surface via a ticketing platform (Eventbrite, Tock, etc.)

Future approach: check if littlespiritbar.com activates a Squarespace or
similar events collection, or monitor their Instagram for ticketed events.
"""

from __future__ import annotations

import logging

from db import get_or_create_place

logger = logging.getLogger(__name__)

BASE_URL = "https://www.littlespiritbar.com"

PLACE_DATA = {
    "name": "Little Spirit",
    "slug": "little-spirit",
    "address": "375 Georgia Ave SE",
    "neighborhood": "Summerhill",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    # Georgia Ave SE commercial strip, Summerhill
    "lat": 33.7367,
    "lng": -84.3748,
    "place_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "instagram": "littlespiritbar",
    "vibes": [
        "whiskey-bar",
        "craft-cocktails",
        "cozy",
        "neighborhood-bar",
        "bar-food",
        "summerhill",
        "date-night",
    ],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Little Spirit exists as a destination in the venue database.

    The venue's website is currently unreachable (DNS failure). No events
    calendar is available to scrape. Venue record is the primary output.
    """
    try:
        venue_id = get_or_create_place(PLACE_DATA)
        logger.info("Little Spirit venue record ensured (ID: %s)", venue_id)
        return 0, 0, 0
    except Exception as e:
        logger.error("Failed to create Little Spirit venue: %s", e)
        raise
