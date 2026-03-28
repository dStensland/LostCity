"""
Crawler for Atlanta Department of Parks & Recreation — ACTIVENet program catalog.
https://anc.apm.activecommunities.com/atlantadprca/Activity_Search

This is the city's registration system for rec-center programs, camps, swim lessons,
fitness classes, aquatics, senior programs, and youth sports.  It is DIFFERENT from
the atlanta_parks_rec.py source which scrapes the Atlanta.gov city calendar.

Architecture
------------
ACTIVENet is a React SPA with server-side session paging.  The REST endpoint
  POST /rest/activities/list
returns 20 items per request.  Pagination is controlled by the server session —
each subsequent POST (same session cookies, identical body) advances the cursor one
page forward.  The only reliable way to drain all pages without Playwright is to
reuse a single requests.Session and POST the same payload 40 times sequentially.
We drive up to MAX_PAGES pages with a brief delay between each.

Fields available per activity item
-----------------------------------
- name                   Activity title
- desc                   Rich HTML description (contains price info, age, venue)
- date_range_start       ISO date string (may be empty for ongoing programs)
- date_range_end         ISO date string (may be empty)
- date_range             Human-readable date string fallback
- location.label         Rec center / facility name
- age_min_year           Integer age minimum in years
- age_max_year           Integer age maximum in years
- ages                   Human-readable age string
- detail_url             Full URL to the registration/detail page
- id                     ACTIVENet activity ID (used in content hash)

Venue mapping
-------------
Each activity location is mapped to a rec center venue.  Unknown locations are
mapped to a generic "Atlanta DPR" org venue so the event is still discoverable.
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
    is_family_relevant_activity,
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

# The ACTIVENet SPA lives at apm.activecommunities.com but the REST API is on anc.
SITE_SLUG = "atlantadprca"
ANT_BASE = f"https://anc.apm.activecommunities.com/{SITE_SLUG}"
APM_BASE = f"https://apm.activecommunities.com/{SITE_SLUG}"
ACTIVITY_SEARCH_URL = f"{ANT_BASE}/Activity_Search"
API_URL = f"{ANT_BASE}/rest/activities/list?locale=en-US"

# The server caps at 20 items per page and uses server-side session cursor.
# 784 records / 20 per page = 40 pages.  Allow up to 50 for growth.
MAX_PAGES = 50

REQUEST_DELAY = 0.75  # seconds between page fetches (polite, well under rate limit)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

_DEDICATED_SOURCE_KEYWORDS = (
    "open gym",
    "adult swim lessons",
    "water aerobics",
    "water awareness",
)

# ──────────────────────────────────────────────────────────────────────────────
# Fallback / generic org venue
# ──────────────────────────────────────────────────────────────────────────────

GENERIC_VENUE = {
    "name": "Atlanta Department of Parks & Recreation",
    "slug": "atlanta-dept-parks-recreation",
    "address": "233 Peachtree St NE Ste 1800",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7530,
    "lng": -84.3880,
    "place_type": "organization",
    "spot_type": "organization",
    "website": f"{APM_BASE}/Home",
}

# ──────────────────────────────────────────────────────────────────────────────
# Known rec-center venues
# Coordinates and neighborhoods sourced from Google Maps.
# ──────────────────────────────────────────────────────────────────────────────

REC_CENTER_VENUES: dict[str, dict] = {
    # ── Aquatic / recreation centers ──────────────────────────────────────────
    "ct martin": {
        "name": "CT Martin Recreation & Aquatic Center",
        "slug": "ct-martin-recreation-center",
        "address": "3591 Martin Luther King Jr Dr SW",
        "neighborhood": "Adamsville",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30331",
        "lat": 33.7395,
        "lng": -84.4900,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "rosel fann": {
        "name": "Rosel Fann Recreation & Aquatic Center",
        "slug": "rosel-fann-recreation-center",
        "address": "971 Cascade Rd SW",
        "neighborhood": "Cascade Heights",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30311",
        "lat": 33.7225,
        "lng": -84.4250,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "m.l. king": {
        "name": "MLK Jr. Recreation & Aquatic Center",
        "slug": "mlk-recreation-center",
        "address": "1000 John Wesley Dobbs Ave NE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7583,
        "lng": -84.3724,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "mlk jr": {
        "name": "MLK Jr. Recreation & Aquatic Center",
        "slug": "mlk-recreation-center",
        "address": "1000 John Wesley Dobbs Ave NE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7583,
        "lng": -84.3724,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "washington park": {
        "name": "Washington Park Aquatic Center",
        "slug": "washington-park-aquatic-center",
        "address": "1125 Lena St NW",
        "neighborhood": "Vine City",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30314",
        "lat": 33.7560,
        "lng": -84.4148,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "lake allatoona": {
        "name": "Lake Allatoona Rec Camp",
        "slug": "lake-allatoona-rec-camp",
        "address": "Lake Allatoona, Cartersville, GA",
        "neighborhood": "Cartersville",
        "city": "Cartersville",
        "state": "GA",
        "zip": "30120",
        "lat": 34.1550,
        "lng": -84.7100,
        "place_type": "park",
        "spot_type": "park",
        "website": f"{APM_BASE}/Home",
    },
    "piedmont": {
        "name": "Piedmont Park Athletic Center",
        "slug": "piedmont-park-athletic-center",
        "address": "400 Park Dr NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7874,
        "lng": -84.3733,
        "place_type": "recreation",
        "spot_type": "park",
        "website": f"{APM_BASE}/Home",
    },
    "grove park": {
        "name": "Grove Park Recreation Center",
        "slug": "grove-park-recreation-center",
        "address": "1250 Donald Lee Hollowell Pkwy NW",
        "neighborhood": "Grove Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7748,
        "lng": -84.4362,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "john a white": {
        "name": "John A. White Park",
        "slug": "john-a-white-park",
        "address": "1127 Cascade Cir SW",
        "neighborhood": "Cascade Heights",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30311",
        "lat": 33.7148,
        "lng": -84.4370,
        "place_type": "park",
        "spot_type": "park",
        "website": f"{APM_BASE}/Home",
    },
    "brownwood": {
        "name": "Brownwood Recreation Center",
        "slug": "brownwood-recreation-center",
        "address": "2200 Brownwood Ave SE",
        "neighborhood": "Ormewood Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7254,
        "lng": -84.3568,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "summerhill": {
        "name": "Summerhill Recreation Center",
        "slug": "summerhill-recreation-center",
        "address": "409 Cherokee Ave SE",
        "neighborhood": "Summerhill",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7387,
        "lng": -84.3780,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "west manor": {
        "name": "West Manor Park",
        "slug": "west-manor-park",
        "address": "1399 Westmont Rd SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30311",
        "lat": 33.7267,
        "lng": -84.4163,
        "place_type": "park",
        "spot_type": "park",
        "website": f"{APM_BASE}/Home",
    },
    "ben hill": {
        "name": "Ben Hill Recreation Center",
        "slug": "ben-hill-recreation-center",
        "address": "2851 Butner Rd SW",
        "neighborhood": "Ben Hill",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30331",
        "lat": 33.6891,
        "lng": -84.5031,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "carey park": {
        "name": "Carey Park Recreation Center",
        "slug": "carey-park-recreation-center",
        "address": "860 Carey Dr SW",
        "neighborhood": "Westview",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30310",
        "lat": 33.7272,
        "lng": -84.4309,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "c.a. scott": {
        "name": "C.A. Scott Recreation Center",
        "slug": "ca-scott-recreation-center",
        "address": "585 Hill St SE",
        "neighborhood": "Mechanicsville",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7350,
        "lng": -84.3849,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "ca scott": {
        "name": "C.A. Scott Recreation Center",
        "slug": "ca-scott-recreation-center",
        "address": "585 Hill St SE",
        "neighborhood": "Mechanicsville",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7350,
        "lng": -84.3849,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "pittman": {
        "name": "Pittman Park Recreation Center",
        "slug": "pittman-park-recreation-center",
        "address": "801 Memorial Dr SE",
        "neighborhood": "Reynoldstown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7493,
        "lng": -84.3617,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "gresham": {
        "name": "Gresham Park Recreation Center",
        "slug": "gresham-park-recreation-center",
        "address": "2514 Gresham Rd SE",
        "neighborhood": "Gresham Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7033,
        "lng": -84.3187,
        "place_type": "recreation",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "@promise": {
        "name": "@ Promise Youth Program Center",
        "slug": "at-promise-youth-center",
        "address": "233 Peachtree St NE",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7530,
        "lng": -84.3880,
        "place_type": "organization",
        "spot_type": "community_center",
        "website": f"{APM_BASE}/Home",
    },
    "n/a": None,  # Explicitly mark as use generic
}

_AQUATIC_CENTER_SLUGS = {
    "ct-martin-recreation-center",
    "rosel-fann-recreation-center",
    "mlk-recreation-center",
    "washington-park-aquatic-center",
}

_COMMUNITY_CENTER_SLUGS = {
    "grove-park-recreation-center",
    "brownwood-recreation-center",
    "summerhill-recreation-center",
    "ben-hill-recreation-center",
    "carey-park-recreation-center",
    "ca-scott-recreation-center",
    "pittman-park-recreation-center",
    "gresham-park-recreation-center",
    "at-promise-youth-center",
}

_PARK_SLUGS = {
    "john-a-white-park",
    "west-manor-park",
    "piedmont-park-athletic-center",
    "lake-allatoona-rec-camp",
}

# ──────────────────────────────────────────────────────────────────────────────
# Age-band tags (mirrors childrens_museum.py / puppetry_arts.py)
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
# Price extraction helpers
# ──────────────────────────────────────────────────────────────────────────────

_PRICE_RE = re.compile(r"\$\s*([\d,]+(?:\.\d{1,2})?)")
_FREE_RE = re.compile(
    r"\bfree\b|\bno.?cost\b|\bno.?charge\b|\bcomplimentary\b", re.IGNORECASE
)


def _extract_prices(html: str) -> tuple[Optional[float], Optional[float], bool]:
    """
    Return (price_min, price_max, is_free) from the HTML description.

    Strategy:
    - Parse all $X.XX amounts first.  If any non-zero prices exist, return the
      min/max range — even if "free" appears in the text (e.g. "FREE breakfast").
    - Only declare is_free=True when there are no dollar amounts AND "free" (or
      similar) appears, OR all discovered dollar amounts are $0.
    - "Resident" prices are typically lower than "Non-Resident"; the range captures both.
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

    # Non-zero prices found — trust the dollar amounts over any "free" text
    nonzero = [v for v in parsed if v > 0]
    if nonzero:
        lo, hi = min(nonzero), max(nonzero)
        return lo, hi, False

    # No dollar amounts at all — look for "free" language
    if not parsed:
        if _FREE_RE.search(text):
            return 0.0, 0.0, True
        return None, None, False

    # All dollar amounts are $0
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
# Category / tag helpers
# ──────────────────────────────────────────────────────────────────────────────


