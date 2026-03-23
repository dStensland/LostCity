"""
Destination-first crawler for Chattahoochee Food Works.

West Midtown food hall with 20+ vendors. No event calendar —
the enriched venue record is the deliverable.

Returns (0, 0, 0) because there are no events to crawl.
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

HOMEPAGE = "https://chattahoocheefoodworks.com/"

VENUE_DATA = {
    "name": "Chattahoochee Food Works",
    "slug": "chattahoochee-food-works",
    "address": "1235 Chattahoochee Ave NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7963,
    "lng": -84.4313,
    "venue_type": "food_hall",
    "spot_type": "food_hall",
    "website": HOMEPAGE,
    # Hours verified 2026-03-22 against chattahoocheefoodworks.com
    "hours": {
        "monday": "closed",
        "tuesday": "11:00-21:00",
        "wednesday": "11:00-21:00",
        "thursday": "11:00-21:00",
        "friday": "11:00-22:00",
        "saturday": "11:00-22:00",
        "sunday": "11:00-21:00",
    },
    "vibes": ["food-hall", "west-midtown", "family-friendly", "local-chefs", "outdoor-seating"],
    "description": (
        "Chattahoochee Food Works is a 25,000-square-foot food hall in West Midtown featuring "
        "over 20 vendor stalls from Atlanta's top chefs, plus a central bar and outdoor patio. "
        "One of Atlanta's newest and most diverse food hall experiences."
    ),
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add("destination_details", {
        "venue_id": venue_id,
        "destination_type": "food_hall",
        "commitment_tier": "hour",
        "primary_activity": "Multi-vendor food hall with 20+ local chef-driven stalls",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "outdoor-patio", "rainy-day"],
        "parking_type": "free_lot",
        "best_time_of_day": "any",
        "practical_notes": (
            "Free parking on-site. Closed Mondays. Over 20 vendors with cuisines from around "
            "the world — plan to browse before choosing. Outdoor patio seating weather-permitting. "
            "Located in the Chattahoochee corridor of West Midtown."
        ),
        "accessibility_notes": "ADA accessible ground floor. Wide aisles throughout.",
        "family_suitability": "yes",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Pay-as-you-go at individual vendor stalls. No entrance fee.",
        "source_url": HOMEPAGE,
        "metadata": {"source_type": "venue_enrichment", "venue_type": "food_hall", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "20-plus-vendor-stalls",
        "title": "20+ chef-driven vendor stalls",
        "feature_type": "amenity",
        "description": (
            "Over 20 vendor stalls featuring diverse cuisines from Atlanta's top chefs "
            "— from ramen to BBQ to pastries."
        ),
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "central-bar-patio",
        "title": "Central bar and outdoor patio",
        "feature_type": "amenity",
        "description": (
            "Full bar in the center of the food hall plus an expansive outdoor patio "
            "for dining al fresco."
        ),
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "west-midtown-walkability",
        "title": "West Midtown location and walkability",
        "feature_type": "experience",
        "description": (
            "Located in the growing Chattahoochee corridor of West Midtown, near breweries, "
            "galleries, and the Westside Trail."
        ),
        "url": HOMEPAGE,
        "is_free": True,
        "sort_order": 30,
    })
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
    """Ensure Chattahoochee Food Works has a fully enriched venue record.

    No events are crawled — the food hall has no event calendar. The
    crawler's sole job is to upsert the venue and refresh image/description
    from the live homepage on each run.
    """
    venue_data = dict(VENUE_DATA)

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
            venue_data["image_url"] = og_image
        if og_desc:
            venue_data["description"] = og_desc
    except Exception as exc:
        logger.warning("Chattahoochee Food Works: og: enrichment failed: %s", exc)

    venue_id = get_or_create_venue(venue_data)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))

    # Push the freshest image/description back onto the existing venue row.
    update: dict = {}
    if venue_data.get("image_url"):
        update["image_url"] = venue_data["image_url"]
    if venue_data.get("description"):
        update["description"] = venue_data["description"]
    if update:
        try:
            get_client().table("venues").update(update).eq("id", venue_id).execute()
        except Exception as exc:
            logger.warning("Chattahoochee Food Works: venue update failed: %s", exc)

    logger.info(
        "Chattahoochee Food Works: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
