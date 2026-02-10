"""
Crawler for Two Urban Licks (twourbanlicks.com).
Inman Park restaurant with live music and wood-fired cuisine.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.twourbanlicks.com"

VENUE_DATA = {
    "name": "Two Urban Licks",
    "slug": "two-urban-licks",
    "address": "820 Ralph McGill Blvd NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7641,
    "lng": -84.3634,
    "venue_type": "restaurant",
    "spot_type": "restaurant",
    "website": BASE_URL,
    "vibes": ["live-music", "date-night", "upscale", "wood-fired", "patio"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Two Urban Licks exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Two Urban Licks venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Two Urban Licks venue: {e}")
        raise
