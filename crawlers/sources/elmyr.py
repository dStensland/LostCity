"""
Crawler for Elmyr (elmyratlanta.com).
Little Five Points restaurant and bar - venue-only crawler.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.elmyratlanta.com"

VENUE_DATA = {
    "name": "Elmyr",
    "slug": "elmyr",
    "address": "1091 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7633,
    "lng": -84.3447,
    "venue_type": "restaurant",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["cocktails", "small-plates", "date-night", "craft-cocktails"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Elmyr exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Elmyr venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Elmyr venue: {e}")
        raise
