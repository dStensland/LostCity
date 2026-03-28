"""
Shared base for WordPress / The Events Calendar (Tribe) REST API crawlers.

The Tribe Events Calendar plugin exposes a REST API at:
  {base_url}/wp-json/tribe/events/v1/events

Any WordPress site running the plugin gets this endpoint for free. This base
module handles the full crawl lifecycle so individual source files are a thin
config wrapper:

  1. Fetch paginated JSON from the Tribe Events API.
  2. Parse start/end dates and times from the structured response fields.
  3. Parse cost strings into price_min / price_max.
  4. Map Tribe categories to our taxonomy (category + tags).
  5. Infer age ranges from title / description text.
  6. Group repeated events with series_hint where appropriate.
  7. Persist via get_or_create_place / find_event_by_hash / insert_event.

Design notes:
  - Uses requests (no Playwright) — this is a REST API, not a rendered page.
  - Per-page size is 20 (safe default respected by all known Tribe installs).
  - Rate-limited with a polite delay between pages.
  - start_date filter added by default so we only pull future events.
  - Image: prefers full-size URL from image.url, falls back to largest size dict.
  - Cost: handles "", "$X", "$X - $Y", "$X.00 – $Y.00" (en-dash variant).

Reuse pattern — each source file does:

    from sources._tribe_events_base import TribeConfig, crawl_tribe

    _CONFIG = TribeConfig(
        base_url="https://example.org",
        place_data={...},
        default_category="art",
        default_tags=["arts-center"],
    )

    def crawl(source: dict) -> tuple[int, int, int]:
        return crawl_tribe(source, _CONFIG)
"""

from __future__ import annotations

import html
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Callable, Optional

import requests

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

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
}

# Events per API page (Tribe default max is 50; 20 is polite and reliable)
_PAGE_SIZE = 20

# Polite delay between paginated requests (seconds)
_REQUEST_DELAY = 0.8

# Maximum pages to fetch per crawl (safety cap — 75 pages × 20 events = 1500)
_MAX_PAGES = 75

# ---------------------------------------------------------------------------
# Tribe category slug → LostCity category
# ---------------------------------------------------------------------------

_TRIBE_CATEGORY_MAP: dict[str, str] = {
    # Visual arts / studio arts
    "art-classes": "learning",
    "art-class": "learning",
    "arts-classes": "learning",
    "drawing-painting": "art",
    "pottery-ceramics": "learning",
    "blacksmithing": "learning",
    "jewelry-making-metalsmithing": "learning",
    "photography": "learning",
    "textiles": "learning",
    "writing": "learning",
    "wellness-arts": "wellness",
    # Dance
    "adult-dance": "dance",
    "childrens-dance": "dance",
    "dance-events": "dance",
    "salsa": "dance",
    "dance": "dance",
    "dance-class": "dance",
    # Music
    "jazz-on-the-lawn": "music",
    "spring-concert-series": "music",
    "concerts": "music",
    "concert": "music",
    "music": "music",
    "live-music": "music",
    # Theater / performance
    "performance": "theater",
    "theater": "theater",
    "theatre": "theater",
    # Gallery / exhibits
    "gallery-events": "art",
    "gallery": "art",
    "exhibit": "art",
    "exhibition": "art",
    # Family
    "family": "family",
    "family-events": "family",
    "kids": "family",
    # Community / special
    "special-event": "community",
    "special-events": "community",
    "community": "community",
    # Film
    "film": "film",
    "films": "film",
    "movies": "film",
    # Fitness / wellness
    "fitness": "fitness",
    "yoga": "wellness",
    "wellness": "wellness",
    # Food & drink
    "food-drink": "food_drink",
    "food-and-drink": "food_drink",
    "tasting": "food_drink",
    # Tours / tours
    "tours": "tours",
    "tour": "tours",
    # Markets
    "market": "markets",
    "markets": "markets",
    "farmers-market": "markets",
    # After-hours / adults programs (Atlanta History Center, similar museums)
    "after-hours": "nightlife",
    # Lecture / learning programs
    "lecture": "learning",
    "lectures": "learning",
    "author-talks": "community",
    "author-talk": "community",
    # Education / homeschool
    "education": "learning",
    "homeschool": "learning",
    # Gardens / outdoor programs
    "gardens": "community",
    "garden": "community",
    # Public programs (catch-all; generic so treated as fallback)
    "public-programs": "community",
    "public-program": "community",
    # Cherokee Garden Library (AHC-specific sub-program brand)
    "cherokee-garden-library": "learning",
}

