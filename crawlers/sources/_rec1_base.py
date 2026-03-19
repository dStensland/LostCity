"""
Shared Rec1 (CivicRec) crawler base for Georgia county parks and recreation.

Rec1 (secure.rec1.com) powers parks & recreation registration portals for
Georgia counties. This module handles the full crawl lifecycle:

  1. Fetch the catalog page to extract a session checkout key.
  2. Use /catalog/getTabsFiltersItemsCounts to enumerate program tabs.
  3. Use /catalog/getItems per tab to get activity groups.
  4. Use /catalog/getActivitySessions per group to get individual sessions
     (dates, times, prices, locations, age ranges).
  5. Emit one event record per session that has a concrete future date.

Designed for reuse across tenants (Cobb, Gwinnett, etc.) by passing a
TenantConfig object to crawl_tenant().

Session URL pattern: https://secure.rec1.com/GA/<tenant>/catalog
Individual session registration: https://secure.rec1.com/GA/<tenant>/catalog
  (no deep link — all sessions open in the same SPA, so we link to the catalog)
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Callable, Optional

import requests

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    insert_program,
    infer_program_type,
    infer_season,
    infer_cost_period,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from entity_lanes import TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest",
}
_CATALOG_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Polite delay between API requests (seconds)
_REQUEST_DELAY = 0.8

# Max sessions to fetch per activity group before paginating
_SESSIONS_PAGE_SIZE = 100

# ---------------------------------------------------------------------------
# Age-band helpers (shared with childrens_museum.py pattern)
# ---------------------------------------------------------------------------

_AGE_BANDS: list[tuple[str, int, int]] = [
    ("infant", 0, 1),
    ("toddler", 1, 3),
    ("preschool", 3, 5),
    ("elementary", 5, 12),
    ("tween", 10, 13),
    ("teen", 13, 18),
]

# Keywords in a program name that indicate adults-only content.  Matched
# case-insensitively against the lowercased program title.
ADULT_KEYWORDS: list[str] = [
    "aarp",
    "senior",
    "seniors",
    "turning 65",
    "medicare",
    "adult only",
    "adults only",
    "21+",
    "55+",
    "50+",
    "adult acrylic",
    "adult watercolor",
    "adult pottery",
    "adult doubles",
    "adult singles",
    "adult beginner",
    "adult intermediate",
    "adult advanced",
    "wine and",
    "wine &",
    "cocktail",
]


def is_adult_program(name: str, age_min: Optional[int]) -> bool:
    """Return True when a program is clearly adults-only.

    Detection is intentionally broad: keyword match OR age_min >= 18.
    The caller should add 'adults-only' to the tags array but NOT skip the
    record — adult programs belong in the Atlanta base portal, just not in
    the family portal lane where the 'adults-only' tag is an exclusion filter.
    """
    name_lower = name.lower()
    if any(kw in name_lower for kw in ADULT_KEYWORDS):
        return True
    if age_min is not None and age_min >= 18:
        return True
    return False


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    """Return age-band tags that overlap with [age_min, age_max]."""
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 100
    return [
        tag for tag, band_lo, band_hi in _AGE_BANDS if lo <= band_hi and hi >= band_lo
    ]


def _parse_age_range_text(text: str) -> tuple[Optional[int], Optional[int]]:
    """
    Parse age_min / age_max from Rec1 ageGender feature strings.

    Handles:
      - "Ages 3-12"  /  "Ages 5 to 10"
      - "Ages 6 and up"  /  "Ages 6+"  /  "6+ years"
      - "Birth to 5"
      - "All Ages"  -> (None, None)
      - "Adults" / "Adult" -> (18, None)
      - "Seniors 55+" -> (55, None)
      - "Youth (5-17)" -> (5, 17)
    """
    if not text:
        return None, None
    t = text.strip().lower()

    if t in ("all ages", "all", ""):
        return None, None

    if t in ("adult", "adults"):
        return 18, None

    # "3yr 6m-10" / "3 years 6 months - 10 years"
    m = re.search(
        r"(\d+)\s*y(?:r|ear)?s?(?:\s+\d+\s*m(?:o|onth)?s?)?\s*(?:-|–|to)\s*(\d+)",
        t,
    )
    if m:
        return int(m.group(1)), int(m.group(2))

    # "Seniors 55+" or "Senior (55+)"
    m = re.search(r"senior\w*.*?(\d+)\+?", t)
    if m:
        return int(m.group(1)), None

    # "birth to N" or "newborn to N"
    m = re.search(r"(?:birth|newborn)\s*(?:to|-|–)\s*(\d+)", t)
    if m:
        return 0, int(m.group(1))

    # "Ages N-M" / "Ages N to M" / "Youth (N-M)"
    m = re.search(r"(\d+)\s*(?:-|–|to)\s*(\d+)", t)
    if m:
        return int(m.group(1)), int(m.group(2))

    # "Ages N and up" / "Ages N+" / "N+"
    m = re.search(r"(?:ages?\s+)?(\d+)\s*(?:\+|and\s+(?:up|older)|or\s+older)", t)
    if m:
        return int(m.group(1)), None

    # lone "age N"
    m = re.search(r"ages?\s+(\d+)", t)
    if m:
        age = int(m.group(1))
        return age, age

    return None, None


# ---------------------------------------------------------------------------
# Time / date parsing
# ---------------------------------------------------------------------------


def _parse_time_str(time_str: str) -> Optional[str]:
    """
    Convert Rec1 time strings to HH:MM 24-hour format.

    Handles: "9am", "9:30am", "11 AM", "7pm", "12pm", "12am"
    """
    if not time_str:
        return None
    t = time_str.strip().lower().replace(" ", "")
    # Midnight special-case: Rec1 sometimes uses "12am-12am" for all-day
    if t in ("12am", "12:00am"):
        return "00:00"
    m = re.match(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)$", t)
    if not m:
        return None
    hour, minute, period = int(m.group(1)), int(m.group(2) or 0), m.group(3)
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _parse_date_str(date_str: str, today: date) -> Optional[date]:
    """
    Parse Rec1 date strings into a date object.

    Formats seen:
      - "MM/DD/YY"  (e.g. "03/27/26")
      - "MM/DD"     (e.g. "4/25" — no year, assume current or next year)
      - "M/DD/YYYY" (e.g. "1/28/2026")
    """
    if not date_str:
        return None
    date_str = date_str.strip()
    for fmt in ("%m/%d/%y", "%m/%d/%Y"):
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            pass
    # Short form "M/DD" — no year
    m = re.match(r"^(\d{1,2})/(\d{1,2})$", date_str)
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        year = today.year
        candidate = date(year, month, day)
        if candidate < today and (today - candidate).days > 180:
            candidate = date(year + 1, month, day)
        return candidate
    return None


def _parse_date_range(
    dates_value: str, today: date
) -> tuple[Optional[date], Optional[date]]:
    """
    Parse Rec1 dates feature value into (start_date, end_date).

    Formats:
      - "03/27/26"             -> single day
      - "01/01-12/31"          -> range within same year (no year)
      - "03/28/26 - 04/01/26"  -> explicit range
    """
    if not dates_value:
        return None, None
    dates_value = dates_value.strip()

    # Try explicit range with year on both sides: "MM/DD/YY - MM/DD/YY"
    m = re.match(
        r"^(\d{1,2}/\d{1,2}/\d{2,4})\s*[-–]\s*(\d{1,2}/\d{1,2}/\d{2,4})$", dates_value
    )
    if m:
        start = _parse_date_str(m.group(1), today)
        end = _parse_date_str(m.group(2), today)
        return start, end

    # Short range "MM/DD-MM/DD" — both sides lack a year.
    # Derive the year from the end date first, then anchor start to the same year.
    # This handles "01/01-12/31" correctly as a full-year program rather than
    # rolling the start to next year when Jan 1 is in the past.
    m = re.match(r"^(\d{1,2}/\d{1,2})\s*[-–]\s*(\d{1,2}/\d{1,2})$", dates_value)
    if m:
        end = _parse_date_str(m.group(2), today)
        if end:
            # Parse start in the same year as end
            try:
                start_parts = m.group(1).split("/")
                start = date(end.year, int(start_parts[0]), int(start_parts[1]))
                # If start > end, the range wraps a year boundary (e.g. "11/01-02/28")
                # — roll start back one year so the range is contiguous.
                if start > end:
                    start = date(end.year - 1, start.month, start.day)
            except ValueError:
                start = _parse_date_str(m.group(1), today)
        else:
            start = _parse_date_str(m.group(1), today)
        return start, end

    # Single date
    d = _parse_date_str(dates_value, today)
    return d, d


def _parse_time_range(times_value: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse Rec1 times feature value into (start_time, end_time).

    Formats: "7pm-9pm", "9am-12pm", "12am-12am" (all-day marker)
    """
    if not times_value:
        return None, None
    times_value = times_value.strip()

    # All-day marker
    if times_value.lower() in ("12am-12am", "12:00am-12:00am"):
        return None, None

    m = re.match(r"^(.+?)\s*-\s*(.+?)$", times_value)
    if m:
        return _parse_time_str(m.group(1)), _parse_time_str(m.group(2))

    return _parse_time_str(times_value), None


