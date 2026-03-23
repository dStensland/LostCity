"""
Crawler for Cherokee County Parks & Recreation programs.

Official source:
https://secure.rec1.com/GA/cherokee-county/catalog

Pattern role:
Rec1 civic catalog reusing the shared _rec1_base pipeline for family-oriented
camps, youth sports, aquatics, and outdoor recreation programs across
Cherokee County, GA.

Tenant slug: cherokee-county
County seat: Canton, GA
Major cities covered: Canton, Woodstock, Acworth (all currently zero coverage)

NOTE ON TENANT STATUS (2026-03-22):
The Rec1 tenant slug "cherokee-county" was verified as not yet serving a live
catalog. The catalog endpoint returns an empty response (HTTP 200 with 0 bytes)
rather than the JSON expected by the _rec1_base pipeline. This crawler is
structured and registered so it activates automatically once Cherokee County
is live on secure.rec1.com/GA/cherokee-county — crawl_tenant() handles the
missing-key case gracefully by returning (0, 0, 0) without errors.

To test status: curl -sI --compressed \\
  -H 'Accept-Encoding: gzip, deflate' \\
  'https://secure.rec1.com/GA/cherokee-county/catalog'
  (a live tenant returns Content-Type: text/html with 40KB+ body)

Program tabs to crawl once live (IDs TBD — run with --dry-run to discover):
  - Aquatics / Swim
  - Camps
  - Youth Sports
  - Classes & Activities
  - Special Events

Skipped tabs (not actual events):
  - Facility Reservations
  - Memberships
  - Rental Venues
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
    name="Cherokee County Parks & Recreation",
    slug="cherokee-county-parks-recreation",
    address="1130 Univeter Rd",
    neighborhood="Cherokee County",
    city="Canton",
    state="GA",
    zip_code="30115",
    lat=34.1826,
    lng=-84.5205,
    venue_type="recreation",
)

# ---------------------------------------------------------------------------
# Known rec centers — expand once Cherokee County Rec1 tenant goes live
# and the location strings from the API can be confirmed.
# ---------------------------------------------------------------------------

_KNOWN_VENUES: dict[str, VenueInfo] = {
    "r.t. jones": VenueInfo(
        name="R.T. Jones Memorial Library",
        slug="rt-jones-library-canton",
        address="116 Brown Industrial Pkwy",
        neighborhood="Cherokee County",
        city="Canton",
        state="GA",
        zip_code="30114",
        lat=34.2338,
        lng=-84.4981,
        venue_type="community_center",
    ),
    "dsu": VenueInfo(
        name="Downtown Sixes Recreation Area",
        slug="downtown-sixes-recreation",
        address="6075 Cumming Hwy",
        neighborhood="Cherokee County",
        city="Canton",
        state="GA",
        zip_code="30115",
        lat=34.2014,
        lng=-84.4752,
        venue_type="recreation",
    ),
    "canton": VenueInfo(
        name="Canton Recreation Center",
        slug="canton-recreation-center",
        address="801 Marietta Rd",
        neighborhood="Canton",
        city="Canton",
        state="GA",
        zip_code="30114",
        lat=34.2368,
        lng=-84.4989,
        venue_type="recreation",
    ),
    "woodstock": VenueInfo(
        name="Woodstock Recreation Center",
        slug="woodstock-recreation-center",
        address="945 Ridgewood Rd",
        neighborhood="Woodstock",
        city="Woodstock",
        state="GA",
        zip_code="30189",
        lat=34.1014,
        lng=-84.5216,
        venue_type="recreation",
    ),
}

# Tab IDs are TBD — will be populated once the Cherokee County Rec1 tenant
# goes live. Setting crawl_tab_ids=[] causes the base module to crawl ALL
# tabs, then skip facility-rental/membership tabs via skip_group_keywords.
_CRAWL_TAB_IDS: list[str] = []

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
    """Project Cherokee County family venues into shared destination details."""
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
                    "Cherokee County's outdoor-only family options."
                ),
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": (
                    "Drop-in access and classes vary by program; check Cherokee County "
                    "Parks & Recreation for current family offerings and facility hours."
                ),
                "source_url": "https://secure.rec1.com/GA/cherokee-county/catalog",
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "venue_type": venue_info.venue_type,
                    "city": "canton",
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
                    "Cherokee County Parks & Recreation."
                ),
                "url": "https://secure.rec1.com/GA/cherokee-county/catalog",
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
                    "programming, and seasonal camps through Cherokee County Parks & Recreation."
                ),
                "url": "https://secure.rec1.com/GA/cherokee-county/catalog",
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
                "source_url": "https://secure.rec1.com/GA/cherokee-county/catalog",
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "venue_type": venue_info.venue_type,
                    "city": "canton",
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
                    f"{venue_info.name} is a free Cherokee County park option for "
                    "low-friction family outdoor time, open-air play, and pairing with "
                    "seasonal county programming."
                ),
                "url": "https://secure.rec1.com/GA/cherokee-county/catalog",
                "price_note": "Open park access is free.",
                "is_free": True,
                "sort_order": 10,
            },
        )
        return envelope

    return None


def _build_tenant() -> TenantConfig:
    return TenantConfig(
        tenant_slug="cherokee-county",
        county_name="Cherokee County",
        county_tag="cherokee",
        default_venue=_DEFAULT_VENUE,
        known_venues=_KNOWN_VENUES,
        # Empty = crawl all tabs when the tenant goes live.
        # Specific IDs will be filled in from the API once the tenant is active.
        crawl_tab_ids=_CRAWL_TAB_IDS,
        skip_group_keywords=_SKIP_GROUP_KEYWORDS,
        venue_enrichment_builder=_build_destination_envelope,
    )


CHEROKEE_TENANT = _build_tenant()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Cherokee County Parks & Recreation family programs from Rec1.

    NOTE: Returns (0, 0, 0) until the Cherokee County Rec1 tenant
    (secure.rec1.com/GA/cherokee-county) is live.  The base module handles
    the missing-checkout-key case gracefully.
    """
    logger.info("Starting Cherokee County Parks & Recreation (Rec1) crawl")
    return crawl_tenant(source, CHEROKEE_TENANT)
