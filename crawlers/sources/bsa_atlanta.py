"""
Crawler for BSA Atlanta Area Council (Scouting America) — Council Events.

The Atlanta Area Council (scoutingatl.org) uses a custom ColdFusion-based
calendar system. Event data is loaded via a POST to /cfroot/campsCMSWrapper.cfc
with method=GetRemoteCMSEvents. The endpoint requires a Referer header that
matches the calendar page URL — without it, the server returns HTTP 403.

Coverage
--------
- EventCategoryID=553 (Council Events — open public-facing events like
  Scout Day at stadiums, merit badge workshops, camporees, hikes,
  Eagle ceremonies, STEAM summits, National Jamboree events)
- SiteID=118, CampID=116 (Atlanta Area Council identifiers)

Data flow
---------
1. POST to the ColdFusion API for a 12-month window.
2. Parse JSON array of event objects.
3. Map each event to a venue: use the LOCATION field for the venue name,
   or fall back to the generic council venue.
4. Parse STARTDATE/ENDDATE strings: "Sat, 28 Mar 2026 08:00:00".
5. Strip HTML from DESCRIPTION before storing.

Notes
-----
- Events with LOCATION="See Website" → use the council HQ as the venue.
- SHORTURL values are relative paths (/content/BLOGID/slug) → full URLs
  are https://www.scoutingatl.org + SHORTURL.
- Age ranges: Cub Scouts (ages 5-10), Scouts BSA (ages 11-17).
  Many events are mixed-age or all-ages — we default to 5-17 for council events.
"""

from __future__ import annotations

import html as html_module
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

_BASE_URL = "https://www.scoutingatl.org"
_CALENDAR_URL = f"{_BASE_URL}/calendar/553/Council-Events"
_API_URL = f"{_BASE_URL}/cfroot/campsCMSWrapper.cfc"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": _CALENDAR_URL,
}

# API parameters (fixed — these are the Atlanta Area Council identifiers)
_SITE_ID = 118
_CAMP_ID = 116
_DISTRICT_ID = 0
_EVENT_CATEGORY_ID = 553  # Council Events

# Crawl window: today through 12 months ahead
_WINDOW_DAYS = 365

_REQUEST_DELAY = 1.5
_TIMEOUT = 25

# Generic council HQ venue (used when location is "See Website" or missing)
_COUNCIL_VENUE: dict = {
    "name": "Atlanta Area Council, Scouting America",
    "slug": "bsa-atlanta-area-council",
    "address": "1800 Circle 75 Pkwy SE",
    "neighborhood": "Cumberland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "lat": 33.9003,
    "lng": -84.5618,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": _BASE_URL,
    "vibes": ["family-friendly", "all-ages"],
}

# Common Atlanta-metro event venues with coordinates
# (venue name substring → lat, lng, address, neighborhood, city, state, zip)
_VENUE_MAP: dict[str, tuple] = {
    "gas south arena": (33.9507, -84.1425, "6400 Sugarloaf Pkwy", "Duluth", "Duluth", "GA", "30097"),
    "truist park": (33.8907, -84.4677, "755 Battery Ave SE", "Cumberland", "Atlanta", "GA", "30339"),
    "morehouse college": (33.7480, -84.4139, "830 Westview Dr SW", "West End", "Atlanta", "GA", "30314"),
    "ebenezer baptist church": (33.7555, -84.3744, "407 Auburn Ave NE", "Sweet Auburn", "Atlanta", "GA", "30312"),
    "allatoona aquatics": (34.1542, -84.7135, "I-75 Lake Allatoona", "Cartersville", "Cartersville", "GA", "30121"),
    "camp bert adams": (33.4867, -84.4215, "1591 Scout Camp Rd", "Covington", "Covington", "GA", "30014"),
    "camp woodruff": (34.4793, -84.5498, "1 Camp Woodruff Rd", "Blairsville", "Blairsville", "GA", "30514"),
}

# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

# "Sat, 28 Mar 2026 08:00:00"
_RFC_DATE_RE = re.compile(
    r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+"
    r"(\d{1,2})\s+"
    r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+"
    r"(\d{4})\s+"
    r"(\d{2}):(\d{2}):(\d{2})",
    re.IGNORECASE,
)

