"""
Crawler for Moontower (Edgewood Ave bar).
Old Fourth Ward bar on Edgewood Ave.

No accessible website found as of 2026-03-05.
Registered as destination-only.
"""

from __future__ import annotations

import logging

from db import get_or_create_venue

logger = logging.getLogger(__name__)

VENUE_DATA = {
    "name": "Moontower",
    "slug": "moontower-atlanta",
    "address": "488 Edgewood Ave SE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7541,
    "lng": -84.3699,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": None,
    "vibes": ["dive-bar", "edgewood", "late-night", "old-fourth-ward"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Moontower exists as a venue."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Moontower venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Moontower venue: {e}")
        raise
