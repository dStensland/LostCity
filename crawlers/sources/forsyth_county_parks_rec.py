"""
Crawler for Forsyth County Parks & Recreation programs.

Official source:
https://secure.rec1.com/GA/forsyth-county-ga/catalog

Pattern role:
Rec1 civic catalog reusing the shared _rec1_base pipeline for family-oriented
camps, youth sports, dance, gymnastics, martial arts, STEM, aquatics, and
outdoor recreation programs across Forsyth County, GA.

Tenant slug: forsyth-county-ga
County seat: Cumming, GA

Program tabs crawled (by Rec1 tab ID):
  7200   Art Programs
  7308   Camps
  7201   Dance
  8067   Environmental Education
  7358   Gymnastics
  7357   Martial Arts
  7311   Outdoor Recreation
  7313   Special Events/Programs
  7309   Sports
  22894  Pickleball Programs
  7368   Tennis Programs
  7312   Therapeutic Recreation
  8358   STEM
  8359   Health and Fitness Programs

Skipped tabs (not actual registrable events):
  7310   Facility Reservations
  15767  Birthday Parties
  7315   Rec Center Memberships
  21386  Scholarship Donations

Major park locations (from Rec1 location filter):
  Caney Creek Preserve, Central Park, Chattahoochee Pointe,
  Coal Mountain Park, Ducktown Community Park, Eagles Beak,
  Fowler Park, Haw Creek Park, Lanierland Park, Matt Community Park,
  Midway Park, Old Atlanta Park, Poole's Mill Park, Sawnee Mountain Park,
  Sawnee Mountain Preserve, Sharon Springs Park, Windermere Park,
  Young Deer Creek Park

Note: _rec1_base._CATALOG_HEADERS requires Accept-Encoding: gzip, deflate
to receive a non-empty response from forsyth-county-ga. This header was
added to the base module as part of this integration.
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
    name="Forsyth County Parks & Recreation",
    slug="forsyth-county-parks-recreation",
    address="110 E Main St",
    neighborhood="Forsyth County",
    city="Cumming",
    state="GA",
    zip_code="30040",
    lat=34.2073,
    lng=-84.1402,
    venue_type="recreation",
)

# ---------------------------------------------------------------------------
# Known park venues — key matches Rec1 location string (case-insensitive,
# partial match).  Parks in Forsyth County are spread across the county;
# Cumming is the county seat. Coordinates sourced from Google Maps.
# ---------------------------------------------------------------------------

_KNOWN_VENUES: dict[str, VenueInfo] = {
    "central park": VenueInfo(
        name="Central Park Forsyth County",
        slug="central-park-forsyth-county",
        address="1225 Market Place Blvd",
        neighborhood="Forsyth County",
        city="Cumming",
        state="GA",
        zip_code="30041",
        lat=34.1952,
        lng=-84.1297,
        venue_type="park",
    ),
    "fowler park": VenueInfo(
        name="Fowler Park",
        slug="fowler-park-forsyth-county",
        address="4100 Fowler Rd",
        neighborhood="Forsyth County",
        city="Cumming",
        state="GA",
        zip_code="30028",
        lat=34.3103,
        lng=-84.1878,
        venue_type="park",
    ),
    "lanierland": VenueInfo(
        name="Lanierland Park",
        slug="lanierland-park-forsyth-county",
        address="3490 Leaning Tree Rd",
        neighborhood="Forsyth County",
        city="Cumming",
        state="GA",
        zip_code="30041",
        lat=34.1732,
        lng=-84.0614,
        venue_type="park",
    ),
    "sharon springs": VenueInfo(
        name="Sharon Springs Park",
        slug="sharon-springs-park-forsyth-county",
        address="1950 Sharon Rd",
        neighborhood="Forsyth County",
        city="Cumming",
        state="GA",
        zip_code="30041",
        lat=34.1248,
        lng=-84.1476,
        venue_type="park",
    ),
    "sawnee mountain": VenueInfo(
        name="Sawnee Mountain Preserve",
        slug="sawnee-mountain-preserve",
        address="4075 Spot Rd",
        neighborhood="Forsyth County",
        city="Cumming",
        state="GA",
        zip_code="30028",
        lat=34.3086,
        lng=-84.2203,
        venue_type="park",
    ),
    "coal mountain": VenueInfo(
        name="Coal Mountain Park",
        slug="coal-mountain-park-forsyth-county",
        address="3715 Coal Mountain Dr",
        neighborhood="Forsyth County",
        city="Cumming",
        state="GA",
        zip_code="30028",
        lat=34.3285,
        lng=-84.1752,
        venue_type="park",
    ),
}

_CRAWL_TAB_IDS = [
    "7200",  # Art Programs
    "7308",  # Camps
    "7201",  # Dance
    "8067",  # Environmental Education
    "7358",  # Gymnastics
    "7357",  # Martial Arts
    "7311",  # Outdoor Recreation
    "7313",  # Special Events/Programs
    "7309",  # Sports
    "22894",  # Pickleball Programs
    "7368",  # Tennis Programs
    "7312",  # Therapeutic Recreation
    "8358",  # STEM
    "8359",  # Health and Fitness Programs
]

_SKIP_GROUP_KEYWORDS = [
    "facility rental",
    "pavilion rental",
    "room rental",
    "membership",
    "scholarship donation",
    "birthday party",
    "pool pass",
    "season pass",
]


def _build_destination_envelope(
    venue_info: VenueInfo, venue_id: int
) -> TypedEntityEnvelope | None:
    """Project Forsyth County family venues into shared destination details."""
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
                "weather_fit_tags": [
                    "indoor",
                    "rainy-day",
                    "heat-day",
                    "family-daytrip",
                ],
                "parking_type": "free_lot",
                "best_time_of_day": "afternoon",
                "practical_notes": (
                    f"{venue_info.name} works best as a weather-proof family recreation base "
                    "for classes, camps, or a shorter afternoon activity block rather than "
                    "as a destination requiring an all-day commitment."
                ),
                "accessibility_notes": (
                    "Indoor community-center space keeps the visit lower-friction for "
                    "strollers, bathroom access, and quick resets compared to "
                    "Forsyth County's outdoor-only family options."
                ),
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": (
                    "Drop-in access and classes vary by program; check Forsyth County "
                    "Parks & Recreation for current family offerings and facility hours."
                ),
                "source_url": "https://secure.rec1.com/GA/forsyth-county-ga/catalog",
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "venue_type": venue_info.venue_type,
                    "city": "cumming",
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
                    f"{venue_info.name} gives families an indoor recreation option with "
                    "weather-proof community-center space and youth programming through "
                    "Forsyth County Parks & Recreation."
                ),
                "url": "https://secure.rec1.com/GA/forsyth-county-ga/catalog",
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
                "description": (
                    f"{venue_info.name} regularly hosts youth classes, family recreation "
                    "programming, and seasonal camps through Forsyth County Parks & Recreation."
                ),
                "url": "https://secure.rec1.com/GA/forsyth-county-ga/catalog",
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
                "practical_notes": (
                    f"{venue_info.name} works best as a free outdoor family stop for "
                    "morning play, lower-pressure wandering, or pairing with a seasonal "
                    "program rather than as a tightly scheduled attraction."
                ),
                "accessibility_notes": (
                    "Outdoor park use gives families more pacing flexibility, but stroller "
                    "comfort, shade, and bathroom convenience vary more by site than at "
                    "indoor recreation facilities."
                ),
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Open park access is free; classes and registrations vary by site.",
                "source_url": "https://secure.rec1.com/GA/forsyth-county-ga/catalog",
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "venue_type": venue_info.venue_type,
                    "city": "cumming",
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
                    f"{venue_info.name} is a free Forsyth County park option for "
                    "low-friction family outdoor time, open-air play, and pairing with "
                    "seasonal county programming."
                ),
                "url": "https://secure.rec1.com/GA/forsyth-county-ga/catalog",
                "price_note": "Open park access is free.",
                "is_free": True,
                "sort_order": 10,
            },
        )
        return envelope

    return None


def _build_tenant() -> TenantConfig:
    return TenantConfig(
        tenant_slug="forsyth-county-ga",
        county_name="Forsyth County",
        county_tag="forsyth",
        default_venue=_DEFAULT_VENUE,
        known_venues=_KNOWN_VENUES,
        crawl_tab_ids=_CRAWL_TAB_IDS,
        skip_group_keywords=_SKIP_GROUP_KEYWORDS,
        venue_enrichment_builder=_build_destination_envelope,
    )


FORSYTH_TENANT = _build_tenant()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Forsyth County Parks & Recreation family programs from Rec1."""
    logger.info("Starting Forsyth County Parks & Recreation (Rec1) crawl")
    return crawl_tenant(source, FORSYTH_TENANT)
