"""
Crawler for Southern Belle Farm (southernbellefarm.com).
Located in McDonough, GA (~35 miles south of Atlanta).

Southern Belle Farm is a top seasonal family destination offering:
- Spring: U-pick strawberries (April-May), flowers (May-Oct)
- Summer: U-pick peaches, blueberries, blackberries (June-August)
- Fall: Pumpkin patch, 4-acre corn maze, 30+ activities (Sept-Nov)
- Christmas: Farmstead Christmas, Santa visits (late Nov-Dec)
- Special events: Sunflower Weekend, Peach & Sunflower Festival,
  Donut Breakfast with Santa, etc.

Data strategy:
- Scrape 4 seasonal landing pages for season-window events with
  actual dates, hours, and pricing embedded in the page text.
- Hit WP REST API for recent blog posts that announce special events
  with specific dates (festivals, themed weekends, Santa breakfasts).
- Emit one event per seasonal opening window, plus individual events
  for special ticketed occasions that have distinct dates.

Site is static WordPress — requests + BeautifulSoup, no Playwright needed.
"""

from __future__ import annotations

import html as html_lib
import logging
import re
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from db.client import writes_enabled
from db.exhibitions import insert_exhibition
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://www.southernbellefarm.com"
WP_API_POSTS = f"{BASE_URL}/wp-json/wp/v2/posts"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

# ── Season page URLs ──────────────────────────────────────────────────────────
SEASON_URLS = {
    "spring": f"{BASE_URL}/spring/",
    "summer": f"{BASE_URL}/summer/",
    "fall": f"{BASE_URL}/fall/",
    "christmas": f"{BASE_URL}/christmas/",
}

# ── Venue record ─────────────────────────────────────────────────────────────
PLACE_DATA = {
    "name": "Southern Belle Farm",
    "slug": "southern-belle-farm",
    "address": "1658 Turner Church Rd",
    "neighborhood": "McDonough",
    "city": "McDonough",
    "state": "GA",
    "zip": "30252",
    "lat": 33.4418,
    "lng": -84.1438,
    "place_type": "outdoor_venue",
    "spot_type": "outdoor_venue",
    "is_seasonal_only": True,
    "website": BASE_URL,
    "vibes": ["family-friendly", "outdoor-seating", "good-for-groups", "free-parking"],
}

