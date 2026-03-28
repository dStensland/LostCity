"""
Crawler for Little Shop of Stories (littleshopofstories.com).

Little Shop of Stories is a beloved children's bookstore in Decatur, GA,
and a cultural anchor for Atlanta families. They run a rich calendar of
programming: story times, author visits, book signings, book clubs,
writing workshops, parenting workshops, and summer camps.

Site: Drupal 11 — server-rendered HTML, no JavaScript required.
Pagination: monthly via /events (current month) and /events/YYYY/MM.
We look ahead up to MAX_MONTHS_AHEAD months from today.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

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

BASE_URL = "https://littleshopofstories.com"
EVENTS_URL = f"{BASE_URL}/events"

# How many months ahead to crawl (current + next N months)
MAX_MONTHS_AHEAD = 3

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Polite delay between page fetches
_PAGE_DELAY = 0.8

# ---------------------------------------------------------------------------
# Venue data
# ---------------------------------------------------------------------------

PLACE_DATA = {
    "name": "Little Shop of Stories",
    "slug": "little-shop-of-stories",
    "address": "133 E Court Square",
    "neighborhood": "Downtown Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7748,
    "lng": -84.2963,
    "venue_type": "bookstore",
    "spot_type": "bookstore",
    "website": BASE_URL,
    "vibes": ["family-friendly", "all-ages", "cozy", "intimate"],
}

# ---------------------------------------------------------------------------
# Tag classification
#
# The site uses its own tag slugs like "Book Signing", "Storytime", "Book Club".
# Map those to our taxonomy, and add keyword-based inference on top.
# ---------------------------------------------------------------------------

# Drupal tag text → (category_override_or_None, extra_tags)
_SITE_TAG_MAP: dict[str, tuple[Optional[str], list[str]]] = {
    "Book Signing": ("words", ["educational"]),
    "Book Club": ("words", ["educational", "social"]),
    "Storytime": ("family", ["kids", "family-friendly", "educational"]),
    "Author Event": ("words", ["educational"]),
    "Writing Workshop": ("learning", ["kids", "educational", "hands-on", "class"]),
    "Workshop": ("learning", ["hands-on", "class"]),
    "Camp": ("programs", ["kids", "educational", "class"]),
    "Summer Camp": ("programs", ["kids", "educational", "class"]),
}

# Title / description keyword → (category_override_or_None, extra_tags)
_KEYWORD_TAG_MAP: list[tuple[str, Optional[str], list[str]]] = [
    # Storytime patterns
    (r"\bstorytime\b", "family", ["kids", "family-friendly", "educational"]),
    (r"\bcircle\s+time\b", "family", ["kids", "family-friendly", "educational"]),
    # Author / book events
    (r"\bauthor\b", "words", ["educational"]),
    (r"\bbook\s+(signing|launch|release|talk)\b", "words", ["educational"]),
    # Writing
    (r"\bwriting\s+workshop\b", "learning", ["kids", "educational", "hands-on", "class"]),
    (r"\bwriting\s+group\b", "learning", ["adults", "educational", "class"]),
    (r"\bwriting\b", "learning", ["educational"]),
    # Book clubs
    (r"\bbook\s+club\b", "words", ["educational", "social"]),
    # Workshops / classes
    (r"\bworkshop\b", "learning", ["hands-on", "class"]),
    (r"\bparenting\s+workshop\b", "learning", ["adults", "class"]),
    # Camp
    (r"\bcamp\b", "programs", ["kids", "educational", "class"]),
    (r"\bsummer\s+camp\b", "programs", ["kids", "educational", "class"]),
    # Yoga storytime
    (r"\byoga\s+storytime\b", "family", ["kids", "family-friendly", "yoga", "educational"]),
    # Teen events
    (r"\bteen\b", None, ["teen"]),
    (r"\bteens?\b", None, ["teen"]),
    # Age band patterns handled separately via _infer_age_range
]

# Age band inference patterns (returns age_min, age_max)
_AGE_PATTERNS: list[tuple[re.Pattern, str]] = [
    # "ages 4-8", "ages 4 to 8", "ages 4–8"
    (re.compile(r"ages?\s+(\d+)\s*[-–to]+\s*(\d+)", re.IGNORECASE), "range"),
    # "ages 4+" or "4 and up"
    (re.compile(r"ages?\s+(\d+)\s*\+", re.IGNORECASE), "min"),
    (re.compile(r"(\d+)\s+and\s+up", re.IGNORECASE), "min"),
    # "for 4 to 7 year olds", "for 8-to-11-year-olds"
    (
        re.compile(
            r"for\s+(\d+)[- ]to[- ](\d+)[ -]year", re.IGNORECASE
        ),
        "range",
    ),
    # "ages 4" single age
    (re.compile(r"ages?\s+(\d+)(?!\s*[-–\d])", re.IGNORECASE), "single"),
    # "(ages 4-5)" parenthetical
    (re.compile(r"\(\s*ages?\s+(\d+)\s*[-–]\s*(\d+)\s*\)", re.IGNORECASE), "range"),
    # "4-8 year olds"
    (re.compile(r"(\d+)\s*[-–]\s*(\d+)\s*year", re.IGNORECASE), "range"),
    # "0-5", "3-5" keyword-only (toddler/preschool)
]


def _infer_age_range(text: str) -> tuple[Optional[int], Optional[int]]:
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

    # Keyword fallback
    t = text.lower()
    if re.search(r"\b(infant|baby|babies)\b", t):
        return 0, 1
    if re.search(r"\btoddler\b", t):
        return 1, 3
    if re.search(r"\bpreschool|pre.?k\b", t):
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
    """Return age-band tags overlapping [age_min, age_max]."""
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 100
    return [tag for lo_b, hi_b, tag in _AGE_BAND_RULES if lo <= hi_b and hi >= lo_b]


# ---------------------------------------------------------------------------
# Date / time helpers
# ---------------------------------------------------------------------------

_DATE_PATTERN = re.compile(
    r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?,?\s+(\d{1,2})/(\d{1,2})/(\d{4})",
    re.IGNORECASE,
)

_TIME_PATTERN = re.compile(
    r"(\d{1,2}(?::\d{2})?\s*[ap]m)\s*(?:-\s*(\d{1,2}(?::\d{2})?\s*[ap]m))?",
    re.IGNORECASE,
)


def _parse_time_str(t: str) -> Optional[str]:
    """Convert '11:00am', '4:00pm', '11am' → 'HH:MM' 24-hour."""
    t = t.strip()
    m = re.match(r"(\d{1,2}):(\d{2})\s*(am|pm)", t, re.IGNORECASE)
    if m:
        hour, minute, period = int(m.group(1)), m.group(2), m.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    m = re.match(r"(\d{1,2})\s*(am|pm)", t, re.IGNORECASE)
    if m:
        hour, period = int(m.group(1)), m.group(2).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:00"
    return None


def _parse_date_item(text: str) -> Optional[str]:
    """
    Parse the date detail item text.

    Format seen: "Date: Wed, 3/4/2026" or "Sun, 3/1/2026"
    Returns YYYY-MM-DD string or None.
    """
    m = _DATE_PATTERN.search(text)
    if m:
        month, day, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return date(year, month, day).strftime("%Y-%m-%d")
        except ValueError:
            return None
    return None


def _parse_time_item(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse the time detail item text.

    Format seen: "Time: 11:00am - 11:30am" or "4:00pm - 6:00pm"
    Returns (start_time, end_time) in HH:MM 24h format.
    """
    m = _TIME_PATTERN.search(text)
    if not m:
        return None, None
    start_time = _parse_time_str(m.group(1))
    end_time = _parse_time_str(m.group(2)) if m.group(2) else None
    return start_time, end_time


