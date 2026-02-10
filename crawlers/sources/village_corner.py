"""
Crawler for Village Corner (villagecorneratl.com).
Virginia-Highland neighborhood tavern and German beer hall.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.villagecorneratl.com"

VENUE_DATA = {
    "name": "Village Corner German Restaurant",
    "slug": "village-corner",
    "address": "1177 Virginia Ave NE",
    "neighborhood": "Virginia-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7749,
    "lng": -84.3513,
    "venue_type": "restaurant",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["german", "beer-hall", "neighborhood-bar", "outdoor-seating"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Village Corner exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Village Corner venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Village Corner venue: {e}")
        raise
