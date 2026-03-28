"""
Crawler for Play-Well TEKnologies — Georgia LEGO engineering camps.

Play-Well TEKnologies runs LEGO-based STEM summer camps for kids K-8
(ages 5-12) across Atlanta metro counties. Camp sessions are listed on
a static PHP-rendered schedule site at schedule.play-well.org with
one page per county.

Coverage
--------
- Cherokee County  (county_id=211)
- DeKalb County    (county_id=185)
- Fayette County   (county_id=186)
- Forsyth County   (county_id=195)
- Fulton County    (county_id=193)
- Gwinnett County  (county_id=191)

Data flow
---------
1. For each county, fetch the /class/list/county/{name}/county_id/{id}/type/camp page.
2. Parse the HTML <table> — one row per camp session.
3. Rows come in clusters: a city header row (1 cell), then a venue name row (1 cell),
   then session rows (5 cells: blank, title+ages, dates, times, location).
4. Parse dates: "May 26th - May 29th" or "Jun 1st - Jun 5th" → YYYY-MM-DD.
5. Create one event per camp session. Venue = the school/rec-center site.
6. Age ranges extracted from the title text ("Ages: 5 to 12").

Notes
-----
- The schedule is mostly summer camps, published annually around March/April.
  Off-season runs may return empty tables — that is expected behavior.
- No detail pages exist per camp session; all data is in the table.
- Rate-limited at 1.5s between county pages.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime, date
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

_BASE_URL = "https://schedule.play-well.org"
_COUNTY_URL_TEMPLATE = (
    "{base}/class/list/county/{county_name}/county_id/{county_id}/type/camp"
)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

# Atlanta-area counties with their county_id values from schedule.play-well.org
_COUNTIES: list[tuple[str, int, str]] = [
    ("Cherokee County", 211, "Cherokee County"),
    ("DeKalb County", 185, "DeKalb County"),
    ("Fayette County", 186, "Fayette County"),
    ("Forsyth County", 195, "Forsyth County"),
    ("Fulton County", 193, "Fulton County"),
    ("Gwinnett County", 191, "Gwinnett County"),
]

# Polite delay between county page requests
_REQUEST_DELAY = 1.5
_TIMEOUT = 20

# Fallback organization-level venue when location is unavailable
_ORG_VENUE: dict = {
    "name": "Play-Well TEKnologies Atlanta",
    "slug": "play-well-teknologies-atlanta",
    "address": "Atlanta",
    "neighborhood": "Metro Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30301",
    "lat": 33.7490,
    "lng": -84.3880,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": "https://play-well.org",
    "vibes": ["family-friendly", "all-ages"],
}

# Month abbreviation → integer
_MONTH_MAP: dict[str, int] = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# ---------------------------------------------------------------------------
# Known venue coordinates for Play-Well host sites (Atlanta metro)
# Sourced from Google Maps to satisfy the data quality requirement.
# ---------------------------------------------------------------------------
_VENUE_COORDS: dict[str, tuple[float, float, str, str, str]] = {
    # (lat, lng, address, neighborhood, city)
    "preston ridge community center": (34.0648, -84.2820, "10475 Medlock Bridge Rd", "Alpharetta", "Alpharetta"),
    "bridgemill fire station 22": (34.2079, -84.4758, "1400 Bridgemill Ave", "Canton", "Canton"),
    "holcomb bridge middle school": (34.0105, -84.3133, "870 Holcomb Bridge Rd", "Roswell", "Roswell"),
    "chattahoochee recreation center": (33.9572, -84.3424, "4300 Meadowland Pkwy", "Marietta", "Marietta"),
    "north manor neighborhood park": (33.7754, -84.4015, "1985 Defoor Ave NW", "West Midtown", "Atlanta"),
    "holy innocents episcopal school": (33.9431, -84.3855, "805 Mount Vernon Hwy NE", "Sandy Springs", "Sandy Springs"),
    "dunwoody nature center": (33.9525, -84.3376, "5343 Roberts Dr", "Dunwoody", "Dunwoody"),
    "south dekalb ymca": (33.7049, -84.2171, "2565 Snapfinger Rd", "South DeKalb", "Decatur"),
    "dekalb recreation center": (33.7728, -84.2945, "1001 Rainbow Dr", "Decatur", "Decatur"),
    "peachtree city": (33.3965, -84.5955, "Peachtree City", "Peachtree City", "Peachtree City"),
    "johns creek": (34.0290, -84.1988, "Johns Creek", "Johns Creek", "Johns Creek"),
    "roswell": (34.0231, -84.3616, "Roswell", "Roswell", "Roswell"),
    "alpharetta": (34.0754, -84.2941, "Alpharetta", "Alpharetta", "Alpharetta"),
    "suwanee": (34.0517, -84.0663, "Suwanee", "Suwanee", "Suwanee"),
    "cumming": (34.2073, -84.1400, "Cumming", "Cumming", "Cumming"),
    "buford": (34.1198, -83.9938, "Buford", "Buford", "Buford"),
}

# Neighborhood mapping by city for GA
_CITY_NEIGHBORHOOD_MAP: dict[str, str] = {
    "Atlanta": "Metro Atlanta",
    "Alpharetta": "Alpharetta",
    "Roswell": "Roswell",
    "Marietta": "Marietta",
    "Decatur": "Decatur",
    "Dunwoody": "Dunwoody",
    "Sandy Springs": "Sandy Springs",
    "Canton": "Cherokee County",
    "Cumming": "Forsyth County",
    "Lawrenceville": "Gwinnett County",
    "Suwanee": "Gwinnett County",
    "Buford": "Gwinnett County",
    "Fayetteville": "Fayette County",
    "Peachtree City": "Fayette County",
    "Johns Creek": "Johns Creek",
}

# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

_DATE_RE = re.compile(
    r"(?P<sm>[A-Za-z]+)\s+(?P<sd>\d+)(?:st|nd|rd|th)?"
    r"(?:\s*-\s*(?P<em>[A-Za-z]+)\s+)?(?P<ed>\d+)(?:st|nd|rd|th)?",
    re.IGNORECASE,
)


def _parse_camp_dates(raw: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse "May 26th - May 29th" or "Jun 1st - Jun 5th" into (start_date, end_date)
    as YYYY-MM-DD strings.  Returns (None, None) on failure.
    """
    raw = raw.strip()
    m = _DATE_RE.search(raw)
    if not m:
        return None, None

    sm_raw = m.group("sm") or ""
    sd = int(m.group("sd"))
    em_raw = m.group("em") or sm_raw  # end month defaults to start month
    ed = int(m.group("ed"))

    sm = _MONTH_MAP.get(sm_raw[:3].lower())
    em = _MONTH_MAP.get(em_raw[:3].lower())
    if not sm or not em:
        return None, None

    today = datetime.now()
    year = today.year

    # If start month is before current month significantly, push to next year
    start_dt = date(year, sm, sd)
    if start_dt < today.date() and sm < today.month - 2:
        year += 1
        start_dt = date(year, sm, sd)

    end_dt = date(year, em, ed)
    # Handle month wrap (e.g. Jun 28 - Jul 2)
    if end_dt < start_dt:
        end_dt = date(year, em + 1 if em < 12 else 1, ed) if em < 12 else date(year + 1, 1, ed)

    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# Age range parsing
