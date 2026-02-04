"""
Crawler for Wild Heaven Beer (wildheavenbeer.com).
Decatur brewery taproom - venue-only crawler.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://wildheavenbeer.com"

VENUE_DATA = {
    "name": "Wild Heaven Beer",
    "slug": "wild-heaven-beer",
    "address": "135B Clairemont Ave",
    "neighborhood": "Decatur",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7745,
    "lng": -84.2963,
    "venue_type": "brewery",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["craft-beer", "brewery", "taproom", "decatur", "patio"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Wild Heaven Beer exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Wild Heaven Beer venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Wild Heaven venue: {e}")
        raise
