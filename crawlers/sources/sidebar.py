"""
Crawler for Sidebar (sidebaratlanta.com).
Downtown cocktail bar and restaurant.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.sidebaratlanta.com"

VENUE_DATA = {
    "name": "Sidebar",
    "slug": "sidebar",
    "address": "79 Poplar St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7555,
    "lng": -84.3936,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["craft-cocktails", "downtown", "happy-hour", "date-night"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Sidebar exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Sidebar venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Sidebar venue: {e}")
        raise
