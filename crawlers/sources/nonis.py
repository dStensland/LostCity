"""
Crawler for Noni's Bar & Deli (nonisbar.com).
Edgewood Ave dive bar and deli.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.nonisbar.com"

VENUE_DATA = {
    "name": "Noni's Bar & Deli",
    "slug": "nonis",
    "address": "357 Edgewood Ave SE",
    "neighborhood": "Edgewood",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7543,
    "lng": -84.3715,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["dive-bar", "deli", "late-night", "patio", "beer"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Noni's exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Noni's Bar & Deli venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Noni's venue: {e}")
        raise
