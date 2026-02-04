"""
Crawler for Moe's and Joe's (moesandjoes.com).
Virginia-Highland sports bar and tavern.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.moesandjoes.com"

VENUE_DATA = {
    "name": "Moe's and Joe's",
    "slug": "moes-and-joes",
    "address": "1033 N Highland Ave NE",
    "neighborhood": "Virginia-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7814,
    "lng": -84.3537,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["sports-bar", "neighborhood-bar", "beer", "burgers", "patio"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Moe's and Joe's exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Moe's and Joe's venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Moe's and Joe's venue: {e}")
        raise