# ---------------------------------------------------------------------------
# Series hint detection
# ---------------------------------------------------------------------------

_SERIES_TITLE_PATTERNS: list[tuple[re.Pattern, str, str]] = [
    # Writing workshop series: "Middle Grade Writing Workshop: Spring Session #5"
    (
        re.compile(r"(.*?writing\s+workshop.*?):\s*\w+\s+session\s+#?\d+", re.IGNORECASE),
        "class_series",
        "weekly",
    ),
    # Book clubs: any event with "Book Club" in the title is a monthly recurring series.
    # The .* after "book club" is optional because most titles end with "Book Club".
    (
        re.compile(r"(.+book\s+club.*)", re.IGNORECASE),
        "recurring_show",
        "monthly",
    ),
    # Storytime recurring
    (
        re.compile(r"(.*?storytime.*?)", re.IGNORECASE),
        "recurring_show",
        "weekly",
    ),
    # Parenting workshop series
    (
        re.compile(r"(parenting\s+workshop\s+series:?)\s+.+", re.IGNORECASE),
        "class_series",
        "monthly",
    ),
    # Teen Study Hall
    (
        re.compile(r"(teen\s+study\s+hall)", re.IGNORECASE),
        "recurring_show",
        "weekly",
    ),
]

# Strip session suffixes to normalise series title
_SESSION_SUFFIX_RE = re.compile(
    r"\s*:?\s*(?:spring|fall|summer|winter)\s+session\s+#?\d+\s*$",
    re.IGNORECASE,
)


