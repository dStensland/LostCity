"""
Crawler for Max Lager's Wood-Fired Grill & Brewery (maxlagers.com).
Downtown brewpub and sports bar.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.maxlagers.com"

VENUE_DATA = {
    "name": "Max Lager's Wood-Fired Grill & Brewery",
    "slug": "max-lagers",
    "address": "320 Peachtree St NE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7589,
    "lng": -84.3877,
    "venue_type": "brewery",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["brewpub", "sports-bar", "downtown", "craft-beer"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Max Lager's exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Max Lager's venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Max Lager's venue: {e}")
        raise
