"""
Crawler for Chamblee Parks & Recreation programs via MyRec.

Official catalog:
https://chambleega.myrec.com/info/activities/default.aspx?type=activities

Chamblee mixes adult and youth programming in one catalog, so this source uses
the shared MyRec parser with a family-only inclusion filter. That keeps Hooky's
coverage focused on camps, youth athletics, and kid/family enrichment programs.
"""

from __future__ import annotations

from sources._myrec_base import crawl_myrec, is_family_relevant_session

BASE_URL = "https://chambleega.myrec.com"
ACTIVITIES_URL = f"{BASE_URL}/info/activities/default.aspx?type=activities"

VENUE_DATA = {
    "name": "Chamblee Parks and Recreation",
    "slug": "chamblee-parks-recreation",
    "address": "3518 Broad Street",
    "neighborhood": "Chamblee",
    "city": "Chamblee",
    "state": "GA",
    "zip": "30341",
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": "https://www.chambleega.com/157/Parks-Recreation",
    "vibes": ["family-friendly", "educational"],
}


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
    "venue": VENUE_DATA,
    "include_session": _include_session,
}


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_myrec(source, MYREC_CONFIG)
