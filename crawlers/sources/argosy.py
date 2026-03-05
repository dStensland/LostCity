"""
Crawler for Argosy (argosyatl.com).
East Atlanta Village bar and restaurant with craft cocktails, patio, and games.

Website returns connection errors as of 2026-03-05.
Registered as destination-only.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.argosyatl.com"

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
    "vibes": ["cocktails", "craft-cocktails", "games", "patio", "east-atlanta", "bar-restaurant"],
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