def _parse_schedule_days(days_value: str) -> Optional[list[int]]:
    """
    Parse Rec1 schedule day strings into ISO weekday integers.

    Examples:
      - "Weekdays" -> [1,2,3,4,5]
      - "Mon/Wed" -> [1,3]
      - "Tue & Thu" -> [2,4]
      - "Sat" -> [6]
    """
    if not days_value:
        return None

    normalized = days_value.strip().lower()
    if not normalized:
        return None
    if "weekday" in normalized:
        return [1, 2, 3, 4, 5]
    if "weekend" in normalized:
        return [6, 7]

    day_map = {
        "m": 1,
        "mon": 1,
        "monday": 1,
        "tu": 2,
        "tue": 2,
        "tues": 2,
        "tuesday": 2,
        "t": 2,
        "w": 3,
        "wed": 3,
        "weds": 3,
        "wednesday": 3,
        "th": 4,
        "thu": 4,
        "thur": 4,
        "thurs": 4,
        "thursday": 4,
        "f": 5,
        "fri": 5,
        "friday": 5,
        "sa": 6,
        "sat": 6,
        "saturday": 6,
        "su": 7,
        "sun": 7,
        "sunday": 7,
    }

    values: list[int] = []
    tokens = re.findall(r"[a-z]+", normalized)
    for index, token in enumerate(tokens):
        day = day_map.get(token)
        if day and day not in values:
            values.append(day)

        # Range formats like "F-SU" / "Mon-Thu"
        if token in {"to", "through", "thru"} and 0 < index < len(tokens) - 1:
            start = day_map.get(tokens[index - 1])
            end = day_map.get(tokens[index + 1])
            if start and end:
                if start <= end:
                    expanded = range(start, end + 1)
                else:
                    expanded = list(range(start, 8)) + list(range(1, end + 1))
                for expanded_day in expanded:
                    if expanded_day not in values:
                        values.append(expanded_day)

    # Hyphenated short ranges survive tokenization as adjacent day tokens.
    day_tokens = [day_map[token] for token in tokens if token in day_map]
    if len(day_tokens) == 2 and "-" in normalized:
        start, end = day_tokens
        values = []
        if start <= end:
            values.extend(range(start, end + 1))
        else:
            values.extend(range(start, 8))
            values.extend(range(1, end + 1))
    return values or None


