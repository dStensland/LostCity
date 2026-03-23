"""
Crawler for Henry County Parks & Recreation programs.

Official source:
https://secure.rec1.com/GA/henry-county-ga/catalog

Platform: Rec1 (CivicRec)
Tenant slug: henry-county-ga

Henry County serves the south metro Atlanta area (McDonough, Stockbridge, Locust Grove,
Hampton) with approximately 200,000+ residents. This is a significant coverage gap
for the family portal — south metro families currently have no rec program coverage.

Tabs crawled (by Rec1 tab ID):
  13178  Activities
  14135  Afterschool
  13426  Camps
  20961  Dance
  13180  Drop-In Classes
  24150  Family Night Out
  24323  Homeschool
  19390  Performing Arts
  15827  Special Events
  24120  Therapeutic Recreation
  13427  Youth Athletics

Tabs skipped (non-program):
  13428  Active Adults  (senior-focused; filtered at session level)
  13502  Pavilions      (facility rentals)
  17143  Pickleball Courts (courts only)
  14491  Tennis Courts  (courts only)
  13754  Veterans Wall of Honor Bricks (memorial purchase, not events)

Known venues (Henry County recreation facilities):
  - Eagles Landing Recreation Center (McDonough)
  - Dutchtown Recreation Center (Hampton)
  - Stockbridge Recreation Center
  - Pebble Creek Recreation Center
  - Henry County Parks & Recreation (HQ)
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
    name="Henry County Parks & Recreation",
    slug="henry-county-parks-recreation",
    address="101 Kings Chapel Rd",
    neighborhood="McDonough",
    city="McDonough",
    state="GA",
    zip_code="30253",
    lat=33.4268,
    lng=-84.1305,
    venue_type="recreation",
)

_KNOWN_VENUES: dict[str, VenueInfo] = {
    "eagles landing": VenueInfo(
        name="Eagles Landing Recreation Center",
        slug="eagles-landing-recreation-center",
        address="101 Eagles Landing Pkwy",
        neighborhood="Stockbridge",
        city="Stockbridge",
        state="GA",
        zip_code="30281",
        lat=33.5461,
        lng=-84.2302,
        venue_type="recreation",
    ),
    "stockbridge": VenueInfo(
        name="Stockbridge Recreation Center",
        slug="stockbridge-recreation-center",
        address="4795 N Henry Blvd",
        neighborhood="Stockbridge",
        city="Stockbridge",
        state="GA",
        zip_code="30281",
        lat=33.5449,
        lng=-84.2339,
        venue_type="recreation",
    ),
    "dutchtown": VenueInfo(
        name="Dutchtown Recreation Center",
        slug="dutchtown-recreation-center",
        address="431 Dutchtown Rd",
        neighborhood="Hampton",
        city="Hampton",
        state="GA",
        zip_code="30228",
        lat=33.3818,
        lng=-84.2743,
        venue_type="recreation",
    ),
    "pebble creek": VenueInfo(
        name="Pebble Creek Recreation Center",
        slug="pebble-creek-recreation-center",
        address="395 Majors Rd",
        neighborhood="McDonough",
        city="McDonough",
        state="GA",
        zip_code="30252",
        lat=33.4451,
        lng=-84.1035,
        venue_type="recreation",
    ),
    "mcdonough": VenueInfo(
        name="McDonough Recreation Center",
        slug="mcdonough-recreation-center",
        address="101 Kings Chapel Rd",
        neighborhood="McDonough",
        city="McDonough",
        state="GA",
        zip_code="30253",
        lat=33.4268,
        lng=-84.1305,
        venue_type="recreation",
    ),
    "hampton": VenueInfo(
        name="Hampton Community Center",
        slug="hampton-community-center",
        address="8 W Main St",
        neighborhood="Hampton",
        city="Hampton",
        state="GA",
        zip_code="30228",
        lat=33.3837,
        lng=-84.2874,
        venue_type="community_center",
    ),
    "locust grove": VenueInfo(
        name="Locust Grove Recreation Center",
        slug="locust-grove-recreation-center",
        address="3725 GA-42",
        neighborhood="Locust Grove",
        city="Locust Grove",
        state="GA",
        zip_code="30248",
        lat=33.3440,
        lng=-84.1087,
        venue_type="recreation",
    ),
}

# Tabs with actual program/event content
_CRAWL_TAB_IDS = [
    "13178",  # Activities
    "14135",  # Afterschool
    "13426",  # Camps
    "20961",  # Dance
    "13180",  # Drop-In Classes
    "24150",  # Family Night Out
    "24323",  # Homeschool
    "19390",  # Performing Arts
    "15827",  # Special Events
    "24120",  # Therapeutic Recreation
    "13427",  # Youth Athletics
]

_SKIP_GROUP_KEYWORDS = [
    "pavilion rental",
    "facility rental",
    "shelter rental",
    "room rental",
    "pickleball court",
    "tennis court",
    "memorial brick",
    "veterans brick",
    "wall of honor",
    "membership",
    "annual pass",
    "punch card",
    "senior",
    "aarp",
    "55+",
    "50+",
    "donation",
    "scholarship",
]

_COMMUNITY_CENTER_SLUGS = {
    "eagles-landing-recreation-center",
    "stockbridge-recreation-center",
    "dutchtown-recreation-center",
    "pebble-creek-recreation-center",
    "mcdonough-recreation-center",
    "hampton-community-center",
    "locust-grove-recreation-center",
}


def _build_destination_envelope(venue_info: VenueInfo, venue_id: int) -> TypedEntityEnvelope | None:
    """Project Henry County parks and rec venues into shared destination details."""
    envelope = TypedEntityEnvelope()

    if venue_info.slug in _COMMUNITY_CENTER_SLUGS or venue_info.venue_type in {"recreation", "community_center"}:
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
                    f"{venue_info.name} is Henry County's primary indoor recreation destination "
                    "in the south metro Atlanta area, offering classes, camps, athletics, and "
                    "performing arts programming. Best as a planned visit with confirmed schedules."
                ),
                "accessibility_notes": (
                    "Indoor community-center space gives south Atlanta families a weather-proof "
                    "option with accessible parking, restroom access, and contained programming "
                    "that outdoor parks can't match on hot or rainy days."
                ),
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Program registration fees vary; check Henry County Parks for current offerings.",
                "source_url": "https://secure.rec1.com/GA/henry-county-ga/catalog",
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "venue_type": venue_info.venue_type,
                    "county": "henry",
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
                    f"{venue_info.name} gives Henry County families a year-round indoor recreation "
                    "option with youth classes, camps, athletic leagues, and performing arts programs."
                ),
                "url": "https://secure.rec1.com/GA/henry-county-ga/catalog",
                "price_note": "Registration fees vary by program.",
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
                "description": (
                    f"{venue_info.name} regularly hosts youth classes, athletic programs, "
                    "and seasonal camps through Henry County Parks & Recreation."
                ),
                "url": "https://secure.rec1.com/GA/henry-county-ga/catalog",
                "price_note": "Registration fees vary by program and season.",
                "is_free": False,
                "sort_order": 20,
            },
        )
        return envelope

    return None


def _build_tenant() -> TenantConfig:
    return TenantConfig(
        tenant_slug="henry-county-ga",
        county_name="Henry County",
        county_tag="henry-county",
        default_venue=_DEFAULT_VENUE,
        known_venues=_KNOWN_VENUES,
        crawl_tab_ids=_CRAWL_TAB_IDS,
        skip_group_keywords=_SKIP_GROUP_KEYWORDS,
        venue_enrichment_builder=_build_destination_envelope,
    )


HENRY_COUNTY_TENANT = _build_tenant()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Henry County Parks & Recreation programs from Rec1."""
    logger.info("Starting Henry County Parks & Recreation (Rec1) crawl")
    return crawl_tenant(source, HENRY_COUNTY_TENANT)
