"""
Crawler for Scofflaw cocktail bar (1120 Howell Mill Rd NW, West Midtown).

This is distinct from Scofflaw Brewing Co (scofflaw_brewing.py) at
1738 MacArthur Blvd NW. The cocktail bar domain (scofflawatl.com)
returns NXDOMAIN. No website or events calendar found.
Registered as destination-only.
"""

from __future__ import annotations

import logging
from db import get_or_create_place

logger = logging.getLogger(__name__)

PLACE_DATA = {
    "name": "Scofflaw",
    "slug": "scofflaw-bar",
    "address": "1120 Howell Mill Rd NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7879,
    "lng": -84.4098,
    "place_type": "bar",
    "spot_type": "bar",
    "website": None,
    "vibes": ["craft-cocktails", "neighborhood-bar", "westside", "date-night"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Scofflaw cocktail bar exists as a venue (destination-only)."""
    try:
        venue_id = get_or_create_place(PLACE_DATA)
        logger.info(f"Scofflaw venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Scofflaw venue: {e}")
        raise