def _parse_registration_window(
    session: dict,
    basic_info: list[str],
    default_year: int,
) -> tuple[Optional[str], Optional[str]]:
    """
    Parse registration open/close dates from Rec1 session fields.
    Returns ISO date strings.
    """
    registration_opens: Optional[date] = None
    registration_closes: Optional[date] = None

    reg_start = session.get("regStart")
    if reg_start:
        registration_opens = _parse_date_str(reg_start, date(default_year, 1, 1))

    registration_line = next(
        (entry for entry in basic_info if str(entry).lower().startswith("registration:")),
        None,
    )
    if registration_line:
        normalized_line = str(registration_line).lower()
        months = {
            "jan": 1,
            "feb": 2,
            "mar": 3,
            "apr": 4,
            "may": 5,
            "jun": 6,
            "jul": 7,
            "aug": 8,
            "sep": 9,
            "oct": 10,
            "nov": 11,
            "dec": 12,
        }
        month_day_pairs = re.findall(
            r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})\b",
            normalized_line,
        )
        if month_day_pairs:
            try:
                if not registration_opens:
                    month, day_num = month_day_pairs[0]
                    registration_opens = date(default_year, months[month], int(day_num))
                month, day_num = month_day_pairs[-1]
                registration_closes = date(default_year, months[month], int(day_num))
            except ValueError:
                pass

        if not registration_opens or not registration_closes:
            numeric_pairs = re.findall(r"(\d{1,2}/\d{1,2})(?:/\d{2,4})?", normalized_line)
            parsed_numeric_dates = [
                parsed_date
                for parsed_date in (_parse_date_str(value, date(default_year, 1, 1)) for value in numeric_pairs)
                if parsed_date
            ]
            if parsed_numeric_dates:
                if not registration_opens:
                    registration_opens = parsed_numeric_dates[0]
                if not registration_closes:
                    registration_closes = parsed_numeric_dates[-1]

    return (
        registration_opens.isoformat() if registration_opens else None,
        registration_closes.isoformat() if registration_closes else None,
    )


# ---------------------------------------------------------------------------
# Category + tag inference
# ---------------------------------------------------------------------------

# Session type codes from Rec1 JS:
#   1=League  2=Program/Class  3=Membership  4=Event  5=Drop-In
#   6=Donation  7=Package  8=Camps & Afterschool  9=Merchandise  10=Ticket
_REG_TYPE_TO_CATEGORY = {
    "1": "sports",  # League
    "2": "programs",  # Program/Class
    "3": None,  # Membership — skip
    "4": "family",  # Event
    "5": "programs",  # Drop-In
    "6": None,  # Donation — skip
    "7": None,  # Package — skip
    "8": "programs",  # Camps
    "9": None,  # Merchandise — skip
    "10": "family",  # Ticket (concert/event)
}

# Registration types to skip entirely (not actual events)
_SKIP_REG_TYPES = {"3", "6", "7", "9"}

# Section name keywords → category overrides
_SECTION_CATEGORY_OVERRIDES: dict[str, str] = {
    "aquatics": "fitness",
    "swim": "fitness",
    "gymnastics": "fitness",
    "tennis": "fitness",
    "fitness": "fitness",
    "wellness": "wellness",
    "yoga": "wellness",
    "dance": "dance",
    "arts": "learning",
    "art": "learning",
    "crafts": "learning",
    "nature": "outdoors",
    "outdoor": "outdoors",
    "hike": "outdoors",
    "camp": "programs",
    "camps": "programs",
    "afterschool": "programs",
    "after school": "programs",
    "senior": "community",
    "seniors": "community",
    "adaptive": "programs",
    "sport": "sports",
    "sports": "sports",
    "league": "sports",
    "concert": "music",
    "music": "music",
    "theatre": "theater",
    "theater": "theater",
    "event": "family",
    "education": "learning",
}

# Section name keywords → tags to add
_SECTION_TAG_MAP: dict[str, list[str]] = {
    "aquatics": ["water-sports"],
    "swim": ["water-sports"],
    "yoga": ["yoga"],
    "dance": ["dance"],
    "line danc": ["line-dancing"],
    "camp": ["kids", "educational"],
    "afterschool": ["kids", "educational"],
    "after school": ["kids", "educational"],
    "nature": ["outdoor", "hiking"],
    "outdoor": ["outdoor"],
    "hike": ["outdoor", "hiking"],
    "senior": ["adults"],
    "adaptive": ["accessible"],
    "arts": ["hands-on"],
    "craft": ["hands-on"],
    "concert": ["live-music"],
    "music": ["live-music"],
    "theatre": ["community"],
    "theater": ["community"],
    "trivia": ["trivia"],
    "pickleball": ["pickleball"],
    "tennis": ["tennis"],
    "picnic": ["outdoor"],
    "festival": ["holiday"],
    "fair": ["holiday"],
}

