"""
Crawler for The Glenwood (theglenwoodatl.com).
East Atlanta Village sports bar and live music venue.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.theglenwoodatl.com"

VENUE_DATA = {
    "name": "The Glenwood",
    "slug": "the-glenwood",
    "address": "1263 Glenwood Ave SE",
    "neighborhood": "East Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7393,
    "lng": -84.3391,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["sports-bar", "live-music", "dive-bar", "late-night", "patio"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure The Glenwood exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"The Glenwood venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create The Glenwood venue: {e}")
        raise
