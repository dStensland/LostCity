"""
Crawler for Elliott Street Deli & Pub (Downtown Atlanta dive bar).

All domain variations checked — elliottstreetdeli.com,
elliottstreetpub.com, and elliottstreetdeliandpub.com — all return
NXDOMAIN. No website or events calendar found.
Registered as destination-only.
"""

from __future__ import annotations

import logging
from db import get_or_create_place

logger = logging.getLogger(__name__)

PLACE_DATA = {
    "name": "Elliott Street Deli & Pub",
    "slug": "elliotts-on-ponce",
    "address": "51 Elliott St SW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7489,
    "lng": -84.3978,
    "place_type": "bar",
    "spot_type": "bar",
    "website": None,
    "vibes": ["dive-bar", "cheap-drinks", "neighborhood-bar", "late-night"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Elliott Street Deli & Pub exists as a venue (destination-only)."""
    try:
        venue_id = get_or_create_place(PLACE_DATA)
        logger.info(f"Elliott Street Deli & Pub venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Elliott Street Deli & Pub venue: {e}")
        raise