_FAMILY_SIGNAL_RE = re.compile(
    r"\bfamily\b|\byouth\b|\bkids?\b|\bchild(?:ren)?\b|\bcamp\b|\bteen\b|\btween\b|"
    r"\bpreschool\b|\btoddler\b|\binfant\b|\bbaby\b|\bparent\b",
    re.IGNORECASE,
)
_ADULT_SIGNAL_RE = re.compile(
    r"\badult\b|\bsenior\b|\bolder adult\b|\b50\+\b|\b55\+\b",
    re.IGNORECASE,
)


def _infer_category_and_tags(
    session_name: str,
    section_name: str,
    group_name: str,
    reg_type: str,
    age_min: Optional[int],
    age_max: Optional[int],
    county_tag: str,
) -> tuple[str, list[str]]:
    """Return (category, tags) for a Rec1 session."""
    # Base tags: county origin + registration marker
    tags: list[str] = [county_tag, "family-friendly"]
    combined = f"{session_name} {section_name} {group_name}".lower()

    # Category from registration type
    category = _REG_TYPE_TO_CATEGORY.get(reg_type, "community")
    if not category:
        category = "community"

    # Structured programs (classes, camps, leagues) get "rsvp-required" + "class"
    # One-off ticketed events (reg type 10 = Ticket, 4 = Event) get "ticketed" instead
    if reg_type in ("10", "4"):
        tags.append("ticketed")
    else:
        tags.append("rsvp-required")
        tags.append("class")

    # Section/group keyword overrides
    for kw, cat in _SECTION_CATEGORY_OVERRIDES.items():
        if kw in combined:
            category = cat
            break

    # Extra tags from section content
    for kw, extra_tags in _SECTION_TAG_MAP.items():
        if kw in combined:
            for t in extra_tags:
                if t not in tags:
                    tags.append(t)

    # Age band tags
    age_tags = _age_band_tags(age_min, age_max)
    for t in age_tags:
        if t not in tags:
            tags.append(t)

    # Kids tag for programs targeting children
    if age_max is not None and age_max <= 17:
        if "kids" not in tags:
            tags.append("kids")
    if age_min is not None and age_min >= 18:
        tags.append("adults")
        if "family-friendly" in tags:
            tags.remove("family-friendly")

    # Adults-only detection: keyword match or structured age data.
    # Tag the record rather than skipping it — adult programs belong in the
    # Atlanta base portal, just not the family portal lane.
    if is_adult_program(session_name, age_min):
        if "adults-only" not in tags:
            tags.append("adults-only")
        if "family-friendly" in tags:
            tags.remove("family-friendly")

    return category, tags


# ---------------------------------------------------------------------------
# Tenant config
# ---------------------------------------------------------------------------


@dataclass
class VenueInfo:
    """Metadata for a known Rec1 venue / recreation center."""

    name: str
    slug: str
    address: str
    neighborhood: str
    city: str
    state: str
    zip_code: str
    lat: float
    lng: float
    venue_type: str = "recreation"


@dataclass
class TenantConfig:
    """Configuration for one Rec1 tenant (county)."""

    # Tenant slug in the Rec1 URL (e.g. "cobb-county-ga")
    tenant_slug: str
    # Human-readable county name (e.g. "Cobb County")
    county_name: str
    # Tag applied to every event from this county (e.g. "cobb")
    county_tag: str
    # Default venue for events where the location can't be resolved
    default_venue: VenueInfo
    # Map of Rec1 location name (case-insensitive) to venue info
    known_venues: dict[str, VenueInfo] = field(default_factory=dict)
    # Tab IDs to crawl (empty = crawl all tabs)
    # Set to non-empty to skip tabs like Memberships, Facility Reservations, etc.
    crawl_tab_ids: list[str] = field(default_factory=list)
    # Tab IDs to skip explicitly
    skip_tab_ids: list[str] = field(default_factory=list)
    # Skip groups/activities whose names match these substrings (case-insensitive)
    skip_group_keywords: list[str] = field(default_factory=list)
    # Skip individual session titles whose names match these substrings (case-insensitive)
    skip_session_keywords: list[str] = field(default_factory=list)
    # When true, only keep youth/family-relevant sessions from broad civic catalogs.
    require_family_relevance: bool = False
    # Optional venue-level enrichment builder for touched facilities.
    venue_enrichment_builder: Optional[
        Callable[[VenueInfo, int], Optional[TypedEntityEnvelope]]
    ] = None


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _get_catalog_url(tenant_slug: str) -> str:
    return f"https://secure.rec1.com/GA/{tenant_slug}/catalog"


