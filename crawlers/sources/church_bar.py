"""
Crawler for Church Bar (churchedgewood.com).
Edgewood Ave dive bar and dance club.
"""

from __future__ import annotations

import logging
from db import get_or_create_place

logger = logging.getLogger(__name__)

BASE_URL = "https://www.churchedgewood.com"

PLACE_DATA = {
    "name": "Church Bar",
    "slug": "church-bar",
    "address": "1165 Euclid Ave NE",
    "neighborhood": "Edgewood",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7628,
    "lng": -84.3454,
    "place_type": "nightclub",
    "spot_type": "bar",
    "website": BASE_URL,
    "description": (
        "Church Bar is an Atlanta nightclub with a classic dive feel, late-night dance-floor energy, "
        "patio hangout space, and a DJ-driven Edgewood nightlife crowd."
    ),
    "image_url": "https://lh3.googleusercontent.com/place-photos/AL8-SNEiS_e91LI9dv0NqEnKYMoyLyyYpKVc7F0sdrvjdxVGEPInc7MkLBd_a34aoMis4Fm7046gaOZdvmKU776c5LDQYlWaVZRdI--FY_O_DFFJQW_SBQyo36_P00ZoZ0pfMP9_FLtfOpgymytKIQ=s4800-w800",
    "hours": {
        "monday": {"open": "10:00", "close": "16:00"},
        "tuesday": {"open": "10:00", "close": "16:00"},
        "wednesday": {"open": "10:00", "close": "16:00"},
        "thursday": {"open": "10:00", "close": "16:00"},
        "sunday": {"open": "09:30", "close": "12:30"},
    },
    "vibes": ["dive-bar", "dance-club", "late-night", "dj", "patio"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Church Bar exists as a venue."""
    try:
        venue_id = get_or_create_place(PLACE_DATA)
        logger.info(f"Church Bar venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Church Bar venue: {e}")
        raise
