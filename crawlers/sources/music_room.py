"""
Crawler for The Music Room (East Atlanta Village live music venue).

musicroomatl.com returns NXDOMAIN — the domain does not exist.
No events calendar was found at any known URL variation.
Registered as destination-only.

Note: Address provided (327 Edgewood Ave SE) places this in Old Fourth
Ward, not East Atlanta Village as described. Coordinates reflect the
Edgewood Ave address.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

VENUE_DATA = {
    "name": "The Music Room",
    "slug": "music-room-atl",
    "address": "327 Edgewood Ave SE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7554,
    "lng": -84.3738,
    "venue_type": "music_venue",
    "spot_type": "music_venue",
    "website": None,
    "vibes": ["live-music", "indie-rock", "punk", "hip-hop", "diy"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure The Music Room exists as a venue (destination-only)."""
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"The Music Room venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create The Music Room venue: {e}")
        raise