def _build_series_hint(title: str, site_tags: list[str]) -> Optional[dict]:
    """
    Return series_hint for recurring events, or None for one-offs.

    Book clubs, storytime sessions, and writing workshop sessions all recur
    and benefit from series grouping to avoid feed spam.
    """
    # Camp / one-off author events are not series
    if any(t.lower() in ("camp", "summer camp", "book signing", "author event") for t in site_tags):
        return None

    for pattern, series_type, frequency in _SERIES_TITLE_PATTERNS:
        m = pattern.search(title)
        if m:
            # Normalise series title: strip session numbers
            series_title = _SESSION_SUFFIX_RE.sub("", title).strip()
            series_title = re.sub(r"\s+", " ", series_title)
            return {
                "series_type": series_type,
                "series_title": series_title,
                "frequency": frequency,
            }

    return None


# ---------------------------------------------------------------------------
# Category + tag inference
# ---------------------------------------------------------------------------


def _classify_event(
    title: str,
    description: str,
    site_tags: list[str],
    age_min: Optional[int],
    age_max: Optional[int],
) -> tuple[str, list[str]]:
    """
    Return (category, tags) for an event.

    Priority:
    1. Site tag (e.g. "Storytime", "Book Club") → _SITE_TAG_MAP
    2. Title/description keyword → _KEYWORD_TAG_MAP
    3. Default: "family"
    """
    category = "family"
    tags: list[str] = ["books", "reading", "family-friendly", "kids", "educational", "decatur"]

    # 1. Site tags
    for site_tag in site_tags:
        mapping = _SITE_TAG_MAP.get(site_tag)
        if mapping:
            cat_override, extra_tags = mapping
            if cat_override:
                category = cat_override
            for t in extra_tags:
                if t not in tags:
                    tags.append(t)

    # 2. Keyword scan
    combined = f"{title} {description}".lower()
    for kw_pattern, cat_override, extra_tags in _KEYWORD_TAG_MAP:
        if re.search(kw_pattern, combined, re.IGNORECASE):
            if cat_override and category == "family":
                # Only override if we're still at default
                category = cat_override
            for t in extra_tags:
                if t not in tags:
                    tags.append(t)

    # 3. Adults-only check: if description says "for grownups" or "adults only"
    if re.search(r"\b(for\s+grownups|adults[- ]only|adults\s+only|adult\s+only)\b", combined):
        # Strip kids-oriented tags since this is adults-only
        for t in ("kids", "family-friendly"):
            if t in tags:
                tags.remove(t)
        if "adults" not in tags:
            tags.append("adults")

    # 4. Age bands from inferred age range
    age_tags = _age_band_tags(age_min, age_max)
    for t in age_tags:
        if t not in tags:
            tags.append(t)

    # 5. If clearly a kids-only event (max age <= 17), ensure kids tag
    if age_max is not None and age_max <= 17:
        if "kids" not in tags:
            tags.append("kids")
        if "family-friendly" not in tags:
            tags.append("family-friendly")

    return category, tags


# ---------------------------------------------------------------------------
# HTML fetching
# ---------------------------------------------------------------------------