# ---------------------------------------------------------------------------


def _parse_ages(title_text: str) -> tuple[Optional[int], Optional[int]]:
    """Extract age_min and age_max from title text like 'Ages: 5\xa0to\xa012'."""
    m = re.search(r"Ages?\s*[:\-]?\s*(\d+)\s+to\s+(\d+)", title_text, re.IGNORECASE)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None, None


# ---------------------------------------------------------------------------
# Time parsing
# ---------------------------------------------------------------------------


def _parse_times(raw: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse "9:00am - 4:00pm" into (start_time, end_time) as "HH:MM" 24-hour strings.
    """
    parts = re.split(r"\s*-\s*", raw.strip())
    results: list[Optional[str]] = []
    for part in parts[:2]:
        part = part.strip()
        m = re.match(r"(\d{1,2}):(\d{2})(am|pm)", part, re.IGNORECASE)
        if m:
            h, mn, meridiem = int(m.group(1)), int(m.group(2)), m.group(3).lower()
            if meridiem == "pm" and h != 12:
                h += 12
            if meridiem == "am" and h == 12:
                h = 0
            results.append(f"{h:02d}:{mn:02d}")
        else:
            results.append(None)
    if len(results) == 0:
        return None, None
    if len(results) == 1:
        return results[0], None
    return results[0], results[1]


# ---------------------------------------------------------------------------
# Venue creation helpers
# ---------------------------------------------------------------------------


def _build_venue_data(location_name: str, city_hint: str, county_name: str) -> dict:
    """
    Build place_data dict for a Play-Well host site.
    Uses known coordinates where available; falls back to city-level geocode.
    """
    loc_key = location_name.lower().strip()
    city_key = city_hint.lower().strip()

    # Check known venues first
    coords_entry = None
    for key, val in _VENUE_COORDS.items():
        if key in loc_key or loc_key in key:
            coords_entry = val
            break

    # If no exact match, check city
    if not coords_entry:
        for key, val in _VENUE_COORDS.items():
            if key in city_key or city_key in key:
                coords_entry = val
                break

    if coords_entry:
        lat, lng, address, neighborhood, city = coords_entry
    else:
        # Minimal fallback — city centroid
        lat, lng = 33.7490, -84.3880
        address = city_hint or "Atlanta"
        neighborhood = _CITY_NEIGHBORHOOD_MAP.get(city_hint, county_name)
        city = city_hint or "Atlanta"

    # Determine city/state from hint
    city_final = city_hint or city or "Atlanta"
    neighborhood_final = _CITY_NEIGHBORHOOD_MAP.get(city_final, neighborhood)

    venue_name = location_name if location_name else f"Play-Well Camp — {city_final}"
    slug_base = re.sub(r"[^a-z0-9]+", "-", venue_name.lower()).strip("-")
    slug = f"play-well-{slug_base[:40]}"

    return {
        "name": venue_name,
        "slug": slug,
        "address": address,
        "neighborhood": neighborhood_final,
        "city": city_final,
        "state": "GA",
        "zip": "",
        "lat": lat,
        "lng": lng,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": "https://play-well.org",
        "vibes": ["family-friendly", "all-ages"],
    }


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------


def _fetch(session: requests.Session, url: str) -> Optional[str]:
    """Fetch URL, return HTML or None on error."""
    try:
        resp = session.get(url, headers=_HEADERS, timeout=_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("Play-Well: fetch error for %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# County page parser
# ---------------------------------------------------------------------------


def _parse_county_page(
    html: str,
    county_name: str,
    source_id: int,
    source_url: str,
    today: date,
) -> tuple[int, int, int]:
    """
    Parse one county camp schedule page and upsert events.

    Table structure:
      Header row: ['', 'SUMMER CAMP TITLE', 'DATES', 'TIMES', 'LOCATION']
      City row:   ['Alpharetta']                (1 cell, rowspan-like)
      Venue row:  ['City of Alpharetta']         (1 cell)
      Session:    ['', title+ages, dates, times, location_name]
      ...repeat for next city/venue block

    Returns (found, new, updated).
    """
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        logger.info("Play-Well %s: no table found (no camps listed)", county_name)
        return 0, 0, 0

    rows = table.find_all("tr")
    found = new = updated = 0

    current_city: str = ""
    current_venue_name: str = ""

    for row in rows:
        cells = row.find_all(["td", "th"])
        if not cells:
            continue

        num_cells = len(cells)

        # Header row: skip
        if any("CAMP TITLE" in c.get_text() for c in cells):
            continue

        # City or venue row (1 cell, non-empty)
        if num_cells == 1:
            cell_text = cells[0].get_text(strip=True)
            if not cell_text:
                continue
            # Heuristic: if it contains "City of" or looks like a venue name (has spaces)
            # but has no digits → it could be a city or an org name
            if len(cell_text.split()) <= 3 and not any(c.isdigit() for c in cell_text):
                # Short, no digits → likely a city name
                current_city = cell_text
            else:
                # Longer or org-style → venue name
                current_venue_name = cell_text
            continue

        # Session row: exactly 5 cells [blank, title+ages, dates, times, location]
        if num_cells < 4:
            continue

        # Cell 1: title + ages
        title_cell = cells[1].get_text("\n", strip=True) if len(cells) > 1 else ""
        # Split on newline to separate title from ages line
        title_lines = [ln.strip() for ln in title_cell.split("\n") if ln.strip()]
        if not title_lines:
            continue

        title_raw = title_lines[0]
        age_text = " ".join(title_lines)

        # Filter out non-camp header lines
        if not title_raw or "CAMP TITLE" in title_raw.upper():
            continue

        # Parse ages
        age_min, age_max = _parse_ages(age_text)
        if age_min is None:
            age_min, age_max = 5, 12  # Play-Well default

        # Cell 2: dates
        dates_raw = cells[2].get_text(strip=True) if len(cells) > 2 else ""
        start_date, end_date = _parse_camp_dates(dates_raw)
        if not start_date:
            logger.debug("Play-Well: cannot parse dates '%s' in '%s'", dates_raw, title_raw)
            continue

        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            continue

        if start_dt < today:
            continue

        # Cell 3: times
        times_raw = cells[3].get_text(strip=True) if len(cells) > 3 else ""
        start_time, end_time = _parse_times(times_raw)

        # Cell 4: location name
        location_raw = cells[4].get_text(strip=True) if len(cells) > 4 else ""
        venue_location = location_raw or current_venue_name or f"Play-Well Camp Site — {current_city}"

        # Build venue data
        place_data = _build_venue_data(venue_location, current_city, county_name)

        # Full-day if multi-day camp with no meaningful start time
        is_multiday = end_date and end_date != start_date
        is_all_day = is_multiday and start_time is None

        # Derive price: Play-Well camps are paid (not free)
        is_free = False

        # Title: clean up
        # Remove "Ages: X to Y" from title if embedded
        title = re.sub(r"\s*Ages?\s*[:\-]?\s*\d+\s+to\s+\d+.*$", "", title_raw, flags=re.IGNORECASE).strip()
        if not title:
            title = title_raw

        # Build full title with camp type
        full_title = f"{title} — Play-Well LEGO Camp"

        tags = [
            "stem", "lego", "engineering", "summer-camp", "kids",
            "ages-5-12", "educational",
        ]
        if age_max is not None and age_max <= 8:
            tags.append("young-kids")
        if age_min is not None and age_min >= 7:
            tags.append("elementary")

        # Upsert
        try:
            venue_id = get_or_create_place(place_data)
        except Exception as exc:
            logger.error("Play-Well: venue upsert failed for '%s': %s", venue_location, exc)
            continue

        content_hash = generate_content_hash(full_title, place_data["name"], start_date)

        event_record: dict = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": full_title,
            "description": (
                f"Play-Well TEKnologies LEGO engineering camp for ages {age_min}–{age_max}. "
                f"Sessions use tens of thousands of LEGO pieces to teach fundamental STEM concepts "
                f"through hands-on play. Camp runs {dates_raw}."
            ),
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date,
            "end_time": end_time,
            "is_all_day": is_all_day,
            "category": "family",
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": "Registration required — see play-well.org",
            "is_free": is_free,
            "source_url": source_url,
            "ticket_url": "https://play-well.org/schedule/",
            "image_url": None,
            "age_min": age_min,
            "age_max": age_max,
            "raw_text": f"{full_title} | {start_date} | {place_data['name']} | {dates_raw}",
            "extraction_confidence": 0.88,
            "is_recurring": False,
            "content_hash": content_hash,
        }

        found += 1
        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
        else:
            try:
                insert_event(event_record)
                new += 1
                logger.debug(
                    "Play-Well: inserted '%s' on %s at %s",
                    full_title,
                    start_date,
                    place_data["name"],
                )
            except Exception as exc:
                logger.error(
                    "Play-Well: insert failed for '%s' on %s: %s",
                    full_title,
                    start_date,
                    exc,
                )

    return found, new, updated


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Play-Well TEKnologies Georgia summer camp schedule.

    Fetches one page per Atlanta-area county, parses the HTML camp table,
    and inserts/updates events for future sessions.

    Returns (events_found, events_new, events_updated).
    """
    source_id: int = source["id"]
    source_url: str = source.get("url", "https://play-well.org/schedule/class/state/state/georgia")
    total_found = total_new = total_updated = 0
    today = datetime.now().date()

    session = requests.Session()

    for county_name, county_id, display_name in _COUNTIES:
        url = _COUNTY_URL_TEMPLATE.format(
            base=_BASE_URL,
            county_name=county_name.replace(" ", "%20"),
            county_id=county_id,
        )
        logger.info("Play-Well: fetching %s (%s)", display_name, url)

        html = _fetch(session, url)
        if not html:
            logger.warning("Play-Well: failed to fetch %s", url)
            time.sleep(_REQUEST_DELAY)
            continue

        try:
            found, new, updated = _parse_county_page(
                html, display_name, source_id, source_url, today
            )
            total_found += found
            total_new += new
            total_updated += updated
            logger.info(
                "Play-Well %s: %d found, %d new, %d updated",
                display_name,
                found,
                new,
                updated,
            )
        except Exception as exc:
            logger.error("Play-Well: error parsing %s: %s", display_name, exc)

        time.sleep(_REQUEST_DELAY)

    logger.info(
        "Play-Well TEKnologies crawl complete: %d found, %d new, %d updated",
        total_found,
        total_new,
        total_updated,
    )
    return total_found, total_new, total_updated
