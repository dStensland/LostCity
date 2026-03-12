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

from sources._rec1_base import TenantConfig, VenueInfo, crawl_tenant

logger = logging.getLogger(__name__)

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


def _build_tenant() -> TenantConfig:
    return TenantConfig(
        tenant_slug="city-of-milton",
        county_name="City of Milton",
        county_tag="milton",
        default_venue=_DEFAULT_VENUE,
        known_venues={},
        crawl_tab_ids=_CRAWL_TAB_IDS,
        skip_group_keywords=_SKIP_GROUP_KEYWORDS,
    )


MILTON_TENANT = _build_tenant()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City of Milton Parks & Recreation family programs from Rec1."""
    logger.info("Starting City of Milton Parks & Recreation (Rec1) crawl")
    return crawl_tenant(source, MILTON_TENANT)