def _fetch_html(session: requests.Session, url: str, *, retries: int = 3) -> Optional[str]:
    """Fetch URL with retry logic, returning HTML text or None on failure."""
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, headers=_HEADERS, timeout=30)
            if resp.status_code == 404:
                logger.debug("[little-shop-stories] 404 at %s — skipping", url)
                return None
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            if attempt >= retries:
                logger.error(
                    "[little-shop-stories] GET %s failed after %d attempts: %s",
                    url,
                    retries,
                    exc,
                )
                return None
            time.sleep(1.5 * attempt)
    return None


# ---------------------------------------------------------------------------
# HTML parsing
# ---------------------------------------------------------------------------


def _parse_event_card(
    article: BeautifulSoup,
    source_id: int,
    venue_id: int,
) -> Optional[dict]:
    """
    Parse one `article.event-list` element into a LostCity event record dict.

    Returns None if the event should be skipped (missing required fields, past, etc.).
    """
    # ---- Title -------------------------------------------------------------
    title_el = article.select_one(".event-list__title a")
    if not title_el:
        return None
    title = title_el.get_text(strip=True)
    if not title:
        return None

    # ---- Source URL --------------------------------------------------------
    rel_href = title_el.get("href", "")
    source_url = f"{BASE_URL}{rel_href}" if rel_href.startswith("/") else rel_href
    if not source_url:
        source_url = EVENTS_URL

    # ---- Site tags (e.g. "Book Signing", "Storytime") ----------------------
    site_tags: list[str] = [
        a.get_text(strip=True)
        for a in article.select(".event-tag__term a")
    ]

    # ---- Date and time from detail items -----------------------------------
    start_date_str: Optional[str] = None
    start_time_str: Optional[str] = None
    end_time_str: Optional[str] = None

    for detail in article.select(".event-list__details--item"):
        label_el = detail.select_one(".event-list__details--label")
        if not label_el:
            continue
        label_text = label_el.get_text(strip=True).lower()
        full_text = detail.get_text(separator=" ", strip=True)

        if "date" in label_text:
            start_date_str = _parse_date_item(full_text)
        elif "time" in label_text:
            start_time_str, end_time_str = _parse_time_item(full_text)

    if not start_date_str:
        # Fallback: reconstruct date from month/day elements + current year
        month_el = article.select_one(".event-list__date--month")
        day_el = article.select_one(".event-list__date--day")
        if month_el and day_el:
            try:
                month_str = month_el.get_text(strip=True)
                day_str = day_el.get_text(strip=True)
                today = date.today()
                dt = datetime.strptime(f"{month_str} {day_str} {today.year}", "%b %d %Y")
                # If that date is already past, try next year
                if dt.date() < today:
                    dt = dt.replace(year=today.year + 1)
                start_date_str = dt.strftime("%Y-%m-%d")
            except ValueError:
                logger.debug(
                    "[little-shop-stories] Could not parse fallback date for: %s", title
                )
                return None

    if not start_date_str:
        return None

    # ---- Skip past events --------------------------------------------------
    try:
        event_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    except ValueError:
        return None
    if event_date < date.today():
        return None

    # ---- Description -------------------------------------------------------
    body_el = article.select_one(".event-list__body")
    description: Optional[str] = None
    if body_el:
        raw = body_el.get_text(separator=" ", strip=True)
        # Truncate at a readable length
        if len(raw) > 800:
            raw = raw[:797].rstrip() + "..."
        description = raw if raw else None

    # ---- Age range inference -----------------------------------------------
    combined_text = f"{title} {description or ''}"
    age_min, age_max = _infer_age_range(combined_text)

    # ---- Category and tags -------------------------------------------------
    category, tags = _classify_event(title, description or "", site_tags, age_min, age_max)

    # ---- Image -------------------------------------------------------------
    image_url: Optional[str] = None
    img_el = article.select_one(".event-list__image img")
    if img_el:
        src = img_el.get("src") or img_el.get("data-src") or ""
        if src:
            image_url = f"{BASE_URL}{src}" if src.startswith("/") else src

    # ---- Ticket / RSVP URL -------------------------------------------------
    ticket_el = article.select_one("a.event-list__links--rsvp")
    ticket_url: Optional[str] = None
    if ticket_el:
        ticket_href = ticket_el.get("href", "")
        if ticket_href:
            ticket_url = (
                f"{BASE_URL}{ticket_href}"
                if ticket_href.startswith("/")
                else ticket_href
            )

    # ---- Series hint -------------------------------------------------------
    series_hint = _build_series_hint(title, site_tags)
    is_recurring = series_hint is not None

    # ---- Content hash ------------------------------------------------------
    # Include time so multiple same-title events on the same day (e.g. two
    # storytime sessions) get distinct hashes.
    hash_key = start_date_str
    if start_time_str:
        hash_key = f"{start_date_str}|{start_time_str}"
    content_hash = generate_content_hash(title, PLACE_DATA["name"], hash_key)

    record: dict = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date_str,
        "end_date": None,
        "start_time": start_time_str,
        "end_time": end_time_str,
        "is_all_day": False,
        "category": category,
        "tags": tags,
        "is_free": None,   # Price not shown on listing; unknown
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "source_url": source_url,
        "ticket_url": ticket_url,
        "image_url": image_url,
        "raw_text": f"{title} | {', '.join(site_tags)}",
        "extraction_confidence": 0.88,
        "is_recurring": is_recurring,
        "content_hash": content_hash,
    }

    if age_min is not None:
        record["age_min"] = age_min
    if age_max is not None:
        record["age_max"] = age_max

    return record, series_hint


