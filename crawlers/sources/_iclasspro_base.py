"""
Shared base for iClassPro class management platform crawlers.

iClassPro (app.iclasspro.com) powers many dance studios, gymnastics centers,
martial arts dojos, and swim schools. This module handles the open/public API
that requires no authentication.

PUBLIC API ENDPOINTS (no auth required):
  https://app.iclasspro.com/api/open/v1/{org_code}/classes
  https://app.iclasspro.com/api/open/v1/{org_code}/sessions
  https://app.iclasspro.com/api/open/v1/{org_code}/locations

API RESPONSE SHAPE (/classes):
  {
    "totalRecords": 57,
    "forceStartDate": false,
    "data": [
      {
        "id": 3497,
        "name": "Monday Kindergym ages 4 & 5 3:30 2025/26",
        "minAgeYear": 4, "minAgeMonth": null, "minAgeDays": null,
        "maxAgeYear": 5, "maxAgeMonth": null, "maxAgeDays": null,
        "schedule": [{"dayNumber": 2, "startTime": "3:30PM", "endTime": "4:10PM",
                      "dayName": "Mon", "timeStamp": 55800}],
        "instructors": ["Christine Miller"],
        "startDate": "2026-03-23",
        "endDate": "",
        "availableDates": ["2026-03-23"],
        "sessions": [{"id": "163"}]
      }, ...
    ]
  }

CRAWL STRATEGY:
  - Each class is a recurring weekly program (one session per available future date)
  - Classes with no future availableDates and no startDate are skipped
  - We generate one event per available future date (capped at WEEKS_AHEAD)
  - Age range is extracted from minAgeYear/maxAgeYear fields
  - We group class instances by class ID into series

REUSE PATTERN:
  from sources._iclasspro_base import IClassProConfig, crawl_iclasspro

  _CONFIG = IClassProConfig(
      org_code="buckheadgymnastics",
      venue_data={...},
      default_category="fitness",
      default_tags=["gymnastics", "kids", "class"],
  )

  def crawl(source: dict) -> tuple[int, int, int]:
      return crawl_iclasspro(source, _CONFIG)
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Callable, Optional

import requests

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

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "application/json",
}

# iClassPro open API base URL
_API_BASE = "https://app.iclasspro.com/api/open/v1"

# How many weeks of future class sessions to generate
WEEKS_AHEAD = 12

# Day number mapping (iClassPro uses 1=Sun, 2=Mon, ..., 7=Sat)
_DAY_NUMBER_TO_ISO: dict[int, int] = {
    1: 7,  # Sunday
    2: 1,  # Monday
    3: 2,  # Tuesday
    4: 3,  # Wednesday
    5: 4,  # Thursday
    6: 5,  # Friday
    7: 6,  # Saturday
}

# iClassPro day number → Python weekday (0=Mon, 6=Sun)
_DAY_NUMBER_TO_PYTHON: dict[int, int] = {
    1: 6,  # Sunday
    2: 0,  # Monday
    3: 1,  # Tuesday
    4: 2,  # Wednesday
    5: 3,  # Thursday
    6: 4,  # Friday
    7: 5,  # Saturday
}

_DAY_NAMES: dict[int, str] = {
    1: "Sunday",
    2: "Monday",
    3: "Tuesday",
    4: "Wednesday",
    5: "Thursday",
    6: "Friday",
    7: "Saturday",
}

# Polite delay between API requests
_REQUEST_DELAY = 0.5

# ---------------------------------------------------------------------------
# Age range helpers
# ---------------------------------------------------------------------------


def _age_to_months(years: Optional[int], months: Optional[int], days: Optional[int]) -> Optional[int]:
    """Convert iClassPro age components to total months (approximate)."""
    if years is None and months is None:
        return None
    total = 0
    if years is not None:
        total += years * 12
    if months is not None:
        total += months
    return total


def _parse_age_range(cls: dict) -> tuple[Optional[int], Optional[int]]:
    """Extract age_min / age_max in years from an iClassPro class record.

    iClassPro stores age as separate year/month/day fields. We extract
    the primary year value and fall back to deriving from months when
    the year component is missing (e.g., infant classes stored in months).
    """
    min_year = cls.get("minAgeYear")
    max_year = cls.get("maxAgeYear")

    # If both year fields are present and reasonable, use them directly.
    if min_year is not None and max_year is not None:
        # Clamp unreasonably large max age (e.g. 99 = "any adult") to None
        if max_year >= 18:
            max_year = None
        return min_year, max_year

    # If only one or neither year is present, try months
    min_month_total = _age_to_months(cls.get("minAgeYear"), cls.get("minAgeMonth"), cls.get("minAgeDays"))
    max_month_total = _age_to_months(cls.get("maxAgeYear"), cls.get("maxAgeMonth"), cls.get("maxAgeDays"))

    if min_month_total is not None:
        age_min = max(0, min_month_total // 12)
    else:
        age_min = None

    if max_month_total is not None:
        age_max = max_month_total // 12
        if age_max >= 18:
            age_max = None
    else:
        age_max = None

    return age_min, age_max


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    """Return age-band tags that overlap with [age_min, age_max]."""
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


def _parse_time_str(raw: str) -> Optional[str]:
    """Parse iClassPro time string (e.g. '3:30PM') to 'HH:MM' 24h format."""
    if not raw:
        return None
    for fmt in ("%I:%M%p", "%I:%M %p", "%H:%M"):
        try:
            return datetime.strptime(raw.strip().upper(), fmt.upper()).strftime("%H:%M")
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Future date generation
# ---------------------------------------------------------------------------


def _next_occurrence(day_number: int, from_date: date) -> date:
    """Return the next occurrence of a given iClassPro day_number on or after from_date.

    iClassPro day_number: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
    Python weekday:        6=Sun, 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat
    """
    target_weekday = _DAY_NUMBER_TO_PYTHON.get(day_number)
    if target_weekday is None:
        return from_date
    days_ahead = (target_weekday - from_date.weekday()) % 7
    return from_date + timedelta(days=days_ahead)


def _generate_session_dates(
    schedule_items: list[dict],
    start_date_str: Optional[str],
    end_date_str: Optional[str],
    available_dates: list[str],
    weeks_ahead: int,
) -> list[tuple[date, dict]]:
    """Generate (occurrence_date, schedule_item) pairs for future sessions.

    Returns at most one occurrence per week per schedule item, up to weeks_ahead
    weeks from today.
    """
    today = date.today()
    cutoff = today + timedelta(weeks=weeks_ahead)

    # Parse session boundaries
    session_start: date = today
    if start_date_str:
        try:
            session_start = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        except ValueError:
            pass

    session_end: Optional[date] = None
    if end_date_str:
        try:
            session_end = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            pass

    # If the API provides explicit available_dates, use those (already filtered
    # by the API to upcoming slots)
    if available_dates:
        results = []
        for date_str in available_dates:
            try:
                d = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                continue
            if d < today or d > cutoff:
                continue
            if session_end and d > session_end:
                continue
            # Match this date to the right schedule item by day-of-week
            for sched in schedule_items:
                python_wd = _DAY_NUMBER_TO_PYTHON.get(sched.get("dayNumber", 0))
                if python_wd is not None and d.weekday() == python_wd:
                    results.append((d, sched))
                    break
            else:
                # No match — still include with first schedule item
                if schedule_items:
                    results.append((d, schedule_items[0]))
        return results

    # Otherwise generate dates from today up to cutoff
    results = []
    from_date = max(today, session_start)
    for sched in schedule_items:
        day_number = sched.get("dayNumber")
        if day_number is None:
            continue
        occurrence = _next_occurrence(day_number, from_date)
        while occurrence <= cutoff:
            if session_end and occurrence > session_end:
                break
            results.append((occurrence, sched))
            occurrence += timedelta(weeks=1)
    return results


# ---------------------------------------------------------------------------
# Class name normalisation
# ---------------------------------------------------------------------------


_SESSION_YEAR_RE = re.compile(r"\s+\d{4}/\d{2,4}|\s+\d{4}-\d{2,4}|\s+\d{4}$", re.IGNORECASE)
_CLASS_CODE_RE = re.compile(
    r"\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}:\d{2}\s*(?:AM|PM)?\b",
    re.IGNORECASE,
)


def _normalise_class_name(raw: str) -> str:
    """Strip session year and embedded day/time from class name.

    Examples:
      'Monday Kindergym ages 4 & 5 3:30 2025/26' → 'Kindergym ages 4 & 5'
      'Tuesday Level 1 Hip Hop 4:30PM 2025/2026' → 'Level 1 Hip Hop'
      'Saturday Preschool Ballet 10:00 AM'       → 'Preschool Ballet'
    """
    # Remove leading day-of-week
    t = re.sub(
        r"^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+",
        "",
        raw.strip(),
        flags=re.IGNORECASE,
    )
    # Remove trailing session year like "2025/26" or "2025/2026"
    t = _SESSION_YEAR_RE.sub("", t).strip()
    # Remove embedded "Mon 3:30PM" style tokens
    t = _CLASS_CODE_RE.sub("", t).strip()
    # Remove trailing standalone times like "3:30" or "10:00"
    t = re.sub(r"\s+\d{1,2}:\d{2}$", "", t).strip()
    return t or raw.strip()


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _api_get(url: str, *, retries: int = 3) -> Optional[dict]:
    """GET an iClassPro open API endpoint, returning parsed JSON or None."""
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=_HEADERS, timeout=20)
            if resp.status_code == 404:
                logger.debug("iClassPro 404: %s", url)
                return None
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            if attempt >= retries:
                logger.error("iClassPro GET %s failed after %d attempts: %s", url, retries, exc)
                return None
            time.sleep(1.5 * attempt)
        except ValueError as exc:
            logger.error("iClassPro JSON parse error at %s: %s", url, exc)
            return None
    return None


# ---------------------------------------------------------------------------
# Config dataclass
# ---------------------------------------------------------------------------


@dataclass
class IClassProConfig:
    """Configuration for one iClassPro-powered studio."""

    # iClassPro org code (slug in the portal URL)
    org_code: str

    # Venue data passed to get_or_create_venue()
    venue_data: dict

    # Default LostCity category for all classes
    default_category: str = "fitness"

    # Tags always applied to every event from this source
    default_tags: list[str] = field(default_factory=list)

    # How many weeks of future sessions to generate per class
    weeks_ahead: int = WEEKS_AHEAD

    # Optional source-specific record mutator
    record_transform: Optional[Callable[[dict, dict], dict]] = None

    @property
    def classes_url(self) -> str:
        return f"{_API_BASE}/{self.org_code}/classes"

    @property
    def portal_url(self) -> str:
        return f"https://portal.iclasspro.com/{self.org_code}/classes"


# ---------------------------------------------------------------------------
# Event record builder
# ---------------------------------------------------------------------------


def _build_event_record(
    cls: dict,
    occurrence_date: date,
    sched_item: dict,
    source_id: int,
    venue_id: int,
    venue_name: str,
    config: IClassProConfig,
) -> Optional[dict]:
    """Build one LostCity event record for a single class occurrence."""
    raw_name = cls.get("name", "").strip()
    if not raw_name:
        return None

    title = _normalise_class_name(raw_name)
    if not title:
        return None

    # Date / time
    start_date_str = occurrence_date.strftime("%Y-%m-%d")
    start_time_raw = sched_item.get("startTime", "")
    end_time_raw = sched_item.get("endTime", "")
    start_time = _parse_time_str(start_time_raw)
    end_time = _parse_time_str(end_time_raw)

    # Age range
    age_min, age_max = _parse_age_range(cls)

    # Tags
    tags: list[str] = list(config.default_tags)
    age_tags = _age_band_tags(age_min, age_max)
    for t in age_tags:
        if t not in tags:
            tags.append(t)
    if "kids" not in tags and (age_max is None or age_max <= 17):
        tags.append("kids")
    if "family-friendly" not in tags:
        tags.append("family-friendly")
    if "class" not in tags:
        tags.append("class")

    # Instructor description
    instructors = cls.get("instructors") or []
    description_parts = []
    if instructors:
        description_parts.append(f"Instructor: {', '.join(instructors)}")
    if age_min is not None or age_max is not None:
        if age_min is not None and age_max is not None:
            description_parts.append(f"Ages {age_min}–{age_max}")
        elif age_min is not None:
            description_parts.append(f"Ages {age_min}+")
    day_name = sched_item.get("dayName", "")
    if day_name and start_time_raw and end_time_raw:
        description_parts.append(f"Every {day_name}: {start_time_raw}–{end_time_raw}")

    description = ". ".join(description_parts) if description_parts else None

    # Source URL (link to the portal enrollment page)
    source_url = config.portal_url

    # Content hash: title + venue + date + time (to dedup per session slot)
    hash_key = start_date_str
    if start_time:
        hash_key = f"{start_date_str}|{start_time}"
    content_hash = generate_content_hash(title, venue_name, hash_key)

    # Series hint: each distinct class is a weekly series
    class_id = cls.get("id")
    series_hint = {
        "series_type": "class_series",
        "series_title": title,
        "frequency": "weekly",
        "day_of_week": day_name.lower() if day_name else None,
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
        "price_min": None,
        "price_max": None,
        "price_note": "Monthly tuition — see studio for rates",
        "source_url": source_url,
        "ticket_url": source_url,
        "image_url": None,
        "raw_text": raw_name,
        "extraction_confidence": 0.88,
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
                "[iclasspro/%s] record_transform failed for %r: %s",
                config.org_code,
                title,
                exc,
            )

    return record, series_hint


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl_iclasspro(source: dict, config: IClassProConfig) -> tuple[int, int, int]:
    """
    Crawl one iClassPro studio and persist class sessions as events.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Ensure venue exists
    try:
        venue_id = get_or_create_venue(config.venue_data)
    except Exception as exc:
        logger.error(
            "[iclasspro/%s] Failed to create/find venue: %s",
            config.org_code,
            exc,
        )
        return 0, 0, 0

    venue_name = config.venue_data["name"]
    logger.info("[iclasspro/%s] Starting crawl", config.org_code)

    # Fetch classes from iClassPro open API
    data = _api_get(config.classes_url)
    if data is None:
        logger.warning("[iclasspro/%s] Failed to fetch classes", config.org_code)
        return 0, 0, 0

    classes = data.get("data", [])
    total = data.get("totalRecords", len(classes))
    logger.info("[iclasspro/%s] %d classes from API", config.org_code, total)

    for cls in classes:
        schedule_items = cls.get("schedule") or []
        if not schedule_items:
            logger.debug("[iclasspro/%s] Skipping %r — no schedule", config.org_code, cls.get("name"))
            continue

        start_date_str = cls.get("startDate") or ""
        end_date_str = cls.get("endDate") or ""
        available_dates = cls.get("availableDates") or []

        # Generate future occurrence dates for this class
        occurrences = _generate_session_dates(
            schedule_items,
            start_date_str or None,
            end_date_str or None,
            available_dates,
            config.weeks_ahead,
        )

        if not occurrences:
            logger.debug(
                "[iclasspro/%s] Skipping %r — no future occurrences",
                config.org_code,
                cls.get("name"),
            )
            continue

        # Emit one event per occurrence
        for occurrence_date, sched_item in occurrences:
            result = _build_event_record(
                cls, occurrence_date, sched_item,
                source_id, venue_id, venue_name, config,
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
                        "[iclasspro/%s] Added: %s on %s",
                        config.org_code,
                        record["title"],
                        record["start_date"],
                    )
                except Exception as exc:
                    logger.error(
                        "[iclasspro/%s] Failed to insert %r on %s: %s",
                        config.org_code,
                        record["title"],
                        record["start_date"],
                        exc,
                    )

        time.sleep(_REQUEST_DELAY)

    logger.info(
        "[iclasspro/%s] Crawl complete: %d found, %d new, %d updated",
        config.org_code,
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
