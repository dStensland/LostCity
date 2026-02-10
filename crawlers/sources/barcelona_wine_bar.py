"""
Crawler for Barcelona Wine Bar (barcelonawinebar.com/inman-park).
Inman Park wine bar with events and tastings.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.barcelonawinebar.com/inman-park"

VENUE_DATA = {
    "name": "Barcelona Wine Bar",
    "slug": "barcelona-wine-bar",
    "address": "240 North Highland Ave NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7709,
    "lng": -84.3535,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["wine-bar", "tapas", "date-night", "patio", "spanish"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Barcelona Wine Bar exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Barcelona Wine Bar venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Barcelona Wine Bar venue: {e}")
        raise
