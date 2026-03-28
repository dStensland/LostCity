"""
Destination-first crawler for Doll's Head Trail at Constitution Lakes Park.

An eerie folk art trail at 1305 S River Industrial Blvd SE in Southeast
Atlanta. No event calendar — the trail is a free, always-open destination.
The crawler upserts the venue and refreshes og:image / og:description from
the Atlanta Trails guide page on every run.

Returns (0, 0, 0) because there are no events to crawl.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_place
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

# Atlanta Trails has the best og:image and description for this destination.
HOMEPAGE = (
    "https://www.atlantatrails.com/hiking-trails/dolls-head-trail-constitution-lakes/"
)

PLACE_DATA = {
    "name": "Doll's Head Trail",
    "slug": "dolls-head-trail",
    "address": "1305 S River Industrial Blvd SE",
    "neighborhood": "Southeast Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30315",
    "lat": 33.6920,
    "lng": -84.3420,
    "venue_type": "park",
    "spot_type": "trail",
    "website": HOMEPAGE,
    # Open daily from dawn to dusk — no fixed closing time
    "hours": {
        "monday": "06:00-20:00",
        "tuesday": "06:00-20:00",
        "wednesday": "06:00-20:00",
        "thursday": "06:00-20:00",
        "friday": "06:00-20:00",
        "saturday": "06:00-20:00",
        "sunday": "06:00-20:00",
    },
    "vibes": [
        "quirky",
        "folk-art",
        "outdoor",
        "hiking",
        "weird-Atlanta",
        "free",
        "nature",
    ],
    "is_free": True,
    "description": (
        "An eerie folk art trail in Constitution Lakes Park where found objects "
        "— predominantly doll heads — have been fashioned into installations along "
        "a wetland trail. Visitors are encouraged to add their own creations."
    ),
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    destination_details=True,
    venue_features=True,
)


def _extract_og_meta(html: str) -> tuple[Optional[str], Optional[str]]:
    """Return (og:image, og:description) from page HTML."""
    soup = BeautifulSoup(html, "lxml")

    og_image: Optional[str] = None
    tag = soup.find("meta", attrs={"property": "og:image"})
    if tag and tag.get("content"):  # type: ignore[union-attr]
        og_image = str(tag["content"])  # type: ignore[index]

    og_desc: Optional[str] = None
    for attr_dict in ({"property": "og:description"}, {"name": "description"}):
        tag = soup.find("meta", attrs=attr_dict)
        if tag and tag.get("content"):  # type: ignore[union-attr]
            og_desc = str(tag["content"])[:500]  # type: ignore[index]
            break

    return og_image, og_desc


def _build_destination_envelope(venue_id: int, place_data: dict) -> TypedEntityEnvelope:
    """Project Doll's Head Trail into shared destination-intelligence lanes."""
    envelope = TypedEntityEnvelope()

    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "trail",
            "commitment_tier": "hour",
            "primary_activity": "self-guided folk-art trail walk",
            "best_seasons": ["spring", "fall", "winter"],
            "weather_fit_tags": ["outdoor", "dry-weather", "cool-weather"],
            "practical_notes": (
                "Always-open self-guided trail in Constitution Lakes Park. Best experienced in dry weather "
                "with walking shoes because portions of the wetland trail can stay soft after rain."
            ),
            "family_suitability": "caution",
            "dog_friendly": True,
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Free to visit.",
            "source_url": HOMEPAGE,
            "metadata": {
                "source_type": "destination_first_crawler",
                "vibes": place_data.get("vibes", []),
            },
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "found-object-folk-art-installations",
            "title": "Found-object folk art installations",
            "feature_type": "experience",
            "description": (
                "The trail is known for eerie found-object art installations built from discarded doll heads "
                "and other materials along the wooded wetland path."
            ),
            "url": HOMEPAGE,
            "is_free": True,
            "sort_order": 10,
        },
    )

    return envelope


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Doll's Head Trail has a fully enriched venue record.

    No events are crawled — the trail is a free, self-guided destination
    with no scheduled calendar. The crawler's sole job is to upsert the
    venue and refresh image/description from the Atlanta Trails guide page.
    """
    place_data = dict(PLACE_DATA)

    try:
        resp = requests.get(
            HOMEPAGE,
            timeout=20,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        resp.raise_for_status()
        og_image, og_desc = _extract_og_meta(resp.text)
        if og_image:
            place_data["image_url"] = og_image
        if og_desc:
            place_data["description"] = og_desc
    except Exception as exc:
        logger.warning("Doll's Head Trail: og: enrichment failed: %s", exc)

    venue_id = get_or_create_place(place_data)

    update: dict = {}
    if place_data.get("image_url"):
        update["image_url"] = place_data["image_url"]
    if place_data.get("description"):
        update["description"] = place_data["description"]
    if update:
        try:
            get_client().table("venues").update(update).eq("id", venue_id).execute()
        except Exception as exc:
            logger.warning("Doll's Head Trail: venue update failed: %s", exc)

    persist_result = persist_typed_entity_envelope(
        _build_destination_envelope(venue_id, place_data)
    )
    if persist_result.skipped:
        logger.warning(
            "Doll's Head Trail: skipped typed destination writes: %s",
            persist_result.skipped,
        )

    logger.info(
        "Doll's Head Trail: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
