"""
Crawler for Georgia Council on Substance Abuse (gc4recovery.org).

The Georgia Council on Substance Abuse is a statewide advocacy organization
dedicated to prevention, treatment, and recovery support services.

Site uses WordPress with The Events Calendar plugin for server-rendered HTML.
"""

from __future__ import annotations

import logging
from typing import Optional

from sources._tribe_events_html_base import HtmlTribeConfig, crawl_html_tribe

logger = logging.getLogger(__name__)

BASE_URL = "https://gc4recovery.org"
EVENTS_URL = "https://gc4recovery.org/"

PLACE_DATA = {
    "name": "Georgia Council on Substance Abuse",
    "slug": "georgia-council-substance-abuse",
    "address": "3750 Habersham Ln NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8464,
    "lng": -84.3821,
    "place_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
}


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    text = f"{title} {description}".lower()
    tags = ["recovery", "substance-abuse", "community"]

    if any(
        kw in text
        for kw in [
            "peer support",
            "support group",
            "recovery support",
            "peer specialist",
            "peer certification",
            "recovery coaching",
        ]
    ):
        tags.extend(["peer-support", "support-group", "mental-health"])
        return "wellness", "support_group", tags

    if any(
        kw in text
        for kw in [
            "training",
            "certification",
            "ceu",
            "professional development",
            "credential",
            "ethics training",
            "cpss",
            "crps",
        ]
    ):
        tags.extend(["professional-development", "training", "certification"])
        return "learning", "workshop", tags

    if any(
        kw in text
        for kw in [
            "conference",
            "summit",
            "symposium",
            "annual meeting",
            "statewide gathering",
        ]
    ):
        tags.extend(["conference", "professional", "networking"])
        return "learning", "conference", tags

    if any(
        kw in text
        for kw in [
            "advocacy",
            "awareness",
            "rally",
            "recovery month",
            "prevention",
            "policy",
            "legislative",
        ]
    ):
        tags.extend(["advocacy", "awareness", "policy"])
        return "community", "advocacy", tags

    if any(
        kw in text
        for kw in [
            "workshop",
            "seminar",
            "class",
            "education",
            "learn",
            "presentation",
            "webinar",
        ]
    ):
        tags.extend(["education", "workshop"])
        return "learning", "workshop", tags

    if any(
        kw in text
        for kw in [
            "community",
            "celebration",
            "recovery celebration",
            "community gathering",
            "social",
        ]
    ):
        tags.extend(["community-event", "celebration"])
        return "community", "social", tags

    tags.append("education")
    return "community", "educational", tags


_CONFIG = HtmlTribeConfig(
    events_url=EVENTS_URL,
    place_data=PLACE_DATA,
    categorize_event=categorize_event,
)


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_html_tribe(source, _CONFIG)
