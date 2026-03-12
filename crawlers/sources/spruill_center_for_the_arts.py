"""
Crawler for Spruill Center for the Arts (spruillarts.org).

Dunwoody-based community arts center offering classes, workshops, and events
in pottery, ceramics, glass art, jewelry, fiber arts, painting, drawing,
photography, woodturning, blacksmithing, yoga, and youth programs.

Data sources:
  1. Class schedule: registration.spruillarts.org ActiveNetwork/WebConnect
     system — structured HTML table with 600+ class sessions, start dates,
     meeting times, and instructor names.
  2. Special events: WP v2 REST API (mec-events post type) + JSON-LD
     structured data on each event detail page for accurate start/end dates.

The site uses the Modern Events Calendar (MEC) plugin, not Tribe Events
Calendar, so the tribe REST endpoint is absent. Dates live in MEC custom
post meta which is not exposed via the WP v2 API — hence the JSON-LD
strategy for special events.
"""

from __future__ import annotations

import html
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

BASE_URL = "https://www.spruillarts.org"
_REG_BASE = "https://registration.spruillarts.org/wconnect/ace"
_CLASSES_URL = f"{_REG_BASE}/ShowSchedule.awp?Mode=GROUP&Group=:FULL&Title=All+Courses"
_WP_API_URL = f"{BASE_URL}/wp-json/wp/v2/mec-events"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "text/html,application/json,*/*",
}

# Polite delay between event page fetches (seconds)
_REQUEST_DELAY = 0.6

VENUE_DATA = {
    "name": "Spruill Center for the Arts",
    "slug": "spruill-center-for-the-arts",
    "address": "5339 Chamblee Dunwoody Rd",
    "neighborhood": "Dunwoody",
    "city": "Dunwoody",
    "state": "GA",
    "zip": "30338",
    "lat": 33.9205,
    "lng": -84.3102,
    "venue_type": "arts_center",
    "spot_type": "arts_center",
    "website": BASE_URL,
    "vibes": ["artsy", "family-friendly", "all-ages", "casual"],
}

# Skip these title markers — closed registration is fine to still show;
# skip only true internal/admin entries
_SKIP_TITLE_RE = re.compile(
    r"\b(staff meeting|board meeting|committee|internal|private|members only|before care|after care)\b",
    re.IGNORECASE,
)

# Course code prefix → (category, extra_tags)
# Derived from registration system course code patterns
_CODE_CATEGORY_MAP: dict[str, tuple[str, list[str]]] = {
    "PT": ("learning", ["painting", "hands-on", "class"]),
    "DW": ("learning", ["drawing", "hands-on", "class"]),
    "CE": ("learning", ["pottery", "hands-on", "class"]),
    "GL": ("learning", ["glass", "hands-on", "class"]),
    "JE": ("learning", ["jewelry", "hands-on", "class"]),
    "FA": ("learning", ["fiber-arts", "hands-on", "class"]),
    "SC": ("learning", ["blacksmithing", "hands-on", "class"]),
    "PH": ("learning", ["photography", "class"]),
    "MM": ("learning", ["mixed-media", "hands-on", "class"]),
    "WW": ("learning", ["woodworking", "hands-on", "class"]),
    "DA": ("learning", ["decorative-arts", "hands-on", "class"]),
    "DI": ("learning", ["digital-arts", "class"]),
    "AS": ("learning", ["art-history", "class"]),
    "YC": ("learning", ["kids", "family-friendly", "class"]),
    "YT": ("learning", ["teen", "class"]),
    "MJ": ("community", ["games", "social"]),
    "YOGA": ("wellness", ["yoga", "class"]),
    "TC": ("wellness", ["class"]),
    "AFA": ("community", ["educational", "accessible"]),
    "GP": ("community", ["hands-on", "family-friendly"]),
    "MINI": ("learning", ["kids", "family-friendly", "hands-on"]),
    "CRA": ("community", ["hands-on", "family-friendly"]),
    "FF": ("learning", ["kids", "family-friendly", "hands-on"]),
    "RAM": ("community", ["market", "arts"]),
}

