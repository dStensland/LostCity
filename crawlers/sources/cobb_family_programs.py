"""
Hooky family-focused public-program layer for Cobb County Parks & Recreation.

This wraps the broader Cobb Rec1 operator with youth/family-heavy tabs and a
shared family filter so Hooky gains civic breadth without adult-program noise.
"""

from __future__ import annotations

import logging

from sources._rec1_base import TenantConfig, crawl_tenant
from sources.cobb_parks_rec import _DEFAULT_VENUE, _KNOWN_VENUES

logger = logging.getLogger(__name__)

_CRAWL_TAB_IDS = [
    "4319",   # Camps
    "20238",  # Youth Sports
    "4321",   # Outdoor/Nature
    "4320",   # Arts
    "4317",   # Gymnastics
]

_SKIP_GROUP_KEYWORDS = [
    "adult",
    "senior",
    "line danc",
    "belly dance",
    "pickleball",
]


def _build_tenant() -> TenantConfig:
    return TenantConfig(
        tenant_slug="cobb-county-ga",
        county_name="Cobb County",
        county_tag="cobb",
        default_venue=_DEFAULT_VENUE,
        known_venues=_KNOWN_VENUES,
        crawl_tab_ids=_CRAWL_TAB_IDS,
        skip_group_keywords=_SKIP_GROUP_KEYWORDS,
        require_family_relevance=True,
    )


COBB_FAMILY_TENANT = _build_tenant()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl family-relevant public programs from Cobb's Rec1 catalog."""
    logger.info("Starting Cobb family programs crawl")
    return crawl_tenant(source, COBB_FAMILY_TENANT)
