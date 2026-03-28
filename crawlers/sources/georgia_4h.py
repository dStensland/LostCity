"""
Crawler for Georgia 4-H (UGA Extension statewide events calendar).

Georgia 4-H is the youth development program of the University of Georgia
Cooperative Extension, serving youth ages 5-18 (Cloverbud 5-8, Junior 9-12,
Senior 13-18). Statewide competitive events include livestock judging, horse
shows, state congresses, officer training, and specialized competitions.

Data source
-----------
UGA Extension uses an AEM (Adobe Experience Manager) CMS. The /calendar page
fires an AJAX request to a JSON endpoint that returns rendered HTML:

  GET /content/extension/calendar/browse/jcr:content/parsys/eventslist_main.plain.json
  ?topicID=6

The response is an HTML fragment (not JSON) containing an <ul> of event <li>
elements. Each <li> contains:
  - .date    — human-readable date range ("Apr 11 - Apr 12")
  - .title-link  — event title + relative URL (/calendar/event/N/slug.html)
  - .description — description snippet
  - .location ul → .text span — location text ("Eatonton, GA")

Data flow
---------
1. Fetch the AJAX endpoint to get the full event HTML fragment.
2. Parse each <li> into: title, date range, location, URL.
3. For each event, optionally fetch the detail page for additional context
   (description and more precise location). Rate-limited.
4. Map city names to venue records.
5. Insert events with age ranges based on program type keywords.

Coverage notes
--------------
Most statewide 4-H events are held at the Rock Eagle 4-H Center (Eatonton),
Georgia State Fairgrounds (Perry), or UGA campus (Athens). Metro Atlanta
events include State 4-H Congress (Atlanta, July) and Leadership In Action.
We crawl all Georgia events, not just metro Atlanta, because families
anywhere in the state can register and the state congress is in Atlanta.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime, date
from typing import Optional
from urllib.parse import urljoin

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

_BASE_URL = "https://extension.uga.edu"
_AJAX_URL = (
    f"{_BASE_URL}/content/extension/calendar/browse/"
    "jcr:content/parsys/eventslist_main.plain.json"
)
_TOPIC_ID = 6  # 4-H topic filter

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,*/*",
    "Referer": f"{_BASE_URL}/calendar/browse/topic/6/4-H.html",
}

_REQUEST_DELAY = 1.0
_TIMEOUT = 20

# ---------------------------------------------------------------------------
# Known 4-H event venue registry
# Georgia 4-H events predominantly occur at a handful of state facilities.
# ---------------------------------------------------------------------------
_VENUE_REGISTRY: dict[str, dict] = {
    "rock eagle": {
        "name": "Rock Eagle 4-H Center",
        "slug": "rock-eagle-4h-center",
        "address": "350 Rock Eagle Rd NW",
        "neighborhood": "Rock Eagle",
        "city": "Eatonton",
        "state": "GA",
        "zip": "31024",
        "lat": 33.3543,
        "lng": -83.3779,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": "https://georgia4h.org/4-h-centers/rock-eagle-4-h-centers/",
        "vibes": ["family-friendly", "all-ages", "outdoor-seating"],
    },
    "eatonton": {
        "name": "Rock Eagle 4-H Center",
        "slug": "rock-eagle-4h-center",
        "address": "350 Rock Eagle Rd NW",
        "neighborhood": "Rock Eagle",
        "city": "Eatonton",
        "state": "GA",
        "zip": "31024",
        "lat": 33.3543,
        "lng": -83.3779,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": "https://georgia4h.org/4-h-centers/rock-eagle-4-h-centers/",
        "vibes": ["family-friendly", "all-ages", "outdoor-seating"],
    },
    "georgia national fair": {
        "name": "Georgia National Fairgrounds & Agricenter",
        "slug": "georgia-national-fairgrounds-perry",
        "address": "401 Larry Walker Pkwy",
        "neighborhood": "Perry",
        "city": "Perry",
        "state": "GA",
        "zip": "31069",
        "lat": 32.4616,
        "lng": -83.7318,
        "venue_type": "venue",
        "spot_type": "venue",
        "website": "https://www.georgianationalfair.com",
        "vibes": ["family-friendly", "all-ages"],
    },
    "perry": {
        "name": "Georgia National Fairgrounds & Agricenter",
        "slug": "georgia-national-fairgrounds-perry",
        "address": "401 Larry Walker Pkwy",
        "neighborhood": "Perry",
        "city": "Perry",
        "state": "GA",
        "zip": "31069",
        "lat": 32.4616,
        "lng": -83.7318,
        "venue_type": "venue",
        "spot_type": "venue",
        "website": "https://www.georgianationalfair.com",
        "vibes": ["family-friendly", "all-ages"],
    },
    "athens": {
        "name": "University of Georgia — Athens Campus",
        "slug": "university-of-georgia-athens",
        "address": "210 S Jackson St",
        "neighborhood": "Downtown Athens",
        "city": "Athens",
        "state": "GA",
        "zip": "30602",
        "lat": 33.9519,
        "lng": -83.3774,
        "venue_type": "university",
        "spot_type": "university",
        "website": "https://www.uga.edu",
        "vibes": ["family-friendly", "all-ages"],
    },
    "waycross": {
        "name": "Okefenokee 4-H Center",
        "slug": "okefenokee-4h-center-waycross",
        "address": "Okefenokee Regional Youth Camp",
        "neighborhood": "Waycross",
        "city": "Waycross",
        "state": "GA",
        "zip": "31502",
        "lat": 31.2135,
        "lng": -82.3521,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": "https://georgia4h.org",
        "vibes": ["family-friendly", "all-ages", "outdoor-seating"],
    },
    "atlanta": {
        "name": "Georgia 4-H — Atlanta",
        "slug": "georgia-4h-atlanta",
        "address": "Atlanta",
        "neighborhood": "Metro Atlanta",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7490,
        "lng": -84.3880,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://georgia4h.org",
        "vibes": ["family-friendly", "all-ages"],
    },
    "savannah": {
        "name": "Jekyll Island 4-H Center",
        "slug": "jekyll-island-4h-center",
        "address": "502 Stable Rd",
        "neighborhood": "Jekyll Island",
        "city": "Jekyll Island",
        "state": "GA",
        "zip": "31527",
        "lat": 31.0592,
        "lng": -81.4267,
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": "https://georgia4h.org/4-h-centers/georgia-4-h-at-camp-jekyll/",
        "vibes": ["family-friendly", "all-ages", "outdoor-seating"],
    },
    "crawford": {
        "name": "Georgia 4-H Livestock Facility",
        "slug": "georgia-4h-livestock-crawford",
        "address": "Crawford, GA",
        "neighborhood": "Crawford",
        "city": "Crawford",
        "state": "GA",
        "zip": "30630",
        "lat": 33.8913,
        "lng": -83.1618,
        "venue_type": "venue",
        "spot_type": "venue",
        "website": "https://georgia4h.org",
        "vibes": ["family-friendly", "all-ages"],
    },
}

_DEFAULT_VENUE: dict = {
    "name": "Georgia 4-H",
    "slug": "georgia-4h-statewide",
    "address": "2360 Rainwater Rd",
    "neighborhood": "Tifton",
    "city": "Tifton",
    "state": "GA",
    "zip": "31793",
    "lat": 31.4638,
    "lng": -83.5085,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": "https://georgia4h.org",
    "vibes": ["family-friendly", "all-ages"],
}

# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

_MONTH_MAP: dict[str, int] = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# "Apr 11 - Apr 12" or "Jul 21 - Jul 24" or "Jan 8 - Jan 10, 2027"
_DATE_RANGE_RE = re.compile(
    r"([A-Za-z]+)\s+(\d+)"
    r"(?:\s*[-–]\s*(?:([A-Za-z]+)\s+)?(\d+)(?:,?\s*(\d{4}))?)?"
    r"(?:,?\s*(\d{4}))?",
    re.IGNORECASE,
)


def _parse_date_range(raw: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse "Apr 11 - Apr 12" or "Jan 8 - Jan 10, 2027" → (start_date, end_date).
    Returns (None, None) on failure.
    """
    raw = raw.strip()
    m = _DATE_RANGE_RE.search(raw)
    if not m:
        return None, None

    sm_raw = m.group(1)
    sd = int(m.group(2))
    em_raw = m.group(3) or sm_raw
    ed = int(m.group(4)) if m.group(4) else sd

    sm = _MONTH_MAP.get(sm_raw[:3].lower())
    em = _MONTH_MAP.get(em_raw[:3].lower())
    if not sm or not em:
        return None, None

    # Determine year
    explicit_year = m.group(5) or m.group(6)
    today = datetime.now()
    year = int(explicit_year) if explicit_year else today.year

    # If no explicit year and the month looks past, advance to next year
    if not explicit_year:
        try:
            start_candidate = date(year, sm, sd)
            if start_candidate < today.date() - __import__("datetime").timedelta(days=14):
                year += 1
        except ValueError:
            pass

    try:
        start_dt = date(year, sm, sd)
        end_dt = date(year, em, ed)
        # Handle month wrap (Jun 30 - Jul 2)
        if end_dt < start_dt:
            next_m = em + 1 if em < 12 else 1
            next_y = year if em < 12 else year + 1
            end_dt = date(next_y, next_m, ed)
    except ValueError:
        return None, None

    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# Age/program inference
