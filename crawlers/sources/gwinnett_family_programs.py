"""
Hooky family-focused public-program layer for Gwinnett County Parks & Recreation.

This wraps the broader Gwinnett Rec1 operator with youth/family-heavy tabs and a
shared family filter so Hooky gains civic breadth without adult-program noise.
"""

from __future__ import annotations

import logging

from sources._rec1_base import TenantConfig, crawl_tenant
from sources.gwinnett_parks_rec import _DEFAULT_VENUE, _KNOWN_VENUES

logger = logging.getLogger(__name__)

_CRAWL_TAB_IDS = [
    "930",  # Camps
    "822",  # Education
    "821",  # Nature & History
    "823",  # Aquatics
    "955",  # Sports
]

_SKIP_GROUP_KEYWORDS = [
    "adult",
    "active adults",
    "senior",
    "line danc",
    "bachata",
    "waltz",
    "meditation",
    "rnb tennis",
]

_SKIP_SESSION_KEYWORDS = [
    "bachata",
    "salsa",
    "bollywood",
]


def _build_tenant() -> TenantConfig:
    return TenantConfig(
        tenant_slug="gwinnett-county-parks-recreation",
        county_name="Gwinnett County",
        county_tag="gwinnett",
        default_venue=_DEFAULT_VENUE,
        known_venues=_KNOWN_VENUES,
        crawl_tab_ids=_CRAWL_TAB_IDS,
        skip_group_keywords=_SKIP_GROUP_KEYWORDS,
        skip_session_keywords=_SKIP_SESSION_KEYWORDS,
        require_family_relevance=True,
    )


GWINNETT_FAMILY_TENANT = _build_tenant()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl family-relevant public programs from Gwinnett's Rec1 catalog."""
    logger.info("Starting Gwinnett family programs crawl")
    return crawl_tenant(source, GWINNETT_FAMILY_TENANT)
