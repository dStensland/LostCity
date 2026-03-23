"""
Destination-first crawler for Exchange Recreation Center.

DeKalb County's Exchange Recreation Center is a public recreation campus with
multi-use fields, tennis courts, playground, lake, trails, multipurpose rooms,
and a large gymnasium.

This source refreshes the venue record and shared destination intelligence only.
"""

from __future__ import annotations

import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_venue
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    destination_details=True,
    venue_features=True,
)

OFFICIAL_URL = "https://www.dekalbcountyga.gov/parks/exchange-recreation"

VENUE_DATA = {
    "name": "Exchange Recreation Center",
    "slug": "exchange-recreation-center",
    "address": "2771 Columbia Drive",
    "neighborhood": "Panthersville",
    "city": "Decatur",
    "state": "GA",
    "zip": "30034",
    "lat": 33.7074,
    "lng": -84.2538,
    "venue_type": "recreation",
    "spot_type": "community_center",
    "website": OFFICIAL_URL,
    "description": (
        "DeKalb County's Exchange Recreation Center is a public family recreation campus with multi-use fields, tennis courts, a playground, lake, trails, multipurpose rooms, and a large gymnasium."
    ),
    "vibes": [
        "family-friendly",
        "community-recreation",
        "outdoor-play",
        "sports",
        "dekalb-county",
    ],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "community_recreation_center",
            "commitment_tier": "halfday",
            "primary_activity": "family recreation campus visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor-option", "outdoor", "family-daytrip"],
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "practical_notes": (
                "Exchange works best as a flexible family rec-campus option with enough outdoor and indoor pieces to support a longer half-day plan rather than a quick in-and-out stop."
            ),
            "accessibility_notes": (
                "The mix of gym, multipurpose rooms, playground, lake, and trails gives families multiple pacing options, but the full site still works more like a spread-out recreation campus than a compact indoor stop."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Facility access, classes, and reservations vary by DeKalb Parks program and season.",
            "source_url": OFFICIAL_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "recreation",
                "city": "decatur",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "playground-trails-and-lake-loop",
            "title": "Playground, trails, and lake loop",
            "feature_type": "amenity",
            "description": "Exchange combines a playground, lake, trails, tennis courts, and open fields into one county recreation campus for families.",
            "url": OFFICIAL_URL,
            "price_note": "Outdoor campus access is generally free; classes and reservations vary.",
            "is_free": True,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "large-gym-and-multipurpose-rec-center",
            "title": "Large gym and multipurpose rec center",
            "feature_type": "experience",
            "description": "A large gymnasium and multipurpose rooms make Exchange one of the better weather-flex family recreation campuses in this part of DeKalb.",
            "url": OFFICIAL_URL,
            "price_note": "Programs, classes, and building access vary by schedule.",
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
    venue_data = dict(VENUE_DATA)

    try:
        resp = requests.get(
            OFFICIAL_URL,
            timeout=20,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        resp.raise_for_status()
        og_image, og_desc = _extract_og_meta(resp.text)
        if og_image:
            venue_data["image_url"] = og_image
        if og_desc:
            venue_data["description"] = og_desc
    except Exception as exc:
        logger.warning("Exchange Recreation Center: og enrichment failed: %s", exc)

    venue_id = get_or_create_venue(venue_data)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))

    update: dict = {
        "venue_type": "recreation",
        "spot_type": "community_center",
    }
    if venue_data.get("image_url"):
        update["image_url"] = venue_data["image_url"]
    if venue_data.get("description"):
        update["description"] = venue_data["description"]
    try:
        get_client().table("venues").update(update).eq("id", venue_id).execute()
    except Exception as exc:
        logger.warning("Exchange Recreation Center: venue update failed: %s", exc)

    logger.info("Exchange Recreation Center: venue record enriched (destination-first, no events)")
    return 0, 0, 0
