"""
Crawler for Torched Hop Brewing (torchedhop.com).
Midtown brewpub on Ponce de Leon - venue-only crawler.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://torchedhop.com"

VENUE_DATA = {
    "name": "Torched Hop Brewing",
    "slug": "torched-hop",
    "address": "249 Ponce de Leon Ave NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7709,
    "lng": -84.3748,
    "venue_type": "brewery",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["craft-beer", "brewery", "gastropub", "midtown"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Torched Hop Brewing exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Torched Hop Brewing venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Torched Hop venue: {e}")
        raise
