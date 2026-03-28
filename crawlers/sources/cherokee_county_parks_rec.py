"""
Crawler for Cherokee County Parks & Recreation (playcherokee.org / TheOttoApp).

Cherokee County runs its program catalog on TheOttoApp platform
(crpa.theottoapp.com), NOT on Rec1. This crawler uses the OttoApp public
REST API to pull classes, camps, events, and leagues directly.

Platform:  TheOttoApp
Org ID:    439
API base:  https://crpa.ottoplatform.com
Catalog:   https://crpa.theottoapp.com/public/org/439/catalog
Website:   https://www.playcherokee.org

API endpoint:
  GET https://crpa.ottoplatform.com/v1/public/item
      ?filter={"org":"439"}&limit=500

Response: JSONAPI-ish document with `data` (items) and `included` (prices, tags).

Item types handled:
  Class   → programs (with age ranges, schedule days)
  Camp    → programs (multi-day, age ranges)
  Event   → events (single date or short run)
  League  → events (first session date)
  Retail Item / Donation / Membership / Facility Rental → skipped

Major venues mapped:
  The Buzz         → L.B. "Buzz" Ahrens Jr. Recreation Center, Canton
  The WREC         → The WREC (South Annex), Woodstock
  CCAC             → Cherokee County Aquatic Center, Canton
  Hickory Flat Gym → Hickory Flat Community Gym
  Cherokee Veterans Park
  Cherokee Co Senior Center

County coverage: Canton, Woodstock, Acworth, Holly Springs (~300K residents)
"""

from __future__ import annotations

import html
import logging
import re
import time
from datetime import date, datetime, timezone
from typing import Optional

import requests

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    insert_program,
    infer_program_type,
    infer_season,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Platform constants
# ---------------------------------------------------------------------------

_API_BASE = "https://crpa.ottoplatform.com"
_ITEM_URL = f"{_API_BASE}/v1/public/item"
_ORG_ID = "439"
_CATALOG_URL = "https://crpa.theottoapp.com/public/org/439/catalog"
_WEBSITE_URL = "https://www.playcherokee.org"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Origin": "https://crpa.theottoapp.com",
    "Referer": "https://crpa.theottoapp.com/public/org/439/catalog",
}

# Item types to skip entirely (not programs or events)
_SKIP_TYPES = {"Retail Item", "Donation", "Membership", "Facility Rental"}

# Program types from OttoApp item_type field
_PROGRAM_TYPES = {"Class", "Camp"}
_EVENT_TYPES = {"Event", "League"}

_REQUEST_DELAY = 0.5  # Polite pause between API calls

# ---------------------------------------------------------------------------
# Source capabilities
# ---------------------------------------------------------------------------

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    programs=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

# ---------------------------------------------------------------------------
# Venue mapping — key is lowercase fragment of catalog_where_label
# ---------------------------------------------------------------------------

