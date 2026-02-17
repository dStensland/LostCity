"""
Crawler for Millennium Gate Museum (thegatemuseum.org).

Atlanta's classical architecture and history museum in Atlantic Station area.
Website exhibitions page doesn't maintain current exhibition listings with dates.
This crawler ensures the venue exists in our database as an important cultural destination.
"""

from __future__ import annotations

import logging

from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.thegatemuseum.org"

VENUE_DATA = {
    "name": "Millennium Gate",
    "slug": "millennium-gate",
    "address": "395 Central Ave NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7896,
    "lng": -84.3938,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "vibes": ["museum", "history", "architecture", "art", "classical"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Ensure Millennium Gate Museum venue exists in database.

    The museum's website doesn't maintain a structured events/exhibitions calendar
    with parseable dates. Exhibition listings are primarily historical/past exhibitions.
    This crawler ensures the venue is represented as an important cultural destination.
    """
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Millennium Gate Museum venue verified (ID: {venue_id})")

        # Return (0, 0, 0) - no events crawled, but venue exists
        return 0, 0, 0

    except Exception as e:
        logger.error(f"Failed to verify Millennium Gate Museum venue: {e}")
        raise
