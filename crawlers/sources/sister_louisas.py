"""
Crawler for Sister Louisa's Church of the Living Room & Ping Pong Emporium.
Edgewood Ave iconic dive bar with ping pong and art.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.churchbar.net"

VENUE_DATA = {
    "name": "Sister Louisa's Church of the Living Room & Ping Pong Emporium",
    "slug": "sister-louisas",
    "address": "466 Edgewood Ave SE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7549,
    "lng": -84.3670,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["dive-bar", "iconic", "art", "ping-pong", "late-night", "lgbtq-friendly"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Sister Louisa's exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Sister Louisa's venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Sister Louisa's venue: {e}")
        raise