_MONTH_MAP: dict[str, int] = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _parse_rfc_date(raw: str) -> tuple[Optional[str], Optional[str]]:
    """Parse "Sat, 28 Mar 2026 08:00:00" into (YYYY-MM-DD, HH:MM). Midnight → no time."""
    m = _RFC_DATE_RE.match(raw.strip())
    if not m:
        return None, None

    day = int(m.group(1))
    mon = _MONTH_MAP.get(m.group(2)[:3].lower())
    year = int(m.group(3))
    hour = int(m.group(4))
    minute = int(m.group(5))

    if not mon:
        return None, None

    try:
        dt = datetime(year, mon, day, hour, minute)
    except ValueError:
        return None, None

    date_str = dt.strftime("%Y-%m-%d")
    # Midnight (00:00) means no specific time was provided → omit
    time_str: Optional[str] = dt.strftime("%H:%M") if (hour != 0 or minute != 0) else None
    return date_str, time_str


# ---------------------------------------------------------------------------
# HTML strip helper
# ---------------------------------------------------------------------------


def _strip_html(raw: str) -> str:
    """Remove HTML tags and decode entities from a description string."""
    if not raw:
        return ""
    text = BeautifulSoup(raw, "html.parser").get_text(" ", strip=True)
    text = html_module.unescape(text)
    return re.sub(r"\s{3,}", "  ", text).strip()


# ---------------------------------------------------------------------------
# Venue resolution
# ---------------------------------------------------------------------------


def _resolve_venue(location: str) -> dict:
    """
    Map the LOCATION field to a place_data dict.

    Known venue names → precise coordinates.
    Unknown venues in Atlanta metro → fallback to council HQ.
    """
    if not location or location.lower() in ("see website", "tbd", "tba", ""):
        return dict(_COUNCIL_VENUE)

    loc_lower = location.lower()

    for key, (lat, lng, addr, neighborhood, city, state, zipcode) in _VENUE_MAP.items():
        if key in loc_lower:
            slug_base = re.sub(r"[^a-z0-9]+", "-", key).strip("-")
            return {
                "name": location,
                "slug": f"bsa-venue-{slug_base}",
                "address": addr,
                "neighborhood": neighborhood,
                "city": city,
                "state": state,
                "zip": zipcode,
                "lat": lat,
                "lng": lng,
                "venue_type": "venue",
                "spot_type": "venue",
                "website": _BASE_URL,
                "vibes": ["family-friendly", "all-ages"],
            }

    # Unknown location — use council HQ with location name preserved
    venue = dict(_COUNCIL_VENUE)
    venue["name"] = location
    slug_base = re.sub(r"[^a-z0-9]+", "-", location.lower())[:40].strip("-")
    venue["slug"] = f"bsa-{slug_base}"
    return venue


# ---------------------------------------------------------------------------
# Age range inference
# ---------------------------------------------------------------------------


def _infer_ages(name: str, description: str) -> tuple[Optional[int], Optional[int]]:
    """Infer age range from event title/description."""
    combined = (name + " " + description).lower()

    if "cub scout" in combined and "scout bsa" not in combined:
        return 5, 10
    if "cub" in combined and "bsa" not in combined:
        return 5, 10
    if "scouts bsa" in combined or "merit badge" in combined or "eagle" in combined:
        return 11, 17
    if "venturing" in combined or "sea scout" in combined:
        return 14, 20
    if "family" in combined or "all scout" in combined or "all age" in combined:
        return 5, 17
    # Default for general council events
    return 5, 17


# ---------------------------------------------------------------------------
# Category inference
# ---------------------------------------------------------------------------


def _infer_category(name: str) -> str:
    name_lower = name.lower()
    if any(kw in name_lower for kw in ["aquatics", "swim", "water", "kayak", "canoe"]):
        return "sports"
    if any(kw in name_lower for kw in ["merit badge", "eagle", "steam", "stem", "summit"]):
        return "educational"
    if any(kw in name_lower for kw in ["hike", "camporee", "camp", "outdoor", "conservation"]):
        return "outdoors"
    if any(kw in name_lower for kw in ["game", "gladiator", "soccer", "baseball", "scout day"]):
        return "sports"
    if any(kw in name_lower for kw in ["jamboree", "ceremony", "celebration", "banquet"]):
        return "community"
    return "family"


# ---------------------------------------------------------------------------
# API fetch
# ---------------------------------------------------------------------------


