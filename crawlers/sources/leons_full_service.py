"""
Crawler for Leon's Full Service (leonsfullservice.com).
Decatur gastropub with oysters and craft cocktails.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.leonsfullservice.com"

VENUE_DATA = {
    "name": "Leon's Full Service",
    "slug": "leons-full-service",
    "address": "131 E Ponce de Leon Ave",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7748,
    "lng": -84.2947,
    "venue_type": "restaurant",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["gastropub", "oysters", "craft-cocktails", "patio", "date-night"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Leon's Full Service exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Leon's Full Service venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Leon's Full Service venue: {e}")
        raise
