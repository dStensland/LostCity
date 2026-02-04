"""
Crawler for Twain's Brewpub & Billiards (twainsbilliards.com).
Decatur brewpub with pool tables.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.twainsbilliards.com"

VENUE_DATA = {
    "name": "Twain's Brewpub & Billiards",
    "slug": "twains-brewpub",
    "address": "211 E Trinity Pl",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7748,
    "lng": -84.2935,
    "venue_type": "brewery",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["brewpub", "billiards", "craft-beer", "pool-tables", "pub-grub"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Twain's Brewpub exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Twain's Brewpub & Billiards venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Twain's Brewpub venue: {e}")
        raise
