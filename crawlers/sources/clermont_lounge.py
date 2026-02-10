"""
Crawler for Clermont Lounge (clermontlounge.net).
Iconic Poncey-Highland dive bar and underground nightlife institution.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.clermontlounge.net"

VENUE_DATA = {
    "name": "Clermont Lounge",
    "slug": "clermont-lounge",
    "address": "789 Ponce de Leon Ave NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7720,
    "lng": -84.3626,
    "venue_type": "nightclub",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["dive-bar", "late-night", "iconic", "underground", "lgbtq-friendly"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Clermont Lounge exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Clermont Lounge venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Clermont Lounge venue: {e}")
        raise
