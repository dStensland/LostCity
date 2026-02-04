"""
Crawler for Bookhouse Pub (bookhousepub.com).
Poncey-Highland craft beer pub with board games.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.bookhousepub.com"

VENUE_DATA = {
    "name": "Bookhouse Pub",
    "slug": "bookhouse-pub",
    "address": "736 Ponce de Leon Ave NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7717,
    "lng": -84.3599,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["craft-beer", "board-games", "neighborhood-bar", "patio", "geek"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Bookhouse Pub exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Bookhouse Pub venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Bookhouse Pub venue: {e}")
        raise
