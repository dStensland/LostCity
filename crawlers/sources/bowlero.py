"""
Destination-first crawler for Bowlero Atlanta.

Modern bowling entertainment center. No event calendar —
the enriched venue record is the deliverable.

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

HOMEPAGE = "https://www.bowlero.com/location/bowlero-atlanta"

PLACE_DATA = {
    "name": "Bowlero Atlanta",
    "slug": "bowlero-atlanta",
    "address": "1936 Piedmont Cir NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.8216,
    "lng": -84.3596,
    "venue_type": "entertainment",
    "spot_type": "entertainment",
    "website": HOMEPAGE,
    # Hours verified 2026-03-22 against bowlero.com
    "hours": {
        "monday": "16:00-23:00",
        "tuesday": "16:00-23:00",
        "wednesday": "16:00-23:00",
        "thursday": "16:00-23:00",
        "friday": "16:00-01:00",
        "saturday": "11:00-01:00",
        "sunday": "11:00-23:00",
    },
    "vibes": ["bowling", "nightlife", "groups", "date-night", "entertainment", "cosmic-bowling"],
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
        "commitment_tier": "hour",
        "primary_activity": "Bowling with cosmic/blacklight effects, arcade, and bar",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "rainy-day", "date-night"],
        "parking_type": "free_lot",
        "best_time_of_day": "evening",
        "practical_notes": (
            "Free parking. Walk-ins welcome but lane reservations recommended on weekends. "
            "Cosmic bowling (blacklight effects) runs during evening hours."
        ),
        "accessibility_notes": "ADA accessible with bumper rails available.",
        "family_suitability": "yes",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Per-game or hourly lane rental. Shoe rental included or available separately.",
        "source_url": HOMEPAGE,
        "metadata": {"source_type": "venue_enrichment", "venue_type": "entertainment", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "cosmic-bowling",
        "title": "Bowling with blacklight and cosmic effects",
        "feature_type": "experience",
        "description": (
            "Blacklight bowling with music, LED effects, and a party atmosphere "
            "during evening hours."
        ),
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "arcade-games",
        "title": "Arcade games",
        "feature_type": "experience",
        "description": "Arcade area with video games and prize redemption alongside the bowling lanes.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "full-bar-lane-side-food",
        "title": "Full bar and lane-side food service",
        "feature_type": "amenity",
        "description": (
            "Full bar and food menu with lane-side delivery so you don't miss your turn."
        ),
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 30,
    })
    envelope.add("venue_specials", {
        "venue_id": venue_id,
        "slug": "weekday-specials-cosmic",
        "title": "Weekday specials and cosmic bowling pricing",
        "description": "Discounted rates on weekdays and special pricing for cosmic bowling sessions.",
        "price_note": "Weekday and cosmic bowling pricing varies.",
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
    """Ensure Bowlero Atlanta has a fully enriched venue record.

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
        logger.warning("Bowlero Atlanta: og: enrichment failed: %s", exc)

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
            logger.warning("Bowlero Atlanta: venue update failed: %s", exc)

    logger.info(
        "Bowlero Atlanta: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
