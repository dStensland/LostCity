"""
Crawler for Autrey Mill Nature Preserve & Heritage Farm (autreymill.org).

Autrey Mill is a 46-acre nature preserve and heritage farm in Johns Creek, GA,
run as a nonprofit. It's a primary Hooky family portal source: nature education
programs, summer camps, school-break camps, family special events, and adult
wellness programs.

Event publishing approach (as of 2026-03):
  - No Tribe Events Calendar or Modern Events Calendar plugin
  - Special events are individual WordPress pages under /special-events/
    with a structured "When / Where" block in the body HTML
  - Some events also appear as WP blog posts (same URL, different post type)
  - Summer camp sessions are embedded in /programs/summer-camp/ as inline text
    with Cogran registration links (dates in link text)
  - School break camps are on /programs/school-break-camps/ in a similar format
  - Recurring adult programs (yoga, hikes, bird walks, gardening) live on
    dedicated blog post pages under /ageless-adventures/ child pages; these
    have weekly schedule ranges we expand into individual session events

Crawl strategy:
  1. Fetch the special-events index page; follow child-page and blog-post links
     and parse "When / Where" blocks for date/time/description.
  2. Fetch summer camp page; parse camp sections for session dates (scraped from
     link text and section headings).
  3. Fetch school break camp page; parse daily session schedule.
  4. Fetch WP blog posts via REST API; filter to event-like posts using keyword
     heuristics and parse dates from body text.
  5. Skip past events; deduplicate via content hash.

No Playwright required — all pages render server-side.
Rate limit: 0.8s between page fetches.
Yield: ~25-60 future events per crawl depending on season.
"""

from __future__ import annotations

import html
import logging
import re
import time
from datetime import date, datetime
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from db import (
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

_BASE_URL = "https://autreymill.org"
_SPECIAL_EVENTS_URL = f"{_BASE_URL}/special-events/"
_SUMMER_CAMP_URL = f"{_BASE_URL}/programs/summer-camp/"
_BREAK_CAMP_URL = f"{_BASE_URL}/programs/school-break-camps/"
_AGELESS_URL = f"{_BASE_URL}/ageless-adventures/"
_WP_POSTS_API = f"{_BASE_URL}/wp-json/wp/v2/posts"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
_HEADERS = {"User-Agent": _USER_AGENT}
_REQUEST_DELAY = 0.8  # seconds between fetches

_VENUE_DATA = {
    "name": "Autrey Mill Nature Preserve & Heritage Farm",
    "slug": "autrey-mill-nature-preserve",
    "address": "9770 Autrey Mill Rd",
    "neighborhood": "Johns Creek",
    "city": "Johns Creek",
    "state": "GA",
    "zip": "30022",
    "lat": 34.0208,
    "lng": -84.2327,
    "venue_type": "park",
    "spot_type": "park",
    "website": _BASE_URL,
    "vibes": ["family-friendly", "outdoor", "all-ages", "educational", "historic"],
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    """Project Autrey Mill into shared Family-friendly destination richness lanes."""
    envelope = TypedEntityEnvelope()

    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "nature_preserve",
            "commitment_tier": "halfday",
            "primary_activity": "nature preserve and heritage farm visit",
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["outdoor", "indoor-option", "family-daytrip", "free-option"],
            "practical_notes": (
                "46-acre preserve with trails, animals, pollinator gardens, historic buildings, and a visitor center/farm museum. "
                "Trails are open daily and the preserve is free to visit, with donations appreciated."
            ),
            "accessibility_notes": (
                "Visitor center and farm museum provide an indoor option, while trails and outdoor heritage areas vary by terrain. "
                "Confirm current accessibility details with the preserve before visiting."
            ),
            "parking_type": "free_lot",
            "best_time_of_day": "morning",
            "family_suitability": "yes",
            "dog_friendly": False,
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Free to visit; donations appreciated. Group visits of 10+ should reserve ahead.",
            "source_url": _BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "acreage": 46,
                "trail_miles": 1.25,
                "trails_hours": "daily 8 AM to 9 PM",
                "visitor_center_hours": "Tuesday-Saturday 10 AM-4 PM; Sunday 12 PM-4 PM",
                "has_farm_museum": True,
                "has_animals": True,
                "has_pollinator_gardens": True,
            },
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "woodland-trails-and-ravines",
            "title": "Woodland trails and ravines",
            "feature_type": "amenity",
            "description": (
                "About 1.25 miles of trails through forest and ravine terrain make Autrey Mill a practical family nature-walk destination."
            ),
            "url": _BASE_URL,
            "is_free": True,
            "sort_order": 10,
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "visitor-center-and-farm-museum",
            "title": "Visitor Center and Farm Museum",
            "feature_type": "attraction",
            "description": (
                "Indoor visitor-center and farm-museum spaces add a weather-proof education layer to family visits."
            ),
            "url": _BASE_URL,
            "is_free": True,
            "sort_order": 20,
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "heritage-buildings-and-farm-history",
            "title": "Heritage buildings and farm history",
            "feature_type": "experience",
            "description": (
                "Historic buildings and heritage interpretation make the preserve more than a trail stop."
            ),
            "url": _BASE_URL,
            "is_free": True,
            "sort_order": 30,
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "animals-and-pollinator-gardens",
            "title": "Animals and pollinator gardens",
            "feature_type": "attraction",
            "description": (
                "Animals and pollinator gardens add kid-friendly discovery points beyond the event calendar."
            ),
            "url": _BASE_URL,
            "is_free": True,
            "sort_order": 40,
        },
    )

    return envelope

# Default tags applied to every Autrey Mill event
_DEFAULT_TAGS: list[str] = ["outdoor", "nature", "family-friendly", "educational"]

# ---------------------------------------------------------------------------
# Skip patterns — filter non-event pages
# ---------------------------------------------------------------------------

_SKIP_TITLE_SUBSTRINGS: tuple[str, ...] = (
    "audio tour",
    "audio",
    "podcast",
    "thank you",
    "supporters",
    "sponsors",
    "new registration system",
    "cancelled",
    "staff and board",
)

_SKIP_SLUG_SUBSTRINGS: tuple[str, ...] = (
    "-audio",
    "audio-",
    "podcast",
    "thank-you",
    "sponsor",
    "supporter",
)


