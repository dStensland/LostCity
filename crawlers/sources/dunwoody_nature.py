"""
Crawler for Dunwoody Nature Center (dunwoodynature.org).

Dunwoody Nature Center is a 22-acre urban nature preserve in Dunwoody, GA
(DeKalb County, north of Atlanta) offering:

  - Family programs and free First Saturday events
  - Children's programs (Junior Beekeepers, Nature Ambassadors, Kids Clay)
  - Adult programs (yoga, sound baths, mushroom walks, Bob Ross painting,
    beekeeping club, night hikes, birding, clay classes)
  - Homeschool and nature outreach
  - Nature art workshops (macrame, terrarium building, holiday crafts)
  - Community events (campouts, festivals, volunteer days)

Technology: WordPress + Modern Events Calendar (MEC) lite plugin.
The Tribe Events Calendar REST API (/wp-json/tribe/events/v1/events) is NOT
present — MEC exposes events as a custom post type at /wp-json/wp/v2/mec-events.

Approach (same pattern as chattahoochee_nature.py):
  1. GET /wp-json/wp/v2/mec-events?per_page=100&_embed=wp:featuredmedia
     Returns all event CPT records with embedded featured images in one call.
  2. For each event, GET the detail page and extract:
     - schema.org Event JSON-LD (for date — startDate[:10] only; time field unreliable)
     - .mec-single-event-time abbr.mec-events-abbr (for accurate start/end time)
     - .mec-events-event-cost (for price — schema offers.price is unreliable)
     - NeonCRM registration link from mec-booking-button / mec-more-info-button
  3. Skip past events and sold-out / closed notices.
  4. Infer age ranges and category/tags from MEC category slugs + keyword scan.

Note on schema startDate time: MEC stores internal timestamps that don't
reliably reflect local display time. Always use the time widget abbr for
start/end times. Use schema startDate[:10] for the date only.

Rate limit: 0.8s between detail page fetches.
Expected yield: ~60-80 future events per crawl run.
"""

from __future__ import annotations

import html
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

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_BASE_URL = "https://dunwoodynature.org"
_WP_API_URL = f"{_BASE_URL}/wp-json/wp/v2/mec-events"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
_HEADERS = {"User-Agent": _USER_AGENT}

_REQUEST_DELAY = 0.8  # seconds between detail page fetches

_VENUE_DATA = {
    "name": "Dunwoody Nature Center",
    "slug": "dunwoody-nature-center",
    "address": "5343 Roberts Dr",
    "neighborhood": "Dunwoody",
    "city": "Dunwoody",
    "state": "GA",
    "zip": "30338",
    "lat": 33.9458,
    "lng": -84.3347,
    "venue_type": "nature_center",
    "spot_type": "park",
    "website": _BASE_URL,
    "vibes": ["family-friendly", "outdoor", "all-ages", "educational"],
}

# ---------------------------------------------------------------------------
# Title skip patterns — sold-out notices and closures
# ---------------------------------------------------------------------------

_SKIP_TITLE_SUBSTRINGS: tuple[str, ...] = (
    "sold out",
    "sold-out",
    "cancelled",
    "canceled",
    "closed",
)


def _should_skip(title: str) -> bool:
    """Return True if this title is a closure/sold-out notice, not a real event."""
    lower = title.lower()
    return any(pat in lower for pat in _SKIP_TITLE_SUBSTRINGS)


# ---------------------------------------------------------------------------
# MEC category slug → LostCity category
# ---------------------------------------------------------------------------

# DNC uses three MEC categories: adult-programs, childrens-programs, family-programs
_CAT_SLUG_TO_CATEGORY: dict[str, str] = {
    "adult-programs": "outdoors",
    "childrens-programs": "family",
    "family-programs": "family",
}

# Default tags always applied to DNC events
_DEFAULT_TAGS: list[str] = [
    "nature",
    "outdoors",
    "family-friendly",
    "educational",
    "dunwoody",
]

