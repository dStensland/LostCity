"""
Crawler for Forefront Arts (forefrontarts.com).

Forefront Arts is metro Atlanta's largest youth performing arts organization,
serving 1,200+ students/year across 20+ locations. They offer acting, dance,
voice, improv, and musical theatre for kids ages 2.5-18.

We capture two types of events:
  1. PUBLIC PERFORMANCES — MainStage shows, Spring Showcases, Summer Shows, and
     Spring Weekend Camp performances that any audience member can attend.
  2. MINI MUSICAL SESSIONS — 4-8 week class sessions at each location that
     culminate in a parent/family performance. Crawled as program events.

School-embedded enrichment programs (Bolton, Briar Vista, Morningside, etc.)
are enrollment-only with school-hours timing — we skip those as they are not
public-facing discovery events.

Site uses Bandzoogle CMS — static HTML, no JS rendering required.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.forefrontarts.com"

# ── Public-facing location pages ─────────────────────────────────────────────
# Each entry: (page_slug, venue_name, address, city, state, zip, neighborhood)
# These are the community studio locations where public classes + shows happen.
LOCATION_PAGES: list[dict] = [
    {
        "slug": "atlanta",
        "venue_name": "Forefront Arts - Atlanta / Buckhead",
        "venue_slug": "forefront-arts-atlanta",
        "address": "4400 Peachtree Dunwoody Rd",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30342",
        "neighborhood": "Buckhead",
        "lat": 33.8871,
        "lng": -84.3588,
    },
    {
        "slug": "northbrookhaven",
        "venue_name": "Forefront Arts - North Brookhaven / Chamblee",
        "venue_slug": "forefront-arts-north-brookhaven",
        "address": "3496 Keswick Drive",
        "city": "Chamblee",
        "state": "GA",
        "zip": "30341",
        "neighborhood": "Brookhaven",
        "lat": 33.8792,
        "lng": -84.3138,
    },
    {
        "slug": "eastcobb",
        "venue_name": "Forefront Arts - East Cobb / Marietta",
        "venue_slug": "forefront-arts-east-cobb",
        "address": "1465 Canton Rd",
        "city": "Marietta",
        "state": "GA",
        "zip": "30066",
        "neighborhood": "East Cobb",
        "lat": 34.0243,
        "lng": -84.4927,
    },
    {
        "slug": "alpharetta",
        "venue_name": "Forefront Arts - Alpharetta",
        "venue_slug": "forefront-arts-alpharetta",
        "address": "4320 Kimball Bridge Road",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30022",
        "neighborhood": "Alpharetta",
        "lat": 34.0450,
        "lng": -84.2541,
    },
    {
        "slug": "johnscreek",
        "venue_name": "Forefront Arts - Johns Creek",
        "venue_slug": "forefront-arts-johns-creek",
        "address": "6290 Abbotts Bridge Rd, Bldg 700",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "neighborhood": "Johns Creek",
        "lat": 34.0296,
        "lng": -84.1995,
    },
    {
        "slug": "cherokee",
        "venue_name": "Forefront Arts - Cherokee County",
        "venue_slug": "forefront-arts-cherokee",
        "address": "Hickory Flat Fire Station Community Room",
        "city": "Canton",
        "state": "GA",
        "zip": "30115",
        "neighborhood": "Cherokee County",
        "lat": 34.2326,
        "lng": -84.4955,
    },
]

# Venue data for the Spring Weekend Camp and Summer Show locations
EXTRA_VENUES: list[dict] = [
    {
        "venue_name": "Dresden Park Community Center",
        "venue_slug": "dresden-park-community-center",
        "address": "2301 Dresden Dr",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30341",
        "neighborhood": "Doraville",
        "lat": 33.8966,
        "lng": -84.2768,
    },
]

# Tags applied to all Forefront Arts events
BASE_TAGS = ["family-friendly", "kids", "educational", "performing-arts", "theater"]

# Pages we crawl for public-facing event data
EVENT_PAGES = [
    ("tickets", f"{BASE_URL}/tickets"),
    ("springweekendcamp", f"{BASE_URL}/springweekendcamp"),
    ("summershow", f"{BASE_URL}/summershow"),
    ("minimusicals", f"{BASE_URL}/minimusicals"),
    ("shows", f"{BASE_URL}/shows"),
]


# ── HTTP helpers ──────────────────────────────────────────────────────────────


def _fetch_html(session: requests.Session, url: str) -> Optional[str]:
    """Fetch a page, return HTML string or None on error."""
    try:
        resp = session.get(url, timeout=20)
        if resp.status_code == 200:
            return resp.text
        logger.warning(f"Forefront Arts: HTTP {resp.status_code} for {url}")
        return None
    except Exception as exc:
        logger.error(f"Forefront Arts: fetch failed for {url}: {exc}")
        return None


def _parse_content(html: str) -> list[str]:
    """Extract content lines from a Bandzoogle content-wrap div."""
    soup = BeautifulSoup(html, "html.parser")
    content = soup.find("div", class_="content-wrap")
    if not content:
        return []
    text = content.get_text(separator="\n")
    return [ln.strip() for ln in text.split("\n") if ln.strip()]


# ── Date / time parsing ───────────────────────────────────────────────────────

# Matches: "Saturday, March 7, 2026" — date WITH explicit year
_DATE_FULL_RE = re.compile(
    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+(\d{1,2}),?\s+(\d{4})",
    re.IGNORECASE,
)

# Matches: "Friday, January 30" or "Friday, January 30, 7:00 pm" — date WITHOUT year
_DATE_NO_YEAR_RE = re.compile(
    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+(\d{1,2})",
    re.IGNORECASE,
)

# Matches: "March 21-22" or "March 28-29"
_DATE_RANGE_RE = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?",
    re.IGNORECASE,
)

# Matches: "August 14-16 OR August 21-23"
_DATE_RANGE_MULTI_RE = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+(\d{1,2})[-–](\d{1,2})",
    re.IGNORECASE,
)

# Matches: "April 13 - May 11"
_DATE_SPAN_RE = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+(\d{1,2})\s*[-–]\s*"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+(\d{1,2})",
    re.IGNORECASE,
)

# Matches: "11:30 am", "7:00 pm", "4:00 pm"
_TIME_RE = re.compile(r"(\d{1,2}):(\d{2})\s*(am|pm)", re.IGNORECASE)

# Matches: "March session: MARCH 4 - MARCH 25"
_SESSION_DATE_RE = re.compile(
    r"(?:march|april|may|june|july|august|september|october|november|december|spring|summer|fall|winter)"
    r"[^\n:]*:\s*"
    r"((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2})",
    re.IGNORECASE,
)


def _parse_full_date(line: str) -> Optional[str]:
    """
    Parse a date line to YYYY-MM-DD.

    Handles two patterns:
    - 'Saturday, March 7, 2026' (explicit year)
    - 'Friday, January 30, 7:00 pm' (no year → infer current/next year)
    """
    # Try with explicit year first
    m = _DATE_FULL_RE.search(line)
    if m:
        month_s, day_s, year_s = m.group(1), m.group(2), m.group(3)
        try:
            dt = datetime.strptime(f"{month_s} {day_s} {year_s}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Fall back to no-year pattern with inference
    m = _DATE_NO_YEAR_RE.search(line)
    if m:
        return _parse_month_day(m.group(1), m.group(2))

    return None


def _parse_month_day(
    month_s: str,
    day_s: str,
    reference_year: int = 0,
    max_past_days: int = 7,
) -> Optional[str]:
    """
    Parse 'March 7' with year inference.

    Uses reference_year if provided (no inference). Otherwise infers the
    current year and rolls to the next year only if the date is within
    max_past_days in the past. Dates further in the past are returned as-is
    (they will be filtered by _is_future() and not inserted).

    This prevents stale listings from previous seasons (e.g. 'January 30' from
    a show that happened 6 weeks ago) from being misinterpreted as next-year events.
    """
    now = datetime.now()
    year = reference_year or now.year
    try:
        dt = datetime.strptime(f"{month_s} {day_s} {year}", "%B %d %Y")
        if not reference_year:
            delta = (now.date() - dt.date()).days
            # Only roll to next year if just slightly in the past (within max_past_days)
            if 0 < delta <= max_past_days:
                dt = dt.replace(year=year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def _parse_time(line: str) -> Optional[str]:
    """Parse '7:00 pm' → '19:00'. Returns None if no match."""
    m = _TIME_RE.search(line)
    if not m:
        return None
    hour, minute = int(m.group(1)), int(m.group(2))
    period = m.group(3).lower()
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _extract_price(
    lines: list[str], start_idx: int, window: int = 6
) -> tuple[bool, Optional[float], Optional[float]]:
    """Scan up to `window` lines forward for price info."""
    for line in lines[start_idx : start_idx + window]:
        if "free" in line.lower():
            return True, None, None
        # "$15-$20" or "$15 - $20"
        m = re.findall(r"\$(\d+(?:\.\d{2})?)", line)
        if m:
            prices = [float(p) for p in m]
            return False, min(prices), max(prices)
    return False, None, None


# ── Per-page parsers ──────────────────────────────────────────────────────────


def _parse_tickets_page(
    lines: list[str],
    source_id: int,
    venue_ids: dict[str, int],
) -> list[dict]:
    """
    Parse the /tickets page.

    Pattern:
      CAST NAME (e.g. "PARKSIDE ELEMENTARY CAST")
      Date line: "Saturday, March 7, 2026"
      Time lines: "11:30 am", "1:15 pm"  (one or more performances)
      Ticket link: "CLICK HERE FOR ... TICKETS"  (href = ludus URL)

    We create one event per date+time per cast.
    """
    events: list[dict] = []

    # Grab ticket links in parallel by scanning the raw soup — but we only have
    # lines here; ticket URLs were passed in as metadata. For now we point to
    # the tickets page itself and note Ludus is the ticketing platform.
    SOURCE_URL = f"{BASE_URL}/tickets"

    # Extract show title from early lines (e.g. '"SEUSS ON THE LOOSE"')
    show_title = None
    for ln in lines[:20]:
        if ln.startswith('"') and ln.endswith('"'):
            show_title = ln.strip('"')
            break
        if ln.startswith("\u201c") or ln.startswith('"'):
            show_title = ln.strip('\u201c\u201d"')
            break

    i = 0
    while i < len(lines):
        line = lines[i]

        # Detect cast heading (ALL CAPS with "CAST" at end)
        if (
            re.match(r"^[A-Z][A-Z &]+CAST$", line)
            or re.match(r"^[A-Z ]+ELEMENTARY CAST$", line)
            or re.match(r"^[A-Z ]+ACADEMY [A-Z]+ CAST$", line)
        ):
            cast_name = line

            # Determine venue from cast name
            venue_id = _venue_id_from_cast(cast_name, venue_ids)

            j = i + 1
            pending_date = None
            times_on_date: list[str] = []

            while j < len(lines) and j < i + 20:
                ln = lines[j]

                # Full date line
                d = _parse_full_date(ln)
                if d:
                    # Flush previous date+times
                    if pending_date and times_on_date:
                        for t in times_on_date:
                            events.append(
                                _build_show_event(
                                    show_title=show_title or "Student Showcase",
                                    cast_name=cast_name,
                                    start_date=pending_date,
                                    start_time=t,
                                    source_id=source_id,
                                    venue_id=venue_id,
                                    source_url=SOURCE_URL,
                                    is_free=False,
                                    price_min=15.0,
                                    price_max=25.0,
                                )
                            )
                    elif pending_date and not times_on_date:
                        events.append(
                            _build_show_event(
                                show_title=show_title or "Student Showcase",
                                cast_name=cast_name,
                                start_date=pending_date,
                                start_time=None,
                                source_id=source_id,
                                venue_id=venue_id,
                                source_url=SOURCE_URL,
                                is_free=False,
                                price_min=15.0,
                                price_max=25.0,
                            )
                        )
                    pending_date = d
                    times_on_date = []
                    j += 1
                    continue

                # Time-only line (e.g. "11:30 am")
                if re.match(r"^\d{1,2}:\d{2}\s*(am|pm)$", ln, re.IGNORECASE):
                    t = _parse_time(ln)
                    if t and pending_date:
                        times_on_date.append(t)
                    j += 1
                    continue

                # "CLICK HERE FOR ... TICKETS" — end of block
                if "CLICK HERE FOR" in ln.upper() and "TICKETS" in ln.upper():
                    break

                # NEW CAST header — end of block
                if re.match(r"^[A-Z][A-Z &]+CAST$", ln) or re.match(
                    r"^[A-Z ]+ELEMENTARY CAST$", ln
                ):
                    break

                j += 1

            # Flush final date
            if pending_date:
                if times_on_date:
                    for t in times_on_date:
                        events.append(
                            _build_show_event(
                                show_title=show_title or "Student Showcase",
                                cast_name=cast_name,
                                start_date=pending_date,
                                start_time=t,
                                source_id=source_id,
                                venue_id=venue_id,
                                source_url=SOURCE_URL,
                                is_free=False,
                                price_min=15.0,
                                price_max=25.0,
                            )
                        )
                else:
                    events.append(
                        _build_show_event(
                            show_title=show_title or "Student Showcase",
                            cast_name=cast_name,
                            start_date=pending_date,
                            start_time=None,
                            source_id=source_id,
                            venue_id=venue_id,
                            source_url=SOURCE_URL,
                            is_free=False,
                            price_min=15.0,
                            price_max=25.0,
                        )
                    )
            i = j
            continue

        i += 1

    return events


def _venue_id_from_cast(cast_name: str, venue_ids: dict[str, int]) -> Optional[int]:
    """Best-effort match of cast name to a venue_id."""
    name_lower = cast_name.lower()
    if "parkside" in name_lower:
        return venue_ids.get("forefront-arts-atlanta")
    if "bolton" in name_lower:
        return venue_ids.get("forefront-arts-atlanta")
    if "briar vista" in name_lower:
        return venue_ids.get("forefront-arts-north-brookhaven")
    return None


def _parse_location_show_events(
    page_slug: str,
    lines: list[str],
    source_id: int,
    venue_id: int,
) -> list[dict]:
    """
    Parse show/performance dates from a location page (e.g. /atlanta).

    Pattern on Atlanta page:
      '"THE WIZARD OF OZ"'
      'performed by the Forefront Arts MainStage Performance Company (Atlanta cast)'
      'Friday, January 30, 7:00 pm'
      'Saturday, January 31, 2:30 pm'
      ...
      'CLICK HERE FOR TICKETS!'
    """
    events: list[dict] = []
    SOURCE_URL = f"{BASE_URL}/{page_slug}"

    i = 0
    while i < len(lines):
        line = lines[i]

        # Detect a show title in quotes
        show_title = None
        clean = line.strip('\u201c\u201d"').strip()
        if (line.startswith('"') and line.endswith('"')) or (line.startswith("\u201c")):
            show_title = clean

        if show_title:
            # Scan ahead for date+time lines
            j = i + 1
            while j < len(lines) and j < i + 15:
                ln = lines[j]

                # Full date+time on one line: "Friday, January 30, 7:00 pm"
                date_val = _parse_full_date(ln)
                time_val = _parse_time(ln)
                if date_val:
                    events.append(
                        _build_show_event(
                            show_title=show_title,
                            cast_name=None,
                            start_date=date_val,
                            start_time=time_val,
                            source_id=source_id,
                            venue_id=venue_id,
                            source_url=SOURCE_URL,
                            is_free=False,
                            price_min=15.0,
                            price_max=25.0,
                        )
                    )
                    j += 1
                    continue

                if (
                    "CLICK HERE FOR TICKETS" in ln.upper()
                    or "ENROLLING NOW" in ln.upper()
                ):
                    break

                j += 1
            i = j
            continue

        i += 1

    return events


def _parse_spring_camp(
    lines: list[str],
    source_id: int,
    venue_id: int,
) -> list[dict]:
    """
    Parse Spring Weekend Camp from /springweekendcamp.

    Pattern:
      'March 21-22'
      'Ages 5-12'
      '"Rotten to the Core"...'
      ...
      'Weekend Camp performance on Sunday at 5:30 pm'
    """
    events: list[dict] = []
    SOURCE_URL = f"{BASE_URL}/springweekendcamp"

    i = 0
    while i < len(lines):
        line = lines[i]

        # Date range like "March 21-22" or "March 28-29"
        m = _DATE_RANGE_MULTI_RE.match(line)
        if m:
            month = m.group(1)
            day_end = int(m.group(3))
            # Performance is on the Sunday (last day), at 5:30 pm
            perf_date = _parse_month_day(month, str(day_end))
            if not perf_date:
                i += 1
                continue

            # Look ahead for show title — scan up to 8 lines
            # Format: 'Ages 5-12' then '"Rotten to the Core", inspired by...'
            show_title = "Spring Weekend Camp Performance"
            for k in range(i + 1, min(i + 8, len(lines))):
                ln = lines[k]
                # Title begins with a double-quote (plain or curly)
                if ln.startswith('"') or ln.startswith("\u201c"):
                    # Extract the text between the opening and closing quote
                    # '"Rotten to the Core", inspired by...' → 'Rotten to the Core'
                    inner = re.search(r'[\u201c"](.+?)[\u201d"]', ln)
                    if inner:
                        show_title = f"Forefront Arts Spring Camp: {inner.group(1)}"
                    break
                # Age range signals we've passed the title opportunity — skip, keep looking
                if re.match(r"^Ages?\s+\d", ln, re.IGNORECASE):
                    continue

            # Performance is Sunday at 5:30 pm per the page
            events.append(
                _build_show_event(
                    show_title=show_title,
                    cast_name=None,
                    start_date=perf_date,
                    start_time="17:30",
                    source_id=source_id,
                    venue_id=venue_id,
                    source_url=SOURCE_URL,
                    is_free=True,
                    price_min=None,
                    price_max=None,
                    description="Spring Weekend Camp public performance. Friends and family are invited to attend.",
                    extra_tags=[
                        "performing-arts",
                        "theater",
                        "musical-theater",
                        "dance",
                    ],
                )
            )

        i += 1

    return events


def _parse_summer_show(
    lines: list[str],
    source_id: int,
    venue_ids: dict[str, int],
) -> list[dict]:
    """
    Parse Summer Show casts from /summershow.

    Pattern:
      'PURPLE CAST'
      '(Marietta / East Cobb)'
      'Rehearsals will be held at Champion Kids Gym, 1465 Canton Rd...'
      ...
      'Weekend Performance Dates'
      'August 14-16 OR August 21-23'
    """
    events: list[dict] = []
    SOURCE_URL = f"{BASE_URL}/summershow"

    # First, grab the global performance date range
    perf_dates: list[str] = []
    for ln in lines:
        if re.match(
            r"^August\s+\d{1,2}[-–]\d{1,2}\s+(OR\s+August\s+\d{1,2}[-–]\d{1,2})?$",
            ln,
            re.IGNORECASE,
        ):
            # Collect start of each range
            for m in _DATE_RANGE_MULTI_RE.finditer(ln):
                d = _parse_month_day(m.group(1), m.group(2))
                if d and d not in perf_dates:
                    perf_dates.append(d)

    # Fall back: scan for "Weekend Performance Dates" block
    if not perf_dates:
        for idx, ln in enumerate(lines):
            if "Weekend Performance Dates" in ln:
                for k in range(idx + 1, min(idx + 5, len(lines))):
                    for m in _DATE_RANGE_MULTI_RE.finditer(lines[k]):
                        d = _parse_month_day(m.group(1), m.group(2))
                        if d and d not in perf_dates:
                            perf_dates.append(d)

    # Use first available performance date
    perf_start = perf_dates[0] if perf_dates else None

    # Map cast names to venue slugs
    cast_venue_map = {
        "PURPLE CAST": "forefront-arts-east-cobb",
        "BLUE CAST": "forefront-arts-atlanta",
        "GREEN CAST": "forefront-arts-alpharetta",
        "ORANGE CAST": "forefront-arts-cherokee",
        "RED CAST": None,  # Decatur — no permanent Forefront venue; fall back to Atlanta
    }

    show_title = "Forefront Arts Summer Show: Raise Your Voice"
    for ln in lines[:15]:
        # Look for a standalone line that IS "RAISE YOUR VOICE" (not a sentence containing it)
        stripped = ln.strip('\u201c\u201d"').strip()
        if stripped.upper() == "RAISE YOUR VOICE":
            show_title = f"Forefront Arts Summer Show: {stripped.title()}"
            break

    for cast_name, venue_slug in cast_venue_map.items():
        if not any(cast_name in ln for ln in lines):
            continue
        venue_id = (
            venue_ids.get(venue_slug)
            if venue_slug
            else venue_ids.get("forefront-arts-atlanta")
        )
        if not perf_start:
            continue
        # Avoid redundant cast label — use cast_name as title suffix only
        cast_label = cast_name.title().replace(" Cast", " Cast")
        events.append(
            _build_show_event(
                show_title=f"{show_title} — {cast_label}",
                cast_name=None,  # Already in title; don't double-append
                start_date=perf_start,
                start_time=None,
                source_id=source_id,
                venue_id=venue_id,
                source_url=SOURCE_URL,
                is_free=False,
                price_min=15.0,
                price_max=25.0,
                description=(
                    "Forefront Arts Summer Show: RAISE YOUR VOICE — a full-scale musical theatre "
                    "revue celebrating 75 years of Broadway, Disney, and hit musicals, performed by "
                    "kids and teens ages 5-16."
                ),
                extra_tags=[
                    "performing-arts",
                    "theater",
                    "musical-theater",
                    "dance",
                    "summer",
                ],
            )
        )

    return events


def _parse_mini_musicals(
    lines: list[str],
    source_id: int,
    venue_ids: dict[str, int],
) -> list[dict]:
    """
    Parse mini musical sessions from /minimusicals.

    Sessions have this structure:
      'SHOW TITLE'
      'ages X-Y'
      'Tuition: $NNN'
      Location blocks:
        'AREA NAME:'
        'Day HH:MM-HH:MM pm'
        'April 13 - May 11'
        'Location: ...'
    """
    events: list[dict] = []
    SOURCE_URL = f"{BASE_URL}/minimusicals"

    # Location keyword → venue_slug mapping
    location_venue_map = {
        "champion kids": "forefront-arts-east-cobb",
        "marietta": "forefront-arts-east-cobb",
        "east cobb": "forefront-arts-east-cobb",
        "st james": "forefront-arts-atlanta",
        "buckhead": "forefront-arts-atlanta",
        "brookhaven": "forefront-arts-atlanta",
        "keswick": "forefront-arts-north-brookhaven",
        "chamblee": "forefront-arts-north-brookhaven",
        "dekalb": "forefront-arts-north-brookhaven",
        "alpharetta": "forefront-arts-alpharetta",
        "gesher": "forefront-arts-alpharetta",
        "johns creek": "forefront-arts-johns-creek",
        "cherokee": "forefront-arts-cherokee",
        "woodstock": "forefront-arts-cherokee",
        "hickory flat": "forefront-arts-cherokee",
        "fire station": "forefront-arts-cherokee",
    }

    current_show: Optional[str] = None
    current_ages: Optional[str] = None

    i = 0
    while i < len(lines):
        line = lines[i]

        # Detect show title (next line is an age range like "ages 3-6")
        if i + 1 < len(lines) and re.match(r"^ages?\s+\d", lines[i + 1], re.IGNORECASE):
            # This line is likely a show title
            if (
                len(line) > 4
                and not line.startswith("http")
                and "CLICK" not in line.upper()
            ):
                current_show = line
                current_ages = lines[i + 1]
                i += 2
                continue

        # Also handle multi-line titles where ages appears 2 lines down
        # (some pages have "Show Title\ntuition: $NNN\nages X-Y")
        if i + 2 < len(lines) and re.match(r"^ages?\s+\d", lines[i + 2], re.IGNORECASE):
            if (
                len(line) > 4
                and not line.startswith("http")
                and "CLICK" not in line.upper()
                and not re.match(
                    r"^(OR|Location|Tuition|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)",
                    line,
                    re.IGNORECASE,
                )
            ):
                if re.match(
                    r"^(Tuition|CLICK|Register|Sign)", lines[i + 1], re.IGNORECASE
                ):
                    current_show = line
                    current_ages = lines[i + 2]
                    i += 3
                    continue

        # Detect area header like "MARIETTA / EAST COBB:" or "CHEROKEE COUNTY:"
        if re.match(r"^[A-Z][A-Z/ ]+:$", line):
            # Scan forward for date span
            j = i + 1
            session_start: Optional[str] = None
            session_end: Optional[str] = None
            session_time: Optional[str] = None
            location_text: Optional[str] = None

            while j < len(lines) and j < i + 10:
                ln = lines[j]

                # Time line: "Mondays 4:00-4:45 pm" or "Tuesdays 3:45-4:30 pm"
                if re.match(
                    r"^(Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?)\s+\d",
                    ln,
                    re.IGNORECASE,
                ):
                    # Extract start time from "4:00-4:45 pm"
                    m = _TIME_RE.search(ln)
                    if m:
                        session_time = _parse_time(ln)

                # Date span: "April 13 - May 11" or "March 5 - April 23"
                ms = _DATE_SPAN_RE.search(ln)
                if ms:
                    # Parse end date first (no rollover for end)
                    session_end = _parse_month_day(ms.group(3), ms.group(4))
                    # For start: don't roll to next year if end date is this year
                    # (handles sessions that started a few days ago)
                    start_raw = _parse_month_day(
                        ms.group(1), ms.group(2), max_past_days=0
                    )
                    if start_raw and session_end and start_raw[:4] != session_end[:4]:
                        # Years differ — start rolled to next year but end didn't; fix start
                        start_raw = _parse_month_day(
                            ms.group(1),
                            ms.group(2),
                            reference_year=int(session_end[:4]),
                        )
                    session_start = start_raw

                # "March 5 - April 23  (no class April 9)"
                if not ms:
                    # Try plain date range on same line
                    mrd = _DATE_RANGE_MULTI_RE.search(ln)
                    if mrd:
                        session_start = _parse_month_day(
                            mrd.group(1), mrd.group(2), max_past_days=0
                        )

                # Location text
                if ln.startswith("Location:"):
                    location_text = ln.removeprefix("Location:").strip()

                # "OR" signals next area block
                if ln.strip() == "OR":
                    break

                # Another area header
                if re.match(r"^[A-Z][A-Z/ ]+:$", ln):
                    break

                # Potential new show title: if the next line after this is an ages line,
                # we've moved past the current location block into the next show section
                if (
                    j + 1 < len(lines)
                    and re.match(r"^ages?\s+\d", lines[j + 1], re.IGNORECASE)
                    and len(ln) > 4
                    and "CLICK" not in ln.upper()
                ):
                    break

                j += 1

            # Build event if we have a date
            if session_start and current_show:
                venue_slug = None
                if location_text:
                    loc_lower = location_text.lower()
                    for kw, slug in location_venue_map.items():
                        if kw in loc_lower:
                            venue_slug = slug
                            break
                # Also try the area header itself
                if not venue_slug:
                    area_lower = line.lower()
                    for kw, slug in location_venue_map.items():
                        if kw in area_lower:
                            venue_slug = slug
                            break

                venue_id = venue_ids.get(venue_slug) if venue_slug else None

                age_tag = _age_tag(current_ages or "")
                age_label = f" ({current_ages})" if current_ages else ""
                description = (
                    f"{current_show} — a 4-8 week musical theatre mini-session. "
                    f"{current_ages or 'Ages vary'}. "
                    "Culminates in a family performance during the final class."
                )
                event_title = f"Mini Musical: {current_show}{age_label}"

                events.append(
                    {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": event_title,
                        "description": description,
                        "start_date": session_start,
                        "start_time": session_time,
                        "end_date": session_end,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "programs",
                        "subcategory": "performing_arts",
                        "tags": BASE_TAGS
                        + ["musical-theater", "improv", "class", "rsvp-required"]
                        + ([age_tag] if age_tag else []),
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Tuition required; see forefrontarts.com/minimusicals",
                        "is_free": False,
                        "source_url": SOURCE_URL,
                        "ticket_url": SOURCE_URL,
                        "image_url": None,
                        "raw_text": f"{event_title} {session_start}",
                        "extraction_confidence": 0.82,
                        "is_recurring": True,
                        "recurrence_rule": "weekly",
                        "content_hash": generate_content_hash(
                            event_title,
                            location_text or "Forefront Arts",
                            session_start,
                        ),
                    }
                )

            i = j
            continue

        i += 1

    return events


# ── Event builder ─────────────────────────────────────────────────────────────


def _build_show_event(
    *,
    show_title: str,
    cast_name: Optional[str],
    start_date: str,
    start_time: Optional[str],
    source_id: int,
    venue_id: Optional[int],
    source_url: str,
    is_free: bool,
    price_min: Optional[float],
    price_max: Optional[float],
    description: Optional[str] = None,
    extra_tags: Optional[list[str]] = None,
) -> dict:
    """Build a standardized show/performance event dict."""
    title = show_title
    if cast_name:
        title = f"{show_title} — {cast_name.title()}"

    if description is None:
        description = (
            "Live student performance by Forefront Arts youth performing arts program. "
            "Featuring acting, singing, and dancing by kids and teens."
        )

    tags = list(BASE_TAGS)
    tags += ["performing-arts", "theater", "musical-theater", "ticketed"]
    if extra_tags:
        tags += extra_tags
    tags = list(dict.fromkeys(tags))  # dedup, preserve order

    content_hash = generate_content_hash(title, "Forefront Arts", start_date)
    if start_time:
        content_hash = generate_content_hash(
            f"{title} {start_time}", "Forefront Arts", start_date
        )

    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": start_time,
        "end_date": None,
        "end_time": None,
        "is_all_day": False,
        "category": "family",
        "subcategory": "performing_arts",
        "tags": tags,
        "price_min": price_min,
        "price_max": price_max,
        "price_note": (
            "Tickets on sale at forefrontarts.com/tickets" if not is_free else None
        ),
        "is_free": is_free,
        "source_url": source_url,
        "ticket_url": source_url,
        "image_url": None,
        "raw_text": f"{title} {start_date}",
        "extraction_confidence": 0.88,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def _age_tag(age_text: str) -> Optional[str]:
    """Infer best age band tag from an age string like 'ages 3-6' or 'ages 9-15'."""
    m = re.search(r"(\d+)\s*[-–]\s*(\d+)", age_text)
    if not m:
        return None
    low, high = int(m.group(1)), int(m.group(2))
    if high <= 5:
        return "preschool"
    if low <= 6 and high <= 12:
        return "elementary"
    if low >= 9 and high <= 14:
        return "tween"
    if low >= 13:
        return "teen"
    if low <= 5:
        return "preschool"
    return "kids"


# ── Venue creation helpers ────────────────────────────────────────────────────


def _ensure_venues() -> dict[str, int]:
    """Get-or-create all Forefront Arts location venues. Returns slug→id map."""
    venue_ids: dict[str, int] = {}

    for loc in LOCATION_PAGES:
        venue_data = {
            "name": loc["venue_name"],
            "slug": loc["venue_slug"],
            "address": loc["address"],
            "city": loc["city"],
            "state": loc["state"],
            "zip": loc["zip"],
            "neighborhood": loc.get("neighborhood", ""),
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "venue_type": "arts_center",
            "website": BASE_URL,
            "vibes": ["family-friendly", "all-ages"],
        }
        try:
            vid = get_or_create_venue(venue_data)
            venue_ids[loc["venue_slug"]] = vid
        except Exception as exc:
            logger.error(
                f"Forefront Arts: failed to create venue {loc['venue_name']}: {exc}"
            )

    for extra in EXTRA_VENUES:
        venue_data = {
            "name": extra["venue_name"],
            "slug": extra["venue_slug"],
            "address": extra["address"],
            "city": extra["city"],
            "state": extra["state"],
            "zip": extra["zip"],
            "neighborhood": extra.get("neighborhood", ""),
            "lat": extra.get("lat"),
            "lng": extra.get("lng"),
            "venue_type": "community_center",
            "website": BASE_URL,
        }
        try:
            vid = get_or_create_venue(venue_data)
            venue_ids[extra["venue_slug"]] = vid
        except Exception as exc:
            logger.error(
                f"Forefront Arts: failed to create extra venue {extra['venue_name']}: {exc}"
            )

    return venue_ids


# ── Date filtering ────────────────────────────────────────────────────────────


def _is_future(date_str: str) -> bool:
    """Return True if date_str (YYYY-MM-DD) is today or in the future."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date() >= datetime.now().date()
    except ValueError:
        return False


