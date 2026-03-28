"""
Destination-first crawler for Porsche Experience Center Atlanta.

The Porsche Experience Center is a permanent driving attraction at
1 Porsche Dr, Hapeville, adjacent to Atlanta Hartsfield-Jackson Airport.
It offers track experiences, autocross, and other driving programs by
reservation — no public event calendar.

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

HOMEPAGE = "https://www.porschedriving.com/atlanta"

PLACE_DATA = {
    "name": "Porsche Experience Center Atlanta",
    "slug": "porsche-experience-center-atlanta",
    "address": "1 Porsche Dr",
    "neighborhood": "Hapeville",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30354",
    "lat": 33.6420,
    "lng": -84.4040,
    "place_type": "attraction",
    "spot_type": "attraction",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11 — closed Sun/Mon
    "hours": {
        "monday": "closed",
        "tuesday": "09:00-17:00",
        "wednesday": "09:00-17:00",
        "thursday": "09:00-17:00",
        "friday": "09:00-17:00",
        "saturday": "09:00-17:00",
        "sunday": "closed",
    },
    "vibes": [
        "luxury",
        "driving-experience",
        "unique-experience",
        "corporate",
        "date-night",
        "interactive",
    ],
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)


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


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add("destination_details", {
        "place_id": venue_id,
        "destination_type": "driving_experience",
        "commitment_tier": "halfday",
        "primary_activity": "Porsche track driving experiences, heritage gallery, and fine dining",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["outdoor", "indoor-gallery", "rain-cancellation-possible"],
        "parking_type": "free_lot",
        "best_time_of_day": "morning",
        "practical_notes": (
            "Located near Hartsfield-Jackson Airport. Driving experiences require advance reservation — "
            "book well ahead for weekend slots. Heritage gallery and Restaurant 356 are open to visitors "
            "without a driving reservation. Minimum age requirements apply for driving and passenger experiences."
        ),
        "accessibility_notes": "Gallery and restaurant ADA accessible. Track experiences have physical requirements.",
        "family_suitability": "caution",
        "reservation_required": True,
        "permit_required": False,
        "fee_note": "Track experience packages start at several hundred dollars. Gallery and restaurant visits are free.",
        "source_url": HOMEPAGE,
        "metadata": {"source_type": "venue_enrichment", "place_type": "attraction", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "track-driving-experience",
        "title": "Track driving experience",
        "feature_type": "experience",
        "description": "Drive the latest Porsche models on a 1.6-mile track with professional coaching. Multiple experience levels from introductory to advanced.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "heritage-gallery",
        "title": "Heritage gallery and historic vehicles",
        "feature_type": "collection",
        "description": "Curated collection of historic Porsche vehicles tracing the brand's racing and engineering heritage.",
        "url": HOMEPAGE,
        "is_free": True,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "restaurant-356",
        "title": "Restaurant 356",
        "feature_type": "amenity",
        "description": "Fine dining restaurant on-site with views of the track. Open for lunch to all visitors, not just driving guests.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 30,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "simulator-lab-off-road",
        "title": "Simulator lab and off-road course",
        "feature_type": "experience",
        "description": "Racing simulators and a dedicated off-road course for Cayenne experiences, expanding beyond the main track.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 40,
    })
    envelope.add("venue_specials", {
        "place_id": venue_id,
        "slug": "track-experience-packages",
        "title": "Track experience packages",
        "description": "Multiple experience tiers from 90-minute introductory drives to full-day advanced programs.",
        "price_note": "Packages range from introductory to premium multi-hour experiences.",
        "is_free": False,
        "source_url": HOMEPAGE,
        "category": "admission",
    })
    return envelope


def crawl(source: dict) -> tuple[int, int, int]:
    """Ensure Porsche Experience Center Atlanta has a fully enriched venue record.

    No events are crawled — experiences are by reservation with no public
    calendar. The crawler upserts the venue and refreshes image/description
    from the live homepage on each run.
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
        logger.warning(
            "Porsche Experience Center Atlanta: og: enrichment failed: %s", exc
        )

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
                "Porsche Experience Center Atlanta: venue update failed: %s", exc
            )

    logger.info(
        "Porsche Experience Center Atlanta: venue record enriched "
        "(destination-first, no events)"
    )
    return 0, 0, 0