# ---------------------------------------------------------------------------
# Age range inference
# ---------------------------------------------------------------------------

_AGE_PATTERNS: list[tuple[re.Pattern, str]] = [
    # "ages 7-14", "ages 7 to 14", "ages 7 through 14", "ages 7–14"
    (
        re.compile(r"ages?\s+(\d+)\s*(?:[-–]|to\b|through\b)\s*(\d+)", re.IGNORECASE),
        "range",
    ),
    # "ages 7+" / "ages 7 and up"
    (
        re.compile(
            r"ages?\s+(\d+)\s*(?:\+|and\s+(?:up|older)|or\s+older)",
            re.IGNORECASE,
        ),
        "min",
    ),
    # "7 and up" without "ages"
    (re.compile(r"(\d+)\s+and\s+up", re.IGNORECASE), "min"),
    # "ages 7" — single age (checked last)
    (re.compile(r"ages?\s+(\d+)(?!\s*[-–\d])", re.IGNORECASE), "single"),
    # "for children (7-14)", "for kids (5-12)"
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
    if re.search(r"\b(preschool|pre.?k)\b", t):
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
# Category and tag inference
# ---------------------------------------------------------------------------

_KEYWORD_CATEGORY_MAP: list[tuple[str, str]] = [
    (r"\b(hike|hiking|trail walk|forest bath|night hike|night walk)\b", "outdoors"),
    (r"\b(bird|birding|bird walk)\b", "outdoors"),
    (r"\b(canoe|kayak|paddle)\b", "outdoors"),
    (r"\b(yoga|sound bath|reiki|meditation|mindful|yin yoga)\b", "wellness"),
    (r"\b(concert|live music|jam circle|singalong)\b", "music"),
    (r"\b(film|movie|screening)\b", "film"),
    (r"\b(5k|10k|fun run|dash)\b", "fitness"),
    (r"\b(camp|summer camp|winter camp|break camp)\b", "programs"),
    # Learning/arts patterns checked before generic food/drink
    (
        r"\b(paint|drawing|art class|clay|pottery|ceramics|macrame|terrarium|wreath|ornament|mushroom cultivation|mushroom walk|beekeep|botany|gardening|native plant|journaling|masterclass|master class)\b",
        "learning",
    ),
    (r"\b(workshop|class)\b", "learning"),
    (r"\b(book club|author reading)\b", "learning"),
    (r"\b(volunteer|restoration|cleanup|stewardship)\b", "community"),
    (r"\b(fair|festival|celebration|market)\b", "community"),
    (r"\b(toddlers?|preschool|pre.?k)\b", "family"),
    (r"\b(homeschool|family|kids?|children|junior)\b", "family"),
    # Food/drink last (sip-and-paint is still primarily learning)
    (r"\b(cocktail|wine tasting|beer tasting|brew event)\b", "food_drink"),
]

_KEYWORD_TAG_MAP: list[tuple[str, list[str]]] = [
    (r"\b(hike|hiking|trail walk|forest bath)\b", ["hiking"]),
    (r"\b(night hike|night walk|after dark)\b", ["hiking", "date-night"]),
    (r"\b(bird|birding)\b", ["educational"]),
    (r"\b(yoga)\b", ["yoga"]),
    (r"\b(sound bath|reiki|meditation|mindful)\b", ["wellness"]),
    (r"\b(camp|summer camp)\b", ["kids", "class"]),
    (r"\b(volunteer|restoration|stewardship)\b", ["volunteer", "volunteer-outdoors"]),
    (r"\b(toddlers?|pee wee|preschool)\b", ["toddler", "preschool"]),
    (r"\b(homeschool)\b", ["educational", "kids"]),
    (r"\b(family|kids?|children|junior)\b", ["family-friendly"]),
    (r"\b(festival|fair)\b", ["seasonal"]),
    (
        r"\b(paint|clay|pottery|macrame|terrarium|wreath|ornament)\b",
        ["hands-on", "class"],
    ),
    (r"\b(mushroom|beekeep|botany|native plant|plant sale)\b", ["educational"]),
    (r"\b(sip|cocktail|wine|brew)\b", ["date-night"]),
    (r"\b(free)\b", []),  # handled via is_free
    (r"\b(book club)\b", ["social"]),
    (r"\b(workshop|masterclass|master class)\b", ["hands-on", "class"]),
    (r"\b(16\+|adults? only|adult program)\b", ["adults"]),
    (r"\b(campout|overnight|camping)\b", ["outdoor"]),
    (r"\b(stargazing|starry|astronomy)\b", ["educational", "date-night"]),
    (r"\b(butterfly|firefly|wildlife|amphibian|insect|bug)\b", ["educational"]),
]


def _infer_category_and_tags(
    mec_category_slugs: list[str],
    title: str,
    description: str,
    age_min: Optional[int],
    age_max: Optional[int],
) -> tuple[str, list[str]]:
    """Return (category, tags) for a DNC event."""
    category = "family"  # sensible default for a nature center
    tags: list[str] = list(_DEFAULT_TAGS)
    category_from_slug = False

    # 1. MEC category slug mapping — prefer children/family over adult
    for slug in mec_category_slugs:
        mapped = _CAT_SLUG_TO_CATEGORY.get(slug)
        if mapped:
            category = mapped
            category_from_slug = True
            break

    # 2. Keyword override of category — only when slug mapping gave a generic result
    # (adult-programs → outdoors is worth overriding; childrens-programs → family is not)
    combined = f"{title} {description}".lower()
    if not category_from_slug or category == "outdoors":
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
    re.compile(r"\bird walk\b", re.IGNORECASE),
    re.compile(r"\bbeekeepers?.?club\b", re.IGNORECASE),
    re.compile(r"\bbook club\b", re.IGNORECASE),
    re.compile(r"\bambassadors\b", re.IGNORECASE),
    re.compile(r"\bvolunteering\b", re.IGNORECASE),
]

