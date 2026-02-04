"""
Crawler for Dark Horse Tavern (darkhorsetavern.net).
Virginia-Highland neighborhood tavern.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.darkhorsetavern.net"

VENUE_DATA = {
    "name": "Dark Horse Tavern",
    "slug": "dark-horse-tavern",
    "address": "816 N Highland Ave NE",
    "neighborhood": "Virginia-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7778,
    "lng": -84.3537,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["neighborhood-bar", "sports-bar", "patio", "beer", "wings"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Dark Horse Tavern exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Dark Horse Tavern venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Dark Horse Tavern venue: {e}")
        raise