# Tribe category slug → extra tags to add
_TRIBE_CATEGORY_TAG_MAP: dict[str, list[str]] = {
    "art-classes": ["hands-on", "class"],
    "art-class": ["hands-on", "class"],
    "drawing-painting": ["hands-on", "class"],
    "pottery-ceramics": ["hands-on", "class"],
    "blacksmithing": ["hands-on", "class"],
    "jewelry-making-metalsmithing": ["hands-on", "class"],
    "photography": ["hands-on", "class"],
    "textiles": ["hands-on", "class"],
    "writing": ["class"],
    "wellness-arts": ["class"],
    "adult-dance": ["dance", "class"],
    "childrens-dance": ["dance", "class", "kids"],
    "dance-events": ["dance"],
    "salsa": ["salsa", "dance"],
    "jazz-on-the-lawn": ["jazz", "live-music", "outdoor"],
    "spring-concert-series": ["live-music"],
    "gallery-events": [],
    "family": ["family-friendly"],
    "family-events": ["family-friendly"],
    "kids": ["family-friendly", "kids"],
    # After-hours / adults
    "after-hours": ["adults", "21+", "date-night"],
    # Lectures / learning
    "lecture": ["educational"],
    "lectures": ["educational"],
    "author-talks": ["educational"],
    "author-talk": ["educational"],
    # Education
    "education": ["educational", "kids", "family-friendly"],
    "homeschool": ["educational", "kids"],
    # Gardens / outdoor
    "gardens": ["outdoor"],
    "garden": ["outdoor"],
    # Library programs
    "cherokee-garden-library": ["educational", "outdoor"],
}

# Title / description keywords → category override (checked after Tribe categories)
_KEYWORD_CATEGORY_MAP: list[tuple[str, str]] = [
    (r"\b(concert|live music|live band|performance)\b", "music"),
    (
        r"\b(dance class|ballet|tap|jazz dance|hip.hop dance|salsa class|dance workshop)\b",
        "dance",
    ),
    (r"\b(pottery|ceramics|wheel|clay|kiln)\b", "learning"),
    (r"\b(painting|watercolor|drawing|sketching|life drawing)\b", "learning"),
    (r"\b(blacksmith|metalsmith|jewelry|jewellery)\b", "learning"),
    (r"\b(photography|photo class|photo workshop)\b", "learning"),
    (r"\b(writing|creative writing|screenwriting|poetry workshop)\b", "learning"),
    (r"\b(yoga|pilates|meditation|mindfulness)\b", "wellness"),
    (r"\b(gallery|opening|exhibition|exhibit)\b", "art"),
    (r"\b(film|movie|screening|cinema)\b", "film"),
    (r"\b(kids?|children|family|toddler|preschool|elementary)\b", "family"),
    (r"\b(camp|summer camp|spring camp)\b", "programs"),
    (r"\b(workshop|master ?class|tutorial|learn)\b", "learning"),
]