def _should_skip_post(title: str, slug: str) -> bool:
    """Return True if this post is clearly not an event."""
    title_l = title.lower()
    slug_l = slug.lower()
    return any(p in title_l for p in _SKIP_TITLE_SUBSTRINGS) or any(
        p in slug_l for p in _SKIP_SLUG_SUBSTRINGS
    )


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
                    "[autrey-mill] GET %s failed after %d attempts: %s",
                    url,
                    retries,
                    exc,
                )
                return None
            time.sleep(1.5 * attempt)
    return None


def _get_json(
    session: requests.Session, url: str, params: Optional[dict] = None
) -> Optional[object]:
    """GET a URL with optional params and return parsed JSON, or None on failure."""
    for attempt in range(1, 4):
        try:
            resp = session.get(url, headers=_HEADERS, params=params, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            if attempt >= 3:
                logger.error("[autrey-mill] JSON GET %s failed: %s", url, exc)
                return None
            time.sleep(1.5 * attempt)
        except ValueError as exc:
            logger.error("[autrey-mill] JSON parse error at %s: %s", url, exc)
            return None
    return None


# ---------------------------------------------------------------------------
# HTML helpers
# ---------------------------------------------------------------------------

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")


def _strip_html(raw: str, max_len: int = 800) -> str:
    """Strip HTML tags and normalise whitespace."""
    if not raw:
        return ""
    text = html.unescape(raw)
    text = _HTML_TAG_RE.sub(" ", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    if len(text) > max_len:
        text = text[: max_len - 3].rstrip() + "..."
    return text


def _soup_text(soup_element) -> str:
    """Get plain text from a BS4 element."""
    if soup_element is None:
        return ""
    return soup_element.get_text(separator=" ", strip=True)


# ---------------------------------------------------------------------------
# Date / time parsing
# ---------------------------------------------------------------------------

_MONTHS = (
    "January|February|March|April|May|June|July|"
    "August|September|October|November|December"
)
_ORDINAL_DAY = r"\d{1,2}(?:st|nd|rd|th)?"
_WEEKDAY = r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)"

# "Saturday April 18, 2026" / "Sunday, March 29th, 2026" etc.
_SINGLE_DATE_RE = re.compile(
    rf"(?:{_WEEKDAY},?\s+)?({_MONTHS})\s+({_ORDINAL_DAY}),?\s+(\d{{4}})",
    re.IGNORECASE,
)

# "May 26th - 29th" / "June 29th-July 3rd" / "April 6" (month + day only)
_CAMP_RANGE_RE = re.compile(
    rf"({_MONTHS})\s+({_ORDINAL_DAY})\s*[-–]\s*(?:({_MONTHS})\s+)?({_ORDINAL_DAY})"
    r"(?:\s*\(\d+-Day\))?",
    re.IGNORECASE,
)
_CAMP_SINGLE_RE = re.compile(
    rf"({_MONTHS})\s+({_ORDINAL_DAY})(?!\s*[-–\d])",
    re.IGNORECASE,
)

# Time range: "10 AM – 2 PM" / "6:00 to 8:00 PM" / "2 PM-9 PM"
_TIME_RANGE_RE = re.compile(
    r"(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:[-–]|to)\s*(\d{1,2}(?::\d{2})?\s*[AP]M)",
    re.IGNORECASE,
)
_TIME_SINGLE_RE = re.compile(r"(\d{1,2}(?::\d{2})?\s*[AP]M)", re.IGNORECASE)


def _clean_ordinal(s: str) -> str:
    """Strip ordinal suffixes: '29th' → '29'."""
    return re.sub(r"(\d+)(?:st|nd|rd|th)", r"\1", s).strip()


def _parse_time_12h(t_str: str, fallback_ampm: Optional[str] = None) -> Optional[str]:
    """
    Convert "10 AM", "2:30 PM", "10" (with fallback_ampm="PM") to "HH:MM".
    Returns None if unparseable.
    """
    t = t_str.strip().upper().replace(" ", "")
    for fmt in ("%I:%M%p", "%I%p"):
        try:
            return datetime.strptime(t, fmt).strftime("%H:%M")
        except ValueError:
            continue
    if fallback_ampm:
        t_ref = (t + fallback_ampm.upper()).replace(" ", "")
        for fmt in ("%I:%M%p", "%I%p"):
            try:
                return datetime.strptime(t_ref, fmt).strftime("%H:%M")
            except ValueError:
                continue
    return None


def _parse_time_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extract (start_time, end_time) in HH:MM from a text block.

    Handles:
      "10 AM – 2 PM"   → ("10:00", "14:00")
      "6:00 to 8:00 PM" → ("18:00", "20:00")
      "2 PM-9 PM"       → ("14:00", "21:00")
    """
    m = _TIME_RANGE_RE.search(text)
    if not m:
        m2 = _TIME_SINGLE_RE.search(text)
        if m2:
            return _parse_time_12h(m2.group(1)), None
        return None, None

    start_raw = m.group(1)
    end_raw = m.group(2)

    # Extract the AM/PM suffix from the end time to use as fallback for start
    ampm_m = re.search(r"(AM|PM)\s*$", end_raw, re.IGNORECASE)
    fallback = ampm_m.group(1) if ampm_m else None

    start_time = _parse_time_12h(start_raw, fallback)
    end_time = _parse_time_12h(end_raw)
    return start_time, end_time


def _parse_single_date(text: str) -> Optional[date]:
    """
    Extract an event calendar date from text like "Saturday April 18, 2026".

    WP blog posts include a publish date at the top of the page (e.g.
    "January 20, 2025") before the actual event date. We iterate through
    ALL date matches and return the first one that is on or after today,
    ignoring past publish dates.

    Returns None if no future date is found.
    """
    today = date.today()
    for m in _SINGLE_DATE_RE.finditer(text):
        month, day, year = m.group(1), _clean_ordinal(m.group(2)), m.group(3)
        try:
            candidate = datetime.strptime(f"{month} {day} {year}", "%B %d %Y").date()
            if candidate >= today:
                return candidate
        except ValueError:
            continue
    return None


def _parse_camp_date_range(
    text: str, default_year: int
) -> tuple[Optional[date], Optional[date]]:
    """
    Parse a camp session date string into (start_date, end_date).

    Handles:
      "May 26th - 29th (4-Day) Tues-Fri"  → 2026-05-26 / 2026-05-29
      "June 29th-July 3rd"                 → 2026-06-29 / 2026-07-03
      "June 1st -5th"                      → 2026-06-01 / 2026-06-05
    """
    m = _CAMP_RANGE_RE.search(text)
    if m:
        start_month = m.group(1)
        start_day = _clean_ordinal(m.group(2))
        end_month = m.group(3) or start_month
        end_day = _clean_ordinal(m.group(4))
        try:
            start = datetime.strptime(
                f"{start_month} {start_day} {default_year}", "%B %d %Y"
            ).date()
            end = datetime.strptime(
                f"{end_month} {end_day} {default_year}", "%B %d %Y"
            ).date()
            # Sanity check: end should be >= start (handle cross-month edge)
            if end < start:
                end = start
            return start, end
        except ValueError:
            return None, None

    # Single day (e.g. "April 6")
    m2 = _CAMP_SINGLE_RE.search(text)
    if m2:
        month = m2.group(1)
        day = _clean_ordinal(m2.group(2))
        try:
            dt = datetime.strptime(f"{month} {day} {default_year}", "%B %d %Y").date()
            return dt, dt
        except ValueError:
            return None, None

    return None, None


def _infer_year_for_date(month_str: str, day_int: int) -> int:
    """
    Guess the year for a month/day that has no explicit year.
    If the month/day is in the past for current year, use next year.
    """
    today = date.today()
    for year in (today.year, today.year + 1):
        try:
            candidate = datetime.strptime(
                f"{month_str} {day_int} {year}", "%B %d %Y"
            ).date()
            if candidate >= today:
                return year
        except ValueError:
            pass
    return today.year + 1


# ---------------------------------------------------------------------------
# Age inference
# ---------------------------------------------------------------------------

_AGE_BAND_RULES: list[tuple[int, int, str]] = [
    (0, 1, "infant"),
    (1, 3, "toddler"),
    (3, 5, "preschool"),
    (5, 12, "elementary"),
    (10, 13, "tween"),
    (13, 18, "teen"),
]

_AGE_RANGE_PATTERNS: list[tuple[re.Pattern, str]] = [
    # "Ages 5-7", "ages 8–11", "ages 5 to 11"
    (re.compile(r"ages?\s+(\d+)\s*[-–to]+\s*(\d+)", re.IGNORECASE), "range"),
    # "ages 12 and up", "ages 12+"
    (
        re.compile(
            r"ages?\s+(\d+)\s*(?:\+|and\s+(?:up|older)|or\s+older)", re.IGNORECASE
        ),
        "min",
    ),
    # "for kids (5-10)"
    (
        re.compile(
            r"(?:for\s+)?(?:children|kids?|youth)\s*\(?(\d+)\s*[-–]\s*(\d+)\)?",
            re.IGNORECASE,
        ),
        "range",
    ),
    # "(ages 4-5)"
    (re.compile(r"\(\s*ages?\s+(\d+)\s*[-–]\s*(\d+)\s*\)", re.IGNORECASE), "range"),
]


def _parse_age_range(text: str) -> tuple[Optional[int], Optional[int]]:
    """Extract age_min / age_max from title or description text."""
    if not text:
        return None, None
    for pattern, kind in _AGE_RANGE_PATTERNS:
        m = pattern.search(text)
        if m:
            if kind == "range":
                return int(m.group(1)), int(m.group(2))
            elif kind == "min":
                return int(m.group(1)), None
    # Keyword fallback
    t = text.lower()
    if re.search(r"\b(infant|baby|babies)\b", t):
        return 0, 1
    if re.search(r"\btoddler\b", t):
        return 1, 3
    if re.search(r"\b(preschool|pre.?k)\b", t):
        return 3, 5
    return None, None


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    """Return age-band tags overlapping with [age_min, age_max]."""
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 100
    return [tag for (lo_b, hi_b, tag) in _AGE_BAND_RULES if lo <= hi_b and hi >= lo_b]


# ---------------------------------------------------------------------------
# Category / tag inference
# ---------------------------------------------------------------------------

_KEYWORD_CATEGORY_MAP: list[tuple[str, str]] = [
    (
        r"\b(summer camp|camp adventurer|camp explorer|camp imagination|break camp)\b",
        "programs",
    ),
    (r"\b(hike|hiking|trail walk|forest ecology)\b", "outdoors"),
    (r"\b(bird|birding walk|bird walk)\b", "outdoors"),
    (r"\b(yoga|gentle yoga)\b", "wellness"),
    (r"\b(garden|gardening)\b", "community"),
    (r"\b(5k|fun run|race)\b", "fitness"),
    (r"\b(concert|live music|live band)\b", "music"),
    (r"\b(cleanup|clean.up|creek crawl)\b", "community"),
    (r"\b(volunteer)\b", "community"),
    (r"\b(homeschool|preschool)\b", "learning"),
    (r"\b(girl scouts?|boy scouts?|scouts?)\b", "learning"),
    (r"\b(workshop|class|lecture)\b", "learning"),
    (r"\b(fair|festival|gala|celebration)\b", "community"),
    (r"\b(kids?|children|family|toddler)\b", "family"),
]

_KEYWORD_TAG_MAP: list[tuple[str, list[str]]] = [
    (r"\b(camp|summer camp)\b", ["kids", "class"]),
    (r"\b(hike|hiking|trail)\b", ["hiking", "outdoor"]),
    (r"\b(bird|birding)\b", ["outdoor", "educational"]),
    (r"\b(garden|gardening)\b", ["outdoor", "volunteer"]),
    (r"\b(yoga)\b", ["yoga"]),
    (r"\b(cleanup|clean.up)\b", ["volunteer", "volunteer-outdoors", "outdoor"]),
    (r"\b(scout|merit badge)\b", ["kids", "educational"]),
    (r"\b(homeschool)\b", ["educational", "kids"]),
    (r"\b(preschool|pre.?k)\b", ["preschool", "kids"]),
    (r"\b(family)\b", ["family-friendly"]),
    (r"\b(free|no cost|no charge)\b", []),  # handled via price
    (r"\b(gala|adults? only)\b", ["adults"]),
    (r"\b(festival|fair)\b", ["seasonal"]),
    (r"\b(historic|heritage|history)\b", ["educational"]),
    (r"\b(wildlife|animal|nature)\b", ["educational", "outdoor"]),
]


def _infer_category_and_tags(
    title: str,
    description: str,
    age_min: Optional[int],
    age_max: Optional[int],
    extra_tags: Optional[list[str]] = None,
) -> tuple[str, list[str]]:
    """Return (category, tags) for an Autrey Mill event."""
    category = "family"  # sensible default for a nature preserve
    tags: list[str] = list(_DEFAULT_TAGS)
    if extra_tags:
        for t in extra_tags:
            if t not in tags:
                tags.append(t)

    combined = f"{title} {description}".lower()

    for pattern, cat in _KEYWORD_CATEGORY_MAP:
        if re.search(pattern, combined, re.IGNORECASE):
            category = cat
            break

    for pattern, extra in _KEYWORD_TAG_MAP:
        if re.search(pattern, combined, re.IGNORECASE):
            for t in extra:
                if t not in tags:
                    tags.append(t)

    # Age-band tags
    for t in _age_band_tags(age_min, age_max):
        if t not in tags:
            tags.append(t)

    if age_max is not None and age_max <= 17 and "kids" not in tags:
        tags.append("kids")
    if age_min is not None and age_min >= 18 and "adults" not in tags:
        tags.append("adults")

    return category, tags


# ---------------------------------------------------------------------------
# Price extraction
# ---------------------------------------------------------------------------

_PRICE_RANGE_RE = re.compile(
    r"\$\s*([\d,]+(?:\.\d{1,2})?)\s*(?:[-–]|per\s+person\s+or)\s*\$?\s*([\d,]+(?:\.\d{1,2})?)"
)
_PRICE_SINGLE_RE = re.compile(r"\$\s*([\d,]+(?:\.\d{1,2})?)")
_FREE_RE = re.compile(
    r"(free(?:\s+admission|!|\b)|no\s+cost|no\s+charge|complimentary|included\s+with)",
    re.IGNORECASE,
)


def _parse_price(text: str) -> tuple[Optional[float], Optional[float], bool]:
    """Extract (price_min, price_max, is_free) from description text."""
    if not text:
        return None, None, False

    if _FREE_RE.search(text):
        return 0.0, 0.0, True

    m = _PRICE_RANGE_RE.search(text)
    if m:
        a = float(m.group(1).replace(",", ""))
        b = float(m.group(2).replace(",", ""))
        lo, hi = min(a, b), max(a, b)
        return lo, hi, hi == 0.0

    m = _PRICE_SINGLE_RE.search(text)
    if m:
        val = float(m.group(1).replace(",", ""))
        return val, val, val == 0.0

    return None, None, False


# ---------------------------------------------------------------------------
# Series hint detection
# ---------------------------------------------------------------------------

_SERIES_CLASS_RE: list[re.Pattern] = [
    re.compile(r"\bcamp\b", re.IGNORECASE),
    re.compile(r"\bclass\b", re.IGNORECASE),
    re.compile(r"\bworkshop\b", re.IGNORECASE),
    re.compile(r"\bseries\b", re.IGNORECASE),
    re.compile(r"\byoga\b", re.IGNORECASE),
    re.compile(r"\bhike\b", re.IGNORECASE),
    re.compile(r"\bbird walk\b", re.IGNORECASE),
    re.compile(r"\bbird walks\b", re.IGNORECASE),
    re.compile(r"\bgarden\w*\b", re.IGNORECASE),
    re.compile(r"\bsocial\b", re.IGNORECASE),
]


def _build_series_hint(title: str) -> Optional[dict]:
    """Return a series_hint if this event is a known recurring pattern."""
    for pattern in _SERIES_CLASS_RE:
        if pattern.search(title):
            return {
                "series_type": "class_series",
                "series_title": title,
                "frequency": "irregular",
            }
    return None


# ---------------------------------------------------------------------------
# Event record builder
# ---------------------------------------------------------------------------


def _build_record(
    source_id: int,
    venue_id: int,
    venue_name: str,
    title: str,
    description: str,
    start_date: date,
    end_date: Optional[date],
    start_time: Optional[str],
    end_time: Optional[str],
    source_url: str,
    image_url: Optional[str] = None,
    ticket_url: Optional[str] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    is_free: bool = False,
    extra_tags: Optional[list[str]] = None,
) -> tuple[dict, Optional[dict]]:
    """Build a LostCity event record and optional series hint."""
    combined_text = f"{title} {description}"
    age_min, age_max = _parse_age_range(combined_text)

    category, tags = _infer_category_and_tags(
        title, description, age_min, age_max, extra_tags
    )

    series_hint = _build_series_hint(title)

    # Only store end_date when it differs from start_date
    end_date_out = end_date.isoformat() if end_date and end_date != start_date else None

    hash_key = start_date.isoformat()
    if start_time:
        hash_key = f"{start_date.isoformat()}|{start_time}"
    content_hash = generate_content_hash(title, venue_name, hash_key)

    record: dict = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description if description else None,
        "start_date": start_date.isoformat(),
        "end_date": end_date_out,
        "start_time": start_time,
        "end_time": end_time,
        "is_all_day": start_time is None and end_date_out is not None,
        "category": category,
        "tags": tags,
        "is_free": is_free,
        "price_min": price_min,
        "price_max": price_max,
        "price_note": None,
        "source_url": source_url,
        "ticket_url": ticket_url or source_url,
        "image_url": image_url,
        "raw_text": title,
        "extraction_confidence": 0.85,
        "is_recurring": series_hint is not None,
        "content_hash": content_hash,
    }
    if age_min is not None:
        record["age_min"] = age_min
    if age_max is not None:
        record["age_max"] = age_max

    return record, series_hint


# ---------------------------------------------------------------------------
# Special events page parser
# ---------------------------------------------------------------------------

# Known event page slugs on the special-events index and as blog posts
_KNOWN_EVENT_SLUGS: frozenset[str] = frozenset(
    {
        "earthday",
        "earth-day-celebration",
        "girl-scouts-day",
        "creekcrawl",
        "creek-clean-up-crawl",
        "spooky-mill",
        "ghosts-goblins-gala",
        "historic-home-open-house",
        "behind-the-music-live",
        "paint-and-sip",
        "shakespeare-in-the-park",
        "garden-days",
        "great-southeast-pollinator-census",
        "sustainable-living-workshops",
    }
)


def _parse_event_page(
    html_text: str,
    page_url: str,
) -> Optional[dict]:
    """
    Parse a single Autrey Mill event page (special event or blog post).

    Looks for:
      - "When" / "Where" structured blocks in the main content
      - Single date: "Saturday, April 18, 2026"
      - Time range: "10 AM – 2 PM"
      - Description: paragraphs before the "When" block

    Returns a partial event dict or None if no date is found.
    """
    soup = BeautifulSoup(html_text, "html.parser")

    # -- Title ----------------------------------------------------------------
    # Priority: h2.blog-title (blog post heading), then <title> tag,
    # then og:title. The h1 on this site is the site logo ("Autrey Mill").
    title_raw = ""
    blog_h2 = soup.find("h2", class_="blog-title")
    if blog_h2:
        title_raw = _soup_text(blog_h2)
    if not title_raw:
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            # Strip " – Autrey Mill" site suffix
            title_raw = re.sub(
                r"\s*[-–]\s*Autrey Mill\s*$",
                "",
                title_tag.string,
                flags=re.IGNORECASE,
            ).strip()
    if not title_raw:
        og_title = soup.find("meta", property="og:title")
        if og_title:
            title_raw = og_title.get("content", "")
    title = html.unescape(title_raw).strip()
    if not title:
        return None

    # -- Main content ---------------------------------------------------------
    main = (
        soup.find("main")
        or soup.find("div", class_="entry-content")
        or soup.find("article")
    )
    if not main:
        return None

    full_text = main.get_text(separator="\n", strip=True)

    # -- Date -----------------------------------------------------------------
    start_date = _parse_single_date(full_text)
    if not start_date:
        return None

    # Skip past events
    if start_date < date.today():
        return None

    # -- Time -----------------------------------------------------------------
    # Scan the full text for a time range (the regex is robust enough).
    # WP blog posts on this site have "When\nSaturday ...\n10 AM – 2 PM"
    # somewhere in the body — just search the whole thing.
    start_time, end_time = _parse_time_range(full_text)

    # -- Description ----------------------------------------------------------
    # Pull the first descriptive paragraphs (before "When:" if present)
    paras: list[str] = []
    for p in main.find_all("p"):
        t = p.get_text(strip=True)
        if not t:
            continue
        if re.search(r"^(when|where|categories?)[:\s]", t, re.IGNORECASE):
            break
        if len(t) > 40:  # skip short nav/label fragments
            paras.append(t)
        if len(paras) >= 3:
            break
    description = _strip_html(" ".join(paras), max_len=800)

    # -- Image ----------------------------------------------------------------
    image_url: Optional[str] = None
    og_image = soup.find("meta", property="og:image")
    if og_image:
        image_url = og_image.get("content")

    # -- Price ----------------------------------------------------------------
    # Only parse price from lines that have ticket/cost/admission context.
    # This avoids picking up sponsorship amounts ("$100+ Sponsor ...") which
    # appear in event pages but are not admission prices.
    price_lines: list[str] = []
    for line in full_text.splitlines():
        line_l = line.lower()
        if (
            any(
                kw in line_l
                for kw in [
                    "cost:",
                    "tickets",
                    "ticket:",
                    "admission",
                    "per person",
                    "per scout",
                    "members",
                    "$",
                ]
            )
            and "sponsor" not in line_l
        ):
            price_lines.append(line)
    price_context = " ".join(price_lines)
    # Only call _parse_price when we have admission-specific context.
    # If no admission-related lines were found, don't parse price from
    # the full text (risks picking up sponsorship/donation amounts).
    price_min, price_max, is_free = (
        _parse_price(price_context) if price_context else (None, None, False)
    )
    # Still detect "free" from the broader text even without dollar amounts
    if not is_free and _FREE_RE.search(full_text):
        price_min, price_max, is_free = 0.0, 0.0, True

    # -- Ticket / registration URL -------------------------------------------
    ticket_url: Optional[str] = None
    for a in main.find_all("a", href=True):
        href = a["href"]
        if any(
            d in href
            for d in ["cogran.com", "givebutter.com", "eventbrite.com", "register"]
        ):
            ticket_url = href
            break

    return {
        "title": title,
        "start_date": start_date,
        "end_date": None,
        "start_time": start_time,
        "end_time": end_time,
        "description": description,
        "image_url": image_url,
        "price_min": price_min,
        "price_max": price_max,
        "is_free": is_free,
        "source_url": page_url,
        "ticket_url": ticket_url,
    }


def _collect_special_event_urls(
    session: requests.Session,
) -> list[str]:
    """
    Fetch the special events index and extract child page / linked event URLs.
    Returns a deduplicated list of absolute event page URLs.
    """
    html_text = _get_text(session, _SPECIAL_EVENTS_URL)
    if not html_text:
        logger.warning("[autrey-mill] Could not fetch special events index")
        return []

    soup = BeautifulSoup(html_text, "html.parser")
    urls: list[str] = []
    seen: set[str] = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Must be an autreymill.org internal link, not nav/utility
        if "autreymill.org" not in href and not href.startswith("/"):
            continue
        abs_url = urljoin(_BASE_URL, href)
        parsed = urlparse(abs_url)
        # Exclude nav links, anchors, admin, mailto, etc.
        if not parsed.path or parsed.path in ("/", "/special-events/"):
            continue
        if parsed.scheme not in ("http", "https"):
            continue
        if any(
            seg in parsed.path
            for seg in [
                "/about/",
                "/programs/",
                "/plan-your-event/",
                "/get-involved/",
                "/donate/",
                "/news/",
                "/contact",
            ]
        ):
            continue
        # Only collect event-like pages
        slug = parsed.path.strip("/").split("/")[-1]
        if slug and abs_url not in seen:
            seen.add(abs_url)
            urls.append(abs_url)

    return urls


# ---------------------------------------------------------------------------
# Summer camp session parser
# ---------------------------------------------------------------------------

# Camp section headings (tier names with age ranges embedded)
_CAMP_TIER_RE = re.compile(
    r"^(Camp\s+\w[\w\s]+?):\s*(Ages?\s+[\d\-–]+(?:–\d+)?|\d+\s*&\s*\d+|Ages?\s+\d+\s*\+?)",
    re.IGNORECASE,
)

# Camp theme names in headings
_CAMP_THEME_NAME_RE = re.compile(
    r"^((?:Mad Science|Wildlife Wonders|Water Fun|Ocean Explorers|Field Frenzy|"
    r"Myths? and Mysteries|Worlds? of Water|Buzzing About|Spring Field Frenzy|"
    r"Reading the Forest|[\w\s]+)\s+Camp)$",
    re.IGNORECASE,
)


def _parse_summer_camp_sessions(
    html_text: str,
    source_url: str,
) -> list[dict]:
    """
    Parse /programs/summer-camp/ and extract individual camp sessions.

    The page layout is:
      H3/H2: "Camp Adventurer: Ages 5-7"
        P: camp theme description
        A (with text like "May 26th - 29th (4-Day) Tues-Fri"): Cogran link
        A: "June 1st -5th": Cogran link
        ...
      H3/H2: "Camp Explorer: Ages 8-11"
        ...

    For each tier, collect (theme_name, description) from paragraphs,
    then pair with the session dates from adjacent links.
    """
    soup = BeautifulSoup(html_text, "html.parser")
    events: list[dict] = []
    today = date.today()
    default_year = today.year if today.month <= 8 else today.year + 1

    # Walk the main content sequentially
    main = soup.find("main") or soup.find("div", class_="entry-content")
    if not main:
        return events

    def _flush_theme_dates(
        tier: str, theme: str, desc: str, dates: list[tuple[date, date, str]]
    ) -> None:
        for start, end, reg_url in dates:
            if start < today:
                continue
            title = f"{theme} — {tier}" if theme else tier
            events.append(
                {
                    "title": title,
                    "description": desc,
                    "start_date": start,
                    "end_date": end if end != start else None,
                    "start_time": "09:00",
                    "end_time": "15:00",
                    "source_url": source_url,
                    "ticket_url": reg_url,
                    "image_url": None,
                    "price_min": None,
                    "price_max": None,
                    "is_free": False,
                    "extra_tags": ["class", "kids"],
                }
            )

    current_dates: list[tuple[date, date, str]] = []
    last_tier: Optional[str] = None
    last_theme: Optional[str] = None
    last_desc: str = ""

    for elem in main.descendants:
        if not hasattr(elem, "name") or elem.name is None:
            continue

        tag = elem.name.lower()
        text = elem.get_text(strip=True)

        if not text:
            continue

        # Tier headings: "Camp Adventurer: Ages 5-7"
        if tag in ("h1", "h2", "h3", "h4"):
            # Flush previous theme
            if last_tier and last_theme and current_dates:
                _flush_theme_dates(last_tier, last_theme, last_desc, current_dates)
                current_dates = []
                last_theme = None
                last_desc = ""

            m = _CAMP_TIER_RE.match(text)
            if m:
                last_tier = m.group(1).strip()
            continue

        # Camp theme names (often in <strong> or <b> or short <p>)
        if tag in ("strong", "b") or (tag == "p" and len(text) < 80):
            # Check if it looks like a theme heading
            theme_candidates = [
                "Mad Science Camp",
                "Wildlife Wonders Camp",
                "Water Fun and Learning Camp",
                "Ocean Explorers Camp",
                "Field Frenzy",
                "Camp Jr. Counselor",
                "Camp Imagination",
            ]
            matched_theme = next(
                (tc for tc in theme_candidates if tc.lower() in text.lower()), None
            )
            if matched_theme:
                # Flush previous theme's dates
                if last_tier and last_theme and current_dates:
                    _flush_theme_dates(last_tier, last_theme, last_desc, current_dates)
                    current_dates = []
                    last_desc = ""
                # Use the canonical theme name, not the hype intro text
                last_theme = matched_theme
                continue

        # Description paragraphs between theme name and dates
        if tag == "p" and len(text) > 80:
            if last_theme and not current_dates:
                # Still accumulating description
                last_desc = _strip_html(text, max_len=400)

        # Links with date text (Cogran registration links)
        if tag == "a":
            href = elem.get("href", "")
            if "cogran.com" in href:
                link_text = text
                start, end = _parse_camp_date_range(link_text, default_year)
                if start and start >= today:
                    current_dates.append((start, end or start, href))

    # Flush the last theme
    if last_tier and last_theme and current_dates:
        _flush_theme_dates(last_tier, last_theme, last_desc, current_dates)

    return events


# ---------------------------------------------------------------------------
# School break camp parser
# ---------------------------------------------------------------------------


def _parse_break_camp_sessions(
    html_text: str,
    source_url: str,
) -> list[dict]:
    """
    Parse /programs/school-break-camps/ and extract daily sessions.

    The page has blocks like:
      "Spring Break Camp | Ages 5-11"
      "April 6 Wildlife Wonders"
      "April 7 Myths and Mysteries"
      ...

    Returns one event per day.
    """
    soup = BeautifulSoup(html_text, "html.parser")
    events: list[dict] = []
    today = date.today()

    main = soup.find("main") or soup.find("div", class_="entry-content")
    if not main:
        return events

    full_text = main.get_text(separator="\n", strip=True)

    # Detect block header lines like "Spring Break Camp| Ages 5-11"
    # Then look for lines like "April 6 Wildlife Wonders"
    block_header_re = re.compile(
        r"(Spring|Fall|Winter|Summer|Thanksgiving)\s+Break\s+Camp.*?Ages?\s*(\d+)-(\d+)",
        re.IGNORECASE,
    )
    daily_entry_re = re.compile(
        rf"({_MONTHS})\s+(\d+)\s+(.+?)$",
        re.IGNORECASE,
    )

    current_age_min: Optional[int] = None
    current_age_max: Optional[int] = None
    current_break_name: str = "School Break Camp"

    for line in full_text.splitlines():
        line = line.strip()
        if not line:
            continue

        bm = block_header_re.search(line)
        if bm:
            current_break_name = f"{bm.group(1)} Break Camp"
            current_age_min = int(bm.group(2))
            current_age_max = int(bm.group(3))
            continue

        dm = daily_entry_re.match(line)
        if dm:
            month = dm.group(1)
            day = int(dm.group(2))
            theme = dm.group(3).strip()
            # Skip lines that look like noise
            if len(theme) < 3 or re.match(r"^\d", theme):
                continue
            year = _infer_year_for_date(month, day)
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y").date()
            except ValueError:
                continue
            if dt < today:
                continue

            title = f"{current_break_name}: {theme}"
            events.append(
                {
                    "title": title,
                    "description": (
                        f"Daily themed program at Autrey Mill Nature Preserve. "
                        f"Theme: {theme}. Ages {current_age_min}–{current_age_max}."
                    ),
                    "start_date": dt,
                    "end_date": None,
                    "start_time": "09:00",
                    "end_time": "15:00",
                    "source_url": source_url,
                    "ticket_url": None,
                    "image_url": None,
                    "price_min": None,
                    "price_max": None,
                    "is_free": False,
                    "extra_tags": ["class", "kids"],
                }
            )

    # Also try to find a registration link
    reg_url: Optional[str] = None
    for a in soup.find_all("a", href=True):
        if "cogran.com" in a["href"] or "register" in a["href"].lower():
            reg_url = a["href"]
            break

    if reg_url:
        for ev in events:
            if not ev.get("ticket_url"):
                ev["ticket_url"] = reg_url

    return events


# ---------------------------------------------------------------------------
# Recurring programs parser (Ageless Adventures, yoga, hikes, etc.)
# ---------------------------------------------------------------------------

# Recurring program entries on the ageless-adventures page
_RECURRING_PROG_RE = re.compile(
    r"When:\s*\n?"
    r"(?P<days>[A-Za-z']+s?)\s*\n?"
    r"(?P<time>\d{1,2}(?::\d{2})?\s*[AP]M\s*[-–]\s*\d{1,2}(?::\d{2})?\s*[AP]M)\s*\n?"
    r"(?P<start_month>January|February|March|April|May|June|July|August|September|October|November|December)\s+"
    r"(?P<start_day>\d{1,2}(?:st|nd|rd|th)?)\s*[-–]\s*"
    r"(?:(?P<end_month>January|February|March|April|May|June|July|August|September|October|November|December)\s+)?"
    r"(?P<end_day>\d{1,2}(?:st|nd|rd|th)?)",
    re.IGNORECASE | re.DOTALL,
)


def _parse_recurring_programs(
    session: requests.Session,
) -> list[dict]:
    """
    Parse /ageless-adventures/ and its linked blog posts to extract
    recurring programs (yoga, hikes, bird walks, gardening, Saturday socials).

    For date-range programs ("January 9th – May 15th"), we generate one
    representative event (the next upcoming occurrence) rather than
    expanding all weeks — the source is a recurring series, not individual
    events.
    """
    html_text = _get_text(session, _AGELESS_URL)
    if not html_text:
        logger.warning("[autrey-mill] Could not fetch Ageless Adventures page")
        return []

    soup = BeautifulSoup(html_text, "html.parser")
    events: list[dict] = []
    today = date.today()

    # Parse structured program blocks from the page text
    full_text = soup.get_text(separator="\n", strip=True)

    # Extract program sections by looking for "When:" markers
    # Each block looks like:
    #   [Program name]
    #   When:
    #   Wednesday's
    #   11 AM - 12 PM
    #   January 7th - May 14th
    #   ::No Class April 9th::

    # Find headings/labels in the soup (likely <strong> or paragraph before each When block)
    # Use a simpler extraction: find "When:" in text, then look backwards for the title
    prog_blocks: list[tuple[str, str]] = []  # (title, block_text)

    lines = full_text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line.lower().startswith("when:"):
            # Grab up to 8 lines after "When:" for the schedule text
            block_lines = [line]
            for j in range(1, 9):
                if i + j < len(lines):
                    block_lines.append(lines[i + j].strip())
            block = "\n".join(block_lines)

            # Look backwards for the title (non-empty line before "When:").
            # The title is a SHORT line (< 60 chars) — description paragraphs
            # are long. "Click to Register" and "Registration not required"
            # are filtered by length + keyword patterns.
            title = ""
            for k in range(i - 1, max(i - 10, -1), -1):
                candidate = lines[k].strip()
                if not candidate or candidate.startswith("::"):
                    continue
                # Skip known non-title lines
                if re.search(
                    r"(registration\s+(not\s+required|is\s+encouraged)|register|click\s+to|"
                    r"brought\s+to\s+you|autrey\s+mill|where:|what\s+to)",
                    candidate,
                    re.IGNORECASE,
                ):
                    continue
                # Skip long lines (description paragraphs > 80 chars)
                if len(candidate) > 80:
                    continue
                # Skip address-like lines
                if re.search(r"\d{4,}|\b(GA|St|Rd|Ave|Dr|Blvd)\b", candidate):
                    continue
                if len(candidate) >= 4:
                    title = candidate
                    break
            if title:
                prog_blocks.append((title, block))
        i += 1

    # Now parse each block
    for title, block in prog_blocks:
        # Time
        start_time, end_time = _parse_time_range(block)

        # Date range: "January 7th - May 14th"
        dm = _CAMP_RANGE_RE.search(block)
        if not dm:
            dm = re.search(
                rf"({_MONTHS})\s+({_ORDINAL_DAY})\s*[-–]\s*(?:({_MONTHS})\s+)?({_ORDINAL_DAY})",
                block,
                re.IGNORECASE,
            )
        if not dm:
            continue

        start_month = dm.group(1)
        start_day_raw = _clean_ordinal(dm.group(2))
        end_month = dm.group(3) or start_month
        end_day_raw = _clean_ordinal(dm.group(4))

        year = _infer_year_for_date(start_month, int(start_day_raw))
        try:
            prog_start = datetime.strptime(
                f"{start_month} {start_day_raw} {year}", "%B %d %Y"
            ).date()
            prog_end = datetime.strptime(
                f"{end_month} {end_day_raw} {year}", "%B %d %Y"
            ).date()
        except ValueError:
            continue

        if prog_end < today:
            continue

        # Create one "representative" event at the series level
        # Use the next upcoming Monday/Friday/etc. within range, or start of range
        event_date = max(prog_start, today)
        if event_date > prog_end:
            continue

        # Check for free
        _, _, is_free = _parse_price(block)
        if "free" in block.lower():
            is_free = True

        desc = (
            f"Recurring program at Autrey Mill Nature Preserve. "
            f"Runs {prog_start.strftime('%B %d')} – {prog_end.strftime('%B %d, %Y')}."
        )

        events.append(
            {
                "title": title,
                "description": desc,
                "start_date": event_date,
                "end_date": None,
                "start_time": start_time,
                "end_time": end_time,
                "source_url": _AGELESS_URL,
                "ticket_url": None,
                "image_url": None,
                "price_min": 0.0 if is_free else None,
                "price_max": 0.0 if is_free else None,
                "is_free": is_free,
                "extra_tags": [],
            }
        )

    return events


# ---------------------------------------------------------------------------
# WP blog post event harvester
# ---------------------------------------------------------------------------

_EVENT_POST_KEYWORDS: tuple[str, ...] = (
    "when:",
    "join us",
    "register",
    "10 am",
    "11 am",
    "2 pm",
    "9 am",
    "2026",
    "2025",
)


def _harvest_blog_post_events(
    session: requests.Session,
) -> list[dict]:
    """
    Fetch WP blog posts and return event-like posts that have future dates.

    This catches special events that are published as blog posts rather than
    as pages under /special-events/.
    """
    posts = _get_json(
        session,
        _WP_POSTS_API,
        params={
            "per_page": 50,
            "_fields": "id,slug,title,link,content,date",
        },
    )
    if not posts or not isinstance(posts, list):
        return []

    events: list[dict] = []

    for post in posts:
        slug = post.get("slug", "")
        title_rendered = html.unescape(
            post.get("title", {}).get("rendered", "")
        ).strip()
        page_url = post.get("link", "")
        content_raw = post.get("content", {}).get("rendered", "")

        if not title_rendered or _should_skip_post(title_rendered, slug):
            continue

        # Filter: only process posts that look like events
        content_text = _strip_html(content_raw, max_len=3000).lower()
        if not any(kw in content_text for kw in _EVENT_POST_KEYWORDS):
            continue

        time.sleep(0.3)

        # Fetch the full page to parse properly
        html_text = _get_text(session, page_url)
        if not html_text:
            continue

        event_data = _parse_event_page(html_text, page_url)
        if event_data:
            events.append(event_data)

    return events


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Autrey Mill Nature Preserve events.

    Coverage:
      - Special events (Earth Day, Girl Scouts Day, Creek Crawl, Spooky Mill, etc.)
      - Summer camp sessions (multiple tiers, all weeks)
      - School break camp daily sessions
      - Recurring adult programs (yoga, hikes, bird walks, gardening)
      - Event-like blog posts

    Returns (events_found, events_new, events_updated).
    """
    source_id: int = source["id"]
    today = date.today()
    events_found = 0
    events_new = 0
    events_updated = 0

    # Ensure venue exists
    try:
        venue_id = get_or_create_place(_VENUE_DATA)
        persist_result = persist_typed_entity_envelope(
            _build_destination_envelope(venue_id)
        )
        if persist_result.skipped:
            logger.warning(
                "[autrey-mill] skipped typed destination writes: %s",
                persist_result.skipped,
            )
    except Exception as exc:
        logger.error("[autrey-mill] Failed to create/find venue: %s", exc)
        return 0, 0, 0

    venue_name = _VENUE_DATA["name"]
    session = requests.Session()

    all_raw_events: list[dict] = []

    # ---- 1. Special events pages -------------------------------------------
    logger.info("[autrey-mill] Collecting special event pages")
    event_urls = _collect_special_event_urls(session)
    logger.info("[autrey-mill] Found %d special event URLs", len(event_urls))

    for url in event_urls:
        time.sleep(_REQUEST_DELAY)
        html_text = _get_text(session, url)
        if not html_text:
            continue
        event_data = _parse_event_page(html_text, url)
        if event_data:
            all_raw_events.append(event_data)

    # ---- 2. Summer camp sessions -------------------------------------------
    logger.info("[autrey-mill] Parsing summer camp sessions")
    time.sleep(_REQUEST_DELAY)
    camp_html = _get_text(session, _SUMMER_CAMP_URL)
    if camp_html:
        camp_events = _parse_summer_camp_sessions(camp_html, _SUMMER_CAMP_URL)
        logger.info("[autrey-mill] Found %d summer camp sessions", len(camp_events))
        all_raw_events.extend(camp_events)

    # ---- 3. School break camp sessions -------------------------------------
    logger.info("[autrey-mill] Parsing school break camp sessions")
    time.sleep(_REQUEST_DELAY)
    break_html = _get_text(session, _BREAK_CAMP_URL)
    if break_html:
        break_events = _parse_break_camp_sessions(break_html, _BREAK_CAMP_URL)
        logger.info("[autrey-mill] Found %d break camp sessions", len(break_events))
        all_raw_events.extend(break_events)

    # ---- 4. Recurring programs (Ageless Adventures) ------------------------
    logger.info("[autrey-mill] Parsing recurring programs")
    time.sleep(_REQUEST_DELAY)
    recurring_events = _parse_recurring_programs(session)
    logger.info("[autrey-mill] Found %d recurring programs", len(recurring_events))
    all_raw_events.extend(recurring_events)

    # ---- 5. Blog post events -----------------------------------------------
    logger.info("[autrey-mill] Scanning blog posts for events")
    blog_events = _harvest_blog_post_events(session)
    logger.info("[autrey-mill] Found %d blog post events", len(blog_events))
    all_raw_events.extend(blog_events)

    # ---- Deduplicate and persist -------------------------------------------
    seen_hashes: set[str] = set()

    for raw in all_raw_events:
        title = raw.get("title", "").strip()
        if not title:
            continue

        start_date = raw.get("start_date")
        if isinstance(start_date, str):
            try:
                start_date = date.fromisoformat(start_date)
            except ValueError:
                continue
        if not isinstance(start_date, date) or start_date < today:
            continue

        end_date = raw.get("end_date")
        if isinstance(end_date, str):
            try:
                end_date = date.fromisoformat(end_date)
            except ValueError:
                end_date = None

        description = raw.get("description") or ""
        source_url = raw.get("source_url", _BASE_URL)
        start_time = raw.get("start_time")
        end_time = raw.get("end_time")
        image_url = raw.get("image_url")
        ticket_url = raw.get("ticket_url")
        price_min = raw.get("price_min")
        price_max = raw.get("price_max")
        is_free = raw.get("is_free", False)
        extra_tags = raw.get("extra_tags")

        record, series_hint = _build_record(
            source_id=source_id,
            venue_id=venue_id,
            venue_name=venue_name,
            title=title,
            description=description,
            start_date=start_date,
            end_date=end_date,
            start_time=start_time,
            end_time=end_time,
            source_url=source_url,
            image_url=image_url,
            ticket_url=ticket_url,
            price_min=price_min,
            price_max=price_max,
            is_free=is_free,
            extra_tags=extra_tags,
        )

        content_hash = record["content_hash"]
        if content_hash in seen_hashes:
            continue
        seen_hashes.add(content_hash)

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
                    "[autrey-mill] Added: %s on %s",
                    record["title"],
                    record["start_date"],
                )
            except Exception as exc:
                logger.error(
                    "[autrey-mill] Failed to insert %r: %s",
                    record["title"],
                    exc,
                )

    logger.info(
        "[autrey-mill] Crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
