"""
Crawler for SweetWater Brewing Company (sweetwaterbrew.com).
West Midtown brewery with taproom, tours, and events.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.sweetwaterbrew.com"

VENUE_DATA = {
    "name": "SweetWater Brewing Company",
    "slug": "sweetwater-brewing",
    "address": "195 Ottley Dr NE",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.7856,
    "lng": -84.3964,
    "venue_type": "brewery",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["brewery", "taproom", "outdoor-seating", "tours", "live-music"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure SweetWater Brewing Company exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"SweetWater Brewing Company venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create SweetWater Brewing venue: {e}")
        raise
