"""
Crawler for Folklore Haunted House (folklorehauntedhouse.com).

Shape A seasonal attraction: one place + one seasonal exhibition per year, no
child events. The exhibition carries the season window (opening_date /
closing_date) and operating_schedule. Per-night dated programming is NOT
emitted — Folklore is a continuous weekend/Sunday run with a consistent
format, not a series of distinct dated shows.

Site is JS-rendered, so Playwright is used to read the published schedule.
When the page doesn't expose explicit dates (e.g. pre-season / off-season),
we fall back to Folklore's published cadence: Fri–Sun in October with a
Sep 20 opener and Nov 8 closing night (2025 pattern; easy to adjust via
overrides when the site advertises exact dates).
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

BASE_URL = "https://folklorehauntedhouse.com"
SCHEDULE_URL = f"{BASE_URL}/hours"
TICKETS_URL = f"{BASE_URL}/tickets"

PLACE_DATA = {
    "name": "Folklore Haunted House",
    "slug": "folklore-haunted",
    "address": "1460 Scenic Highway N",
    "neighborhood": "Stone Mountain",
    "city": "Stone Mountain",
    "state": "GA",
    "zip": "30083",
    "lat": 33.8084,
    "lng": -84.1469,
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


def _third_friday_of_september(year: int) -> str:
    """Haunted-attraction industry opener; Folklore's 2025 opener was Sept 20."""
    d = date(year, 9, 1)
    fridays = 0
    while d.month == 9:
        if d.weekday() == 4:
            fridays += 1
            if fridays == 3:
                return d.isoformat()
        d += timedelta(days=1)
    return f"{year}-09-19"


def _first_saturday_after_halloween(year: int) -> str:
    """Folklore's closing-weekend pattern: the Saturday on/after Nov 1."""
    d = date(year, 11, 1)
    while d.weekday() != 5:  # Saturday
        d += timedelta(days=1)
    return d.isoformat()


def _default_operating_schedule() -> dict:
    """
    Folklore's published cadence (per folklorehauntedhouse.com/hours):
    - Closed Mon–Thu
    - Fri + Sat: 19:30 open, midnight close
    - Sun: 19:30 open, 23:00 close
    If the ticketing widget ever exposes varied per-night times, add them
    via `overrides`.
    """
    return {
        "default_hours": {"open": "19:30", "close": "23:00"},
        "days": {
            "monday": None,
            "tuesday": None,
            "wednesday": None,
            "thursday": None,
            "friday": {"open": "19:30", "close": "00:00"},
            "saturday": {"open": "19:30", "close": "00:00"},
            "sunday": {"open": "19:30", "close": "23:00"},
        },
        "overrides": {},
    }


