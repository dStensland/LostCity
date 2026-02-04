"""
Crawler for Der Biergarten (derbiergarten.com).
Downtown German beer hall and restaurant.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.derbiergarten.com"

VENUE_DATA = {
    "name": "Der Biergarten",
    "slug": "der-biergarten",
    "address": "300 Marietta St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7579,
    "lng": -84.3950,
    "venue_type": "restaurant",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["beer-garden", "german", "outdoor-seating", "beer-hall"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Der Biergarten exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Der Biergarten venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Der Biergarten venue: {e}")
        raise
