"""
Shared base for JackRabbit class management platform crawlers.

JackRabbit (jackrabbitclass.com) powers many gymnastics academies,
martial arts studios, and dance schools. The only publicly accessible
endpoint (no login required) is the OpeningsJS widget endpoint.

PUBLIC ENDPOINT:
  https://app.jackrabbitclass.com/jr3.0/Openings/OpeningsJS?OrgID={org_id}
  (returns a document.write() JS string containing an HTML table)

TABLE COLUMNS (order may vary but headers are always present):
  Register | Class | Description | Days | Times | Gender | Ages |
  Openings | Class Starts | Class Ends | Session | Tuition

WHAT WE GET:
  - Class name (encoded program level / time slot)
  - Day of week and time window
  - Age range (e.g. "3 yrs - 4 yrs", "2 yrs 6 mos & up")
  - Session start/end dates
  - Tuition (monthly)
  - Description (free text, often empty)

WHAT WE DO NOT GET:
  - Per-session occurrence dates (we generate them from day-of-week + session window)
  - Instructor names
  - Class IDs for deep links (enrollment redirects to the parent portal)

REUSE PATTERN:
  from sources._jackrabbit_base import JackRabbitConfig, crawl_jackrabbit

  _CONFIG = JackRabbitConfig(
      org_id="509235",
      place_data={...},
      default_category="fitness",
      default_tags=["gymnastics", "kids", "class"],
      enrollment_url="https://app.jackrabbitclass.com/regv2.asp?id=509235",
  )

  def crawl(source: dict) -> tuple[int, int, int]:
      return crawl_jackrabbit(source, _CONFIG)
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Callable, Optional

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

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "*/*",
}

_JR_BASE = "https://app.jackrabbitclass.com/jr3.0"

# How many weeks of future sessions to generate per class
WEEKS_AHEAD = 12

# Polite delay between requests
_REQUEST_DELAY = 0.8

# Day-of-week name → Python weekday (0=Mon, 6=Sun)
_DAY_ABBREV_TO_PYTHON: dict[str, int] = {
    "mon": 0,
    "tue": 1,
    "wed": 2,
    "thu": 3,
    "fri": 4,
    "sat": 5,
    "sun": 6,
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

# ---------------------------------------------------------------------------
# Age range parsing
# ---------------------------------------------------------------------------

# Patterns for JackRabbit age strings like:
#   "3 yrs - 4 yrs"           → 3–4
#   "2 yrs 6 mos & up"        → 2+
#   "1 yr 3 mos - 2 yrs 6 mos" → 1–2
#   "5 yrs+"                  → 5+
#   "18 mos - 3 yrs"          → 0–3 (under 1)

_AGE_RANGE_RE = re.compile(
    r"(\d+)\s*(?:yr|year)s?\s*(?:(\d+)\s*mos?)?\s*[-–]\s*(\d+)\s*(?:yr|year)s?",
    re.IGNORECASE,
)
_AGE_MIN_RE = re.compile(
    r"(\d+)\s*(?:yr|year)s?\s*(?:\d+\s*mos?)?\s*(?:&\s*up|\+|and\s+up|or\s+older)",
    re.IGNORECASE,
)
_MONTHS_RANGE_RE = re.compile(
    r"(\d+)\s*mos?\s*[-–]\s*(\d+)\s*(?:yr|year)s?",
    re.IGNORECASE,
)


def _parse_age_range(age_str: str) -> tuple[Optional[int], Optional[int]]:
    """Parse a JackRabbit age string into (age_min_years, age_max_years).

    Returns (None, None) when the string is blank or unparseable.
    """
    if not age_str or not age_str.strip():
        return None, None

    s = age_str.strip()

    # "X yrs - Y yrs" (range)
    m = _AGE_RANGE_RE.search(s)
    if m:
        age_min = int(m.group(1))
        age_max = int(m.group(3))
        # Cap adult max
        if age_max >= 18:
            age_max = None
        return age_min, age_max

    # "X yrs & up" / "X+" (minimum only)
    m = _AGE_MIN_RE.search(s)
    if m:
        age_min = int(m.group(1))
        return age_min, None

    # "X mos - Y yrs" (infant/toddler class)
    m = _MONTHS_RANGE_RE.search(s)
    if m:
        # months → years (rough)
        age_min = 0  # less than 1 year
        age_max = int(m.group(2))
        if age_max >= 18:
            age_max = None
        return age_min, age_max

    return None, None


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    """Return age-band tags overlapping [age_min, age_max]."""
    bands = [
        (0, 1, "infant"),
        (1, 3, "toddler"),
        (3, 5, "preschool"),
        (5, 12, "elementary"),
        (10, 13, "tween"),
        (13, 18, "teen"),
    ]
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 100
    return [tag for (band_lo, band_hi, tag) in bands if lo <= band_hi and hi >= band_lo]


# ---------------------------------------------------------------------------
# Time parsing
# ---------------------------------------------------------------------------


def _parse_time_range(times_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse '11:45am - 12:15pm' into ('11:45', '12:15') in 24h format."""
    if not times_str:
        return None, None

    parts = re.split(r"\s*[-–]\s*", times_str.strip())
    if len(parts) < 2:
        return None, None

    def to_24h(t: str) -> Optional[str]:
        t = t.strip().upper().replace(" ", "")
        for fmt in ("%I:%M%p", "%I%p"):
            try:
                return datetime.strptime(t, fmt).strftime("%H:%M")
            except ValueError:
                continue
        return None

    return to_24h(parts[0]), to_24h(parts[1])


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------


