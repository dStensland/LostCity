"""
Crawler for Havana Club (havanaclubatl.com).
Buckhead salsa dancing and latin nightclub.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.havanaclubatl.com"

VENUE_DATA = {
    "name": "Havana Club",
    "slug": "havana-club",
    "address": "3112 Piedmont Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8277,
    "lng": -84.3656,
    "venue_type": "nightclub",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["salsa", "latin", "dance-club", "live-music", "late-night"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Havana Club exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Havana Club venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Havana Club venue: {e}")
        raise
