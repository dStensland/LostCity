"""
Official DeKalb County family parks map importer.

Builds a broad family-use destination layer from DeKalb County's official
regional park inventory pages plus the county aquatics roster.
"""

from __future__ import annotations

import logging
import re
from html import unescape
from typing import Iterable, Optional

import requests
from bs4 import BeautifulSoup, Tag

from db import get_client, get_or_create_place
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from utils import slugify

logger = logging.getLogger(__name__)

BASE_URL = "https://www.dekalbcountyga.gov"
REGION_URLS = (
    f"{BASE_URL}/parks/chambleedoraville",
    f"{BASE_URL}/parks/clarkstonscottdale",
    f"{BASE_URL}/parks/decatur",
    f"{BASE_URL}/parks/ellenwood",
    f"{BASE_URL}/parks/lithoniaredan",
    f"{BASE_URL}/parks/stone-mountain",
)
AQUATICS_URL = f"{BASE_URL}/parks/aquatics"

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
TRAIL_SIGNAL_KEYWORDS = ("trail", "walking trail", "greenway", "loop")
SPORTS_SIGNAL_KEYWORDS = ("baseball", "softball", "football", "soccer", "tennis", "sports field", "multi-use field")
PICNIC_SIGNAL_KEYWORDS = ("picnic", "pavilion", "shelter")
NATURE_SIGNAL_KEYWORDS = ("lake", "wooded", "nature", "passive park", "battlefield", "open space")


def _fetch(url: str) -> str:
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    return response.text


def _clean_text(value: str) -> str:
    return " ".join(unescape(value or "").replace("\xa0", " ").split())


def _normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", _clean_text(value).lower()).strip()


def _normalize_city(value: Optional[str]) -> str:
    city = _clean_text(value or "")
    if not city:
        return "Decatur"
    lowered = city.lower()
    if lowered == "scottdale":
        return "Scottdale"
    if lowered == "stone mountain":
        return "Stone Mountain"
    return city


def _parse_address_city(raw: str) -> tuple[Optional[str], Optional[str]]:
    cleaned = _clean_text(re.sub(r"\(\d{3}\)\s*\d{3}-\d{4}", "", raw))
    match = re.match(r"(.+?),\s*([A-Za-z .'-]+)$", cleaned)
    if match:
        return match.group(1).strip(), _normalize_city(match.group(2))
    return cleaned or None, None


def _parse_region_paragraph(paragraph: Tag) -> list[dict]:
    entries: list[dict] = []
    current: Optional[dict] = None
    lines: list[str] = []

    def flush_current() -> None:
        nonlocal current, lines
        if not current:
            return
        filtered = [_clean_text(line) for line in lines if _clean_text(line)]
        lines = []
        if not filtered:
            current = None
            return
        address_line = filtered[0]
        acreage_line = next((line for line in filtered[1:] if line.lower().startswith("acres:")), None)
        amenities_line = next((line for line in filtered[1:] if not line.lower().startswith("acres:")), "")
        address, city = _parse_address_city(address_line)
        current.update(
            {
                "address": address,
                "city": city or current["city"],
                "acreage": acreage_line.split(":", 1)[1].strip() if acreage_line else None,
                "amenities_text": amenities_line,
                "amenities": [item.strip() for item in re.split(r",| and ", amenities_line) if item.strip()],
            }
        )
        entries.append(current)
        current = None

    for child in paragraph.children:
        if isinstance(child, Tag) and child.name == "strong":
            flush_current()
            current = {
                "name": _clean_text(child.get_text(" ", strip=True)),
                "city": "Decatur",
                "source_url": "",
            }
            continue

        if isinstance(child, Tag) and child.name == "br":
            lines.append("\n")
            continue

        text = ""
        if isinstance(child, Tag):
            text = child.get_text(" ", strip=True)
        else:
            text = str(child)
        if current is None:
            continue
        cleaned = _clean_text(text)
        if cleaned:
            lines.append(cleaned)

    flush_current()
    return entries


