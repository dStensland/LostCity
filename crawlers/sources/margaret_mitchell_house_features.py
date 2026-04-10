"""
Margaret Mitchell House — permanent venue features.

Margaret Mitchell House is a National Historic Landmark in Midtown Atlanta
where Margaret Mitchell wrote most of "Gone with the Wind." Operated by
Atlanta History Center, it is consistently listed among Atlanta's top literary
and cultural tourist destinations.

This crawler emits venue_features for the three principal attractions on-site.
There are no regularly-programmed seasonal events to scrape — special events
are handled by the main Atlanta History Center crawler. Monthly cadence is
sufficient to keep feature metadata fresh.

Source slug: margaret-mitchell-house-features
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

BASE_URL = "https://www.atlantahistorycenter.com/explore/margaret-mitchell-house/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    venue_features=True,
)

# ---------------------------------------------------------------------------
# Place data — resolves against any existing record by slug; idempotent.
# ---------------------------------------------------------------------------

PLACE_DATA = {
    "name": "Margaret Mitchell House",
    "slug": "margaret-mitchell-house",
    "address": "979 Crescent Ave NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7862,
    "lng": -84.3792,
    "place_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "hours": {
        "tuesday": "10:00-17:30",
        "wednesday": "10:00-17:30",
        "thursday": "10:00-17:30",
        "friday": "10:00-17:30",
        "saturday": "10:00-17:30",
        "sunday": "12:00-17:30",
    },
    "vibes": [
        "literary",
        "historic",
        "tourist-attraction",
        "educational",
        "midtown",
        "museum",
    ],
    "description": (
        "Margaret Mitchell House is the Tudor Revival apartment building in Midtown "
        "Atlanta where Mitchell wrote most of 'Gone with the Wind,' the Pulitzer "
        "Prize-winning novel and basis for the iconic 1939 film. Operated by Atlanta "
        "History Center, the restored site includes the original apartment, a "
        "dedicated film and novel museum, and period-appropriate gardens."
    ),
}

# ---------------------------------------------------------------------------
# Permanent venue features — researched from atlantahistorycenter.com/explore/
# margaret-mitchell-house/ (April 2026). Descriptions >= 100 chars.
# admission_type="ticketed" = requires admission purchase.
# admission_type="included" = covered by the base admission ticket.
# ---------------------------------------------------------------------------

PERMANENT_FEATURES: list[dict] = [
    {
        "slug": "the-apartment",
        "title": "The Apartment",
        "feature_type": "attraction",
        "description": (
            "Step inside the restored first-floor apartment where Margaret Mitchell wrote "
            "the majority of 'Gone with the Wind' during the 1920s and 1930s. Mitchell "
            "nicknamed the cramped but beloved space 'The Dump.' The apartment is "
            "furnished to reflect its 1919-era appearance, with period pieces and "
            "interpretive material that place visitors in the creative environment where "
            "one of the best-selling novels of all time took shape."
        ),
        "image_url": (
            "https://www.atlantahistorycenter.com/wp-content/uploads/2022/01/"
            "margaret-mitchell-apartment-the-dump.jpg"
        ),
        "source_url": BASE_URL,
        "admission_type": "ticketed",
        "is_free": False,
        "sort_order": 10,
        "tags": [
            "gone-with-the-wind",
            "margaret-mitchell",
            "historic-apartment",
            "literary-landmark",
            "restored",
            "midtown",
        ],
    },
    {
        "slug": "gone-with-the-wind-museum",
        "title": "Gone with the Wind Museum",
        "feature_type": "exhibition",
        "description": (
            "The Gone with the Wind Museum traces the full arc of Mitchell's "
            "Pulitzer Prize-winning novel and its transformation into the legendary "
            "1939 film. Exhibits feature original props, costumes, promotional "
            "materials, and rare memorabilia from the production, alongside context "
            "on the novel's cultural legacy and ongoing scholarly debate about its "
            "historical framing. The museum anchors the site's interpretive program "
            "and is a required stop for fans of the book and the film."
        ),
        "image_url": (
            "https://www.atlantahistorycenter.com/wp-content/uploads/2022/01/"
            "gone-with-the-wind-museum-exhibits.jpg"
        ),
        "source_url": BASE_URL,
        "admission_type": "ticketed",
        "is_free": False,
        "sort_order": 20,
        "tags": [
            "gone-with-the-wind",
            "film-history",
            "1939-film",
            "movie-props",
            "costumes",
            "literary-history",
            "museum",
            "midtown",
        ],
    },
    {
        "slug": "historic-gardens",
        "title": "Historic Gardens",
        "feature_type": "attraction",
        "description": (
            "The grounds surrounding Margaret Mitchell House feature period-appropriate "
            "gardens restored to reflect the early twentieth-century residential landscape "
            "of Crescent Avenue. The gardens provide a quiet outdoor counterpoint to the "
            "indoor exhibits and offer context for the Midtown neighborhood as it appeared "
            "during Mitchell's time living and writing at the property."
        ),
        "image_url": (
            "https://www.atlantahistorycenter.com/wp-content/uploads/2022/01/"
            "margaret-mitchell-house-gardens-grounds.jpg"
        ),
        "source_url": BASE_URL,
        "admission_type": "included",
        "is_free": False,
        "sort_order": 30,
        "tags": [
            "gardens",
            "historic-grounds",
            "outdoor",
            "period-landscape",
            "midtown",
            "margaret-mitchell",
        ],
    },
]

# ---------------------------------------------------------------------------
# Source self-registration
# ---------------------------------------------------------------------------

_SOURCE_SLUG = "margaret-mitchell-house-features"


def _ensure_source_record() -> Optional[dict]:
    """
    Return the sources row for this crawler, creating it if it does not exist.
    Returns the full row dict on success, or a minimal stub in dry-run mode.
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

        # Source not in DB yet — create it.
        if not writes_enabled():
            _log_write_skip(f"insert sources slug={_SOURCE_SLUG}")
            return {
                "id": -1,
                "slug": _SOURCE_SLUG,
                "is_active": True,
                "name": "Margaret Mitchell House Features",
            }

        new_source = {
            "slug": _SOURCE_SLUG,
            "name": "Margaret Mitchell House — Venue Features",
            "url": BASE_URL,
            "source_type": "scrape",
            "crawl_frequency": "monthly",
            "is_active": True,
        }
        ins = client.table("sources").insert(new_source).execute()
        if ins.data:
            logger.info(
                "Created source record for %s (id=%s)", _SOURCE_SLUG, ins.data[0]["id"]
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
    Upsert Margaret Mitchell House permanent venue features.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    portal_id = source.get("portal_id")

    found = 0
    new = 0
    updated = 0

    # Ensure source record exists (self-registers on first run)
    _ensure_source_record()

    # Resolve (or create) the place record
    venue_id = get_or_create_place(PLACE_DATA)
    logger.info("Margaret Mitchell House features: venue_id=%s", venue_id)

    # Build the typed entity envelope
    envelope = TypedEntityEnvelope()
    envelope.add("destinations", {**PLACE_DATA})

    for feat in PERMANENT_FEATURES:
        record = {
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
            "metadata": {
                "last_verified": "2026-04",
                "source": "atlantahistorycenter.com/explore/margaret-mitchell-house/",
            },
        }
        envelope.add("venue_features", record)
        found += 1

    persist_result = persist_typed_entity_envelope(envelope)
    new_features = persist_result.persisted.get("venue_features", 0)
    skip_features = persist_result.skipped.get("venue_features", 0)
    new += new_features

    logger.info(
        "Margaret Mitchell House features: %d features processed (%d persisted, %d skipped)",
        len(PERMANENT_FEATURES),
        new_features,
        skip_features,
    )
    logger.info(
        "Margaret Mitchell House features crawl complete: %d found, %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
