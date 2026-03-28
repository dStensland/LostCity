"""
Crawler for Church Bar (churchedgewood.com).
Edgewood Ave dive bar and dance club.
"""

from __future__ import annotations

import logging
from db import get_or_create_place

logger = logging.getLogger(__name__)

BASE_URL = "https://www.churchedgewood.com"

PLACE_DATA = {
    "name": "Church Bar",
    "slug": "church-bar",
    "address": "1165 Euclid Ave NE",
    "neighborhood": "Edgewood",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7628,
    "lng": -84.3454,
    "place_type": "nightclub",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["dive-bar", "dance-club", "late-night", "dj", "patio"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Church Bar exists as a venue."""
    try:
        venue_id = get_or_create_place(PLACE_DATA)
        logger.info(f"Church Bar venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Church Bar venue: {e}")
        raise