_VENUE_MAP: dict[str, dict] = {
    "the buzz": {
        "name": 'L.B. "Buzz" Ahrens Jr. Recreation Center',
        "slug": "buzz-ahrens-recreation-center-canton",
        "address": "1130 Univeter Rd",
        "neighborhood": "Canton",
        "city": "Canton",
        "state": "GA",
        "zip_code": "30115",
        "lat": 34.1826,
        "lng": -84.5205,
        "venue_type": "recreation",
        "website": _WEBSITE_URL,
        "vibes": ["family-friendly", "indoor", "recreation"],
    },
    "wrec": {
        "name": "The WREC (South Annex)",
        "slug": "wrec-south-annex-woodstock",
        "address": "945 Ridgewood Rd",
        "neighborhood": "Woodstock",
        "city": "Woodstock",
        "state": "GA",
        "zip_code": "30189",
        "lat": 34.1014,
        "lng": -84.5216,
        "venue_type": "recreation",
        "website": _WEBSITE_URL,
        "vibes": ["family-friendly", "indoor", "fitness"],
    },
    "ccac": {
        "name": "Cherokee County Aquatic Center",
        "slug": "cherokee-county-aquatic-center",
        "address": "7800 Cumming Hwy",
        "neighborhood": "Canton",
        "city": "Canton",
        "state": "GA",
        "zip_code": "30115",
        "lat": 34.1950,
        "lng": -84.5127,
        "venue_type": "recreation",
        "website": _WEBSITE_URL,
        "vibes": ["aquatics", "family-friendly", "swimming"],
    },
    "aquatic center": {
        "name": "Cherokee County Aquatic Center",
        "slug": "cherokee-county-aquatic-center",
        "address": "7800 Cumming Hwy",
        "neighborhood": "Canton",
        "city": "Canton",
        "state": "GA",
        "zip_code": "30115",
        "lat": 34.1950,
        "lng": -84.5127,
        "venue_type": "recreation",
        "website": _WEBSITE_URL,
        "vibes": ["aquatics", "family-friendly", "swimming"],
    },
    "hickory flat": {
        "name": "Hickory Flat Gymnasium",
        "slug": "hickory-flat-gymnasium",
        "address": "2626 Holly Springs Pkwy",
        "neighborhood": "Holly Springs",
        "city": "Canton",
        "state": "GA",
        "zip_code": "30115",
        "lat": 34.1461,
        "lng": -84.4799,
        "venue_type": "recreation",
        "website": _WEBSITE_URL,
        "vibes": ["family-friendly", "indoor"],
    },
    "veterans park": {
        "name": "Cherokee Veterans Park",
        "slug": "cherokee-veterans-park",
        "address": "7345 Cumming Hwy",
        "neighborhood": "Canton",
        "city": "Canton",
        "state": "GA",
        "zip_code": "30115",
        "lat": 34.1890,
        "lng": -84.5081,
        "venue_type": "park",
        "website": _WEBSITE_URL,
        "vibes": ["outdoor", "family-friendly", "park"],
    },
    "senior center": {
        "name": "Cherokee County Senior Center",
        "slug": "cherokee-county-senior-center",
        "address": "1130 Univeter Rd",
        "neighborhood": "Canton",
        "city": "Canton",
        "state": "GA",
        "zip_code": "30115",
        "lat": 34.1830,
        "lng": -84.5200,
        "venue_type": "community_center",
        "website": _WEBSITE_URL,
        "vibes": ["senior", "community", "indoor"],
    },
    "hobgood": {
        "name": "Hobgood Park",
        "slug": "hobgood-park-canton",
        "address": "3716 Holly Springs Pkwy",
        "neighborhood": "Canton",
        "city": "Canton",
        "state": "GA",
        "zip_code": "30114",
        "lat": 34.2105,
        "lng": -84.5021,
        "venue_type": "park",
        "website": _WEBSITE_URL,
        "vibes": ["outdoor", "park", "sports"],
    },
    "jj biello": {
        "name": "J.J. Biello Riverside Community Park",
        "slug": "jj-biello-riverside-community-park",
        "address": "2370 Marietta Hwy",
        "neighborhood": "Canton",
        "city": "Canton",
        "state": "GA",
        "zip_code": "30114",
        "lat": 34.2218,
        "lng": -84.5238,
        "venue_type": "park",
        "website": _WEBSITE_URL,
        "vibes": ["outdoor", "park", "sports"],
    },
    "bridgemill": {
        "name": "Bridgemill Community Center",
        "slug": "bridgemill-community-center",
        "address": "20 Bridgemill Ave",
        "neighborhood": "Canton",
        "city": "Canton",
        "state": "GA",
        "zip_code": "30114",
        "lat": 34.2020,
        "lng": -84.4620,
        "venue_type": "community_center",
        "website": _WEBSITE_URL,
        "vibes": ["community", "indoor"],
    },
    "cherokee tennis": {
        "name": "Cherokee Tennis Center",
        "slug": "cherokee-tennis-center",
        "address": "255 E Main St",
        "neighborhood": "Canton",
        "city": "Canton",
        "state": "GA",
        "zip_code": "30114",
        "lat": 34.2368,
        "lng": -84.4964,
        "venue_type": "recreation",
        "website": _WEBSITE_URL,
        "vibes": ["sports", "tennis", "outdoor"],
    },
}

