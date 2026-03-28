"""
Official Atlanta parks family overlay importer.

This source seeds and enriches Atlanta family-use parks and recreation stops
from the city's published playground and splash-pad rosters.

Why this exists
---------------
The city pages are usable as published official rosters, but they are bot
protected for direct requests. The practical first wave is to maintain the
officially published family amenity inventory as a source-owned map layer:

- official playground list
- official splash-pad list

This is intentionally broad-first. It improves the family destination graph
across many city parks before deeper park-specific crawlers exist.
"""

from __future__ import annotations

import logging
from collections import OrderedDict
from typing import Optional

import requests

from db import get_client, get_or_create_place
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from utils import slugify

logger = logging.getLogger(__name__)

PLAYGROUNDS_URL = (
    "https://www.atlantaga.gov/government/departments/"
    "department-parks-recreation/office-of-parks/list-of-playgrounds"
)
SPLASH_PADS_URL = (
    "https://www.atlantaga.gov/government/departments/"
    "department-parks-recreation/office-of-parks/splash-pads"
)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    destination_details=True,
    venue_features=True,
)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_USER_AGENT = "LostCity Family Parks Map (contact@lostcity.ai)"
ATLANTA_PARKS_LAYER_URL = (
    "https://gis.atlantaga.gov/dpcd/rest/services/ReferenceData/ReferenceData/MapServer/3/query"
)
ATLANTA_GEOCODER_FIND_URL = (
    "https://gis.atlantaga.gov/dpcd/rest/services/GIS_CompositeLocator_2024/GeocodeServer/findAddressCandidates"
)
ATLANTA_GEOCODER_REVERSE_URL = (
    "https://gis.atlantaga.gov/dpcd/rest/services/GIS_CompositeLocator_2024/GeocodeServer/reverseGeocode"
)
ATLANTA_GEOCODER_MIN_SCORE = 85

# The official playground page includes one school-campus playground that is not
# clearly a public destination in the same way as the park inventory. A couple
# of additional roster-only names also do not resolve to trustworthy official
# park records or addresses. Skip those until a direct public-access source is
# qualified.
UNSUPPORTED_OVERLAY_NAMES = {
    "Atlanta Children's Theme Park",
    "Civic Center Playground",
}

PLAYGROUND_NAMES = (
    "Anderson Park",
    "Blue Heron Nature Preserve",
    "Center Hill Park",
    "Chastain Park",
    "Dean Rusk Park",
    "Dove Park",
    "Empire Park",
    "Freedom Park",
    "Glen Emerald Park",
    "Grant Park",
    "Hills Park",
    "John A. White Park",
    "Kimberly Brawner Park",
    "Maddox Park",
    "Mozley Park",
    "Perkerson Park",
    "Pittman Park",
    "Pryor Park",
    "Rosa L. Burney Park",
    "Rose Circle Park",
    "Springvale Park",
    "Tanyard Creek Park",
    "Thomasville Park",
    "Underwood Hills Park",
    "Washington Park",
    "West Manor Park",
    "Westside Park",
)

SPLASH_LABELS = (
    "ATL Natatorium at Washington Park",
    "Center Hill Park",
    "CT Martin Natatorium",
    "MLK Jr Recreation & Aquatic Center",
    "Pittman Park",
    "Rosel Fann Recreation Center",
    "Maddox Park",
)

VENUE_OVERRIDES = {
    "atl natatorium at washington park": {
        "name": "Washington Park Aquatic Center",
        "slug": "washington-park-aquatic-center",
        "venue_type": "recreation",
        "spot_type": "community_center",
        "destination_type": "aquatic_center",
    },
    "ct martin natatorium": {
        "name": "CT Martin Recreation & Aquatic Center",
        "slug": "ct-martin-recreation-center",
        "venue_type": "recreation",
        "spot_type": "community_center",
        "destination_type": "aquatic_center",
    },
    "mlk jr recreation & aquatic center": {
        "name": "Martin Luther King Jr Recreation & Aquatic Center",
        "slug": "mlk-recreation-center",
        "venue_type": "recreation",
        "spot_type": "community_center",
        "destination_type": "aquatic_center",
    },
    "rosel fann recreation center": {
        "name": "Rosel Fann Recreation & Aquatic Center",
        "slug": "rosel-fann-recreation-center",
        "venue_type": "recreation",
        "spot_type": "community_center",
        "destination_type": "aquatic_center",
    },
    "pittman park": {
        "name": "Pittman Park Recreation Center",
        "slug": "pittman-park-recreation-center",
        "venue_type": "park",
        "spot_type": "park",
        "destination_type": "park",
    },
    "chastain park": {
        "name": "Chastain Park",
        "slug": "chastain-park",
        "venue_type": "park",
        "spot_type": "park",
        "destination_type": "park",
        "official_lookup_name": "Chastain Memorial Park",
    },
    "john a. white park": {
        "name": "John A. White Park",
        "slug": "john-a-white-park",
        "venue_type": "park",
        "spot_type": "park",
        "destination_type": "park",
    },
}

