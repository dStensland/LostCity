"""
Destination-first crawler for SkyView Atlanta.

SkyView is a Ferris wheel attraction at 168 Luckie St NW, Downtown Atlanta.
It has no event calendar — the value is in the fully enriched venue record.

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

HOMEPAGE = "https://skyviewatlanta.com/"

PLACE_DATA = {
    "name": "SkyView Atlanta",
    "slug": "skyview-atlanta",
    "address": "168 Luckie St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7601,
    "lng": -84.3926,
    "place_type": "attraction",
    "spot_type": "attraction",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11 against skyviewatlanta.com
    "hours": {
        "monday": "12:00-21:00",
        "tuesday": "12:00-21:00",
        "wednesday": "12:00-21:00",
        "thursday": "12:00-21:00",
        "friday": "12:00-22:00",
        "saturday": "10:00-22:00",
        "sunday": "10:00-21:00",
    },
    "vibes": [
        "tourist",
        "family-friendly",
        "downtown",
        "date-night",
        "views",
        "landmark",
    ],
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
        "destination_type": "attraction",
        "commitment_tier": "hour",
        "primary_activity": "Ferris wheel ride with downtown Atlanta skyline views",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["outdoor", "climate-controlled-gondola"],
        "parking_type": "paid_lot",
        "best_time_of_day": "evening",
        "practical_notes": (
            "Best experienced at sunset or after dark for skyline views and city lights. "
            "Downtown parking garages nearby. Adjacent to Centennial Olympic Park. "
            "The ride itself takes about 15 minutes — plan an hour total with waiting and photos."
        ),
        "accessibility_notes": "Wheelchair-accessible gondolas available. ADA accessible.",
        "family_suitability": "yes",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Standard and VIP gondola tickets available. Online purchase saves vs. walk-up.",
        "source_url": HOMEPAGE,
        "metadata": {"source_type": "venue_enrichment", "place_type": "attraction", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "200-foot-ferris-wheel",
        "title": "200-foot Ferris wheel with climate-controlled gondolas",
        "feature_type": "attraction",
        "description": "A 20-story observation wheel with fully enclosed, climate-controlled gondolas offering 360-degree views of downtown Atlanta.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "vip-gondola-experience",
        "title": "VIP gondola with glass floor",
        "feature_type": "experience",
        "description": "Upgraded VIP gondola with transparent glass floor, leather seating, and a longer ride time.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "centennial-park-skyline-views",
        "title": "Centennial Park and downtown skyline panorama",
        "feature_type": "experience",
        "description": "Panoramic views of Centennial Olympic Park, the Georgia Aquarium, CNN Center, and the Atlanta skyline from the top.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 30,
    })
    envelope.add("venue_specials", {
        "place_id": venue_id,
        "slug": "vip-gondola-upgrade",
        "title": "VIP gondola upgrade",
        "description": "Premium upgrade with glass floor, longer ride, and leather seating for a more exclusive experience.",
        "price_note": "VIP pricing available at ticket counter or online.",
        "is_free": False,
        "source_url": HOMEPAGE,
        "category": "admission",
    })
    envelope.add("venue_specials", {
        "place_id": venue_id,
        "slug": "online-ticket-discount",
        "title": "Online ticket discount",
        "description": "Save by purchasing tickets online in advance vs. walk-up pricing at the ticket window.",
        "price_note": "Online tickets discounted vs. walk-up price.",
        "is_free": False,
        "source_url": HOMEPAGE,
        "category": "admission",
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
    """Ensure SkyView Atlanta has a fully enriched venue record.

    No events are crawled — the attraction is open daily with no scheduled
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
        logger.warning("SkyView Atlanta: og: enrichment failed: %s", exc)

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
            logger.warning("SkyView Atlanta: venue update failed: %s", exc)

    logger.info(
        "SkyView Atlanta: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
