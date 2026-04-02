"""
Crawler for Brain Injury Association of Georgia (braininjurygeorgia.org).

The Brain Injury Association of Georgia provides support, education, and
advocacy for individuals with brain injuries and their families.

Site uses WordPress with The Events Calendar plugin for server-rendered HTML.
"""

from __future__ import annotations

import logging
from typing import Optional

from sources._tribe_events_html_base import HtmlTribeConfig, crawl_html_tribe

logger = logging.getLogger(__name__)

BASE_URL = "https://www.braininjurygeorgia.org"
EVENTS_URL = "https://www.braininjurygeorgia.org/find-a-support-group.html"

PLACE_DATA = {
    "name": "Brain Injury Association of Georgia",
    "slug": "brain-injury-association-georgia",
    "address": "1441 Clifton Rd NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30322",
    "lat": 33.7953,
    "lng": -84.3231,
    "place_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
}


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    text = f"{title} {description}".lower()
    tags = ["brain-injury", "community", "support"]

    if any(
        kw in text
        for kw in [
            "support group",
            "survivor support",
            "caregiver support",
            "family support",
            "peer support",
            "tbi support",
        ]
    ):
        tags.extend(["support-group", "mental-health", "caregiving"])
        return "wellness", "support_group", tags

    if any(
        kw in text
        for kw in [
            "conference",
            "annual conference",
            "summit",
            "symposium",
            "statewide conference",
        ]
    ):
        tags.extend(["conference", "professional", "networking"])
        return "learning", "conference", tags

    if any(
        kw in text
        for kw in [
            "workshop",
            "training",
            "seminar",
            "class",
            "webinar",
            "education",
            "learn",
            "presentation",
        ]
    ):
        tags.extend(["education", "workshop", "educational"])
        return "learning", "workshop", tags

    if any(
        kw in text
        for kw in [
            "awareness",
            "advocacy",
            "brain injury awareness month",
            "awareness walk",
            "awareness campaign",
            "legislative",
        ]
    ):
        tags.extend(["advocacy", "awareness", "education"])
        return "community", "advocacy", tags

    if any(
        kw in text
        for kw in [
            "caregiver",
            "caregiver training",
            "family training",
            "caregiver resources",
            "respite",
        ]
    ):
        tags.extend(["caregiving", "family", "education"])
        return "learning", "workshop", tags

    if any(
        kw in text
        for kw in [
            "community",
            "social",
            "gathering",
            "celebration",
            "fundraiser",
            "benefit",
        ]
    ):
        tags.extend(["community-event", "social"])
        return "community", "social", tags

    tags.append("educational")
    return "community", "educational", tags


_CONFIG = HtmlTribeConfig(
    events_url=EVENTS_URL,
    place_data=PLACE_DATA,
    categorize_event=categorize_event,
)


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_html_tribe(source, _CONFIG)