# ── Main crawl ────────────────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Forefront Arts for public performances and program sessions.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Ensure all venue records exist up-front
    venue_ids = _ensure_venues()
    # Convenience: Dresden Park for spring camp
    dresden_id = venue_ids.get("dresden-park-community-center")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/121.0.0.0 Safari/537.36"
        )
    }

    with requests.Session() as session:
        session.headers.update(headers)

        # ── 1. Tickets page — public shows with fixed dates ──────────────────
        html = _fetch_html(session, f"{BASE_URL}/tickets")
        if html:
            lines = _parse_content(html)
            show_events = _parse_tickets_page(lines, source_id, venue_ids)
            for ev in show_events:
                if not _is_future(ev["start_date"]):
                    continue
                events_found += 1
                existing = find_event_by_hash(ev["content_hash"])
                if existing:
                    smart_update_existing_event(existing, ev)
                    events_updated += 1
                else:
                    try:
                        insert_event(ev)
                        events_new += 1
                        logger.info(f"Added: {ev['title']} on {ev['start_date']}")
                    except Exception as exc:
                        logger.error(
                            f"Forefront Arts: insert failed for {ev['title']}: {exc}"
                        )

        # ── 2. Location pages — MainStage shows listed per location ──────────
        for loc in LOCATION_PAGES:
            html = _fetch_html(session, f"{BASE_URL}/{loc['slug']}")
            if not html:
                continue
            lines = _parse_content(html)
            venue_id = venue_ids.get(loc["venue_slug"])
            show_events = _parse_location_show_events(
                loc["slug"], lines, source_id, venue_id
            )
            for ev in show_events:
                if not _is_future(ev["start_date"]):
                    continue
                events_found += 1
                existing = find_event_by_hash(ev["content_hash"])
                if existing:
                    smart_update_existing_event(existing, ev)
                    events_updated += 1
                else:
                    try:
                        insert_event(ev)
                        events_new += 1
                        logger.info(f"Added: {ev['title']} on {ev['start_date']}")
                    except Exception as exc:
                        logger.error(
                            f"Forefront Arts: insert failed for {ev['title']}: {exc}"
                        )

        # ── 3. Spring Weekend Camp — public performances ──────────────────────
        html = _fetch_html(session, f"{BASE_URL}/springweekendcamp")
        if html and dresden_id:
            lines = _parse_content(html)
            camp_events = _parse_spring_camp(lines, source_id, dresden_id)
            for ev in camp_events:
                if not _is_future(ev["start_date"]):
                    continue
                events_found += 1
                existing = find_event_by_hash(ev["content_hash"])
                if existing:
                    smart_update_existing_event(existing, ev)
                    events_updated += 1
                else:
                    try:
                        insert_event(ev)
                        events_new += 1
                        logger.info(f"Added: {ev['title']} on {ev['start_date']}")
                    except Exception as exc:
                        logger.error(
                            f"Forefront Arts: insert failed for {ev['title']}: {exc}"
                        )

        # ── 4. Summer Show — performance dates per cast ───────────────────────
        html = _fetch_html(session, f"{BASE_URL}/summershow")
        if html:
            lines = _parse_content(html)
            summer_events = _parse_summer_show(lines, source_id, venue_ids)
            for ev in summer_events:
                if not _is_future(ev["start_date"]):
                    continue
                events_found += 1
                existing = find_event_by_hash(ev["content_hash"])
                if existing:
                    smart_update_existing_event(existing, ev)
                    events_updated += 1
                else:
                    try:
                        insert_event(ev)
                        events_new += 1
                        logger.info(f"Added: {ev['title']} on {ev['start_date']}")
                    except Exception as exc:
                        logger.error(
                            f"Forefront Arts: insert failed for {ev['title']}: {exc}"
                        )

        # ── 5. Mini Musicals — class sessions with family performances ────────
        html = _fetch_html(session, f"{BASE_URL}/minimusicals")
        if html:
            lines = _parse_content(html)
            mini_events = _parse_mini_musicals(lines, source_id, venue_ids)
            for ev in mini_events:
                if not _is_future(ev["start_date"]):
                    continue
                events_found += 1
                existing = find_event_by_hash(ev["content_hash"])
                if existing:
                    smart_update_existing_event(existing, ev)
                    events_updated += 1
                else:
                    try:
                        insert_event(ev)
                        events_new += 1
                        logger.info(f"Added: {ev['title']} on {ev['start_date']}")
                    except Exception as exc:
                        logger.error(
                            f"Forefront Arts: insert failed for {ev['title']}: {exc}"
                        )

    logger.info(
        f"Forefront Arts crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )

    if events_found == 0:
        logger.warning(
            "Forefront Arts: 0 events found — site structure may have changed "
            "or all events are in the past."
        )

    return events_found, events_new, events_updated
