"""
Destination-first crawler for Museum of Illusions Atlanta.

The museum is a permanent interactive attraction at 152 Luckie St NW,
Downtown Atlanta. It has no event calendar — the value is in the fully
enriched venue record itself.

Returns (0, 0, 0) because there are no events to crawl. The venue
record — including og:image and og:description fetched fresh from the
homepage on every run — is the deliverable.
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

HOMEPAGE = "https://museumofillusions.us/atlanta/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    destination_details=True,
    venue_features=True,
)

PLACE_DATA = {
    "name": "Museum of Illusions Atlanta",
    "slug": "museum-of-illusions-atlanta",
    "address": "152 Luckie St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7612,
    "lng": -84.3928,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11 against museumofillusions.us/atlanta/
    "hours": {
        "monday": "10:00-20:00",
        "tuesday": "10:00-20:00",
        "wednesday": "10:00-20:00",
        "thursday": "10:00-20:00",
        "friday": "10:00-21:00",
        "saturday": "10:00-21:00",
        "sunday": "10:00-20:00",
    },
    "vibes": [
        "interactive",
        "family-friendly",
        "immersive",
        "selfie-museum",
        "downtown",
        "date-night",
        "tourist",
    ],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "interactive_museum",
            "commitment_tier": "hour",
            "primary_activity": "family illusion museum visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip"],
            "parking_type": "garage",
            "best_time_of_day": "morning",
            "practical_notes": (
                "Museum of Illusions works best as a shorter downtown family stop or pairable indoor attraction rather than a full half-day anchor. "
                "It is best used when a family wants novelty and easy indoor time without committing to a long walking day."
            ),
            "accessibility_notes": (
                "Its indoor layout and shorter outing shape make it relatively easy for strollers and lower-energy family plans compared with walking-heavier attractions."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Admission pricing varies by date and ticket type.",
            "source_url": HOMEPAGE,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "museum",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "interactive-photo-illusion-galleries",
            "title": "Interactive photo-illusion galleries",
            "feature_type": "amenity",
            "description": "Museum of Illusions offers an indoor, interactive gallery format that works well for shorter family visits and novelty-driven play.",
            "url": HOMEPAGE,
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "short-downtown-family-reset-stop",
            "title": "Short downtown family reset stop",
            "feature_type": "amenity",
            "description": "Its shorter outing shape makes the museum a good downtown reset stop between bigger family anchors.",
            "url": HOMEPAGE,
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "predictable-short-stop-indoor-novelty",
            "title": "Predictable short-stop indoor novelty",
            "feature_type": "amenity",
            "description": "The museum works well when a family wants a clearly bounded indoor stop with less walking and easier pacing than a larger downtown attraction.",
            "url": HOMEPAGE,
            "is_free": False,
            "sort_order": 30,
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
    """Ensure Museum of Illusions Atlanta has a fully enriched venue record.

    No events are crawled — the attraction is always-open with no scheduled
    calendar. The crawler's sole job is to upsert the venue and refresh
    image/description from the live homepage on each run.
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
        logger.warning("Museum of Illusions Atlanta: og: enrichment failed: %s", exc)

    venue_id = get_or_create_place(place_data)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))

    # Push the freshest image/description back onto the existing venue row.
    update: dict = {}
    if place_data.get("image_url"):
        update["image_url"] = place_data["image_url"]
    if place_data.get("description"):
        update["description"] = place_data["description"]
    if update:
        try:
            get_client().table("venues").update(update).eq("id", venue_id).execute()
        except Exception as exc:
            logger.warning(
                "Museum of Illusions Atlanta: venue update failed: %s", exc
            )

    logger.info(
        "Museum of Illusions Atlanta: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
