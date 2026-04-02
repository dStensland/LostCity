"""
Crawler for Center for Black Women's Wellness (cbww.org).

The Center for Black Women's Wellness is dedicated to the optimal health and
well-being of Black women and girls through education, movement, advocacy,
and connection.

Site uses WordPress with The Events Calendar plugin for server-rendered HTML.
"""

from __future__ import annotations

import logging
from typing import Optional

from sources._tribe_events_html_base import HtmlTribeConfig, crawl_html_tribe

logger = logging.getLogger(__name__)

BASE_URL = "https://cbww.org"
EVENTS_URL = f"{BASE_URL}/events/"

PLACE_DATA = {
    "name": "Center for Black Women's Wellness",
    "slug": "center-black-womens-wellness",
    "address": "477 Windsor St SW, Suite 309",
    "neighborhood": "Pittsburgh",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7359,
    "lng": -84.4020,
    "place_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
}


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    text = f"{title} {description}".lower()
    tags = ["wellness", "community-health", "women", "community"]

    if any(
        kw in text
        for kw in [
            "yoga",
            "meditation",
            "fitness",
            "exercise",
            "pilates",
            "zumba",
            "dance",
            "movement class",
            "wellness class",
            "mindfulness",
        ]
    ):
        tags.extend(["fitness", "mind-body", "wellness-class"])
        return "wellness", "fitness", tags

    if any(
        kw in text
        for kw in [
            "workshop",
            "health education",
            "seminar",
            "class",
            "training",
            "webinar",
            "learn",
            "presentation",
        ]
    ):
        tags.extend(["education", "workshop", "educational"])
        return "learning", "workshop", tags

    if any(
        kw in text
        for kw in [
            "conference",
            "summit",
            "symposium",
            "annual conference",
            "wellness conference",
        ]
    ):
        tags.extend(["conference", "professional", "networking"])
        return "learning", "conference", tags

    if any(
        kw in text
        for kw in [
            "support group",
            "support circle",
            "healing circle",
            "women's circle",
            "sister circle",
            "peer support",
        ]
    ):
        tags.extend(["support-group", "mental-health", "community"])
        return "wellness", "support_group", tags

    if any(
        kw in text
        for kw in [
            "health screening",
            "health fair",
            "community health",
            "nutrition",
            "chronic disease",
            "diabetes",
            "heart health",
        ]
    ):
        tags.extend(["health", "screening", "prevention"])
        return "wellness", "health_program", tags

    if any(
        kw in text
        for kw in [
            "advocacy",
            "awareness",
            "health equity",
            "policy",
            "awareness month",
            "awareness campaign",
            "legislative",
        ]
    ):
        tags.extend(["advocacy", "awareness", "health-equity"])
        return "community", "advocacy", tags

    if any(
        kw in text
        for kw in [
            "community",
            "social",
            "celebration",
            "gathering",
            "mixer",
            "networking",
            "community event",
        ]
    ):
        tags.extend(["community-event", "social", "networking"])
        return "community", "social", tags

    if any(
        kw in text
        for kw in ["fundraiser", "benefit", "gala", "auction", "fundraising"]
    ):
        tags.extend(["fundraiser", "community-event"])
        return "community", "fundraiser", tags

    tags.append("educational")
    return "wellness", "educational", tags


_CONFIG = HtmlTribeConfig(
    events_url=EVENTS_URL,
    place_data=PLACE_DATA,
    categorize_event=categorize_event,
)


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_html_tribe(source, _CONFIG)