def _get_checkout_key(tenant_slug: str) -> Optional[str]:
    """
    Fetch the catalog page and extract the checkout key from the page data.

    The catalog page embeds JSON in data-page-data on the .ui-page div:
      {"checkoutData":{"key":"<uuid>", ...}, ...}
    """
    url = _get_catalog_url(tenant_slug)
    try:
        resp = requests.get(url, headers=_CATALOG_HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("[rec1/%s] Failed to fetch catalog page: %s", tenant_slug, exc)
        return None

    m = re.search(r'data-page-data="([^"]+)"', resp.text)
    if not m:
        logger.error(
            "[rec1/%s] Could not find data-page-data in catalog HTML", tenant_slug
        )
        return None

    # The attribute value uses HTML-encoded quotes
    raw = m.group(1).replace("&quot;", '"').replace("&#039;", "'").replace("&amp;", "&")
    try:
        page_data = json.loads(raw)
        key = page_data["checkoutData"]["key"]
        logger.info("[rec1/%s] Got checkout key: %s", tenant_slug, key)
        return key
    except (KeyError, ValueError) as exc:
        logger.error("[rec1/%s] Failed to parse page data JSON: %s", tenant_slug, exc)
        return None


def _api_get(tenant_slug: str, path: str, **kwargs) -> Optional[dict]:
    """Make an authenticated-as-guest GET request to the Rec1 catalog API."""
    base = f"https://secure.rec1.com/GA/{tenant_slug}"
    url = f"{base}{path}"
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=30, **kwargs)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        logger.warning("[rec1/%s] API GET %s failed: %s", tenant_slug, path, exc)
        return None
    except ValueError as exc:
        logger.warning(
            "[rec1/%s] API GET %s JSON parse error: %s", tenant_slug, path, exc
        )
        return None


# ---------------------------------------------------------------------------
# Catalog crawl helpers
# ---------------------------------------------------------------------------


def _get_tabs(tenant_slug: str, checkout_key: str) -> list[dict]:
    """Return all catalog tabs (id, label)."""
    data = _api_get(tenant_slug, f"/catalog/getTabsFiltersItemsCounts/{checkout_key}")
    if not data:
        return []
    return data.get("tabs", [])


def _get_groups_for_tab(
    tenant_slug: str,
    checkout_key: str,
    tab_id: str,
) -> list[tuple[str, str, dict]]:
    """
    Return all activity groups for a tab as (section_name, group_dict) pairs.

    The getItems endpoint returns a nested structure:
      sections[] -> groups[] (each with id, name, type, deferredLoading, itemCount, ...)
    """
    data = _api_get(tenant_slug, f"/catalog/getItems/{checkout_key}/{tab_id}")
    if not data:
        return []

    result = []
    for section in data.get("sections", []):
        section_name = section.get("name", "")
        for group in section.get("groups", []):
            result.append((section_name, group))

    # Also handle any top-level items that aren't in sections
    for group in data.get("groups", []):
        result.append(("", group))

    return result


def _get_sessions_for_group(
    tenant_slug: str,
    checkout_key: str,
    tab_id: str,
    group_id: str,
    group_type: str,
) -> list[dict]:
    """
    Fetch all sessions for an activity group, handling pagination.

    Uses /catalog/getActivitySessions for type='activity' groups.
    Returns empty list for unsupported group types.
    """
    if group_type != "activity":
        # Future: handle 'location' and 'rentalItemGroup' types if needed
        return []

    all_items = []
    page = 1

    while True:
        path = (
            f"/catalog/getActivitySessions/{checkout_key}/{tab_id}/{group_id}"
            f"?page={page}"
        )
        data = _api_get(tenant_slug, path)
        if not data:
            break

        items = data.get("items", [])
        if not items:
            break

        all_items.extend(items)
        item_count = data.get("itemCount", len(all_items))

        if len(all_items) >= int(item_count):
            break

        page += 1
        time.sleep(_REQUEST_DELAY)

    return all_items


# ---------------------------------------------------------------------------
# Session → event record conversion
# ---------------------------------------------------------------------------


def _extract_feature(features: list[dict], name: str) -> str:
    """Extract the value of a named feature from a session's features list."""
    for f in features:
        if f.get("name") == name:
            return f.get("value", "")
    return ""


def _should_skip_session(
    session: dict,
    skip_reg_types: set = _SKIP_REG_TYPES,
) -> bool:
    """Return True if this session should be excluded from LostCity."""
    reg_type = str(session.get("registrationType", ""))
    if reg_type in skip_reg_types:
        return True
    # Skip canceled sessions
    if session.get("canceled"):
        return True
    # Skip items with no online registration (staff-only)
    if session.get("online") == "0":
        return True
    return False


def _should_skip_session_keywords(session: dict, skip_keywords: list[str]) -> bool:
    """Return True if this session title should be excluded by tenant keywords."""
    if not skip_keywords:
        return False
    title = (session.get("text") or "").strip().lower()
    if not title:
        return False
    return any(keyword.lower() in title for keyword in skip_keywords)


def is_family_relevant_session(
    *,
    section_name: str,
    group_name: str,
    session: dict,
    age_min: Optional[int],
    age_max: Optional[int],
    tags: list[str],
) -> bool:
    """Return True when a Rec1 session belongs in Hooky's family-program lane."""
    if age_min is not None and age_min >= 18:
        return False
    if age_max is not None and age_max <= 17:
        return True
    if age_min is not None and age_min < 18:
        return True

    age_text = _extract_feature(session.get("features", []), "ageGender")
    combined = " ".join(
        [
            section_name,
            group_name,
            session.get("text", ""),
            age_text,
            " ".join(tags),
        ]
    ).strip()

    if "adults" in tags and not any(
        tag in tags for tag in ("kids", "preschool", "elementary", "tween", "teen")
    ):
        return False
    if _FAMILY_SIGNAL_RE.search(combined):
        return True
    if _ADULT_SIGNAL_RE.search(combined):
        return False
    return False


