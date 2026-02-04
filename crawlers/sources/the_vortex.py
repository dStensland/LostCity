"""
Crawler for The Vortex Bar & Grill (thevortexatl.com).
Little Five Points legendary bar and restaurant - venue-only crawler.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.thevortexatl.com"

VENUE_DATA = {
    "name": "The Vortex Bar & Grill",
    "slug": "the-vortex",
    "address": "438 Moreland Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7637,
    "lng": -84.3499,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["burgers", "dive-bar", "late-night", "iconic", "18+"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure The Vortex exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"The Vortex Bar & Grill venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create The Vortex venue: {e}")
        raise
