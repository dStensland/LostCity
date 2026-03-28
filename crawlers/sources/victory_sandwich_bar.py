"""
Crawler for Victory Sandwich Bar (victorysandwichbar.com).
Inman Park sandwich shop and bar (also has Decatur location).
"""

from __future__ import annotations

import logging
from db import get_or_create_place

logger = logging.getLogger(__name__)

BASE_URL = "https://www.victorysandwichbar.com"

PLACE_DATA = {
    "name": "Victory Sandwich Bar",
    "slug": "victory-sandwich-bar",
    "address": "913 Bernina Ave NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7616,
    "lng": -84.3518,
    "place_type": "restaurant",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["sandwiches", "craft-beer", "late-night", "dive-bar", "patio"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Victory Sandwich Bar exists as a venue."""
    try:
        venue_id = get_or_create_place(PLACE_DATA)
        logger.info(f"Victory Sandwich Bar venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Victory Sandwich Bar venue: {e}")
        raise
