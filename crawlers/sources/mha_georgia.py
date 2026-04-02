"""
Crawler for Mental Health America of Georgia (mhageorgia.org).

Mental health nonprofit providing advocacy, education, and support services.
Events include LEAP workshops for youth (16-26), Mental Health First Aid
trainings, OWL maternal mental health programs, and advocacy events.

Uses The Events Calendar WordPress plugin with REST API.
"""

from __future__ import annotations

import logging
from typing import Optional

from sources._tribe_events_base import TribeConfig, crawl_tribe

logger = logging.getLogger(__name__)

BASE_URL = "https://www.mhageorgia.org"

PLACE_DATA = {
    "name": "Mental Health America of Georgia",
    "slug": "mha-georgia",
    "address": "100 Edgewood Ave NE Suite 502",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7539,
    "lng": -84.3796,
    "place_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["mental-health", "education", "advocacy"],
}

SKIP_KEYWORDS = [
    "staff meeting",
    "board meeting",
    "committee",
    "internal",
    "closed",
    "private",
]

LEAP_KEYWORDS = [
    "leap",
    "networking",
    "workplace",
    "financial literacy",
    "independence",
    "mental health basics",
]

TRAINING_KEYWORDS = [
    "mental health first aid",
    "mhfa",
    "certification",
    "training",
]

MATERNAL_KEYWORDS = [
    "owl",
    "maternal",
    "pregnancy",
    "postpartum",
    "perinatal",
]

ADVOCACY_KEYWORDS = [
    "advocacy",
    "awareness",
    "campaign",
    "policy",
    "legislative",
]

VIRTUAL_KEYWORDS = [
    "zoom",
    "virtual",
    "online",
    "webinar",
]


def determine_category_and_tags(
    title: str, description: str, cost_str: str = ""
) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["mental-health", "nonprofit"]

    if any(kw in text for kw in VIRTUAL_KEYWORDS):
        tags.append("virtual")

    if "free" in text or "no cost" in text or (cost_str and cost_str.lower() == "free"):
        tags.append("free")

    if any(kw in text for kw in LEAP_KEYWORDS):
        tags.extend(["education", "workshop", "youth"])
        return "learning", "workshop", tags

    if any(kw in text for kw in TRAINING_KEYWORDS):
        tags.extend(["certification", "training", "education"])
        return "learning", "training", tags

    if any(kw in text for kw in MATERNAL_KEYWORDS):
        tags.extend(["maternal-health", "support"])
        return "wellness", None, tags

    if any(kw in text for kw in ADVOCACY_KEYWORDS):
        tags.append("advocacy")
        return "community", "advocacy", tags

    if any(kw in text for kw in ["workshop", "class", "training", "orientation"]):
        tags.extend(["education", "workshop"])
        return "learning", "workshop", tags

    if any(kw in text for kw in ["support group", "peer support", "group therapy"]):
        tags.append("support")
        return "wellness", "support", tags

    if any(kw in text for kw in ["fundraiser", "gala", "benefit"]):
        tags.append("fundraiser")
        return "community", "fundraiser", tags

    return "wellness", None, tags


def is_public_event(title: str, description: str) -> bool:
    """Determine if event is public vs. internal."""
    text = f"{title} {description}".lower()
    return not any(kw in text for kw in SKIP_KEYWORDS)


def _transform_mha_record(raw_event: dict, record: dict) -> Optional[dict]:
    title = record.get("title", "")
    description = record.get("description") or ""

    if not is_public_event(title, description):
        return None

    category, subcategory, tags = determine_category_and_tags(
        title,
        description,
        raw_event.get("cost") or "",
    )

    is_free = record.get("is_free", False) or "free" in tags
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
    record_transform=_transform_mha_record,
)


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_tribe(source, _CONFIG)
