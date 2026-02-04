"""
Crawler for Manuel's Tavern (manuelstavern.com).
Poncey-Highland legendary neighborhood bar since 1956 - venue-only crawler.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://manuelstavern.com"

VENUE_DATA = {
    "name": "Manuel's Tavern",
    "slug": "manuels-tavern",
    "address": "602 N Highland Ave NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7693,
    "lng": -84.3521,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["neighborhood-bar", "historic", "legendary", "poncey-highland", "political"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Manuel's Tavern exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Manuel's Tavern venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Manuel's Tavern venue: {e}")
        raise