def _build_event_record(
    session: dict,
    section_name: str,
    group_name: str,
    group_description: str,
    activity_image: Optional[str],
    tenant: TenantConfig,
    venue_id: int,
    venue_name: str,
    source_id: int,
    catalog_url: str,
    today: date,
) -> Optional[dict]:
    """
    Convert a Rec1 session dict to a LostCity event record dict.

    Returns None if the session should be skipped (past, no date, etc.).
    """
    features = session.get("features", [])
    session_id = session.get("id")
    title = session.get("text", "").strip()
    reg_type = str(session.get("registrationType", "2"))
    price = session.get("price", 0)
    is_full = session.get("sessionFull", False)

    if not title or not session_id:
        return None

    # Strip trailing session number in parentheses: "Swim Lessons (50349)" -> "Swim Lessons"
    title = re.sub(r"\s*\(\d+\)\s*$", "", title).strip()

    # Feature values
    location_str = _extract_feature(features, "location")
    age_str = _extract_feature(features, "ageGender")
    dates_str = _extract_feature(features, "dates")
    times_str = _extract_feature(features, "times")

    # Parse dates
    start_date, end_date = _parse_date_range(dates_str, today)
    if not start_date:
        return None

    # Skip if entirely in the past
    if end_date and end_date < today:
        return None
    if start_date < today and not end_date:
        return None

    # All-day detection: Rec1 uses "12am-12am" for open-ended or all-day programs
    is_all_day_marker = (
        times_str.lower() in ("12am-12am", "12:00am-12:00am") if times_str else False
    )

    start_time, end_time = (
        _parse_time_range(times_str) if not is_all_day_marker else (None, None)
    )

    # Age range
    age_min, age_max = _parse_age_range_text(age_str)

    # Category and tags
    category, tags = _infer_category_and_tags(
        title, section_name, group_name, reg_type, age_min, age_max, tenant.county_tag
    )

    # Price
    price_val = float(price) if price else 0.0
    is_free = price_val == 0.0
    price_min = price_val if not is_free else 0.0
    price_max = price_val if not is_free else 0.0

    # Sold-out tag
    if is_full:
        tags.append("sold-out")

    # Description: use group description if available, otherwise synthesize
    raw_desc = group_description or ""
    if raw_desc:
        # Strip HTML
        description = re.sub(r"<[^>]+>", " ", raw_desc)
        description = re.sub(r"\s+", " ", description).strip()
        description = re.sub(r"&amp;", "&", description)
        description = re.sub(r"&nbsp;", " ", description)
        description = re.sub(r"&lt;", "<", description)
        description = re.sub(r"&gt;", ">", description)
        if len(description) > 600:
            description = description[:597] + "..."
    else:
        # Synthesize a minimal description
        parts = []
        if section_name and section_name != group_name:
            parts.append(section_name)
        if location_str and location_str.lower() not in ("multiple", "tbd", ""):
            parts.append(f"at {location_str}")
        description = f"{title}" + (f" — {', '.join(parts)}" if parts else "")
        description += f". Offered by {tenant.county_name} Parks & Recreation."

    # Content hash for deduplication
    content_hash = generate_content_hash(
        title, venue_name, start_date.strftime("%Y-%m-%d")
    )

    record: dict = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": (end_date or start_date).strftime("%Y-%m-%d"),
        "start_time": start_time,
        "end_time": end_time,
        "is_all_day": is_all_day_marker or (start_time is None and end_time is None),
        "category": category,
        "tags": tags,
        "is_free": is_free,
        "price_min": price_min,
        "price_max": price_max,
        "price_note": None if is_free else f"${price_val:.0f} resident fee",
        "source_url": catalog_url,
        "ticket_url": catalog_url,
        "image_url": activity_image,
        "raw_text": f"{section_name} | {group_name} | {title}",
        "extraction_confidence": 0.88,
        "is_recurring": False,
        "content_hash": content_hash,
    }

    if age_min is not None:
        record["age_min"] = age_min
    if age_max is not None:
        record["age_max"] = age_max

    return record


# ---------------------------------------------------------------------------
# Program dual-write
# ---------------------------------------------------------------------------

# Reg types that qualify as programs (class, drop-in, camp, league)
_PROGRAM_REG_TYPES = {"1", "2", "5", "8"}