# Title / description keywords → extra tags
_KEYWORD_TAG_MAP: list[tuple[str, list[str]]] = [
    (r"\b(camp|summer camp|spring camp)\b", ["kids", "educational", "class"]),
    (r"\b(kids?|children|child|toddler|preschool)\b", ["kids", "family-friendly"]),
    (r"\b(family)\b", ["family-friendly"]),
    (r"\b(adult|adults|grown.up)\b", ["adults"]),
    (r"\b(teen|teenager|youth)\b", ["teen"]),
    (r"\b(senior|seniors|older adult)\b", ["adults"]),
    (r"\b(beginner|introduction|intro to|getting started)\b", ["free-lesson"]),
    (r"\b(outdoor|garden|lawn|alfresco|open.air)\b", ["outdoor"]),
    (
        r"\b(free admission|free event|no charge|complimentary)\b",
        [],
    ),  # handled via price
    (r"\b(workshop|masterclass|master class)\b", ["hands-on", "class"]),
    (r"\b(live music|live band|concert)\b", ["live-music"]),
    (r"\b(jazz)\b", ["jazz", "live-music"]),
    (r"\b(salsa|bachata|latin dance)\b", ["salsa", "latin", "dance"]),
    (r"\b(drag)\b", ["drag"]),
    (r"\b(comedy)\b", ["comedy"]),
    (r"\b(trivia)\b", ["trivia"]),
    (r"\b(karaoke)\b", ["karaoke"]),
    (r"\b(yoga)\b", ["yoga"]),
    (r"\b(gallery opening|opening reception)\b", ["date-night"]),
]

# ---------------------------------------------------------------------------
# Age range inference
# ---------------------------------------------------------------------------

_AGE_PATTERNS: list[tuple[re.Pattern, str]] = [
    # "ages 4-8", "ages 4 to 8", "ages 4–8"
    (re.compile(r"ages?\s+(\d+)\s*[-–to]+\s*(\d+)", re.IGNORECASE), "range"),
    # "ages 4+", "ages 4 and up", "ages 4 or older"
    (
        re.compile(
            r"ages?\s+(\d+)\s*(?:\+|and\s+(?:up|older)|or\s+older)", re.IGNORECASE
        ),
        "min",
    ),
    # "4 and up" without "ages"
    (re.compile(r"(\d+)\s+and\s+up", re.IGNORECASE), "min"),
    # "ages 4" — single age
    (re.compile(r"ages?\s+(\d+)(?!\s*[-–\d])", re.IGNORECASE), "single"),
    # "for children (3-5)", "for kids (5-10)"
    (
        re.compile(
            r"(?:for\s+)?(?:children|kids?|youth)\s*\(?(\d+)\s*[-–]\s*(\d+)\)?",
            re.IGNORECASE,
        ),
        "range",
    ),
    # "(ages 4-5)" parenthetical
    (re.compile(r"\(\s*ages?\s+(\d+)\s*[-–]\s*(\d+)\s*\)", re.IGNORECASE), "range"),
    # Ballet/Tap Combo 1 (ages 4-5) — common in dance programs
    (re.compile(r"\(\s*ages?\s+(\d+)[–-](\d+)\s*\)", re.IGNORECASE), "range"),
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

    # Keyword-based age inference (fallback)
    t = text.lower()
    if re.search(r"\b(infant|baby|babies)\b", t):
        return 0, 1
    if re.search(r"\b(toddler)\b", t):
        return 1, 3
    if re.search(r"\b(preschool|pre.?k|pre.?kindergarten)\b", t):
        return 3, 5

    return None, None


_AGE_BAND_RULES: list[tuple[int, int, str]] = [
    (0, 1, "infant"),
    (1, 3, "toddler"),
    (3, 5, "preschool"),
    (5, 12, "elementary"),
    (10, 13, "tween"),
    (13, 18, "teen"),
]


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
# Cost / price parsing
# ---------------------------------------------------------------------------

_COST_RANGE_PATTERN = re.compile(
    r"\$\s*([\d,]+(?:\.\d{1,2})?)\s*[-–—]\s*\$\s*([\d,]+(?:\.\d{1,2})?)"
)
_COST_SINGLE_PATTERN = re.compile(r"\$\s*([\d,]+(?:\.\d{1,2})?)")
_FREE_PATTERN = re.compile(r"\bfree\b", re.IGNORECASE)


def _parse_cost(cost_str: str) -> tuple[Optional[float], Optional[float], bool]:
    """
    Parse a Tribe cost string into (price_min, price_max, is_free).

    Handles:
      ""              → (None, None, False)   — unknown, not explicitly free
      "Free"          → (0.0, 0.0, True)
      "$15"           → (15.0, 15.0, False)
      "$15.00"        → (15.0, 15.0, False)
      "$15.00 - $25"  → (15.0, 25.0, False)
      "$15.00 – $640" → (15.0, 640.0, False)   — en-dash variant
    """
    if not cost_str or not cost_str.strip():
        return None, None, False

    s = cost_str.strip()

    if _FREE_PATTERN.search(s):
        return 0.0, 0.0, True

    # Range: "$X - $Y"
    m = _COST_RANGE_PATTERN.search(s)
    if m:
        lo = float(m.group(1).replace(",", ""))
        hi = float(m.group(2).replace(",", ""))
        if lo > hi:
            lo, hi = hi, lo
        is_free = hi == 0.0
        return lo, hi, is_free

    # Single: "$X"
    m = _COST_SINGLE_PATTERN.search(s)
    if m:
        val = float(m.group(1).replace(",", ""))
        return val, val, val == 0.0

    return None, None, False


# ---------------------------------------------------------------------------
# HTML stripping
# ---------------------------------------------------------------------------

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")
_HTML_ENTITIES = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
    "&#8211;": "–",
    "&#8212;": "—",
    "&#8216;": "\u2018",
    "&#8217;": "\u2019",
    "&#8220;": "\u201c",
    "&#8221;": "\u201d",
    "&#038;": "&",
}