_RECURRING_SHOW_RE: list[re.Pattern] = [
    re.compile(r"\bfriday night hike\b", re.IGNORECASE),
    re.compile(r"\bsound bath\b", re.IGNORECASE),
    re.compile(r"\byoga in the park\b", re.IGNORECASE),
    re.compile(r"\bfree first saturday\b", re.IGNORECASE),
    re.compile(r"\bpaint.{0,5}bob ross\b", re.IGNORECASE),
    re.compile(r"\bpaint and sip\b", re.IGNORECASE),
    re.compile(r"\bnature journaling\b", re.IGNORECASE),
    re.compile(r"\bmindful nature walk\b", re.IGNORECASE),
    re.compile(r"\bnew moon\b", re.IGNORECASE),
]

_DATE_SUFFIX_RE = re.compile(
    r"\s*[-–]\s*(?:spring|summer|fall|winter|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|"
    r"apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|"
    r"oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+\d{4})?\s*$",
    re.IGNORECASE,
)

_YEAR_SUFFIX_RE = re.compile(r"\s*[-–]?\s*\d{4}\s*$")


def _normalise_series_title(title: str) -> str:
    """Strip session-specific date/year suffixes for the series title."""
    t = _DATE_SUFFIX_RE.sub("", title).strip()
    t = _YEAR_SUFFIX_RE.sub("", t).strip()
    # Remove trailing month abbreviations without preceding dash
    t = re.sub(
        r"\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*\d*\s*$",
        "",
        t,
        flags=re.IGNORECASE,
    ).strip()
    return t or title


