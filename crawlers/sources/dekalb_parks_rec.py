"""
Crawler for DeKalb County Recreation, Parks & Cultural Affairs — ACTIVENet catalog.
https://apm.activecommunities.com/dekalbcountyrecreation/Activity_Search

Covers programs at DeKalb County rec centers: summer camps, swim lessons, fitness
classes, seniors programs, youth sports leagues, arts & crafts, and special events.

Architecture note
-----------------
DeKalb's ACTIVENet portal lives at apm.activecommunities.com but the REST API
that powers its SPA is on anc.apm.activecommunities.com (same pattern as Atlanta DPR).
The same server-side session-cursor pagination applies: POST the identical body
repeatedly, the server advances 20 items per call.

See atlanta_dpr.py for the full pagination architecture description.
"""

from __future__ import annotations

import json as _json
import logging
import re
import time
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from sources._activecommunities_family_filter import (
    infer_activecommunities_schedule_time_range,
    normalize_activecommunities_age,
    parse_age_from_name,
)

logger = logging.getLogger(__name__)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

SITE_SLUG = "dekalbcountyrecreation"
ANT_BASE = f"https://anc.apm.activecommunities.com/{SITE_SLUG}"
APM_BASE = f"https://apm.activecommunities.com/{SITE_SLUG}"
ACTIVITY_SEARCH_URL = f"{APM_BASE}/Activity_Search"
# REST API endpoint is on anc. (not apm.) even though the site lives on apm.
API_URL = f"{ANT_BASE}/rest/activities/list?locale=en-US"

# DeKalb has ~410 records → ~21 pages of 20.  Allow up to 30 for growth.
MAX_PAGES = 35

REQUEST_DELAY = 0.75  # seconds between page fetches

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# ──────────────────────────────────────────────────────────────────────────────
# Generic org venue (fallback)
# ──────────────────────────────────────────────────────────────────────────────

GENERIC_VENUE = {
    "name": "DeKalb County Recreation, Parks & Cultural Affairs",
    "slug": "dekalb-county-recreation",
    "address": "1300 Commerce Dr",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7748,
    "lng": -84.2963,
    "place_type": "organization",
    "spot_type": "organization",
    "website": f"{APM_BASE}/Home",
}

# ──────────────────────────────────────────────────────────────────────────────
# Known DeKalb rec-center venues
# Coordinates sourced from Google Maps.
# ──────────────────────────────────────────────────────────────────────────────

