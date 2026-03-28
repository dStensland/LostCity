"""
Official Gwinnett County family parks map importer.

Builds a broad family-use destination layer from Gwinnett County's official
parks index and park detail pages.
"""

from __future__ import annotations

import logging
import re
from html import unescape
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import get_client, get_or_create_place
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from utils import slugify

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gwinnettcounty.com"
PARKS_URL = f"{BASE_URL}/government/departments/parks-recreation/parks"

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
TRAIL_SIGNAL_KEYWORDS = ("trail", "greenway", "loop", "walking")
SPORTS_SIGNAL_KEYWORDS = ("soccer", "baseball", "softball", "football", "field")
PICNIC_SIGNAL_KEYWORDS = ("picnic", "pavilion", "shelter")
GENERIC_OUTDOOR_SIGNAL_KEYWORDS = ("park", "outdoor", "open space", "recreation")
NATURE_SIGNAL_KEYWORDS = ("lake", "river", "nature", "wooded", "historic", "passive", "open space")

PARK_PATH_PREFIX = "/government/departments/parks-recreation/parks/explore/"


def _fetch(url: str) -> str:
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    return response.text


def _extract_detail_paths(listing_html: str) -> list[str]:
    soup = BeautifulSoup(listing_html, "html.parser")
    paths: list[str] = []
    seen: set[str] = set()
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if not href.startswith(PARK_PATH_PREFIX):
            continue
        if href in seen:
            continue
        seen.add(href)
        paths.append(href)
    return paths


