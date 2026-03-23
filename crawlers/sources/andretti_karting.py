"""
Destination-first crawler for Andretti Indoor Karting & Games Atlanta.

Andretti is a large-format entertainment complex at 1255 Roswell Rd,
Marietta, GA. It features indoor karting, arcade games, bowling, laser
tag, and a full-service restaurant. No discrete event calendar — the
enriched venue record is the deliverable.

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

HOMEPAGE = "https://www.andrettikarting.com/atlanta/"

VENUE_DATA = {
    "name": "Andretti Indoor Karting & Games",
    "slug": "andretti-indoor-karting-atlanta",
    "address": "1255 Roswell Rd",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30062",
    "lat": 33.9530,
    "lng": -84.5200,
    "venue_type": "entertainment",
    "spot_type": "entertainment",
    "website": HOMEPAGE,
    # Hours verified 2026-03-11 against andrettikarting.com/atlanta/
    "hours": {
        "monday": "12:00-22:00",
        "tuesday": "12:00-22:00",
        "wednesday": "12:00-22:00",
        "thursday": "12:00-22:00",
        "friday": "12:00-00:00",
        "saturday": "10:00-00:00",
        "sunday": "10:00-22:00",
    },
    "vibes": [
        "groups",
        "corporate",
        "family-friendly",
        "interactive",
        "date-night",
        "karting",
        "arcade",
    ],
    "_destination_details": {
        "commitment_tier": "halfday",
        "parking_type": "free_lot",
        "best_time_of_day": "any",
        "family_suitability": "yes",
        "practical_notes": "Large free parking lot. All activities are indoors and climate-controlled. Walk-ins welcome; reservations recommended for groups and karting on weekends.",
        "primary_activity": "Indoor go-karts, arcade, bowling, laser tag, and dining",
        "destination_type": "entertainment_complex",
    },
    "_venue_features": [
        {
            "title": "Indoor go-kart racing",
            "feature_type": "experience",
            "description": "Multi-level indoor karting track with electric karts reaching speeds up to 35 mph.",
            "is_free": False,
            "sort_order": 10,
        },
        {
            "title": "Arcade floor with 200+ games",
            "feature_type": "experience",
            "description": "Massive arcade floor with over 200 games including racing simulators, redemption games, and VR experiences.",
            "is_free": False,
            "sort_order": 20,
        },
        {
            "title": "Bowling lanes",
            "feature_type": "experience",
            "description": "Full-size bowling lanes with lane-side food and drink service.",
            "is_free": False,
            "sort_order": 30,
        },
        {
            "title": "Laser tag arena",
            "feature_type": "experience",
            "description": "Multi-level laser tag arena for groups and walk-in play.",
            "is_free": False,
            "sort_order": 40,
        },
        {
            "title": "Full-service restaurant and bar",
            "feature_type": "amenity",
            "description": "On-site restaurant and full bar with a menu designed for sharing while playing.",
            "is_free": False,
            "sort_order": 50,
        },
    ],
    "_venue_specials": [
        {
            "title": "Weekday activity packages",
            "type": "recurring_deal",
            "description": "Discounted activity packages available Monday through Thursday.",
            "price_note": "Mon-Thu packages discounted vs. weekend pricing.",
            "days_of_week": "{1,2,3,4}",
        },
        {
            "title": "Group and birthday party packages",
            "type": "recurring_deal",
            "description": "Custom group packages for birthdays, corporate outings, and private events — includes reserved lanes, karting heats, and catering options.",
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
        "destination_type": "entertainment_complex",
        "commitment_tier": "halfday",
        "primary_activity": "Indoor go-karts, arcade, bowling, laser tag, and dining",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "rainy-day", "climate-controlled"],
        "parking_type": "free_lot",
        "best_time_of_day": "any",
        "practical_notes": "Large free parking lot. All activities are indoors and climate-controlled. Walk-ins welcome; reservations recommended for groups and karting on weekends.",
        "accessibility_notes": "ADA accessible throughout. Height/weight requirements apply for go-karts.",
        "family_suitability": "yes",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Pay-per-activity or buy activity packages. Full-service restaurant and bar on-site.",
        "source_url": HOMEPAGE,
        "metadata": {"source_type": "venue_enrichment", "venue_type": "entertainment", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "indoor-go-kart-racing",
        "title": "Indoor go-kart racing",
        "feature_type": "experience",
        "description": "Multi-level indoor karting track with electric karts reaching speeds up to 35 mph.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "arcade-floor",
        "title": "Arcade floor with 200+ games",
        "feature_type": "experience",
        "description": "Massive arcade floor with over 200 games including racing simulators, redemption games, and VR experiences.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "bowling-lanes",
        "title": "Bowling lanes",
        "feature_type": "experience",
        "description": "Full-size bowling lanes with lane-side food and drink service.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 30,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "laser-tag-arena",
        "title": "Laser tag arena",
        "feature_type": "experience",
        "description": "Multi-level laser tag arena for groups and walk-in play.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 40,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "full-service-restaurant-bar",
        "title": "Full-service restaurant and bar",
        "feature_type": "amenity",
        "description": "On-site restaurant and full bar with a menu designed for sharing while playing.",
        "url": HOMEPAGE,
        "is_free": False,
        "sort_order": 50,
    })
    envelope.add("venue_specials", {
        "venue_id": venue_id,
        "slug": "weekday-activity-packages",
        "title": "Weekday activity packages",
        "description": "Discounted activity packages available Monday through Thursday.",
        "price_note": "Mon-Thu packages discounted vs. weekend pricing.",
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
    """Ensure Andretti Indoor Karting Atlanta has a fully enriched venue record.

    No events are crawled — the venue is open daily for walk-in play with
    no discrete programmed calendar. The crawler's sole job is to upsert
    the venue and refresh image/description from the live homepage on
    each run.
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
        logger.warning(
            "Andretti Indoor Karting Atlanta: og: enrichment failed: %s", exc
        )

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
            logger.warning(
                "Andretti Indoor Karting Atlanta: venue update failed: %s", exc
            )

    logger.info(
        "Andretti Indoor Karting Atlanta: venue record enriched"
        " (destination-first, no events)"
    )
    return 0, 0, 0
