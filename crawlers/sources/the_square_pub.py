"""
Crawler for The Square Pub (thesquarepub.com).
Decatur neighborhood pub and sports bar.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.thesquarepub.com"

VENUE_DATA = {
    "name": "The Square Pub",
    "slug": "the-square-pub",
    "address": "1060 Hosea L Williams Dr NE",
    "neighborhood": "Decatur",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30317",
    "lat": 33.7654,
    "lng": -84.3210,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["neighborhood-bar", "sports-bar", "patio", "beer", "pub-grub"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure The Square Pub exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"The Square Pub venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create The Square Pub venue: {e}")
        raise
