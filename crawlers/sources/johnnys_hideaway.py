"""
Crawler for Johnny's Hideaway (johnnyshideaway.com).
Buckhead legendary late-night dance bar since 1975 - venue-only crawler.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://johnnyshideaway.com"

VENUE_DATA = {
    "name": "Johnny's Hideaway",
    "slug": "johnnys-hideaway",
    "address": "3771 Roswell Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30342",
    "lat": 33.8476,
    "lng": -84.3762,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["dancing", "late-night", "legendary", "classic", "buckhead"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Johnny's Hideaway exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Johnny's Hideaway venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Johnny's Hideaway venue: {e}")
        raise
