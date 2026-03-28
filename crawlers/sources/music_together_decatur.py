"""
Crawler for Music Together of Decatur (musictogetherofdecatur.com).

Music Together of Decatur runs group music classes for babies, toddlers, and
preschoolers (ages 0-4) at multiple Decatur-area locations, plus a specialist
Baby Music Class for newborns through 7 months. Classes are semester-based
(8 weeks) with a structured schedule published on their MainStreetSites
ASP.NET portal at /classes.aspx.

CRAWL STRATEGY:
  1. Fetch the current semester's class table from the public classes page.
     The `?sem=XXXXX` parameter identifies the active semester — we detect
     it by following the "Spring 2026!" link on the site homepage.
  2. Parse the HTML table (id=ctl04_ctl00_phClassesClassTable) which exposes:
       Class, Day, Time, Date (session start), Location, Duration, Teacher, Register
  3. Emit one event per class row, anchored to the session START date.
     We do not generate weekly occurrences — each semester is one enrollment
     window. One event per class slot is the right granularity for discovery.
  4. Skip classes that are Full (no seats available, waitlist only).

AGE RANGES:
  - "Baby Music Class (Newborns - 7 months)" → age_min=0, age_max=0 (infant)
  - "Music Together of Decatur Class (Ages 0–4)" → age_min=0, age_max=4
  - "Music Together with Seniors" → skipped (not family programming)

LOCATIONS (as of Spring 2026):
  - Decatur: FBC → First Baptist Church Decatur, 308 Clairemont Ave, Decatur GA 30030
  - Decatur: Glenn Memorial → Glenn Memorial Church School, 1660 N Decatur Rd, Atlanta GA 30322
  - Retreat at Decatur → The Retreat at Decatur, 2711 Lawrenceville Hwy, Decatur GA 30033
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, date, timedelta
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

_BASE_URL = "https://musictogetherofdecatur.com"
_CLASSES_URL = f"{_BASE_URL}/classes.aspx"
_WEBSITE_URL = "https://www.musictogetherofdecatur.com"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
}

_REQUEST_TIMEOUT = 20

# Location slug → venue data mapping
# These are the physical classroom locations Music Together of Decatur uses.
# "Decatur: FBC" = First Baptist Church Decatur (primary location)
_LOCATION_MAP: dict[str, dict] = {
    "decatur: fbc": {
        "name": "Music Together of Decatur",
        "slug": "music-together-of-decatur",
        "address": "308 Clairemont Ave",
        "neighborhood": "Downtown Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7790,
        "lng": -84.2979,
        "venue_type": "community_center",
        "website": _WEBSITE_URL,
        "vibes": ["family-friendly", "kids", "educational"],
    },
    "retreat at decatur": {
        "name": "Music Together of Decatur at The Retreat",
        "slug": "music-together-decatur-retreat",
        "address": "2711 Lawrenceville Hwy",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "lat": 33.8233,
        "lng": -84.2592,
        "venue_type": "community_center",
        "website": _WEBSITE_URL,
        "vibes": ["family-friendly", "kids", "educational"],
    },
    "glenn memorial": {
        "name": "Music Together of Decatur at Glenn Memorial",
        "slug": "music-together-decatur-glenn-memorial",
        "address": "1660 N Decatur Rd",
        "neighborhood": "Emory",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7888,
        "lng": -84.3234,
        "venue_type": "community_center",
        "website": _WEBSITE_URL,
        "vibes": ["family-friendly", "kids", "educational"],
    },
}

# Default venue data when location can't be mapped (falls back to FBC)
_DEFAULT_VENUE: dict = _LOCATION_MAP["decatur: fbc"]


# ---------------------------------------------------------------------------
# Age range extraction
# ---------------------------------------------------------------------------


def _parse_class_age(class_name: str) -> tuple[Optional[int], Optional[int]]:
    """Extract age_min/age_max from class name.

    Handles:
      "Baby Music Class (Newborns - 7 months)"  → (0, 0)
      "Music Together of Decatur Class (Ages 0–4)" → (0, 4)
      "Music Together with Seniors"              → (None, None) — skip
    """
    name_lower = class_name.lower()
    if "senior" in name_lower or "generation" in name_lower:
        return None, None  # not family programming

    if "newborn" in name_lower or "baby music" in name_lower:
        return 0, 0  # infant-only class

    # "Ages 0–4" or "Ages 0-4"
    m = re.search(r"ages?\s+(\d+)\s*[–-]\s*(\d+)", name_lower)
    if m:
        return int(m.group(1)), int(m.group(2))

    # Generic Music Together class — 0-4 is the standard age range
    if "music together" in name_lower:
        return 0, 4

    return None, None


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    """Return age-band tags overlapping [age_min, age_max]."""
    bands = [
        (0, 0, "infant"),
        (1, 3, "toddler"),
        (3, 5, "preschool"),
    ]
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 100
    return [tag for (band_lo, band_hi, tag) in bands if lo <= band_hi and hi >= band_lo]


# ---------------------------------------------------------------------------
# Venue resolution
# ---------------------------------------------------------------------------


def _get_venue_data(location_cell: str) -> dict:
    """Map a location cell string to venue data."""
    loc_lower = location_cell.lower().strip()
    for key, vdata in _LOCATION_MAP.items():
        if key in loc_lower:
            return vdata
    # Fallback
    if "retreat" in loc_lower:
        return _LOCATION_MAP["retreat at decatur"]
    if "glenn" in loc_lower:
        return _LOCATION_MAP["glenn memorial"]
    return _DEFAULT_VENUE


# ---------------------------------------------------------------------------
# Semester detection
# ---------------------------------------------------------------------------


def _detect_active_sem(session: requests.Session) -> Optional[str]:
    """Detect the active semester ID from the homepage links."""
    try:
        resp = session.get(_WEBSITE_URL, timeout=_REQUEST_TIMEOUT)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        # Look for links like classes.aspx?sem=52335
        for a in soup.find_all("a", href=True):
            m = re.search(r"classes\.aspx\?sem=(\d+)", a["href"], re.IGNORECASE)
            if m:
                return m.group(1)
    except Exception as exc:
        logger.warning("[mt-decatur] Could not detect active semester: %s", exc)
    return None


# ---------------------------------------------------------------------------
# HTML table parsing
# ---------------------------------------------------------------------------


def _parse_date(raw: str) -> Optional[str]:
    """Parse MM/DD/YY or MM/DD/YYYY date string to YYYY-MM-DD."""
    if not raw:
        return None
    for fmt in ("%m/%d/%y", "%m/%d/%Y"):
        try:
            return datetime.strptime(raw.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_time(raw: str) -> Optional[str]:
    """Parse '10:00 AM' to '10:00' (24h)."""
    if not raw:
        return None
    raw = raw.strip().upper().replace(" ", "")
    for fmt in ("%I:%M%p", "%I%p"):
        try:
            return datetime.strptime(raw, fmt).strftime("%H:%M")
        except ValueError:
            continue
    return None


def _parse_duration_weeks(duration_str: str) -> Optional[int]:
    """Parse '8 weeks' → 8."""
    m = re.search(r"(\d+)\s*weeks?", duration_str, re.IGNORECASE)
    return int(m.group(1)) if m else None


def _compute_end_date(start_date: str, weeks: Optional[int]) -> Optional[str]:
    """Compute end date as start + (weeks - 1) * 7 days."""
    if not start_date or not weeks:
        return None
    try:
        dt = datetime.strptime(start_date, "%Y-%m-%d")
        end = dt + timedelta(weeks=weeks - 1)
        return end.strftime("%Y-%m-%d")
    except ValueError:
        return None


def _fetch_class_table(
    session: requests.Session, sem_id: Optional[str]
) -> list[list[str]]:
    """Fetch and parse the class schedule table from the classes page."""
    url = _CLASSES_URL
    if sem_id:
        url = f"{_CLASSES_URL}?sem={sem_id}"

    try:
        resp = session.get(url, timeout=_REQUEST_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("[mt-decatur] Failed to fetch classes page: %s", exc)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    tab = soup.find(id="ctl04_ctl00_phClassesClassTable")
    if not tab:
        logger.warning(
            "[mt-decatur] Could not find class table (id=ctl04_ctl00_phClassesClassTable)"
        )
        return []

    rows = []
    for tr in tab.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        if len(cells) >= 4 and cells[0] not in ("Class", ""):
            rows.append(cells)

    logger.info("[mt-decatur] Parsed %d class rows from table", len(rows))
    return rows


# ---------------------------------------------------------------------------
# Event record builder
# ---------------------------------------------------------------------------


def _build_event_record(
    row: list[str],
    source_id: int,
    venue_id: int,
    venue_name: str,
) -> Optional[tuple[dict, dict]]:
    """Build one LostCity event record from a class table row.

    Row columns: Class, Day, Time, Date (session start), Location, Duration, Teacher, Register
    Returns (event_record, series_hint) or None if the row should be skipped.
    """
    if len(row) < 4:
        return None

    class_name = row[0].strip()
    day_str = row[1].strip() if len(row) > 1 else ""
    time_str = row[2].strip() if len(row) > 2 else ""
    date_str = row[3].strip() if len(row) > 3 else ""
    location_str = row[4].strip() if len(row) > 4 else ""
    duration_str = row[5].strip() if len(row) > 5 else ""
    teacher_str = row[6].strip() if len(row) > 6 else ""
    register_str = row[7].strip() if len(row) > 7 else ""

    # Skip "Music Together with Seniors" and similar non-family classes
    age_min, age_max = _parse_class_age(class_name)
    if age_min is None and age_max is None:
        return None

    # Skip full classes with no open registration (waitlist only)
    if register_str.lower() == "waitlist":
        return None

    # Parse date
    start_date = _parse_date(date_str)
    if not start_date:
        logger.debug(
            "[mt-decatur] Cannot parse date %r for %r — skipping", date_str, class_name
        )
        return None

    # Skip sessions that have already ended.
    # We keep sessions where the session END date is still in the future — these are
    # 8-week semesters where mid-semester enrollment is common.  We calculate end date
    # here for the filter; it will also be stored on the record below.
    weeks_for_filter = _parse_duration_weeks(duration_str)
    end_date_for_filter = _compute_end_date(start_date, weeks_for_filter)
    try:
        session_start = datetime.strptime(start_date, "%Y-%m-%d").date()
        # Use end date for expiry check; fall back to start date if no duration
        if end_date_for_filter:
            session_end = datetime.strptime(end_date_for_filter, "%Y-%m-%d").date()
        else:
            session_end = session_start
        if session_end < date.today():
            return None
    except ValueError:
        return None

    # Parse time
    start_time = _parse_time(time_str)

    # Duration and end date
    weeks = _parse_duration_weeks(duration_str)
    end_date = _compute_end_date(start_date, weeks)

    # Clean class name (strip availability note like "(1 Seat Left)")
    clean_name = re.sub(r"\s*\(\d+\s+Seats?\s+Left\)\s*$", "", class_name).strip()

    # Build descriptive title
    title = f"{clean_name} at Music Together of Decatur"
    if "baby" in clean_name.lower():
        title = "Baby Music Class at Music Together of Decatur (Newborns–7 months)"

    # Description
    desc_parts = []
    if teacher_str:
        desc_parts.append(f"Instructor: {teacher_str}")
    if age_min == 0 and age_max == 0:
        desc_parts.append("Designed for newborns through 7 months with a caregiver")
    elif age_min is not None and age_max is not None:
        desc_parts.append(f"Ages {age_min}–{age_max} with a caregiver")
    if day_str and time_str:
        desc_parts.append(f"Every {day_str} at {time_str}")
    if weeks:
        desc_parts.append(f"{weeks}-week semester starting {start_date}")
    if location_str:
        desc_parts.append(f"Location: {location_str}")
    desc_parts.append(
        "Music Together is a research-based early childhood music program for babies, "
        "toddlers, preschoolers, and their caregivers. Classes use singing, moving, and "
        "instrument play to build musical foundations during children's most receptive years."
    )
    description = " | ".join(desc_parts[:3]) + ". " + desc_parts[-1]

    # Tags
    tags = ["music", "class", "family-friendly", "kids", "rsvp-required"]
    age_tags = _age_band_tags(age_min, age_max)
    for t in age_tags:
        if t not in tags:
            tags.append(t)

    # Content hash (title + venue + date + time to dedup per class slot)
    hash_key = f"{start_date}|{start_time or 'allday'}"
    content_hash = generate_content_hash(clean_name, venue_name, hash_key)

    # Registration URL
    source_url = f"{_WEBSITE_URL}/classes.aspx"

    record: dict = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "end_date": end_date,
        "start_time": start_time,
        "end_time": None,
        "is_all_day": False,
        "category": "family",
        "subcategory": "family.music",
        "tags": tags,
        "is_free": False,
        "price_min": None,
        "price_max": None,
        "price_note": "Semester tuition. See site for current rates.",
        "source_url": source_url,
        "ticket_url": f"{_BASE_URL}/classes.aspx",
        "image_url": None,
        "raw_text": " | ".join(row),
        "extraction_confidence": 0.92,
        "is_recurring": True,
        "content_hash": content_hash,
        "is_class": True,
        "class_category": "music",
    }
    if age_min is not None:
        record["age_min"] = age_min
    if age_max is not None:
        record["age_max"] = age_max

    series_hint = {
        "series_type": "class_series",
        "series_title": clean_name + " at Music Together of Decatur",
        "frequency": "weekly",
        "day_of_week": day_str.lower() if day_str else None,
    }

    return record, series_hint


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Music Together of Decatur class schedule.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    session.headers.update(_HEADERS)

    logger.info("[mt-decatur] Starting crawl")

    # Detect active semester
    sem_id = _detect_active_sem(session)
    if sem_id:
        logger.info("[mt-decatur] Active semester: %s", sem_id)
    else:
        logger.info("[mt-decatur] No semester detected, using default classes.aspx")

    # Fetch class table
    rows = _fetch_class_table(session, sem_id)
    if not rows:
        logger.warning("[mt-decatur] No class rows found")
        return 0, 0, 0

    # Pre-create venues (avoid repeated DB lookups)
    venue_cache: dict[str, int] = {}

    for row in rows:
        location_cell = row[4] if len(row) > 4 else ""
        place_data = _get_venue_data(location_cell)
        venue_slug = place_data["slug"]

        if venue_slug not in venue_cache:
            try:
                venue_id = get_or_create_place(place_data)
                venue_cache[venue_slug] = venue_id
            except Exception as exc:
                logger.error(
                    "[mt-decatur] Failed to get/create venue %s: %s", venue_slug, exc
                )
                continue

        venue_id = venue_cache[venue_slug]
        venue_name = place_data["name"]

        result = _build_event_record(row, source_id, venue_id, venue_name)
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
                    "[mt-decatur] Added: %s on %s",
                    record["title"],
                    record["start_date"],
                )
            except Exception as exc:
                logger.error(
                    "[mt-decatur] Failed to insert %r on %s: %s",
                    record["title"],
                    record["start_date"],
                    exc,
                )

    logger.info(
        "[mt-decatur] Crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
