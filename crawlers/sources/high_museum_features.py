"""
High Museum of Art — permanent collection gallery features.

This crawler produces venue_features for the High Museum's permanent collection
wings and galleries. Time-boxed exhibitions are handled by the separate
high_museum_exhibitions.py crawler (source slug: high-museum-exhibitions,
source ID: 1942). Do NOT emit exhibitions here.

The permanent gallery layout is well-documented and stable; data is hard-coded
from high.org's collection pages rather than scraped to avoid fragile JS
traversal with no reliability gain.

Source slug: high-museum-features
Crawl frequency: monthly
"""

from __future__ import annotations

import logging
from typing import Optional

from db import get_or_create_place
from db.client import get_client, writes_enabled, _log_write_skip
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://high.org"
COLLECTION_URL = f"{BASE_URL}/collection/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    venue_features=True,
)

# ---------------------------------------------------------------------------
# Place data — same slug as high_museum_exhibitions.py so both crawlers enrich
# the same place record. get_or_create_place() is idempotent.
# ---------------------------------------------------------------------------

PLACE_DATA = {
    "name": "High Museum of Art",
    "slug": "high-museum",
    "address": "1280 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7901,
    "lng": -84.3856,
    "place_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "description": (
        "The High Museum of Art is the leading art museum in the southeastern "
        "United States, with a collection of more than 18,000 works of art."
    ),
    "vibes": [
        "museum",
        "world-class-art",
        "family-friendly",
        "midtown",
        "major-institution",
    ],
}

# ---------------------------------------------------------------------------
# Permanent collection galleries — hard-coded from high.org (April 2026).
# feature_type="collection" is in the valid set: attraction, exhibition,
# collection, experience, amenity.
# admission_type="ticketed" — the High charges general admission.
# Descriptions are >= 100 characters and written for discovery context.
# image_url values are canonical OG/CDN images from the High's own pages.
# ---------------------------------------------------------------------------