def _parse_date(raw: str) -> Optional[date]:
    """Parse MM/DD/YYYY into a date, return None if invalid."""
    if not raw or not raw.strip():
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Day-of-week → future date generation
# ---------------------------------------------------------------------------


def _next_occurrence_on_or_after(python_weekday: int, from_date: date) -> date:
    """Return the next date with the given Python weekday on or after from_date."""
    days_ahead = (python_weekday - from_date.weekday()) % 7
    return from_date + timedelta(days=days_ahead)


def _generate_session_dates(
    python_weekday: int,
    session_start: Optional[date],
    session_end: Optional[date],
    weeks_ahead: int,
) -> list[date]:
    """Generate weekly occurrence dates within the session window, up to weeks_ahead."""
    today = date.today()
    from_date = max(today, session_start or today)
    cutoff = min(
        today + timedelta(weeks=weeks_ahead),
        session_end or (today + timedelta(weeks=weeks_ahead)),
    )

    dates = []
    occurrence = _next_occurrence_on_or_after(python_weekday, from_date)
    while occurrence <= cutoff:
        dates.append(occurrence)
        occurrence += timedelta(weeks=1)
    return dates


# ---------------------------------------------------------------------------
# HTML parsing
# ---------------------------------------------------------------------------


def _fetch_and_parse_openings(org_id: str) -> list[dict]:
    """Fetch JackRabbit OpeningsJS and return a list of class dicts."""
    url = f"{_JR_BASE}/Openings/OpeningsJS?OrgID={org_id}"
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=20)
        resp.raise_for_status()
        content = resp.text
    except requests.RequestException as exc:
        logger.error("[jackrabbit/%s] Failed to fetch OpeningsJS: %s", org_id, exc)
        return []

    # Extract the HTML from the document.write() call
    parts = re.findall(r"document\.write\('(.*?)'\)", content, re.DOTALL)
    if parts:
        raw_html = parts[0].replace("\\'", "'").replace("\\\\", "\\")
    else:
        # Fallback: treat the whole response as HTML
        raw_html = content

    soup = BeautifulSoup(raw_html, "html.parser")
    table = soup.find("table")
    if not table:
        logger.warning("[jackrabbit/%s] No table in OpeningsJS response", org_id)
        return []

    # Extract column headers
    thead = table.find("thead")
    header_row = thead.find("tr") if thead else None
    if header_row:
        headers = [th.get_text(strip=True).lower() for th in header_row.find_all(["th", "td"])]
    else:
        headers = ["register", "class", "description", "days", "times", "gender",
                   "ages", "openings", "class starts", "class ends", "session", "tuition"]

    # Build column index map
    col = {h: i for i, h in enumerate(headers)}

    # Parse data rows
    tbody = table.find("tbody")
    rows = tbody.find_all("tr") if tbody else table.find_all("tr")[1:]

    classes = []
    for row in rows:
        cells = row.find_all(["td", "th"])
        if not cells:
            continue

        def cell(key: str, fallback: str = "") -> str:
            idx = col.get(key)
            if idx is None or idx >= len(cells):
                return fallback
            # Also try data-title attribute fallback
            for c in cells:
                dt = c.get("data-title", "").lower()
                if dt == key:
                    return c.get_text(strip=True)
            return cells[idx].get_text(strip=True) if idx < len(cells) else fallback

        classes.append({
            "name": cell("class"),
            "description": cell("description"),
            "days": cell("days"),
            "times": cell("times"),
            "gender": cell("gender"),
            "ages": cell("ages"),
            "openings": cell("openings"),
            "start_date": cell("class starts"),
            "end_date": cell("class ends"),
            "session": cell("session"),
            "tuition": cell("tuition"),
        })

    return classes