def _extract_region_entries(page_html: str, page_url: str) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    entries: list[dict] = []
    for paragraph in soup.find_all("p"):
        if not paragraph.find("strong"):
            continue
        text = _clean_text(paragraph.get_text(" ", strip=True))
        if "Acres:" not in text:
            continue
        parsed_entries = _parse_region_paragraph(paragraph)
        for entry in parsed_entries:
            entry["source_url"] = page_url
            entry["venue_type"], entry["spot_type"], entry["destination_type"] = _infer_types(
                entry["name"], entry["amenities_text"]
            )
        entries.extend(parsed_entries)
    return entries


def _parse_aquatics_entries(page_html: str) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    entries: list[dict] = []
    for paragraph in soup.find_all("p"):
        text = _clean_text(paragraph.get_text(" ", strip=True))
        if not ("pool" in text.lower() or "splash pad" in text.lower()):
            continue
        if "pool fees" in text.lower():
            continue
        if text.lower().startswith("open "):
            continue
        match = re.match(r"(.+?(?:Pool|Splash Pad))\s*-\s*(.+)", text, flags=re.I)
        if not match:
            continue
        name = _clean_text(match.group(1))
        remainder = match.group(2).strip()
        remainder = re.sub(r"\(\d{3}\)\s*\d{3}-\d{4}", "", remainder).strip()
        remainder = re.sub(r"\(Temporarily Closed\)", "", remainder, flags=re.I).strip(" ,")
        match = re.match(r"(.+)\s+([A-Za-z .'-]+),\s*GA,?\s*(\d{5})", remainder)
        if not match:
            continue
        entries.append(
            {
                "name": name,
                "address": _clean_text(match.group(1)),
                "city": _normalize_city(match.group(2)),
                "state": "GA",
                "zip": match.group(3),
                "source_url": AQUATICS_URL,
                "kind": "splash_pad" if "splash pad" in name.lower() else "pool",
            }
        )
    return entries


def _infer_types(name: str, amenities_text: str) -> tuple[str, str, str]:
    lowered_name = name.lower()
    lowered_amenities = amenities_text.lower()
    if "recreation center" in lowered_name or "center for special populations" in lowered_name:
        return ("recreation", "community_center", "community_recreation_center")
    if "pool" in lowered_name or "splash pad" in lowered_name:
        return ("recreation", "community_center", "aquatic_center")
    if "swimming pool" in lowered_amenities:
        return ("recreation", "community_center", "community_recreation_center")
    return ("park", "park", "park")


def _is_supported_family_destination(entry: dict) -> bool:
    combined = f"{entry['name']} {entry.get('amenities_text', '')}".lower()
    if "golf" in combined:
        return False
    return any(
        token in combined
        for token in (
            "playground",
            "trail",
            "picnic",
            "pool",
            "splash",
            "recreation center",
            "lake",
            "walking",
        )
    )


def _fetch_existing_venue(client, entry: dict) -> Optional[dict]:
    candidates = [
        ("slug", slugify(entry["name"])),
        ("name", entry["name"]),
    ]
    base_name = re.sub(r"\s+(pool|splash pad)$", "", entry["name"], flags=re.I).strip()
    if base_name and base_name != entry["name"]:
        candidates.extend([("slug", slugify(base_name)), ("name", base_name)])

    for field, value in candidates:
        result = (
            client.table("places")
            .select("id,name,slug,address,city,state,zip,place_type,spot_type")
            .eq(field, value)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]

    if entry.get("address"):
        result = (
            client.table("places")
            .select("id,name,slug,address,city,state,zip,place_type,spot_type")
            .eq("address", entry["address"])
            .limit(5)
            .execute()
        )
        for row in result.data or []:
            if _normalize_city(row.get("city")) == _normalize_city(entry.get("city")):
                return row
    return None