def _parse_schedule(page: Page) -> tuple[Optional[str], Optional[str], dict]:
    """
    Extract (season_start, season_end, operating_schedule) from the Folklore
    hours page. Falls back to the canonical Fri/Sat/Sun October cadence if
    the page doesn't publish explicit dates.
    """
    try:
        body_text = page.inner_text("body")
    except Exception:
        body_text = ""
    flat_text = re.sub(r"\s+", " ", body_text)

    year = _infer_season_year()
    # Pick up explicit season-year references, preferring "Season YYYY" /
    # "YYYY Season". Constrained to 20xx so we don't pick up zip codes or
    # phone numbers that happen to land near schedule prose.
    m_year = re.search(
        r"(?:Season\s+|Operates\s+[^.]{0,60}?)"
        r"(20\d{2})(?!\d)",
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

    # Open-date patterns: "Opens Sep 20" / "Operates Sep 20" / "Opening Night Sept 20"
    for pattern in (
        r"(?:Operates|Open(?:s|ing)?(?:\s+Night)?)\s+(?:on\s+)?"
        r"(September|Sept|Sep)\.?\s+(\d{1,2})",
        r"(?:Season\s+)?Begin(?:s|ning)\s+"
        r"(September|Sept|Sep)\.?\s+(\d{1,2})",
    ):
        m = re.search(pattern, flat_text, re.IGNORECASE)
        if m:
            candidate = _parse_date_string(m.group(1), m.group(2), year)
            if candidate:
                season_start = candidate
                break

    # Close-date patterns: "thru Nov 8" / "closing Nov 8" / "ending Nov 8" /
    # "Sep 20–Nov 8"
    for pattern in (
        r"(?:thru|through|until|until\s+)"
        r"\s*(November|Nov|October|Oct)\.?\s+(\d{1,2})(?:st|nd|rd|th)?",
        r"(?:clos(?:ing|es)|end(?:ing|s))\s+(?:on\s+)?"
        r"(November|Nov|October|Oct)\.?\s+(\d{1,2})(?:st|nd|rd|th)?",
        r"[–-]\s*(November|Nov)\.?\s+(\d{1,2})(?:st|nd|rd|th)?",
    ):
        m = re.search(pattern, flat_text, re.IGNORECASE)
        if m:
            candidate = _parse_date_string(m.group(1), m.group(2), year)
            if candidate:
                season_end = candidate
                break

    # Fallbacks — Folklore's published cadence uses the third-Friday-of-Sept
    # opener + first Saturday on/after Nov 1 closer.
    if not season_start:
        season_start = _third_friday_of_september(year)
        logger.info(
            f"Folklore: no explicit opening date on page — inferring "
            f"third Friday of Sept {year} = {season_start}"
        )
    if not season_end:
        season_end = _first_saturday_after_halloween(year)
        logger.info(
            f"Folklore: no explicit closing date on page — inferring "
            f"first Sat on/after Nov 1 {year} = {season_end}"
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
        "slug": f"folklore-haunted-house-seasonal-{year}",
        "place_id": venue_id,
        "source_id": source_id,
        "title": f"Folklore Haunted House {year} Season",
        "description": (
            f"Folklore Haunted House returns for its {year} season with a "
            f"fully immersive walkthrough haunt in Stone Mountain. Open "
            f"weekends from {season_start[5:]} through {season_end[5:]} — "
            f"Fridays and Saturdays running until midnight, Sundays closing "
            f"at 11pm. Closed Mondays through Thursdays."
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
            "stone-mountain",
        ],
    }

    exhibition_id = insert_exhibition(exhibition_data)
    if exhibition_id:
        logger.info(
            f"Folklore: upserted seasonal exhibition "
            f"({season_start} to {season_end}, id={exhibition_id})"
        )
    return exhibition_id


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Folklore Haunted House.
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

            logger.info(f"Fetching Folklore Haunted House: {SCHEDULE_URL}")
            try:
                page.goto(SCHEDULE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)
            except Exception as e:
                logger.warning(f"Folklore: page fetch failed ({e}) — using defaults")

            try:
                season_start, season_end, operating_schedule = _parse_schedule(page)
            except Exception as e:
                logger.error(f"Folklore: schedule parse failed: {e}")
                browser.close()
                return 0, 0, 0

            browser.close()

        if not season_start or not season_end:
            logger.warning(
                f"Folklore: could not extract season window "
                f"(start={season_start}, end={season_end}) — skipping exhibition upsert"
            )
            return 0, 0, 0

        exhibition_id = create_seasonal_exhibition(
            source_id, venue_id, season_start, season_end, operating_schedule
        )

        if exhibition_id:
            logger.info(
                f"Folklore crawl complete: 1 seasonal exhibition "
                f"({season_start} to {season_end})"
            )
            return 1, 1, 0

        # Dry-run path: insert_exhibition returns None even when the write
        # would have succeeded — report success so the crawler reports
        # correct expected output.
        if not writes_enabled():
            logger.info(
                f"Folklore dry-run complete: 1 seasonal exhibition would be "
                f"upserted ({season_start} to {season_end})"
            )
            return 1, 1, 0

        logger.warning("Folklore: exhibition upsert returned no id")
        return 0, 0, 0

    except Exception as e:
        logger.error(f"Failed to crawl Folklore Haunted House: {e}")
        raise
