"""
Destination-first crawler for Main Event Atlanta.

Entertainment center with bowling, laser tag, arcade, and dining.
No event calendar — the enriched venue record is the deliverable.

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

HOMEPAGE = "https://www.mainevent.com/locations/georgia/atlanta"

PLACE_DATA = {
    "name": "Main Event Atlanta",
    "slug": "main-event-atlanta",
    "address": "3101 Cobb Pkwy SE Suite 104",
    "neighborhood": "Cumberland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "lat": 33.8792481,
    "lng": -84.4561691,
    "place_type": "restaurant",
    "spot_type": "entertainment",
    "website": HOMEPAGE,
    # Hours verified 2026-03-22 against mainevent.com
    "hours": {
        "monday": "11:00-00:00",
        "tuesday": "11:00-00:00",
        "wednesday": "11:00-00:00",
        "thursday": "11:00-00:00",
        "friday": "11:00-01:00",
        "saturday": "10:00-01:00",
        "sunday": "10:00-00:00",
    },
    "vibes": ["bowling", "laser-tag", "arcade", "family-friendly", "groups", "entertainment"],
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
        "place_id": venue_id,
        "destination_type": "entertainment",
        "commitment_tier": "halfday",
        "primary_activity": "Bowling, laser tag, arcade, and family dining",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "rainy-day", "climate-controlled"],
        "parking_type": "free_lot",
        "best_time_of_day": "evening",
        "practical_notes": (
            "Free parking. Walk-ins welcome. "
            "All-you-can-play packages are the best value for families. "
            "Indoor climate-controlled throughout."
        ),
        "accessibility_notes": "ADA accessible throughout.",
        "family_suitability": "yes",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Pay-per-activity or all-you-can-play packages. Full restaurant and bar on-site.",
        "source_url": HOMEPAGE,
        "metadata": {"source_type": "venue_enrichment", "place_type": "entertainment", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "bowling-cosmic-bowling",
        "title": "Bowling with cosmic bowling option",
        "feature_type": "experience",
        "description": "Multiple bowling lanes with standard and cosmic (blacklight) bowling options.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "laser-tag-arena",
        "title": "Laser tag arena",
        "feature_type": "experience",
        "description": "Multi-level laser tag arena with team-based and free-for-all game modes.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "arcade-and-prizes",
        "title": "Arcade games and prizes",
        "feature_type": "experience",
        "description": "Large arcade floor with video games, redemption games, and a prize center.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 30,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "full-restaurant-bar",
        "title": "Full restaurant and bar",
        "feature_type": "amenity",
        "description": (
            "Full-service restaurant with a bar, serving a menu of American favorites "
            "and shareable plates."
        ),
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 40,
    })
    envelope.add("venue_specials", {
        "place_id": venue_id,
        "slug": "all-you-can-play-packages",
        "title": "All-you-can-play packages",
        "description": (
            "Unlimited access to bowling, laser tag, and arcade for a flat rate "
            "— the best value for families."
        ),
        "price_note": "Flat-rate unlimited play packages available.",
        "is_free": False,
        "source_url": HOMEPAGE,
        "category": "recurring_deal",
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
    """Ensure Main Event Atlanta has a fully enriched venue record.

    No events are crawled — the venue is open daily with no separate event
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
        logger.warning("Main Event Atlanta: og: enrichment failed: %s", exc)

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
            get_client().table("places").update(update).eq("id", venue_id).execute()
        except Exception as exc:
            logger.warning("Main Event Atlanta: venue update failed: %s", exc)

    logger.info(
        "Main Event Atlanta: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
