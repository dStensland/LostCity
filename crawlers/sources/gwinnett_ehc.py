"""
Crawler for Gwinnett Environmental & Heritage Center (GEHC).

GEHC is a 102-acre nature/heritage education campus in Buford, GA
(originally opened 2003) operated by Gwinnett County Parks & Recreation.
It sits at the former site of the Chesser-Williams farmstead and offers:

  - Nature programs: hikes, birding walks, wildlife encounters, astronomy
  - Heritage programs: historic home tours (Chesser-Williams House, Isaac Adair House),
    Civil War/Reconstruction homeschool days, Train Day
  - Family events: scavenger hunts, craft sessions, Stop 'N' Play, festival days
  - Camps: spring break camps, summer adventure camps, specialty camps
  - STEAM programs: RoboThink robotics, science workshops
  - Art/craft classes: watercolor, craft-and-create, Kids Night activities

Technology: Gwinnett County uses rec1.com (CivicRec) for program registration.
The rec1 catalog exposes a JSON API:
  1. GET /catalog → HTML page with checkoutKey in data-page-data attr
  2. GET /catalog/getTabs/{key} → list of tabs (Events/Camps/Education/Nature & History…)
  3. POST /catalog/getItems/{key}/{tabId} → sections + groups (deferred loading)
  4. POST /catalog/getActivitySessions/{key}/{tabId}/{groupId} → paginated sessions
  5. GET /catalog/getSessionDetails/{key}/{sessionId} → structured info (age, price, schedule)
  6. GET /catalog/activityRegistration/{key}/{sessionId} → HTML description (rich text)

Only sessions whose features[location].value matches "Environmental & Heritage Center"
are crawled — Gwinnett County Parks runs programs across 40+ facilities.

Rate limiting: 0.5s between API calls.
Expected yield: 30-70 future events per crawl run (varies by season).
"""

from __future__ import annotations

import html as html_module
import json
import logging
import re
import time
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_venue,
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

_BASE_URL = "https://secure.rec1.com"
_CATALOG_BASE = f"{_BASE_URL}/GA/gwinnett-county-parks-recreation/catalog"
_COUNTY_BASE = "https://www.gwinnettcounty.com"

_EHC_LOCATION_LABEL = "Gwinnett Environmental & Heritage Center"
# Substring match — the features value can be "Gwinnett Environmental & Heritage Center"
_EHC_LOCATION_MATCH = "environmental"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "application/json, text/html, */*",
}

# Rate limit between catalog API calls (seconds)
_REQUEST_DELAY = 0.5

# Tabs to crawl — only GEHC-relevant program types
# Tab IDs are stable Gwinnett County rec1 identifiers
_TARGET_TABS: list[tuple[str, str]] = [
    ("819", "Events"),
    ("821", "Nature & History"),
    ("822", "Education"),
    ("825", "Classes & Activities"),
    ("930", "Camps"),
]

# Vendor-opportunity and non-public groups to skip
_SKIP_GROUP_SUBSTRINGS: tuple[str, ...] = (
    "vendor",
    "vendors",
    "vendor wanted",
)

# Event titles/keywords to skip — daily-operations, not public events
_SKIP_TITLE_SUBSTRINGS: tuple[str, ...] = (
    "after care",
    "aftercare",
    "w1 after",
    "w2 after",
    "w3 after",
    "w4 after",
    "w5 after",
    "w6 after",
    "w7 after",
    "w8 after",
    "w9 after",
    "closed",
    "cancelled",
    "canceled",
)

