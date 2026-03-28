"""
Destination-first crawler for Centennial Olympic Park.

Centennial Olympic Park is a 21-acre public park at 265 Park Ave W NW,
Downtown Atlanta, managed by the Georgia World Congress Center Authority.
It hosts occasional large events (concerts, festivals, NYE) but has no
persistent programmed calendar worth crawling at this time.

Returns (0, 0, 0) for events. The fully enriched venue record is the
deliverable, refreshed from the live homepage on every run.
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

HOMEPAGE = "https://www.gwcca.org/centennial-olympic-park"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    destination_details=True,
    venue_features=True,
)

PLACE_DATA = {
    "name": "Centennial Olympic Park",
    "slug": "centennial-olympic-park",
    "address": "265 Park Ave W NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7606,
    "lng": -84.3930,
    "place_type": "park",
    "spot_type": "park",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11 — park open daily 07:00-23:00
    "hours": {
        "monday": "07:00-23:00",
        "tuesday": "07:00-23:00",
        "wednesday": "07:00-23:00",
        "thursday": "07:00-23:00",
        "friday": "07:00-23:00",
        "saturday": "07:00-23:00",
        "sunday": "07:00-23:00",
    },
    "is_free": True,
    "vibes": [
        "tourist",
        "family-friendly",
        "downtown",
        "free",
        "landmark",
        "outdoor",
        "fountain",
    ],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()

    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "park",
            "commitment_tier": "halfday",
            "primary_activity": "family downtown park visit",
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["outdoor", "free-option", "family-daytrip"],
            "parking_type": "garage",
            "best_time_of_day": "morning",
            "practical_notes": (
                "Centennial works best as a short downtown family stop or cooling break, especially when paired "
                "with nearby attractions rather than treated like a full standalone park day. It is strongest as a "
                "free water-play and reset stop inside a larger downtown family plan."
            ),
            "accessibility_notes": (
                "The park's paved downtown layout makes it a lower-friction option for strollers and short walks "
                "than larger trail-style parks, which makes it easier to use for quick resets or toddler wandering without a long approach."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Open park access is free; major festivals and special events vary by calendar.",
            "source_url": HOMEPAGE,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "city": "atlanta",
                "landmark_type": "olympic_park",
            },
        },
    )

    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "fountain-rings-and-water-play",
            "title": "Fountain Rings and water play",
            "feature_type": "amenity",
            "description": "Centennial Olympic Park's Fountain of Rings makes it one of the clearest free city-core water-play stops for families between nearby downtown attractions.",
            "url": HOMEPAGE,
            "is_free": True,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "free-downtown-open-lawn-and-gather-space",
            "title": "Free downtown open lawn and gather space",
            "feature_type": "amenity",
            "description": "The park's lawn, seating, and central downtown location make it an easy free family stop to pair with museums, attractions, or a short city outing.",
            "url": HOMEPAGE,
            "is_free": True,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "flat-paved-downtown-stroller-loop",
            "title": "Flat paved downtown stroller loop",
            "feature_type": "experience",
            "description": "Centennial's flat, paved layout makes it one of the easier downtown parks for stroller loops, toddler wandering, and quick family resets between attractions.",
            "url": HOMEPAGE,
            "is_free": True,
            "sort_order": 30,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "free-water-play-downtown-reset",
            "title": "Free water-play downtown reset",
            "feature_type": "amenity",
            "description": "Centennial is one of the clearest downtown choices when families need free water play, easy stroller movement, and a short reset between ticketed attractions.",
            "url": HOMEPAGE,
            "is_free": True,
            "sort_order": 40,
        },
    )

    return envelope


def _extract_og_meta(html: str) -> tuple[Optional[str], Optional[str]]:
    """Return (og:image, og:description) from page HTML.

    Uses attrs= dict to avoid BeautifulSoup's name-parameter collision
    with the built-in ``name`` attribute lookup.
    """
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


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Centennial Olympic Park has a fully enriched venue record.

    No events are crawled at this time. The crawler's job is to upsert
    the venue and refresh image/description from the live homepage on
    each run.
    """
    place_data = dict(PLACE_DATA)

    # Fetch og: metadata from the live homepage to keep the record fresh.
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
        logger.warning("Centennial Olympic Park: og: enrichment failed: %s", exc)

    venue_id = get_or_create_place(place_data)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))
    try:
        get_client().table("venue_features").update({"is_active": False}).eq(
            "venue_id", venue_id
        ).eq("slug", "fountain-rings-and-open-lawn").execute()
    except Exception as exc:
        logger.warning(
            "Centennial Olympic Park: failed to retire legacy fountain feature: %s",
            exc,
        )

    # Push the freshest image/description back onto the existing venue row.
    update: dict = {}
    if place_data.get("image_url"):
        update["image_url"] = place_data["image_url"]
    if place_data.get("description"):
        update["description"] = place_data["description"]
    if update:
        try:
            get_client().table("places").update(update).eq("id", venue_id).execute()
        except Exception as exc:
            logger.warning(
                "Centennial Olympic Park: venue update failed: %s", exc
            )

    logger.info(
        "Centennial Olympic Park: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