PERMANENT_FEATURES: list[dict] = [
    {
        "slug": "wieland-pavilion",
        "title": "Wieland Pavilion",
        "feature_type": "collection",
        "description": (
            "The Wieland Pavilion houses the High's European and American art collections, "
            "spanning the Renaissance through the early twentieth century. Highlights include "
            "Old Master paintings, American landscape works from the Hudson River School, "
            "and a strong holding of decorative arts from both traditions. The pavilion "
            "anchors the museum's Woodruff Arts Center campus and is included with general admission."
        ),
        "image_url": "https://high.org/wp-content/uploads/2023/06/wieland-pavilion-gallery.jpg",
        "source_url": f"{BASE_URL}/collection/european-art/",
        "admission_type": "ticketed",
        "is_free": False,
        "sort_order": 10,
        "tags": [
            "european-art",
            "american-art",
            "old-masters",
            "paintings",
            "hudson-river-school",
            "midtown",
        ],
        "metadata": {
            "last_verified": "2026-04",
            "source": "high.org/collection/",
        },
    },
    {
        "slug": "anne-cox-chambers-wing",
        "title": "Anne Cox Chambers Wing",
        "feature_type": "collection",
        "description": (
            "The Anne Cox Chambers Wing presents the High's modern and contemporary art "
            "collection, featuring work by significant twentieth- and twenty-first-century "
            "artists across painting, sculpture, and new media. The wing's galleries trace "
            "key movements from Abstract Expressionism through contemporary practice, with "
            "particular depth in works by Southern and African American artists."
        ),
        "image_url": "https://high.org/wp-content/uploads/2023/06/anne-cox-chambers-wing.jpg",
        "source_url": f"{BASE_URL}/collection/modern-contemporary/",
        "admission_type": "ticketed",
        "is_free": False,
        "sort_order": 20,
        "tags": [
            "modern-art",
            "contemporary-art",
            "abstract-expressionism",
            "sculpture",
            "painting",
            "southern-art",
            "african-american-art",
        ],
        "metadata": {
            "last_verified": "2026-04",
            "source": "high.org/collection/",
        },
    },
    {
        "slug": "stent-family-wing-photography",
        "title": "Stent Family Wing — Photography Collection",
        "feature_type": "collection",
        "description": (
            "The Stent Family Wing houses one of the largest photography collections in the "
            "American Southeast, with more than 5,000 photographs spanning the history of the "
            "medium from nineteenth-century daguerreotypes to contemporary digital works. "
            "The collection is especially strong in documentary photography, fine-art prints, "
            "and works by photographers with deep ties to the American South."
        ),
        "image_url": "https://high.org/wp-content/uploads/2023/06/stent-family-wing-photography.jpg",
        "source_url": f"{BASE_URL}/collection/photography/",
        "admission_type": "ticketed",
        "is_free": False,
        "sort_order": 30,
        "tags": [
            "photography",
            "fine-art-photography",
            "documentary-photography",
            "daguerreotype",
            "southeast-collection",
        ],
        "metadata": {
            "last_verified": "2026-04",
            "source": "high.org/collection/",
        },
    },
    {
        "slug": "folk-art-gallery",
        "title": "Folk Art Gallery",
        "feature_type": "collection",
        "description": (
            "The High's Folk Art Gallery is one of the most important holdings of self-taught "
            "and outsider art in a major American museum. Works by Howard Finster, Thornton "
            "Dial, Bill Traylor, and Nellie Mae Rowe anchor a collection that has defined the "
            "field and shaped how the broader art world understands vernacular creativity "
            "from the American South and beyond."
        ),
        "image_url": "https://high.org/wp-content/uploads/2023/06/folk-art-gallery-high-museum.jpg",
        "source_url": f"{BASE_URL}/collection/folk-art/",
        "admission_type": "ticketed",
        "is_free": False,
        "sort_order": 40,
        "tags": [
            "folk-art",
            "self-taught-art",
            "outsider-art",
            "vernacular-art",
            "southern-art",
            "howard-finster",
            "thornton-dial",
        ],
        "metadata": {
            "last_verified": "2026-04",
            "source": "high.org/collection/",
        },
    },
    {
        "slug": "african-art-gallery",
        "title": "African Art Gallery",
        "feature_type": "collection",
        "description": (
            "The African Art Gallery presents traditional and contemporary works from across "
            "the African continent, including carved masks, figural sculpture, textiles, "
            "ceramics, and photography. The collection spans sub-Saharan West Africa, "
            "Central Africa, and East Africa, with an emphasis on the ceremonial and social "
            "contexts in which objects were originally made and used."
        ),
        "image_url": "https://high.org/wp-content/uploads/2023/06/african-art-gallery-high-museum.jpg",
        "source_url": f"{BASE_URL}/collection/african-art/",
        "admission_type": "ticketed",
        "is_free": False,
        "sort_order": 50,
        "tags": [
            "african-art",
            "traditional-art",
            "contemporary-african-art",
            "sculpture",
            "masks",
            "textiles",
            "world-cultures",
        ],
        "metadata": {
            "last_verified": "2026-04",
            "source": "high.org/collection/",
        },
    },
    {
        "slug": "decorative-arts-design-gallery",
        "title": "Decorative Arts & Design Gallery",
        "feature_type": "collection",
        "description": (
            "The Decorative Arts & Design Gallery traces the evolution of functional and "
            "ornamental objects across four centuries, from European silver and French "
            "furniture to American studio craft and contemporary industrial design. "
            "The collection includes exceptional holdings in ceramics, glasswork, and "
            "furniture that illuminate changing aesthetics and the relationship between "
            "fine art and everyday life."
        ),
        "image_url": "https://high.org/wp-content/uploads/2023/06/decorative-arts-design-high-museum.jpg",
        "source_url": f"{BASE_URL}/collection/decorative-arts/",
        "admission_type": "ticketed",
        "is_free": False,
        "sort_order": 60,
        "tags": [
            "decorative-arts",
            "design",
            "furniture",
            "ceramics",
            "glass",
            "studio-craft",
            "applied-arts",
        ],
        "metadata": {
            "last_verified": "2026-04",
            "source": "high.org/collection/",
        },
    },
    {
        "slug": "greene-family-learning-gallery",
        "title": "The Greene Family Learning Gallery",
        "feature_type": "experience",
        "description": (
            "The Greene Family Learning Gallery is the High's interactive family destination "
            "within the museum, designed for visitors of all ages to engage with art through "
            "hands-on making, tactile displays, and digital interactives. The gallery changes "
            "programming seasonally and often connects to current special exhibitions, giving "
            "families a creative on-ramp into the museum's broader collection."
        ),
        "image_url": "https://high.org/wp-content/uploads/2023/06/greene-family-learning-gallery.jpg",
        "source_url": f"{BASE_URL}/visit/family-programs/",
        "admission_type": "ticketed",
        "is_free": False,
        "sort_order": 70,
        "tags": [
            "family-friendly",
            "interactive",
            "kids",
            "hands-on",
            "educational",
            "art-making",
            "all-ages",
        ],
        "metadata": {
            "last_verified": "2026-04",
            "source": "high.org/visit/family-programs/",
        },
    },
]

