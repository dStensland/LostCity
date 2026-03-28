"""
Crawler for Chattahoochee Nature Center (chattnaturecenter.org).

CNC is a 127-acre nature center in Roswell, GA (founded 1993) on the banks of
the Chattahoochee River. It runs a dense calendar of:

  - Camp Kingfisher (summer + seasonal school-break camps)
  - Pee Wee Naturalists (ages 3-4, Tuesday morning series)
  - Homeschool Naturalists (monthly homeschool programs)
  - Guided hikes, canoe trips, birding walks, forest bathing
  - Scout badge programs (Boy Scouts, Girl Scouts)
  - Adult programs: The Nature Club dine-and-discovers, date nights
  - Volunteer / habitat restoration days
  - Annual festivals: Flying Colors Butterfly Festival, Halloween Hikes,
    Possum Trot 5K/10K, Water Drop Dash, Back to Your Roots Farm Fair
  - Horticultural events: native plant sales, carnivorous plant sale
  - Rotating gallery shows

Approach:
  1. Fetch all event records from the WordPress REST API (wp/v2/mec-events),
     which exposes the site's Modern Events Calendar custom post type.
     This gives us 89+ base event slugs without needing JavaScript rendering.
  2. Fetch each event's detail page to extract schema.org Event JSON, which
     provides the next occurrence date, start/end time, description, and image.
  3. Parse price from description text (the schema.org price field is always "0"
     on this site; real pricing lives in the description prose).
  4. Skip "CNC Closed" administrative notices and past events.
  5. Infer age ranges and age-band tags from title/description.

Technology: WP REST API + requests + BeautifulSoup (no Playwright needed).
Rate limit: 0.8s between requests.
Yield: ~50 future events per crawl run (varies with season).

Fixed from previous version:
  - Removed Playwright (unnecessary — site renders schema.org server-side)
  - Correct lat/lng (was off by ~3 miles, now 34.0315, -84.3707)
  - Proper pagination: WP API returns all 89 events in one call
  - Age range extraction for family programs
  - Price parsed from description text, not schema.org offers.price
  - Category/tag inference from MEC category slugs + keyword scan
  - Series hints for recurring programs (canoe trips, pee wee naturalists, etc.)
"""

from __future__ import annotations

import html
import json
import logging
import re
import time
from datetime import date, datetime
from typing import Optional
from urllib.parse import unquote

import requests
from bs4 import BeautifulSoup

