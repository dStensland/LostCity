"""
Crawler for BlazeSports America (blazesports.org).

BlazeSports publishes events via The Events Calendar. The official JSON API
includes recurring instances directly, along with structured venue, image, and
category data. This crawler uses the shared Tribe connector so adaptive sports
programs stay on the common pagination/dedupe/runtime path.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Optional

from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    remove_stale_source_events,
)
from dedupe import generate_content_hash
from sources._tribe_events_base import TribeConfig, crawl_tribe

logger = logging.getLogger(__name__)

BASE_URL = "https://blazesports.org"
HORIZON_DAYS = 120

DEFAULT_PLACE_DATA = {
    "name": "BlazeSports America",
    "slug": "blazesports-america",
    "address": "1670 Oakbrook Dr, Suite 331",
    "neighborhood": "Norcross",
    "city": "Norcross",
    "state": "GA",
    "zip": "30093",
    "place_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "description": "Adaptive sports organization serving metro Atlanta.",
}


def _text_from_html(value: str) -> str:
    return " ".join(BeautifulSoup(value or "", "html.parser").get_text(" ").split())


def _extract_price_range(cost_text: str) -> tuple[Optional[float], Optional[float], bool]:
    if not cost_text:
        return None, None, False

    text = cost_text.strip()
    if text.lower() == "free":
        return 0.0, 0.0, True

    prices: list[float] = []
    for token in text.replace("$", " $").split():
        if token.startswith("$"):
            try:
                prices.append(float(token[1:].replace(",", "")))
            except ValueError:
                continue

    if not prices:
        return None, None, False

    return min(prices), max(prices), all(price == 0 for price in prices)


def build_venue_data(api_venue: dict | None) -> dict:
    if not api_venue:
        return dict(DEFAULT_PLACE_DATA)

    city = api_venue.get("city") or ""
    return {
        "name": api_venue.get("venue") or "BlazeSports America",
        "slug": api_venue.get("slug") or "blazesports-america",
        "address": api_venue.get("address") or "",
        "neighborhood": city or "Metro Atlanta",
        "city": city or "Atlanta",
        "state": api_venue.get("state") or "GA",
        "zip": api_venue.get("zip") or "",
        "place_type": "fitness_center",
        "spot_type": "fitness",
        "website": api_venue.get("url") or BASE_URL,
        "description": "Venue hosting BlazeSports adaptive sports programming.",
    }


def categorize_event(title: str, description: str, category_slugs: list[str]) -> tuple[str, str, list[str]]:
    text = f"{title} {description}".lower()
    tags = ["adaptive-sports", "accessible", "family-friendly"]

    for slug in category_slugs:
        if slug and slug not in tags:
            tags.append(slug)

    if "veteran" in text:
        tags.append("veterans")

    if "wheelchair" in text:
        tags.append("wheelchair-sports")

    if any(slug in category_slugs for slug in ("yoga", "crossfit", "water-aerobics")):
        tags.append("community")
        return "fitness", "adaptive_fitness", tags

    if any(slug in category_slugs for slug in ("swimming", "learn-to-swim", "swim")) or "swim" in text:
        tags.append("swimming")
        return "sports", "swimming", tags

    if "rowing" in category_slugs or "rowing" in text:
        tags.append("rowing")
        return "sports", "rowing", tags

    if "bowling" in category_slugs or "bowling" in text:
        tags.append("bowling")
        return "sports", "bowling", tags

    if "track" in text or "field" in text:
        tags.append("track-and-field")
        return "sports", "track_field", tags

    if "basketball" in text or "ballers" in text:
        tags.append("basketball")
        return "sports", "basketball", tags

    if "archery" in text:
        tags.append("archery")
        return "sports", "archery", tags

    if "indoor sports" in text:
        tags.append("multi-sport")
        return "sports", "pickup_sports", tags

    if "train" in text or "clinic" in text or "camp" in text:
        tags.append("training")
        return "sports", "training", tags

    tags.append("community")
    return "sports", "adaptive_sports", tags


def _transform_blazesports_record(raw_event: dict, record: dict) -> Optional[dict]:
    description = _text_from_html(raw_event.get("description") or "")
    category_slugs = [
        category.get("slug")
        for category in (raw_event.get("categories") or [])
        if category.get("slug")
    ]
    category, subcategory, tags = categorize_event(
        record.get("title", ""),
        description,
        category_slugs,
    )
    price_min, price_max, is_free = _extract_price_range(raw_event.get("cost") or "")

    record["description"] = description
    record["category"] = category
    record["subcategory"] = subcategory
    record["tags"] = tags
    record["price_min"] = price_min
    record["price_max"] = price_max
    record["is_free"] = is_free
    record["price_note"] = raw_event.get("cost") or None
    record["ticket_url"] = raw_event.get("website") or record.get("source_url") or BASE_URL
    record["image_url"] = ((raw_event.get("image") or {}).get("url") or None)
    record["raw_text"] = description
    record["extraction_confidence"] = 0.97

    # Preserve the pre-connector hash strategy so this migration reconciles
    # onto existing BlazeSports rows instead of churning the whole source.
    venue_data = build_venue_data(raw_event.get("venue"))
    record["content_hash"] = generate_content_hash(
        record.get("title", ""),
        venue_data["name"],
        record.get("start_date", ""),
    )
    return record


def parse_api_event(event: dict) -> Optional[dict]:
    title = (event.get("title") or "").strip()
    if not title or not event.get("start_date"):
        return None

    record = {
        "title": title,
        "description": None,
        "start_date": str(event.get("start_date", "")).split(" ")[0],
        "start_time": str(event.get("start_date", "")).split(" ")[1][:5],
        "end_time": (str(event.get("end_date", "")).split(" ")[1][:5] if event.get("end_date") else None),
        "is_free": False,
        "price_min": None,
        "price_max": None,
        "source_url": event.get("url") or BASE_URL,
    }
    transformed = _transform_blazesports_record(event, record)
    if transformed is None:
        return None
    transformed["venue_data"] = build_venue_data(event.get("venue"))
    return transformed


def _resolve_venue(raw_event: dict, default_venue_id: int, default_venue_name: str) -> tuple[int, str]:
    venue_data = build_venue_data(raw_event.get("venue"))
    venue_id = get_or_create_place(venue_data)
    return venue_id, venue_data["name"]


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    config = TribeConfig(
        base_url=BASE_URL,
        place_data=DEFAULT_PLACE_DATA,
        default_category="sports",
        default_tags=["adaptive-sports", "accessible", "family-friendly"],
        page_size=50,
        extra_query_params={
            "end_date": f"{(date.today() + timedelta(days=HORIZON_DAYS)).isoformat()} 23:59:59",
        },
        record_transform=_transform_blazesports_record,
        place_resolver=_resolve_venue,
        existing_record_lookup=find_existing_event_for_insert,
        post_crawl_hook=lambda current_hashes: remove_stale_source_events(
            source_id, current_hashes
        ),
    )
    return crawl_tribe(source, config)