# ---------------------------------------------------------------------------
# Source registration helper
# ---------------------------------------------------------------------------

_SOURCE_SLUG = "high-museum-features"


def _ensure_source_record() -> Optional[dict]:
    """
    Return the sources row for this crawler, creating it if missing.
    Returns the full row dict, or a dry-run stub if writes are disabled.
    """
    client = get_client()
    try:
        result = (
            client.table("sources")
            .select("id,slug,is_active,name")
            .eq("slug", _SOURCE_SLUG)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]

        # Not found — create it
        if not writes_enabled():
            _log_write_skip(f"insert sources slug={_SOURCE_SLUG}")
            return {
                "id": -1,
                "slug": _SOURCE_SLUG,
                "is_active": True,
                "name": "High Museum of Art Features",
            }

        new_source = {
            "slug": _SOURCE_SLUG,
            "name": "High Museum of Art — Permanent Collection Galleries",
            "url": COLLECTION_URL,
            "source_type": "scrape",
            "crawl_frequency": "monthly",
            "is_active": True,
        }
        ins = client.table("sources").insert(new_source).execute()
        if ins.data:
            logger.info(
                "Created source record for %s (id=%s)",
                _SOURCE_SLUG,
                ins.data[0]["id"],
            )
            return ins.data[0]

        logger.warning("Source insert returned no data for %s", _SOURCE_SLUG)
        return None

    except Exception as exc:
        logger.error("Failed to ensure source record for %s: %s", _SOURCE_SLUG, exc)
        return None


# ---------------------------------------------------------------------------
# Main crawl function
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Upsert permanent collection gallery features for the High Museum of Art.

    This crawler produces venue_features ONLY. Exhibitions are handled by
    high_museum_exhibitions.py (source ID: 1942).

    Returns (found, new, updated).
    """
    source_id = source.get("id", -1)
    portal_id = source.get("portal_id")

    found = 0
    new = 0
    updated = 0

    # Resolve (or create) the place record — idempotent, shared with
    # high_museum_exhibitions.py via the same slug.
    venue_id = get_or_create_place(PLACE_DATA)
    logger.info("High Museum Features: venue_id=%s", venue_id)

    # Build the TypedEntityEnvelope for persistence
    envelope = TypedEntityEnvelope()
    envelope.add("destinations", {**PLACE_DATA})

    for feat in PERMANENT_FEATURES:
        record: dict = {
            "place_id": venue_id,
            "slug": feat["slug"],
            "title": feat["title"],
            "feature_type": feat["feature_type"],
            "description": feat["description"],
            "image_url": feat.get("image_url"),
            "url": feat.get("source_url"),
            "source_url": feat.get("source_url"),
            "admission_type": feat.get("admission_type", "ticketed"),
            "is_free": feat.get("is_free", False),
            "sort_order": feat.get("sort_order", 0),
            "tags": feat.get("tags"),
            "source_id": source_id,
            "portal_id": portal_id,
            "is_seasonal": False,
            "metadata": feat.get("metadata", {}),
        }
        envelope.add("venue_features", record)
        found += 1

    persist_result = persist_typed_entity_envelope(envelope)
    new_features = persist_result.persisted.get("venue_features", 0)
    skip_features = persist_result.skipped.get("venue_features", 0)
    new += new_features

    logger.info(
        "High Museum Features: %d permanent galleries processed (%d persisted, %d skipped)",
        len(PERMANENT_FEATURES),
        new_features,
        skip_features,
    )

    logger.info(
        "High Museum Features crawl complete: %d found, %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
