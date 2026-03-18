"""
Crawler for City of Milton Parks & Recreation programs.

Official source:
https://secure.rec1.com/GA/city-of-milton/catalog

Pattern role:
Rec1 civic catalog reusing the shared _rec1_base pipeline for family-oriented
camps, preschool/youth programs, and outdoor recreation.
"""

from __future__ import annotations

import logging

from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from sources._rec1_base import TenantConfig, VenueInfo, crawl_tenant

logger = logging.getLogger(__name__)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    programs=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

_DEFAULT_VENUE = VenueInfo(
    name="City of Milton Parks & Recreation",
    slug="city-of-milton-parks-rec",
    address="2006 Heritage Walk",
    neighborhood="Milton",
    city="Milton",
    state="GA",
    zip_code="30004",
    lat=34.1642,
    lng=-84.3266,
    venue_type="recreation",
)

_CRAWL_TAB_IDS = [
    "1357",   # Camp Joyful Soles
    "16620",  # Camp Compass
    "22636",  # Summer Camps
    "26452",  # Preschool Programs
    "26453",  # Youth Programs
    "22291",  # Outdoor Recreation
]

_SKIP_GROUP_KEYWORDS = [
    "after camp care",
    "pool pass",
    "rental",
    "book club",
    "self - defense",
]


def _build_destination_envelope(venue_info: VenueInfo, venue_id: int) -> TypedEntityEnvelope | None:
    """Project Milton family venues into shared destination details."""
    envelope = TypedEntityEnvelope()

    if venue_info.venue_type in {"recreation", "community_center"}:
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
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Drop-in access and classes vary by program; check Milton Parks & Recreation for current family offerings and facility hours.",
                "source_url": "https://secure.rec1.com/GA/city-of-milton/catalog",
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "venue_type": venue_info.venue_type,
                    "city": "milton",
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
                "description": f"{venue_info.name} gives families an indoor recreation option with weather-proof community-center space and youth programming through Milton Parks & Recreation.",
                "url": "https://secure.rec1.com/GA/city-of-milton/catalog",
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
                "description": f"{venue_info.name} regularly hosts youth classes, family recreation programming, and seasonal camps through Milton Parks & Recreation.",
                "url": "https://secure.rec1.com/GA/city-of-milton/catalog",
                "price_note": "Registration costs vary by program and season.",
                "is_free": False,
                "sort_order": 20,
            },
        )
        return envelope

    if venue_info.venue_type == "park":
        envelope.add(
            "destination_details",
            {
                "venue_id": venue_id,
                "destination_type": "park",
                "commitment_tier": "halfday",
                "primary_activity": "family park visit",
                "best_seasons": ["spring", "summer", "fall"],
                "weather_fit_tags": ["outdoor", "free-option", "family-daytrip"],
                "parking_type": "free_lot",
                "best_time_of_day": "morning",
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Open park access is free; classes, camps, and registrations vary by site and season.",
                "source_url": "https://secure.rec1.com/GA/city-of-milton/catalog",
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "venue_type": venue_info.venue_type,
                    "city": "milton",
                },
            },
        )
        envelope.add(
            "venue_features",
            {
                "venue_id": venue_id,
                "slug": "free-outdoor-play-space",
                "title": "Free outdoor play space",
                "feature_type": "amenity",
                "description": f"{venue_info.name} is a free Milton park option for low-friction family outdoor time, open-air play, and pairing with seasonal city programming.",
                "url": "https://secure.rec1.com/GA/city-of-milton/catalog",
                "price_note": "Open park access is free.",
                "is_free": True,
                "sort_order": 10,
            },
        )
        return envelope

    return None


def _build_tenant() -> TenantConfig:
    return TenantConfig(
        tenant_slug="city-of-milton",
        county_name="City of Milton",
        county_tag="milton",
        default_venue=_DEFAULT_VENUE,
        known_venues={},
        crawl_tab_ids=_CRAWL_TAB_IDS,
        skip_group_keywords=_SKIP_GROUP_KEYWORDS,
        # "(Closed to Public)" programs are private Scout badge classes not
        # open to the public. Skip them entirely at the session level.
        skip_session_keywords=["(closed to public)"],
        venue_enrichment_builder=_build_destination_envelope,
    )


MILTON_TENANT = _build_tenant()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City of Milton Parks & Recreation family programs from Rec1."""
    logger.info("Starting City of Milton Parks & Recreation (Rec1) crawl")
    return crawl_tenant(source, MILTON_TENANT)