PLAYGROUND_SIGNAL_KEYWORDS = ("playground", "play area", "tot lot", "nature play")
WATER_PLAY_SIGNAL_KEYWORDS = (
    "splash",
    "sprayground",
    "water play",
    "play fountain",
    "wading",
    "aquatic",
    "pool",
)


def _normalize_key(value: str) -> str:
    return " ".join((value or "").lower().replace(".", "").split())


def _catalog_entries() -> list[dict]:
    catalog: OrderedDict[str, dict] = OrderedDict()

    for name in PLAYGROUND_NAMES:
        if name in UNSUPPORTED_OVERLAY_NAMES:
            continue
        key = _normalize_key(name)
        override = VENUE_OVERRIDES.get(key, {})
        entry = catalog.setdefault(
            key,
            {
                "name": override.get("name", name),
                "slug": override.get("slug", slugify(override.get("name", name))),
                "venue_type": override.get("venue_type", "park"),
                "spot_type": override.get("spot_type", "park"),
                "destination_type": override.get("destination_type", "park"),
                "official_lookup_name": override.get("official_lookup_name"),
                "city": "Atlanta",
                "state": "GA",
                "source_labels": [],
                "overlay_types": set(),
            },
        )
        entry["overlay_types"].add("playground")
        entry["source_labels"].append(name)

    for label in SPLASH_LABELS:
        key = _normalize_key(label)
        override = VENUE_OVERRIDES.get(key, {})
        entry = catalog.setdefault(
            key,
            {
                "name": override.get("name", label),
                "slug": override.get("slug", slugify(override.get("name", label))),
                "venue_type": override.get("venue_type", "park"),
                "spot_type": override.get("spot_type", "park"),
                "destination_type": override.get("destination_type", "park"),
                "official_lookup_name": override.get("official_lookup_name"),
                "city": "Atlanta",
                "state": "GA",
                "source_labels": [],
                "overlay_types": set(),
            },
        )
        entry["overlay_types"].add("water_play")
        entry["source_labels"].append(label)

    return list(catalog.values())


def _build_venue_record(entry: dict) -> dict:
    overlay_types = entry["overlay_types"]
    if overlay_types == {"playground", "water_play"}:
        description = (
            f"{entry['name']} appears on Atlanta's official playground and splash-pad rosters, "
            "making it a strong city park option for family outdoor time and hot-weather play."
        )
    elif "water_play" in overlay_types:
        description = (
            f"{entry['name']} appears on Atlanta's official splash-pad roster as a city family "
            "water-play destination."
        )
    else:
        description = (
            f"{entry['name']} appears on Atlanta's official playground roster as a city family "
            "playground destination."
        )

    website = SPLASH_PADS_URL if "water_play" in overlay_types else PLAYGROUNDS_URL
    return {
        "name": entry["name"],
        "slug": entry["slug"],
        "address": entry.get("address"),
        "city": entry.get("city"),
        "state": entry.get("state"),
        "zip": entry.get("zip"),
        "lat": entry.get("lat"),
        "lng": entry.get("lng"),
        "neighborhood": entry.get("neighborhood"),
        "venue_type": entry["venue_type"],
        "spot_type": entry["spot_type"],
        "website": website,
        "description": description,
    }


