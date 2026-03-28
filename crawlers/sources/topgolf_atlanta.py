"""
Destination-first crawler for Topgolf Atlanta Midtown.

Topgolf is a tech-driven golf entertainment venue at 1600 Ellsworth
Industrial Blvd NW, West Midtown Atlanta. Walk-ins welcome; no persistent
event calendar. The enriched venue record is the deliverable.

Returns (0, 0, 0) because there are no discrete events to crawl.
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

HOMEPAGE = "https://topgolf.com/us/atlanta/"

PLACE_DATA = {
    "name": "Topgolf Atlanta Midtown",
    "slug": "topgolf-atlanta-midtown",
    "address": "1600 Ellsworth Industrial Blvd NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7920,
    "lng": -84.4310,
    "venue_type": "entertainment",
    "spot_type": "entertainment",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11 against topgolf.com/us/atlanta/
    "hours": {
        "monday": "10:00-23:00",
        "tuesday": "10:00-23:00",
        "wednesday": "10:00-23:00",
        "thursday": "10:00-23:00",
        "friday": "10:00-00:00",
        "saturday": "10:00-00:00",
        "sunday": "10:00-23:00",
    },
    "vibes": [
        "groups",
        "corporate",
        "date-night",
        "family-friendly",
        "sports",
        "interactive",
    ],
    "_destination_details": {
        "commitment_tier": "halfday",
        "parking_type": "free_lot",
        "best_time_of_day": "evening",
        "family_suitability": "yes",
        "practical_notes": "Free parking. Climate-controlled hitting bays on 3 levels — playable in any weather. Walk-ins welcome; bays can be reserved online. Weekend evenings are busiest.",
        "primary_activity": "Tech-driven golf entertainment with food, drinks, and games",
        "destination_type": "entertainment",
    },
    "_venue_features": [
        {
            "title": "Climate-controlled hitting bays on 3 levels",
            "feature_type": "experience",
            "description": "Three levels of hitting bays with climate control — heated in winter, cooled in summer. Each bay has comfortable seating and a TV.",
            "is_free": False,
            "sort_order": 10,
        },
        {
            "title": "Interactive point-scoring golf games",
            "feature_type": "experience",
            "description": "Microchipped balls and targets make golf social and competitive — no skill required. Multiple game modes for all levels.",
            "is_free": False,
            "sort_order": 20,
        },
        {
            "title": "Full bar and food menu at every bay",
            "feature_type": "amenity",
            "description": "Full food and drink service delivered directly to your bay — no need to leave your spot.",
            "is_free": False,
            "sort_order": 30,
        },
        {
            "title": "Rooftop terrace",
            "feature_type": "amenity",
            "description": "Open-air rooftop terrace area for drinks and socializing above the driving range.",
            "is_free": False,
            "sort_order": 40,
        },
    ],
    "_venue_specials": [
        {
            "title": "Half-price play during off-peak hours",
            "type": "recurring_deal",
            "description": "Bay rental at half price during early weekday hours before the evening rush.",
            "price_note": "Half-price before peak hours on weekdays.",
            "days_of_week": "{1,2,3,4,5}",
        },
        {
            "title": "Weekend brunch specials",
            "type": "brunch",
            "description": "Brunch food and drink specials available Saturday and Sunday during daytime hours.",
            "days_of_week": "{6,7}",
        },
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
        "venue_id": venue_id,
        "destination_type": "entertainment",
        "commitment_tier": "halfday",
        "primary_activity": "Tech-driven golf entertainment with food, drinks, and games",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["outdoor", "climate-controlled-bays", "heated-bays"],
        "parking_type": "free_lot",
        "best_time_of_day": "evening",
        "practical_notes": "Free parking. Climate-controlled hitting bays on 3 levels — playable in any weather. Walk-ins welcome; bays can be reserved online. Weekend evenings are busiest.",
        "accessibility_notes": "ADA accessible. Bays on all levels via elevator.",
        "family_suitability": "yes",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Hourly bay rental pricing. Food and drinks ordered per bay. Half-price play during off-peak hours.",
        "source_url": HOMEPAGE,
        "metadata": {"source_type": "venue_enrichment", "venue_type": "entertainment", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "climate-controlled-hitting-bays",
        "title": "Climate-controlled hitting bays on 3 levels",
        "feature_type": "experience",
        "description": "Three levels of hitting bays with climate control — heated in winter, cooled in summer. Each bay has comfortable seating and a TV.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "interactive-golf-games",
        "title": "Interactive point-scoring golf games",
        "feature_type": "experience",
        "description": "Microchipped balls and targets make golf social and competitive — no skill required. Multiple game modes for all levels.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "full-bar-food-every-bay",
        "title": "Full bar and food menu at every bay",
        "feature_type": "amenity",
        "description": "Full food and drink service delivered directly to your bay — no need to leave your spot.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 30,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "rooftop-terrace",
        "title": "Rooftop terrace",
        "feature_type": "amenity",
        "description": "Open-air rooftop terrace area for drinks and socializing above the driving range.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 40,
    })
    envelope.add("venue_specials", {
        "venue_id": venue_id,
        "slug": "half-price-play",
        "title": "Half-price play during off-peak hours",
        "description": "Bay rental at half price during early weekday hours before the evening rush.",
        "price_note": "Half-price before peak hours on weekdays.",
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
    """Ensure Topgolf Atlanta Midtown has a fully enriched venue record.

    No events are crawled — the venue is open daily for walk-in play with
    no discrete programmed calendar. The crawler's sole job is to upsert
    the venue and refresh image/description from the live homepage on
    each run.
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
        logger.warning("Topgolf Atlanta Midtown: og: enrichment failed: %s", exc)

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
                "Topgolf Atlanta Midtown: venue update failed: %s", exc
            )

    logger.info(
        "Topgolf Atlanta Midtown: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
