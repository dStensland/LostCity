"""
Crawler: Variety Playhouse — venue features
variety-playhouse.com

Produces:
  - venue_features: named spaces within the venue (main theater, patio, balcony)

No exhibition scraping needed — music venues don't have exhibitions.
Place data is kept in sync with variety_playhouse.py.

Source slug: variety-playhouse-features  (auto-discovered from filename)
Crawl frequency: monthly
"""

from __future__ import annotations

import logging

from db import get_or_create_place
from db.places import upsert_venue_feature
from entity_lanes import SourceEntityCapabilities

logger = logging.getLogger(__name__)

BASE_URL = "https://www.variety-playhouse.com"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    venue_features=True,
)

PLACE_DATA = {
    "name": "Variety Playhouse",
    "slug": "variety-playhouse",
    "address": "1099 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7635,
    "lng": -84.3509,
    "place_type": "music_venue",
    "website": BASE_URL,
}

# ---------------------------------------------------------------------------
# Venue features — hard-coded from published venue information.
# Variety Playhouse's room layout is stable and well-documented.
# ---------------------------------------------------------------------------

_FEATURES: list[dict] = [
    {
        "slug": "main-theater",
        "title": "Main Theater",
        "feature_type": "attraction",
        "description": (
            "Variety Playhouse's main theater is a converted 1940s movie house with "
            "1,100-capacity standing-room and fixed seating, widely regarded as one of "
            "Atlanta's best mid-size live music rooms for its warm acoustics and "
            "unobstructed sightlines from nearly every position on the floor."
        ),
        "admission_type": "ticketed",
        "source_url": BASE_URL,
        "sort_order": 10,
        "tags": [
            "concert-hall",
            "standing-room",
            "historic",
            "movie-theater-conversion",
            "little-five-points",
        ],
    },
    {
        "slug": "outdoor-patio",
        "title": "Outdoor Patio",
        "feature_type": "amenity",
        "description": (
            "Variety Playhouse's outdoor patio sits in the heart of Little Five Points "
            "and serves as a pre-show gathering space. Open before most events, it offers "
            "a casual outdoor setting to meet up before heading inside."
        ),
        "admission_type": "included",
        "source_url": BASE_URL,
        "sort_order": 20,
        "tags": ["patio", "outdoor", "pre-show", "little-five-points", "gathering-space"],
    },
    {
        "slug": "the-balcony",
        "title": "The Balcony",
        "feature_type": "amenity",
        "description": (
            "The Balcony at Variety Playhouse is an upper-level space with tables and "
            "seating for a more intimate concert experience, elevated above the general "
            "admission floor with clear views of the stage."
        ),
        "admission_type": "included",
        "source_url": BASE_URL,
        "sort_order": 30,
        "tags": ["balcony", "seating", "tables", "upper-level", "little-five-points"],
    },
]


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Upsert Variety Playhouse venue features.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    portal_id = source.get("portal_id")
    found = 0
    new = 0
    updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    logger.info("Variety Playhouse features: venue_id=%s", venue_id)

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
                "Variety Playhouse features: upserted '%s' (id=%s)", feature["title"], result
            )

    logger.info(
        "Variety Playhouse features crawl complete: %d found, %d new/updated", found, new
    )
    return found, new, updated