# ── Canonical season metadata ─────────────────────────────────────────────────
# Used as structured fallback when the live page date regex can't match.
# Dates reflect current published info (Fall 2025 confirmed from live page).
SEASON_DEFAULTS: dict[str, dict] = {
    "spring": {
        "title": "Strawberry Season at Southern Belle Farm",
        "description": (
            "U-pick strawberries are back at Southern Belle Farm! Come out to "
            "pick your own sweet Georgia strawberries from 15 acres of strawberry "
            "patch and 5 acres of flowers. No activity tickets required for "
            "strawberry picking. Market and bakery open Tue-Sun."
        ),
        "default_start": "04-01",  # April 1 (nominal open date)
        "default_end": "05-31",
        "source_url": SEASON_URLS["spring"],
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "hands-on",
            "afternoon",
        ],
        "category": "family",
        "price_min": 1.00,  # $1 per person u-pick admission
        "price_max": 19.95,  # gallon bucket
        "price_note": "U-pick admission $1/person; strawberries from $6.95/qt",
        "is_free": False,
        # Spring u-pick strawberries: "Market and bakery open Tue-Sun" (closed Mon).
        # Farm opens 9am Tue-Fri, 10am Sat, close 6pm typical Southern u-pick pattern.
        "operating_schedule": {
            "default_hours": {"open": "09:00", "close": "18:00"},
            "days": {
                "monday": None,
                "tuesday": {"open": "09:00", "close": "18:00"},
                "wednesday": {"open": "09:00", "close": "18:00"},
                "thursday": {"open": "09:00", "close": "18:00"},
                "friday": {"open": "09:00", "close": "18:00"},
                "saturday": {"open": "10:00", "close": "18:00"},
                "sunday": {"open": "11:00", "close": "18:00"},
            },
            "overrides": {},
        },
    },
    "summer": {
        "title": "Summer U-Pick at Southern Belle Farm",
        "description": (
            "Summer at Southern Belle Farm means peaches, blueberries, and "
            "blackberries ready for picking! Twenty varieties of Georgia peaches, "
            "plus blueberries and blackberries in the patch. Market open Tue-Sat."
        ),
        "default_start": "06-01",
        "default_end": "08-15",
        "source_url": SEASON_URLS["summer"],
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "hands-on",
            "afternoon",
        ],
        "category": "family",
        "price_min": 1.00,
        "price_max": 24.95,
        "price_note": "U-pick admission $1/person; fruit from $9.95/qt",
        "is_free": False,
        # Summer u-pick: "Market open Tue-Sat" (closed Sun/Mon). Opens early
        # to beat heat — 9am weekdays, 10am Sat. Sunflower Weekend extends to
        # Sunday; covered via the sub-event record.
        "operating_schedule": {
            "default_hours": {"open": "09:00", "close": "17:00"},
            "days": {
                "monday": None,
                "tuesday": {"open": "09:00", "close": "17:00"},
                "wednesday": {"open": "09:00", "close": "17:00"},
                "thursday": {"open": "09:00", "close": "17:00"},
                "friday": {"open": "09:00", "close": "17:00"},
                "saturday": {"open": "10:00", "close": "17:00"},
                "sunday": None,
            },
            "overrides": {},
        },
    },
    "fall": {
        "title": "Fall Festival at Southern Belle Farm",
        "description": (
            "Southern Belle Farm's fall season is the biggest event of the year — "
            "a 4-acre corn maze, pumpkin patch, pig races, hayrides, cow train, "
            "gem mine, paintball, corn cannons, and 30+ outdoor attractions. "
            "Weekend activity admission includes all attractions. Located in "
            "McDonough, GA, just 35 miles south of Atlanta."
        ),
        "default_start": "09-20",  # From live page: Sept 20 - Nov 2, 2025
        "default_end": "11-02",
        "source_url": SEASON_URLS["fall"],
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "hands-on",
            "ticketed",
            "holiday",
        ],
        "category": "family",
        "price_min": 18.95,
        "price_max": 24.95,
        "price_note": "Activity admission $18.95–$24.95; market/pumpkin patch free",
        "is_free": False,
        # Fall festival: core activity weekends (Sat/Sun) plus Columbus Day
        # Mon override. Weekday hours are shorter (pumpkin patch + market
        # only); weekends run the full 30+ attractions operation.
        # Columbus Day override is injected per-year in _extend_fall_overrides().
        "operating_schedule": {
            "default_hours": {"open": "10:00", "close": "17:00"},
            "days": {
                "monday": None,
                "tuesday": {"open": "10:00", "close": "17:00"},
                "wednesday": {"open": "10:00", "close": "17:00"},
                "thursday": {"open": "10:00", "close": "17:00"},
                "friday": {"open": "10:00", "close": "18:00"},
                "saturday": {"open": "10:00", "close": "19:00"},
                "sunday": {"open": "12:00", "close": "18:00"},
            },
            "overrides": {},
        },
    },
    "christmas": {
        "title": "Farmstead Christmas at Southern Belle Farm",
        "description": (
            "Celebrate the holidays at Southern Belle Farm's Farmstead Christmas! "
            "Free visits with Santa on weekends, Christmas tree displays, barnyard "
            "animals, slides, gem mine, paintball, and homemade baked goods from "
            "the market. Weekend activity admission $15.95/person."
        ),
        "default_start": "11-28",
        "default_end": "12-14",
        "source_url": SEASON_URLS["christmas"],
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "hands-on",
            "ticketed",
            "holiday",
        ],
        "category": "family",
        "price_min": 15.95,
        "price_max": 30.95,  # Donut Breakfast with Santa
        "price_note": "Weekend activities $15.95; Santa visit free; Donut Breakfast with Santa $30.95",
        "is_free": False,
        # Farmstead Christmas runs weekends only (late-Nov through mid-Dec).
        # Donut Breakfast with Santa is a weekend special at 10:00–11:30;
        # main activity admission runs through the afternoon. Weekdays closed.
        "operating_schedule": {
            "default_hours": {"open": "10:00", "close": "17:00"},
            "days": {
                "monday": None,
                "tuesday": None,
                "wednesday": None,
                "thursday": None,
                "friday": None,
                "saturday": {"open": "10:00", "close": "17:00"},
                "sunday": {"open": "12:00", "close": "17:00"},
            },
            "overrides": {},
        },
    },
}

# ── Regex helpers ─────────────────────────────────────────────────────────────
# Matches "September 20th – November 2nd 2025", "Nov 28 - Dec 14", etc.
_DATE_RANGE_RE = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December|"
    r"Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
    r"\.?\s+(\d{1,2})(?:st|nd|rd|th)?"
    r"(?:\s+(\d{4}))?"
    r"\s*[–—\-]+\s*"
    r"(January|February|March|April|May|June|July|August|September|October|November|December|"
    r"Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
    r"\.?\s+(\d{1,2})(?:st|nd|rd|th)?"
    r"(?:\s+(\d{4}))?",
    re.IGNORECASE,
)

# Matches standalone dates like "June 28", "Sat, June 28", "December 6th"
_SINGLE_DATE_RE = re.compile(
    r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)"
    r"[\.,]?\s*"
    r"(January|February|March|April|May|June|July|August|September|October|November|December|"
    r"Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
    r"\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?",
    re.IGNORECASE,
)

