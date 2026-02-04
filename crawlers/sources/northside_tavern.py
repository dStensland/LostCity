"""
Crawler for Northside Tavern (northsidetavern.com).
West Midtown iconic blues bar - venue-only crawler.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://northsidetavern.com"

VENUE_DATA = {
    "name": "Northside Tavern",
    "slug": "northside-tavern",
    "address": "1058 Howell Mill Rd NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7833,
    "lng": -84.4101,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["blues", "live-music", "dive-bar", "legendary", "west-midtown"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Northside Tavern exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Northside Tavern venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Northside Tavern venue: {e}")
        raise
