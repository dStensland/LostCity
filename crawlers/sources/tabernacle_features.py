"""
Crawler: The Tabernacle — venue features
tabernacleatl.com

Produces:
  - venue_features: named spaces within the venue (main hall, downstairs room, balcony)

No exhibition scraping needed — music venues don't have exhibitions.
Place data is kept in sync with tabernacle.py.

Source slug: tabernacle-features  (auto-discovered from filename)
Crawl frequency: monthly
"""

from __future__ import annotations

import logging

from db import get_or_create_place
from db.places import upsert_venue_feature
from entity_lanes import SourceEntityCapabilities

logger = logging.getLogger(__name__)

BASE_URL = "https://www.tabernacleatl.com"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    venue_features=True,
)

PLACE_DATA = {
    "name": "The Tabernacle",
    "slug": "tabernacle",
    "address": "152 Luckie St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7589,
    "lng": -84.3914,
    "place_type": "music_venue",
    "website": BASE_URL,
}

# ---------------------------------------------------------------------------
# Venue features — hard-coded from published venue information.
# The Tabernacle's room layout is stable and well-documented.
# ---------------------------------------------------------------------------

_FEATURES: list[dict] = [
    {
        "slug": "main-concert-hall",
        "title": "Main Concert Hall",
        "feature_type": "attraction",
        "description": (
            "The Tabernacle's main concert hall occupies a converted 1911 Baptist church "
            "with 2,600-capacity standing-room floor, original stained glass windows, and "
            "soaring vaulted ceilings that give the room its cathedral-like atmosphere. "
            "One of Atlanta's premier large-venue concert experiences."
        ),
        "admission_type": "ticketed",
        "source_url": BASE_URL,
        "sort_order": 10,
        "tags": ["concert-hall", "standing-room", "historic", "church-conversion", "downtown"],
    },
    {
        "slug": "the-cotton-club",
        "title": "The Cotton Club",
        "feature_type": "attraction",
        "description": (
            "The Cotton Club is The Tabernacle's intimate downstairs room, hosting smaller "
            "shows, DJ sets, and private events for up to 450 guests. A more personal "
            "alternative to the main hall, with its own bar and stage."
        ),
        "admission_type": "ticketed",
        "source_url": BASE_URL,
        "sort_order": 20,
        "tags": ["intimate-room", "dj", "small-venue", "450-capacity", "downtown"],
    },
    {
        "slug": "balcony-level",
        "title": "Balcony Level",
        "feature_type": "amenity",
        "description": (
            "The Tabernacle's balcony level wraps the upper perimeter of the main concert "
            "hall, offering standing and seated areas with panoramic sightlines to the "
            "stage below. Included with standard show tickets."
        ),
        "admission_type": "included",
        "source_url": BASE_URL,
        "sort_order": 30,
        "tags": ["balcony", "panoramic-view", "upper-level", "seating", "downtown"],
    },
]


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Upsert The Tabernacle venue features.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    portal_id = source.get("portal_id")
    found = 0
    new = 0
    updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    logger.info("Tabernacle features: venue_id=%s", venue_id)

    for feature in _FEATURES:
        found += 1
        feat_data = {
            **feature,
            "source_id": source_id,
        }
        if portal_id:
            feat_data["portal_id"] = portal_id

        result = upsert_venue_feature(venue_id, feat_data)
        if result:
            new += 1
            logger.debug(
                "Tabernacle features: upserted '%s' (id=%s)", feature["title"], result
            )

    logger.info(
        "Tabernacle features crawl complete: %d found, %d new/updated", found, new
    )
    return found, new, updated
