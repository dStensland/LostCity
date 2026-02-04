"""
Crawler for Ladybird Grove & Mess Hall (ladybirdatlanta.com).
Old Fourth Ward beer garden and event space.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.ladybirdatlanta.com"

VENUE_DATA = {
    "name": "Ladybird Grove & Mess Hall",
    "slug": "ladybird-grove",
    "address": "684 John Wesley Dobbs Ave NE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7580,
    "lng": -84.3712,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["beer-garden", "outdoor-seating", "food-trucks", "live-music", "event-space"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Ladybird Grove exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Ladybird Grove & Mess Hall venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Ladybird Grove venue: {e}")
        raise
