"""
Destination-first crawler for Community Grounds.

Community Grounds is a neighborhood coffee shop and explicit third-space venue
in South Atlanta. The site exposes stable destination metadata but no official
event calendar, so the venue itself is the product.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_place
from db.client import writes_enabled
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

HOMEPAGE = "https://communitygrounds.com/"
MENU_URL = "https://www.communitygrounds.com/order"
ORDER_URL = "https://www.clover.com/online-ordering/communitygrounds"
USER_AGENT = "Mozilla/5.0"

PLACE_DATA = {
    "name": "Community Grounds",
    "slug": "community-grounds",
    "address": "1297 McDonough Boulevard Southeast",
    "neighborhood": "South Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30315",
    "lat": 33.7189936,
    "lng": -84.385472,
    "place_type": "coffee_shop",
    "spot_type": "coffee_shop",
    "website": HOMEPAGE,
    "phone": "404-586-0692",
    "vibes": [
        "casual",
        "cozy",
    ],
}

DEFAULT_HOURS = {
    "monday": "07:30-17:00",
    "tuesday": "07:30-17:00",
    "wednesday": "07:30-17:00",
    "thursday": "07:30-17:00",
    "friday": "07:30-17:00",
    "saturday": "08:00-17:00",
    "sunday": "10:00-17:00",
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    destination_details=True,
    venue_features=True,
)


def _clean_text(value: str | None) -> str:
    text = re.sub(r"<[^>]+>", " ", value or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_jsonld_objects(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    rows: list[dict] = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = (tag.string or tag.get_text() or "").strip()
        if not raw:
            continue
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, list):
            rows.extend([row for row in parsed if isinstance(row, dict)])
        elif isinstance(parsed, dict):
            rows.append(parsed)
    return rows


def _extract_primary_image(html: str) -> Optional[str]:
    soup = BeautifulSoup(html, "lxml")

    meta = soup.find("meta", attrs={"property": "og:image"})
    if meta and meta.get("content"):
        return str(meta["content"]).strip()

    slideshow = soup.select_one("#slideshow img[data-image], #slideshow img[src]")
    if slideshow:
        return (
            str(
                slideshow.get("data-image")
                or slideshow.get("data-src")
                or slideshow.get("src")
                or ""
            ).strip()
            or None
        )

    image = soup.select_one("img[data-image], img[src]")
    if image:
        return (
            str(
                image.get("data-image")
                or image.get("data-src")
                or image.get("src")
                or ""
            ).strip()
            or None
        )

    return None


def _extract_description(jsonld_objects: list[dict], html: str) -> Optional[str]:
    for row in jsonld_objects:
        if str(row.get("@type") or "").lower() == "website":
            description = _clean_text(str(row.get("description") or ""))
            if description:
                return description[:500]

    match = re.search(r'"siteDescription":"(.*?)","location"', html)
    if match:
        description = _clean_text(
            match.group(1).encode("utf-8").decode("unicode_escape")
        )
        if description:
            return description[:500]

    return None


def _extract_hours(html: str) -> dict[str, str]:
    soup = BeautifulSoup(html, "lxml")
    hours_text = ""

    for heading in soup.find_all(["h2", "h3", "strong"]):
        if "our hours" not in heading.get_text(" ", strip=True).lower():
            continue
        parent = heading.parent
        if parent:
            hours_text = parent.get_text("\n", strip=True)
            sibling = parent.find_next("p")
            if sibling:
                hours_text += "\n" + sibling.get_text("\n", strip=True)
        break

    if not hours_text:
        return dict(DEFAULT_HOURS)

    hours: dict[str, str] = {}

    weekday_match = re.search(
        r"Monday\s*-\s*Friday.*?(\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(\d{1,2}:\d{2}\s*[ap]m)",
        hours_text,
        re.I | re.S,
    )
    if weekday_match:
        start, end = weekday_match.groups()
        for day in ("monday", "tuesday", "wednesday", "thursday", "friday"):
            hours[day] = _to_24_hour_range(start, end)

    for day in ("Saturday", "Sunday"):
        day_match = re.search(
            rf"{day}.*?(\d{{1,2}}:\d{{2}}\s*[ap]m)\s*-\s*(\d{{1,2}}:\d{{2}}\s*[ap]m)",
            hours_text,
            re.I | re.S,
        )
        if day_match:
            start, end = day_match.groups()
            hours[day.lower()] = _to_24_hour_range(start, end)

    return hours or dict(DEFAULT_HOURS)


def _to_24_hour_range(start: str, end: str) -> str:
    return f"{_to_24_hour(start)}-{_to_24_hour(end)}"


def _to_24_hour(value: str) -> str:
    match = re.search(r"(\d{1,2}):(\d{2})\s*([ap]m)", value.strip(), re.I)
    if not match:
        return value.strip()
    hour, minute, suffix = match.groups()
    hour_int = int(hour)
    if suffix.lower() == "pm" and hour_int != 12:
        hour_int += 12
    elif suffix.lower() == "am" and hour_int == 12:
        hour_int = 0
    return f"{hour_int:02d}:{minute}"


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "coffee_shop",
            "commitment_tier": "hour",
            "primary_activity": "Neighborhood coffee, conversation, and low-pressure daytime hanging out",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "coffee", "casual-hang", "daytime"],
            "best_time_of_day": "morning",
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "practical_notes": "Community Grounds explicitly positions itself as a positive third space for neighbors to gather, relax, and spend time together over coffee.",
            "fee_note": "Free entry; pay for drinks, pastries, and menu items.",
            "source_url": HOMEPAGE,
            "metadata": {
                "source_type": "venue_enrichment",
                "place_type": "coffee_shop",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "third-space-neighborhood-coffee-shop",
            "title": "Third-space neighborhood coffee shop",
            "feature_type": "experience",
            "description": "Community Grounds describes itself as a positive third space for neighbors, conversation, and fellowship in South Atlanta.",
            "url": HOMEPAGE,
            "is_free": True,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "coffee-pastries-and-daytime-hang",
            "title": "Coffee, pastries, and daytime hang",
            "feature_type": "amenity",
            "description": "The shop centers coffee service, pastries, and a casual daytime environment suited to low-pressure meetups and solo hangs.",
            "url": MENU_URL,
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "online-order-ahead",
            "title": "Online order-ahead",
            "feature_type": "amenity",
            "description": "Community Grounds offers official online ordering through Clover for pickup planning.",
            "url": ORDER_URL,
            "is_free": True,
            "sort_order": 30,
        },
    )
    return envelope


def crawl(source: dict) -> tuple[int, int, int]:
    """Refresh the Community Grounds destination record from the live homepage."""
    place_data = dict(PLACE_DATA)

    try:
        response = requests.get(
            HOMEPAGE,
            timeout=20,
            headers={"User-Agent": USER_AGENT},
        )
        response.raise_for_status()
        html = response.text

        jsonld_objects = _extract_jsonld_objects(html)
        description = _extract_description(jsonld_objects, html)
        image_url = _extract_primary_image(html)
        hours = _extract_hours(html)

        if description:
            place_data["description"] = description
        if image_url:
            place_data["image_url"] = image_url
        if hours:
            place_data["hours"] = hours
    except Exception as exc:
        logger.warning("Community Grounds: homepage enrichment failed: %s", exc)
        place_data["hours"] = dict(DEFAULT_HOURS)

    venue_id = get_or_create_place(place_data)
    if not venue_id:
        logger.warning("Community Grounds: failed to resolve place record")
        return 0, 0, 0

    persist_typed_entity_envelope(_build_destination_envelope(venue_id))

    update: dict = {}
    for key in ("description", "image_url", "hours", "phone"):
        if place_data.get(key):
            update[key] = place_data[key]
    if update and writes_enabled() and venue_id > 0:
        try:
            get_client().table("places").update(update).eq("id", venue_id).execute()
        except Exception as exc:
            logger.warning("Community Grounds: place update failed: %s", exc)

    logger.info(
        "Community Grounds: venue record enriched (destination-first, no events)"
    )
    return 0, 0, 0
