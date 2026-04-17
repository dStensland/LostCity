"""
Crawler for Paranoia Haunted House (paranoiahaunt.com).

Shape A seasonal attraction: one place + one seasonal exhibition per year, no
child events. The exhibition carries the season window (opening_date /
closing_date) and operating_schedule. Per-night dated programming is NOT
emitted — Paranoia runs a continuous Fri–Sun (plus select weeknights) haunt
with a consistent format, not a series of distinct dated shows.

Site is JS-rendered and schedules live behind an image on the hours page,
so we parse what prose we can and fall back to Paranoia's published
cadence (Fri/Sat 20:00–00:00, other open nights 20:00–22:30).
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

BASE_URL = "https://www.paranoiahaunt.com"
SCHEDULE_URL = f"{BASE_URL}/hours.html"
TICKETS_URL = f"{BASE_URL}/tickets.html"

PLACE_DATA = {
    "name": "Paranoia Haunted House",
    "slug": "paranoia-haunted",
    "address": "115 Reinhardt College Pkwy",
    "neighborhood": "Canton",
    "city": "Canton",
    "state": "GA",
    "zip": "30114",
    "lat": 34.2368,
    "lng": -84.4908,
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
    """Season runs Sep–early Nov. After Nov 15, next season is next year."""
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
    while d.weekday() != 4:  # Friday
        d += timedelta(days=1)
    return d.isoformat()


def _last_saturday_before_halloween(year: int) -> str:
    """Paranoia's closing-night pattern: last Saturday on/before Halloween."""
    d = date(year, 10, 31)
    while d.weekday() != 5:  # Saturday
        d -= timedelta(days=1)
    return d.isoformat()


def _default_operating_schedule() -> dict:
    """
    Paranoia's published cadence (ticket-booth hours):
    - Fri + Sat: 20:00 open, midnight close
    - Other open nights (Thu + Sun): 20:00 open, 22:30 close
    - Mon–Wed: closed
    Hours ground on Paranoia's ticket-page summary; exact date-by-date
    mix of open vs. dark weeknights lives on a calendar image the
    parser can't reach reliably. Week-night overrides can be added if
    the site ever exposes them as text.
    """
    return {
        "default_hours": {"open": "20:00", "close": "22:30"},
        "days": {
            "monday": None,
            "tuesday": None,
            "wednesday": None,
            "thursday": {"open": "20:00", "close": "22:30"},
            "friday": {"open": "20:00", "close": "00:00"},
            "saturday": {"open": "20:00", "close": "00:00"},
            "sunday": {"open": "20:00", "close": "22:30"},
        },
        "overrides": {},
    }


def _parse_schedule(page: Page) -> tuple[Optional[str], Optional[str], dict]:
    """
    Extract (season_start, season_end, operating_schedule). Paranoia's
    hours page surfaces its schedule mostly via a calendar image; we read
    what plain text is there and fall back to the first-Fri-of-Oct /
    last-Sat-on-or-before-Halloween pattern.
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

    for pattern in (
        r"(?:Operates|Open(?:s|ing)?(?:\s+Night)?)\s+(?:on\s+)?"
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

    for pattern in (
        r"(?:thru|through|until)\s*"
        r"(November|Nov|October|Oct)\.?\s+(\d{1,2})(?:st|nd|rd|th)?",
        r"(?:clos(?:ing|es)|end(?:ing|s))\s+(?:on\s+)?"
        r"(November|Nov|October|Oct)\.?\s+(\d{1,2})(?:st|nd|rd|th)?",
        r"[–-]\s*(November|Nov|October|Oct)\.?\s+(\d{1,2})(?:st|nd|rd|th)?",
    ):
        m = re.search(pattern, flat_text, re.IGNORECASE)
        if m:
            candidate = _parse_date_string(m.group(1), m.group(2), year)
            if candidate:
                season_end = candidate
                break

    if not season_start:
        season_start = _first_friday_of_october(year)
        logger.info(
            f"Paranoia: no explicit opening date on page — inferring "
            f"first Friday of Oct {year} = {season_start}"
        )
    if not season_end:
        season_end = _last_saturday_before_halloween(year)
        logger.info(
            f"Paranoia: no explicit closing date on page — inferring "
            f"last Sat on/before Halloween {year} = {season_end}"
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
        "slug": f"paranoia-haunted-house-seasonal-{year}",
        "place_id": venue_id,
        "source_id": source_id,
        "title": f"Paranoia Haunted House {year} Season",
        "description": (
            f"Paranoia Haunted House returns for its {year} season in Canton "
            f"with two separate themed haunts. Open weekends from "
            f"{season_start[5:]} through {season_end[5:]} — Fridays and "
            f"Saturdays run until midnight, with earlier closings on other "
            f"open nights."
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
            "canton",
        ],
    }

    exhibition_id = insert_exhibition(exhibition_data)
    if exhibition_id:
        logger.info(
            f"Paranoia: upserted seasonal exhibition "
            f"({season_start} to {season_end}, id={exhibition_id})"
        )
    return exhibition_id


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Paranoia Haunted House.
    1. Upsert the place (attraction, is_seasonal_only=True).
    2. Parse season window + operating schedule from the hours page.
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

            logger.info(f"Fetching Paranoia Haunted House: {SCHEDULE_URL}")
            try:
                page.goto(SCHEDULE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)
            except Exception as e:
                logger.warning(f"Paranoia: page fetch failed ({e}) — using defaults")

            try:
                season_start, season_end, operating_schedule = _parse_schedule(page)
            except Exception as e:
                logger.error(f"Paranoia: schedule parse failed: {e}")
                browser.close()
                return 0, 0, 0

            browser.close()

        if not season_start or not season_end:
            logger.warning(
                f"Paranoia: could not extract season window "
                f"(start={season_start}, end={season_end}) — skipping exhibition upsert"
            )
            return 0, 0, 0

        exhibition_id = create_seasonal_exhibition(
            source_id, venue_id, season_start, season_end, operating_schedule
        )

        if exhibition_id:
            logger.info(
                f"Paranoia crawl complete: 1 seasonal exhibition "
                f"({season_start} to {season_end})"
            )
            return 1, 1, 0

        if not writes_enabled():
            logger.info(
                f"Paranoia dry-run complete: 1 seasonal exhibition would be "
                f"upserted ({season_start} to {season_end})"
            )
            return 1, 1, 0

        logger.warning("Paranoia: exhibition upsert returned no id")
        return 0, 0, 0

    except Exception as e:
        logger.error(f"Failed to crawl Paranoia Haunted House: {e}")
        raise
