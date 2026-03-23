"""
Crawler for City of Sandy Springs Recreation & Parks programs.

Official source:
https://secure.rec1.com/GA/sandy-springs-ga/catalog

Platform: Rec1 (CivicRec)
Tenant slug: sandy-springs-ga

Tabs crawled (by Rec1 tab ID):
  8026   Activities
  8708   Events
  8704   Special Interest & Outdoor
  16337  Art
  14915  Adaptive Recreation
  17361  Water Sports
  8706   Youth Leagues
  8710   Youth Athletics
  8975   Camps
  8705   Adult Sports
  17251  Fitness
  28422  Dance

Tabs skipped (non-program):
  9231   Welcome Message
  10170  Forms
  8027   Facility Rentals
  11302  Tennis/Pickleball Courts (courts only, no programmed events)
  20929  Runs/Walks
  9099   Art - Private Parties
  8709   Film/Photo Permit
  19388  Outreach Programming
  11417  Facility Calendars
  16056  F.A.Q.
  22561  MISC

Known venues (Sandy Springs recreation centers and parks):
  - Sandy Springs Recreation and Parks (City Hall / HQ)
  - Morgan Falls Overlook Park
  - Abernathy Arts Center
  - Hammond Park
  - Riverside Park
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
    name="Sandy Springs Recreation and Parks",
    slug="sandy-springs-recreation-and-parks",
    address="1 Galambos Way",
    neighborhood="Sandy Springs",
    city="Sandy Springs",
    state="GA",
    zip_code="30328",
    lat=33.9248,
    lng=-84.3768,
    venue_type="recreation",
)

_KNOWN_VENUES: dict[str, VenueInfo] = {
    "abernathy arts center": VenueInfo(
        name="Abernathy Arts Center",
        slug="abernathy-arts-center-sandy-springs",
        address="254 Johnson Ferry Rd NE",
        neighborhood="Sandy Springs",
        city="Sandy Springs",
        state="GA",
        zip_code="30328",
        lat=33.9433,
        lng=-84.3677,
        venue_type="arts_center",
    ),
    "hammond park": VenueInfo(
        name="Hammond Park",
        slug="hammond-park-sandy-springs",
        address="705 Hammond Dr",
        neighborhood="Sandy Springs",
        city="Sandy Springs",
        state="GA",
        zip_code="30328",
        lat=33.9087,
        lng=-84.3574,
        venue_type="park",
    ),
    "morgan falls overlook": VenueInfo(
        name="Morgan Falls Overlook Park",
        slug="morgan-falls-overlook-park",
        address="1085 Morgan Falls Rd",
        neighborhood="Sandy Springs",
        city="Sandy Springs",
        state="GA",
        zip_code="30350",
        lat=33.9806,
        lng=-84.3521,
        venue_type="park",
    ),
    "riverside park": VenueInfo(
        name="Riverside Park",
        slug="riverside-park-sandy-springs",
        address="8200 Roberts Dr",
        neighborhood="Sandy Springs",
        city="Sandy Springs",
        state="GA",
        zip_code="30350",
        lat=33.9843,
        lng=-84.3468,
        venue_type="park",
    ),
    "city springs": VenueInfo(
        name="City Springs — Sandy Springs",
        slug="city-springs-sandy-springs",
        address="1 Galambos Way",
        neighborhood="Sandy Springs",
        city="Sandy Springs",
        state="GA",
        zip_code="30328",
        lat=33.9248,
        lng=-84.3768,
        venue_type="community_center",
    ),
}

# Tabs with actual program/event content
_CRAWL_TAB_IDS = [
    "8026",   # Activities
    "8708",   # Events
    "8704",   # Special Interest & Outdoor
    "16337",  # Art
    "14915",  # Adaptive Recreation
    "17361",  # Water Sports
    "8706",   # Youth Leagues
    "8710",   # Youth Athletics
    "8975",   # Camps
    "8705",   # Adult Sports
    "17251",  # Fitness
    "28422",  # Dance
]

_SKIP_GROUP_KEYWORDS = [
    "facility rental",
    "pavilion rental",
    "room rental",
    "shelter rental",
    "tennis court",
    "pickleball court",
    "film permit",
    "photo permit",
    "membership",
    "annual pass",
    "punch card",
    "private party",
    "vendor",
    "donation",
    "scholarship",
]

_COMMUNITY_CENTER_SLUGS = {
    "sandy-springs-recreation-and-parks",
    "city-springs-sandy-springs",
    "abernathy-arts-center-sandy-springs",
}

_PARK_SLUGS = {
    "hammond-park-sandy-springs",
    "morgan-falls-overlook-park",
    "riverside-park-sandy-springs",
}


def _build_destination_envelope(venue_info: VenueInfo, venue_id: int) -> TypedEntityEnvelope | None:
    """Project Sandy Springs parks and rec venues into shared destination details."""
    envelope = TypedEntityEnvelope()

    if venue_info.slug in _COMMUNITY_CENTER_SLUGS:
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
                    f"{venue_info.name} is Sandy Springs' primary indoor recreation destination "
                    "with classes, camps, arts programming, and youth athletics. "
                    "Best as a planned visit — confirm program schedules before arriving."
                ),
                "accessibility_notes": (
                    "Indoor community-center space with accessible parking and lower friction "
                    "for strollers and bathroom access than Sandy Springs' outdoor parks."
                ),
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Program registration fees vary; check Sandy Springs Recreation for current offerings.",
                "source_url": "https://secure.rec1.com/GA/sandy-springs-ga/catalog",
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "venue_type": venue_info.venue_type,
                    "city": "sandy_springs",
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
                "description": (
                    f"{venue_info.name} offers Sandy Springs families a weather-proof indoor "
                    "recreation option with year-round youth classes, arts programs, and seasonal camps."
                ),
                "url": "https://secure.rec1.com/GA/sandy-springs-ga/catalog",
                "price_note": "Registration fees vary by program.",
                "is_free": False,
                "sort_order": 10,
            },
        )
        return envelope

    if venue_info.slug in _PARK_SLUGS:
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
                "practical_notes": (
                    f"{venue_info.name} works best for low-friction outdoor family time — "
                    "morning play, nature walks, or pairing with a seasonal Sandy Springs program."
                ),
                "accessibility_notes": (
                    "Outdoor parks give families more flexibility in pacing, but shade, "
                    "restroom access, and stroller terrain vary by site."
                ),
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Open park access is free; some programmed activities require registration.",
                "source_url": "https://secure.rec1.com/GA/sandy-springs-ga/catalog",
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "venue_type": venue_info.venue_type,
                    "city": "sandy_springs",
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
                "description": (
                    f"{venue_info.name} is a free Sandy Springs park for open-air family time, "
                    "walking trails, and outdoor programming."
                ),
                "url": "https://secure.rec1.com/GA/sandy-springs-ga/catalog",
                "price_note": "Open park access is free.",
                "is_free": True,
                "sort_order": 10,
            },
        )
        return envelope

    return None


def _build_tenant() -> TenantConfig:
    return TenantConfig(
        tenant_slug="sandy-springs-ga",
        county_name="City of Sandy Springs",
        county_tag="sandy-springs",
        default_venue=_DEFAULT_VENUE,
        known_venues=_KNOWN_VENUES,
        crawl_tab_ids=_CRAWL_TAB_IDS,
        skip_group_keywords=_SKIP_GROUP_KEYWORDS,
        venue_enrichment_builder=_build_destination_envelope,
    )


SANDY_SPRINGS_TENANT = _build_tenant()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City of Sandy Springs Recreation & Parks programs from Rec1."""
    logger.info("Starting City of Sandy Springs Recreation & Parks (Rec1) crawl")
    return crawl_tenant(source, SANDY_SPRINGS_TENANT)