# ---------------------------------------------------------------------------


def _infer_ages(title: str, description: str) -> tuple[Optional[int], Optional[int]]:
    """Infer age range from 4-H program keywords."""
    combined = (title + " " + description).lower()

    if "cloverbud" in combined:
        return 5, 8
    if "junior conference" in combined or "junior 4-h" in combined:
        return 8, 12
    if "senior" in combined and "conference" in combined:
        return 13, 18
    if "officer" in combined or "ambassador" in combined or "congress" in combined:
        return 13, 18
    if "state 4-h" in combined and any(kw in combined for kw in ["judging", "show", "match"]):
        return 9, 18
    if "counselor" in combined:
        return 16, 18
    if "leadership" in combined or "lead" in combined:
        return 13, 18
    if "camp" in combined and "summer" in combined:
        return 9, 13

    # General 4-H programming
    return 9, 18


def _infer_category(title: str) -> str:
    tl = title.lower()
    if any(kw in tl for kw in ["judging", "match", "horse show", "fair", "livestock"]):
        return "sports"
    if any(kw in tl for kw in ["camp", "outdoor", "conservation"]):
        return "outdoors"
    if any(kw in tl for kw in ["conference", "congress", "training", "leader", "officer"]):
        return "educational"
    if any(kw in tl for kw in ["stem", "engineering", "science", "technology"]):
        return "educational"
    return "family"