def _build_series_hint(title: str) -> Optional[dict]:
    """Return a series_hint dict if this event looks like part of a recurring series."""
    for pattern in _RECURRING_SHOW_RE:
        if pattern.search(title):
            series_title = _normalise_series_title(title)
            return {
                "series_type": "recurring_show",
                "series_title": series_title,
                "frequency": "irregular",
            }

    for pattern in _CLASS_SERIES_RE:
        if pattern.search(title):
            series_title = _normalise_series_title(title)
            return {
                "series_type": "class_series",
                "series_title": series_title,
                "frequency": "irregular",
            }

    return None


# ---------------------------------------------------------------------------
# Price parsing
# ---------------------------------------------------------------------------

_COST_RANGE_PATTERN = re.compile(
    r"\$\s*([\d,]+(?:\.\d{1,2})?)\s*[-–—]\s*\$?\s*([\d,]+(?:\.\d{1,2})?)"
)
_COST_SINGLE_PATTERN = re.compile(r"\$\s*([\d,]+(?:\.\d{1,2})?)")
_FREE_PATTERN = re.compile(
    r"\b(free|no cost|no charge|no fee|complimentary|included with)\b",
    re.IGNORECASE,
)


def _parse_price(cost_text: str) -> tuple[Optional[float], Optional[float], bool]:
    """
    Parse price from cost element text or description.

    Handles:
      "Free"            → (0.0, 0.0, True)
      "$45.00"          → (45.0, 45.0, False)
      "$10 - $20"       → (10.0, 20.0, False)
      ""                → (None, None, False)
    """
    if not cost_text or not cost_text.strip():
        return None, None, False

    s = cost_text.strip()

    if _FREE_PATTERN.search(s):
        return 0.0, 0.0, True

    m = _COST_RANGE_PATTERN.search(s)
    if m:
        a = float(m.group(1).replace(",", ""))
        b = float(m.group(2).replace(",", ""))
        lo, hi = min(a, b), max(a, b)
        return lo, hi, hi == 0.0

    m = _COST_SINGLE_PATTERN.search(s)
    if m:
        val = float(m.group(1).replace(",", ""))
        return val, val, val == 0.0

    return None, None, False


# ---------------------------------------------------------------------------
# HTML helpers
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
    """GET a URL, return response text or None on persistent failure."""
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, headers=_HEADERS, timeout=30)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            if attempt >= retries:
                logger.error(
                    "[dnc] GET %s failed after %d attempts: %s", url, retries, exc
                )
                return None
            time.sleep(1.5 * attempt)
    return None


def _get_json(
    session: requests.Session, url: str, retries: int = 3
) -> Optional[object]:
    """GET a URL, return parsed JSON or None on persistent failure."""
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, headers=_HEADERS, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            if attempt >= retries:
                logger.error(
                    "[dnc] JSON GET %s failed after %d attempts: %s", url, retries, exc
                )
                return None
            time.sleep(1.5 * attempt)
        except ValueError as exc:
            logger.error("[dnc] JSON parse error at %s: %s", url, exc)
            return None
    return None


# ---------------------------------------------------------------------------
# Time parsing
# ---------------------------------------------------------------------------

# MEC time widget formats: "6:30 pm - 8:00 pm", "9:00 am - 1:00 pm", "All Day"
_TIME_RANGE_RE = re.compile(
    r"(\d{1,2}:\d{2}\s*(?:am|pm))\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:am|pm))",
    re.IGNORECASE,
)
_TIME_SINGLE_RE = re.compile(r"(\d{1,2}:\d{2}\s*(?:am|pm))", re.IGNORECASE)


