"""
Crawler for Prohibition Atlanta (prohibitionatlanta.com).
Buckhead cocktail lounge and nightclub.

Website returns connection errors as of 2026-03-05.
Registered as destination-only until the site becomes reliably accessible.
"""

from __future__ import annotations

import logging

from db import get_or_create_place

logger = logging.getLogger(__name__)

BASE_URL = "https://prohibitionatlanta.com"

PLACE_DATA = {
    "name": "Prohibition",
    "slug": "prohibition-atlanta",
    "address": "3030 Peachtree Rd NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8371,
    "lng": -84.3811,
    "venue_type": "nightclub",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["cocktails", "nightclub", "late-night", "buckhead", "upscale"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Prohibition Atlanta exists as a venue."""
    try:
        venue_id = get_or_create_place(PLACE_DATA)
        logger.info(f"Prohibition Atlanta venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Prohibition Atlanta venue: {e}")
        raise