# Default venue when no location match is found
_DEFAULT_VENUE = {
    "name": "Cherokee Recreation & Parks",
    "slug": "cherokee-recreation-parks",
    "address": "1130 Univeter Rd",
    "neighborhood": "Canton",
    "city": "Canton",
    "state": "GA",
    "zip_code": "30115",
    "lat": 34.1826,
    "lng": -84.5205,
    "venue_type": "organization",
    "website": _WEBSITE_URL,
    "vibes": ["family-friendly", "community", "recreation"],
}

# ---------------------------------------------------------------------------
# Venue resolution
# ---------------------------------------------------------------------------


def _resolve_venue(location_str: str) -> dict:
    """
    Match `catalog_where_label` against known venues using lowercase substring.

    Tries each key in _VENUE_MAP; first match wins. Falls back to the
    default venue when no match is found.
    """
    if not location_str:
        return _DEFAULT_VENUE
    loc_lower = location_str.lower().strip()
    for key, place_data in _VENUE_MAP.items():
        if key in loc_lower:
            return place_data
    return _DEFAULT_VENUE


# ---------------------------------------------------------------------------
# Date / price parsing
# ---------------------------------------------------------------------------


def _parse_iso_datetime(dt_str: Optional[str]) -> Optional[date]:
    """Parse ISO 8601 datetime string to date. Returns None on failure."""
    if not dt_str:
        return None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).date()
    except (ValueError, AttributeError):
        return None


def _parse_time_from_iso(dt_str: Optional[str]) -> Optional[str]:
    """Extract HH:MM time from ISO 8601 datetime (UTC → local naive string)."""
    if not dt_str:
        return None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        # OttoApp stores in UTC; for Eastern time subtract ~4-5h.
        # We store the raw UTC-derived HH:MM for now — the display layer
        # handles timezone-aware formatting.
        return dt.strftime("%H:%M")
    except (ValueError, AttributeError):
        return None


_PRICE_RE = re.compile(r"\$?\s*(\d+(?:\.\d{1,2})?)")


def _parse_price(
    price_str: Optional[str], primary_price: Optional[str]
) -> Optional[float]:
    """
    Parse price from catalog_pricing_label or primary_price data.

    catalog_pricing_label examples: "$65/$80", "$25", "225", "Free"
    primary_price is the minimum price string from the API.
    """
    # Use primary_price as the authoritative minimum when available
    if primary_price:
        try:
            return float(primary_price)
        except (ValueError, TypeError):
            pass

    if not price_str:
        return None

    lower = price_str.lower().strip()
    if "free" in lower:
        return 0.0

    prices = _PRICE_RE.findall(price_str)
    if prices:
        vals = [float(p) for p in prices]
        return min(vals)  # Return the minimum (resident) price

    return None


def _is_free(price_str: Optional[str], price_amount: Optional[float]) -> bool:
    """Return True when the program/event is free."""
    if price_amount is not None and price_amount == 0.0:
        return True
    if price_str and "free" in price_str.lower():
        return True
    return False


# ---------------------------------------------------------------------------
# Category inference from item type
# ---------------------------------------------------------------------------

_OTTO_TYPE_TO_CATEGORY = {
    "Class": "programs",
    "Camp": "programs",
    "Event": "family",
    "League": "sports",
}


def _infer_category(item_type: str, title: str) -> str:
    """Map OttoApp item type + title keywords to LostCity event category."""
    base = _OTTO_TYPE_TO_CATEGORY.get(item_type, "community")

    title_lower = title.lower()
    if any(kw in title_lower for kw in ("swim", "aquatic", "pool", "water")):
        return "sports"
    if any(
        kw in title_lower for kw in ("dance", "ballet", "yoga", "gymnastics", "cheer")
    ):
        return "programs"
    if any(
        kw in title_lower
        for kw in (
            "soccer",
            "basketball",
            "tennis",
            "football",
            "baseball",
            "softball",
            "volleyball",
            "pickleball",
            "lacrosse",
        )
    ):
        return "sports"
    if any(
        kw in title_lower
        for kw in ("art", "paint", "craft", "music", "theater", "drama")
    ):
        return "arts"
    if any(kw in title_lower for kw in ("concert", "festival", "show", "performance")):
        return "music"
    if any(
        kw in title_lower for kw in ("5k", "run", "race", "walk", "hike", "fitness")
    ):
        return "sports"
    return base


