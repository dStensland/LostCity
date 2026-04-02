"""
Crawler for Park Pride (parkpride.org).

Atlanta nonprofit supporting parks and greenspaces. Events include park cleanups,
community garden workdays, tree plantings, and park improvement projects.

Uses The Events Calendar WordPress plugin with REST API.
Each event includes a venue object with the specific park name and address — we
create a separate venue record per park so events appear at the right location.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    remove_stale_source_events,
)
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from sources._tribe_events_base import TribeConfig, crawl_tribe

logger = logging.getLogger(__name__)

BASE_URL = "https://parkpride.org"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

# Fallback venue used only when an event has no venue data from the API
FALLBACK_VENUE_DATA = {
    "name": "Park Pride",
    "slug": "park-pride",
    "address": "233 Peachtree St NE #900",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7590,
    "lng": -84.3880,
    "place_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "outdoors", "family-friendly"],
}

# Skip internal/non-public events
SKIP_KEYWORDS = [
    "staff meeting",
    "board meeting",
    "committee",
    "internal",
    "closed",
    "private",
]

VOLUNTEER_KEYWORDS = [
    "volunteer",
    "cleanup",
    "workday",
    "planting",
    "tree",
    "garden",
    "park",
    "community",
]

# Known Atlanta neighborhoods by park name keywords — used to set neighborhood field
PARK_NEIGHBORHOODS = {
    "brownwood": "East Atlanta Village",
    "lionel hampton": "Vine City",
    "murphey candler": "Brookhaven",
    "piedmont": "Midtown",
    "grant park": "Grant Park",
    "inman park": "Inman Park",
    "freedom park": "Candler Park",
    "candler park": "Candler Park",
    "kirkwood": "Kirkwood",
    "beltline": "Old Fourth Ward",
    "old fourth ward": "Old Fourth Ward",
    "eastside trail": "Old Fourth Ward",
    "westside": "West End",
    "ponce de leon": "Poncey-Highland",
    "olmsted": "Midtown",
    "tanyard creek": "Buckhead",
    "chastain": "Buckhead",
    "morningside": "Virginia-Highland",
    "lenox": "Buckhead",
}
def get_neighborhood_for_park(park_name: str) -> Optional[str]:
    """Infer Atlanta neighborhood from park name keywords."""
    name_lower = park_name.lower()
    for keyword, neighborhood in PARK_NEIGHBORHOODS.items():
        if keyword in name_lower:
            return neighborhood
    return None


def build_venue_from_api(place_data: dict) -> Optional[dict]:
    """
    Build a venue dict from the Tribe Events API venue object.
    Returns None if the venue object is empty or missing a name.
    """
    if not isinstance(place_data, dict):
        return None

    park_name = (place_data.get("venue") or "").strip()
    if not park_name:
        return None

    address = (place_data.get("address") or "").strip()
    city = (place_data.get("city") or "Atlanta").strip()
    state = (place_data.get("state") or place_data.get("stateprovince") or "GA").strip()
    zip_code = (place_data.get("zip") or "").strip()

    # Build slug from park name
    slug = re.sub(r"[^a-z0-9]+", "-", park_name.lower()).strip("-")

    neighborhood = get_neighborhood_for_park(park_name)

    return {
        "name": park_name,
        "slug": slug,
        "address": address or None,
        "neighborhood": neighborhood,
        "city": city,
        "state": state,
        "zip": zip_code or None,
        "place_type": "park",
        "spot_type": "park",
        "website": None,
    }


def _build_destination_envelope(place_data: dict, venue_id: int) -> TypedEntityEnvelope | None:
    venue_type = str(place_data.get("place_type") or place_data.get("place_type") or "").strip().lower()
    if venue_type != "park":
        return None

    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "park",
            "commitment_tier": "halfday",
            "primary_activity": "family park visit",
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["outdoor", "free-option", "family-daytrip"],
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Open park access is typically free; check event-specific pages for volunteer projects, festivals, or special programming.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": venue_type,
                "city": str(place_data.get("city") or "atlanta").lower(),
                "supports_org": "park_pride",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "free-outdoor-play-space",
            "title": "Free outdoor play space",
            "feature_type": "amenity",
            "description": "This public park is a free outdoor option for family time, open-air play, and pairing with nearby neighborhood outings.",
            "url": BASE_URL,
            "price_note": "Open park access is typically free.",
            "is_free": True,
            "sort_order": 10,
        },
    )
    return envelope


def determine_category_and_tags(
    title: str, description: str
) -> tuple[str, Optional[str], list[str]]:
    """Determine category/subcategory/tags from event title and description."""
    text = f"{title} {description}".lower()
    tags = ["volunteer", "nonprofit", "parks", "outdoors", "environment"]

    if any(kw in text for kw in VOLUNTEER_KEYWORDS):
        tags.append("volunteer-opportunity")

    if any(kw in text for kw in ["family", "kid", "children", "all ages"]):
        tags.append("family-friendly")

    if any(kw in text for kw in ["cleanup", "clean-up", "clean up"]):
        tags.append("cleanup")

    if any(kw in text for kw in ["garden", "gardening", "planting"]):
        tags.append("gardening")

    if any(kw in text for kw in ["tree", "trees", "arbor"]):
        tags.append("trees")

    if any(kw in text for kw in ["trail", "path", "greenway", "beltline"]):
        tags.append("trails")

    if any(kw in text for kw in ["training", "orientation", "workshop", "class"]):
        return "learning", "workshop", tags + ["education"]

    if any(kw in text for kw in ["fundraiser", "gala", "benefit"]):
        return "community", "fundraiser", tags + ["fundraiser"]

    if any(kw in text for kw in ["walk", "hike", "nature walk"]):
        return "community", "outdoor", tags + ["walking"]

    return "community", "volunteer", tags


def is_public_event(title: str, description: str) -> bool:
    """Return False for internal/non-public events."""
    text = f"{title} {description}".lower()
    return not any(kw in text for kw in SKIP_KEYWORDS)

def _resolve_park_venue(
    raw_event: dict, fallback_venue_id: int, fallback_venue_name: str
) -> tuple[int, str]:
    api_venue = raw_event.get("venue")
    if not api_venue:
        return fallback_venue_id, fallback_venue_name

    venue_dict = build_venue_from_api(api_venue)
    if not venue_dict:
        return fallback_venue_id, fallback_venue_name

    venue_id = get_or_create_place(venue_dict)
    destination_envelope = _build_destination_envelope(venue_dict, venue_id)
    if destination_envelope is not None:
        persist_typed_entity_envelope(destination_envelope)
    return venue_id, venue_dict["name"]


def _transform_park_pride_record(raw_event: dict, record: dict) -> Optional[dict]:
    title = record.get("title", "")
    description = record.get("description") or ""

    if not is_public_event(title, description):
        return None

    category, subcategory, tags = determine_category_and_tags(title, description)
    cost = (raw_event.get("cost") or "").strip()
    venue_dict = build_venue_from_api(raw_event.get("venue")) or FALLBACK_VENUE_DATA
    image_url = None
    img = raw_event.get("image")
    if isinstance(img, dict):
        sizes = img.get("sizes", {})
        image_url = (
            sizes.get("large", {}).get("url")
            or sizes.get("slide", {}).get("url")
            or img.get("url")
        )

    record["category"] = category
    record["subcategory"] = subcategory
    record["tags"] = tags
    record["is_free"] = not cost or "free" in cost.lower()
    record["ticket_url"] = record.get("source_url")
    record["image_url"] = image_url
    record["raw_text"] = f"{title} {description}"[:500]
    record["extraction_confidence"] = 0.92
    record["content_hash"] = generate_content_hash(
        title,
        venue_dict["name"],
        record.get("start_date", ""),
    )
    return record


def _build_park_pride_series_hint(raw_event: dict, record: dict) -> Optional[dict]:
    title = record.get("title", "")
    if not re.search(r"second friday|monthly|weekly", title, re.IGNORECASE):
        return None
    return {
        "series_type": "recurring_show",
        "series_title": re.sub(r"\s*@\s*.+$", "", title).strip(),
        "frequency": "monthly" if "second friday" in title.lower() else "irregular",
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Park Pride events using the shared Tribe Events REST connector."""
    source_id = source["id"]
    config = TribeConfig(
        base_url=BASE_URL,
        place_data=FALLBACK_VENUE_DATA,
        default_category="community",
        default_tags=["volunteer", "nonprofit", "parks", "outdoors", "environment"],
        page_size=50,
        extra_query_params={"status": "publish"},
        max_pages=10,
        record_transform=_transform_park_pride_record,
        series_hint_builder=_build_park_pride_series_hint,
        place_resolver=_resolve_park_venue,
        existing_record_lookup=find_existing_event_for_insert,
        post_crawl_hook=lambda current_hashes: remove_stale_source_events(
            source_id, current_hashes
        ),
    )
    return crawl_tribe(source, config)