from db import (
    get_client,
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_BASE_URL = "https://chattnaturecenter.org"
_WP_API_URL = f"{_BASE_URL}/wp-json/wp/v2/mec-events"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
_HEADERS = {"User-Agent": _USER_AGENT}

_REQUEST_DELAY = 0.8  # seconds between page fetches

_VENUE_DATA = {
    "name": "Chattahoochee Nature Center",
    "slug": "chattahoochee-nature-center",
    "address": "9135 Willeo Rd",
    "neighborhood": "Roswell",
    "city": "Roswell",
    "state": "GA",
    "zip": "30075",
    "lat": 34.0315,
    "lng": -84.3707,
    "place_type": "park",
    "spot_type": "park",
    "website": _BASE_URL,
    "vibes": ["family-friendly", "outdoor", "all-ages", "educational", "historic"],
    "description": (
        "Chattahoochee Nature Center is a 127-acre nature sanctuary on the "
        "banks of the Chattahoochee River in Roswell, GA. It offers wildlife "
        "exhibits, canoe trips, guided hikes, summer camps, scout programs, "
        "and seasonal events for all ages."
    ),
    "hours": {
        "monday": {"open": "10:00", "close": "17:00"},
        "tuesday": {"open": "10:00", "close": "17:00"},
        "wednesday": {"open": "10:00", "close": "17:00"},
        "thursday": {"open": "10:00", "close": "17:00"},
        "friday": {"open": "10:00", "close": "17:00"},
        "saturday": {"open": "10:00", "close": "17:00"},
        "sunday": {"open": "12:00", "close": "17:00"},
    },
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()

    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "nature_center",
            "commitment_tier": "halfday",
            "primary_activity": "family nature center visit",
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["outdoor", "indoor-option", "family-daytrip"],
            "best_time_of_day": "morning",
            "parking_type": "free_lot",
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "practical_notes": (
                "127-acre nature sanctuary on the Chattahoochee River with wildlife exhibits, canoe trips, guided hikes, summer camps, and a discovery center. "
                "It works well as an easy nature-day option when families want both trails and an indoor fallback. "
                "The best family version is to choose a shorter trail range and use the indoor exhibits as part of the day, not only the backup plan."
            ),
            "accessibility_notes": (
                "The discovery-center and exhibit layer give families a lower-friction entry point, while trails and river-oriented experiences vary more by terrain and activity. "
                "That makes it easier than a pure trail destination to adapt the visit around stamina, shade, or weather shifts."
            ),
            "fee_note": "General-admission access, camps, and specialty programs can carry separate pricing.",
            "source_url": _BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": _VENUE_DATA.get("place_type"),
                "city": "roswell",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "river-trails-and-canoe-trips",
            "title": "River trails and canoe trips",
            "feature_type": "experience",
            "description": "Chattahoochee Nature Center combines trails along the river with family-friendly canoe and guided nature experiences.",
            "url": _BASE_URL,
            "price_note": "Some guided experiences and canoe programs require separate registration.",
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "wildlife-exhibits-and-discovery-center",
            "title": "Wildlife exhibits and discovery center",
            "feature_type": "amenity",
            "description": "Wildlife exhibits and an indoor discovery component make the center useful for family nature outings even when a full outdoor trek is not the goal.",
            "url": _BASE_URL,
            "price_note": "Included programming and exhibit access vary by admission and event schedule.",
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "short-trail-range-with-indoor-backup",
            "title": "Short trail range with indoor backup",
            "feature_type": "amenity",
            "description": "Chattahoochee Nature Center is strongest when families can keep the trail piece shorter and use the discovery-center layer for shade, bathrooms, and easier resets.",
            "url": _BASE_URL,
            "is_free": False,
            "sort_order": 25,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "easy-trails-plus-indoor-fallback",
            "title": "Easy trails plus indoor fallback",
            "feature_type": "amenity",
            "description": "Chattahoochee Nature Center gives families a practical mix of lighter trails and indoor discovery space, which lowers the risk of a nature outing falling apart on weather or energy.",
            "url": _BASE_URL,
            "is_free": False,
            "sort_order": 30,
        },
    )
    return envelope

# ---------------------------------------------------------------------------
# Title skip patterns — administrative notices, not public events
# ---------------------------------------------------------------------------

_SKIP_TITLE_SUBSTRINGS: tuple[str, ...] = (
    "cnc is closed",
    "cnc closed",
)


def _should_skip(title: str) -> bool:
    """Return True if this event title is an administrative notice."""
    lower = title.lower()
    return any(pat in lower for pat in _SKIP_TITLE_SUBSTRINGS)


# ---------------------------------------------------------------------------
# MEC category slug → LostCity category
# ---------------------------------------------------------------------------

_CAT_SLUG_TO_CATEGORY: dict[str, str] = {
    "adult-programs": "outdoors",
    "the-nature-club": "community",
    "children-and-family-programs": "family",
    "homeschool": "learning",
    "pee-wee-naturalists": "family",
    "canoeing": "outdoors",
    "boy-scouts": "learning",
    "girl-scouts": "learning",
    "horticulture": "outdoors",
    "nature-exchange": "family",
    "family-fun-days": "family",
    "butterfly-encounter": "family",
    "sunset-sips": "food_drink",
    "50th-anniversary": "community",
    "included-with-general-admission": "family",
}

