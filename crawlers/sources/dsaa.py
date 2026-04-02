"""
Crawler for Down Syndrome Association of Atlanta (dsaatl.org).

The Down Syndrome Association of Atlanta provides support, advocacy, and
education for individuals with Down syndrome and their families.

Site uses WordPress with The Events Calendar plugin for server-rendered HTML.
"""

from __future__ import annotations

import logging
from typing import Optional

from sources._tribe_events_html_base import HtmlTribeConfig, crawl_html_tribe

logger = logging.getLogger(__name__)

BASE_URL = "https://dsaatl.org"
EVENTS_URL = f"{BASE_URL}/events/"

PLACE_DATA = {
    "name": "Down Syndrome Association of Atlanta",
    "slug": "down-syndrome-association-atlanta",
    "address": "2221 Peachtree Rd NE, Suite D-330",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.8137,
    "lng": -84.3858,
    "place_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
}


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    text = f"{title} {description}".lower()
    tags = ["disability", "down-syndrome", "family-friendly", "community"]

    if any(
        kw in text
        for kw in [
            "support group",
            "parent support",
            "sibling support",
            "family support",
            "peer support",
            "parent meeting",
        ]
    ):
        tags.extend(["support-group", "parenting", "family"])
        return "wellness", "support_group", tags

    if any(
        kw in text
        for kw in [
            "buddy walk",
            "walk",
            "fundraiser",
            "gala",
            "auction",
            "benefit",
            "fundraising",
        ]
    ):
        tags.extend(["fundraiser", "outdoor", "family"])
        return "community", "fundraiser", tags

    if any(
        kw in text
        for kw in [
            "workshop",
            "seminar",
            "training",
            "education",
            "learn",
            "class",
            "presentation",
            "webinar",
        ]
    ):
        tags.extend(["education", "workshop", "learning"])
        return "learning", "workshop", tags

    if any(
        kw in text
        for kw in [
            "social",
            "playgroup",
            "game night",
            "party",
            "celebration",
            "gathering",
            "meetup",
            "picnic",
        ]
    ):
        tags.extend(["social", "recreation", "family"])
        return "community", "social", tags

    if any(
        kw in text
        for kw in [
            "advocacy",
            "awareness",
            "world down syndrome day",
            "awareness month",
            "legislative",
            "policy",
        ]
    ):
        tags.extend(["advocacy", "awareness", "education"])
        return "community", "advocacy", tags

    if any(
        kw in text
        for kw in [
            "program",
            "activity",
            "camp",
            "class",
            "club",
            "sports",
            "arts",
            "music",
            "dance",
        ]
    ):
        tags.extend(["recreation", "program", "youth"])
        return "community", "program", tags

    tags.append("social")
    return "community", "social", tags


_CONFIG = HtmlTribeConfig(
    events_url=EVENTS_URL,
    place_data=PLACE_DATA,
    categorize_event=categorize_event,
    free_markers=("$", "cost", "fee", "price", "ticket"),
)


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_html_tribe(source, _CONFIG)