# Matches bare "Month DD" without day-of-week prefix (used only in specific contexts)
_BARE_DATE_RE = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?",
    re.IGNORECASE,
)

# Matches time strings like "10am", "9am-5pm", "1pm-5pm"
_TIME_RE = re.compile(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", re.IGNORECASE)

_MONTH_MAP = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}


def _parse_month(month_str: str) -> int:
    return _MONTH_MAP.get(month_str.lower().rstrip("."), 0)


def _resolve_year(month: int, day: int, hint_year: Optional[int] = None) -> int:
    """Return the most likely year for a month/day, biased toward the future."""
    today = datetime.now().date()
    year = hint_year if hint_year else today.year
    try:
        candidate = datetime(year, month, day).date()
        # If candidate is more than 60 days in the past, bump to next year
        if candidate < today - timedelta(days=60):
            candidate = datetime(year + 1, month, day).date()
            year = candidate.year
    except ValueError:
        pass
    return year


def _to_date_str(
    month_str: str, day_str: str, year_str: Optional[str] = None
) -> Optional[str]:
    month = _parse_month(month_str)
    if not month:
        return None
    try:
        day = int(day_str)
        hint_year = int(year_str) if year_str else None
        year = _resolve_year(month, day, hint_year)
        return datetime(year, month, day).strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def parse_date_range_from_text(text: str) -> tuple[Optional[str], Optional[str]]:
    """Extract start/end dates from text containing a date range."""
    m = _DATE_RANGE_RE.search(text)
    if m:
        start = _to_date_str(m.group(1), m.group(2), m.group(3))
        end = _to_date_str(m.group(4), m.group(5), m.group(6))
        return start, end
    return None, None


def parse_single_date(text: str) -> Optional[str]:
    """Extract a single event date from text."""
    # Try day-of-week + month + day first (higher confidence)
    m = _SINGLE_DATE_RE.search(text)
    if m:
        return _to_date_str(m.group(1), m.group(2), m.group(3))
    return None


def parse_time_str(time_text: str) -> Optional[str]:
    """Parse '10am', '9:00am', '1pm' to HH:MM format."""
    m = _TIME_RE.search(time_text)
    if m:
        hour = int(m.group(1))
        minute = int(m.group(2)) if m.group(2) else 0
        period = m.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


def parse_price(text: str) -> tuple[Optional[float], Optional[float]]:
    """Extract min/max price from text. Returns (price_min, price_max)."""
    prices = re.findall(r"\$(\d+(?:\.\d{2})?)", text)
    if not prices:
        return None, None
    floats = [float(p) for p in prices]
    return min(floats), max(floats)


