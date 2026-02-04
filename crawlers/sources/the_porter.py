"""
Crawler for The Porter Beer Bar (theporterbeerbar.com).
Little Five Points craft beer bar with 125+ taps - venue-only crawler.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://theporterbeerbar.com"

VENUE_DATA = {
    "name": "The Porter Beer Bar",
    "slug": "the-porter-beer-bar",
    "address": "1156 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7636,
    "lng": -84.3485,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["craft-beer", "beer-bar", "late-night", "little-five-points"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure The Porter Beer Bar exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"The Porter Beer Bar venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create The Porter venue: {e}")
        raise