_P_TAG_RE = re.compile(r"<p[^>]*>(.*?)</p>", re.DOTALL | re.IGNORECASE)


def _strip_html(raw: str, max_len: int = 800) -> str:
    """
    Strip HTML tags and decode entities, returning plain text up to max_len.

    Prefers content from <p> tags when present — this avoids pulling in
    widget/CTA boilerplate (e.g. member pricing divs on museum sites) that
    sits outside the main description paragraphs.
    """
    if not raw:
        return ""

    # Try extracting <p> tag content first
    p_matches = _P_TAG_RE.findall(raw)
    if p_matches:
        # Strip tags from each paragraph and join with space
        paragraphs: list[str] = []
        for p_html in p_matches:
            p_text = html.unescape(_HTML_TAG_RE.sub(" ", p_html))
            p_text = _WHITESPACE_RE.sub(" ", p_text).strip()
            if p_text:
                paragraphs.append(p_text)
        if paragraphs:
            text = " ".join(paragraphs)
            if len(text) > max_len:
                text = text[: max_len - 3].rstrip() + "..."
            return text

    # Fallback: strip all tags from the full raw string
    text = html.unescape(raw)
    text = _HTML_TAG_RE.sub(" ", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    if len(text) > max_len:
        text = text[: max_len - 3].rstrip() + "..."
    return text


# ---------------------------------------------------------------------------
# Image extraction
# ---------------------------------------------------------------------------


def _extract_image_url(image_field) -> Optional[str]:
    """
    Extract the best image URL from a Tribe event's `image` field.

    The field is:
      - False (bool) when no image
      - dict with keys: url, id, extension, width, height, sizes
        where sizes is a dict of size_name → {url, width, height, ...}
    """
    if not image_field or image_field is False:
        return None
    if isinstance(image_field, dict):
        # Full-size URL
        url = image_field.get("url")
        if url and isinstance(url, str):
            return url
        # Fallback: largest size by width
        sizes = image_field.get("sizes", {})
        if isinstance(sizes, dict) and sizes:
            best = max(
                sizes.values(),
                key=lambda s: s.get("width", 0) if isinstance(s, dict) else 0,
            )
            if isinstance(best, dict) and best.get("url"):
                return best["url"]
    return None


# ---------------------------------------------------------------------------
# Category and tag inference
# ---------------------------------------------------------------------------


def _infer_category_and_tags(
    tribe_category_slugs: list[str],
    tribe_tag_slugs: list[str],
    title: str,
    description: str,
    default_category: str,
    default_tags: list[str],
    age_min: Optional[int],
    age_max: Optional[int],
) -> tuple[str, list[str]]:
    """
    Return (category, tags) for a Tribe event.

    Priority:
      1. Tribe category slug → _TRIBE_CATEGORY_MAP
      2. Title/description keyword match → _KEYWORD_CATEGORY_MAP
      3. default_category from TribeConfig
    """
    category = default_category
    tags: list[str] = list(default_tags)

    # 1. Tribe categories → category + extra tags.
    # Some sites tag events with both a generic slug ("special-events") and a
    # specific one ("spring-concert-series"). We prefer the most specific match
    # by collecting all mapped categories and picking the one whose slug appears
    # latest in _TRIBE_CATEGORY_MAP (proxy for specificity via insertion order)
    # — unless a generic slug is the only mapping.
    _GENERIC_CATEGORY_SLUGS = frozenset(
        {
            "special-event",
            "special-events",
            "community",
            "events",
            "wh-events",
            # Location / wrapper labels that should never override a type category
            "main-campus",
            "public-programs",
            "public-program",
        }
    )
    specific_match: Optional[str] = None
    generic_match: Optional[str] = None
    for slug in tribe_category_slugs:
        mapped_cat = _TRIBE_CATEGORY_MAP.get(slug)
        if mapped_cat:
            if slug in _GENERIC_CATEGORY_SLUGS:
                if generic_match is None:
                    generic_match = mapped_cat
            else:
                specific_match = mapped_cat
                break  # first specific match wins
    if specific_match:
        category = specific_match
    elif generic_match:
        category = generic_match

    for slug in tribe_category_slugs:
        extra = _TRIBE_CATEGORY_TAG_MAP.get(slug, [])
        for t in extra:
            if t not in tags:
                tags.append(t)

    # 2. Keyword scan of title + description
    combined = f"{title} {description}".lower()

    # Category override from keywords (only if we're still at default)
    if category == default_category:
        for pattern, cat in _KEYWORD_CATEGORY_MAP:
            if re.search(pattern, combined, re.IGNORECASE):
                category = cat
                break

    # Extra tags from keywords
    for pattern, extra_tags in _KEYWORD_TAG_MAP:
        if re.search(pattern, combined, re.IGNORECASE):
            for t in extra_tags:
                if t not in tags:
                    tags.append(t)

    # 3. Age bands
    age_tags = _age_band_tags(age_min, age_max)
    for t in age_tags:
        if t not in tags:
            tags.append(t)

    # 4. Age semantics: kids-only program → add "kids"; adults-only → add "adults"
    if age_max is not None and age_max <= 17:
        if "kids" not in tags:
            tags.append("kids")
        if "family-friendly" not in tags:
            tags.append("family-friendly")
    if age_min is not None and age_min >= 18:
        if "adults" not in tags:
            tags.append("adults")

    # 5. Tribe event tags (slugs used as-is if they match our taxonomy)
    from tags import ALL_TAGS

    for t in tribe_tag_slugs:
        if t in ALL_TAGS and t not in tags:
            tags.append(t)

    return category, tags


# ---------------------------------------------------------------------------
# Series hint detection
# ---------------------------------------------------------------------------

# Title patterns that strongly suggest a class series / recurring program
_CLASS_SERIES_PATTERNS: list[re.Pattern] = [
    re.compile(r"\bclass\b", re.IGNORECASE),
    re.compile(r"\bworkshop\b", re.IGNORECASE),
    re.compile(r"\blessons?\b", re.IGNORECASE),
    re.compile(r"\bseries\b", re.IGNORECASE),
    re.compile(r"\bcourse\b", re.IGNORECASE),
    re.compile(r"\b(level|beginner|intermediate|advanced)\b", re.IGNORECASE),
    re.compile(r"\bcamp\b", re.IGNORECASE),
    # Callanwolde-style codes: "POT 14 –", "DAP 09 –", "JWY 04 –"
    re.compile(r"^[A-Z]{2,4}\s+\d{2,3}\s*[-–]", re.IGNORECASE),
]

_CONCERT_SERIES_PATTERNS: list[re.Pattern] = [
    re.compile(r"\bconcert series\b", re.IGNORECASE),
    re.compile(r"\bjazz on the lawn\b", re.IGNORECASE),
    re.compile(r"\bspring concert\b", re.IGNORECASE),
    re.compile(r"\bsummer concert\b", re.IGNORECASE),
    re.compile(r"\bfall concert\b", re.IGNORECASE),
]


def _build_series_hint(
    title: str,
    tribe_category_slugs: list[str],
) -> Optional[dict]:
    """
    Return a series_hint dict if this event looks like a recurring series.

    Rules:
    - If it matches class/workshop/lesson patterns → class_series with a
      normalised series_title (strip date/session suffixes and code prefixes).
    - If it matches a named concert series category → recurring_show with the
      category as series_title.
    - Otherwise → None (one-off events don't need series linking).
    """
    # Check for named concert series
    for pattern in _CONCERT_SERIES_PATTERNS:
        if pattern.search(title):
            series_title = _normalise_series_title(title)
            return {
                "series_type": "recurring_show",
                "series_title": series_title,
                "frequency": "irregular",
            }

    for slug in tribe_category_slugs:
        if slug in ("spring-concert-series", "jazz-on-the-lawn", "concert-series"):
            return {
                "series_type": "recurring_show",
                "series_title": _normalise_series_title(title),
                "frequency": "irregular",
            }

    # Check for class series
    for pattern in _CLASS_SERIES_PATTERNS:
        if pattern.search(title):
            series_title = _normalise_series_title(title)
            return {
                "series_type": "class_series",
                "series_title": series_title,
                "frequency": "weekly",
            }

    return None


def _normalise_series_title(title: str) -> str:
    """
    Strip session-specific suffixes from a title to get the series name.

    Examples:
      "POT 14 – Beginning Wheel (O'Leary)" → "POT 14 – Beginning Wheel"
      "Ballet/Tap Combo 1 (ages 4-5)" → "Ballet/Tap Combo 1"
      "Jazz on the Lawn – April 2026" → "Jazz on the Lawn"
      "True Blossom and Slow Parade – Spring Concert Series 2026" → unchanged
    """
    # Strip instructor name in final parentheses: "(Smith)" but not "(ages 4-5)"
    t = re.sub(r"\s*\([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\)\s*$", "", title).strip()
    # Strip trailing date/year: "– April 2026", "- Spring 2026", "2026"
    t = re.sub(
        r"\s*[-–]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+)?\d{4}\s*$",
        "",
        t,
        flags=re.IGNORECASE,
    ).strip()
    # Strip trailing age range in parens: "(ages 4-5)"
    t = re.sub(r"\s*\(ages?\s+\d+[-–]\d+\)\s*$", "", t, flags=re.IGNORECASE).strip()
    return t or title


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _api_get(
    session: requests.Session,
    url: str,
    params: dict,
    *,
    retries: int = 3,
) -> Optional[dict]:
    """GET a Tribe Events API URL, returning parsed JSON or None on failure."""
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, headers=_HEADERS, params=params, timeout=30)
            if resp.status_code == 404:
                logger.warning("Tribe API 404: %s", url)
                return None
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            if attempt >= retries:
                logger.error(
                    "Tribe API GET %s failed after %d attempts: %s", url, retries, exc
                )
                return None
            time.sleep(1.5 * attempt)
        except ValueError as exc:
            logger.error("Tribe API JSON parse error at %s: %s", url, exc)
            return None
    return None


