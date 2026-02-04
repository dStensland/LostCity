"""
Crawler for Ormsby's (ormsbysatlanta.com).
West Midtown gastropub with bocce, darts, and games.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.ormsbysatlanta.com"

VENUE_DATA = {
    "name": "Ormsby's",
    "slug": "ormsbys",
    "address": "1170 Howell Mill Rd",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7844,
    "lng": -84.4073,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["gastropub", "bocce", "games", "craft-beer", "cocktails"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Ormsby's exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Ormsby's venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Ormsby's venue: {e}")
        raise