# Keyword → (category, extra_tags) — used when code map doesn't match
_KEYWORD_RULES: list[tuple[re.Pattern, str, list[str]]] = [
    (
        re.compile(r"\b(pottery|ceramic|clay|kiln|wheel|raku)\b", re.I),
        "learning",
        ["pottery", "hands-on", "class"],
    ),
    (
        re.compile(
            r"\b(glass|stained glass|kiln.form|fused glass|glassblowing|beadmaking)\b",
            re.I,
        ),
        "learning",
        ["glass", "hands-on", "class"],
    ),
    (
        re.compile(r"\b(jewelry|metalsmith|silver clay|ring|pendant)\b", re.I),
        "learning",
        ["jewelry", "hands-on", "class"],
    ),
    (
        re.compile(r"\b(painting|watercolor|acrylic|oil paint|pastel|gouache)\b", re.I),
        "learning",
        ["painting", "hands-on", "class"],
    ),
    (
        re.compile(r"\b(drawing|sketch|figure draw|portrait|pencil)\b", re.I),
        "learning",
        ["drawing", "hands-on", "class"],
    ),
    (
        re.compile(r"\b(photograph|camera|darkroom|digital photo)\b", re.I),
        "learning",
        ["photography", "class"],
    ),
    (
        re.compile(r"\b(fiber|weave|crochet|knit|quilt|sewing|mending)\b", re.I),
        "learning",
        ["fiber-arts", "hands-on", "class"],
    ),
    (
        re.compile(r"\b(blacksmith|forge|metalwork|anvil)\b", re.I),
        "learning",
        ["blacksmithing", "hands-on", "class"],
    ),
    (
        re.compile(r"\b(woodwork|woodturn|lathe)\b", re.I),
        "learning",
        ["woodworking", "hands-on", "class"],
    ),
    (
        re.compile(r"\b(collage|mixed media|art journal|mosaic)\b", re.I),
        "learning",
        ["mixed-media", "hands-on", "class"],
    ),
    (
        re.compile(r"\b(yoga|pilates|mindfulness|meditation)\b", re.I),
        "wellness",
        ["yoga", "class"],
    ),
    (re.compile(r"\btai chi\b", re.I), "wellness", ["class"]),
    (
        re.compile(r"\b(mahjongg|mah jongg|mahjong)\b", re.I),
        "community",
        ["games", "social"],
    ),
    (
        re.compile(r"\b(camp|summer camp|spring camp|winter camp)\b", re.I),
        "programs",
        ["kids", "family-friendly", "educational"],
    ),
    (
        re.compile(r"\b(kid|child|youth|toddler|preschool|elementary)\b", re.I),
        "learning",
        ["kids", "family-friendly"],
    ),
    (
        re.compile(
            r"\b(teen|teenager|ages 13|ages 14|ages 15|ages 16|ages 17)\b", re.I
        ),
        "learning",
        ["teen"],
    ),
    (
        re.compile(r"\b(workshop|class|lesson|instruction|studio)\b", re.I),
        "learning",
        ["hands-on", "class"],
    ),
    (
        re.compile(r"\b(gallery|exhibit|reception|opening|show)\b", re.I),
        "art",
        ["gallery"],
    ),
    (
        re.compile(r"\b(concert|performance|recital|live music)\b", re.I),
        "music",
        ["live-music"],
    ),
    (re.compile(r"\b(market|fair|festival)\b", re.I), "community", ["market"]),
]

# Age range pattern
_AGE_RE = re.compile(r"ages?\s+(\d+)(?:\s*[-–&]\s*(\d+))?", re.IGNORECASE)
_AGE_SINGLE_RE = re.compile(
    r"(\d+)\s*(?:yrs?|years?)\s*(?:&\s*up|\+|and\s+up|or\s+older)?", re.IGNORECASE
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _strip_html(raw: str, max_len: int = 600) -> str:
    """Strip HTML tags, decode entities, normalise whitespace."""
    if not raw:
        return ""
    text = html.unescape(raw)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len]


def _parse_age_range(text: str) -> tuple[Optional[int], Optional[int]]:
    """Extract age_min / age_max from a title string."""
    m = _AGE_RE.search(text)
    if m:
        lo = int(m.group(1))
        hi = int(m.group(2)) if m.group(2) else None
        return lo, hi
    # "17 yrs & up"
    m2 = _AGE_SINGLE_RE.search(text)
    if m2:
        return int(m2.group(1)), None
    # Keyword inference
    t = text.lower()
    if re.search(r"\b(toddler)\b", t):
        return 1, 3
    if re.search(r"\b(preschool|pre.?k)\b", t):
        return 3, 5
    if (
        re.search(r"\b(kids?|children|elementary)\b", t)
        and re.search(r"\b(teen|adult)\b", t) is None
    ):
        return 5, 12
    return None, None