def _parse_time_text(time_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse MEC time widget text into (start_time, end_time) in HH:MM 24h format.

    Examples:
      "6:30 pm - 8:00 pm"  → ("18:30", "20:00")
      "9:00 am - 1:00 pm"  → ("09:00", "13:00")
      "All Day"            → (None, None)
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
    """Convert '6:30 pm' → '18:30', '9:00 am' → '09:00'."""
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
    Parse a DNC event detail page and return a structured dict.

    Extracts:
      - schema.org Event JSON-LD: name, startDate (date only), endDate (date only)
      - .mec-single-event-time abbr.mec-events-abbr: accurate start/end time
      - .mec-events-event-cost: price (schema offers.price is unreliable)
      - mec-booking-button / mec-more-info-button href: NeonCRM registration URL
      - og:image: fallback image when schema.org image absent

    Returns None if no schema.org Event block is found.
    """
    soup = BeautifulSoup(html_text, "html.parser")

    # ---- schema.org Event JSON-LD -------------------------------------------
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

    name = html.unescape(event_schema.get("name", "")).strip()
    if not name:
        return None

    start_date_raw = event_schema.get("startDate", "")
    end_date_raw = event_schema.get("endDate", "")

    if not start_date_raw:
        return None

    # Use date portion only — the time component in schema.org is unreliable on MEC
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
        content_div = soup.find(
            "div", class_=re.compile(r"mec-single-event-description")
        )
        if content_div:
            description = _strip_html(content_div.get_text(separator=" "), max_len=800)

    # ---- Image --------------------------------------------------------------
    image_url: Optional[str] = event_schema.get("image") or None
    if not image_url:
        og = soup.find("meta", property="og:image")
        if og:
            image_url = og.get("content")

    # ---- Time (from MEC widget — reliable) ----------------------------------
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    time_section = soup.find("div", class_=re.compile(r"mec-single-event-time"))
    if time_section:
        # The abbr inside .mec-single-event-time contains the formatted time
        # e.g. "6:30 pm - 8:00 pm". Avoid the date abbr which has class "mec-start-date-label"
        abbr = time_section.find("abbr", class_="mec-events-abbr")
        if abbr:
            start_time, end_time = _parse_time_text(abbr.get_text(strip=True))

    # ---- Price (from cost display element) ----------------------------------
    # Extraction priority:
    #   1. .mec-events-event-cost DD text (most reliable — "$45.00", "Free")
    #   2. schema.org offers.price (reliable on DNC: "0" = free, "45" = $45)
    #   3. Description text scan (last resort for long descriptions that embed cost)
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    is_free = False

    cost_dd = soup.find("dd", class_="mec-events-event-cost")
    if cost_dd:
        cost_text = cost_dd.get_text(strip=True)
        price_min, price_max, is_free = _parse_price(cost_text)
    else:
        # Use schema offers.price — on DNC this reliably reflects the actual price
        offers = event_schema.get("offers", {})
        if isinstance(offers, dict):
            price_str = str(offers.get("price", "") or "")
            if price_str == "0":
                price_min, price_max, is_free = 0.0, 0.0, True
            elif price_str and price_str.replace(".", "").isdigit():
                price_min, price_max, is_free = _parse_price(f"${price_str}")
        # If schema had no price, scan description for "Cost: $X" or "Free" patterns
        if price_min is None and not is_free:
            price_min, price_max, is_free = _parse_price(description)

    # ---- Registration URL (NeonCRM) -----------------------------------------
    register_url: Optional[str] = None
    booking_btn = soup.find("a", class_=re.compile(r"mec-booking-button"))
    if booking_btn and booking_btn.get("href"):
        href = html.unescape(booking_btn["href"])
        # Only use external registration links, not links back to the event page
        if "dunwoodynature.org/mec-events" not in href:
            register_url = href

    if not register_url:
        more_info = soup.find("a", class_=re.compile(r"mec-more-info-button"))
        if more_info and more_info.get("href"):
            href = html.unescape(more_info["href"])
            if "dunwoodynature.org/mec-events" not in href:
                register_url = href

    # ---- MEC category slugs from body class ---------------------------------
    # BeautifulSoup gives us the body's class list which includes "mec_category-*"
    category_slugs: list[str] = []
    body = soup.find("body")
    if body:
        body_classes = body.get("class", [])
        for cls in body_classes:
            if cls.startswith("mec_category-"):
                category_slugs.append(cls[len("mec_category-") :])

    # Also try sidebar category links
    cat_links = soup.find_all("a", href=lambda x: x and "/mec-category/" in x)
    for link in cat_links:
        m = re.search(r"/mec-category/([^/]+)/?$", link.get("href", ""))
        if m:
            slug = m.group(1)
            if slug not in category_slugs:
                category_slugs.append(slug)

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
    Crawl Dunwoody Nature Center events via WordPress MEC REST API + detail pages.

    Steps:
      1. GET /wp-json/wp/v2/mec-events?per_page=100&_embed=wp:featuredmedia
         Returns all event CPT records with embedded featured images.
      2. For each record, GET the detail page and parse schema.org Event + time widget.
      3. Skip past events and administrative notices (sold-out, cancelled, closed).
      4. Persist via get_or_create_venue / find_event_by_hash / insert_event.

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
    except Exception as exc:
        logger.error("[dnc] Failed to create/find venue: %s", exc)
        return 0, 0, 0

    venue_name = _VENUE_DATA["name"]
    session = requests.Session()

    # ---- Step 1: Fetch all event CPT records with embedded images -----------
    logger.info("[dnc] Fetching event list from WP REST API")
    api_url = f"{_WP_API_URL}?per_page=100&page=1&_embed=wp:featuredmedia"
    raw_events = _get_json(session, api_url)

    if not raw_events or not isinstance(raw_events, list):
        logger.error("[dnc] WP API returned no events or unexpected response")
        return 0, 0, 0

    logger.info("[dnc] %d base event records from WP API", len(raw_events))

    # ---- Step 2: Fetch each detail page and parse --------------------------
    for wp_event in raw_events:
        slug = wp_event.get("slug", "")
        event_link = wp_event.get("link", "")
        if not slug or not event_link:
            continue

        wp_title = html.unescape(wp_event.get("title", {}).get("rendered", "")).strip()

        # Fast skip on administrative notices without fetching the page
        if _should_skip(wp_title):
            logger.debug("[dnc] Skipping notice: %r", wp_title)
            continue

        # Grab featured image from _embed (avoid extra HTTP request per event)
        embed_image: Optional[str] = None
        embedded = wp_event.get("_embedded", {})
        featured_media = embedded.get("wp:featuredmedia", [])
        if featured_media and isinstance(featured_media, list):
            first_media = featured_media[0]
            if isinstance(first_media, dict):
                embed_image = first_media.get("source_url")

        time.sleep(_REQUEST_DELAY)

        html_text = _get_text(session, event_link)
        if not html_text:
            logger.warning("[dnc] Failed to fetch detail page: %s", event_link)
            continue

        detail = _parse_detail_page(html_text, event_link)
        if not detail:
            logger.debug("[dnc] No schema.org Event block at %s — skipping", event_link)
            continue

        # ---- Date filter ---------------------------------------------------
        try:
            start_dt = date.fromisoformat(detail["start_date"])
        except (ValueError, TypeError):
            logger.debug(
                "[dnc] Could not parse start_date %r for %r",
                detail["start_date"],
                detail["name"],
            )
            continue

        if start_dt < today:
            logger.debug(
                "[dnc] Past event, skipping: %r on %s",
                detail["name"],
                detail["start_date"],
            )
            continue

        # ---- Image: prefer schema.org / og:image, fall back to _embed ------
        image_url = detail.get("image_url") or embed_image

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
        # Only store end_date when it differs from start_date (multi-day events)
        end_date_out = (
            detail["end_date"]
            if detail["end_date"] and detail["end_date"] != detail["start_date"]
            else None
        )

        record: dict = {
            "source_id": source_id,
            "venue_id": venue_id,
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
            "image_url": image_url,
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
                    "[dnc] Added: %s on %s",
                    record["title"],
                    record["start_date"],
                )
            except Exception as exc:
                logger.error(
                    "[dnc] Failed to insert %r: %s",
                    record["title"],
                    exc,
                )

    logger.info(
        "[dnc] Crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