def _extract_page_title(page_html: str) -> str:
    soup = BeautifulSoup(page_html, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    title = title.replace(" - Gwinnett County - Gwinnett", "").strip()
    return title


def _extract_rich_text_after_heading(page_html: str, heading: str) -> str:
    soup = BeautifulSoup(page_html, "html.parser")
    heading_node = soup.find(
        lambda tag: tag.name in {"h2", "h3"}
        and " ".join(tag.get_text(" ", strip=True).split()).lower() == heading.lower()
    )
    if not heading_node:
        return ""

    node = heading_node
    fallback_div: Optional[str] = None
    while node is not None:
        node = node.find_next()
        if node is None:
            break
        if node.name == heading_node.name and " ".join(node.get_text(" ", strip=True).split()).lower() == heading.lower():
            break
        if node.name == "div" and "rich-text" in (node.get("class") or []):
            return str(node)
        if fallback_div is None and node.name == "div":
            fallback_div = str(node)
    return fallback_div or ""


def _strip_html(text: str) -> str:
    soup = BeautifulSoup(text, "html.parser")
    return " ".join(soup.get_text(" ", strip=True).split())


def _parse_address_block(info_html: str) -> dict[str, Optional[str]]:
    soup = BeautifulSoup(info_html, "html.parser")
    for br in soup.find_all("br"):
        br.replace_with("\n")
    text = soup.get_text("\n", strip=True)
    lines = [" ".join(line.split()) for line in text.splitlines() if line.strip()]

    for index, line in enumerate(lines):
        if line.lower() not in {"park entrance", "entrance"}:
            continue
        if index + 1 >= len(lines):
            break
        raw = lines[index + 1]
        if "," not in raw:
            return {"address": raw, "city": None}
        address, city = [part.strip() for part in raw.split(",", 1)]
        return {"address": address, "city": city}

    return {"address": None, "city": None}


def _parse_address_from_page(page_html: str) -> dict[str, Optional[str]]:
    match = re.search(
        r"<strong>\s*Park Entrance\s*</strong><br>\s*([^<]+),\s*([^<]+?)(?:<br|</p>)",
        page_html,
        flags=re.IGNORECASE,
    )
    if match:
        return {
            "address": " ".join(unescape(match.group(1)).split()),
            "city": " ".join(unescape(match.group(2)).split()),
        }

    soup = BeautifulSoup(page_html, "html.parser")
    lines: list[str] = []
    for node in soup.find_all(["h2", "h3", "p"]):
        text = " ".join(node.get_text(" ", strip=True).split())
        if not text:
            continue
        if node.name == "h2" and text.lower() == "amenities":
            break
        lines.append(text)

    labeled_patterns = (
        r"(?:park and pool entrance|park & pool entrance|park entrance|pool entrance|activity building entrance)\s+"
        r"(\d{2,6}[^,]+),\s*([A-Za-z .'-]+)",
        r"(?:^| )(\d{2,6}[^,]+),\s*([A-Za-z .'-]+)$",
    )
    for line in lines:
        lowered = line.lower()
        if any(token in lowered for token in ("font size", "dark/light mode", "special election")):
            continue
        for pattern in labeled_patterns:
            match = re.search(pattern, line, flags=re.IGNORECASE)
            if not match:
                continue
            return {
                "address": " ".join(unescape(match.group(1)).split()),
                "city": " ".join(unescape(match.group(2)).split()),
            }
    return {"address": None, "city": None}


def _parse_amenities(amenities_html: str) -> list[str]:
    soup = BeautifulSoup(amenities_html, "html.parser")
    amenities: list[str] = []
    for li in soup.find_all("li"):
        text = " ".join(li.get_text(" ", strip=True).split())
        if text:
            amenities.append(text)
    return amenities


def _is_supported_family_destination(name: str, path: str, amenities: list[str]) -> bool:
    lowered_name = name.lower()
    lowered_path = path.lower()
    combined = " ".join(amenities).lower()
    if any(
        token in lowered_name
        for token in ("park", "pool", "aquatic center", "aquatic", "gardens")
    ):
        return True
    if any(token in lowered_path for token in ("pool", "aquatic-center")):
        return True
    return any(
        token in combined
        for token in ("playground", "splash pad", "trail", "restrooms", "pavilion")
    )


def _infer_venue_type(name: str, path: str) -> tuple[str, str, str]:
    lowered_name = name.lower()
    lowered_path = path.lower()
    if "pool" in lowered_name or "aquatic" in lowered_name or "pool" in lowered_path or "aquatic-center" in lowered_path:
        return ("recreation", "community_center", "aquatic_center")
    if "activity-building" in lowered_path or "community center" in lowered_name:
        return ("recreation", "community_center", "community_recreation_center")
    if "garden" in lowered_name:
        return ("garden", "park", "garden")
    return ("park", "park", "park")


def _parse_park_page(page_html: str, page_url: str) -> dict:
    name = _extract_page_title(page_html)
    info_html = _extract_rich_text_after_heading(page_html, "Park Entrance")
    amenities_html = _extract_rich_text_after_heading(page_html, "Amenities")
    address = _parse_address_block(info_html)
    if not address["address"]:
        address = _parse_address_from_page(page_html)
    amenities = _parse_amenities(amenities_html)
    venue_type, spot_type, destination_type = _infer_venue_type(name, page_url)

    return {
        "name": name,
        "slug": slugify(name),
        "url": page_url,
        "address": address["address"],
        "city": address["city"] or "Lawrenceville",
        "state": "GA",
        "summary": _strip_html(info_html) or None,
        "amenities": amenities,
        "place_type": venue_type,
        "spot_type": spot_type,
        "destination_type": destination_type,
    }


def _fetch_existing_venue(client, park: dict) -> Optional[dict]:
    for field in ("slug",):
        value = park[field]
        result = (
            client.table("places")
            .select("id,name,slug,address,city,place_type,spot_type")
            .eq(field, value)
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
            .select("id,name,slug,address,city,place_type,spot_type")
            .eq("address", park["address"])
            .limit(5)
            .execute()
        )
        for row in result.data or []:
            if (row.get("city") or "").strip().lower() == (park.get("city") or "").strip().lower():
                return row

    result = (
        client.table("places")
        .select("id,name,slug,address,city,place_type,spot_type")
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
    for key in ("address", "city", "state"):
        if park.get(key) and not venue.get(key):
            updates[key] = park[key]
    if not updates:
        return venue
    client.table("places").update(updates).eq("id", venue["id"]).execute()
    venue.update(updates)
    return venue


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


def _has_signal(amenities: list[str], pattern: str) -> bool:
    return bool(re.search(pattern, " ".join(amenities).lower()))


def _signal_text(park: dict) -> str:
    return " ".join(
        part
        for part in [park.get("name"), park.get("summary"), *park.get("amenities", [])]
        if part
    ).lower()


def _build_venue_record(park: dict) -> dict:
    return {
        "name": park["name"],
        "slug": park["slug"],
        "address": park["address"],
        "city": park["city"],
        "state": park["state"],
        "place_type": park.get("place_type") or park.get("place_type"),
        "spot_type": park["spot_type"],
        "website": park["url"],
        "description": park["summary"],
    }


def _build_envelope(
    park: dict,
    venue_id: int,
    *,
    add_destination_details: bool,
    add_playground_feature: bool,
    add_water_play_feature: bool,
    add_trail_feature: bool,
    add_sports_feature: bool,
    add_rec_center_feature: bool,
    add_picnic_feature: bool,
    add_nature_feature: bool,
    add_generic_outdoor_feature: bool,
) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()

    if add_destination_details:
        envelope.add(
            "destination_details",
            {
                "place_id": venue_id,
                "destination_type": park["destination_type"],
                "commitment_tier": "halfday",
                "primary_activity": "family park visit",
                "best_seasons": ["spring", "summer", "fall"],
                "weather_fit_tags": ["outdoor", "family-daytrip", "free-option"],
                "parking_type": "free_lot",
                "best_time_of_day": "morning",
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Open county park access is typically free; aquatics or rentals may vary by facility.",
                "source_url": park["url"],
                "practical_notes": park["summary"],
                "metadata": {
                    "source_type": "family_system_map",
                    "jurisdiction": "gwinnett-county",
                    "source_slug": "gwinnett-parks-family-map",
                    "official_amenities": park["amenities"],
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
                "description": f"Gwinnett County's official park page for {park['name']} lists playground access for family use.",
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
                "description": f"Gwinnett County's official park page for {park['name']} lists splash-pad, pool, or aquatics access for family warm-weather use.",
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
                "description": f"Gwinnett County's official park page for {park['name']} lists trails or walking loops suitable for easy family outings.",
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
                "description": f"Gwinnett County's official park page for {park['name']} lists soccer or other sports fields suitable for active family play.",
                "url": park["url"],
                "price_note": "Field access varies by reservation schedule and league use.",
                "is_free": True,
                "sort_order": 45,
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
                "description": f"Gwinnett County's official park page for {park['name']} points to an activity-building or recreation-center-style family stop.",
                "url": park["url"],
                "price_note": "Program or facility access may vary by county schedule.",
                "is_free": False,
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
                "description": f"Gwinnett County's official park page for {park['name']} lists picnic or pavilion-style family gathering space.",
                "url": park["url"],
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
                "description": f"Gwinnett County's official park page for {park['name']} highlights river, lake, wooded, historic, or passive open-space value for families.",
                "url": park["url"],
                "price_note": "Open passive-park access is typically free.",
                "is_free": True,
                "sort_order": 75,
            },
        )

    if add_generic_outdoor_feature:
        envelope.add(
            "venue_features",
            {
                "place_id": venue_id,
                "slug": "free-outdoor-play-space",
                "title": "Free outdoor play space",
                "feature_type": "amenity",
                "description": f"Gwinnett County's official parks inventory includes {park['name']} as a free outdoor family stop even when the page lists limited amenity detail.",
                "url": park["url"],
                "price_note": "Open park access is typically free.",
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
    processed = 0

    for path in paths:
        url = urljoin(BASE_URL, path)
        try:
            park = _parse_park_page(_fetch(url), url)
        except Exception as exc:
            logger.warning("Skipping Gwinnett park page %s: %s", url, exc)
            continue

        if not park["name"] or not _is_supported_family_destination(park["name"], path, park["amenities"]):
            continue

        existing = _fetch_existing_venue(client, park)
        if not existing and not park["address"]:
            logger.warning("Skipping Gwinnett park without address-backed venue match: %s", park["name"])
            continue
        if existing:
            existing = _maybe_patch_existing_venue(client, existing, park)
            venue_id = existing["id"]
        else:
            venue_id = get_or_create_place(_build_venue_record(park))
        signal_text = _signal_text(park)

        add_details = not _venue_has_destination_details(client, venue_id)
        add_playground_feature = _has_signal(park["amenities"], r"\bplayground\b") and not _venue_has_feature_signal(
            client, venue_id, PLAYGROUND_SIGNAL_KEYWORDS
        )
        add_water_play_feature = _has_signal(
            park["amenities"], r"\b(splash pad|sprayground|pool|aquatic)\b"
        ) and not _venue_has_feature_signal(client, venue_id, WATER_PLAY_SIGNAL_KEYWORDS)
        add_trail_feature = _has_signal(park["amenities"], r"\b(trail|greenway|loop)\b") and not _venue_has_feature_signal(
            client, venue_id, TRAIL_SIGNAL_KEYWORDS
        )
        add_sports_feature = bool(re.search(r"\b(soccer|baseball|softball|football|field)\b", signal_text)) and not _venue_has_feature_signal(
            client, venue_id, SPORTS_SIGNAL_KEYWORDS
        )
        add_rec_center_feature = park["destination_type"] == "community_recreation_center" and not _venue_has_feature_signal(
            client, venue_id, ("recreation space", "activity building", "community center")
        )
        add_picnic_feature = bool(re.search(r"\b(picnic|pavilion|shelter)\b", signal_text)) and not _venue_has_feature_signal(
            client, venue_id, PICNIC_SIGNAL_KEYWORDS
        )
        add_nature_feature = bool(
            re.search(r"\b(lake|river|nature|wooded|historic|passive)\b", signal_text)
        ) and not _venue_has_feature_signal(client, venue_id, NATURE_SIGNAL_KEYWORDS)
        add_generic_outdoor_feature = (
            park["destination_type"] == "park"
            and not any(
                [
                    add_playground_feature,
                    add_water_play_feature,
                    add_trail_feature,
                    add_sports_feature,
                    add_picnic_feature,
                    add_nature_feature,
                ]
            )
            and not _venue_has_feature_signal(client, venue_id, GENERIC_OUTDOOR_SIGNAL_KEYWORDS)
        )

        envelope = _build_envelope(
            park,
            venue_id,
            add_destination_details=add_details,
            add_playground_feature=add_playground_feature,
            add_water_play_feature=add_water_play_feature,
            add_trail_feature=add_trail_feature,
            add_sports_feature=add_sports_feature,
            add_rec_center_feature=add_rec_center_feature,
            add_picnic_feature=add_picnic_feature,
            add_nature_feature=add_nature_feature,
            add_generic_outdoor_feature=add_generic_outdoor_feature,
        )
        if not envelope.has_records():
            continue

        persist_typed_entity_envelope(envelope)
        processed += 1
        if add_details:
            details_added += 1
        features_added += sum([add_playground_feature, add_water_play_feature, add_trail_feature])
        features_added += sum([add_sports_feature, add_rec_center_feature, add_generic_outdoor_feature])

    logger.info(
        "Gwinnett family parks map: processed %s official destinations, added %s destination detail rows and %s features",
        processed,
        details_added,
        features_added,
    )
    return (0, 0, 0)
