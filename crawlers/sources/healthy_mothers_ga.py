"""
Crawler for Healthy Mothers Healthy Babies Coalition of Georgia (hmhbga.org).

Healthy Mothers Healthy Babies Coalition of Georgia works to improve maternal
and infant health outcomes through education, advocacy, and community programs.

Site uses WordPress with The Events Calendar plugin for server-rendered HTML.
"""

from __future__ import annotations

import logging
from typing import Optional

from sources._tribe_events_html_base import HtmlTribeConfig, crawl_html_tribe

logger = logging.getLogger(__name__)

BASE_URL = "https://hmhbga.org"
EVENTS_URL = f"{BASE_URL}/events/"

PLACE_DATA = {
    "name": "Healthy Mothers Healthy Babies Coalition of Georgia",
    "slug": "healthy-mothers-healthy-babies-ga",
    "address": "2300 Henderson Mill Rd NE, Suite 300",
    "neighborhood": "Tucker",
    "city": "Tucker",
    "state": "GA",
    "zip": "30345",
    "lat": 33.8437,
    "lng": -84.2667,
    "place_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
}


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    text = f"{title} {description}".lower()
    tags = ["maternal-health", "family-friendly", "community"]

    if any(
        kw in text
        for kw in [
            "prenatal",
            "postpartum",
            "pregnancy",
            "expecting",
            "new mom",
            "new parent",
            "support group",
            "moms group",
        ]
    ):
        tags.extend(["prenatal", "postpartum", "support-group"])
        return "wellness", "support_group", tags

    if any(
        kw in text
        for kw in [
            "breastfeeding",
            "lactation",
            "nursing",
            "breastfeed",
            "breast feeding",
            "la leche",
        ]
    ):
        tags.extend(["breastfeeding", "postpartum", "education"])
        return "wellness", "health_program", tags

    if any(
        kw in text
        for kw in [
            "workshop",
            "class",
            "training",
            "education",
            "seminar",
            "webinar",
            "learn",
            "childbirth",
        ]
    ):
        tags.extend(["education", "workshop", "parenting"])
        return "learning", "workshop", tags

    if any(
        kw in text
        for kw in [
            "baby shower",
            "resource fair",
            "health fair",
            "baby fair",
            "community shower",
            "diaper drive",
        ]
    ):
        tags.extend(["resource-fair", "community-event", "families"])
        return "community", "fair", tags

    if any(
        kw in text
        for kw in [
            "health screening",
            "wellness",
            "nutrition",
            "health education",
            "community health",
            "prenatal care",
        ]
    ):
        tags.extend(["health", "wellness", "screening"])
        return "wellness", "health_program", tags

    if any(
        kw in text
        for kw in [
            "advocacy",
            "awareness",
            "maternal health week",
            "awareness month",
            "policy",
            "legislative",
        ]
    ):
        tags.extend(["advocacy", "awareness", "education"])
        return "community", "advocacy", tags

    if any(
        kw in text
        for kw in ["community", "social", "celebration", "gathering", "fundraiser", "benefit"]
    ):
        tags.extend(["community-event", "social"])
        return "community", "social", tags

    tags.append("educational")
    return "wellness", "educational", tags


_CONFIG = HtmlTribeConfig(
    events_url=EVENTS_URL,
    place_data=PLACE_DATA,
    categorize_event=categorize_event,
)


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_html_tribe(source, _CONFIG)