def _parse_events_page(html: str, source_id: int, venue_id: int) -> list[tuple[dict, Optional[dict]]]:
    """
    Parse all event-list articles from one events page.

    Returns list of (record, series_hint) tuples for valid events.
    """
    soup = BeautifulSoup(html, "html.parser")
    results: list[tuple[dict, Optional[dict]]] = []

    for article in soup.select("article.event-list"):
        result = _parse_event_card(article, source_id, venue_id)
        if result is None:
            continue
        record, series_hint = result
        results.append((record, series_hint))

    return results


# ---------------------------------------------------------------------------
# Month URL generator
# ---------------------------------------------------------------------------


def _month_urls_to_crawl() -> list[str]:
    """
    Return the list of event page URLs to crawl.

    Covers the current month plus MAX_MONTHS_AHEAD additional months.
    The base /events URL is the current month; subsequent months use
    /events/YYYY/MM.
    """
    today = date.today()
    urls: list[str] = [EVENTS_URL]  # Current month

    for delta in range(1, MAX_MONTHS_AHEAD + 1):
        # Advance month by delta (handling year rollover)
        month = today.month + delta
        year = today.year
        while month > 12:
            month -= 12
            year += 1
        urls.append(f"{BASE_URL}/events/{year}/{month:02d}")

    return urls


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Little Shop of Stories events and persist to the database.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Ensure venue exists
    try:
        venue_id = get_or_create_place(PLACE_DATA)
    except Exception as exc:
        logger.error("[little-shop-stories] Failed to get/create venue: %s", exc)
        return 0, 0, 0

    http_session = requests.Session()
    month_urls = _month_urls_to_crawl()

    logger.info(
        "[little-shop-stories] Starting crawl — %d month pages to fetch",
        len(month_urls),
    )

    seen_hashes: set[str] = set()  # Dedup across month pages (recurring events appear on both)

    for i, url in enumerate(month_urls):
        if i > 0:
            time.sleep(_PAGE_DELAY)

        html = _fetch_html(http_session, url)
        if not html:
            logger.warning("[little-shop-stories] No HTML from %s — skipping", url)
            continue

        page_results = _parse_events_page(html, source_id, venue_id)
        logger.debug(
            "[little-shop-stories] %s → %d candidates", url, len(page_results)
        )

        for record, series_hint in page_results:
            content_hash = record["content_hash"]

            # Skip if we already processed this event from an earlier month page
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
                        "[little-shop-stories] Added: %s on %s",
                        record["title"],
                        record["start_date"],
                    )
                except Exception as exc:
                    logger.error(
                        "[little-shop-stories] Failed to insert %r: %s",
                        record["title"],
                        exc,
                    )

    logger.info(
        "[little-shop-stories] Crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