def _infer_category_and_tags(
    course_code_prefix: str,
    title: str,
    default_category: str = "learning",
    default_tags: Optional[list[str]] = None,
) -> tuple[str, list[str]]:
    """Return (category, tags) from course code prefix + title keywords."""
    tags: list[str] = list(default_tags or [])
    category = default_category

    # 1. Course code prefix match (longest prefix first)
    matched_code = None
    for prefix in sorted(_CODE_CATEGORY_MAP, key=len, reverse=True):
        if course_code_prefix.upper().startswith(prefix):
            cat, extra = _CODE_CATEGORY_MAP[prefix]
            category = cat
            for t in extra:
                if t not in tags:
                    tags.append(t)
            matched_code = prefix
            break

    # 2. Keyword scan (always runs — can add additional tags)
    combined = title.lower()
    for pattern, cat, extra_tags in _KEYWORD_RULES:
        if pattern.search(combined):
            # Only override category if code didn't match
            if matched_code is None:
                category = cat
            for t in extra_tags:
                if t not in tags:
                    tags.append(t)
            # Only use first keyword match for category
            if matched_code is None:
                break

    return category, tags


def _parse_meets_time(meets: str) -> Optional[str]:
    """
    Extract start time from the 'Meets' column string.

    Examples:
      "Saturday : Sat 10:00 AM - 2:30 PM, 1 Session"  → "10:00"
      "Fri : 10:00 AM - 12:30 PM, 10 Sessions"        → "10:00"
      "M, Tu, W, Th, F : 8:00 AM - 9:30 AM, 5 Sess"  → "08:00"
      "Friday : Fri 12 N - 1:30 PM, 1 Session"        → "12:00"
    """
    if not meets:
        return None

    # "12 N" (noon)
    if re.search(r"\b12\s*N\b", meets, re.IGNORECASE):
        return "12:00"

    m = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", meets, re.IGNORECASE)
    if not m:
        return None

    hour, minute, ampm = int(m.group(1)), int(m.group(2)), m.group(3).upper()
    if ampm == "PM" and hour != 12:
        hour += 12
    elif ampm == "AM" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _parse_class_date(date_str: str) -> Optional[str]:
    """
    Parse registration system date format "MM/DD/YY" → "YYYY-MM-DD".
    """
    date_str = date_str.strip()
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str, "%m/%d/%y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        # Try MM/DD/YYYY
        try:
            dt = datetime.strptime(date_str, "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            return None


def _is_closed(title: str) -> bool:
    """Return True if the course title indicates fully closed enrollment."""
    return bool(re.search(r"\b%?\(Closed\)", title))


def _is_internal(title: str) -> bool:
    """Return True if the course looks like an internal/admin item."""
    return bool(_SKIP_TITLE_RE.search(title))


def _clean_title(title: str) -> str:
    """Strip trailing markers like '^', '*', '%(Closed)', '(Closed)'."""
    t = re.sub(r"\s*%?\(Closed\)\s*$", "", title)
    t = re.sub(r"[\s*^]+$", "", t)
    return t.strip()


def _extract_course_code_prefix(href: str) -> str:
    """
    Extract the alphabetic course code prefix from a registration href.

    href examples:
      "CourseStatus.awp?&course=261PTPT210"  → "PTPT"
      "CourseStatus.awp?&course=262YOGA001"  → "YOGA"
    """
    m = re.search(r"course=\d+([A-Z]{2,8})", href, re.IGNORECASE)
    return m.group(1).upper() if m else ""


# ---------------------------------------------------------------------------
# Class schedule crawler (registration system)
# ---------------------------------------------------------------------------


def _crawl_classes(
    session: requests.Session,
    source_id: int,
    venue_id: int,
    today: date,
) -> tuple[int, int, int]:
    """Crawl the ActiveNetwork class schedule page."""
    found = new = updated = 0

    logger.info("[spruill/classes] Fetching class schedule: %s", _CLASSES_URL)
    try:
        resp = session.get(_CLASSES_URL, headers=_HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("[spruill/classes] Failed to fetch class schedule: %s", exc)
        return 0, 0, 0

    soup = BeautifulSoup(resp.text, "html.parser")
    rows = soup.select("tr.awAltRow, tr.awRow")
    logger.info("[spruill/classes] Found %d class rows in schedule", len(rows))

    for row in rows:
        cols = row.find_all("td")
        if len(cols) < 3:
            continue

        raw_title = cols[0].get_text(strip=True)
        date_str = cols[1].get_text(strip=True) if len(cols) > 1 else ""
        meets_str = cols[2].get_text(strip=True) if len(cols) > 2 else ""

        # Skip internal/admin items
        if _is_internal(raw_title):
            continue

        # Note if closed but still include — the class is still on the calendar
        # and users may want to know about it for waitlisting or future sessions.
        # We'll flag closed classes with a price_note.
        is_closed = _is_closed(raw_title)
        title = _clean_title(raw_title)

        if not title or len(title) < 4:
            continue

        start_date = _parse_class_date(date_str)
        if not start_date:
            logger.debug(
                "[spruill/classes] Could not parse date %r for: %s",
                date_str,
                title[:50],
            )
            continue

        # Skip past events
        try:
            ev_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            continue
        if ev_date < today:
            continue

        start_time = _parse_meets_time(meets_str)

        # Course URL
        anchor = row.find("a")
        course_href = anchor["href"] if anchor and anchor.get("href") else ""
        course_code_prefix = _extract_course_code_prefix(course_href)

        # Build full URL
        source_url = (
            f"{_REG_BASE}/{course_href}"
            if course_href and not course_href.startswith("http")
            else course_href or _CLASSES_URL
        )

        # Category and tags
        category, tags = _infer_category_and_tags(
            course_code_prefix, title, default_category="learning"
        )

        # Age range
        age_min, age_max = _parse_age_range(title)
        if age_max is not None and age_max <= 17:
            if "kids" not in tags and age_max <= 12:
                tags.append("kids")
            if "teen" not in tags and age_max > 12:
                tags.append("teen")
            if "family-friendly" not in tags:
                tags.append("family-friendly")
        if age_min is not None and age_min >= 18 and "adults" not in tags:
            tags.append("adults")

        # Series hint — every class is a class series
        series_hint = {
            "series_type": "class_series",
            "series_title": title,
            "frequency": "weekly",
        }

        # Price: unknown unless we hit detail page. Most classes are paid.
        price_note = "Registration required; fees vary"
        if is_closed:
            price_note = "Closed — check for future sessions"

        content_hash = generate_content_hash(
            title,
            "Spruill Center for the Arts",
            f"{start_date}|{start_time or ''}",
        )

        record: dict = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title[:200],
            "description": None,
            "start_date": start_date,
            "end_date": None,
            "start_time": start_time,
            "end_time": None,
            "is_all_day": False,
            "category": category,
            "tags": tags,
            "is_free": False,
            "price_min": None,
            "price_max": None,
            "price_note": price_note,
            "source_url": source_url,
            "ticket_url": source_url,
            "image_url": None,
            "raw_text": f"{title} | {meets_str}",
            "extraction_confidence": 0.85,
            "is_recurring": True,
            "content_hash": content_hash,
        }

        if age_min is not None:
            record["age_min"] = age_min
        if age_max is not None:
            record["age_max"] = age_max

        found += 1

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, record)
            updated += 1
        else:
            try:
                insert_event(record, series_hint=series_hint)
                new += 1
                logger.debug(
                    "[spruill/classes] Added: %s on %s",
                    title[:50],
                    start_date,
                )
            except Exception as exc:
                logger.error(
                    "[spruill/classes] Failed to insert %r: %s",
                    title[:50],
                    exc,
                )

    return found, new, updated