def _build_program_record(
    event_record: dict,
    session: dict,
    section_name: str,
    group_name: str,
    venue_name: str,
    reg_type: str,
    tenant: "TenantConfig",
) -> Optional[dict]:
    """
    Build a program record from an event record and session data.
    Returns None if this session doesn't qualify as a program.
    """
    if reg_type not in _PROGRAM_REG_TYPES:
        return None

    from datetime import datetime

    title = event_record["title"]
    start_date_str = event_record.get("start_date")
    end_date_str = event_record.get("end_date")
    features = session.get("features", [])
    basic_info = session.get("basicInfo") or []

    session_start = None
    if start_date_str:
        try:
            session_start = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            pass

    session_end = None
    if end_date_str:
        try:
            session_end = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            pass

    program_type = infer_program_type(title, reg_type, section_name)
    season = infer_season(f"{title} {section_name}", session_start)
    schedule_days = _parse_schedule_days(_extract_feature(features, "days"))
    registration_opens, registration_closes = _parse_registration_window(
        session,
        basic_info,
        session_start.year if session_start else date.today().year,
    )

    price_val = event_record.get("price_min", 0) or 0
    cost_notes = session.get("customDisplayPrice") or event_record.get("price_note")
    cost_period = infer_cost_period(cost_notes, reg_type)

    # Registration status from session fullness
    is_full = session.get("sessionFull", False)
    reg_status = "closed" if is_full else "open"

    # Clamp stale open status: if the registration deadline has already passed,
    # mark closed regardless of what the API reports. The API only updates this
    # field when something changes on their side, so programs can sit as "open"
    # indefinitely after their deadline.
    if reg_status == "open" and registration_closes:
        try:
            closes_date = date.fromisoformat(registration_closes)
            if closes_date < date.today():
                reg_status = "closed"
        except (ValueError, TypeError):
            pass

    # Build the record
    program: dict = {
        "source_id": event_record.get("source_id"),
        "venue_id": event_record.get("venue_id"),
        "name": title,
        "description": event_record.get("description"),
        "program_type": program_type,
        "provider_name": tenant.county_name,
        "age_min": event_record.get("age_min"),
        "age_max": event_record.get("age_max"),
        "season": season,
        "session_start": start_date_str,
        "session_end": end_date_str,
        "schedule_days": schedule_days,
        "schedule_start_time": event_record.get("start_time"),
        "schedule_end_time": event_record.get("end_time"),
        "cost_amount": price_val if price_val > 0 else None,
        "cost_period": cost_period if price_val > 0 else None,
        "cost_notes": cost_notes,
        "registration_status": reg_status,
        "registration_opens": registration_opens,
        "registration_closes": registration_closes,
        "registration_url": event_record.get("source_url"),
        "tags": event_record.get("tags", []),
        "metadata": {
            "session_id": session.get("id"),
            "registration_type": reg_type,
            "registration_open": session.get("registrationOpen"),
            "registration_over": session.get("registrationOver"),
            "session_full": session.get("sessionFull"),
            "location": _extract_feature(features, "location"),
            "age_gender": _extract_feature(features, "ageGender"),
            "days": _extract_feature(features, "days"),
            "dates": _extract_feature(features, "dates"),
            "times": _extract_feature(features, "times"),
            "basic_info": basic_info,
        },
        "_venue_name": venue_name,  # consumed by insert_program for slug
    }

    # Inherit portal_id from source if available
    source_info = None
    try:
        from db.sources import get_source_info
        source_info = get_source_info(event_record["source_id"])
    except Exception:
        pass
    if source_info and source_info.get("owner_portal_id"):
        program["portal_id"] = source_info["owner_portal_id"]

    return program


# ---------------------------------------------------------------------------
# Venue resolution
# ---------------------------------------------------------------------------


