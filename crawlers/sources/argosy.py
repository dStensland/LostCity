"""
Crawler for Argosy (argosyeastatlanta.com).
East Atlanta Village cocktail bar with games - venue-only crawler.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://argosyeastatlanta.com"

VENUE_DATA = {
    "name": "Argosy",
    "slug": "argosy",
    "address": "470 Flat Shoals Ave SE",
    "neighborhood": "East Atlanta Village",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7419,
    "lng": -84.3422,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["cocktails", "games", "patio", "east-atlanta"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Argosy exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Argosy venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Argosy venue: {e}")
        raise