def _fetch_existing_venue(client, entry: dict) -> Optional[dict]:
    slug_result = (
        client.table("venues")
        .select("id,name,slug,address,city,state,zip,lat,lng,neighborhood,venue_type,spot_type")
        .eq("slug", entry["slug"])
        .limit(1)
        .execute()
    )
    if slug_result.data:
        return slug_result.data[0]

    name_result = (
        client.table("venues")
        .select("id,name,slug,address,city,state,zip,lat,lng,neighborhood,venue_type,spot_type")
        .eq("name", entry["name"])
        .limit(1)
        .execute()
    )
    if name_result.data:
        return name_result.data[0]
    return None


def _polygon_centroid_from_rings(rings: list) -> Optional[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for ring in rings or []:
        for point in ring or []:
            if isinstance(point, list) and len(point) >= 2:
                points.append((float(point[0]), float(point[1])))
    if not points:
        return None
    min_lng = min(point[0] for point in points)
    max_lng = max(point[0] for point in points)
    min_lat = min(point[1] for point in points)
    max_lat = max(point[1] for point in points)
    return ((min_lng + max_lng) / 2.0, (min_lat + max_lat) / 2.0)


def _parse_official_park_feature(feature: dict) -> Optional[dict]:
    attributes = feature.get("attributes") or {}
    geometry = feature.get("geometry") or {}
    name = str(attributes.get("NAME") or "").strip()
    if not name:
        return None
    centroid = _polygon_centroid_from_rings(geometry.get("rings") or [])
    return {
        "name": name,
        "address": str(attributes.get("ADDRESS") or "").strip() or None,
        "city": "Atlanta",
        "state": "GA",
        "zip": str(attributes.get("ZIP") or "").strip() or None,
        "neighborhood": str(attributes.get("NEIGHBOR") or "").strip() or None,
        "lng": centroid[0] if centroid else None,
        "lat": centroid[1] if centroid else None,
    }


def _lookup_official_park_details(name: str) -> Optional[dict]:
    escaped_name = name.replace("'", "''")
    try:
        response = requests.get(
            ATLANTA_PARKS_LAYER_URL,
            params={
                "where": f"NAME='{escaped_name}'",
                "outFields": "NAME,ADDRESS,ZIP,NEIGHBOR",
                "returnGeometry": "true",
                "outSR": "4326",
                "f": "json",
            },
            timeout=20,
        )
        response.raise_for_status()
    except Exception as exc:
        logger.warning("Official Atlanta parks lookup failed for %s: %s", name, exc)
        return None

    for feature in response.json().get("features") or []:
        parsed = _parse_official_park_feature(feature)
        if parsed:
            return parsed
    return None


def _lookup_official_geocoder_fallback(name: str) -> Optional[dict]:
    try:
        response = requests.get(
            ATLANTA_GEOCODER_FIND_URL,
            params={
                "SingleLine": f"{name}, Atlanta, GA",
                "f": "json",
                "outFields": "*",
                "maxLocations": 1,
            },
            timeout=20,
        )
        response.raise_for_status()
    except Exception as exc:
        logger.warning("Official Atlanta geocoder lookup failed for %s: %s", name, exc)
        return None

    candidates = response.json().get("candidates") or []
    if not candidates:
        return None

    candidate = candidates[0]
    score = float(candidate.get("score") or 0)
    if score < ATLANTA_GEOCODER_MIN_SCORE:
        return None

    location = candidate.get("location") or {}
    x = location.get("x")
    y = location.get("y")
    if x is None or y is None:
        return None

    try:
        reverse = requests.get(
            ATLANTA_GEOCODER_REVERSE_URL,
            params={"location": f"{x},{y}", "f": "json"},
            timeout=20,
        )
        reverse.raise_for_status()
    except Exception as exc:
        logger.warning("Official Atlanta reverse geocode failed for %s: %s", name, exc)
        return None

    address = (reverse.json().get("address") or {})
    match_addr = str(address.get("Match_addr") or "").strip() or None
    city = str(address.get("City") or "").strip() or "Atlanta"
    state = str(address.get("Region") or "").strip() or "GA"

    return {
        "address": match_addr,
        "city": city,
        "state": state,
        "lat": float(y),
        "lng": float(x),
    }


def _lookup_place_geometry(name: str) -> Optional[dict]:
    try:
        response = requests.get(
            NOMINATIM_URL,
            params={
                "q": f"{name}, Atlanta, GA",
                "format": "jsonv2",
                "limit": 3,
                "addressdetails": 1,
                "countrycodes": "us",
            },
            headers={"User-Agent": NOMINATIM_USER_AGENT},
            timeout=15,
        )
        response.raise_for_status()
    except Exception as exc:
        logger.warning("Nominatim lookup failed for %s: %s", name, exc)
        return None

    allowed_types = {
        "park",
        "playground",
        "recreation_ground",
        "pitch",
        "swimming_pool",
        "sports_centre",
        "leisure_centre",
    }
    for result in response.json() or []:
        place_type = str(result.get("type") or "").lower()
        display_name = str(result.get("display_name") or "")
        if "atlanta" not in display_name.lower():
            continue
        if place_type not in allowed_types:
            continue

        address = result.get("address") or {}
        house_number = address.get("house_number")
        road = address.get("road")
        suburb = (
            address.get("suburb")
            or address.get("neighbourhood")
            or address.get("city_district")
        )
        postcode = address.get("postcode")
        venue_address = None
        if road:
            venue_address = f"{house_number} {road}".strip() if house_number else road

        return {
            "address": venue_address,
            "city": address.get("city") or address.get("town") or "Atlanta",
            "state": address.get("state") or "GA",
            "zip": postcode,
            "lat": float(result["lat"]),
            "lng": float(result["lon"]),
            "neighborhood": suburb,
        }

    return None


def _maybe_patch_existing_venue(client, venue: dict, entry: dict) -> dict:
    official_name = entry.get("official_lookup_name") or entry["name"]
    official = _lookup_official_park_details(official_name)
    geocoder = _lookup_official_geocoder_fallback(official_name) if not official else None
    geometry = _lookup_place_geometry(entry["name"]) if not official and not geocoder else None

    updates = {}
    if official:
        for key in ("address", "city", "state", "zip", "lat", "lng", "neighborhood"):
            if official.get(key) and not venue.get(key):
                updates[key] = official[key]
    if geocoder:
        for key in ("address", "city", "state", "lat", "lng"):
            if geocoder.get(key) and not venue.get(key):
                updates[key] = geocoder[key]
    if geometry:
        for key in ("address", "city", "state", "zip", "lat", "lng", "neighborhood"):
            if geometry.get(key) and not venue.get(key):
                updates[key] = geometry[key]
    if not updates:
        return venue

    client.table("venues").update(updates).eq("id", venue["id"]).execute()
    venue.update(updates)
    logger.info("Updated location details for %s", entry["name"])
    return venue


def _resolve_venue_id(client, entry: dict) -> int:
    existing = _fetch_existing_venue(client, entry)
    if existing:
        patched = _maybe_patch_existing_venue(client, existing, entry)
        return patched["id"]

    venue_record = _build_venue_record(entry)
    official_name = entry.get("official_lookup_name") or entry["name"]
    official = _lookup_official_park_details(official_name)
    if official:
        venue_record.update({k: v for k, v in official.items() if v})
    else:
        geocoder = _lookup_official_geocoder_fallback(official_name)
        if geocoder:
            venue_record.update({k: v for k, v in geocoder.items() if v})
        else:
            geometry = _lookup_place_geometry(entry["name"])
            if geometry:
                venue_record.update({k: v for k, v in geometry.items() if v})
    return get_or_create_place(venue_record)


def _venue_has_destination_details(client, venue_id: int) -> bool:
    result = (
        client.table("venue_destination_details")
        .select("venue_id")
        .eq("venue_id", venue_id)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def _venue_has_feature_signal(client, venue_id: int, keywords: tuple[str, ...]) -> bool:
    result = (
        client.table("venue_features")
        .select("slug, title, description")
        .eq("venue_id", venue_id)
        .eq("is_active", True)
        .execute()
    )
    for row in result.data or []:
        haystack = " ".join(
            [
                str(row.get("slug") or ""),
                str(row.get("title") or ""),
                str(row.get("description") or ""),
            ]
        ).lower()
        if any(keyword in haystack for keyword in keywords):
            return True
    return False


def _build_overlay_envelope(
    entry: dict,
    venue_id: int,
    add_destination_details: bool,
    add_playground_feature: bool,
    add_water_play_feature: bool,
) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    overlay_types = entry["overlay_types"]
    source_url = SPLASH_PADS_URL if "water_play" in overlay_types else PLAYGROUNDS_URL

    if add_destination_details:
        if entry["destination_type"] == "aquatic_center":
            envelope.add(
                "destination_details",
                {
                    "venue_id": venue_id,
                    "destination_type": "aquatic_center",
                    "commitment_tier": "halfday",
                    "primary_activity": "family splash pad or aquatic center visit",
                    "best_seasons": ["spring", "summer"],
                    "weather_fit_tags": ["outdoor", "heat-day", "family-daytrip"],
                    "family_suitability": "yes",
                    "reservation_required": False,
                    "permit_required": False,
                    "fee_note": "Confirm current city operating schedule and splash-pad or pool availability before visiting.",
                    "source_url": source_url,
                    "metadata": {
                        "source_type": "family_system_overlay",
                        "source_slug": "atlanta-parks-family-map",
                        "overlay_types": sorted(overlay_types),
                        "source_labels": entry["source_labels"],
                        "city": "atlanta",
                    },
                },
            )
        else:
            envelope.add(
                "destination_details",
                {
                    "venue_id": venue_id,
                    "destination_type": "park",
                    "commitment_tier": "halfday",
                    "primary_activity": "family park visit",
                    "best_seasons": ["spring", "summer", "fall"],
                    "weather_fit_tags": ["outdoor", "free-option", "family-daytrip"],
                    "family_suitability": "yes",
                    "reservation_required": False,
                    "permit_required": False,
                    "fee_note": "Open park access is typically free; confirm seasonal splash or aquatics hours before visiting.",
                    "source_url": source_url,
                    "metadata": {
                        "source_type": "family_system_overlay",
                        "source_slug": "atlanta-parks-family-map",
                        "overlay_types": sorted(overlay_types),
                        "source_labels": entry["source_labels"],
                        "city": "atlanta",
                    },
                },
            )

    if add_playground_feature:
        envelope.add(
            "venue_features",
            {
                "venue_id": venue_id,
                "slug": "official-city-playground",
                "title": "Official city playground",
                "feature_type": "amenity",
                "description": (
                    f"Atlanta's official playground roster includes {entry['name']} as a city "
                    "playground stop for family outdoor time."
                ),
                "url": PLAYGROUNDS_URL,
                "price_note": "City park playground access is typically free.",
                "is_free": True,
                "sort_order": 15,
            },
        )

    if add_water_play_feature:
        envelope.add(
            "venue_features",
            {
                "venue_id": venue_id,
                "slug": "official-city-splash-pad",
                "title": "Official city splash pad",
                "feature_type": "amenity",
                "description": (
                    f"Atlanta's official splash-pad roster includes {entry['name']} as a "
                    "city-operated warm-weather water-play stop."
                ),
                "url": SPLASH_PADS_URL,
                "price_note": "Seasonal water-play access varies by city operating schedule.",
                "is_free": True,
                "sort_order": 25,
            },
        )

    return envelope


def fetch_family_map(config: dict) -> tuple[int, int, int]:
    client = get_client()
    entries = _catalog_entries()
    details_added = 0
    features_added = 0

    for entry in entries:
        venue_id = _resolve_venue_id(client, entry)
        add_details = not _venue_has_destination_details(client, venue_id)
        add_playground_feature = "playground" in entry["overlay_types"] and not _venue_has_feature_signal(
            client, venue_id, PLAYGROUND_SIGNAL_KEYWORDS
        )
        add_water_play_feature = "water_play" in entry["overlay_types"] and not _venue_has_feature_signal(
            client, venue_id, WATER_PLAY_SIGNAL_KEYWORDS
        )

        envelope = _build_overlay_envelope(
            entry,
            venue_id,
            add_destination_details=add_details,
            add_playground_feature=add_playground_feature,
            add_water_play_feature=add_water_play_feature,
        )
        if not envelope.has_records():
            continue

        persist_result = persist_typed_entity_envelope(envelope)
        details_added += persist_result.persisted.get("destination_details", 0)
        features_added += persist_result.persisted.get("venue_features", 0)

    logger.info(
        "Atlanta family parks map: processed %s official venues, added %s destination detail rows and %s venue features",
        len(entries),
        details_added,
        features_added,
    )
    return 0, 0, 0


def crawl(config: dict) -> tuple[int, int, int]:
    return fetch_family_map(config)
