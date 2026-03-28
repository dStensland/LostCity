"""
Crawler for Proof and Provision (proofandprovision.com).
Craft cocktail bar inside the Hotel Clermont building on Peachtree.

Website (proofandprovision.com) resolves via Cloudflare but returns no
accessible content — bot-detection blocks all HTTP clients. No events
calendar was found. Registered as destination-only.
"""

from __future__ import annotations

import logging
from db import get_or_create_place

logger = logging.getLogger(__name__)

BASE_URL = "https://www.proofandprovision.com"

PLACE_DATA = {
    "name": "Proof and Provision",
    "slug": "proof-and-provision",
    "address": "3060 Peachtree Rd NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8393,
    "lng": -84.3857,
    "place_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["craft-cocktails", "speakeasy", "date-night", "upscale", "hotel-bar"],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Proof and Provision exists as a venue (destination-only)."""
    try:
        venue_id = get_or_create_place(PLACE_DATA)
        logger.info(f"Proof and Provision venue record ensured (ID: {venue_id})")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Failed to create Proof and Provision venue: {e}")
        raise