# Tags always applied to every CNC event
_DEFAULT_TAGS: list[str] = ["outdoor", "nature", "family-friendly", "educational"]

# ---------------------------------------------------------------------------
# Age range inference
# ---------------------------------------------------------------------------

_AGE_PATTERNS: list[tuple[re.Pattern, str]] = [
    # "ages 3-8", "ages 3 to 8", "ages 3–8"
    (re.compile(r"ages?\s+(\d+)\s*[-–to]+\s*(\d+)", re.IGNORECASE), "range"),
    # "ages 3 and 4" — CNC uses this for two-year age groups
    (
        re.compile(r"ages?\s+(\d+)\s+and\s+(\d+)(?!\s*(?:up|older))", re.IGNORECASE),
        "range",
    ),
    # "ages 4+", "ages 4 and up", "ages 4 or older"
    (
        re.compile(
            r"ages?\s+(\d+)\s*(?:\+|and\s+(?:up|older)|or\s+older)", re.IGNORECASE
        ),
        "min",
    ),
    # "4 and up" without "ages"
    (re.compile(r"(\d+)\s+and\s+up", re.IGNORECASE), "min"),
    # "ages 4" — single age (checked last to avoid false positives)
    (re.compile(r"ages?\s+(\d+)(?!\s*[-–\d])", re.IGNORECASE), "single"),
    # "for children (5-10)", "for kids (3-12)"
    (
        re.compile(
            r"(?:for\s+)?(?:children|kids?|youth)\s*\(?(\d+)\s*[-–]\s*(\d+)\)?",
            re.IGNORECASE,
        ),
        "range",
    ),
    # "(ages 4-5)" parenthetical
    (re.compile(r"\(\s*ages?\s+(\d+)\s*[-–]\s*(\d+)\s*\)", re.IGNORECASE), "range"),
]

_AGE_BAND_RULES: list[tuple[int, int, str]] = [
    (0, 1, "infant"),
    (1, 3, "toddler"),
    (3, 5, "preschool"),
    (5, 12, "elementary"),
    (10, 13, "tween"),
    (13, 18, "teen"),
]


def _parse_age_range(text: str) -> tuple[Optional[int], Optional[int]]:
    """Extract age_min / age_max from title or description text."""
    if not text:
        return None, None

    for pattern, kind in _AGE_PATTERNS:
        m = pattern.search(text)
        if m:
            if kind == "range":
                return int(m.group(1)), int(m.group(2))
            elif kind == "min":
                return int(m.group(1)), None
            elif kind == "single":
                age = int(m.group(1))
                return age, age

    t = text.lower()
    if re.search(r"\b(infant|baby|babies)\b", t):
        return 0, 1
    if re.search(r"\btoddlers?\b", t):
        return 1, 3
    if re.search(r"\b(preschool|pre.?k|pre.?kindergarten)\b", t):
        return 3, 5
    return None, None


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    """Return age-band tags that overlap with [age_min, age_max]."""
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 100
    return [
        tag
        for (band_lo, band_hi, tag) in _AGE_BAND_RULES
        if lo <= band_hi and hi >= band_lo
    ]


# ---------------------------------------------------------------------------
# Price parsing
# ---------------------------------------------------------------------------

_COST_RANGE_PATTERN = re.compile(
    # Handles: "$60 - $45", "$60–$45", "$60/$45"
    # Also: "$60 general public/$45 CNC Members" (words between prices)
    r"\$\s*([\d,]+(?:\.\d{1,2})?)[^/]*?/[^0-9]*\$\s*([\d,]+(?:\.\d{1,2})?)"
    r"|"
    r"\$\s*([\d,]+(?:\.\d{1,2})?)\s*[-–—]\s*\$?\s*([\d,]+(?:\.\d{1,2})?)"
)
_COST_SINGLE_PATTERN = re.compile(r"\$\s*([\d,]+(?:\.\d{1,2})?)")