# ---------------------------------------------------------------------------
# Age range parsing
# ---------------------------------------------------------------------------


def _parse_age_range(
    ia: dict,
) -> tuple[Optional[int], Optional[int]]:
    """Extract age_min and age_max from item_attributes dict."""
    age_min = ia.get("age_min")
    age_max = ia.get("age_max")

    try:
        age_min = int(float(age_min)) if age_min else None
    except (ValueError, TypeError):
        age_min = None

    try:
        age_max = int(float(age_max)) if age_max else None
    except (ValueError, TypeError):
        age_max = None

    return age_min, age_max


# ---------------------------------------------------------------------------
# Destination / venue-feature envelope
# ---------------------------------------------------------------------------


def _build_destination_envelope(
    place_data: dict, venue_id: int
) -> Optional[TypedEntityEnvelope]:
    """Emit destination_details + venue_features for recreation venues."""
    venue_type = place_data.get("venue_type", "")
    if venue_type not in {"recreation", "community_center", "park"}:
        return None

    envelope = TypedEntityEnvelope()
    source_url = place_data.get("website", _CATALOG_URL)

    if venue_type == "park":
        envelope.add(
            "destination_details",
            {
                "venue_id": venue_id,
                "destination_type": "park",
                "commitment_tier": "halfday",
                "primary_activity": "family outdoor recreation",
                "best_seasons": ["spring", "summer", "fall"],
                "weather_fit_tags": ["outdoor", "free-option", "family-daytrip"],
                "parking_type": "free_lot",
                "best_time_of_day": "morning",
                "practical_notes": (
                    f"{place_data['name']} is a Cherokee County park suited for "
                    "morning outdoor family time, sports, or seasonal county programming."
                ),
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Open park access is free; registered programs vary.",
                "source_url": source_url,
                "metadata": {"source_type": "family_destination_enrichment"},
            },
        )
        envelope.add(
            "venue_features",
            {
                "venue_id": venue_id,
                "slug": "free-outdoor-park-access",
                "title": "Free outdoor park access",
                "feature_type": "amenity",
                "description": (
                    f"{place_data['name']} provides free Cherokee County outdoor space "
                    "for family play, sports, and seasonal recreation programs."
                ),
                "url": source_url,
                "is_free": True,
                "sort_order": 10,
            },
        )
    else:
        # Indoor rec center / community center
        envelope.add(
            "destination_details",
            {
                "venue_id": venue_id,
                "destination_type": "community_recreation_center",
                "commitment_tier": "halfday",
                "primary_activity": "family recreation center visit",
                "best_seasons": ["spring", "summer", "fall", "winter"],
                "weather_fit_tags": [
                    "indoor",
                    "rainy-day",
                    "heat-day",
                    "family-daytrip",
                ],
                "parking_type": "free_lot",
                "best_time_of_day": "afternoon",
                "practical_notes": (
                    f"{place_data['name']} is a weather-proof Cherokee County family "
                    "recreation base for classes, camps, and structured youth programming."
                ),
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Programs vary by season; check playcherokee.org for current offerings.",
                "source_url": source_url,
                "metadata": {"source_type": "family_destination_enrichment"},
            },
        )
        envelope.add(
            "venue_features",
            {
                "venue_id": venue_id,
                "slug": "indoor-family-recreation-space",
                "title": "Indoor family recreation space",
                "feature_type": "amenity",
                "description": (
                    f"{place_data['name']} offers indoor Cherokee County recreation space "
                    "with weather-proof youth programming, classes, and camps."
                ),
                "url": source_url,
                "is_free": False,
                "sort_order": 10,
            },
        )
        envelope.add(
            "venue_features",
            {
                "venue_id": venue_id,
                "slug": "family-classes-and-seasonal-camps",
                "title": "Family classes and seasonal camps",
                "feature_type": "experience",
                "description": (
                    f"{place_data['name']} regularly hosts youth classes, family programs, "
                    "and seasonal camps through Cherokee Recreation & Parks."
                ),
                "url": source_url,
                "is_free": False,
                "sort_order": 20,
            },
        )

    return envelope


