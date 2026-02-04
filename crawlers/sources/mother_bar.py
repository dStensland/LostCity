"""
Crawler for Mother Bar (motheredgewood.com).
Edgewood Ave dive bar with outdoor patio.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.motheredgewood.com"

VENUE_DATA = {
    "name": "Mother Bar",
    "slug": "mother-bar",
    "address": "427 Edgewood Ave SE",
    "neighborhood": "Edgewood",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7547,
    "lng": -84.3687,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["dive-bar", "patio", "late-night", "punk", "outdoor-seating"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Mother Bar exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Mother Bar venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Mother Bar venue: {e}")
        raise