def _parse_price(description: str) -> tuple[Optional[float], Optional[float], bool]:
    """
    Extract price from description text.

    CNC descriptions use patterns like:
      "$60 general public/$45 CNC Members"
      "Free with General Admission"
      "Included with General Admission and Free to Members"

    The schema.org offers.price is always "0" on this site — not reliable.
    Returns (price_min, price_max, is_free).
    """
    if not description:
        return None, None, False

    desc_lower = description.lower()

    if re.search(
        r"(included with general admission|free (with|to|for)|"
        r"free admission|no (cost|charge|fee)|complimentary)",
        desc_lower,
    ):
        return 0.0, 0.0, True

    # "$60 general public/$45 members" or "$60 - $45" style — dual price
    m = _COST_RANGE_PATTERN.search(description)
    if m:
        # Pattern has two alternations; pick the non-None groups
        groups = [g for g in m.groups() if g is not None]
        if len(groups) >= 2:
            a = float(groups[0].replace(",", ""))
            b = float(groups[1].replace(",", ""))
            lo, hi = min(a, b), max(a, b)
            return lo, hi, (hi == 0.0)

    m = _COST_SINGLE_PATTERN.search(description)
    if m:
        val = float(m.group(1).replace(",", ""))
        return val, val, (val == 0.0)

    return None, None, False


# ---------------------------------------------------------------------------
# Category and tag inference
# ---------------------------------------------------------------------------

_KEYWORD_CATEGORY_MAP: list[tuple[str, str]] = [
    (r"\b(canoe|kayak|paddle|river trip)\b", "outdoors"),
    (r"\b(hike|hiking|trail walk|forest bath)\b", "outdoors"),
    (r"\b(bird|birding walk)\b", "outdoors"),
    (r"\b(concert|live music|live band)\b", "music"),
    (r"\b(film|movie|screening)\b", "film"),
    (r"\b(sip|cocktail|wine|beer|dinner)\b", "food_drink"),
    (r"\b(5k|10k|fun run|dash)\b", "fitness"),
    (r"\b(camp|summer camp|winter camp)\b", "programs"),
    (r"\b(scout|merit badge)\b", "learning"),
    (r"\b(workshop|class|lecture|symposium)\b", "learning"),
    (r"\b(volunteer|restoration|cleanup)\b", "community"),
    (r"\b(fair|festival|celebration|market)\b", "community"),
    (r"\b(pee wee|toddlers?|preschool)\b", "family"),
    (r"\b(homeschool|family|kids?|children)\b", "family"),
]

_KEYWORD_TAG_MAP: list[tuple[str, list[str]]] = [
    (r"\b(canoe|kayak|paddle)\b", ["water-sports"]),
    (r"\b(hike|hiking|trail walk|forest bath)\b", ["hiking"]),
    (r"\b(run|5k|10k|dash)\b", ["running"]),
    (r"\b(camp|summer camp)\b", ["kids", "class"]),
    (r"\b(scout|merit badge)\b", ["kids", "educational"]),
    (r"\b(volunteer|restoration)\b", ["volunteer", "volunteer-outdoors"]),
    (r"\b(night|evening|after dark)\b", ["date-night"]),
    (r"\b(sip|cocktail|wine)\b", ["date-night"]),
    (r"\b(toddlers?|pee wee|preschool)\b", ["toddler", "preschool"]),
    (r"\b(homeschool)\b", ["educational", "kids"]),
    (r"\b(16\+|adults? only)\b", ["adults"]),
    (r"\b(family)\b", ["family-friendly"]),
    (r"\b(festival|fair)\b", ["seasonal"]),
    (r"\b(plant sale|native plant|horticulture)\b", ["outdoor"]),
    (r"\b(butterfly|firefly|wildlife|amphibian|bird)\b", ["educational"]),
]