# ---------------------------------------------------------------------------
# API fetch
# ---------------------------------------------------------------------------


def _fetch_items(session: requests.Session) -> list[dict]:
    """
    Fetch all published items from the OttoApp API.

    Uses filter={"org":"439"} with limit=500 (well above the current 387-item
    catalog; increase limit if Cherokee County expands significantly).
    """
    import urllib.parse

    filter_json = urllib.parse.quote('{"org":"439"}')
    url = f"{_ITEM_URL}?filter={filter_json}&limit=500"

    try:
        resp = session.get(url, headers=_HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.RequestException as exc:
        logger.error("Cherokee OttoApp API request failed: %s", exc)
        return []
    except ValueError as exc:
        logger.error("Cherokee OttoApp API returned non-JSON: %s", exc)
        return []

    items = data.get("data", [])
    logger.info("Cherokee OttoApp: fetched %d items", len(items))
    return items


# ---------------------------------------------------------------------------
# Single-item processing helpers
# ---------------------------------------------------------------------------


def _clean_html(text: Optional[str]) -> Optional[str]:
    """Strip simple HTML tags and unescape HTML entities."""
    if not text:
        return None
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip() or None


def _build_registration_url(item_id: str) -> str:
    """Direct link into the OttoApp public catalog for this item."""
    return f"https://crpa.theottoapp.com/public/org/439/item/{item_id}"


# ---------------------------------------------------------------------------
# Program processing (Class / Camp)
# ---------------------------------------------------------------------------


def _process_program(
    item: dict,
    source: dict,
    today: date,
    venue_id_cache: dict[str, int],
) -> Optional[str]:
    """
    Convert one OttoApp Class/Camp item to a program record.
    Returns the program UUID (new or existing), or None on skip.
    """
    attrs = item["attributes"]
    ia = attrs.get("item_attributes", {})
    item_data = attrs.get("data", {})

    name = _clean_html(attrs.get("name", "")).strip()
    if not name:
        return None

    # Require a future start date
    first_event_str = item_data.get("first_event")
    session_start_date = _parse_iso_datetime(first_event_str)
    reg_end_str = ia.get("reg_end_dtm")
    reg_end_date = _parse_iso_datetime(reg_end_str)

    # Use reg_end as a proxy for session end when first_event is the only date
    session_end_date = reg_end_date

    if session_start_date and session_start_date < today:
        # Already started — only skip if ALSO past registration close
        if reg_end_date and reg_end_date < today:
            logger.debug("Skipping past program: %s", name)
            return None

    if not session_start_date and not reg_end_date:
        logger.debug("Skipping program with no dates: %s", name)
        return None

    # Use the latest available date as the canonical start
    canonical_start = session_start_date or reg_end_date

    location_str = ia.get("catalog_where_label", "")
    place_data = _resolve_venue(location_str)
    venue_cache_key = place_data["slug"]
    if venue_cache_key not in venue_id_cache:
        venue_id_cache[venue_cache_key] = get_or_create_place(place_data)
    venue_id = venue_id_cache[venue_cache_key]

    # Destination envelope (once per unique venue)
    if f"dest:{venue_cache_key}" not in venue_id_cache:
        envelope = _build_destination_envelope(place_data, venue_id)
        if envelope:
            persist_typed_entity_envelope(envelope)
        venue_id_cache[f"dest:{venue_cache_key}"] = 1

    item_type = ia.get("item_type", "Class")
    program_type = infer_program_type(name, section_name=item_type.lower())
    season = infer_season(name, canonical_start)

    # Price
    primary_price = item_data.get("primary_price", {})
    price_raw = primary_price.get("price") if primary_price else None
    price_label = ia.get("catalog_pricing_label", "")
    price_amount = _parse_price(price_label, price_raw)
    free = _is_free(price_label, price_amount)

    age_min, age_max = _parse_age_range(ia)

    reg_start_str = ia.get("reg_start_dtm")
    reg_start_date = _parse_iso_datetime(reg_start_str)
    reg_end_for_program = _parse_iso_datetime(reg_end_str)

    # Registration status
    if reg_end_for_program and reg_end_for_program < today:
        reg_status = "closed"
    elif reg_start_date and reg_start_date > today:
        reg_status = "upcoming"
    else:
        reg_status = "open"

    source_id = source.get("id")
    description = _clean_html(attrs.get("description", ""))

    program_data = {
        "source_id": source_id,
        "venue_id": venue_id,
        "name": name,
        "description": description,
        "program_type": program_type,
        "provider_name": "Cherokee Recreation & Parks",
        "age_min": age_min,
        "age_max": age_max,
        "season": season,
        "session_start": canonical_start.isoformat() if canonical_start else None,
        "session_end": session_end_date.isoformat() if session_end_date else None,
        "cost_amount": price_amount,
        "cost_period": "per_session" if free else "per_season",
        "cost_notes": price_label or None,
        "registration_status": reg_status,
        "registration_opens": reg_start_date.isoformat() if reg_start_date else None,
        "registration_closes": (
            reg_end_for_program.isoformat() if reg_end_for_program else None
        ),
        "registration_url": _build_registration_url(item["id"]),
        "status": "active",
        "tags": ["cherokee-county", "family", item_type.lower()],
        "metadata": {
            "otto_item_id": item["id"],
            "otto_org_id": _ORG_ID,
            "item_type": item_type,
            "location_raw": location_str,
        },
    }

    return insert_program(program_data)


# ---------------------------------------------------------------------------
# Event processing (Event / League)
# ---------------------------------------------------------------------------


def _process_event(
    item: dict,
    source: dict,
    today: date,
    venue_id_cache: dict[str, int],
) -> bool:
    """
    Convert one OttoApp Event/League item to an event record.
    Returns True if a new event was inserted.
    """
    attrs = item["attributes"]
    ia = attrs.get("item_attributes", {})
    item_data = attrs.get("data", {})

    title = _clean_html(attrs.get("name", "")).strip()
    if not title:
        return False

    first_event_str = item_data.get("first_event")
    start_date = _parse_iso_datetime(first_event_str)
    reg_end_str = ia.get("reg_end_dtm")
    reg_end_date = _parse_iso_datetime(reg_end_str)

    # Require a future or recently-started date
    if start_date and start_date < today:
        # Tolerate up to 3 days past start (multi-day events may still be running)
        days_past = (today - start_date).days
        if days_past > 3:
            logger.debug("Skipping past event: %s (%s)", title, start_date)
            return False
    elif not start_date:
        if reg_end_date and reg_end_date < today:
            logger.debug("Skipping event with no start date and past reg: %s", title)
            return False
        if not reg_end_date:
            logger.debug("Skipping event with no dates: %s", title)
            return False

    canonical_date = start_date or reg_end_date
    start_time = _parse_time_from_iso(first_event_str)

    location_str = ia.get("catalog_where_label", "")
    place_data = _resolve_venue(location_str)
    venue_cache_key = place_data["slug"]
    if venue_cache_key not in venue_id_cache:
        venue_id_cache[venue_cache_key] = get_or_create_place(place_data)
    venue_id = venue_id_cache[venue_cache_key]

    # Destination envelope (once per unique venue)
    if f"dest:{venue_cache_key}" not in venue_id_cache:
        envelope = _build_destination_envelope(place_data, venue_id)
        if envelope:
            persist_typed_entity_envelope(envelope)
        venue_id_cache[f"dest:{venue_cache_key}"] = 1

    item_type = ia.get("item_type", "Event")
    category = _infer_category(item_type, title)

    primary_price = item_data.get("primary_price", {})
    price_raw = primary_price.get("price") if primary_price else None
    price_label = ia.get("catalog_pricing_label", "")
    price_amount = _parse_price(price_label, price_raw)
    free = _is_free(price_label, price_amount)

    age_min, age_max = _parse_age_range(ia)
    description = _clean_html(attrs.get("description", ""))
    source_url = _build_registration_url(item["id"])
    photo_url = attrs.get("photo_url") or None

    # OttoApp default image — not useful, skip it
    if photo_url and "otto-org-images.s3.amazonaws.com/6b7420de" in photo_url:
        photo_url = None

    content_hash = generate_content_hash(
        title, place_data["name"], canonical_date.isoformat()
    )
    existing = find_event_by_hash(content_hash)
    if existing:
        smart_update_existing_event(
            existing,
            {
                "title": title,
                "description": description,
                "start_date": canonical_date.isoformat(),
                "start_time": start_time,
                "source_url": source_url,
                "image_url": photo_url,
            },
        )
        return False

    event_record = {
        "title": title,
        "description": description,
        "category": category,
        "start_date": canonical_date.isoformat(),
        "start_time": start_time,
        "source_url": source_url,
        "source_id": source.get("id"),
        "venue_id": venue_id,
        "image_url": photo_url,
        "is_free": free,
        "price_min": price_amount if not free else None,
        "age_min": age_min,
        "age_max": age_max,
        "tags": ["cherokee-county", "family", item_type.lower()],
        "content_hash": content_hash,
        "metadata": {
            "otto_item_id": item["id"],
            "otto_org_id": _ORG_ID,
            "item_type": item_type,
            "location_raw": location_str,
            "price_label": price_label,
        },
    }

    insert_event(event_record)
    return True


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Cherokee Recreation & Parks programs and events from TheOttoApp.

    Returns (found, new_events, new_programs).
    Note: new_events and new_programs are combined into the second and third
    return values to match the standard (found, new, updated) contract —
    programs inserted are counted in `new`, events inserted in `new`,
    programs/events updated in `updated`.
    """
    logger.info("Starting Cherokee County Parks & Recreation (OttoApp) crawl")

    today = date.today()
    session = requests.Session()

    items = _fetch_items(session)
    if not items:
        logger.warning("Cherokee OttoApp: no items returned")
        return 0, 0, 0

    # Filter to publishable, future-facing items
    actionable = [
        item
        for item in items
        if item.get("attributes", {})
        .get("item_attributes", {})
        .get("publish", "")
        .lower()
        == "true"
        and item.get("attributes", {}).get("item_attributes", {}).get("item_type")
        not in _SKIP_TYPES
    ]

    logger.info(
        "Cherokee OttoApp: %d items total, %d publishable after filtering",
        len(items),
        len(actionable),
    )

    venue_id_cache: dict[str, int] = {}
    found = len(actionable)
    new_count = 0
    updated_count = 0

    for item in actionable:
        ia = item.get("attributes", {}).get("item_attributes", {})
        item_type = ia.get("item_type", "")

        try:
            if item_type in _PROGRAM_TYPES:
                result = _process_program(item, source, today, venue_id_cache)
                if result:
                    new_count += 1
                else:
                    updated_count += 1
            elif item_type in _EVENT_TYPES:
                inserted = _process_event(item, source, today, venue_id_cache)
                if inserted:
                    new_count += 1
                else:
                    updated_count += 1
        except Exception:
            title = item.get("attributes", {}).get("name", "<unknown>")
            logger.exception(
                "Error processing Cherokee item %r (id=%s)", title, item.get("id")
            )

        time.sleep(_REQUEST_DELAY)

    logger.info(
        "Cherokee OttoApp: found=%d new=%d updated=%d",
        found,
        new_count,
        updated_count,
    )
    return found, new_count, updated_count