# ---------------------------------------------------------------------------
# Config dataclass
# ---------------------------------------------------------------------------


@dataclass
class TribeConfig:
    """Configuration for one Tribe Events Calendar source."""

    # Base URL of the WordPress site (e.g. "https://callanwolde.org")
    base_url: str

    # Venue data passed to get_or_create_place()
    place_data: dict

    # Default LostCity category when Tribe categories don't map
    default_category: str = "community"

    # Tags always applied to every event from this source
    default_tags: list[str] = field(default_factory=list)

    # Only fetch events on/after today (recommended: True)
    future_only: bool = True

    # Tribe category slugs to skip (e.g. internal admin categories)
    skip_category_slugs: list[str] = field(default_factory=list)

    # If True, events with no category mapping use keyword inference
    use_keyword_inference: bool = True

    # Maximum number of API pages to fetch per crawl
    max_pages: int = _MAX_PAGES

    # Optional source-specific record mutator.
    # Runs after the shared record is built and before dedupe/upsert.
    record_transform: Optional[Callable[[dict, dict], dict]] = None

    @property
    def api_url(self) -> str:
        return f"{self.base_url.rstrip('/')}/wp-json/tribe/events/v1/events"


# ---------------------------------------------------------------------------
# Event record builder
# ---------------------------------------------------------------------------


