"""
Destination-first crawler for Dave & Buster's Atlanta (Sugarloaf Mills).

Large entertainment chain with arcade, dining, and sports viewing.
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

HOMEPAGE = "https://www.daveandbusters.com/us/en/about/locations/sugarloaf-mills"

PLACE_DATA = {
    "name": "Dave & Buster's Lawrenceville",
    "slug": "dave-and-busters-lawrenceville",
    "address": "5900 Sugarloaf Pkwy",
    "neighborhood": "Lawrenceville",
    "city": "Lawrenceville",
    "state": "GA",
    "zip": "30043",
    "lat": 33.9617,
    "lng": -84.0709,
    "venue_type": "entertainment",
    "spot_type": "entertainment",
    "website": HOMEPAGE,
    # Hours verified 2026-03-22 against daveandbusters.com
    "hours": {
        "monday": "11:00-00:00",
        "tuesday": "11:00-00:00",
        "wednesday": "11:00-00:00",
        "thursday": "11:00-00:00",
        "friday": "11:00-01:00",
        "saturday": "11:00-01:00",
        "sunday": "11:00-00:00",
    },
    "vibes": ["arcade", "family-friendly", "sports-bar", "groups", "interactive"],
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
        "destination_type": "entertainment",
        "commitment_tier": "halfday",
        "primary_activity": "Arcade games, full-service restaurant, and sports viewing",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "rainy-day", "climate-controlled"],
        "parking_type": "free_lot",
        "best_time_of_day": "evening",
        "practical_notes": (
            "Large free parking lot at Sugarloaf Mills. Walk-ins welcome. "
            "Check the website for current promotions and value days. "
            "Eat & Play combos offer the best value."
        ),
        "accessibility_notes": "ADA accessible throughout.",
        "family_suitability": "yes",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Games are pay-per-play via Power Card. Restaurant and bar menu priced separately.",
        "source_url": HOMEPAGE,
        "metadata": {"source_type": "venue_enrichment", "venue_type": "entertainment", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "arcade-floor-interactive-games",
        "title": "Arcade floor with interactive games",
        "feature_type": "experience",
        "description": (
            "Hundreds of arcade games including racing, shooting, sports simulations, "
            "VR experiences, and prize redemption."
        ),
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "full-service-restaurant-sports-bar",
        "title": "Full-service restaurant and sports bar",
        "feature_type": "amenity",
        "description": (
            "Full restaurant menu plus a sports bar with wall-to-wall TVs for game day viewing."
        ),
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "vr-interactive-experiences",
        "title": "VR and interactive experiences",
        "feature_type": "experience",
        "description": (
            "Virtual reality games and cutting-edge interactive experiences "
            "beyond the traditional arcade."
        ),
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 30,
    })
    envelope.add("venue_specials", {
        "venue_id": venue_id,
        "slug": "value-day-promotions",
        "title": "Value day promotions",
        "description": "Rotating promotional days with discounted game play — check the website for the current schedule.",
        "price_note": "Promotional pricing varies by day.",
        "is_free": False,
        "source_url": HOMEPAGE,
        "category": "recurring_deal",
    })
    envelope.add("venue_specials", {
        "venue_id": venue_id,
        "slug": "eat-and-play-combos",
        "title": "Eat & Play combos",
        "description": (
            "Bundled meal and game credit packages that offer better value "
            "than purchasing separately."
        ),
        "price_note": "Combo pricing on food + game credits.",
        "is_free": False,
        "source_url": HOMEPAGE,
        "category": "daily_special",
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
    """Ensure Dave & Buster's Lawrenceville has a fully enriched venue record.

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
        logger.warning("Dave & Buster's Lawrenceville: og: enrichment failed: %s", exc)

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
            logger.warning("Dave & Buster's Lawrenceville: venue update failed: %s", exc)

    logger.info(
        "Dave & Buster's Lawrenceville: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
