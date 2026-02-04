"""
Crawler for Wrecking Bar Brewpub (wreckingbarbrewpub.com).
Inman Park brewpub in historic home - venue-only crawler.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://wreckingbarbrewpub.com"

VENUE_DATA = {
    "name": "Wrecking Bar Brewpub",
    "slug": "wrecking-bar-brewpub",
    "address": "292 Moreland Ave NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7608,
    "lng": -84.3537,
    "venue_type": "brewery",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["craft-beer", "brewery", "gastropub", "historic", "inman-park"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Wrecking Bar Brewpub exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Wrecking Bar Brewpub venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Wrecking Bar venue: {e}")
        raise
