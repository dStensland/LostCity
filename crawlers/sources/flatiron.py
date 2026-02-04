"""
Crawler for Flatiron (flatironatlanta.com).
East Atlanta Village restaurant and bar.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.flatironatlanta.com"

VENUE_DATA = {
    "name": "Flatiron",
    "slug": "flatiron",
    "address": "520 Flat Shoals Ave SE",
    "neighborhood": "East Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7429,
    "lng": -84.3440,
    "venue_type": "restaurant",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["cocktails", "brunch", "patio", "date-night"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Flatiron exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Flatiron venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Flatiron venue: {e}")
        raise