# ---------------------------------------------------------------------------
# Config dataclass
# ---------------------------------------------------------------------------


@dataclass
class JackRabbitConfig:
    """Configuration for one JackRabbit-powered studio."""

    # JackRabbit organization ID (numeric string)
    org_id: str

    # Venue data passed to get_or_create_place()
    place_data: dict

    # Default LostCity category for all classes
    default_category: str = "fitness"

    # Tags always applied to every event from this source
    default_tags: list[str] = field(default_factory=list)

    # How many weeks of future sessions to generate per class
    weeks_ahead: int = WEEKS_AHEAD

    # Direct enrollment/registration URL (usually regv2.asp?id=ORG_ID)
    enrollment_url: Optional[str] = None

    # Optional source-specific record mutator
    record_transform: Optional[Callable[[dict, dict], dict]] = None

    @property
    def openings_url(self) -> str:
        return f"{_JR_BASE}/Openings/OpeningsJS?OrgID={self.org_id}"

    @property
    def default_enrollment_url(self) -> str:
        return self.enrollment_url or f"https://app.jackrabbitclass.com/regv2.asp?id={self.org_id}"


# ---------------------------------------------------------------------------
# Event record builder
# ---------------------------------------------------------------------------


def _build_event_record(
    cls: dict,
    occurrence_date: date,
    source_id: int,
    venue_id: int,
    venue_name: str,
    config: JackRabbitConfig,
) -> Optional[tuple[dict, dict]]:
    """Build one LostCity event record for a single class occurrence."""
    raw_name = cls.get("name", "").strip()
    if not raw_name:
        return None

    # Strip leading day-of-week and trailing session codes from name
    title = re.sub(
        r"^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+",
        "",
        raw_name,
        flags=re.IGNORECASE,
    ).strip()
    # Strip " - Mon 4:30" style day/time suffixes embedded in class name
    title = re.sub(r"\s*-\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d+:\d+", "", title, flags=re.IGNORECASE).strip()
    if not title:
        return None

    # Date / time
    start_date_str = occurrence_date.strftime("%Y-%m-%d")
    times_str = cls.get("times", "")
    start_time, end_time = _parse_time_range(times_str)

    # Age range
    ages_str = cls.get("ages", "")
    age_min, age_max = _parse_age_range(ages_str)

    # Tags
    tags: list[str] = list(config.default_tags)
    for t in _age_band_tags(age_min, age_max):
        if t not in tags:
            tags.append(t)
    if "kids" not in tags and (age_max is None or age_max <= 17):
        tags.append("kids")
    if "family-friendly" not in tags:
        tags.append("family-friendly")
    if "class" not in tags:
        tags.append("class")

    # Description
    desc_parts = []
    description_raw = cls.get("description", "").strip()
    if description_raw:
        desc_parts.append(description_raw)
    if ages_str:
        desc_parts.append(f"Ages: {ages_str}")
    day_str = cls.get("days", "")
    if day_str and times_str:
        desc_parts.append(f"Every {day_str}: {times_str}")
    tuition = cls.get("tuition", "").strip()
    if tuition:
        desc_parts.append(f"Tuition: ${tuition}/month")

    description = ". ".join(desc_parts) if desc_parts else None

    # Price
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    if tuition:
        m = re.search(r"[\d,]+\.?\d*", tuition.replace(",", ""))
        if m:
            try:
                price_val = float(m.group())
                price_min = price_val
                price_max = price_val
            except ValueError:
                pass

    # Source URL
    source_url = config.default_enrollment_url

    # Content hash
    hash_key = f"{start_date_str}|{start_time}" if start_time else start_date_str
    content_hash = generate_content_hash(title, venue_name, hash_key)

    # Series hint
    series_hint = {
        "series_type": "class_series",
        "series_title": title,
        "frequency": "weekly",
        "day_of_week": day_str.lower() if day_str else None,
    }

    record: dict = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date_str,
        "end_date": None,
        "start_time": start_time,
        "end_time": end_time,
        "is_all_day": False,
        "category": config.default_category,
        "tags": tags,
        "is_free": False,
        "price_min": price_min,
        "price_max": price_max,
        "price_note": "Monthly tuition" if tuition else None,
        "source_url": source_url,
        "ticket_url": source_url,
        "image_url": None,
        "raw_text": raw_name,
        "extraction_confidence": 0.85,
        "is_recurring": True,
        "content_hash": content_hash,
    }

    if age_min is not None:
        record["age_min"] = age_min
    if age_max is not None:
        record["age_max"] = age_max

    if config.record_transform:
        try:
            transformed = config.record_transform(cls, dict(record))
            if transformed:
                record = transformed
        except Exception as exc:
            logger.warning(
                "[jackrabbit/%s] record_transform failed for %r: %s",
                config.org_id,
                title,
                exc,
            )

    return record, series_hint


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl_jackrabbit(source: dict, config: JackRabbitConfig) -> tuple[int, int, int]:
    """
    Crawl one JackRabbit studio and persist class sessions as events.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Ensure venue exists
    try:
        venue_id = get_or_create_place(config.place_data)
    except Exception as exc:
        logger.error(
            "[jackrabbit/%s] Failed to create/find venue: %s",
            config.org_id,
            exc,
        )
        return 0, 0, 0

    venue_name = config.place_data["name"]
    logger.info("[jackrabbit/%s] Starting crawl", config.org_id)

    # Fetch and parse the OpeningsJS endpoint
    classes = _fetch_and_parse_openings(config.org_id)
    if not classes:
        logger.warning("[jackrabbit/%s] No classes found", config.org_id)
        return 0, 0, 0

    logger.info("[jackrabbit/%s] %d class rows from OpeningsJS", config.org_id, len(classes))

    today = date.today()

    for cls in classes:
        # Skip classes with no useful data
        raw_name = cls.get("name", "").strip()
        if not raw_name:
            continue

        days_str = cls.get("days", "").strip()
        python_weekday = _DAY_ABBREV_TO_PYTHON.get(days_str.lower())
        if python_weekday is None:
            logger.debug(
                "[jackrabbit/%s] Cannot map day %r for %r — skipping",
                config.org_id,
                days_str,
                raw_name,
            )
            continue

        # Session dates
        session_start = _parse_date(cls.get("start_date", ""))
        session_end = _parse_date(cls.get("end_date", ""))

        # Skip if session ended in the past
        if session_end and session_end < today:
            continue

        # Generate future occurrence dates
        occurrences = _generate_session_dates(
            python_weekday, session_start, session_end, config.weeks_ahead
        )
        if not occurrences:
            logger.debug(
                "[jackrabbit/%s] Skipping %r — no future occurrences",
                config.org_id,
                raw_name,
            )
            continue

        for occurrence_date in occurrences:
            result = _build_event_record(
                cls, occurrence_date, source_id, venue_id, venue_name, config
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
                        "[jackrabbit/%s] Added: %s on %s",
                        config.org_id,
                        record["title"],
                        record["start_date"],
                    )
                except Exception as exc:
                    logger.error(
                        "[jackrabbit/%s] Failed to insert %r on %s: %s",
                        config.org_id,
                        record["title"],
                        record["start_date"],
                        exc,
                    )

        time.sleep(_REQUEST_DELAY)

    logger.info(
        "[jackrabbit/%s] Crawl complete: %d found, %d new, %d updated",
        config.org_id,
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
