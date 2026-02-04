"""
Crawler for Monday Night Garage (mondaynightbrewing.com).
West End brewery taproom - venue-only crawler.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://mondaynightbrewing.com"

VENUE_DATA = {
    "name": "Monday Night Garage",
    "slug": "monday-night-garage",
    "address": "933 Lee St SW",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "lat": 33.7371,
    "lng": -84.4115,
    "venue_type": "brewery",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["craft-beer", "brewery", "taproom", "west-end", "patio"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Monday Night Garage exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Monday Night Garage venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Monday Night Garage venue: {e}")
        raise