# ---------------------------------------------------------------------------
# Venue resolution
# ---------------------------------------------------------------------------


def _resolve_venue(location: str) -> dict:
    """Match a location string to a known 4-H venue, or return default."""
    if not location:
        return dict(_DEFAULT_VENUE)

    loc_lower = location.lower()
    for key, place_data in _VENUE_REGISTRY.items():
        if key in loc_lower:
            return dict(place_data)

    return dict(_DEFAULT_VENUE)


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------


def _get(session: requests.Session, url: str, params: Optional[dict] = None) -> Optional[str]:
    """Fetch URL, return text or None on error."""
    try:
        resp = session.get(url, params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("Georgia 4-H: fetch error for %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Georgia 4-H statewide events via UGA Extension AJAX calendar.

    Steps:
      1. GET the AJAX endpoint with topicID=6 (4-H) to get the event HTML fragment.
      2. Parse <li> elements for date, title, description, and location.
      3. Resolve location to a venue record.
      4. Insert/update future events.

    Returns (events_found, events_new, events_updated).
    """
    source_id: int = source["id"]
    today = datetime.now().date()
    total_found = total_new = total_updated = 0

    session = requests.Session()
    session.headers.update(_HEADERS)

    logger.info("Georgia 4-H: fetching statewide event calendar")
    html = _get(session, _AJAX_URL, params={"topicID": _TOPIC_ID})
    if not html:
        logger.warning("Georgia 4-H: failed to fetch calendar")
        return 0, 0, 0

    soup = BeautifulSoup(html, "html.parser")
    event_items = soup.find_all("li")
    logger.info("Georgia 4-H: found %d event list items", len(event_items))

    seen_hashes: set[str] = set()

    for item in event_items:
        div = item.find("div", class_="list-item")
        if not div:
            continue

        # Date
        date_el = div.find("span", class_="date")
        date_raw = date_el.get_text(strip=True) if date_el else ""
        if not date_raw:
            continue

        start_date, end_date = _parse_date_range(date_raw)
        if not start_date:
            logger.debug("Georgia 4-H: cannot parse date '%s'", date_raw)
            continue

        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            continue

        if start_dt < today:
            continue

        # Title + URL
        title_el = div.find("a", class_="title-link")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        if not title:
            continue

        href = title_el.get("href", "")
        event_url = urljoin(_BASE_URL, href) if href else f"{_BASE_URL}/calendar/browse/topic/6/4-H.html"

        # Description
        desc_el = div.find("span", class_="description")
        description: Optional[str] = None
        if desc_el:
            desc_text = desc_el.get_text(" ", strip=True)
            # The description sometimes is just a URL — skip if so
            if desc_text and not desc_text.startswith("http"):
                description = desc_text[:1000]

        # Location
        loc_el = div.find("ul", class_="location")
        if loc_el:
            loc_text = loc_el.get_text(strip=True)
            # Strip the icon text "location_on" that renders as text
            loc_text = re.sub(r"location_on", "", loc_text).strip()
            # Format: "Eatonton, GA" → extract city
            city_match = re.match(r"([^,]+),?\s*GA", loc_text, re.IGNORECASE)
            location = city_match.group(1).strip() if city_match else loc_text
        else:
            location = ""

        place_data = _resolve_venue(location)
        age_min, age_max = _infer_ages(title, description or "")
        category = _infer_category(title)

        tags = ["4-h", "youth", "educational", "family-friendly"]
        if any(kw in title.lower() for kw in ["judging", "show", "competition", "match"]):
            tags.append("competition")
        if any(kw in title.lower() for kw in ["leadership", "congress", "officer"]):
            tags.append("leadership")
        if any(kw in title.lower() for kw in ["camp", "outdoor"]):
            tags.append("camping")
        if any(kw in title.lower() for kw in ["stem", "engineering", "science"]):
            tags.append("stem")
        if "state" in title.lower():
            tags.append("statewide")

        is_all_day = end_date and end_date != start_date

        try:
            venue_id = get_or_create_place(place_data)
        except Exception as exc:
            logger.error("Georgia 4-H: venue upsert failed for '%s': %s", place_data.get("name"), exc)
            continue

        content_hash = generate_content_hash(title, place_data["name"], start_date)

        # Skip duplicates within same run (some events may appear twice in HTML)
        if content_hash in seen_hashes:
            continue
        seen_hashes.add(content_hash)

        event_record: dict = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": None,
            "end_date": end_date,
            "end_time": None,
            "is_all_day": bool(is_all_day),
            "category": category,
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": "Registration required — see georgia4h.org",
            "is_free": False,
            "source_url": event_url,
            "ticket_url": event_url,
            "image_url": None,
            "age_min": age_min,
            "age_max": age_max,
            "raw_text": f"{title} | {date_raw} | {location}",
            "extraction_confidence": 0.82,
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
                    "Georgia 4-H: inserted '%s' on %s at %s",
                    title,
                    start_date,
                    place_data.get("name"),
                )
            except Exception as exc:
                logger.error("Georgia 4-H: insert failed for '%s': %s", title, exc)

        time.sleep(0.05)

    logger.info(
        "Georgia 4-H crawl complete: %d found, %d new, %d updated",
        total_found,
        total_new,
        total_updated,
    )
    return total_found, total_new, total_updated
