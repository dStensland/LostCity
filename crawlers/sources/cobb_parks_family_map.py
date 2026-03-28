"""
Official Cobb County family parks map importer.

Builds a broad family-use destination layer from Cobb County's official
"Find a Park" inventory and each park's detail page.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_place
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from utils import slugify

logger = logging.getLogger(__name__)

BASE_URL = "https://www.cobbcounty.gov"
PARKS_URL = f"{BASE_URL}/parks/find-park"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    destination_details=True,
    venue_features=True,
)

PLAYGROUND_SIGNAL_KEYWORDS = ("playground", "play area", "tot lot", "nature play")
WATER_PLAY_SIGNAL_KEYWORDS = (
    "splash",
    "sprayground",
    "spray ground",
    "water play",
    "aquatic",
    "pool",
)
TRAIL_SIGNAL_KEYWORDS = ("trail", "walking path", "greenway", "loop")
SPORTS_SIGNAL_KEYWORDS = ("baseball", "softball", "football", "soccer", "t-ball", "sports field")
PICNIC_SIGNAL_KEYWORDS = ("picnic", "pavilion", "shelter")
NATURE_SIGNAL_KEYWORDS = ("preserve", "wooded", "lake", "battlefield", "dog park", "archery", "outdoor space")


def _fetch(url: str) -> str:
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    return response.text


def _extract_detail_paths(listing_html: str) -> list[str]:
    paths: list[str] = []
    seen: set[str] = set()
    for href in re.findall(r'(/parks/find-park/[a-z0-9-]+)', listing_html):
        if href in seen:
            continue
        seen.add(href)
        paths.append(href)
    return paths


def _parse_next_data(page_html: str) -> dict:
    soup = BeautifulSoup(page_html, "html.parser")
    script = soup.find("script", id="__NEXT_DATA__")
    if not script or not script.string:
        raise ValueError("Missing __NEXT_DATA__ payload")
    return json.loads(script.string)


def _normalize_feature_lines(processed_html: str) -> list[str]:
    if not processed_html:
        return []
    soup = BeautifulSoup(processed_html, "html.parser")
    features: list[str] = []
    for li in soup.find_all("li"):
        text = " ".join(li.get_text(" ", strip=True).split())
        if text:
            features.append(text)
    return features


def _parse_park_page(page_html: str, page_url: str) -> dict:
    data = _parse_next_data(page_html)
    node = data["props"]["pageProps"]["nodeResource"]
    address = node.get("address") or {}
    sidebar = node.get("sidebarContent", {}) or {}

    return {
        "name": str(node.get("title") or "").strip(),
        "slug": slugify(str(node.get("title") or "").strip()),
        "url": page_url,
        "summary": str(node.get("summary") or "").strip(),
        "address": address.get("addressLine1"),
        "city": address.get("locality") or "Marietta",
        "state": address.get("administrativeArea") or "GA",
        "zip": address.get("postalCode"),
        "feature_lines": _normalize_feature_lines(str(sidebar.get("processed") or "")),
    }


def _venue_has_destination_details(client, venue_id: int) -> bool:
    result = (
        client.table("venue_destination_details")
        .select("venue_id")
        .eq("place_id", venue_id)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def _venue_has_feature_signal(client, venue_id: int, keywords: tuple[str, ...]) -> bool:
    result = (
        client.table("venue_features")
        .select("slug,title,description")
        .eq("place_id", venue_id)
        .eq("is_active", True)
        .execute()
    )
    for row in result.data or []:
        haystack = " ".join(
            [str(row.get("slug") or ""), str(row.get("title") or ""), str(row.get("description") or "")]
        ).lower()
        if any(keyword in haystack for keyword in keywords):
            return True
    return False


def _has_signal(feature_lines: list[str], pattern: str) -> bool:
    combined = " ".join(feature_lines).lower()
    return bool(re.search(pattern, combined))


def _signal_text(park: dict) -> str:
    return " ".join(
        part
        for part in [park.get("name"), park.get("summary"), *park.get("feature_lines", [])]
        if part
    ).lower()


def _build_venue_record(park: dict) -> dict:
    return {
        "name": park["name"],
        "slug": park["slug"],
        "address": park["address"],
        "city": park["city"],
        "state": park["state"],
        "zip": park["zip"],
        "place_type": "park",
        "spot_type": "park",
        "website": park["url"],
        "description": park["summary"] or None,
    }


def _fetch_existing_venue(client, park: dict) -> Optional[dict]:
    result = (
        client.table("places")
        .select("id,name,slug,address,city,state,zip,place_type,spot_type")
        .eq("slug", park["slug"])
        .limit(1)
        .execute()
    )
    if result.data:
        row = result.data[0]
        if park.get("address") and row.get("address") and row["address"] != park["address"]:
            pass
        elif park.get("city") and row.get("city") and row["city"].strip().lower() != park["city"].strip().lower():
            pass
        else:
            return row

    if park.get("address"):
        result = (
            client.table("places")
            .select("id,name,slug,address,city,state,zip,place_type,spot_type")
            .eq("address", park["address"])
            .limit(5)
            .execute()
        )
        for row in result.data or []:
            if (row.get("city") or "").strip().lower() == (park.get("city") or "").strip().lower():
                return row

    result = (
        client.table("places")
        .select("id,name,slug,address,city,state,zip,place_type,spot_type")
        .eq("name", park["name"])
        .limit(5)
        .execute()
    )
    for row in result.data or []:
        if (row.get("city") or "").strip().lower() == (park.get("city") or "").strip().lower():
            return row
    return None


def _maybe_patch_existing_venue(client, venue: dict, park: dict) -> dict:
    updates = {}
    for key in ("address", "city", "state", "zip"):
        if park.get(key) and not venue.get(key):
            updates[key] = park[key]
    if not updates:
        return venue
    client.table("places").update(updates).eq("id", venue["id"]).execute()
    venue.update(updates)
    return venue


def _build_envelope(
    park: dict,
    venue_id: int,
    *,
    add_destination_details: bool,
    add_playground_feature: bool,
    add_water_play_feature: bool,
    add_trail_feature: bool,
    add_sports_feature: bool,
    add_picnic_feature: bool,
    add_nature_feature: bool,
) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()

    if add_destination_details:
        envelope.add(
            "destination_details",
            {
                "place_id": venue_id,
                "destination_type": "park",
                "commitment_tier": "halfday",
                "primary_activity": "family park visit",
                "best_seasons": ["spring", "summer", "fall"],
                "weather_fit_tags": ["outdoor", "free-option", "family-daytrip"],
                "parking_type": "free_lot",
                "best_time_of_day": "morning",
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Open county park access is typically free; rentals or special facilities may vary by site.",
                "source_url": park["url"],
                "practical_notes": park["summary"] or None,
                "metadata": {
                    "source_type": "family_system_map",
                    "jurisdiction": "cobb-county",
                    "source_slug": "cobb-parks-family-map",
                    "feature_lines": park["feature_lines"],
                },
            },
        )

    if add_playground_feature:
        envelope.add(
            "venue_features",
            {
                "place_id": venue_id,
                "slug": "official-county-playground",
                "title": "Official county playground",
                "feature_type": "amenity",
                "description": f"Cobb County's official park page for {park['name']} lists playground access for family use.",
                "url": park["url"],
                "price_note": "Open park playground access is typically free.",
                "is_free": True,
                "sort_order": 15,
            },
        )

    if add_water_play_feature:
        envelope.add(
            "venue_features",
            {
                "place_id": venue_id,
                "slug": "official-county-water-play",
                "title": "Official county water play",
                "feature_type": "amenity",
                "description": f"Cobb County's official park page for {park['name']} lists pool, splash, or aquatics access for family warm-weather use.",
                "url": park["url"],
                "price_note": "Pool or splash access varies by county operating schedule.",
                "is_free": False,
                "sort_order": 25,
            },
        )

    if add_trail_feature:
        envelope.add(
            "venue_features",
            {
                "place_id": venue_id,
                "slug": "official-county-trails-and-walking-loops",
                "title": "Official county trails and walking loops",
                "feature_type": "amenity",
                "description": f"Cobb County's official park page for {park['name']} lists trails or walking paths suitable for easy family outings.",
                "url": park["url"],
                "price_note": "Open trail access is typically free.",
                "is_free": True,
                "sort_order": 35,
            },
        )

    if add_sports_feature:
        envelope.add(
            "venue_features",
            {
                "place_id": venue_id,
                "slug": "official-county-youth-sports-fields",
                "title": "Official county sports fields",
                "feature_type": "amenity",
                "description": f"Cobb County's official park page for {park['name']} lists ballfields or youth sports space for active family outings.",
                "url": park["url"],
                "price_note": "Open field access varies by reservation schedule and league use.",
                "is_free": True,
                "sort_order": 45,
            },
        )

    if add_picnic_feature:
        envelope.add(
            "venue_features",
            {
                "place_id": venue_id,
                "slug": "official-county-picnic-pavilions",
                "title": "Official county picnic pavilions",
                "feature_type": "amenity",
                "description": f"Cobb County's official park page for {park['name']} lists picnic pavilions or shelter-style family gathering space.",
                "url": park["url"],
                "price_note": "Open pavilion access is typically free when not reserved.",
                "is_free": True,
                "sort_order": 55,
            },
        )

    if add_nature_feature:
        envelope.add(
            "venue_features",
            {
                "place_id": venue_id,
                "slug": "official-county-nature-and-open-space",
                "title": "Official county nature and open space",
                "feature_type": "amenity",
                "description": f"Cobb County's official park page for {park['name']} highlights preserve, wooded, lake, or other open-air exploration value for families.",
                "url": park["url"],
                "price_note": "Open passive-park access is typically free.",
                "is_free": True,
                "sort_order": 65,
            },
        )

    return envelope


def crawl(config: dict) -> tuple[int, int, int]:
    client = get_client()
    listing_html = _fetch(PARKS_URL)
    paths = _extract_detail_paths(listing_html)
    details_added = 0
    features_added = 0

    for path in paths:
        url = urljoin(BASE_URL, path)
        try:
            park = _parse_park_page(_fetch(url), url)
        except Exception as exc:
            logger.warning("Skipping Cobb park page %s: %s", url, exc)
            continue

        if not park["name"]:
            continue

        existing = _fetch_existing_venue(client, park)
        if existing:
            existing = _maybe_patch_existing_venue(client, existing, park)
            venue_id = existing["id"]
        else:
            venue_id = get_or_create_place(_build_venue_record(park))
        feature_lines = park["feature_lines"]
        signal_text = _signal_text(park)

        add_details = not _venue_has_destination_details(client, venue_id)
        add_playground_feature = _has_signal(feature_lines, r"\bplayground") and not _venue_has_feature_signal(
            client, venue_id, PLAYGROUND_SIGNAL_KEYWORDS
        )
        add_water_play_feature = _has_signal(feature_lines, r"\b(splash|spray|pool|aquatic)") and not _venue_has_feature_signal(
            client, venue_id, WATER_PLAY_SIGNAL_KEYWORDS
        )
        add_trail_feature = _has_signal(feature_lines, r"\b(trail|walking path|walking trail|loop)") and not _venue_has_feature_signal(
            client, venue_id, TRAIL_SIGNAL_KEYWORDS
        )
        add_sports_feature = bool(
            re.search(r"\b(baseball|softball|football|soccer|t-ball|ballfield|sports-focused)\b", signal_text)
        ) and not _venue_has_feature_signal(client, venue_id, SPORTS_SIGNAL_KEYWORDS)
        add_picnic_feature = bool(re.search(r"\b(picnic|pavilion|family reunions?)\b", signal_text)) and not _venue_has_feature_signal(
            client, venue_id, PICNIC_SIGNAL_KEYWORDS
        )
        add_nature_feature = bool(
            re.search(r"\b(preserve|wooded|lake|battlefield|dog park|archery|pump track|outdoor space|relaxation)\b", signal_text)
        ) and not _venue_has_feature_signal(client, venue_id, NATURE_SIGNAL_KEYWORDS)

        envelope = _build_envelope(
            park,
            venue_id,
            add_destination_details=add_details,
            add_playground_feature=add_playground_feature,
            add_water_play_feature=add_water_play_feature,
            add_trail_feature=add_trail_feature,
            add_sports_feature=add_sports_feature,
            add_picnic_feature=add_picnic_feature,
            add_nature_feature=add_nature_feature,
        )
        if not envelope.has_records():
            continue

        persist_result = persist_typed_entity_envelope(envelope)
        details_added += persist_result.persisted.get("destination_details", 0)
        features_added += persist_result.persisted.get("venue_features", 0)

    logger.info(
        "Cobb family parks map: processed %s official parks, added %s destination detail rows and %s features",
        len(paths),
        details_added,
        features_added,
    )
    return 0, 0, 0
