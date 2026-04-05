"""
Crawler for NAMI Georgia (namiga.org).

National Alliance on Mental Illness - Georgia chapter. Events include support
groups, training sessions, volunteer orientations, advocacy events, and mental
health education.

Uses The Events Calendar WordPress plugin with REST API.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional

from sources._tribe_events_base import TribeConfig, crawl_tribe

logger = logging.getLogger(__name__)

BASE_URL = "https://namiga.org"

PLACE_DATA = {
    "name": "NAMI Georgia",
    "slug": "nami-georgia",
    "address": "4120 Presidential Parkway Ste 200",
    "neighborhood": "Chamblee",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30340",
    "lat": 33.8839,
    "lng": -84.2943,
    "place_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["mental-health", "support", "education"],
}

SKIP_KEYWORDS = [
    "staff meeting",
    "board meeting",
    "committee",
    "internal",
    "closed",
    "private",
    "executive",
]

TRAINING_KEYWORDS = [
    "training",
    "orientation",
    "workshop",
    "class",
    "education",
    "learning",
    "certification",
    "course",
]

SUPPORT_KEYWORDS = [
    "support group",
    "peer support",
    "family support",
    "caregiver",
    "group meeting",
]

VOLUNTEER_KEYWORDS = [
    "volunteer",
    "volunteering",
    "orientation",
]

ADVOCACY_KEYWORDS = [
    "advocacy",
    "rally",
    "awareness",
    "campaign",
    "lobby",
]


def determine_category_and_tags(
    title: str, description: str
) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["mental-health", "nonprofit"]

    if any(kw in text for kw in TRAINING_KEYWORDS):
        tags.extend(["education", "training"])
        return "learning", "workshop", tags

    if any(kw in text for kw in SUPPORT_KEYWORDS):
        tags.extend(["support-group", "free"])
        return "wellness", None, tags

    if any(kw in text for kw in VOLUNTEER_KEYWORDS):
        tags.append("volunteer")
        return "community", "volunteer", tags

    if any(kw in text for kw in ADVOCACY_KEYWORDS):
        tags.append("advocacy")
        return "community", None, tags

    if any(kw in text for kw in ["family", "families", "caregiver"]):
        tags.append("family-support")
    if any(kw in text for kw in ["youth", "teen", "young adult", "adolescent"]):
        tags.append("youth")
    if any(kw in text for kw in ["peer", "peers"]):
        tags.append("peer-support")
    if any(kw in text for kw in ["crisis", "hotline", "emergency"]):
        tags.append("crisis-support")
    if any(kw in text for kw in ["wellness", "recovery", "health"]):
        tags.append("wellness")

    return "wellness", None, tags


def is_public_event(title: str, description: str) -> bool:
    """Determine if event is public vs. internal."""
    text = f"{title} {description}".lower()
    return not any(kw in text for kw in SKIP_KEYWORDS)


def _transform_nami_record(raw_event: dict, record: dict) -> Optional[dict]:
    title = record.get("title", "")
    description = record.get("description") or ""

    if not is_public_event(title, description):
        return None

    start_date = record.get("start_date")
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
            if (start_dt - date.today()).days > 270:
                return None
        except ValueError:
            pass

    category, subcategory, tags = determine_category_and_tags(title, description)
    text = f"{title} {description}".lower()
    is_free = record.get("is_free", False) or any(
        marker in text for marker in ("free", "no cost", "complimentary")
    )
    if (
        "support-group" in tags
        and not record.get("price_min")
        and not record.get("price_max")
    ):
        is_free = True

    record["category"] = category
    record["subcategory"] = subcategory
    record["tags"] = tags
    record["is_free"] = is_free
    record["price_min"] = 0.0 if is_free else record.get("price_min")
    record["price_max"] = 0.0 if is_free else record.get("price_max")
    record["ticket_url"] = record.get("source_url")
    record["extraction_confidence"] = 0.9
    return record


_CONFIG = TribeConfig(
    base_url=BASE_URL,
    place_data=PLACE_DATA,
    default_category="wellness",
    default_tags=["mental-health", "nonprofit"],
    page_size=50,
    record_transform=_transform_nami_record,
)


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_tribe(source, _CONFIG)