def _fetch_events(session: requests.Session, start_date: str, end_date: str) -> list[dict]:
    """
    POST to the ColdFusion API and return the JSON event array.
    Returns empty list on failure.
    """
    payload = {
        "method": "GetRemoteCMSEvents",
        "returnformat": "json",
        "CalendarStartDate": start_date,
        "CalendarEndDate": end_date,
        "StartDate": start_date[:7] + "-01",  # first of start month
        "SiteID": _SITE_ID,
        "CampID": _CAMP_ID,
        "DistrictIDi": _DISTRICT_ID,
        "EventCategoryID": _EVENT_CATEGORY_ID,
    }
    try:
        resp = session.post(_API_URL, data=payload, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, list):
            logger.warning("BSA Atlanta: unexpected API response type: %s", type(data))
            return []
        return data
    except Exception as exc:
        logger.error("BSA Atlanta: API fetch failed: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl BSA Atlanta Area Council public events.

    Steps:
      1. POST to the ColdFusion calendar API for the next 12 months.
      2. Parse each event: name, start/end dates, location, description.
      3. Resolve location to a venue record.
      4. Upsert via find_event_by_hash / insert_event.

    Returns (events_found, events_new, events_updated).
    """
    source_id: int = source["id"]
    today = datetime.now().date()
    end = date(today.year + 1, today.month, today.day)

    total_found = total_new = total_updated = 0
    session = requests.Session()
    session.headers.update(_HEADERS)

    start_str = today.strftime("%Y-%m-%d")
    end_str = end.strftime("%Y-%m-%d")

    logger.info("BSA Atlanta: fetching council events %s → %s", start_str, end_str)
    raw_events = _fetch_events(session, start_str, end_str)
    logger.info("BSA Atlanta: API returned %d events", len(raw_events))

    for ev in raw_events:
        name = ev.get("NAME", "").strip()
        # NAME sometimes includes a subtitle after a comma — clean it
        name = name.split(",")[0].strip() if "," in name else name
        if not name:
            continue

        start_date_raw = ev.get("STARTDATE", "")
        end_date_raw = ev.get("ENDDATE", "")

        start_date, start_time = _parse_rfc_date(start_date_raw)
        end_date, end_time = _parse_rfc_date(end_date_raw)

        if not start_date:
            logger.debug("BSA Atlanta: cannot parse date '%s' for '%s'", start_date_raw, name)
            continue

        try:
            event_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            continue

        if event_dt < today:
            continue

        # Build source URL from SHORTURL or BLOGID
        short_url = ev.get("SHORTURL", "")
        blog_id = ev.get("BLOGID", "")
        if short_url and short_url.startswith("/"):
            event_url = _BASE_URL + short_url
        elif blog_id:
            event_url = f"{_BASE_URL}/content/{blog_id}"
        else:
            event_url = _CALENDAR_URL

        # Venue
        location = ev.get("LOCATION", "")
        place_data = _resolve_venue(location)

        # Description
        raw_desc = ev.get("DESCRIPTION", "")
        description = _strip_html(raw_desc)
        if not description:
            description = None

        # Is all-day?
        is_all_day = bool(ev.get("ISALLDAY", 0)) or (
            start_time is None and (end_date and end_date != start_date)
        )

        # Age ranges
        age_min, age_max = _infer_ages(name, description or "")

        # Category
        category = _infer_category(name)

        # Tags
        tags = ["scouting", "youth", "bsa", "family-friendly"]
        if "merit badge" in name.lower():
            tags.append("merit-badge")
        if "eagle" in name.lower():
            tags.append("eagle-scout")
        if any(kw in name.lower() for kw in ["stem", "steam"]):
            tags.append("stem")
        if any(kw in name.lower() for kw in ["camp", "camporee", "outdoor"]):
            tags.append("camping")
        if any(kw in name.lower() for kw in ["aquatic", "swim"]):
            tags.append("swimming")

        try:
            venue_id = get_or_create_place(place_data)
        except Exception as exc:
            logger.error("BSA Atlanta: venue upsert failed for '%s': %s", place_data.get("name"), exc)
            continue

        content_hash = generate_content_hash(name, place_data["name"], start_date)

        event_record: dict = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": name,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date,
            "end_time": end_time,
            "is_all_day": is_all_day,
            "category": category,
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": "Registration required — see scoutingatl.org",
            "is_free": False,
            "source_url": event_url,
            "ticket_url": event_url,
            "image_url": None,
            "age_min": age_min,
            "age_max": age_max,
            "raw_text": f"{name} | {start_date} {start_time or ''} | {location}",
            "extraction_confidence": 0.85,
            "is_recurring": False,
            "content_hash": content_hash,
        }

        total_found += 1
        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            total_updated += 1
        else:
            try:
                insert_event(event_record)
                total_new += 1
                logger.info(
                    "BSA Atlanta: inserted '%s' on %s at %s",
                    name,
                    start_date,
                    place_data.get("name"),
                )
            except Exception as exc:
                logger.error("BSA Atlanta: insert failed for '%s': %s", name, exc)

        time.sleep(0.1)  # tiny delay between DB writes

    logger.info(
        "BSA Atlanta crawl complete: %d found, %d new, %d updated",
        total_found,
        total_new,
        total_updated,
    )
    return total_found, total_new, total_updated
