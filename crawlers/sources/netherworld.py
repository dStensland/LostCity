"""
Crawler for Netherworld Haunted House (netherworldhauntedhouse.net / fearworld.com).

Shape A seasonal attraction: one place + one seasonal exhibition per year, no
child events. The exhibition carries the season window (opening_date /
closing_date) and operating_schedule. Per-night dated programming is NOT
emitted — Netherworld is a continuous nightly run with consistent format,
not a series of distinct dated shows.

Site is JS-rendered, so Playwright is used to read the schedule prose.

Data strategy:
- Parse the opening date, closing date, and the "Open Nightly thru" / weekend
  cadence from the body text on the homepage.
- Build an operating_schedule dict from the prevailing weekday pattern and
  put any date-specific exceptions in `overrides`.
- Upsert the place (is_seasonal_only=True) and the seasonal exhibition.

Special nights worth tracking as one-offs in the future (NOT in scope here):
- Opening night
- "Lights On" daytime kid-friendly tours (last weekend only)
- Closing night
These would be `events.exhibition_id` linked rows; deferred until product
need is clear.
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from datetime import date, datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_place
from db.client import writes_enabled
from db.exhibitions import insert_exhibition

logger = logging.getLogger(__name__)

BASE_URL = "https://www.netherworldhauntedhouse.net"
SCHEDULE_URL = BASE_URL
TICKETS_URL = "https://bit.ly/NWTIX"

PLACE_DATA = {
    "name": "Netherworld Haunted House",
    "slug": "netherworld",
    "address": "1313 Netherworld Way",
    "neighborhood": "Stone Mountain",
    "city": "Stone Mountain",
    "state": "GA",
    "zip": "30087",
    "lat": 33.8081,
    "lng": -84.1468,
    "place_type": "attraction",
    "spot_type": "attraction",
    "is_seasonal_only": True,
    "website": BASE_URL,
}

# ── Month name lookup ─────────────────────────────────────────────────────────
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

def _parse_date_string(month_str: str, day_str: str, year_str: Optional[str]) -> Optional[str]:
    """Convert a parsed month/day/year tuple to a 'YYYY-MM-DD' string."""
    month = _MONTH_MAP.get(month_str.lower().rstrip("."))
    if not month:
        return None
    try:
        day = int(day_str)
        year = int(year_str) if year_str else _infer_season_year()
        return f"{year}-{month:02d}-{day:02d}"
    except (ValueError, TypeError):
        return None


def _infer_season_year() -> int:
    """
    Netherworld runs Sept–Nov. If we're past November of this year, the
    next season is next year. Otherwise it's this year.
    """
    today = datetime.now()
    if today.month > 11 or (today.month == 11 and today.day > 15):
        return today.year + 1
    return today.year


def _detect_year_from_text(flat_text: str) -> Optional[int]:
    """
    Look for the dominant year referenced in season-related prose
    ("Final Nights in 2025", "NETHERWORLD 2025", "two final nights in 2025"
    etc.). Returns the year or None.
    """
    # Count year mentions in the prose surrounding season keywords
    candidates = re.findall(
        r"(?:in\s+|NETHERWORLD\s+|nights?\s+in\s+|final\s+\w+\s+in\s+|"
        r"season\s+|haunts\s+in\s+)(\d{4})",
        flat_text,
        re.IGNORECASE,
    )
    if not candidates:
        return None
    # Return the most common year (handles cases where current + next season
    # are both mentioned)
    most_common = Counter(int(y) for y in candidates).most_common(1)
    return most_common[0][0] if most_common else None


def _third_friday_of_september(year: int) -> str:
    """
    Netherworld's traditional opening night: the third Friday of September.
    Used as a fallback when the homepage doesn't list an explicit opening date
    (e.g. mid-season pages or post-season residual pages).
    """
    d = date(year, 9, 1)
    fridays_seen = 0
    while d.month == 9:
        if d.weekday() == 4:  # Friday
            fridays_seen += 1
            if fridays_seen == 3:
                return d.isoformat()
        d += timedelta(days=1)
    # Fallback (shouldn't hit): Sept 19
    return f"{year}-09-19"


def _default_operating_schedule() -> dict:
    """
    Default Netherworld operating schedule.

    Hours grounded in haunted-house industry norms and Netherworld's published
    cadence (Fri–Sun only early September, nightly thru early November, then
    a final Fri–Sat closing weekend). Specific nightly close times are not
    published on the public site outside the ticketing widget; Sunday +
    weeknights wind down ~23:00, Fri/Sat run later (~00:30 next morning).

    If the ticketing widget ever exposes exact times, swap them in here and
    in `overrides` for specific dates.
    """
    return {
        "default_hours": {"open": "19:30", "close": "23:00"},
        "days": {
            "monday": None,
            "tuesday": None,
            "wednesday": None,
            "thursday": {"open": "19:30", "close": "23:00"},
            "friday": {"open": "19:30", "close": "00:30"},
            "saturday": {"open": "19:30", "close": "00:30"},
            "sunday": {"open": "19:30", "close": "23:00"},
        },
        "overrides": {},
    }


def _parse_schedule(page: Page) -> tuple[Optional[str], Optional[str], dict]:
    """
    Extract season_start, season_end, and operating_schedule from the
    Netherworld homepage.

    Strategy:
    1. Look for explicit "Opening Night" / "Open <Date>" prose.
    2. Look for the closing-night phrasing ("two final nights ... November Xth
       and November Yth", or "closing Saturday <Date>").
    3. Derive an operating_schedule from the published weekend-vs-nightly
       cadence (Fri–Sun in Sept, nightly Oct–early Nov, Fri–Sat closing).

    Returns (season_start, season_end, operating_schedule). Season dates may
    be None if parsing fails; the caller should handle that.
    """
    body_text = page.inner_text("body")
    # Collapse whitespace for easier regex matching
    flat_text = re.sub(r"\s+", " ", body_text)
    # Prefer the year referenced in the page's season prose; fall back to
    # the inferred current season year if no explicit year is found.
    detected_year = _detect_year_from_text(flat_text)
    year = detected_year or _infer_season_year()

    season_start: Optional[str] = None
    season_end: Optional[str] = None

    # --- Opening date ---
    # Look for "Opens" / "Opening Night" / "Open <Day>, <Date>" phrasing.
    # Off-season pages may not list an explicit opener; falls back to
    # the canonical "third Friday of September" below.
    opening_patterns = [
        r"Open(?:s|ing)?\s+(?:Night\s+)?(?:on\s+)?"
        r"(?:Friday|Saturday|Sunday|Thursday|Monday|Tuesday|Wednesday)?,?\s*"
        r"(September|Sept|Sep|October|Oct)\.?\s+(\d{1,2})",
        r"(?:Season\s+)?Begin(?:s|ning)\s+"
        r"(?:Friday|Saturday|Sunday|Thursday)?,?\s*"
        r"(September|Sept|Sep|October|Oct)\.?\s+(\d{1,2})",
    ]
    for pattern in opening_patterns:
        m = re.search(pattern, flat_text, re.IGNORECASE)
        if m:
            season_start = _parse_date_string(m.group(1), m.group(2), str(year))
            if season_start:
                break

    # --- Closing date ---
    # "two final nights ... November 7th and November 8th" / "closing November 8"
    closing_patterns = [
        # "final nights on Friday, November 7th and Saturday, November 8th"
        r"final\s+night[s]?\s+(?:on\s+)?(?:in\s+\d{4}\s+)?"
        r"(?:on\s+)?(?:Friday|Saturday|Sunday|Thursday)?,?\s*"
        r"(November|Nov|October|Oct)\.?\s+(\d{1,2})(?:st|nd|rd|th)?"
        r"(?:[^.]*?(?:and|&)\s*"
        r"(?:Friday|Saturday|Sunday)?,?\s*"
        r"(?:(November|Nov|October|Oct)\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?)?",
        # "closing Saturday November 8" / "ending November 8th"
        r"(?:clos(?:ing|es)|end(?:ing|s))\s+"
        r"(?:on\s+)?(?:Friday|Saturday|Sunday|Thursday)?,?\s*"
        r"(November|Nov|October|Oct)\.?\s+(\d{1,2})(?:st|nd|rd|th)?",
        # "thru November 8th"
        r"(?:thru|through)\s+"
        r"(November|Nov|October|Oct)\.?\s+(\d{1,2})(?:st|nd|rd|th)?",
    ]
    for pattern in closing_patterns:
        for m in re.finditer(pattern, flat_text, re.IGNORECASE):
            # If a second date is captured, prefer it (it's the later closing night)
            if m.lastindex and m.lastindex >= 4 and m.group(4):
                month_str = m.group(3) or m.group(1)
                day_str = m.group(4)
            else:
                month_str = m.group(1)
                day_str = m.group(2)
            candidate = _parse_date_string(month_str, day_str, str(year))
            if candidate:
                # Keep the latest date found
                if not season_end or candidate > season_end:
                    season_end = candidate

    # --- Opening date fallback ---
    # If no explicit opening prose was found but we have a closing date in
    # November, infer the canonical "third Friday of September" of the same
    # year. This is Netherworld's traditional opening cadence.
    if not season_start and season_end:
        season_start = _third_friday_of_september(int(season_end[:4]))
        logger.info(
            f"Netherworld: no explicit opening date on page — inferring "
            f"third Friday of Sept {season_end[:4]} = {season_start}"
        )

    operating_schedule = _default_operating_schedule()

    # If the page describes a "nightly thru <date>" run + explicit closing
    # nights, mark the dark days between as overrides.
    # Pattern: nightly thru Nov 2, dark Nov 3-6, Fri-Sat Nov 7-8 only.
    if season_end and season_end.startswith(f"{year}-11-") and int(season_end[-2:]) >= 7:
        # Find the last "nightly thru" date
        m_nightly = re.search(
            r"(?:Open\s+)?Nightly\s+(?:thru|through)\s+"
            r"(November|Nov|October|Oct)\.?\s+(\d{1,2})(?:st|nd|rd|th)?",
            flat_text,
            re.IGNORECASE,
        )
        if m_nightly:
            nightly_end = _parse_date_string(
                m_nightly.group(1), m_nightly.group(2), str(year)
            )
            if nightly_end:
                # Find the explicit closing-night dates ("two final nights ...
                # November 7th and November 8th"). Use the EARLIEST as the
                # start of the closing run; everything between nightly_end+1
                # and that date is dark.
                try:
                    nightly_end_date = datetime.strptime(
                        nightly_end, "%Y-%m-%d"
                    ).date()
                    final_close = datetime.strptime(season_end, "%Y-%m-%d").date()

                    # Look for explicit "and <Month> <Day>" closing-pair phrasing
                    closing_run_start = final_close
                    m_pair = re.search(
                        r"final\s+night[s]?\s+(?:on\s+)?(?:in\s+\d{4}\s+)?"
                        r"(?:on\s+)?(?:Friday|Saturday|Sunday|Thursday)?,?\s*"
                        r"(November|Nov)\.?\s+(\d{1,2})(?:st|nd|rd|th)?"
                        r"\s*(?:and|&)\s*"
                        r"(?:Friday|Saturday|Sunday)?,?\s*"
                        r"(?:(November|Nov)\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?",
                        flat_text,
                        re.IGNORECASE,
                    )
                    if m_pair:
                        # Two dates given; first is the run start
                        first_str = _parse_date_string(
                            m_pair.group(1), m_pair.group(2), str(year)
                        )
                        if first_str:
                            try:
                                closing_run_start = datetime.strptime(
                                    first_str, "%Y-%m-%d"
                                ).date()
                            except ValueError:
                                pass

                    # Mark every day between nightly_end+1 and
                    # closing_run_start-1 as dark.
                    cur = nightly_end_date + timedelta(days=1)
                    while cur < closing_run_start:
                        weekday = cur.strftime("%A").lower()
                        if operating_schedule["days"].get(weekday) is not None:
                            operating_schedule["overrides"][cur.isoformat()] = None
                        cur += timedelta(days=1)
                except ValueError:
                    pass

    return season_start, season_end, operating_schedule


def create_seasonal_exhibition(
    source_id: int,
    venue_id: int,
    season_start: str,
    season_end: str,
    operating_schedule: dict,
) -> Optional[str]:
    """
    Upsert the seasonal exhibition row. Year-scoped slug so a new row is
    created each season; historical rows are preserved.
    """
    year = season_start[:4]
    exhibition_data = {
        "slug": f"netherworld-haunted-house-seasonal-{year}",
        "place_id": venue_id,
        "source_id": source_id,
        "title": f"Netherworld Haunted House {year} Season",
        "description": (
            f"Atlanta's premier haunted attraction returns for its {year} season "
            f"in Stone Mountain. Two terrifying haunts, monster-filled queue "
            f"experience, escape rooms, and themed photo ops fill 35+ chilling "
            f"nights from {season_start[5:]} through {season_end[5:]}. "
            f"Open Fridays and weekends in September, then nightly through "
            f"early November, with a final closing weekend in early November."
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
            "ticketed",
            "stone-mountain",
        ],
    }

    exhibition_id = insert_exhibition(exhibition_data)
    if exhibition_id:
        logger.info(
            f"Netherworld: upserted seasonal exhibition "
            f"({season_start} to {season_end}, id={exhibition_id})"
        )
    return exhibition_id


# ── Entry point ───────────────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Netherworld Haunted House.
    Strategy:
    1. Upsert the place (attraction, is_seasonal_only=True).
    2. Parse season window + operating schedule from the homepage.
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

            logger.info(f"Fetching Netherworld Haunted House: {SCHEDULE_URL}")
            page.goto(SCHEDULE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            try:
                season_start, season_end, operating_schedule = _parse_schedule(page)
            except Exception as e:
                logger.error(f"Netherworld: schedule parse failed: {e}")
                browser.close()
                return 0, 0, 0

            browser.close()

        if not season_start or not season_end:
            logger.warning(
                f"Netherworld: could not extract season window "
                f"(start={season_start}, end={season_end}) — skipping exhibition upsert"
            )
            return 0, 0, 0

        exhibition_id = create_seasonal_exhibition(
            source_id, venue_id, season_start, season_end, operating_schedule
        )

        if exhibition_id:
            logger.info(
                f"Netherworld crawl complete: 1 seasonal exhibition "
                f"({season_start} to {season_end})"
            )
            return 1, 1, 0

        # In dry-run mode, insert_exhibition returns None even though the
        # write would have succeeded — report success in that case so the
        # crawler shows correct expected output.
        if not writes_enabled():
            logger.info(
                f"Netherworld dry-run complete: 1 seasonal exhibition would be "
                f"upserted ({season_start} to {season_end})"
            )
            return 1, 1, 0

        logger.warning("Netherworld: exhibition upsert returned no id")
        return 0, 0, 0

    except Exception as e:
        logger.error(f"Failed to crawl Netherworld Haunted House: {e}")
        raise
