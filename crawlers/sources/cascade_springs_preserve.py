"""
Destination-first crawler for Cascade Springs Nature Preserve.

135 acres of old-growth forest at 2852 Cascade Rd SW in Southwest Atlanta,
featuring a waterfall, Civil War trenches, and ruins of 19th-century mineral
spring bathhouses. No event calendar — the preserve is a free, always-open
public land. The crawler upserts the venue and refreshes og:image /
og:description from the Atlanta Trails guide page on every run.

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

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    destination_details=True,
    venue_features=True,
)

HOMEPAGE = (
    "https://www.atlantatrails.com/hiking-trails/cascade-springs-nature-preserve/"
)

PLACE_DATA = {
    "name": "Cascade Springs Nature Preserve",
    "slug": "cascade-springs-nature-preserve",
    "address": "2852 Cascade Rd SW",
    "neighborhood": "Southwest Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30311",
    "lat": 33.7190,
    "lng": -84.4520,
    "place_type": "park",
    "spot_type": "trail",
    "website": HOMEPAGE,
    # Open daily from dawn to dusk
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
        "hiking",
        "waterfall",
        "nature",
        "free",
        "Civil-War-history",
        "hidden-gem",
        "outdoor",
    ],
    "is_free": True,
    "description": (
        "135 acres of old-growth forest with a waterfall, Civil War trenches, and "
        "ruins of 19th-century mineral spring bathhouses — all less than 10 miles "
        "from downtown Atlanta."
    ),
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "nature_preserve",
            "commitment_tier": "halfday",
            "primary_activity": "family nature preserve walk",
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["outdoor", "free-option", "family-daytrip"],
            "parking_type": "free_lot",
            "best_time_of_day": "morning",
            "practical_notes": (
                "Cascade Springs works best for families who want a free Southwest Atlanta nature reset with real trails and historical interest, not a playground-style park day."
            ),
            "accessibility_notes": (
                "Trail terrain and the preserve setting make this a better fit for families comfortable with uneven outdoor walking than for stroller-forward outings."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Open preserve access is free.",
            "source_url": HOMEPAGE,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": "park",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "waterfall-and-forest-trails",
            "title": "Waterfall and forest trails",
            "feature_type": "amenity",
            "description": "Cascade Springs gives families a rare in-city forest preserve with waterfall views, wooded trails, and a much more immersive nature feel than a neighborhood park.",
            "url": HOMEPAGE,
            "price_note": "Open preserve access is free.",
            "is_free": True,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "free-southwest-atlanta-nature-reset",
            "title": "Free Southwest Atlanta nature reset",
            "feature_type": "experience",
            "description": "This is one of the stronger free nature-reset options inside the city for families who want trails and history instead of a built playground outing.",
            "url": HOMEPAGE,
            "price_note": "Open preserve access is free.",
            "is_free": True,
            "sort_order": 20,
        },
    )
    return envelope


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


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Cascade Springs Nature Preserve has a fully enriched venue record.

    No events are crawled — the preserve is a free, self-guided public land
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
        logger.warning("Cascade Springs Nature Preserve: og: enrichment failed: %s", exc)

    venue_id = get_or_create_place(place_data)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))

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
                "Cascade Springs Nature Preserve: venue update failed: %s", exc
            )

    logger.info(
        "Cascade Springs Nature Preserve: venue record enriched "
        "(destination-first, no events)"
    )
    return 0, 0, 0
