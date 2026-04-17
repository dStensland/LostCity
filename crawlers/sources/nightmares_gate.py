"""
Crawler for Nightmare's Gate (nightmaresgate.com).

Shape A seasonal attraction: one place + one seasonal exhibition per year, no
child events. The exhibition carries the season window (opening_date /
closing_date) and operating_schedule. Per-night dated programming is NOT
emitted — Nightmare's Gate runs a continuous Fri/Sat/Sun haunt with a
consistent format.

Site is JS-rendered; schedule prose lives on /schedule.html.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_place
from db.client import writes_enabled
from db.exhibitions import insert_exhibition

logger = logging.getLogger(__name__)

BASE_URL = "https://www.nightmaresgate.com"
SCHEDULE_URL = f"{BASE_URL}/schedule.html"
TICKETS_URL = f"{BASE_URL}/tickets.html"

PLACE_DATA = {
    "name": "Nightmare's Gate",
    "slug": "nightmares-gate",
    "address": "1950 Lee Rd",
    "neighborhood": "Lithia Springs",
    "city": "Lithia Springs",
    "state": "GA",
    "zip": "30122",
    "lat": 33.7739,
    "lng": -84.6356,
    "place_type": "attraction",
    "spot_type": "attraction",
    "is_seasonal_only": True,
    "website": BASE_URL,
}

_MONTH_MAP: dict[str, int] = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9, "sept": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}


def _infer_season_year() -> int:
    """Season runs Oct–early Nov. After Nov 15, next season is next year."""
    today = datetime.now()
    if today.month > 11 or (today.month == 11 and today.day > 15):
        return today.year + 1
    return today.year


def _parse_date_string(month_str: str, day_str: str, year: int) -> Optional[str]:
    month = _MONTH_MAP.get(month_str.lower().rstrip("."))
    if not month:
        return None
    try:
        return f"{year}-{month:02d}-{int(day_str):02d}"
    except (ValueError, TypeError):
        return None


def _first_friday_of_october(year: int) -> str:
    d = date(year, 10, 1)
    while d.weekday() != 4:
        d += timedelta(days=1)
    return d.isoformat()


def _first_sunday_of_november(year: int) -> str:
    """Nightmare's Gate's closing pattern: first Sunday of November."""
    d = date(year, 11, 1)
    while d.weekday() != 6:  # Sunday
        d += timedelta(days=1)
    return d.isoformat()


def _default_operating_schedule() -> dict:
    """
    Nightmare's Gate published cadence (nightmaresgate.com/schedule.html):
    - Fridays + Saturdays in October through Nov 1: 20:00 open, midnight close
    - Sundays in October + Nov 2: 20:00 open, 23:00 close
    - Mon–Thu: closed
    """
    return {
        "default_hours": {"open": "20:00", "close": "23:00"},
        "days": {
            "monday": None,
            "tuesday": None,
            "wednesday": None,
            "thursday": None,
            "friday": {"open": "20:00", "close": "00:00"},
            "saturday": {"open": "20:00", "close": "00:00"},
            "sunday": {"open": "20:00", "close": "23:00"},
        },
        "overrides": {},
    }


def _parse_schedule(page: Page) -> tuple[Optional[str], Optional[str], dict]:
    """
    Extract (season_start, season_end, operating_schedule) from the
    /schedule.html page. Falls back to Nightmare's Gate's published
    cadence if the page doesn't expose explicit dates.
    """
    try:
        body_text = page.inner_text("body")
    except Exception:
        body_text = ""
    flat_text = re.sub(r"\s+", " ", body_text)

    year = _infer_season_year()
    m_year = re.search(
        r"(?:Season\s+|Operates\s+[^.]{0,60}?)(20\d{2})(?!\d)",
        flat_text,
        re.IGNORECASE,
    )
    if not m_year:
        m_year = re.search(r"(20\d{2})\s+Season", flat_text)
    if m_year:
        try:
            year = int(m_year.group(1))
        except ValueError:
            pass

    season_start: Optional[str] = None
    season_end: Optional[str] = None

    # Opening date: "Every Friday & Saturday from October 3 ..." /
    # "Opens October 3" / "Operates Oct 3".
    for pattern in (
        r"(?:Operates|Open(?:s|ing)?(?:\s+Night)?|from)\s+(?:on\s+)?"
        r"(September|Sept|Sep|October|Oct)\.?\s+(\d{1,2})",
        r"(?:Season\s+)?Begin(?:s|ning)\s+"
        r"(September|Sept|Sep|October|Oct)\.?\s+(\d{1,2})",
    ):
        m = re.search(pattern, flat_text, re.IGNORECASE)
        if m:
            candidate = _parse_date_string(m.group(1), m.group(2), year)
            if candidate:
                season_start = candidate
                break

    # Closing date: "October 3-November 1" / "+ November 2" / "thru Nov 2".
    for pattern in (
        r"(?:thru|through|until|\+)\s*"
        r"(November|Nov|October|Oct)\.?\s+(\d{1,2})(?:st|nd|rd|th)?",
        r"(?:clos(?:ing|es)|end(?:ing|s))\s+(?:on\s+)?"
        r"(November|Nov|October|Oct)\.?\s+(\d{1,2})(?:st|nd|rd|th)?",
        r"[–-]\s*(November|Nov|October|Oct)\.?\s+(\d{1,2})(?:st|nd|rd|th)?",
    ):
        for m in re.finditer(pattern, flat_text, re.IGNORECASE):
            candidate = _parse_date_string(m.group(1), m.group(2), year)
            if candidate and (not season_end or candidate > season_end):
                season_end = candidate

    if not season_start:
        season_start = _first_friday_of_october(year)
        logger.info(
            f"Nightmare's Gate: no explicit opening date on page — inferring "
            f"first Friday of Oct {year} = {season_start}"
        )
    if not season_end:
        season_end = _first_sunday_of_november(year)
        logger.info(
            f"Nightmare's Gate: no explicit closing date on page — inferring "
            f"first Sunday of Nov {year} = {season_end}"
        )

    return season_start, season_end, _default_operating_schedule()


def create_seasonal_exhibition(
    source_id: int,
    venue_id: int,
    season_start: str,
    season_end: str,
    operating_schedule: dict,
) -> Optional[str]:
    """Upsert the seasonal exhibition. Year-scoped slug preserves history."""
    year = season_start[:4]
    exhibition_data = {
        "slug": f"nightmares-gate-seasonal-{year}",
        "place_id": venue_id,
        "source_id": source_id,
        "title": f"Nightmare's Gate {year} Season",
        "description": (
            f"Nightmare's Gate returns for its {year} season in Lithia "
            f"Springs. Open weekends from {season_start[5:]} through "
            f"{season_end[5:]} — Fridays and Saturdays running until "
            f"midnight, Sundays closing at 11pm. Closed Monday through "
            f"Thursday."
        ),
        "opening_date": season_start,
        "closing_date": season_end,
        "exhibition_type": "seasonal",
        "admission_type": "ticketed",
        "admission_url": TICKETS_URL,
        "source_url": SCHEDULE_URL,
        "operating_schedule": operating_schedule,
        "tags": [
            "seasonal",
            "haunted",
            "halloween",
            "horror",
            "ticketed",
            "lithia-springs",
        ],
    }

    exhibition_id = insert_exhibition(exhibition_data)
    if exhibition_id:
        logger.info(
            f"Nightmare's Gate: upserted seasonal exhibition "
            f"({season_start} to {season_end}, id={exhibition_id})"
        )
    return exhibition_id


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Nightmare's Gate.
    1. Upsert the place (attraction, is_seasonal_only=True).
    2. Parse season window + operating schedule from /schedule.html.
    3. Upsert one seasonal exhibition carrying the season window.
    Shape A: emits zero events.
    """
    source_id = source["id"]

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_place(PLACE_DATA)

            logger.info(f"Fetching Nightmare's Gate: {SCHEDULE_URL}")
            try:
                page.goto(SCHEDULE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)
            except Exception as e:
                logger.warning(f"Nightmare's Gate: page fetch failed ({e}) — using defaults")

            try:
                season_start, season_end, operating_schedule = _parse_schedule(page)
            except Exception as e:
                logger.error(f"Nightmare's Gate: schedule parse failed: {e}")
                browser.close()
                return 0, 0, 0

            browser.close()

        if not season_start or not season_end:
            logger.warning(
                f"Nightmare's Gate: could not extract season window "
                f"(start={season_start}, end={season_end}) — skipping exhibition upsert"
            )
            return 0, 0, 0

        exhibition_id = create_seasonal_exhibition(
            source_id, venue_id, season_start, season_end, operating_schedule
        )

        if exhibition_id:
            logger.info(
                f"Nightmare's Gate crawl complete: 1 seasonal exhibition "
                f"({season_start} to {season_end})"
            )
            return 1, 1, 0

        if not writes_enabled():
            logger.info(
                f"Nightmare's Gate dry-run complete: 1 seasonal exhibition would be "
                f"upserted ({season_start} to {season_end})"
            )
            return 1, 1, 0

        logger.warning("Nightmare's Gate: exhibition upsert returned no id")
        return 0, 0, 0

    except Exception as e:
        logger.error(f"Failed to crawl Nightmare's Gate: {e}")
        raise