def _infer_category_and_tags(
    mec_category_slugs: list[str],
    title: str,
    description: str,
    age_min: Optional[int],
    age_max: Optional[int],
) -> tuple[str, list[str]]:
    """Return (category, tags) for a CNC event."""
    category = "family"  # sensible default for a nature center
    tags: list[str] = list(_DEFAULT_TAGS)

    # 1. MEC category slug mapping
    for slug in mec_category_slugs:
        mapped = _CAT_SLUG_TO_CATEGORY.get(slug)
        if mapped:
            category = mapped
            break

    # 2. Keyword override when still at default
    combined = f"{title} {description}".lower()
    if category == "family":
        for pattern, cat in _KEYWORD_CATEGORY_MAP:
            if re.search(pattern, combined, re.IGNORECASE):
                category = cat
                break

    # 3. Extra tags from keyword scan
    for pattern, extra_tags in _KEYWORD_TAG_MAP:
        if re.search(pattern, combined, re.IGNORECASE):
            for t in extra_tags:
                if t not in tags:
                    tags.append(t)

    # 4. Age-band tags
    for t in _age_band_tags(age_min, age_max):
        if t not in tags:
            tags.append(t)

    # 5. Semantic age rules
    if age_max is not None and age_max <= 17 and "kids" not in tags:
        tags.append("kids")
    if age_min is not None and age_min >= 16 and "adults" not in tags:
        tags.append("adults")

    return category, tags


# ---------------------------------------------------------------------------
# Series hint detection
# ---------------------------------------------------------------------------

_CLASS_SERIES_RE: list[re.Pattern] = [
    re.compile(r"\bcamp\b", re.IGNORECASE),
    re.compile(r"\bclass\b", re.IGNORECASE),
    re.compile(r"\bworkshop\b", re.IGNORECASE),
    re.compile(r"\bseries\b", re.IGNORECASE),
    re.compile(r"\bcourse\b", re.IGNORECASE),
    re.compile(r"\bnaturalists\b", re.IGNORECASE),
    re.compile(r"\bcanoe trips?\b", re.IGNORECASE),
    re.compile(r"\bbird walk\b", re.IGNORECASE),
    re.compile(r"\borientation\b", re.IGNORECASE),
    re.compile(r"\bforest bathing\b", re.IGNORECASE),
    re.compile(r"\bnature club\b", re.IGNORECASE),
]

_RECURRING_SHOW_RE: list[re.Pattern] = [
    re.compile(r"\bsunset sips\b", re.IGNORECASE),
    re.compile(r"\bdate night on the river\b", re.IGNORECASE),
    re.compile(r"\bstorytime\b", re.IGNORECASE),
]

_DATE_SUFFIX_RE = re.compile(
    r"\s*[-–]\s*(?:Spring|Summer|Fall|Winter|January|February|March|April|May|"
    r"June|July|August|September|October|November|December)(?:\s+\d{4})?\s*$",
    re.IGNORECASE,
)


def _build_series_hint(title: str) -> Optional[dict]:
    """Return a series_hint dict if this event looks like a recurring series."""
    for pattern in _RECURRING_SHOW_RE:
        if pattern.search(title):
            return {
                "series_type": "recurring_show",
                "series_title": title,
                "frequency": "irregular",
            }

    for pattern in _CLASS_SERIES_RE:
        if pattern.search(title):
            series_title = _DATE_SUFFIX_RE.sub("", title).strip() or title
            return {
                "series_type": "class_series",
                "series_title": series_title,
                "frequency": "irregular",
            }

    return None


# ---------------------------------------------------------------------------
# HTML / text helpers
# ---------------------------------------------------------------------------

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")


def _strip_html(raw: str, max_len: int = 800) -> str:
    """Strip HTML tags and normalise whitespace, truncating at max_len."""
    if not raw:
        return ""
    text = html.unescape(raw)
    text = _HTML_TAG_RE.sub(" ", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    if len(text) > max_len:
        text = text[: max_len - 3].rstrip() + "..."
    return text


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _get_text(session: requests.Session, url: str, retries: int = 3) -> Optional[str]:
    """GET a URL and return response text, or None on persistent failure."""
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, headers=_HEADERS, timeout=30)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            if attempt >= retries:
                logger.error(
                    "[cnc] GET %s failed after %d attempts: %s", url, retries, exc
                )
                return None
            time.sleep(1.5 * attempt)
    return None


