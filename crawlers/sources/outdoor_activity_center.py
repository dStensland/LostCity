"""
Destination-first crawler for the Outdoor Activity Center.

The Outdoor Activity Center is operated by the West Atlanta Watershed Alliance
and serves as an outdoor environmental-learning and nature-play destination
inside a 26-acre preserve on Richland Road SW.

This source currently refreshes the venue record and shared destination
intelligence only. Event-level coverage is still handled by separate sources
that already surface public programs at the site.
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

OFFICIAL_URL = "https://www.wawa-online.org/outdoor-center"

PLACE_DATA = {
    "name": "Outdoor Activity Center",
    "slug": "outdoor-activity-center",
    "address": "1442 Richland Rd SW",
    "neighborhood": "Bush Mountain",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "lat": 33.7303,
    "lng": -84.4349,
    "venue_type": "park",
    "spot_type": "nature_center",
    "website": OFFICIAL_URL,
    "description": (
        "West Atlanta Watershed Alliance's Outdoor Activity Center is a 26-acre "
        "urban nature preserve with trails, environmental learning spaces, and "
        "family outdoor programming on Richland Road SW."
    ),
    "vibes": [
        "nature",
        "environmental-education",
        "family-friendly",
        "outdoor",
        "west-atlanta",
    ],
    "is_free": False,
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "nature_center",
            "commitment_tier": "halfday",
            "primary_activity": "family environmental learning visit",
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["outdoor", "family-daytrip", "learning"],
            "parking_type": "street",
            "best_time_of_day": "morning",
            "practical_notes": (
                "The Outdoor Activity Center works best as a planned family nature and environmental-learning stop, not as a quick neighborhood playground errand. It is strong for school-age kids, birthday gatherings, and community open-house style visits."
            ),
            "accessibility_notes": (
                "Families should expect a preserve-style outdoor setting with trail walking and activity-based movement rather than a low-friction indoor museum layout."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Open houses and some community programs are free; workshops, rentals, and special activities vary by program.",
            "source_url": OFFICIAL_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "park",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "urban-forest-trails-and-nature-play",
            "title": "Urban forest trails and nature play",
            "feature_type": "amenity",
            "description": "The center combines a 26-acre preserve, roughly two miles of trails, a ropes course, and a children's nature-play setting in one west-side outdoor campus.",
            "url": OFFICIAL_URL,
            "price_note": "Open houses and some community programs are free.",
            "is_free": True,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "outdoor-classroom-and-environmental-learning-campus",
            "title": "Outdoor classroom and environmental learning campus",
            "feature_type": "experience",
            "description": "Treehouse-style learning spaces, an aquarium, and outdoor environmental programs make the Outdoor Activity Center more than a simple park stop.",
            "url": OFFICIAL_URL,
            "price_note": "Workshops, rentals, and special activities vary by program.",
            "is_free": False,
            "sort_order": 20,
        },
    )
    return envelope


def _extract_og_meta(html: str) -> tuple[Optional[str], Optional[str]]:
    soup = BeautifulSoup(html, "lxml")

    og_image: Optional[str] = None
    tag = soup.find("meta", attrs={"property": "og:image"})
    if tag and tag.get("content"):
        og_image = str(tag["content"])

    og_desc: Optional[str] = None
    for attrs in ({"property": "og:description"}, {"name": "description"}):
        tag = soup.find("meta", attrs=attrs)
        if tag and tag.get("content"):
            og_desc = str(tag["content"])[:500]
            break

    return og_image, og_desc


def crawl(source: dict) -> tuple[int, int, int]:
    place_data = dict(PLACE_DATA)

    try:
        resp = requests.get(
            OFFICIAL_URL,
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
        logger.warning("Outdoor Activity Center: og enrichment failed: %s", exc)

    venue_id = get_or_create_place(place_data)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))

    update: dict = {
        "venue_type": "park",
        "spot_type": "nature_center",
    }
    if place_data.get("image_url"):
        update["image_url"] = place_data["image_url"]
    if place_data.get("description"):
        update["description"] = place_data["description"]
    try:
        get_client().table("venues").update(update).eq("id", venue_id).execute()
    except Exception as exc:
        logger.warning("Outdoor Activity Center: venue update failed: %s", exc)

    logger.info("Outdoor Activity Center: venue record enriched (destination-first, no events)")
    return 0, 0, 0