REC_CENTER_VENUES: dict[str, dict] = {
    "mason mill": {
        "name": "Mason Mill Recreation Center",
        "slug": "mason-mill-recreation-center",
        "address": "1340 McConnell Dr",
        "neighborhood": "Druid Hills",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "lat": 33.8060,
        "lng": -84.3126,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "lucious sanders": {
        "name": "Lucious Sanders Recreation Center",
        "slug": "lucious-sanders-recreation-center",
        "address": "1275 Lena St NW",
        "neighborhood": "Clarkston",
        "city": "Clarkston",
        "state": "GA",
        "zip": "30021",
        "lat": 33.8140,
        "lng": -84.2407,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "n.h. scott": {
        "name": "N.H. Scott Recreation Center",
        "slug": "nh-scott-recreation-center",
        "address": "749 Rockbridge Rd SW",
        "neighborhood": "Lithonia",
        "city": "Lithonia",
        "state": "GA",
        "zip": "30058",
        "lat": 33.7116,
        "lng": -84.0888,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "nh scott": {
        "name": "N.H. Scott Recreation Center",
        "slug": "nh-scott-recreation-center",
        "address": "749 Rockbridge Rd SW",
        "neighborhood": "Lithonia",
        "city": "Lithonia",
        "state": "GA",
        "zip": "30058",
        "lat": 33.7116,
        "lng": -84.0888,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "glen haven": {
        "name": "Glen Haven Recreation Center",
        "slug": "glen-haven-recreation-center",
        "address": "1640 Flat Shoals Rd SE",
        "neighborhood": "Flat Shoals",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7217,
        "lng": -84.3220,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "browns mill": {
        "name": "Browns Mill Recreation Center",
        "slug": "browns-mill-recreation-center",
        "address": "765 Flat Shoals Rd SE",
        "neighborhood": "Flat Shoals",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7095,
        "lng": -84.3347,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "toomer": {
        "name": "Toomer Recreation Center",
        "slug": "toomer-recreation-center",
        "address": "2020 Montreal Rd",
        "neighborhood": "Tucker",
        "city": "Tucker",
        "state": "GA",
        "zip": "30084",
        "lat": 33.8596,
        "lng": -84.2023,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "scott candler": {
        "name": "Scott Candler Recreation Center",
        "slug": "scott-candler-recreation-center",
        "address": "1363 Pinehurst Dr",
        "neighborhood": "Scottdale",
        "city": "Scottdale",
        "state": "GA",
        "zip": "30079",
        "lat": 33.7756,
        "lng": -84.2568,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "stonecrest": {
        "name": "Stonecrest Recreation Center",
        "slug": "stonecrest-recreation-center",
        "address": "3035 Fairington Pkwy",
        "neighborhood": "Stonecrest",
        "city": "Stonecrest",
        "state": "GA",
        "zip": "30038",
        "lat": 33.6938,
        "lng": -84.0856,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "lithonia": {
        "name": "Lithonia Athletic Complex",
        "slug": "lithonia-athletic-complex",
        "address": "6678 Lithonia Industrial Blvd",
        "neighborhood": "Lithonia",
        "city": "Lithonia",
        "state": "GA",
        "zip": "30058",
        "lat": 33.7234,
        "lng": -84.0843,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "seminole": {
        "name": "Seminole Recreation Center",
        "slug": "seminole-recreation-center",
        "address": "2649 Bouldercrest Rd SE",
        "neighborhood": "Belvedere Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7128,
        "lng": -84.2990,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "dunaire": {
        "name": "Dunaire Recreation Center",
        "slug": "dunaire-recreation-center",
        "address": "3099 Evans Mill Rd",
        "neighborhood": "Clarkston",
        "city": "Clarkston",
        "state": "GA",
        "zip": "30021",
        "lat": 33.8189,
        "lng": -84.2340,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "clarkston": {
        "name": "Clarkston Community Center",
        "slug": "clarkston-community-center",
        "address": "3701 College Ave",
        "neighborhood": "Clarkston",
        "city": "Clarkston",
        "state": "GA",
        "zip": "30021",
        "lat": 33.8147,
        "lng": -84.2391,
        "place_type": "community_center",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "midvale": {
        "name": "Midvale Recreation Center",
        "slug": "midvale-recreation-center",
        "address": "525 Midvale Rd",
        "neighborhood": "Tucker",
        "city": "Tucker",
        "state": "GA",
        "zip": "30084",
        "lat": 33.8573,
        "lng": -84.2275,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "briarcliff": {
        "name": "Briarcliff Recreation Center",
        "slug": "briarcliff-recreation-center",
        "address": "1526 Briarcliff Rd NE",
        "neighborhood": "Briarcliff Heights",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.8044,
        "lng": -84.3365,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "young deer": {
        "name": "Young Deer Park",
        "slug": "young-deer-park",
        "address": "4280 Young Deer Dr",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30035",
        "lat": 33.7580,
        "lng": -84.2433,
        "place_type": "park",
        "spot_type": "park",
        "website": f"{APM_BASE}/Home",
    },
    "n/a": None,
}

# ──────────────────────────────────────────────────────────────────────────────
# Age-band tags
# ──────────────────────────────────────────────────────────────────────────────

_AGE_BANDS: list[tuple[str, int, int]] = [
    ("infant", 0, 1),
    ("toddler", 1, 3),
    ("preschool", 3, 5),
    ("elementary", 5, 12),
    ("tween", 10, 13),
    ("teen", 13, 18),
]


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 100
    return [
        tag for tag, band_lo, band_hi in _AGE_BANDS if lo <= band_hi and hi >= band_lo
    ]


# ──────────────────────────────────────────────────────────────────────────────
# Price extraction
# ──────────────────────────────────────────────────────────────────────────────

_PRICE_RE = re.compile(r"\$\s*([\d,]+(?:\.\d{1,2})?)")
_FREE_RE = re.compile(
    r"\bfree\b|\bno.?cost\b|\bno.?charge\b|\bcomplimentary\b", re.IGNORECASE
)


def _extract_prices(html: str) -> tuple[Optional[float], Optional[float], bool]:
    """
    Return (price_min, price_max, is_free) from HTML description.

    Non-zero dollar amounts take precedence over "free" language in the text
    (e.g. "FREE breakfast" should not override a $75 registration fee).
    """
    if not html:
        return None, None, False

    text = BeautifulSoup(html, "html.parser").get_text(" ")

    raw_prices = _PRICE_RE.findall(text)
    parsed: list[float] = []
    for p in raw_prices:
        try:
            parsed.append(float(p.replace(",", "")))
        except ValueError:
            pass

    nonzero = [v for v in parsed if v > 0]
    if nonzero:
        lo, hi = min(nonzero), max(nonzero)
        return lo, hi, False

    if not parsed:
        if _FREE_RE.search(text):
            return 0.0, 0.0, True
        return None, None, False

    return 0.0, 0.0, True


def _derive_schedule_fields(
    *,
    start_raw: Optional[str],
    end_raw: Optional[str],
    date_range_description: Optional[str],
    desc_text: Optional[str],
) -> tuple[Optional[str], Optional[str], bool]:
    """Infer schedule times from ActiveCommunities date-range text."""
    schedule_start_time, schedule_end_time = infer_activecommunities_schedule_time_range(
        date_range_description=date_range_description,
        desc_text=desc_text,
    )
    is_all_day = False if schedule_start_time else (True if not start_raw else False)
    if not start_raw and end_raw:
        is_all_day = True
    return schedule_start_time, schedule_end_time, is_all_day


# ──────────────────────────────────────────────────────────────────────────────
# Category / tag classification
# ──────────────────────────────────────────────────────────────────────────────


def _classify(
    name: str, desc_text: str, age_min: Optional[int], age_max: Optional[int]
) -> tuple[str, list[str]]:
    """Return (category, tags) for a DeKalb recreation activity."""
    combined = f"{name} {desc_text}".lower()
    tags: list[str] = ["educational", "community", "dekalb"]
    tags.extend(_age_band_tags(age_min, age_max))

    is_family = (
        (age_max is not None and age_max <= 18)
        or "youth" in combined
        or "kids" in combined
        or "children" in combined
        or "family" in combined
        or "junior" in combined
    )
    is_camp = bool(re.search(r"\bcamp\b", combined))
    is_swim = bool(re.search(r"\bswim\b|\baquatic\b|\bpool\b", combined))
    is_senior = bool(
        re.search(
            r"\bsenior\b|\bolder adult\b|\b55\+\b|\bprimetime\b|\bgold\b", combined
        )
    )
    is_fitness = bool(
        re.search(
            r"\bfitness\b|\bworkout\b|\byoga\b|\bzumba\b|\baerobic\b|\bgym\b|\bdance\b",
            combined,
        )
    )
    is_sport = bool(
        re.search(
            r"\bbasketball\b|\bsoccer\b|\btrack\b|\bfield\b|\btennis\b|\bvolleyball\b|\bsoftball\b|\bbaseball\b",
            combined,
        )
    )
    is_arts = bool(
        re.search(
            r"\bart\b|\bcraft\b|\bpainting\b|\bceramics\b|\bdrawing\b|\bsculpt\b",
            combined,
        )
    )

    if is_camp:
        tags.append("kids")
        return "programs", tags
    if is_senior:
        tags.append("adults")
        return "community", tags
    if is_swim:
        tags.append("kids" if is_family else "adults")
        return "fitness", tags
    if is_sport:
        tags.extend(["kids"] if is_family else [])
        return "fitness", tags
    if is_fitness:
        return "fitness", tags
    if is_arts:
        tags.append("hands-on")
        return "family" if is_family else "learning", tags
    if is_family:
        tags.append("kids")
        return "family", tags
    return "programs", tags


def _should_skip_dedicated_source(name: str, desc_text: str) -> bool:
    combined = f"{name} {desc_text}".lower()
    return (
        "aqua fit" in combined
        or "water fitness" in combined
        or "midway pickleball" in combined
        or "pickle ball at tobie grant" in combined
        or "line dance 101" in combined
    )


# ──────────────────────────────────────────────────────────────────────────────
# Date parsing
# ──────────────────────────────────────────────────────────────────────────────

_DATE_PREFIX_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})")


def _parse_date(raw: Optional[str]) -> Optional[str]:
    """Normalise an ACTIVENet date string to YYYY-MM-DD or return None."""
    if not raw:
        return None
    raw = str(raw).strip()
    m = _DATE_PREFIX_RE.match(raw)
    if m:
        return m.group(1)
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Venue resolution
# ──────────────────────────────────────────────────────────────────────────────


def _resolve_venue_data(location_label: str) -> dict:
    """
    Match an ACTIVENet location label to a known DeKalb rec-center venue.

    "N/A" and similar placeholders are treated as unknown → generic venue.
    """
    label_lower = location_label.lower().strip()

    if label_lower in {"n/a", "na", "tbd", "various", ""}:
        return GENERIC_VENUE

    for key, venue in REC_CENTER_VENUES.items():
        if venue is None:
            continue
        if key == "n/a":
            continue
        if key in label_lower:
            return venue
    return GENERIC_VENUE


def _build_destination_envelope(place_data: dict, venue_id: int) -> TypedEntityEnvelope | None:
    """Project touched DeKalb civic venues into shared destination details."""
    slug = str(place_data.get("slug") or "").strip()
    if not slug or slug == GENERIC_VENUE["slug"]:
        return None

    venue_type = str(place_data.get("place_type") or place_data.get("venue_type") or "").strip().lower()
    envelope = TypedEntityEnvelope()

    if venue_type in {"recreation", "community_center"}:
        envelope.add(
            "destination_details",
            {
                "place_id": venue_id,
                "destination_type": "community_recreation_center",
                "commitment_tier": "halfday",
                "primary_activity": "family recreation center visit",
                "best_seasons": ["spring", "summer", "fall", "winter"],
                "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip"],
                "parking_type": "free_lot",
                "best_time_of_day": "afternoon",
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Drop-in access and classes vary by center; confirm current programming and facility hours through DeKalb Recreation.",
                "source_url": ACTIVITY_SEARCH_URL,
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "place_type": venue_type,
                    "county": "dekalb",
                },
            },
        )
        envelope.add(
            "venue_features",
            {
                "place_id": venue_id,
                "slug": "indoor-family-recreation-space",
                "title": "Indoor family recreation space",
                "feature_type": "amenity",
                "description": "This DeKalb recreation center gives families an indoor recreation option with weather-proof community-center space and youth programming.",
                "url": ACTIVITY_SEARCH_URL,
                "price_note": "Drop-in access and building amenities vary by center.",
                "is_free": False,
                "sort_order": 10,
            },
        )
        envelope.add(
            "venue_features",
            {
                "place_id": venue_id,
                "slug": "family-classes-and-seasonal-camps",
                "title": "Family classes and seasonal camps",
                "feature_type": "experience",
                "description": "This DeKalb recreation center regularly hosts youth classes, family recreation programming, and seasonal camps.",
                "url": ACTIVITY_SEARCH_URL,
                "price_note": "Registration costs vary by program and season.",
                "is_free": False,
                "sort_order": 20,
            },
        )
        return envelope

    if venue_type == "park":
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
                "fee_note": "Open park access is free; classes, camps, and facility reservations vary by site.",
                "source_url": ACTIVITY_SEARCH_URL,
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "place_type": venue_type,
                    "county": "dekalb",
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
                "description": "This DeKalb park is a free family option for low-friction outdoor time, open-air play, and pairing with seasonal county programming.",
                "url": ACTIVITY_SEARCH_URL,
                "price_note": "Open park access is free.",
                "is_free": True,
                "sort_order": 10,
            },
        )
        return envelope

    return None


# ──────────────────────────────────────────────────────────────────────────────
# Session / API helpers
# ──────────────────────────────────────────────────────────────────────────────

_CSRF_RE = re.compile(r'window\.__csrfToken\s*=\s*"([^"]+)"')

ITEMS_PER_PAGE = 20

# Canonical search body — identical on every page request.
# Pagination is controlled via the `page_info` custom request header.
_SEARCH_BODY: dict = {
    "activity_search_pattern": {
        "skills": [],
        "time_after_str": "",
        "days_of_week": None,
        "activity_select_param": 2,
        "center_ids": [],
        "time_before_str": "",
        "open_spots": None,
        "activity_id": None,
        "activity_category_ids": [],
        "date_before": "",
        "min_age": None,
        "date_after": "",
        "activity_type_ids": [],
        "site_ids": [],
        "for_map": False,
        "geographic_area_ids": [],
        "season_ids": [],
        "activity_department_ids": [],
        "activity_other_category_ids": [],
        "child_season_ids": [],
        "activity_keyword": "",
        "instructor_ids": [],
        "max_age": None,
        "custom_price_from": "",
        "custom_price_to": "",
    },
    "activity_transfer_pattern": {},
}


def _init_session() -> tuple[Optional[requests.Session], Optional[str]]:
    """
    Create a fresh requests Session against the DeKalb ACTIVENet portal.

    DeKalb's site lives at apm.activecommunities.com but the REST API endpoint
    is on anc.apm.activecommunities.com (shared infrastructure pattern).
    We load the anc. host directly to ensure session cookies are correctly
    scoped to the anc. domain.

    Returns (session, csrf_token) on success, (None, None) on failure.
    """
    session = requests.Session()
    session.headers.update(HEADERS)

    # Load via anc. host so cookies are scoped to the correct domain
    anc_landing = f"{ANT_BASE}/Activity_Search"
    try:
        resp = session.get(anc_landing, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("DeKalb: failed to load landing page: %s", exc)
        return None, None

    m = _CSRF_RE.search(resp.text)
    if not m:
        logger.error("DeKalb: could not find __csrfToken in landing page")
        return None, None

    return session, m.group(1)


def _fetch_page(
    session: requests.Session, csrf: str, page_number: int
) -> Optional[tuple[list[dict], int, int]]:
    """
    POST to the DeKalb activities list API for the given page number.

    Pagination is controlled by the `page_info` custom request header.

    Returns (items, total_records, total_pages) on success, None on failure.
    """
    page_info_value = _json.dumps(
        {
            "order_by": "Name",
            "page_number": page_number,
            "total_records_per_page": ITEMS_PER_PAGE,
        }
    )
    api_headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json;charset=UTF-8",
        "X-CSRF-Token": csrf,
        "X-Requested-With": "XMLHttpRequest",
        "page_info": page_info_value,
        "Referer": f"{ANT_BASE}/Activity_Search",
        "Origin": "https://anc.apm.activecommunities.com",
    }
    try:
        resp = session.post(API_URL, json=_SEARCH_BODY, headers=api_headers, timeout=30)
        resp.raise_for_status()
        if "application/json" not in resp.headers.get("Content-Type", ""):
            logger.warning(
                "DeKalb API returned non-JSON: %s", resp.headers.get("Content-Type")
            )
            return None
    except requests.RequestException as exc:
        logger.warning("DeKalb API request failed (page %d): %s", page_number, exc)
        return None

    try:
        data = resp.json()
    except ValueError as exc:
        logger.warning("DeKalb API JSON parse error: %s", exc)
        return None

    response_code = data.get("headers", {}).get("response_code")
    if response_code != "0000":
        logger.warning("DeKalb API non-success code: %s", response_code)
        return None

    page_info = data.get("headers", {}).get("page_info", {})
    total_records = page_info.get("total_records", 0)
    total_pages = page_info.get("total_page", 1)
    items = data.get("body", {}).get("activity_items", [])

    return items, total_records, total_pages


# ──────────────────────────────────────────────────────────────────────────────
# Main crawl function
# ──────────────────────────────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl DeKalb County Recreation's ACTIVENet program catalog.

    Steps:
      1. Init session against the anc. host to get correct cookies + CSRF token.
      2. Fetch page 1 to discover total_pages, then fetch pages 1..total_pages.
         Each request uses a `page_info` custom header for explicit page selection.
      3. Resolve venue, extract dates/prices/tags, insert or update.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    today = date.today()
    venue_cache: dict[str, int] = {}

    session, csrf = _init_session()
    if not session or not csrf:
        return 0, 0, 0

    logger.info("DeKalb Rec: session initialised, starting page crawl")

    # Fetch page 1 to discover total_pages
    first = _fetch_page(session, csrf, 1)
    if first is None:
        logger.error("DeKalb: failed to fetch page 1")
        return 0, 0, 0

    _, total_records, total_pages = first
    total_pages = min(total_pages, MAX_PAGES)
    logger.info("DeKalb Rec: %d total records, %d pages", total_records, total_pages)

    for page_num in range(1, total_pages + 1):
        if page_num == 1:
            result = first  # already fetched
        else:
            time.sleep(REQUEST_DELAY)
            result = _fetch_page(session, csrf, page_num)
            if result is None:
                logger.warning("DeKalb: page %d fetch failed — stopping", page_num)
                break

        items, _, _ = result

        if not items:
            logger.info("DeKalb: empty page %d — stopping", page_num)
            break

        logger.debug("DeKalb: page %d/%d (%d items)", page_num, total_pages, len(items))

        for item in items:
            try:
                name: str = (item.get("name") or "").strip()
                if not name:
                    continue

                desc_html: str = item.get("desc") or ""
                soup = BeautifulSoup(desc_html, "html.parser")
                desc_text: str = soup.get_text(" ", strip=True)
                if _should_skip_dedicated_source(name, desc_text):
                    continue

                # Dates
                start_raw = _parse_date(item.get("date_range_start"))
                end_raw = _parse_date(item.get("date_range_end"))

                # Skip past events
                if start_raw:
                    try:
                        start_dt = datetime.strptime(start_raw, "%Y-%m-%d").date()
                        if start_dt < today and not end_raw:
                            continue
                    except ValueError:
                        pass

                if end_raw:
                    try:
                        end_dt = datetime.strptime(end_raw, "%Y-%m-%d").date()
                        if end_dt < today:
                            continue
                    except ValueError:
                        pass

                # Ages — ACTIVENet returns 0 (not None) when there is no age
                # restriction.  normalize_activecommunities_age converts 0 and
                # values >90 to None so we don't incorrectly filter or tag events.
                age_min: Optional[int] = normalize_activecommunities_age(item.get("age_min_year"))
                age_max: Optional[int] = normalize_activecommunities_age(item.get("age_max_year"))
                # Fallback: extract age range from the program name when the
                # API didn't supply structured age data.
                if age_min is None and age_max is None:
                    age_min, age_max = parse_age_from_name(name)

                # Venue
                location_label: str = item.get("location", {}).get("label") or ""
                venue_key = location_label.lower().strip()
                if venue_key not in venue_cache:
                    place_data = _resolve_venue_data(location_label)
                    venue_id = get_or_create_place(place_data)
                    destination_envelope = _build_destination_envelope(place_data, venue_id)
                    if destination_envelope is not None:
                        persist_typed_entity_envelope(destination_envelope)
                    venue_cache[venue_key] = venue_id
                venue_id = venue_cache[venue_key]

                # Price
                price_min, price_max, is_free = _extract_prices(desc_html)

                # Category / tags
                category, tags = _classify(name, desc_text, age_min, age_max)

                # Detail URL
                detail_url: str = item.get("detail_url") or ACTIVITY_SEARCH_URL

                # Description
                description: Optional[str] = desc_text[:1000] if desc_text else None
                schedule_start_time, schedule_end_time, is_all_day = _derive_schedule_fields(
                    start_raw=start_raw,
                    end_raw=end_raw,
                    date_range_description=item.get("date_range"),
                    desc_text=desc_text,
                )

                # Content hash
                activity_id = item.get("id")
                venue_name = _resolve_venue_data(location_label).get(
                    "name", "DeKalb County Recreation"
                )
                hash_key = start_raw if start_raw else str(activity_id)
                content_hash = generate_content_hash(name, venue_name, hash_key)

                event_record: dict = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": name,
                    "description": description,
                    "start_date": start_raw or today.strftime("%Y-%m-%d"),
                    "start_time": schedule_start_time,
                    "end_date": end_raw,
                    "end_time": schedule_end_time,
                    "is_all_day": is_all_day,
                    "category": category,
                    "subcategory": None,
                    "tags": tags,
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": None,
                    "is_free": is_free,
                    "source_url": detail_url,
                    "ticket_url": detail_url,
                    "image_url": None,
                    "raw_text": f"{name} | {location_label} | {item.get('ages', '')}",
                    "extraction_confidence": 0.88,
                    "is_recurring": bool(
                        end_raw and start_raw and end_raw != start_raw
                    ),
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }
                if age_min is not None:
                    event_record["age_min"] = age_min
                if age_max is not None:
                    event_record["age_max"] = age_max

                events_found += 1
                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                else:
                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.debug("Inserted: %s (%s)", name, start_raw or "no date")
                    except Exception as exc:
                        logger.error("Insert failed for %r: %s", name, exc)

            except Exception as exc:
                logger.error(
                    "DeKalb: error processing item %s: %s", item.get("id"), exc
                )
                continue

        time.sleep(REQUEST_DELAY)

    logger.info(
        "DeKalb Rec crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