_VENUE_DATA = {
    "name": "Gwinnett Environmental & Heritage Center",
    "slug": "gwinnett-environmental-heritage-center",
    "address": "2020 Clean Water Dr",
    "neighborhood": "Buford",
    "city": "Buford",
    "state": "GA",
    "zip": "30519",
    "lat": 34.0447,
    "lng": -84.0189,
    "venue_type": "park",
    "spot_type": "park",
    "website": "https://www.gwinnettcounty.com/government/departments/parks-recreation/parks/gwinnett-environmental-heritage-center",
    "vibes": [
        "family-friendly",
        "outdoor",
        "educational",
        "all-ages",
        "historic",
        "nature",
    ],
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    programs=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    """Project GEHC into shared Family-friendly destination richness lanes."""
    envelope = TypedEntityEnvelope()

    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "nature_center",
            "commitment_tier": "halfday",
            "primary_activity": "nature and heritage exploration",
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["outdoor", "indoor-option", "family-daytrip"],
            "practical_notes": (
                "102-acre nature and heritage campus with walking trails, indoor exhibits, "
                "historic-house interpretation, and picnic-friendly family utility."
            ),
            "accessibility_notes": (
                "Family destination with indoor education spaces plus outdoor trail and campus "
                "circulation. Confirm specific trail and historic-building accessibility on the official site."
            ),
            "parking_type": "free_lot",
            "best_time_of_day": "morning",
            "family_suitability": "yes",
            "dog_friendly": False,
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Campus access varies by activity; confirm current exhibit, ropes-course, and program pricing on the official site.",
            "source_url": _VENUE_DATA["website"],
            "metadata": {
                "source_type": "family_destination_enrichment",
                "campus_size_acres": 102,
                "walking_trails_miles": 5,
                "has_indoor_exhibits": True,
                "has_historic_interpretation": True,
                "has_picnic_area": True,
            },
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "walking-trails-and-greenways",
            "title": "Walking trails and greenways",
            "feature_type": "amenity",
            "description": (
                "Roughly five miles of walking trails across the campus, giving families an easy nature loop option "
                "beyond scheduled programs."
            ),
            "url": _VENUE_DATA["website"],
            "is_free": False,
            "sort_order": 10,
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "historic-chesser-williams-house",
            "title": "Historic Chesser-Williams House",
            "feature_type": "attraction",
            "description": (
                "Historic-house interpretation on campus adds a heritage and local-history layer to family visits."
            ),
            "url": _VENUE_DATA["website"],
            "is_free": False,
            "sort_order": 20,
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "indoor-environmental-exhibits",
            "title": "Indoor environmental exhibits",
            "feature_type": "experience",
            "description": (
                "Indoor environmental and heritage exhibits make GEHC a useful family destination even when the weather turns."
            ),
            "url": _VENUE_DATA["website"],
            "is_free": False,
            "sort_order": 30,
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "wooded-picnic-pavilion",
            "title": "Wooded picnic pavilion",
            "feature_type": "amenity",
            "description": (
                "Picnic-friendly campus utility that makes the venue more usable for half-day family plans."
            ),
            "url": _VENUE_DATA["website"],
            "is_free": False,
            "sort_order": 40,
        },
    )

    return envelope

# ---------------------------------------------------------------------------
# Age range parsing
# ---------------------------------------------------------------------------

_AGE_PATTERNS: list[tuple[re.Pattern, str]] = [
    # "3-12", "5-up", "3/up", "5/12"
    (re.compile(r"(\d+)\s*[-/]\s*(\d+)", re.IGNORECASE), "range"),
    # "5/up", "5-up", "5+", "5 and up", "5 and older"
    (
        re.compile(
            r"(\d+)\s*(?:/up|/older|-up|-older|\+|\s+and\s+(?:up|older)|\s+or\s+older)",
            re.IGNORECASE,
        ),
        "min",
    ),
    # "8/under", "5 and under", "5 or under" — max-only
    (
        re.compile(
            r"(\d+)\s*(?:/under|-under|\s+and\s+under|\s+or\s+under|\s+&\s+under)",
            re.IGNORECASE,
        ),
        "max",
    ),
    # "ages 5-12", "ages 5 to 12", "ages 5–12"
    (
        re.compile(r"ages?\s+(\d+)\s*(?:[-–to]+|through)\s*(\d+)", re.IGNORECASE),
        "range",
    ),
    # "ages 5+", "ages 5 and up"
    (
        re.compile(
            r"ages?\s+(\d+)\s*(?:\+|and\s+(?:up|older)|or\s+older)",
            re.IGNORECASE,
        ),
        "min",
    ),
    # "All Ages" keyword
]

_AGE_KEYWORD_MAP: list[tuple[re.Pattern, tuple[Optional[int], Optional[int]]]] = [
    (re.compile(r"\ball\s+ages\b", re.IGNORECASE), (None, None)),
    (re.compile(r"\btoddler\b", re.IGNORECASE), (1, 3)),
    (re.compile(r"\binfant\b|\bbaby\b|\bbabies\b", re.IGNORECASE), (0, 1)),
    (re.compile(r"\bpreschool\b|\bpre.?k\b", re.IGNORECASE), (3, 5)),
]

_AGE_BAND_RULES: list[tuple[int, int, str]] = [
    (0, 1, "infant"),
    (1, 3, "toddler"),
    (3, 5, "preschool"),
    (5, 12, "elementary"),
    (10, 13, "tween"),
    (13, 18, "teen"),
]


def _parse_age_range(age_text: str) -> tuple[Optional[int], Optional[int]]:
    """
    Parse rec1 ageGender feature value into (age_min, age_max).

    rec1 formats:
      "All Ages"  → (None, None)
      "3-12"      → (3, 12)
      "5/up"      → (5, None)
      "3/5"       → (3, 5)
      "18+"       → (18, None)
    """
    if not age_text:
        return None, None

    # Keyword shortcuts first
    for pattern, result in _AGE_KEYWORD_MAP:
        if pattern.search(age_text):
            return result

    for pattern, kind in _AGE_PATTERNS:
        m = pattern.search(age_text)
        if m:
            if kind == "range":
                return int(m.group(1)), int(m.group(2))
            elif kind == "min":
                return int(m.group(1)), None
            elif kind == "max":
                return None, int(m.group(1))

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
# Date / time parsing
# ---------------------------------------------------------------------------