def _classify(
    name: str, desc_text: str, age_min: Optional[int], age_max: Optional[int]
) -> tuple[str, list[str]]:
    """
    Return (category, tags) for an Atlanta DPR activity.

    Category logic:
    - Camps / structured sessions → "programs"
    - Youth / family activities → "family"
    - Adult / senior fitness → "fitness"
    - Aquatics → "fitness"
    - Community events → "community"
    """
    combined = f"{name} {desc_text}".lower()
    tags: list[str] = ["educational", "community"]
    tags.extend(_age_band_tags(age_min, age_max))

    is_family = (
        age_max is not None
        and age_max <= 18
        or "youth" in combined
        or "kids" in combined
        or "children" in combined
        or "family" in combined
    )
    is_camp = bool(re.search(r"\bcamp\b", combined))
    is_swim = bool(re.search(r"\bswim\b|\baquatic\b|\bpool\b", combined))
    is_senior = bool(
        re.search(r"\bsenior\b|\bolder adult\b|\b55\+\b|\bprimetime\b", combined)
    )
    is_fitness = bool(
        re.search(
            r"\bfitness\b|\bworkout\b|\byoga\b|\bzumba\b|\baerobic\b|\bgym\b", combined
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
    if is_fitness:
        return "fitness", tags
    if is_family:
        tags.append("kids")
        return "family", tags
    return "programs", tags


# ──────────────────────────────────────────────────────────────────────────────
# Date parsing
# ──────────────────────────────────────────────────────────────────────────────

_DATE_PREFIX_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})")


