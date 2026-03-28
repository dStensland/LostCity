"""
Crawler for Pittsburgh Yards (pittsburghyards.com).

Emerging cultural hub in Pittsburgh neighborhood — mixed-use development with
community programming, Pittsburgh Community Market, fitness classes, and local events.

Site runs WordPress + The Events Calendar (Tribe) plugin → use the Tribe base class.
"""

from __future__ import annotations

from sources._tribe_events_base import TribeConfig, crawl_tribe

_CONFIG = TribeConfig(
    base_url="https://www.pittsburghyards.com",
    place_data={
        "name": "Pittsburgh Yards",
        "slug": "pittsburgh-yards",
        "address": "352 University Ave SW",
        "neighborhood": "Pittsburgh",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30310",
        "lat": 33.7358,
        "lng": -84.4106,
        "place_type": "cultural_center",
        "spot_type": "cultural_center",
        "website": "https://pittsburghyards.com",
        "description": (
            "Mixed-use development and community hub in Pittsburgh neighborhood. "
            "Hosts the Pittsburgh Community Market, fitness classes, cultural events, "
            "and community programming."
        ),
        "vibes": ["community", "outdoor", "family-friendly", "cultural"],
    },
    default_category="community",
    default_tags=["pittsburgh-yards", "pittsburgh", "southwest-atlanta"],
)


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_tribe(source, _CONFIG)