# rec1 time formats: "10am-12pm", "6:45p-8:45p", "10a-Noon", "12am-12am"
_TIME_RANGE_RE = re.compile(
    r"(\d{1,2}(?::\d{2})?(?:am?|pm?))\s*[-–]\s*(\d{1,2}(?::\d{2})?(?:am?|pm?)|noon)",
    re.IGNORECASE,
)


def _parse_rec1_time(time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse rec1 time range string like '10am-12pm' → ('10:00', '12:00').

    Handles:
      '10am-12pm'     → ('10:00', '12:00')
      '6:45p-8:45p'   → ('18:45', '20:45')
      '10a-Noon'      → ('10:00', '12:00')
      '12am-12am'     → (None, None)  — midnight placeholder = all-day
    """
    if not time_str or time_str.lower() in ("12am-12am", ""):
        return None, None

    m = _TIME_RANGE_RE.search(time_str)
    if m:
        start = _to_24h(m.group(1))
        raw_end = m.group(2).strip().lower()
        end = "12:00" if raw_end == "noon" else _to_24h(m.group(2))
        return start, end

    # Single time — just start
    single = re.search(r"(\d{1,2}(?::\d{2})?(?:am?|pm?))", time_str, re.IGNORECASE)
    if single:
        return _to_24h(single.group(1)), None

    return None, None


def _to_24h(t: str) -> Optional[str]:
    """Convert '10am', '6:45p', '2pm' → '10:00', '18:45', '14:00'."""
    t = t.strip().lower()
    # Normalise: 'p' → 'pm', 'a' → 'am'
    if t.endswith("p") and not t.endswith("pm"):
        t = t[:-1] + "pm"
    if t.endswith("a") and not t.endswith("am"):
        t = t[:-1] + "am"
    for fmt in ("%I:%M%p", "%I%p"):
        try:
            dt = datetime.strptime(t.upper(), fmt)
            return dt.strftime("%H:%M")
        except ValueError:
            pass
    return None


# rec1 date formats in features: "04/17/26", "04/06-04/10", "01/01-12/31"
_DATE_SINGLE_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{2,4})")
_DATE_RANGE_RE = re.compile(r"(\d{1,2}/\d{1,2})\s*[-–]\s*(\d{1,2}/\d{1,2})")


def _parse_rec1_dates(
    date_str: str, year: int = 0
) -> tuple[Optional[str], Optional[str]]:
    """
    Parse rec1 dates feature value into (start_date_iso, end_date_iso).

    Formats:
      "04/17/26"         → ("2026-04-17", None)
      "04/06-04/10"      → ("2026-04-06", "2026-04-10")
      "3/20"             → ("YYYY-03-20", None)  — needs year inference
      "01/01-12/31"      → ("YYYY-01-01", "YYYY-12-31")
      "3/2"              → ("YYYY-03-02", None)
    """
    if not date_str:
        return None, None

    current_year = year or date.today().year

    # Try single date with explicit year: "04/17/26"
    m = _DATE_SINGLE_RE.search(date_str)
    if m:
        month, day, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if yr < 100:
            yr += 2000
        return f"{yr:04d}-{month:02d}-{day:02d}", None

    # Range without year: "04/06-04/10"
    m = _DATE_RANGE_RE.search(date_str)
    if m:
        start_str, end_str = m.group(1), m.group(2)
        start_date = _parse_mmdd(start_str, current_year)
        end_date = _parse_mmdd(end_str, current_year)
        # If end is before start, end wraps to next year
        if start_date and end_date and end_date < start_date:
            end_date = _parse_mmdd(end_str, current_year + 1)
        return start_date, end_date

    # Single date without year: "3/20", "5/2"
    single = re.match(r"^(\d{1,2})/(\d{1,2})$", date_str.strip())
    if single:
        month, day = int(single.group(1)), int(single.group(2))
        return f"{current_year:04d}-{month:02d}-{day:02d}", None

    return None, None


def _parse_mmdd(mmdd: str, year: int) -> Optional[str]:
    """Parse 'M/D' or 'MM/DD' → 'YYYY-MM-DD'."""
    parts = mmdd.strip().split("/")
    if len(parts) == 2:
        try:
            m, d = int(parts[0]), int(parts[1])
            return f"{year:04d}-{m:02d}-{d:02d}"
        except ValueError:
            pass
    return None


# ---------------------------------------------------------------------------
# Price parsing
# ---------------------------------------------------------------------------

# rec1 Fee field: "$0.00", "$5.00 Resident / $6.50 Non-Resident", "Free"
_PRICE_RANGE_RE = re.compile(
    r"\$\s*([\d,]+(?:\.\d{1,2})?)\s+(?:Resident|Member)[^/]*"
    r"/\s*\$\s*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)
_PRICE_SINGLE_RE = re.compile(r"\$\s*([\d,]+(?:\.\d{1,2})?)")
_FREE_RE = re.compile(r"\b(free|no cost|no charge|no fee|\$0\.00|\$0)\b", re.IGNORECASE)


def _parse_price(price_str: str) -> tuple[Optional[float], Optional[float], bool]:
    """
    Parse rec1 fee text into (price_min, price_max, is_free).

    Examples:
      "$0.00"                         → (0.0, 0.0, True)
      "$5.00 Resident / $6.50 Non"   → (5.0, 6.5, False)
      "$15"                           → (15.0, 15.0, False)
      "Free"                          → (0.0, 0.0, True)
    """
    if not price_str:
        return None, None, False

    if _FREE_RE.search(price_str):
        return 0.0, 0.0, True

    m = _PRICE_RANGE_RE.search(price_str)
    if m:
        a = float(m.group(1).replace(",", ""))
        b = float(m.group(2).replace(",", ""))
        lo, hi = min(a, b), max(a, b)
        return lo, hi, (hi == 0.0)

    m = _PRICE_SINGLE_RE.search(price_str)
    if m:
        val = float(m.group(1).replace(",", ""))
        return val, val, (val == 0.0)

    return None, None, False


# ---------------------------------------------------------------------------
# Category and tag inference
# ---------------------------------------------------------------------------

_DEFAULT_TAGS: list[str] = ["family-friendly", "educational", "nature"]

_KEYWORD_CATEGORY_MAP: list[tuple[str, str]] = [
    (r"\b(camp|summer camp|spring break camp)\b", "programs"),
    (
        r"\b(hike|hiking|trail walk|nature walk|birding|bird walk|wildflower)\b",
        "outdoors",
    ),
    (r"\b(astronomy|stargazing|star gazing|night sky)\b", "outdoors"),
    (
        r"\b(tour|historic|heritage|chesser|civil war|reconstruction|colonial|farmstead)\b",
        "arts",
    ),
    (r"\b(steam|stem|robothink|robotics|engineering)\b", "learning"),
    (r"\b(workshop|class|painting|watercolor|craft|pottery|art)\b", "learning"),
    (r"\b(festival|fair|celebration|egg hunt|spring fest|scavenger)\b", "community"),
    (r"\b(storytime|story time|literacy)\b", "family"),
    (r"\b(homeschool|home.?school)\b", "learning"),
    (r"\b(music|musical|rhythm|sing)\b", "music"),
    (r"\b(yoga|fitness|athletic|sport)\b", "fitness"),
    (r"\b(volunteer)\b", "community"),
]

_KEYWORD_TAG_MAP: list[tuple[str, list[str]]] = [
    (r"\b(hike|hiking|trail walk|nature walk)\b", ["outdoor", "hiking"]),
    (
        r"\b(bird|birding|wildlife|reptile|amphibian|owl|butterfly|insect)\b",
        ["educational"],
    ),
    (r"\b(astronomy|stargazing|night sky)\b", ["educational"]),
    (r"\b(camp|summer camp)\b", ["kids", "class"]),
    (r"\b(steam|stem|robotics|robothink)\b", ["hands-on", "educational"]),
    (r"\b(craft|painting|watercolor|art)\b", ["hands-on"]),
    (r"\b(homeschool)\b", ["educational", "kids"]),
    (r"\b(storytime|story time|literacy)\b", ["kids"]),
    (r"\b(historic|heritage|tour|chesser|colonial|farmstead)\b", ["educational"]),
    (r"\b(family|kids?|children|junior|toddler)\b", ["family-friendly"]),
    (r"\b(festival|fair|celebration|egg hunt)\b", ["seasonal"]),
    (r"\b(volunteer|stewardship|cleanup)\b", ["volunteer"]),
    (r"\b(free)\b", []),  # handled via is_free
    (r"\b(18\+|adults? only|adult program|21\+)\b", ["adults"]),
    (r"\b(night|evening|after dark)\b", ["date-night"]),
    (r"\b(outdoor|outside|pavilion)\b", ["outdoor"]),
]


def _infer_category_and_tags(
    tab_name: str,
    group_name: str,
    title: str,
    description: str,
    age_min: Optional[int],
    age_max: Optional[int],
) -> tuple[str, list[str]]:
    """Return (category, tags) for a GEHC event."""
    # Sensible tab-level default
    tab_defaults = {
        "Events": "family",
        "Nature & History": "outdoors",
        "Education": "learning",
        "Classes & Activities": "learning",
        "Camps": "programs",
    }
    category = tab_defaults.get(tab_name, "family")
    tags: list[str] = list(_DEFAULT_TAGS)

    combined = f"{title} {group_name} {description}".lower()

    # Keyword override
    for pattern, cat in _KEYWORD_CATEGORY_MAP:
        if re.search(pattern, combined, re.IGNORECASE):
            category = cat
            break

    # Extra tags
    for pattern, extra in _KEYWORD_TAG_MAP:
        if re.search(pattern, combined, re.IGNORECASE):
            for t in extra:
                if t not in tags:
                    tags.append(t)

    # Age-band tags
    for t in _age_band_tags(age_min, age_max):
        if t not in tags:
            tags.append(t)

    # Semantic age rules
    if age_max is not None and age_max <= 17 and "kids" not in tags:
        tags.append("kids")
    if age_min is not None and age_min >= 16 and "adults" not in tags:
        tags.append("adults")

    # Camp / outdoor tags from tab
    if tab_name == "Camps":
        for t in ["kids", "class"]:
            if t not in tags:
                tags.append(t)
    if tab_name in ("Nature & History", "Outdoors"):
        if "outdoor" not in tags:
            tags.append("outdoor")

    return category, tags


# ---------------------------------------------------------------------------
# Series hints
# ---------------------------------------------------------------------------

_CLASS_SERIES_RE: list[re.Pattern] = [
    re.compile(r"\bcamp\b", re.IGNORECASE),
    re.compile(r"\bclass\b", re.IGNORECASE),
    re.compile(r"\bworkshop\b", re.IGNORECASE),
    re.compile(r"\bseries\b", re.IGNORECASE),
    re.compile(r"\bcourse\b", re.IGNORECASE),
    re.compile(r"\bhomeschool\b", re.IGNORECASE),
    re.compile(r"\bnaturalist\b", re.IGNORECASE),
    re.compile(r"\bbird walk\b", re.IGNORECASE),
    re.compile(r"\bstorytime\b", re.IGNORECASE),
    re.compile(r"\btea & tram\b", re.IGNORECASE),
]

_RECURRING_SHOW_RE: list[re.Pattern] = [
    re.compile(r"\bsaturday tours?\b", re.IGNORECASE),
    re.compile(r"\btea & tram tuesday\b", re.IGNORECASE),
    re.compile(r"\bpark pals\b", re.IGNORECASE),
    re.compile(r"\bstop[' ]?n[' ]?play\b", re.IGNORECASE),
    re.compile(r"\bcraft & create\b", re.IGNORECASE),
]

# Strips session-specific suffixes like "- Spring 2026", "- April", " 2026"
# Requires the seasonal/month keyword to appear after a separator
_SESSION_SUFFIX_RE = re.compile(
    r"\s+[-–]\s+(?:spring|summer|fall|winter|jan(?:uary)?|feb(?:ruary)?|"
    r"mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|"
    r"oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+\d{4})?\s*$",
    re.IGNORECASE,
)

# Parenthetical session identifiers: "(Homeschool Day 4/21)"
_PAREN_SESSION_RE = re.compile(
    r"\s*\([^)]*(?:\d+/\d+|\bday\b|\bweek\b)[^)]*\)\s*$", re.IGNORECASE
)


def _normalise_series_title(title: str) -> str:
    """Strip session-specific date/number suffixes for the series title."""
    t = _PAREN_SESSION_RE.sub("", title).strip()
    t = _SESSION_SUFFIX_RE.sub("", t).strip()
    # Strip trailing year
    t = re.sub(r"\s+\d{4}$", "", t).strip()
    return t or title


def _build_series_hint(title: str) -> Optional[dict]:
    """Return a series_hint dict if this event looks like a recurring series."""
    for pattern in _RECURRING_SHOW_RE:
        if pattern.search(title):
            return {
                "series_type": "recurring_show",
                "series_title": _normalise_series_title(title),
                "frequency": "irregular",
            }
    for pattern in _CLASS_SERIES_RE:
        if pattern.search(title):
            return {
                "series_type": "class_series",
                "series_title": _normalise_series_title(title),
                "frequency": "irregular",
            }
    return None


# ---------------------------------------------------------------------------
# HTML helpers
# ---------------------------------------------------------------------------

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")
_NBSP_RE = re.compile(r"\xa0|&nbsp;")


def _strip_html(raw: str, max_len: int = 800) -> str:
    """Strip HTML tags and normalise whitespace, truncating at max_len."""
    if not raw:
        return ""
    text = html_module.unescape(raw)
    text = _NBSP_RE.sub(" ", text)
    text = _HTML_TAG_RE.sub(" ", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    if len(text) > max_len:
        text = text[: max_len - 3].rstrip() + "..."
    return text


# ---------------------------------------------------------------------------
# rec1 session filtering
# ---------------------------------------------------------------------------


def _is_ehc_session(item: dict) -> bool:
    """Return True if this session is located at the EHC."""
    for feat in item.get("features", []):
        if feat.get("name") == "location":
            return _EHC_LOCATION_MATCH in feat.get("value", "").lower()
    return False


def _should_skip_title(title: str) -> bool:
    """Return True if this title is an administrative notice or non-public item."""
    lower = title.lower()
    return any(pat in lower for pat in _SKIP_TITLE_SUBSTRINGS)


def _should_skip_group(group_name: str) -> bool:
    """Return True if this group should be excluded (vendor opps, etc.)."""
    lower = group_name.lower()
    return any(pat in lower for pat in _SKIP_GROUP_SUBSTRINGS)


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
                    "[ehc] GET %s failed after %d attempts: %s", url, retries, exc
                )
                return None
            time.sleep(1.5 * attempt)
    return None


def _post_json(
    session: requests.Session,
    url: str,
    data: dict,
    csrf_key: str,
    csrf_token: str,
    retries: int = 3,
) -> Optional[dict]:
    """POST form data, return parsed JSON dict or None on failure."""
    headers = {
        **_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRF-Key": csrf_key,
        "X-CSRF-Token": csrf_token,
        "Referer": _CATALOG_BASE,
    }
    for attempt in range(1, retries + 1):
        try:
            resp = session.post(url, data=data, headers=headers, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            if attempt >= retries:
                logger.error(
                    "[ehc] POST %s failed after %d attempts: %s", url, retries, exc
                )
                return None
            time.sleep(1.5 * attempt)
        except ValueError as exc:
            logger.error("[ehc] JSON parse error at %s: %s", url, exc)
            return None
    return None


def _get_json(
    session: requests.Session,
    url: str,
    csrf_key: str,
    csrf_token: str,
    retries: int = 3,
) -> Optional[dict]:
    """GET a URL with CSRF headers, return parsed JSON dict or None."""
    headers = {
        **_HEADERS,
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRF-Key": csrf_key,
        "X-CSRF-Token": csrf_token,
        "Referer": _CATALOG_BASE,
    }
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, headers=headers, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            if attempt >= retries:
                logger.error(
                    "[ehc] GET JSON %s failed after %d attempts: %s", url, retries, exc
                )
                return None
            time.sleep(1.5 * attempt)
        except ValueError as exc:
            logger.error("[ehc] JSON parse error at %s: %s", url, exc)
            return None
    return None


# ---------------------------------------------------------------------------
# rec1 catalog session fetching
# ---------------------------------------------------------------------------


def _get_catalog_session_key(
    http_session: requests.Session,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Fetch the catalog page and extract the checkout key + CSRF tokens.

    Returns (checkout_key, csrf_key, csrf_token) or (None, None, None) on failure.
    """
    html_text = _get_text(http_session, _CATALOG_BASE)
    if not html_text:
        return None, None, None

    soup = BeautifulSoup(html_text, "html.parser")

    # CSRF tokens
    csrf_key_el = soup.find("meta", {"name": "csrf-key"})
    csrf_token_el = soup.find("meta", {"name": "csrf-token"})
    csrf_key = csrf_key_el["content"] if csrf_key_el else None
    csrf_token = csrf_token_el["content"] if csrf_token_el else None

    # Checkout key from data-page-data JSON
    page_div = soup.find("div", {"data-page": "catalog/index"})
    if not page_div:
        logger.error("[ehc] Could not find data-page='catalog/index' in catalog HTML")
        return None, csrf_key, csrf_token

    try:
        page_data = json.loads(
            html_module.unescape(page_div.get("data-page-data", "{}"))
        )
        checkout_key = page_data.get("checkoutData", {}).get("key")
    except (json.JSONDecodeError, AttributeError) as exc:
        logger.error("[ehc] Failed to parse page data JSON: %s", exc)
        return None, csrf_key, csrf_token

    if not checkout_key:
        logger.error("[ehc] No checkout key found in catalog page data")
        return None, csrf_key, csrf_token

    logger.debug(
        "[ehc] checkout_key=%s csrf_key=%s",
        checkout_key[:8] + "...",
        csrf_key[:8] + "..." if csrf_key else None,
    )
    return checkout_key, csrf_key, csrf_token


def _get_tab_groups(
    http_session: requests.Session,
    checkout_key: str,
    csrf_key: str,
    csrf_token: str,
    tab_id: str,
) -> list[dict]:
    """
    GET all section groups for a tab via getItems endpoint.

    Returns list of group dicts: {id, name, type, itemCount, deferredLoading}.
    """
    url = f"{_CATALOG_BASE}/getItems/{checkout_key}/{tab_id}"
    data = _post_json(
        http_session,
        url,
        {"page": "1", "limit": "50"},
        csrf_key,
        csrf_token,
    )
    if not data:
        return []

    groups = []
    for section in data.get("sections", []):
        for group in section.get("groups", []):
            group["_section_name"] = section.get("name", "")
            groups.append(group)
    return groups


def _get_group_sessions(
    http_session: requests.Session,
    checkout_key: str,
    csrf_key: str,
    csrf_token: str,
    tab_id: str,
    group_id: str,
    item_count: int,
) -> list[dict]:
    """
    Fetch all sessions for a group, paginating through all pages.

    Returns list of session dicts from getActivitySessions.
    """
    items_per_page = 10  # rec1 returns 10 per page for sessions
    total_pages = max(1, (item_count + items_per_page - 1) // items_per_page)
    url = f"{_CATALOG_BASE}/getActivitySessions/{checkout_key}/{tab_id}/{group_id}"

    all_items: list[dict] = []
    for page in range(1, total_pages + 1):
        time.sleep(_REQUEST_DELAY)
        data = _post_json(
            http_session,
            url,
            {"page": str(page)},
            csrf_key,
            csrf_token,
        )
        if not data:
            break
        page_items = data.get("items", [])
        all_items.extend(page_items)
        # Stop if we've loaded all items or the API signals no more
        if len(all_items) >= item_count:
            break

    return all_items


def _get_session_details(
    http_session: requests.Session,
    checkout_key: str,
    csrf_key: str,
    csrf_token: str,
    session_id: int,
) -> Optional[dict]:
    """
    GET structured session details (age, fee, schedule info) from getSessionDetails.

    Returns the 'details.info' dict or None on failure.
    """
    url = f"{_CATALOG_BASE}/getSessionDetails/{checkout_key}/{session_id}"
    data = _get_json(http_session, url, csrf_key, csrf_token)
    if not data:
        return None
    return data.get("details", {}).get("info")


def _get_session_description(
    http_session: requests.Session,
    checkout_key: str,
    csrf_key: str,
    csrf_token: str,
    session_id: int,
) -> Optional[str]:
    """
    GET HTML description from activityRegistration endpoint.

    Returns plain-text description stripped of HTML, or None.
    """
    url = f"{_CATALOG_BASE}/activityRegistration/{checkout_key}/{session_id}"
    headers = {
        **_HEADERS,
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRF-Key": csrf_key,
        "X-CSRF-Token": csrf_token,
        "Referer": _CATALOG_BASE,
    }
    try:
        resp = http_session.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        html_text = resp.text
    except requests.RequestException as exc:
        logger.debug(
            "[ehc] Description fetch failed for session %s: %s", session_id, exc
        )
        return None

    soup = BeautifulSoup(html_text, "html.parser")
    desc_div = soup.find("div", class_="rec1-catalog-item-description")
    if desc_div:
        return _strip_html(str(desc_div), max_len=800)

    # Fallback: strip all HTML from the response
    return _strip_html(html_text, max_len=800) or None


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Gwinnett Environmental & Heritage Center via the rec1 CivicRec JSON API.

    Steps:
      1. GET /catalog → extract checkout key + CSRF tokens
      2. For each target tab (Events, Nature & History, Education, Classes, Camps):
         a. POST getItems → get sections/groups
         b. For each group (skip vendor groups):
            - POST getActivitySessions page-by-page → all sessions
            - Filter to sessions where location feature matches EHC
            - For each EHC session: GET getSessionDetails (age, fee)
                                    GET activityRegistration (description)
            - Build event record and persist
      3. Return (events_found, events_new, events_updated)

    Returns (events_found, events_new, events_updated).
    """
    source_id: int = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    today = date.today()

    # Ensure venue record exists
    try:
        venue_id = get_or_create_venue(_VENUE_DATA)
        persist_result = persist_typed_entity_envelope(
            _build_destination_envelope(venue_id)
        )
        if persist_result.skipped:
            logger.warning(
                "[ehc] skipped typed destination writes: %s",
                persist_result.skipped,
            )
    except Exception as exc:
        logger.error("[ehc] Failed to create/find venue: %s", exc)
        return 0, 0, 0

    venue_name = _VENUE_DATA["name"]
    http_session = requests.Session()

    # ---- Step 1: Bootstrap catalog session ---------------------------------
    logger.info("[ehc] Bootstrapping rec1 catalog session")
    checkout_key, csrf_key, csrf_token = _get_catalog_session_key(http_session)
    if not checkout_key or not csrf_key or not csrf_token:
        logger.error("[ehc] Could not retrieve catalog session keys — aborting")
        return 0, 0, 0

    # ---- Step 2: Crawl each target tab ------------------------------------
    seen_session_ids: set[int] = set()  # deduplicate across tabs

    for tab_id, tab_name in _TARGET_TABS:
        logger.info("[ehc] Processing tab: %s (id=%s)", tab_name, tab_id)
        time.sleep(_REQUEST_DELAY)

        groups = _get_tab_groups(
            http_session, checkout_key, csrf_key, csrf_token, tab_id
        )
        if not groups:
            logger.debug("[ehc] No groups in tab %s", tab_name)
            continue

        logger.debug("[ehc] Tab %s: %d groups", tab_name, len(groups))

        for group in groups:
            group_id = group.get("id", "")
            group_name = group.get("name", "")
            group_type = group.get("type", "")
            item_count = int(group.get("itemCount", 0) or 0)

            if not group_id or group_type != "activity":
                continue

            if _should_skip_group(group_name):
                logger.debug("[ehc] Skipping vendor/non-public group: %r", group_name)
                continue

            if item_count == 0:
                continue

            logger.debug(
                "[ehc] Fetching group %r (%s, %d items)",
                group_name,
                group_id,
                item_count,
            )

            sessions = _get_group_sessions(
                http_session,
                checkout_key,
                csrf_key,
                csrf_token,
                tab_id,
                group_id,
                item_count,
            )

            for session in sessions:
                session_id = session.get("id")
                if not session_id:
                    continue

                # Deduplicate across tabs (same session can appear in multiple tabs)
                if session_id in seen_session_ids:
                    continue

                # Filter to EHC-located sessions
                if not _is_ehc_session(session):
                    continue

                title = session.get("text", "").strip()
                if not title or _should_skip_title(title):
                    logger.debug("[ehc] Skipping session: %r", title)
                    continue

                seen_session_ids.add(session_id)

                # Extract feature values
                features: dict[str, str] = {
                    f["name"]: f.get("value", "") for f in session.get("features", [])
                }

                # Parse date
                dates_str = features.get("dates", "")
                start_date_str, end_date_str = _parse_rec1_dates(dates_str)
                if not start_date_str:
                    logger.debug(
                        "[ehc] Could not parse date %r for %r — skipping",
                        dates_str,
                        title,
                    )
                    continue

                # Filter past events
                try:
                    start_dt = date.fromisoformat(start_date_str)
                except ValueError:
                    continue
                if start_dt < today:
                    logger.debug(
                        "[ehc] Past event, skipping: %r on %s", title, start_date_str
                    )
                    continue

                # Parse time
                times_str = features.get("times", "")
                start_time, end_time = _parse_rec1_time(times_str)
                is_all_day = start_time is None

                # Base price from session listing
                price_min: Optional[float] = None
                price_max: Optional[float] = None
                is_free = False
                raw_price = session.get("price")
                if raw_price is not None:
                    try:
                        price_val = float(raw_price)
                        price_min = price_val
                        price_max = price_val
                        is_free = price_val == 0.0
                    except (TypeError, ValueError):
                        pass

                # Age info from features
                age_text = features.get("ageGender", "")
                age_min, age_max = _parse_age_range(age_text)

                # ---- Fetch session details (structured info + richer price) ----
                time.sleep(_REQUEST_DELAY)
                details_info = _get_session_details(
                    http_session, checkout_key, csrf_key, csrf_token, session_id
                )

                # Override age from details if available
                if details_info:
                    age_gender_detail = details_info.get("Age/Gender", "")
                    if age_gender_detail:
                        age_min_d, age_max_d = _parse_age_range(age_gender_detail)
                        if age_min_d is not None or age_max_d is not None:
                            age_min, age_max = age_min_d, age_max_d

                    # Richer price from Fee field
                    fee_str = details_info.get("Fee", "")
                    if fee_str:
                        pm, px, ifr = _parse_price(fee_str)
                        if pm is not None:
                            price_min, price_max, is_free = pm, px, ifr

                # ---- Fetch description ----------------------------------------
                time.sleep(_REQUEST_DELAY)
                description = _get_session_description(
                    http_session, checkout_key, csrf_key, csrf_token, session_id
                )

                # ---- Category and tags ----------------------------------------
                category, tags = _infer_category_and_tags(
                    tab_name,
                    group_name,
                    title,
                    description or "",
                    age_min,
                    age_max,
                )

                if is_free and "free" not in tags:
                    tags.append("free")

                if session.get("registrationOpen") and "rsvp-required" not in tags:
                    tags.append("rsvp-required")

                # ---- Series hint ----------------------------------------------
                series_hint = _build_series_hint(title)

                # ---- Content hash --------------------------------------------
                hash_key = start_date_str
                if start_time:
                    hash_key = f"{start_date_str}|{start_time}"
                content_hash = generate_content_hash(title, venue_name, hash_key)

                # ---- Source URL (deep link into catalog) ---------------------
                source_url = f"{_CATALOG_BASE}?tab={tab_id}&session={session_id}"

                # Only store end_date when it differs from start_date
                end_date_out = (
                    end_date_str
                    if end_date_str and end_date_str != start_date_str
                    else None
                )

                # ---- Build event record --------------------------------------
                record: dict = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date_str,
                    "end_date": end_date_out,
                    "start_time": start_time,
                    "end_time": end_time,
                    "is_all_day": is_all_day,
                    "category": category,
                    "tags": tags,
                    "is_free": is_free,
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": None,
                    "source_url": source_url,
                    "ticket_url": source_url,
                    "image_url": None,
                    "raw_text": title,
                    "extraction_confidence": 0.90,
                    "is_recurring": series_hint is not None,
                    "content_hash": content_hash,
                }

                if age_min is not None:
                    record["age_min"] = age_min
                if age_max is not None:
                    record["age_max"] = age_max

                # ---- Persist -------------------------------------------------
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
                            "[ehc] Added: %s on %s",
                            record["title"],
                            record["start_date"],
                        )
                    except Exception as exc:
                        logger.error(
                            "[ehc] Failed to insert %r: %s", record["title"], exc
                        )

    logger.info(
        "[ehc] Crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