def _parse_date(raw: Optional[str]) -> Optional[str]:
    """
    Normalise an ACTIVENet date string to YYYY-MM-DD or return None.

    Input may be:
    - "2026-06-08 00:00:00"  → "2026-06-08"
    - "2026-06-08"           → "2026-06-08"
    - ""                     → None
    """
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
    Match an ACTIVENet location label to a known rec-center venue dict.
    Falls back to GENERIC_VENUE if no match is found.

    Keys with None values (e.g. "n/a") are explicitly skipped so they don't
    accidentally match a substring in a real venue name.
    """
    label_lower = location_label.lower().strip()

    # Explicit non-venue labels → use generic immediately
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
    """Project Atlanta DPR city venues into shared Family destination intelligence."""
    slug = str(place_data.get("slug") or "").strip()
    if not slug or slug == GENERIC_VENUE["slug"]:
        return None

    venue_name = str(place_data.get("name") or "Atlanta DPR family venue").strip()
    envelope = TypedEntityEnvelope()

    if slug in _AQUATIC_CENTER_SLUGS:
        envelope.add(
            "destination_details",
            {
                "place_id": venue_id,
                "destination_type": "aquatic_center",
                "commitment_tier": "halfday",
                "primary_activity": "family aquatic center visit",
                "best_seasons": ["spring", "summer"],
                "weather_fit_tags": ["indoor-option", "heat-day", "family-daytrip"],
                "parking_type": "free_lot",
                "best_time_of_day": "afternoon",
                "practical_notes": (
                    f"{venue_name} works best as a hot-day family reset or aquatics outing with a shorter pool-and-program shape rather than as a broad all-day destination."
                ),
                "accessibility_notes": (
                    "Aquatic-center visits are easier to pace than larger outdoor family plans because bathrooms, cool-down space, and shorter loops are typically closer at hand."
                ),
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Public swim access and classes vary by site; confirm current pool hours and registration windows through Atlanta DPR.",
                "source_url": ACTIVITY_SEARCH_URL,
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "place_type": place_data.get("place_type") or place_data.get("venue_type"),
                    "city": "atlanta",
                },
            },
        )
        envelope.add(
            "venue_features",
            {
                "place_id": venue_id,
                "slug": "public-pool-and-aquatics-programs",
                "title": "Public pool and aquatics programs",
                "feature_type": "amenity",
                "description": f"{venue_name} is one of Atlanta DPR's aquatic facilities with public swim and family aquatics programming.",
                "url": ACTIVITY_SEARCH_URL,
                "price_note": "Public access and registration vary by program and season.",
                "is_free": False,
                "sort_order": 10,
            },
        )
        return envelope

    if slug in _COMMUNITY_CENTER_SLUGS:
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
                "practical_notes": (
                    f"{venue_name} works best as a weather-proof family recreation base for classes, camps, and shorter after-school or weekend activity blocks."
                ),
                "accessibility_notes": (
                    "Indoor community-center space makes family pacing easier than park-only plans, with simpler stroller handling, bathroom access, and quick resets."
                ),
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": "Drop-in access and classes vary by center; check Atlanta DPR for current family programming and building hours.",
                "source_url": ACTIVITY_SEARCH_URL,
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "place_type": place_data.get("place_type") or place_data.get("venue_type"),
                    "city": "atlanta",
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
                "description": f"{venue_name} gives families an indoor recreation option with weather-proof community-center space and youth programming through Atlanta DPR.",
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
                "description": f"{venue_name} regularly hosts youth classes, family recreation programming, and seasonal camps through Atlanta DPR.",
                "url": ACTIVITY_SEARCH_URL,
                "price_note": "Registration costs vary by program and season.",
                "is_free": False,
                "sort_order": 20,
            },
        )
        return envelope

    if slug in _PARK_SLUGS:
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
                "practical_notes": (
                    "This Atlanta park is best as a flexible free family stop for morning play, looser outdoor time, or pairing with a city class, camp, or nearby errand."
                ),
                "accessibility_notes": (
                    "Open park pacing makes it easier to shorten or stretch the visit, but shade, stroller smoothness, and bathroom convenience vary more by site than at city recreation centers."
                ),
                "family_suitability": "yes",
                "reservation_required": False,
                "permit_required": False,
                "fee_note": (
                    "Open park access is free; classes, camps, and facility reservations vary by site."
                    if slug != "lake-allatoona-rec-camp"
                    else "Lake camp sessions, day camps, and other structured youth activities vary by season and registration window."
                ),
                "source_url": ACTIVITY_SEARCH_URL,
                "metadata": {
                    "source_type": "family_destination_enrichment",
                    "place_type": place_data.get("place_type") or place_data.get("venue_type"),
                    "city": "atlanta",
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
                "description": f"{venue_name} is a free Atlanta park option for low-friction family outdoor time, open-air play, and pairing with seasonal city programming.",
                "url": ACTIVITY_SEARCH_URL,
                "price_note": "Open park access is free.",
                "is_free": True,
                "sort_order": 10,
            },
        )
        if slug == "lake-allatoona-rec-camp":
            envelope.add(
                "venue_features",
                {
                    "place_id": venue_id,
                    "slug": "lake-camp-and-outdoor-adventure-base",
                    "title": "Lake camp and outdoor adventure base",
                    "feature_type": "experience",
                    "description": f"{venue_name} is one of Atlanta DPR's stronger summer outdoor-camp destinations, built around a lake setting rather than a neighborhood rec-center plan.",
                    "url": ACTIVITY_SEARCH_URL,
                    "price_note": "Program pricing and camp registration vary by season.",
                    "is_free": False,
                    "sort_order": 20,
                },
            )
        return envelope

    return None


def _should_skip_dedicated_item(name: str, desc_text: str) -> bool:
    combined = f"{name} {desc_text}".lower()
    return any(keyword in combined for keyword in _DEDICATED_SOURCE_KEYWORDS)


def _is_family_only(
    name: str,
    desc_text: str,
    age_min: Optional[int],
    age_max: Optional[int],
    category: str,
    tags: list[str],
) -> bool:
    """Return True when an activity is exclusively family/youth-targeted.

    These events belong in the family portal (via atlanta_family_programs.py)
    and should NOT appear in the general Atlanta feed.  Activities that are
    all-ages or adult-inclusive stay in the general feed.
    """
    # If the family filter wouldn't claim it, it's general-audience
    if not is_family_relevant_activity(
        name=name,
        desc_text=desc_text,
        age_min=age_min,
        age_max=age_max,
        category=category,
        tags=tags,
    ):
        return False

    # Explicitly capped at youth — this is a kids/teen program
    if age_max is not None and age_max <= 18:
        return True

    # Camp keyword is a strong family signal
    combined = f"{name} {desc_text}".lower()
    if re.search(r"\bcamp\b", combined):
        return True

    # Category was classified as "family" by _classify()
    if category == "family":
        return True

    return False


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
    Create a fresh requests Session, load the Activity_Search landing page to
    get session cookies and the CSRF token.

    Returns (session, csrf_token) on success, (None, None) on failure.
    """
    session = requests.Session()
    session.headers.update(HEADERS)
    try:
        resp = session.get(ACTIVITY_SEARCH_URL, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Failed to load Atlanta DPR landing page: %s", exc)
        return None, None

    m = _CSRF_RE.search(resp.text)
    if not m:
        logger.error("Could not find __csrfToken in Atlanta DPR landing page")
        return None, None

    return session, m.group(1)


def _fetch_page(
    session: requests.Session, csrf: str, page_number: int
) -> Optional[tuple[list[dict], int, int]]:
    """
    POST to the activities list API for the given page number.

    Pagination is controlled by the `page_info` custom request header, which
    the ACTIVENet SPA sends on every scroll-triggered fetch.  The body is
    identical for all pages.

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
        "Referer": ACTIVITY_SEARCH_URL,
        "Origin": "https://anc.apm.activecommunities.com",
    }
    try:
        resp = session.post(API_URL, json=_SEARCH_BODY, headers=api_headers, timeout=30)
        resp.raise_for_status()
        if "application/json" not in resp.headers.get("Content-Type", ""):
            logger.warning(
                "Atlanta DPR API returned non-JSON (Content-Type: %s)",
                resp.headers.get("Content-Type"),
            )
            return None
    except requests.RequestException as exc:
        logger.warning("Atlanta DPR API request failed (page %d): %s", page_number, exc)
        return None

    try:
        data = resp.json()
    except ValueError as exc:
        logger.warning("Atlanta DPR API JSON parse error: %s", exc)
        return None

    response_code = data.get("headers", {}).get("response_code")
    if response_code != "0000":
        logger.warning("Atlanta DPR API non-success code: %s", response_code)
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
    Crawl Atlanta DPR's ACTIVENet program catalog.

    Steps:
      1. Init session and extract CSRF token from landing page.
      2. Fetch page 1 to discover total_pages, then fetch pages 1..total_pages.
         Each request uses a `page_info` custom header to request the exact page.
      3. For each activity, resolve venue, extract dates/prices/tags.
      4. Skip activities whose end date has passed (past events).
      5. Insert or update events with deduplication by content hash.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    today = date.today()
    venue_cache: dict[str, int] = {}
    enriched_venue_ids: set[int] = set()

    session, csrf = _init_session()
    if not session or not csrf:
        return 0, 0, 0

    logger.info("Atlanta DPR: session initialised, starting page crawl")

    # Fetch page 1 to discover total_pages
    first = _fetch_page(session, csrf, 1)
    if first is None:
        logger.error("Atlanta DPR: failed to fetch page 1")
        return 0, 0, 0

    _, total_records, total_pages = first
    total_pages = min(total_pages, MAX_PAGES)
    logger.info("Atlanta DPR: %d total records, %d pages", total_records, total_pages)

    for page_num in range(1, total_pages + 1):
        if page_num == 1:
            result = first  # already fetched
        else:
            time.sleep(REQUEST_DELAY)
            result = _fetch_page(session, csrf, page_num)
            if result is None:
                logger.warning("Atlanta DPR: page %d fetch failed — stopping", page_num)
                break

        items, _, _ = result

        if not items:
            logger.info("Atlanta DPR: empty page %d — stopping", page_num)
            break

        logger.debug(
            "Atlanta DPR: page %d/%d (%d items)", page_num, total_pages, len(items)
        )

        for item in items:
            try:
                activity_id = item.get("id")

                name: str = (item.get("name") or "").strip()
                if not name:
                    continue

                desc_html: str = item.get("desc") or ""
                soup = BeautifulSoup(desc_html, "html.parser")
                desc_text: str = soup.get_text(" ", strip=True)

                if _should_skip_dedicated_item(name, desc_text):
                    continue

                # Dates
                start_raw = _parse_date(item.get("date_range_start"))
                end_raw = _parse_date(item.get("date_range_end"))

                # Skip if start date is in the past AND no open end
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

                # Location → venue
                location_label: str = item.get("location", {}).get("label") or ""
                venue_key = location_label.lower().strip()
                if venue_key not in venue_cache:
                    place_data = _resolve_venue_data(location_label)
                    venue_id = get_or_create_place(place_data)
                    venue_cache[venue_key] = venue_id
                    if venue_id and venue_id not in enriched_venue_ids:
                        destination_envelope = _build_destination_envelope(place_data, venue_id)
                        if destination_envelope and destination_envelope.has_records():
                            persist_typed_entity_envelope(destination_envelope)
                            enriched_venue_ids.add(venue_id)
                venue_id = venue_cache[venue_key]

                # Price
                price_min, price_max, is_free = _extract_prices(desc_html)

                # Category / tags
                category, tags = _classify(name, desc_text, age_min, age_max)

                # Skip family-only events — they belong in the family portal
                # (handled by atlanta_family_programs.py)
                if _is_family_only(name, desc_text, age_min, age_max, category, tags):
                    continue

                # audience_tags: explicit audience column (added in taxonomy Phase 1 migration).
                # Derived from normalized age range — more precise than the tag list.
                audience_tags: list[str] = []
                if age_min is not None and age_min >= 18:
                    audience_tags.append("adults")
                elif age_max is not None and age_max <= 3:
                    audience_tags.append("toddler")
                elif age_max is not None and age_max <= 5:
                    audience_tags.append("preschool")
                elif age_max is not None and age_max <= 11:
                    audience_tags.append("kids")
                elif age_max is not None and age_max <= 17:
                    audience_tags.append("teen")
                # No audience_tags when age is unknown — leave empty rather than guess

                # Detail URL — prefer the clean slug URL
                detail_url: str = item.get("detail_url") or ACTIVITY_SEARCH_URL

                # Description — truncate to 1000 chars
                description: Optional[str] = desc_text[:1000] if desc_text else None
                schedule_start_time, schedule_end_time, is_all_day = _derive_schedule_fields(
                    start_raw=start_raw,
                    end_raw=end_raw,
                    date_range_description=item.get("date_range"),
                    desc_text=desc_text,
                )

                # Content hash: (name, venue_name, start_date | activity_id)
                venue_name = _resolve_venue_data(location_label).get(
                    "name", "Atlanta DPR"
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
                    "audience_tags": audience_tags if audience_tags else None,
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
                    "Atlanta DPR: error processing item %s: %s", item.get("id"), exc
                )
                continue

    logger.info(
        "Atlanta DPR crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