def _get_json(
    session: requests.Session, url: str, retries: int = 3
) -> Optional[object]:
    """GET a URL and return parsed JSON, or None on persistent failure."""
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, headers=_HEADERS, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            if attempt >= retries:
                logger.error(
                    "[cnc] JSON GET %s failed after %d attempts: %s", url, retries, exc
                )
                return None
            time.sleep(1.5 * attempt)
        except ValueError as exc:
            logger.error("[cnc] JSON parse error at %s: %s", url, exc)
            return None
    return None


# ---------------------------------------------------------------------------
# Time parsing
# ---------------------------------------------------------------------------

# "9:45 AM - 11:00 AM", "7:00 PM - 9:00 PM"
_TIME_RANGE_RE = re.compile(
    r"(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))",
    re.IGNORECASE,
)
_TIME_SINGLE_RE = re.compile(r"(\d{1,2}:\d{2}\s*(?:AM|PM))", re.IGNORECASE)


def _parse_time_text(time_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse MEC time text into (start_time, end_time) in HH:MM 24h format.

    Examples:
      "9:45 AM - 11:00 AM"  → ("09:45", "11:00")
      "7:00 PM - 9:00 PM"   → ("19:00", "21:00")
      "All Day"             → (None, None)
    """
    if not time_text or "all day" in time_text.lower():
        return None, None

    m = _TIME_RANGE_RE.search(time_text)
    if m:
        return _to_24h(m.group(1).strip()), _to_24h(m.group(2).strip())

    m = _TIME_SINGLE_RE.search(time_text)
    if m:
        return _to_24h(m.group(1).strip()), None

    return None, None


def _to_24h(time_12h: str) -> Optional[str]:
    """Convert '9:45 AM' → '09:45', '7:00 PM' → '19:00'."""
    try:
        dt = datetime.strptime(time_12h.upper().replace(" ", ""), "%I:%M%p")
        return dt.strftime("%H:%M")
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _parse_detail_page(html_text: str, fallback_url: str) -> Optional[dict]:
    """
    Parse a CNC event detail page and return a structured dict.

    Extracts from:
      - schema.org Event JSON-LD: name, startDate, endDate, description, image, url
      - .mec-single-event-time sidebar: start/end time
      - .mec-single-event-category sidebar: MEC category slugs
      - .mec-booking-button / .mec-more-info-button: registration URL

    Returns None if no schema.org Event block is present.
    """
    soup = BeautifulSoup(html_text, "html.parser")

    # ---- Schema.org Event block (MEC injects one per rendered page) ---------
    event_schema: Optional[dict] = None
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, dict) and data.get("@type") == "Event":
                event_schema = data
                break
        except (ValueError, TypeError):
            pass

    if not event_schema:
        return None

    # CNC's MEC schema.org uses URL-encoded chars in name (e.g. "Storytime %26 Craft")
    name = html.unescape(unquote(event_schema.get("name", ""))).strip()
    if not name:
        return None

    start_date_raw = event_schema.get("startDate", "")
    end_date_raw = event_schema.get("endDate", "")

    if not start_date_raw:
        return None

    # Normalise: strip any time component ("2026-03-10T09:45" → "2026-03-10")
    start_date_str = start_date_raw[:10]
    end_date_str = (
        end_date_raw[:10]
        if end_date_raw and len(end_date_raw) >= 10
        else start_date_str
    )

    # ---- Description --------------------------------------------------------
    desc_raw = event_schema.get("description", "") or ""
    description = _strip_html(html.unescape(desc_raw), max_len=800)
    if not description:
        content_div = soup.find("div", class_="mec-single-event-description")
        if content_div:
            description = _strip_html(content_div.get_text(separator=" "), max_len=800)

    # ---- Image --------------------------------------------------------------
    image_url: Optional[str] = event_schema.get("image") or None
    if not image_url:
        og = soup.find("meta", property="og:image")
        if og:
            image_url = og.get("content")

    # ---- Time (from MEC meta sidebar) ----------------------------------------
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    time_section = soup.find("div", class_="mec-single-event-time")
    if time_section:
        abbr = time_section.find("abbr", class_="mec-events-abbr")
        if abbr:
            start_time, end_time = _parse_time_text(abbr.get_text(strip=True))

    # ---- MEC category slugs from sidebar links ------------------------------
    category_slugs: list[str] = []
    cat_links = soup.find_all("a", href=lambda x: x and "/blog/mec-category/" in x)
    for link in cat_links:
        m = re.search(r"/mec-category/([^/]+)/?$", link.get("href", ""))
        if m:
            category_slugs.append(m.group(1))

    # ---- Registration / ticket URL ------------------------------------------
    register_url: Optional[str] = None
    booking_btn = soup.find("a", class_="mec-booking-button")
    if booking_btn and booking_btn.get("href"):
        href = booking_btn["href"]
        # Only use external registration links (buy.chattnaturecenter.org), not
        # links that just go back to the event page.
        if "buy.chattnaturecenter.org" in href or (
            "chattnaturecenter.org/events" not in href
        ):
            register_url = href

    if not register_url:
        more_info = soup.find("a", class_="mec-more-info-button")
        if more_info and more_info.get("href"):
            register_url = more_info["href"]

    # ---- Price (from description, NOT schema.org offers.price) --------------
    price_min, price_max, is_free = _parse_price(description)

    # Canonical source URL — schema.org url includes ?occurrence= param
    source_url = event_schema.get("url") or fallback_url

    return {
        "name": name,
        "start_date": start_date_str,
        "end_date": end_date_str,
        "start_time": start_time,
        "end_time": end_time,
        "description": description if description else None,
        "image_url": image_url,
        "category_slugs": category_slugs,
        "register_url": register_url,
        "price_min": price_min,
        "price_max": price_max,
        "is_free": is_free,
        "source_url": source_url,
    }


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Chattahoochee Nature Center events via WordPress REST API + detail pages.

    Steps:
      1. GET /wp-json/wp/v2/mec-events to list all base event CPT records.
      2. For each record, GET the event detail page and parse schema.org Event.
      3. Skip past events and administrative closure notices.
      4. Persist via get_or_create_place / find_event_by_hash / insert_event.

    Returns (events_found, events_new, events_updated).
    """
    source_id: int = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    today = date.today()

    # Ensure venue record exists
    try:
        venue_id = get_or_create_place(_VENUE_DATA)
        persist_typed_entity_envelope(_build_destination_envelope(venue_id))
    except Exception as exc:
        logger.error("[cnc] Failed to create/find venue: %s", exc)
        return 0, 0, 0

    venue_name = _VENUE_DATA["name"]
    session = requests.Session()

    # Enrich venue with og:image from homepage
    try:
        homepage = _get_text(session, _BASE_URL)
        if homepage:
            og_soup = BeautifulSoup(homepage, "html.parser")
            og_img = og_soup.find("meta", property="og:image")
            if og_img and og_img.get("content"):
                get_client().table("places").update(
                    {"image_url": og_img["content"].strip()}
                ).eq("id", venue_id).execute()
                logger.debug("[cnc] Updated venue image from homepage og:image")
    except Exception as enrich_exc:
        logger.warning("[cnc] Homepage og:image enrichment failed: %s", enrich_exc)

    # ---- Step 1: Fetch all event slugs from WP REST API --------------------
    logger.info("[cnc] Fetching event list from WP REST API")
    raw_events = _get_json(session, f"{_WP_API_URL}?per_page=100&page=1")

    if not raw_events or not isinstance(raw_events, list):
        logger.error("[cnc] WP API returned no events or unexpected response")
        return 0, 0, 0

    logger.info("[cnc] %d base event records from WP API", len(raw_events))

    # ---- Step 2: Fetch each detail page and parse --------------------------
    for wp_event in raw_events:
        slug = wp_event.get("slug", "")
        event_link = wp_event.get("link", "")
        if not slug or not event_link:
            continue

        wp_title = html.unescape(wp_event.get("title", {}).get("rendered", "")).strip()

        # Fast skip on administrative notices without fetching the page
        if _should_skip(wp_title):
            logger.debug("[cnc] Skipping administrative notice: %r", wp_title)
            continue

        time.sleep(_REQUEST_DELAY)

        html_text = _get_text(session, event_link)
        if not html_text:
            logger.warning("[cnc] Failed to fetch detail page: %s", event_link)
            continue

        detail = _parse_detail_page(html_text, event_link)
        if not detail:
            logger.debug("[cnc] No schema.org Event block at %s — skipping", event_link)
            continue

        # ---- Date filter ---------------------------------------------------
        try:
            start_dt = date.fromisoformat(detail["start_date"])
        except (ValueError, TypeError):
            logger.debug(
                "[cnc] Could not parse start_date %r for %r",
                detail["start_date"],
                detail["name"],
            )
            continue

        if start_dt < today:
            logger.debug(
                "[cnc] Past event, skipping: %r on %s",
                detail["name"],
                detail["start_date"],
            )
            continue

        # ---- Age, category, tags -------------------------------------------
        combined_text = f"{detail['name']} {detail.get('description') or ''}"
        age_min, age_max = _parse_age_range(combined_text)
        category, tags = _infer_category_and_tags(
            detail["category_slugs"],
            detail["name"],
            detail.get("description") or "",
            age_min,
            age_max,
        )

        # ---- Series hint ---------------------------------------------------
        series_hint = _build_series_hint(detail["name"])

        # ---- Content hash --------------------------------------------------
        hash_key = detail["start_date"]
        if detail.get("start_time"):
            hash_key = f"{detail['start_date']}|{detail['start_time']}"
        content_hash = generate_content_hash(detail["name"], venue_name, hash_key)

        # ---- Build event record --------------------------------------------
        # Only store end_date if it differs from start_date (multi-day events)
        end_date_out = (
            detail["end_date"]
            if detail["end_date"] and detail["end_date"] != detail["start_date"]
            else None
        )

        record: dict = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": detail["name"],
            "description": detail.get("description"),
            "start_date": detail["start_date"],
            "end_date": end_date_out,
            "start_time": detail.get("start_time"),
            "end_time": detail.get("end_time"),
            "is_all_day": detail.get("start_time") is None,
            "category": category,
            "tags": tags,
            "is_free": detail["is_free"],
            "price_min": detail["price_min"],
            "price_max": detail["price_max"],
            "price_note": None,
            "source_url": detail["source_url"],
            "ticket_url": detail.get("register_url") or detail["source_url"],
            "image_url": detail.get("image_url"),
            "raw_text": detail["name"],
            "extraction_confidence": 0.88,
            "is_recurring": series_hint is not None,
            "content_hash": content_hash,
        }

        if age_min is not None:
            record["age_min"] = age_min
        if age_max is not None:
            record["age_max"] = age_max

        # ---- Persist -------------------------------------------------------
        events_found += 1
        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, record)
            events_updated += 1
        else:
            try:
                insert_event(record, series_hint=series_hint)
                events_new += 1
                logger.debug(
                    "[cnc] Added: %s on %s",
                    record["title"],
                    record["start_date"],
                )
            except Exception as exc:
                logger.error(
                    "[cnc] Failed to insert %r: %s",
                    record["title"],
                    exc,
                )

    logger.info(
        "[cnc] Crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
