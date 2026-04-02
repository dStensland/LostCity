"""
Crawler for Empowerline (empowerline.org/events/).

Empowerline is brought to you by the Aging and Independence Services Group
of the Atlanta Regional Commission (ARC), serving metro Atlanta seniors and
disabled adults.

Site uses The Events Calendar plugin with server-rendered HTML.
"""

from __future__ import annotations

import logging
from typing import Optional

from sources._tribe_events_html_base import HtmlTribeConfig, crawl_html_tribe

logger = logging.getLogger(__name__)

BASE_URL = "https://empowerline.org"
EVENTS_URL = f"{BASE_URL}/events/"

PLACE_DATA = {
    "name": "Empowerline",
    "slug": "empowerline",
    "address": "100 Edgewood Ave NE, Suite 1800",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7540,
    "lng": -84.3866,
    "place_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
}


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    text = f"{title} {description}".lower()
    tags = ["empowerline", "seniors", "community"]

    if any(
        kw in text
        for kw in [
            "support group",
            "caregiver support",
            "dementia support",
            "alzheimer",
            "parkinson",
            "grief support",
            "bereavement",
        ]
    ):
        tags.extend(["support-group", "mental-health", "caregiving"])
        return "wellness", "support_group", tags

    if any(
        kw in text
        for kw in [
            "volunteer",
            "one2one",
            "telephone reassurance",
            "volunteer training",
            "community service",
        ]
    ):
        tags.extend(["volunteer", "service", "community-service"])
        return "community", "volunteer", tags

    if any(
        kw in text
        for kw in [
            "chronic disease",
            "diabetes",
            "arthritis",
            "heart disease",
            "wellness",
            "health management",
            "nutrition",
            "exercise",
            "fall prevention",
            "medication management",
        ]
    ):
        tags.extend(["health", "wellness", "chronic-disease"])
        return "wellness", "health_program", tags

    if any(
        kw in text
        for kw in [
            "workshop",
            "training",
            "seminar",
            "class",
            "education",
            "learn",
            "lecture",
            "presentation",
        ]
    ):
        tags.extend(["education", "workshop"])
        return "learning", "workshop", tags

    if any(
        kw in text
        for kw in [
            "legal",
            "medicare",
            "medicaid",
            "benefits",
            "insurance",
            "social security",
            "estate planning",
            "advance directives",
        ]
    ):
        tags.extend(["legal", "benefits", "advocacy"])
        return "learning", "legal_assistance", tags

    if any(
        kw in text
        for kw in [
            "social",
            "recreation",
            "activities",
            "arts and crafts",
            "games",
            "music",
            "entertainment",
        ]
    ):
        tags.extend(["social", "recreation"])
        return "community", "social", tags

    tags.append("education")
    return "community", "educational", tags


_CONFIG = HtmlTribeConfig(
    events_url=EVENTS_URL,
    place_data=PLACE_DATA,
    categorize_event=categorize_event,
    free_markers=("$", "cost", "fee", "price"),
)


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_html_tribe(source, _CONFIG)
