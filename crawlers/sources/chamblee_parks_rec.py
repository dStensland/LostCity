"""
Crawler for Chamblee Parks & Recreation programs via MyRec.

Official catalog:
https://chambleega.myrec.com/info/activities/default.aspx?type=activities

Chamblee mixes adult and youth programming in one catalog, so this source uses
the shared MyRec parser with a family-only inclusion filter. That keeps Hooky's
coverage focused on camps, youth athletics, and kid/family enrichment programs.
"""

from __future__ import annotations

from db import get_or_create_place
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from sources._myrec_base import crawl_myrec, is_family_relevant_session

BASE_URL = "https://chambleega.myrec.com"
ACTIVITIES_URL = f"{BASE_URL}/info/activities/default.aspx?type=activities"

PLACE_DATA = {
    "name": "Chamblee Parks and Recreation",
    "slug": "chamblee-parks-recreation",
    "address": "3518 Broad Street",
    "neighborhood": "Chamblee",
    "city": "Chamblee",
    "state": "GA",
    "zip": "30341",
    "lat": 33.8892,
    "lng": -84.2997,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": "https://www.chambleega.com/157/Parks-Recreation",
    "vibes": ["family-friendly", "educational"],
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()

    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "community_recreation_center",
            "commitment_tier": "halfday",
            "primary_activity": "family recreation center visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip"],
            "parking_type": "free_lot",
            "best_time_of_day": "afternoon",
            "practical_notes": (
                "Chamblee Parks and Recreation works best as a weather-proof family activity base for classes, camps, and shorter recreation blocks rather than as a full destination day."
            ),
            "accessibility_notes": (
                "Indoor recreation-center space makes it lower-friction for strollers, bathroom access, and quick resets than a park-only plan."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Drop-in access and classes vary by center; check Chamblee Parks and Recreation for current family programming and building hours.",
            "source_url": ACTIVITIES_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": PLACE_DATA.get("venue_type"),
                "city": "chamblee",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "indoor-family-recreation-space",
            "title": "Indoor family recreation space",
            "feature_type": "amenity",
            "description": "Chamblee Parks and Recreation gives families an indoor recreation option with weather-proof community-center space and youth programming.",
            "url": ACTIVITIES_URL,
            "price_note": "Drop-in access and building amenities vary by center.",
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "family-classes-and-seasonal-camps",
            "title": "Family classes and seasonal camps",
            "feature_type": "experience",
            "description": "Chamblee Parks and Recreation regularly hosts youth classes, family recreation programming, and seasonal camps through its public catalog.",
            "url": ACTIVITIES_URL,
            "price_note": "Registration costs vary by program and season.",
            "is_free": False,
            "sort_order": 20,
        },
    )
    return envelope


def _include_session(
    program: dict,
    detail: dict,
    session: dict,
    age_min: int | None,
    age_max: int | None,
) -> bool:
    return is_family_relevant_session(
        category_name=program["category_name"],
        program_name=detail["program_name"],
        program_description=detail["description_text"],
        session=session,
        age_min=age_min,
        age_max=age_max,
    )


MYREC_CONFIG = {
    "base_url": BASE_URL,
    "activities_url": ACTIVITIES_URL,
    "venue": PLACE_DATA,
    "include_session": _include_session,
}


def crawl(source: dict) -> tuple[int, int, int]:
    venue_id = get_or_create_place(PLACE_DATA)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))
    return crawl_myrec(source, MYREC_CONFIG)