def _build_event_record(
    event: dict,
    source_id: int,
    venue_id: int,
    venue_name: str,
    config: TribeConfig,
) -> Optional[dict]:
    """
    Convert a raw Tribe event dict into a LostCity event record dict.

    Returns None if the event should be skipped (no title, past, etc.).
    """
    title_raw = event.get("title", "").strip()
    if not title_raw:
        return None

    title = html.unescape(title_raw)

    # Strip common Tribe status prefixes that some sites embed in the title field
    # e.g. "[SOLD OUT] Event Name" → "Event Name"
    title = re.sub(r"^\[SOLD OUT\]\s*", "", title, flags=re.IGNORECASE).strip()
    if not title:
        return None

    # ---- Dates / times --------------------------------------------------
    # Tribe provides "start_date": "2026-05-08 19:30:00" in site local time.
    start_raw = event.get("start_date", "")
    end_raw = event.get("end_date", "")

    if not start_raw:
        return None

    try:
        start_dt = datetime.strptime(start_raw, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        logger.debug("Could not parse start_date %r for event %r", start_raw, title)
        return None

    start_date_str = start_dt.strftime("%Y-%m-%d")
    start_time_str: Optional[str] = None

    is_all_day = bool(event.get("all_day", False))
    if not is_all_day:
        # Always preserve the time the API provides — 00:00 is midnight, not
        # "unknown time".  The all_day flag is the canonical indicator; if it
        # is False we always store the time so 12:00 AM and 12:00 PM are
        # never silently dropped.
        start_time_str = start_dt.strftime("%H:%M")

    end_date_str: Optional[str] = None
    end_time_str: Optional[str] = None
    if end_raw:
        try:
            end_dt = datetime.strptime(end_raw, "%Y-%m-%d %H:%M:%S")
            end_date_str = end_dt.strftime("%Y-%m-%d")
            if not is_all_day:
                end_time_str = end_dt.strftime("%H:%M")
        except ValueError:
            pass

    # Skip if entirely in the past
    today = date.today()
    try:
        if datetime.strptime(start_date_str, "%Y-%m-%d").date() < today:
            return None
    except ValueError:
        return None

    # ---- Description ----------------------------------------------------
    description_raw = event.get("description", "") or ""
    description = _strip_html(description_raw, max_len=800)

    # ---- Age range ------------------------------------------------------
    combined_text = f"{title} {description}"
    age_min, age_max = _parse_age_range(combined_text)

    # ---- Categories and tags --------------------------------------------
    tribe_categories = event.get("categories", []) or []
    tribe_tags = event.get("tags", []) or []

    tribe_cat_slugs = [
        c.get("slug", "") for c in tribe_categories if isinstance(c, dict)
    ]
    tribe_tag_slugs = [t.get("slug", "") for t in tribe_tags if isinstance(t, dict)]

    # Skip if in the skip list
    for skip_slug in config.skip_category_slugs:
        if skip_slug in tribe_cat_slugs:
            return None

    category, tags = _infer_category_and_tags(
        tribe_cat_slugs,
        tribe_tag_slugs,
        title,
        description,
        config.default_category,
        config.default_tags,
        age_min,
        age_max,
    )

    # ---- Price ----------------------------------------------------------
    cost_str = event.get("cost", "") or ""
    price_min, price_max, is_free = _parse_cost(cost_str)

    # ---- Image ----------------------------------------------------------
    image_url = _extract_image_url(event.get("image"))

    # ---- URLs -----------------------------------------------------------
    source_url = event.get("url", "") or ""
    # `website` in Tribe events = the registration/ticket URL, not the event page
    ticket_url = event.get("website") or source_url or None

    # ---- Series hint ----------------------------------------------------
    series_hint = _build_series_hint(title, tribe_cat_slugs)

    # ---- Content hash ---------------------------------------------------
    # Include start_time in hash so different sessions of the same class on the
    # same day (rare but possible) are treated as separate events.
    hash_key = start_date_str
    if start_time_str:
        hash_key = f"{start_date_str}|{start_time_str}"
    content_hash = generate_content_hash(title, venue_name, hash_key)

    record: dict = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description if description else None,
        "start_date": start_date_str,
        "end_date": end_date_str,
        "start_time": start_time_str,
        "end_time": end_time_str,
        "is_all_day": is_all_day,
        "category": category,
        "tags": tags,
        "is_free": is_free,
        "price_min": price_min,
        "price_max": price_max,
        "price_note": None,
        "source_url": source_url,
        "ticket_url": ticket_url,
        "image_url": image_url,
        "raw_text": f"{title} | {', '.join(tribe_cat_slugs)}",
        "extraction_confidence": 0.90,
        "is_recurring": series_hint is not None,
        "content_hash": content_hash,
    }

    if age_min is not None:
        record["age_min"] = age_min
    if age_max is not None:
        record["age_max"] = age_max

    if config.record_transform:
        try:
            transformed = config.record_transform(event, dict(record))
            if transformed:
                record = transformed
        except Exception as exc:
            logger.warning(
                "[tribe/%s] record_transform failed for %r: %s",
                config.place_data.get("slug") or config.base_url,
                title,
                exc,
            )

    return record, series_hint


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl_tribe(source: dict, config: TribeConfig) -> tuple[int, int, int]:
    """
    Crawl one Tribe Events Calendar site and persist events to the database.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    api_url = config.api_url

    events_found = 0
    events_new = 0
    events_updated = 0

    # Ensure venue exists
    try:
        venue_id = get_or_create_place(config.place_data)
    except Exception as exc:
        logger.error(
            "[tribe/%s] Failed to create/find venue: %s",
            config.place_data.get("slug", "?"),
            exc,
        )
        return 0, 0, 0

    venue_name = config.place_data["name"]
    logger.info(
        "[tribe/%s] Starting crawl — API: %s",
        config.place_data.get("slug", "?"),
        api_url,
    )

    http_session = requests.Session()
    today_str = date.today().strftime("%Y-%m-%d")

    page = 1
    total_pages: Optional[int] = None

    while True:
        params: dict = {
            "per_page": _PAGE_SIZE,
            "page": page,
        }
        if config.future_only:
            params["start_date"] = today_str

        data = _api_get(http_session, api_url, params)

        if data is None:
            logger.warning(
                "[tribe/%s] API returned None on page %d — stopping",
                config.place_data.get("slug", "?"),
                page,
            )
            break

        if total_pages is None:
            total_pages = int(data.get("total_pages", 1))
            total_events = int(data.get("total", 0))
            logger.info(
                "[tribe/%s] %d total events across %d pages",
                config.place_data.get("slug", "?"),
                total_events,
                total_pages,
            )

        raw_events = data.get("events", [])
        if not raw_events:
            # Empty page → we've exhausted the results
            break

        for raw_event in raw_events:
            result = _build_event_record(
                raw_event, source_id, venue_id, venue_name, config
            )
            if result is None:
                continue

            record, series_hint = result

            events_found += 1
            content_hash = record["content_hash"]

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, record)
                events_updated += 1
            else:
                try:
                    insert_event(record, series_hint=series_hint)
                    events_new += 1
                    logger.debug(
                        "[tribe/%s] Added: %s on %s",
                        config.place_data.get("slug", "?"),
                        record["title"],
                        record["start_date"],
                    )
                except Exception as exc:
                    logger.error(
                        "[tribe/%s] Failed to insert %r: %s",
                        config.place_data.get("slug", "?"),
                        record["title"],
                        exc,
                    )

        # Advance page
        if page >= min(total_pages or 1, config.max_pages):
            break

        # Check if there's a next page via the API's own next_rest_url
        if not data.get("next_rest_url"):
            break

        page += 1
        time.sleep(_REQUEST_DELAY)

    logger.info(
        "[tribe/%s] Crawl complete: %d found, %d new, %d updated",
        config.place_data.get("slug", "?"),
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
