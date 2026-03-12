"""
Crawler for Ticonderoga Club (ticonderogaclub.com).
Craft cocktail bar in Krog Street Market, Inman Park.

The venue does not publish a public events calendar — their website
(Squarespace) has no events collection. Special events and private
bookings surface via Instagram (@ticonderogaclub).

This crawler registers the destination and will return 0 events until
an events source is added. Future approach: monitor their Instagram
feed or check if they activate a Squarespace events page.
"""

from __future__ import annotations

import logging
from db import get_or_create_venue

logger = logging.getLogger(__name__)

BASE_URL = "https://www.ticonderogaclub.com"

VENUE_DATA = {
    "name": "Ticonderoga Club",
    "slug": "ticonderoga-club",
    "address": "99 Krog St NE Suite W",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    # Krog Street Market building — Suite W (west end)
    "lat": 33.7575,
    "lng": -84.3641,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "phone": "(404) 458-4534",
    "instagram": "ticonderogaclub",
    # Hours: Fri-Tue 5pm-10pm; closed Wed-Thu
    "hours": "Fri-Sat 5pm-10pm, Sun-Tue 5pm-10pm, Wed-Thu closed",
    "vibes": [
        "craft-cocktails",
        "upscale",
        "date-night",
        "krog-street-market",
        "intimate",
        "cocktail-bar",
        "inman-park",
    ],
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Ticonderoga Club exists as a destination in the venue database.

    No public events calendar is available. The venue does not publish
    scheduled events on their website. Venue record is the primary output.
    """
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info("Ticonderoga Club venue record ensured (ID: %s)", venue_id)
        return 0, 0, 0
    except Exception as e:
        logger.error("Failed to create Ticonderoga Club venue: %s", e)
        raise