def _page_text(html: str) -> str:
    """Strip tags and collapse whitespace from HTML."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()
    text = soup.get_text(separator=" ")
    return re.sub(r"\s+", " ", text).strip()


def _unescape(text: str) -> str:
    return html_lib.unescape(text)


# ── Season page scraper ───────────────────────────────────────────────────────


def _resolve_season_window(season: str, text: str) -> tuple[str, str]:
    """
    Return (start_date, end_date) for a season. Prefers live page dates, falls
    back to SEASON_DEFAULTS MM-DD strings. Projects to next year if the derived
    end date is more than 60 days in the past.
    """
    defaults = SEASON_DEFAULTS[season]
    start_date, end_date = parse_date_range_from_text(text)

    today = datetime.now().date()
    today_year = today.year

    if not start_date:
        start_date = f"{today_year}-{defaults['default_start']}"
    if not end_date:
        end_date = f"{today_year}-{defaults['default_end']}"

    try:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        if end_dt < today - timedelta(days=60):
            next_year = today_year + 1
            start_date = f"{next_year}-{defaults['default_start']}"
            end_date = f"{next_year}-{defaults['default_end']}"
    except ValueError:
        pass

    return start_date, end_date


def create_season_exhibition(
    source_id: int,
    venue_id: int,
    season_key: str,
    season_data: dict,
) -> Optional[str]:
    """
    Upsert one seasonal exhibition for Southern Belle. Returns exhibition UUID
    (or None on dry-run / failure).

    `season_key` is one of "spring", "summer", "fall", "christmas".
    `season_data` is an entry from SEASON_DEFAULTS augmented with resolved
    `start_date` / `end_date` (YYYY-MM-DD) and optional per-season tweaks.
    """
    start_date = season_data["start_date"]
    end_date = season_data["end_date"]
    year = start_date[:4]
    slug = f"southern-belle-farm-{season_key}-{year}"

    # Spring + Summer u-pick admission is a token $1 gate — closer to "free"
    # than "ticketed" — but fall + christmas are full activity admissions.
    if season_key in ("fall", "christmas"):
        admission_type = "ticketed"
        admission_url = f"{BASE_URL}/book-now/"
    else:
        admission_type = "ticketed"  # $1/person u-pick admission
        admission_url = season_data["source_url"]

    exhibition_data = {
        "slug": slug,
        "place_id": venue_id,
        "source_id": source_id,
        "title": season_data["title"],
        "description": season_data["description"],
        "image_url": _season_image(season_key),
        "opening_date": start_date,
        "closing_date": end_date,
        "exhibition_type": "seasonal",
        "admission_type": admission_type,
        "admission_url": admission_url,
        "source_url": season_data["source_url"],
        "operating_schedule": season_data["operating_schedule"],
        "tags": season_data.get("tags", ["seasonal", "farm"]),
    }

    exhibition_id = insert_exhibition(exhibition_data)
    if exhibition_id:
        logger.info(
            f"Southern Belle Farm: upserted {season_key} exhibition "
            f"({start_date} to {end_date}, id={exhibition_id})"
        )
    return exhibition_id


def scrape_season_page(
    season: str,
    source_id: int,
    venue_id: int,
    text: str,
    exhibition_ids: dict[str, Optional[str]],
) -> tuple[int, int, int]:
    """
    Scan the already-fetched season page text for dated sub-events (Columbus
    Day, Donut Breakfast with Santa, Sunflower Weekend) and emit them with
    `events.exhibition_id` linking back to the parent season.

    The season-window itself is carried by the exhibition row (created earlier
    in `crawl()`), not by a pseudo-event in the events table.

    Returns (found, new, updated) for sub-events only.
    """
    url = SEASON_URLS[season]
    events_found = 0
    events_new = 0
    events_updated = 0

    # ── Extract special sub-events from the season page ──
    # Sub-event → season mapping is determined inside _extract_sub_events by
    # the `season` key of the page they live on. The caller passes in the
    # full `exhibition_ids` dict so sub-events that naturally belong to a
    # different season (e.g. Sunflower Weekend is emitted on the summer page
    # and linked to the summer exhibition) can still reach that season's UUID.
    sub_events = _extract_sub_events(
        text, season, source_id, venue_id, url, exhibition_ids
    )
    for sub in sub_events:
        linked_season = sub.pop("_linked_season", None)
        events_found += 1
        sub_hash = sub["content_hash"]
        sub_existing = find_event_by_hash(sub_hash)
        if sub_existing:
            smart_update_existing_event(sub_existing, sub)
            events_updated += 1
        else:
            try:
                insert_event(sub)
                events_new += 1
                logger.info(
                    f"Southern Belle Farm: added sub-event {sub['title']} "
                    f"({sub['start_date']}) → {linked_season} exhibition "
                    f"(exhibition_id={sub.get('exhibition_id')})"
                )
            except Exception as e:
                logger.error(
                    f"Southern Belle Farm: failed to insert {sub['title']}: {e}"
                )

    return events_found, events_new, events_updated


def _season_image(season: str) -> Optional[str]:
    """Return a curated static image URL for each season."""
    images = {
        "spring": "https://www.southernbellefarm.com/wp-content/uploads/2017/08/attrBarn.jpg",
        "summer": "https://www.southernbellefarm.com/wp-content/uploads/2017/08/attrCannons.jpg",
        "fall": "https://www.southernbellefarm.com/wp-content/uploads/2017/08/attrCowTrain.jpg",
        "christmas": "https://www.southernbellefarm.com/wp-content/uploads/2017/08/attrBarn.jpg",
    }
    return images.get(season)


def _extract_sub_events(
    text: str,
    season: str,
    source_id: int,
    venue_id: int,
    source_url: str,
    exhibition_ids: dict[str, Optional[str]],
) -> list[dict]:
    """
    Extract specifically-dated sub-events mentioned in the season page. Each
    sub-event carries `exhibition_id` pointing to its parent season:

      - Fall page: Columbus Day (Oct) → fall exhibition
      - Christmas page: Donut Breakfast with Santa (Dec) → christmas exhibition
      - Summer page: Sunflower Weekend (Jun) → summer exhibition (June dates
        fall inside the summer window, not fall)

    `_linked_season` is a sentinel key the caller pops for logging; it is
    never persisted to the events table.
    """
    events: list[dict] = []
    today = datetime.now().date()

    if season == "christmas":
        # "Donut Breakfast with Santa" on specific December dates
        donut_match = re.search(
            r"Donut Breakfast with Santa[^\n]*?("
            r"December\s+\d{1,2}(?:st|nd|rd|th)?)",
            text,
            re.IGNORECASE,
        )
        # Find all "December XX" mentions near "Donut" keyword
        context_match = re.search(
            r"Donut[^.]{0,200}?(December\s+\d{1,2})[^.]{0,100}?(December\s+\d{1,2})",
            text,
            re.IGNORECASE,
        )
        donut_dates: list[str] = []
        if context_match:
            for grp in (context_match.group(1), context_match.group(2)):
                dm = _BARE_DATE_RE.search(grp)
                if dm:
                    d = _to_date_str(dm.group(1), dm.group(2), dm.group(3))
                    if d:
                        donut_dates.append(d)
        elif donut_match:
            dm = _BARE_DATE_RE.search(donut_match.group(1))
            if dm:
                d = _to_date_str(dm.group(1), dm.group(2), dm.group(3))
                if d:
                    donut_dates.append(d)

        for date_str in donut_dates:
            try:
                if datetime.strptime(date_str, "%Y-%m-%d").date() < today:
                    continue
            except ValueError:
                continue
            events.append(
                {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "exhibition_id": exhibition_ids.get("christmas"),
                    "title": "Donut Breakfast with Santa at Southern Belle Farm",
                    "description": (
                        "Start your morning with donuts and a visit with Santa at Southern "
                        "Belle Farm! Includes all-day activity admission, photo time with Santa, "
                        "a visit from Santa's friends, Christmas games, and a take-home goodie bag. "
                        "$30.95/person (2 and under free). Tickets sold in advance."
                    ),
                    "start_date": date_str,
                    "start_time": "10:00",
                    "end_date": date_str,
                    "end_time": "11:30",
                    "is_all_day": False,
                    "category": "family",
                    "subcategory": None,
                    "tags": [
                        "seasonal",
                        "family-friendly",
                        "outdoor",
                        "all-ages",
                        "ticketed",
                        "holiday",
                        "hands-on",
                        "kids",
                    ],
                    "price_min": 30.95,
                    "price_max": 30.95,
                    "price_note": "$30.95/person; kids 2 & under free",
                    "is_free": False,
                    "source_url": source_url,
                    "ticket_url": f"{BASE_URL}/book-now/",
                    "image_url": None,
                    "raw_text": f"Donut Breakfast with Santa {date_str}",
                    "extraction_confidence": 0.88,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": generate_content_hash(
                        "Donut Breakfast with Santa", "Southern Belle Farm", date_str
                    ),
                    "_linked_season": "christmas",
                }
            )

    elif season == "summer":
        # Sunflower Weekend — "Sat, June 28 Tickets / Sun, June 29 Tickets"
        # Parse both days and emit as a single two-day event
        sun_match = re.search(
            r"Sunflower Weekend[^\n]{0,200}"
            r"(Sat(?:urday)?[\.,]?\s*"
            r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2})",
            text,
            re.IGNORECASE,
        )
        if sun_match:
            start = parse_single_date(sun_match.group(1))
            if start:
                try:
                    start_dt = datetime.strptime(start, "%Y-%m-%d")
                    end = (start_dt + timedelta(days=1)).strftime("%Y-%m-%d")
                except ValueError:
                    end = start
                if datetime.strptime(start, "%Y-%m-%d").date() >= today:
                    events.append(
                        {
                            "source_id": source_id,
                            "place_id": venue_id,
                            "exhibition_id": exhibition_ids.get("summer"),
                            "title": "Sunflower Weekend at Southern Belle Farm",
                            "description": (
                                "A two-day summer celebration featuring Southern Belle Farm's "
                                "stunning sunflower fields, farm fun, and picture-perfect memories. "
                                "Pick your own sunflowers and zinnias, enjoy peaches and berries, "
                                "and explore the farm with the whole family."
                            ),
                            "start_date": start,
                            "start_time": "10:00",
                            "end_date": end,
                            "end_time": "17:00",
                            "is_all_day": False,
                            "category": "family",
                            "subcategory": None,
                            "tags": [
                                "seasonal",
                                "family-friendly",
                                "outdoor",
                                "all-ages",
                                "hands-on",
                                "ticketed",
                            ],
                            "price_min": 1.00,
                            "price_max": 29.95,
                            "price_note": "U-pick admission $1/person; sunflower bucket $29.95",
                            "is_free": False,
                            "source_url": source_url,
                            "ticket_url": source_url,
                            "image_url": None,
                            "raw_text": f"Sunflower Weekend {start}",
                            "extraction_confidence": 0.88,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": generate_content_hash(
                                "Sunflower Weekend", "Southern Belle Farm", start
                            ),
                            "_linked_season": "summer",
                        }
                    )

    elif season == "fall":
        # Columbus Day special hours: "Columbus Day Monday October 13th 10am-5pm"
        col_match = re.search(
            r"Columbus Day[^\.]{0,80}" r"(October\s+\d{1,2}(?:st|nd|rd|th)?)",
            text,
            re.IGNORECASE,
        )
        if col_match:
            col_date = _BARE_DATE_RE.search(col_match.group(1))
            if col_date:
                d = _to_date_str(
                    col_date.group(1), col_date.group(2), col_date.group(3)
                )
                if d:
                    try:
                        if datetime.strptime(d, "%Y-%m-%d").date() >= today:
                            events.append(
                                {
                                    "source_id": source_id,
                                    "place_id": venue_id,
                                    "exhibition_id": exhibition_ids.get("fall"),
                                    "title": "Columbus Day at Southern Belle Farm",
                                    "description": (
                                        "Southern Belle Farm is open on Columbus Day (Monday) with "
                                        "full fall activity admission! Corn maze, pumpkin patch, "
                                        "hayrides, pig races, and 30+ attractions. Get tickets in "
                                        "advance online."
                                    ),
                                    "start_date": d,
                                    "start_time": "10:00",
                                    "end_date": d,
                                    "end_time": "17:00",
                                    "is_all_day": False,
                                    "category": "family",
                                    "subcategory": None,
                                    "tags": [
                                        "seasonal",
                                        "family-friendly",
                                        "outdoor",
                                        "all-ages",
                                        "ticketed",
                                    ],
                                    "price_min": 18.95,
                                    "price_max": 24.95,
                                    "price_note": "Activity admission $18.95–$24.95",
                                    "is_free": False,
                                    "source_url": source_url,
                                    "ticket_url": f"{BASE_URL}/book-now/",
                                    "image_url": _season_image("fall"),
                                    "raw_text": f"Columbus Day fall activities {d}",
                                    "extraction_confidence": 0.85,
                                    "is_recurring": False,
                                    "recurrence_rule": None,
                                    "content_hash": generate_content_hash(
                                        "Columbus Day at Southern Belle Farm",
                                        "Southern Belle Farm",
                                        d,
                                    ),
                                    "_linked_season": "fall",
                                }
                            )
                    except ValueError:
                        pass

    return events


# ── WP REST API blog post scraper ─────────────────────────────────────────────

# Keywords in post titles that indicate a special event worth extracting
_SPECIAL_EVENT_KEYWORDS = [
    "festival",
    "weekend",
    "breakfast with santa",
    "donut",
    "sunflower",
    "peach",
    "tickets available",
    "anniversary",
]

# Keywords that indicate informational/seasonal-announcement posts (skip)
_SKIP_KEYWORDS = [
    "field trip",
    "employment",
    "happy new year",
    "thank you",
    "coming soon",
    "book your",
    "gift basket",
    "we will see you",
]


def _is_special_event_post(title: str) -> bool:
    """Return True if a WP post title suggests a specific event with dates."""
    title_lower = title.lower()
    if any(kw in title_lower for kw in _SKIP_KEYWORDS):
        return False
    if any(kw in title_lower for kw in _SPECIAL_EVENT_KEYWORDS):
        return True
    return False


def _fetch_post_image(session: requests.Session, media_id: int) -> Optional[str]:
    """Fetch featured image URL for a WP media ID."""
    if not media_id:
        return None
    try:
        resp = session.get(
            f"{BASE_URL}/wp-json/wp/v2/media/{media_id}",
            params={"_fields": "source_url"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("source_url")
    except Exception:
        pass
    return None


def _infer_blog_season(title: str, event_date: str) -> Optional[str]:
    """
    Infer which season exhibition a blog post event belongs to.

    Priority: title keywords (christmas/santa/holiday; strawberry/spring;
    peach/blueberry/blackberry/sunflower; pumpkin/corn maze/fall/harvest)
    before month-of-year fallback. Returns None if the month doesn't fall
    into any known season window — the event will still be emitted, just
    without an exhibition_id.
    """
    title_lower = title.lower()
    if any(kw in title_lower for kw in ("christmas", "santa", "holiday", "farmstead")):
        return "christmas"
    if any(kw in title_lower for kw in ("strawberry",)):
        return "spring"
    if any(
        kw in title_lower
        for kw in ("peach", "blueberry", "blackberry", "sunflower", "berry")
    ):
        return "summer"
    if any(kw in title_lower for kw in ("pumpkin", "corn maze", "fall", "harvest")):
        return "fall"

    # Month-of-year fallback, aligned with SEASON_DEFAULTS windows.
    try:
        month = int(event_date[5:7])
    except (ValueError, IndexError):
        return None
    if month in (4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    if month in (9, 10, 11):
        # November overlaps with Christmas launch — bias toward fall unless
        # late-November, where Farmstead Christmas begins.
        if month == 11:
            try:
                day = int(event_date[8:10])
            except (ValueError, IndexError):
                return "fall"
            return "christmas" if day >= 25 else "fall"
        return "fall"
    if month == 12:
        return "christmas"
    return None


def scrape_blog_special_events(
    session: requests.Session,
    source_id: int,
    venue_id: int,
    exhibition_ids: dict[str, Optional[str]],
) -> tuple[int, int, int]:
    """
    Pull recent WP posts and extract special events with specific dates.
    Only processes posts from the current calendar year (avoids stale data).

    Each emitted event carries `exhibition_id` pointing to the inferred
    parent season (see `_infer_blog_season`). If season inference fails,
    the event is still emitted but with `exhibition_id=None`.

    Returns (found, new, updated).
    """
    events_found = 0
    events_new = 0
    events_updated = 0
    today = datetime.now().date()
    current_year = today.year

    try:
        resp = session.get(
            WP_API_POSTS,
            params={
                "per_page": 20,
                "_fields": "id,title,date,link,content,excerpt,featured_media",
                "orderby": "date",
                "order": "desc",
            },
            timeout=20,
        )
        resp.raise_for_status()
        posts = resp.json()
    except requests.RequestException as e:
        logger.warning(f"Southern Belle Farm: WP API fetch failed: {e}")
        return 0, 0, 0

    for post in posts:
        try:
            raw_title = post.get("title", {}).get("rendered", "")
            title = _unescape(raw_title).strip()
            post_date_str = post.get("date", "")[:10]
            link = post.get("link", "")

            # Only process posts from current or next year
            try:
                post_year = int(post_date_str[:4])
                if post_year < current_year:
                    continue
            except (ValueError, TypeError):
                continue

            if not _is_special_event_post(title):
                continue

            # Extract text from content
            content_html = post.get("content", {}).get("rendered", "")
            content_text = _unescape(_page_text(content_html))

            # Try to find an event date in the content
            event_date = parse_single_date(content_text)
            if not event_date:
                # Try bare date in title or content
                m = _BARE_DATE_RE.search(content_text[:800])
                if m:
                    event_date = _to_date_str(m.group(1), m.group(2), m.group(3))

            if not event_date:
                logger.debug(
                    f"Southern Belle Farm: no date found in post '{title}' — skipping"
                )
                continue

            # Skip past events
            try:
                if datetime.strptime(event_date, "%Y-%m-%d").date() < today:
                    continue
            except ValueError:
                continue

            # Extract description from excerpt
            excerpt_html = post.get("excerpt", {}).get("rendered", "")
            description = _unescape(re.sub(r"<[^>]+>", " ", excerpt_html)).strip()
            if not description and content_text:
                description = content_text[:400]

            # Price
            price_min, price_max = parse_price(content_text[:1000])

            # Image
            media_id = post.get("featured_media", 0)
            image_url = _fetch_post_image(session, media_id)

            # Determine category and tags
            title_lower = title.lower()
            if any(kw in title_lower for kw in ["christmas", "santa", "holiday"]):
                tags = [
                    "seasonal",
                    "family-friendly",
                    "outdoor",
                    "all-ages",
                    "ticketed",
                    "holiday",
                ]
                category = "family"
            elif any(
                kw in title_lower for kw in ["sunflower", "peach", "berry", "festival"]
            ):
                tags = ["seasonal", "family-friendly", "outdoor", "all-ages"]
                category = "family"
            else:
                tags = ["seasonal", "family-friendly", "outdoor", "all-ages"]
                category = "family"

            content_hash = generate_content_hash(
                title, "Southern Belle Farm", event_date
            )

            # Infer parent season → exhibition linkage
            linked_season = _infer_blog_season(title, event_date)
            linked_exhibition_id = (
                exhibition_ids.get(linked_season) if linked_season else None
            )

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "exhibition_id": linked_exhibition_id,
                "title": title,
                "description": description[:1000] if description else None,
                "start_date": event_date,
                "start_time": "10:00",
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": category,
                "subcategory": None,
                "tags": tags,
                "price_min": price_min,
                "price_max": price_max,
                "price_note": None,
                "is_free": False,
                "source_url": link,
                "ticket_url": link,
                "image_url": image_url,
                "raw_text": content_text[:400],
                "extraction_confidence": 0.82,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            events_found += 1
            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
            else:
                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(
                        f"Southern Belle Farm: added blog event '{title}' "
                        f"({event_date}) → {linked_season or 'unlinked'} exhibition "
                        f"(exhibition_id={linked_exhibition_id})"
                    )
                except Exception as e:
                    logger.error(
                        f"Southern Belle Farm: failed to insert blog event '{title}': {e}"
                    )

        except Exception as e:
            logger.warning(f"Southern Belle Farm: error processing post: {e}")
            continue

    return events_found, events_new, events_updated


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "farm",
            "commitment_tier": "halfday",
            "primary_activity": "seasonal family farm visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["outdoor", "seasonal", "family-daytrip", "heat-day"],
            "parking_type": "free_lot",
            "best_time_of_day": "morning",
            "practical_notes": (
                "Southern Belle Farm works best as a planned seasonal outing where families pick a crop, festival, or holiday window instead of treating it like a quick drop-in stop."
            ),
            "accessibility_notes": (
                "The farm is easiest for families prepared for outdoor walking, weather exposure, and uneven ground across fields, festival areas, and seasonal queues."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Seasonal admission and activity pricing varies by crop season, festival, and special event; parking is free.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": "outdoor_venue",
                "city": "mcdonough",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "u-pick-fruit-and-flower-seasons",
            "title": "U-pick fruit and flower seasons",
            "feature_type": "amenity",
            "description": "Southern Belle's spring and summer seasons are strongest when families want a hands-on pick-your-own farm outing rather than a passive stop.",
            "url": f"{BASE_URL}/spring/",
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "fall-festival-corn-maze-and-pumpkin-patch",
            "title": "Fall festival, corn maze, and pumpkin patch",
            "feature_type": "amenity",
            "description": "Its fall season turns Southern Belle into a full seasonal family outing with a corn maze, pumpkins, and all-ages farm attractions.",
            "url": f"{BASE_URL}/fall/",
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "seasonal-farm-fun-and-holiday-return-trips",
            "title": "Seasonal farm fun and holiday return trips",
            "feature_type": "amenity",
            "description": "Southern Belle is a repeat family destination because the experience changes across berries, peaches, fall attractions, and Christmas programming.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 30,
        },
    )
    return envelope


# ── Entry point ───────────────────────────────────────────────────────────────


def _fetch_season_text(session: requests.Session, season: str) -> str:
    """Fetch a season landing page and return normalized plain text (or empty)."""
    url = SEASON_URLS[season]
    try:
        resp = session.get(url, timeout=20)
        resp.raise_for_status()
        return _unescape(_page_text(resp.text))
    except requests.RequestException as e:
        logger.warning(f"Southern Belle Farm: could not fetch {url}: {e}")
        return ""


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Southern Belle Farm as Shape E (4 seasonal exhibitions + linked
    sub-events).

    Strategy:
    1. Upsert the place (is_seasonal_only=True).
    2. For each of the 4 seasons, resolve the season window from the live
       season page (or fall back to SEASON_DEFAULTS), then upsert one
       seasonal exhibition row carrying the window + operating_schedule.
    3. Emit dated sub-events from the season pages (Donut Breakfast with
       Santa → Christmas, Sunflower Weekend → Summer, Columbus Day → Fall),
       each linked via events.exhibition_id.
    4. Emit WP blog-announced events with exhibition_id inferred from title
       keywords + event month.

    No season-window pseudo-events are emitted into the events table — the
    exhibition rows are the season carriers.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/121.0.0.0 Safari/537.36"
            )
        }
    )

    try:
        venue_id = get_or_create_place(PLACE_DATA)
        persist_typed_entity_envelope(_build_destination_envelope(venue_id))

        # ── 1. Create 4 seasonal exhibitions (one per season) ──
        # For each season: fetch the live page to resolve actual dates,
        # then upsert the exhibition. Store returned UUIDs in a dict so
        # sub-event emission can link each sub-event to its parent season.
        exhibition_ids: dict[str, Optional[str]] = {}
        season_texts: dict[str, str] = {}
        season_count = 0
        for season_key in ("spring", "summer", "fall", "christmas"):
            text = _fetch_season_text(session, season_key)
            season_texts[season_key] = text

            start_date, end_date = _resolve_season_window(season_key, text)
            season_data = {
                **SEASON_DEFAULTS[season_key],
                "start_date": start_date,
                "end_date": end_date,
            }

            try:
                ex_id = create_season_exhibition(
                    source_id, venue_id, season_key, season_data
                )
            except Exception as e:
                logger.error(
                    f"Southern Belle Farm: error creating {season_key} exhibition: {e}"
                )
                ex_id = None

            exhibition_ids[season_key] = ex_id
            if ex_id or not writes_enabled():
                season_count += 1

        logger.info(
            f"Southern Belle Farm: created/updated {season_count} seasonal "
            f"exhibitions ({list(exhibition_ids.keys())})"
        )

        # ── 2. Sub-events from each season page (linked via exhibition_id) ──
        for season_key, text in season_texts.items():
            if not text:
                continue
            try:
                f, n, u = scrape_season_page(
                    season_key, source_id, venue_id, text, exhibition_ids
                )
                events_found += f
                events_new += n
                events_updated += u
            except Exception as e:
                logger.error(
                    f"Southern Belle Farm: error on {season_key} sub-events: {e}"
                )

        # ── 3. WP blog posts — special events with inferred season link ──
        try:
            f, n, u = scrape_blog_special_events(
                session, source_id, venue_id, exhibition_ids
            )
            events_found += f
            events_new += n
            events_updated += u
        except Exception as e:
            logger.error(f"Southern Belle Farm: error in blog scraper: {e}")

        logger.info(
            f"Southern Belle Farm crawl complete: {season_count} exhibitions, "
            f"{events_found} sub-events found, {events_new} new, "
            f"{events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Southern Belle Farm: crawl failed: {e}")
        raise

    return events_found, events_new, events_updated