# ---------------------------------------------------------------------------
# Special events crawler (MEC via WP v2 API + JSON-LD)
# ---------------------------------------------------------------------------


def _fetch_event_json_ld(session: requests.Session, event_url: str) -> Optional[dict]:
    """
    Fetch an event detail page and extract the JSON-LD Event block.

    Returns the parsed dict or None on failure.
    """
    try:
        resp = session.get(event_url, headers=_HEADERS, timeout=20)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.debug("[spruill/events] Failed to fetch %s: %s", event_url, exc)
        return None

    page_html = resp.text
    for match in re.finditer(
        r"<script[^>]*application/ld\+json[^>]*>(.*?)</script>",
        page_html,
        re.DOTALL,
    ):
        try:
            import json as _json

            data = _json.loads(match.group(1).strip())
            if isinstance(data, dict) and data.get("@type") == "Event":
                return data
        except (ValueError, KeyError):
            continue
    return None


def _parse_iso_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse an ISO 8601 datetime string with timezone offset to
    (YYYY-MM-DD, HH:MM) in Atlanta local time.

    MEC stores times in UTC in JSON-LD (e.g. "2026-03-18T06:30:00-04:00"
    for a 10:30 AM EDT event). We convert to local time by applying the
    offset: local = UTC_time + offset_hours  (offset is negative for EDT).

    Examples:
      "2026-04-18T07:00:00-04:00" → apply -4h: 07:00 + (-(-4)) = 11:00 AM
        → ("2026-04-18", "11:00")
      "2026-03-18T06:30:00-04:00" → 06:30 + 4 = 10:30 AM
        → ("2026-03-18", "10:30")
      "2026-04-18T00:00:00+00:00" → midnight UTC → treat as unknown time
        → ("2026-04-18", None)
    """
    if not dt_str:
        return None, None

    dt_str = dt_str.strip()

    # Extract TZ offset if present
    tz_match = re.search(r"([+-])(\d{2}):(\d{2})$", dt_str)
    tz_offset_minutes = 0
    if tz_match:
        sign = 1 if tz_match.group(1) == "+" else -1
        tz_offset_minutes = sign * (
            int(tz_match.group(2)) * 60 + int(tz_match.group(3))
        )

    dt_str_clean = re.sub(r"[+-]\d{2}:\d{2}$", "", dt_str)

    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            dt = datetime.strptime(dt_str_clean, fmt)
            break
        except ValueError:
            continue
    else:
        return None, None

    # Convert to local time by subtracting the UTC offset
    # (if offset is -04:00, local = UTC_naive - (-240min) = UTC_naive + 240min)
    from datetime import timedelta

    local_dt = dt - timedelta(minutes=tz_offset_minutes)

    date_part = local_dt.strftime("%Y-%m-%d")

    # Midnight local → treat as unknown time
    if local_dt.hour == 0 and local_dt.minute == 0:
        return date_part, None

    return date_part, local_dt.strftime("%H:%M")


def _crawl_special_events(
    session: requests.Session,
    source_id: int,
    venue_id: int,
    today: date,
) -> tuple[int, int, int]:
    """Crawl special events from the MEC WordPress calendar."""
    found = new = updated = 0

    logger.info("[spruill/events] Fetching MEC event list from WP v2 API")

    # Fetch all events (total is small — 12 as of March 2026)
    try:
        resp = session.get(
            _WP_API_URL,
            headers=_HEADERS,
            params={
                "per_page": 100,
                "_embed": "true",
                "_fields": "id,title,slug,link,content,excerpt,featured_media,_embedded",
            },
            timeout=30,
        )
        resp.raise_for_status()
        raw_events = resp.json()
    except (requests.RequestException, ValueError) as exc:
        logger.error("[spruill/events] WP v2 API failed: %s", exc)
        return 0, 0, 0

    logger.info("[spruill/events] %d events from WP v2 API", len(raw_events))

    for raw in raw_events:
        title_raw = raw.get("title", {}).get("rendered", "").strip()
        if not title_raw:
            continue

        title = html.unescape(title_raw)
        event_url = raw.get("link", "")

        if not event_url:
            continue

        # Skip internal/admin
        if _is_internal(title):
            continue

        # Fetch event page for JSON-LD (reliable dates)
        time.sleep(_REQUEST_DELAY)
        ld = _fetch_event_json_ld(session, event_url)

        if not ld:
            logger.debug("[spruill/events] No JSON-LD for: %s", title)
            continue

        start_date, start_time = _parse_iso_datetime(ld.get("startDate", ""))
        end_date, end_time = _parse_iso_datetime(ld.get("endDate", ""))

        if not start_date:
            logger.debug("[spruill/events] No valid date in JSON-LD for: %s", title)
            continue

        # Skip past events
        try:
            ev_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            continue
        if ev_date < today:
            continue

        # Same start/end date → don't store redundant end_date
        effective_end_date = end_date if end_date and end_date != start_date else None

        # Description from content
        description_html = raw.get("content", {}).get("rendered", "") or ""
        description = _strip_html(description_html, max_len=600)
        if not description:
            excerpt_html = raw.get("excerpt", {}).get("rendered", "") or ""
            description = _strip_html(excerpt_html, max_len=400)

        # Description from JSON-LD (often cleaner)
        if not description and ld.get("description"):
            description = ld["description"][:600]

        # Image: prefer embedded media, fall back to JSON-LD
        image_url: Optional[str] = None
        embedded = raw.get("_embedded", {})
        media_list = embedded.get("wp:featuredmedia", [])
        if media_list and isinstance(media_list[0], dict):
            image_url = media_list[0].get("source_url")
        if not image_url and ld.get("image"):
            image_url = ld["image"] if isinstance(ld["image"], str) else None

        # Price
        is_free = False
        price_min: Optional[float] = None
        price_max: Optional[float] = None
        offers = ld.get("offers")
        if isinstance(offers, dict):
            price_str = str(offers.get("price", ""))
            try:
                price_val = float(price_str)
                if price_val == 0.0:
                    is_free = True
                    price_min = price_max = 0.0
                else:
                    price_min = price_max = price_val
            except ValueError:
                pass

        # Category and tags
        category, tags = _infer_category_and_tags(
            "",  # no course code for special events
            title,
            default_category="art",
        )

        # Content kind for exhibitions
        content_kind: Optional[str] = None
        if re.search(
            r"\b(exhibit|exhibition|gallery|on view|residency)\b",
            f"{title} {description}",
            re.I,
        ):
            content_kind = "exhibit"

        content_hash = generate_content_hash(
            title,
            "Spruill Center for the Arts",
            f"{start_date}|{start_time or ''}",
        )

        record: dict = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title[:200],
            "description": description if description else None,
            "start_date": start_date,
            "end_date": effective_end_date,
            "start_time": start_time,
            "end_time": end_time,
            "is_all_day": start_time is None and content_kind == "exhibit",
            "category": category,
            "tags": tags,
            "is_free": is_free,
            "price_min": price_min,
            "price_max": price_max,
            "price_note": None,
            "source_url": event_url,
            "ticket_url": event_url,
            "image_url": image_url,
            "raw_text": f"{title} | spruill-center",
            "extraction_confidence": 0.92,
            "is_recurring": False,
            "content_hash": content_hash,
        }

        if content_kind:
            record["content_kind"] = content_kind

        found += 1

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, record)
            updated += 1
        else:
            try:
                insert_event(record)
                new += 1
                logger.info("[spruill/events] Added: %s on %s", title[:50], start_date)
            except Exception as exc:
                logger.error(
                    "[spruill/events] Failed to insert %r: %s", title[:50], exc
                )

    return found, new, updated


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Spruill Center for the Arts.

    Combines:
      - Class schedule from the ActiveNetwork registration system
        (600+ class sessions with dates, times, and course codes)
      - Special events from the MEC WordPress calendar
        (12–20 special events with JSON-LD structured dates)

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]

    try:
        venue_id = get_or_create_venue(VENUE_DATA)
    except Exception as exc:
        logger.error("[spruill] Failed to create/find venue: %s", exc)
        return 0, 0, 0

    today = date.today()
    http_session = requests.Session()

    total_found = total_new = total_updated = 0

    # --- Classes ---
    c_found, c_new, c_updated = _crawl_classes(http_session, source_id, venue_id, today)
    total_found += c_found
    total_new += c_new
    total_updated += c_updated
    logger.info(
        "[spruill/classes] Complete: %d found, %d new, %d updated",
        c_found,
        c_new,
        c_updated,
    )

    # --- Special events ---
    e_found, e_new, e_updated = _crawl_special_events(
        http_session, source_id, venue_id, today
    )
    total_found += e_found
    total_new += e_new
    total_updated += e_updated
    logger.info(
        "[spruill/events] Complete: %d found, %d new, %d updated",
        e_found,
        e_new,
        e_updated,
    )

    logger.info(
        "[spruill] Crawl complete: %d found, %d new, %d updated",
        total_found,
        total_new,
        total_updated,
    )

    return total_found, total_new, total_updated