def _venue_has_destination_details(client, venue_id: int) -> bool:
    result = (
        client.table("venue_destination_details")
        .select("place_id")
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


def _build_venue_record(entry: dict) -> dict:
    summary = (
        f"{entry['name']} appears on DeKalb County's official parks inventory as a family-use "
        f"{entry['destination_type'].replace('_', ' ')} destination."
    )
    if entry.get("amenities_text"):
        summary = f"{summary} Official amenities include {entry['amenities_text']}."
    return {
        "name": entry["name"],
        "slug": slugify(entry["name"]),
        "address": entry.get("address"),
        "city": entry.get("city") or "Decatur",
        "state": "GA",
        "zip": entry.get("zip"),
        "place_type": entry["venue_type"],
        "spot_type": entry["spot_type"],
        "website": entry["source_url"],
        "description": summary,
    }


def _build_envelope(
    entry: dict,
    venue_id: int,
    *,
    add_destination_details: bool,
    add_playground_feature: bool,
    add_water_play_feature: bool,
    add_trail_feature: bool,
    add_rec_center_feature: bool,
    add_sports_feature: bool,
    add_picnic_feature: bool,
    add_nature_feature: bool,
) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()

    if add_destination_details:
        commitment = "hour" if entry["destination_type"] == "aquatic_center" else "halfday"
        primary_activity = "family aquatics outing" if entry["destination_type"] == "aquatic_center" else "family park visit"
        envelope.add(
            "destination_details",
            {
                "place_id": venue_id,
                "destination_type": entry["destination_type"],
                "commitment_tier": commitment,
                "primary_activity": primary_activity,
                "best_seasons": ["spring", "summer", "fall"],
                "weather_fit_tags": ["outdoor", "family-daytrip", "free-option"],
                "parking_type": "free_lot",
                "best_time_of_day": "morning",
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Open park access is typically free; aquatics and special programs may follow county fees or seasonal schedules.",
                "source_url": entry["source_url"],
                "practical_notes": entry.get("amenities_text") or None,
                "metadata": {
                    "source_type": "family_system_map",
                    "jurisdiction": "dekalb-county",
                    "source_slug": "dekalb-parks-family-map",
                    "amenities": entry.get("amenities", []),
                    "acreage": entry.get("acreage"),
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
                "description": f"DeKalb County's official parks inventory lists playground access at {entry['name']}.",
                "url": entry["source_url"],
                "price_note": "Open playground access is typically free.",
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
                "description": f"DeKalb County's official parks and aquatics pages list pool or splash access at {entry['name']}.",
                "url": entry["source_url"],
                "price_note": "Pool or splash access follows county seasonal schedules and fees.",
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
                "description": f"DeKalb County's official parks inventory lists trails or walking loops at {entry['name']}.",
                "url": entry["source_url"],
                "price_note": "Open trail access is typically free.",
                "is_free": True,
                "sort_order": 35,
            },
        )

    if add_rec_center_feature:
        envelope.add(
            "venue_features",
            {
                "place_id": venue_id,
                "slug": "indoor-family-recreation-space",
                "title": "Indoor family recreation space",
                "feature_type": "amenity",
                "description": f"DeKalb County's official parks inventory lists {entry['name']} as a recreation-center-style family stop.",
                "url": entry["source_url"],
                "price_note": "Program or facility access may vary by county schedule.",
                "is_free": False,
                "sort_order": 45,
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
                "description": f"DeKalb County's official parks inventory lists sports fields or courts at {entry['name']} for active family play.",
                "url": entry["source_url"],
                "price_note": "Open field access varies by reservation schedule and league use.",
                "is_free": True,
                "sort_order": 55,
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
                "description": f"DeKalb County's official parks inventory lists picnic or pavilion-style family gathering space at {entry['name']}.",
                "url": entry["source_url"],
                "price_note": "Open picnic-area use is typically free when not reserved.",
                "is_free": True,
                "sort_order": 65,
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
                "description": f"DeKalb County's official parks inventory highlights lake, wooded, or passive open-space value at {entry['name']}.",
                "url": entry["source_url"],
                "price_note": "Open passive-park access is typically free.",
                "is_free": True,
                "sort_order": 75,
            },
        )

    return envelope


def _iter_entries() -> Iterable[dict]:
    for url in REGION_URLS:
        try:
            for entry in _extract_region_entries(_fetch(url), url):
                if _is_supported_family_destination(entry):
                    yield entry
        except Exception as exc:
            logger.warning("Skipping DeKalb region page %s: %s", url, exc)

    try:
        for entry in _parse_aquatics_entries(_fetch(AQUATICS_URL)):
            entry["venue_type"], entry["spot_type"], entry["destination_type"] = _infer_types(
                entry["name"], entry["kind"]
            )
            entry["amenities_text"] = entry["kind"].replace("_", " ")
            entry["amenities"] = [entry["kind"].replace("_", " ")]
            entry["acreage"] = None
            yield entry
    except Exception as exc:
        logger.warning("Skipping DeKalb aquatics page %s: %s", AQUATICS_URL, exc)


def crawl(config: dict) -> tuple[int, int, int]:
    client = get_client()
    details_added = 0
    features_added = 0
    seen_slugs: set[str] = set()

    for entry in _iter_entries():
        slug = slugify(entry["name"])
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)

        existing = _fetch_existing_venue(client, entry)
        venue_record = _build_venue_record(entry)
        venue_id = existing["id"] if existing else get_or_create_place(venue_record)

        combined = f"{entry['name']} {entry.get('amenities_text', '')}".lower()
        add_destination_details = not _venue_has_destination_details(client, venue_id)
        add_playground_feature = (
            ("playground" in combined)
            and not _venue_has_feature_signal(client, venue_id, PLAYGROUND_SIGNAL_KEYWORDS)
        )
        add_water_play_feature = (
            any(token in combined for token in ("pool", "splash", "aquatic"))
            and not _venue_has_feature_signal(client, venue_id, WATER_PLAY_SIGNAL_KEYWORDS)
        )
        add_trail_feature = (
            ("trail" in combined or "walking" in combined)
            and not _venue_has_feature_signal(client, venue_id, TRAIL_SIGNAL_KEYWORDS)
        )
        add_rec_center_feature = (
            entry["destination_type"] == "community_recreation_center"
            and not _venue_has_feature_signal(client, venue_id, ("recreation", "indoor-family"))
        )
        add_sports_feature = (
            any(token in combined for token in ("baseball", "softball", "football", "soccer", "tennis", "multi-use field"))
            and not _venue_has_feature_signal(client, venue_id, SPORTS_SIGNAL_KEYWORDS)
        )
        add_picnic_feature = (
            any(token in combined for token in ("picnic", "pavilion", "shelter"))
            and not _venue_has_feature_signal(client, venue_id, PICNIC_SIGNAL_KEYWORDS)
        )
        add_nature_feature = (
            any(token in combined for token in ("lake", "wooded", "nature", "passive park", "battlefield", "open space"))
            and not _venue_has_feature_signal(client, venue_id, NATURE_SIGNAL_KEYWORDS)
        )

        envelope = _build_envelope(
            entry,
            venue_id,
            add_destination_details=add_destination_details,
            add_playground_feature=add_playground_feature,
            add_water_play_feature=add_water_play_feature,
            add_trail_feature=add_trail_feature,
            add_rec_center_feature=add_rec_center_feature,
            add_sports_feature=add_sports_feature,
            add_picnic_feature=add_picnic_feature,
            add_nature_feature=add_nature_feature,
        )
        if not envelope.has_records():
            continue

        summary = persist_typed_entity_envelope(envelope)
        details_added += summary.persisted.get("destination_details", 0)
        features_added += summary.persisted.get("venue_features", 0)

    logger.info(
        "DeKalb family parks map: processed %d official destinations, added %d destination detail rows and %d features",
        len(seen_slugs),
        details_added,
        features_added,
    )
    return (len(seen_slugs), details_added, features_added)