def _resolve_venue(
    location_str: str,
    tenant: TenantConfig,
    venue_id_cache: dict[str, int],
) -> tuple[int, str]:
    """
    Resolve a Rec1 location string to a (venue_id, venue_name) pair.

    Checks known_venues map first, falls back to default_venue.
    Caches venue IDs to avoid redundant DB calls.
    """
    location_key = location_str.strip().lower() if location_str else ""

    # Check cache first
    if location_key in venue_id_cache:
        venue_info = tenant.known_venues.get(location_key)
        if venue_info:
            return venue_id_cache[location_key], venue_info.name
        return venue_id_cache[location_key], tenant.default_venue.name

    # Try to match a known venue
    matched_venue: Optional[VenueInfo] = None
    for known_key, venue_info in tenant.known_venues.items():
        if known_key in location_key or location_key in known_key:
            matched_venue = venue_info
            break

    if matched_venue is None:
        matched_venue = tenant.default_venue

    venue_data = {
        "name": matched_venue.name,
        "slug": matched_venue.slug,
        "address": matched_venue.address,
        "neighborhood": matched_venue.neighborhood,
        "city": matched_venue.city,
        "state": matched_venue.state,
        "zip": matched_venue.zip_code,
        "lat": matched_venue.lat,
        "lng": matched_venue.lng,
        "venue_type": matched_venue.venue_type,
        "spot_type": matched_venue.venue_type,
    }

    vid = get_or_create_venue(venue_data)
    if tenant.venue_enrichment_builder:
        try:
            envelope = tenant.venue_enrichment_builder(matched_venue, vid)
            if envelope is not None:
                persist_typed_entity_envelope(envelope)
        except Exception as exc:
            logger.debug(
                "[rec1/%s] Venue enrichment failed for %s: %s",
                tenant.tenant_slug,
                matched_venue.slug,
                exc,
            )
    venue_id_cache[location_key] = vid
    return vid, matched_venue.name


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl_tenant(source: dict, tenant: TenantConfig) -> tuple[int, int, int]:
    """
    Crawl one Rec1 tenant (county) and persist events to the database.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    catalog_url = _get_catalog_url(tenant.tenant_slug)
    today = date.today()

    events_found = 0
    events_new = 0
    events_updated = 0

    # Step 1: get checkout key
    checkout_key = _get_checkout_key(tenant.tenant_slug)
    if not checkout_key:
        logger.error(
            "[rec1/%s] Could not get checkout key — aborting", tenant.tenant_slug
        )
        return 0, 0, 0

    time.sleep(_REQUEST_DELAY)

    # Step 2: get tabs
    tabs = _get_tabs(tenant.tenant_slug, checkout_key)
    if not tabs:
        logger.error("[rec1/%s] No catalog tabs found", tenant.tenant_slug)
        return 0, 0, 0

    logger.info("[rec1/%s] Found %d tabs", tenant.tenant_slug, len(tabs))

    # Filter tabs
    skip_ids = set(tenant.skip_tab_ids)
    if tenant.crawl_tab_ids:
        crawl_ids = set(tenant.crawl_tab_ids)
        tabs = [t for t in tabs if t["id"] in crawl_ids]
    else:
        tabs = [t for t in tabs if t["id"] not in skip_ids]

    logger.info("[rec1/%s] Crawling %d tabs", tenant.tenant_slug, len(tabs))

    # Venue cache to avoid redundant DB calls per location string
    venue_id_cache: dict[str, int] = {}

    # Pre-create the default venue
    default_vid = get_or_create_venue(
        {
            "name": tenant.default_venue.name,
            "slug": tenant.default_venue.slug,
            "address": tenant.default_venue.address,
            "neighborhood": tenant.default_venue.neighborhood,
            "city": tenant.default_venue.city,
            "state": tenant.default_venue.state,
            "zip": tenant.default_venue.zip_code,
            "lat": tenant.default_venue.lat,
            "lng": tenant.default_venue.lng,
            "venue_type": tenant.default_venue.venue_type,
            "spot_type": tenant.default_venue.venue_type,
        }
    )
    venue_id_cache[""] = default_vid
    venue_id_cache["multiple"] = default_vid
    venue_id_cache["tbd"] = default_vid

    for tab in tabs:
        tab_id = tab["id"]
        tab_label = tab.get("label", tab_id)
        logger.info(
            "[rec1/%s] Processing tab: %s (%s)", tenant.tenant_slug, tab_label, tab_id
        )

        time.sleep(_REQUEST_DELAY)
        groups = _get_groups_for_tab(tenant.tenant_slug, checkout_key, tab_id)

        for section_name, group in groups:
            group_id = group.get("id")
            group_name = group.get("name", "")
            group_type = group.get("type", "activity")
            group_desc = group.get("description", "") or ""
            group_image = group.get("thumbnail")
            group_item_count = int(group.get("itemCount", 0))

            # Skip groups with no items
            if group_item_count == 0:
                continue

            # Skip by keyword
            combined_lower = f"{group_name} {section_name}".lower()
            skip_kw = any(
                kw.lower() in combined_lower for kw in tenant.skip_group_keywords
            )
            if skip_kw:
                continue

            logger.debug(
                "[rec1/%s] Group [%s] %s — %d items",
                tenant.tenant_slug,
                group_id,
                group_name,
                group_item_count,
            )

            time.sleep(_REQUEST_DELAY)
            sessions = _get_sessions_for_group(
                tenant.tenant_slug, checkout_key, tab_id, group_id, group_type
            )

            for session in sessions:
                if _should_skip_session(session):
                    continue
                if _should_skip_session_keywords(session, tenant.skip_session_keywords):
                    continue

                # Determine venue from the location feature
                location_str = _extract_feature(session.get("features", []), "location")
                venue_id, venue_name = _resolve_venue(
                    location_str, tenant, venue_id_cache
                )

                record = _build_event_record(
                    session=session,
                    section_name=section_name,
                    group_name=group_name,
                    group_description=group_desc,
                    activity_image=group_image,
                    tenant=tenant,
                    venue_id=venue_id,
                    venue_name=venue_name,
                    source_id=source_id,
                    catalog_url=catalog_url,
                    today=today,
                )

                if record is None:
                    continue
                if tenant.require_family_relevance and not is_family_relevant_session(
                    section_name=section_name,
                    group_name=group_name,
                    session=session,
                    age_min=record.get("age_min"),
                    age_max=record.get("age_max"),
                    tags=record.get("tags", []),
                ):
                    continue

                events_found += 1

                existing = find_event_by_hash(record["content_hash"])
                if existing:
                    smart_update_existing_event(existing, record)
                    events_updated += 1
                else:
                    try:
                        insert_event(record)
                        events_new += 1
                        logger.debug(
                            "[rec1/%s] Added: %s on %s",
                            tenant.tenant_slug,
                            record["title"],
                            record["start_date"],
                        )
                    except Exception as exc:
                        logger.error(
                            "[rec1/%s] Failed to insert %r: %s",
                            tenant.tenant_slug,
                            record["title"],
                            exc,
                        )

                # Dual-write: also insert as a program if session qualifies
                reg_type = str(session.get("registrationType", "2"))
                program_record = _build_program_record(
                    event_record=record,
                    session=session,
                    section_name=section_name,
                    group_name=group_name,
                    venue_name=venue_name,
                    reg_type=reg_type,
                    tenant=tenant,
                )
                if program_record:
                    try:
                        insert_program(program_record)
                    except Exception as exc:
                        logger.debug(
                            "[rec1/%s] Program insert failed for %r: %s",
                            tenant.tenant_slug,
                            record["title"],
                            exc,
                        )

    logger.info(
        "[rec1/%s] Crawl complete: %d found, %d new, %d updated",
        tenant.tenant_slug,
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
