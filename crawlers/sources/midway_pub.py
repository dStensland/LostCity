"""
Crawler for Midway Pub (midwaypub.com).
East Atlanta Village neighborhood pub - venue-only crawler.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://midwaypub.com"

VENUE_DATA = {
    "name": "Midway Pub",
    "slug": "midway-pub",
    "address": "552 Flat Shoals Ave SE",
    "neighborhood": "East Atlanta Village",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7415,
    "lng": -84.3419,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["neighborhood-bar", "dive-bar", "patio", "east-atlanta"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Midway Pub exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Midway Pub venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Midway Pub venue: {e}")
        raise
