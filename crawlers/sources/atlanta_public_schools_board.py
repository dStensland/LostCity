"""
Crawler for Atlanta Public Schools (APS) Board of Education meetings.

Source: https://www.atlantapublicschools.us/boe
Platform: Finalsite CMS — calendar rendered as a slick slideshow on the BOE page.
Requires Playwright for JS rendering.

The BOE page contains an "Upcoming Board Meetings" carousel that lists
upcoming board and committee meetings alongside academic calendar entries.
We filter for board/committee meetings and discard school holidays, release days, etc.

Meeting types crawled:
- Monthly Board Meeting (~monthly)
- Audit Committee Meeting
- Budget Commission Meeting
- Accountability Commission Meeting
- Personnel Hearing
- Community Meeting (virtual, district-specific)
- Work Session

Venue: Alonzo A. Crim Center for Learning and Leadership
       130 Trinity Ave SW, Atlanta, GA 30303 (Downtown)
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BOE_URL = "https://www.atlantapublicschools.us/boe"

PLACE_DATA = {
    "name": "Alonzo A. Crim Center for Learning and Leadership",
    "slug": "alonzo-a-crim-center",
    "address": "130 Trinity Ave SW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7489,
    "lng": -84.3940,
    "place_type": "community_center",
    "spot_type": "community_center",
    "website": "https://www.atlantapublicschools.us",
}

EVENT_TAGS = [
    "education",
    "school-board",
    "atlanta-public-schools",
    "attend",
    "public-comment",
    "government",
    "civic",
]

# Keywords that identify academic-calendar entries to skip.
SKIP_KEYWORDS: list[str] = [
    "early release",
    "spring break",
    "fall break",
    "winter break",
    "thanksgiving",
    "last day of school",
    "first day of school",
    "memorial day",
    "juneteenth",
    "independence day",
    "labor day",
    "martin luther king",
    "veterans day",
    "teacher",
    "pre-planning",
    "post-planning",
    "staff development",
    "professional learning",
    "no school",
    "school closed",
    "student holiday",
    "report card",
    "progress report",
    "kindergarten registration",
    "enrollment",
    "testing window",
    "milestones",
    "graduation",
    "commencement",
    "district calendar",
]

# Keywords that positively identify board/committee meetings.
MEETING_KEYWORDS: list[str] = [
    "board meeting",
    "board of education",
    "audit committee",
    "budget commission",
    "accountability commission",
    "personnel hearing",
    "community meeting",
    "special called",
    "work session",
    "executive session",
    "committee meeting",
    "public hearing",
    "town hall",
    "superintendent",
]

# Per-meeting-type descriptions
_MEETING_DESCRIPTIONS: dict[str, str] = {
    "board meeting": (
        "Atlanta Public Schools Board of Education monthly meeting. "
        "Public comment is accepted at the beginning of the session."
    ),
    "board of education": (
        "Atlanta Public Schools Board of Education meeting. "
        "Public comment is accepted at the beginning of the session."
    ),
    "audit committee": "APS Audit Committee meeting. Open to the public.",
    "budget commission": "APS Budget Commission meeting. Open to the public.",
    "accountability commission": "APS Accountability Commission meeting. Open to the public.",
    "personnel hearing": "APS Personnel Hearing. Open to the public.",
    "community meeting": (
        "Atlanta Public Schools community meeting. "
        "District leadership presents updates and takes questions from the public."
    ),
    "special called": "APS Board of Education special called meeting. Open to the public.",
    "work session": "APS Board of Education work session. Open to the public.",
    "public hearing": "APS public hearing. Community members may address the Board.",
    "town hall": "APS town hall meeting. Open to the public.",
}

_DEFAULT_DESCRIPTION = (
    "Atlanta Public Schools Board of Education meeting. Open to the public."
)

# Series hints keyed by meeting-type fragment
_SERIES_HINTS: dict[str, dict] = {
    "board meeting": {
        "series_type": "recurring_show",
        "series_title": "APS Board of Education Meeting",
        "frequency": "monthly",
    },
    "audit committee": {
        "series_type": "recurring_show",
        "series_title": "APS Audit Committee Meeting",
        "frequency": "monthly",
    },
    "budget commission": {
        "series_type": "recurring_show",
        "series_title": "APS Budget Commission Meeting",
        "frequency": "monthly",
    },
    "accountability commission": {
        "series_type": "recurring_show",
        "series_title": "APS Accountability Commission Meeting",
        "frequency": "monthly",
    },
    "community meeting": {
        "series_type": "recurring_show",
        "series_title": "APS Community Meeting",
        "frequency": "irregular",
    },
    "work session": {
        "series_type": "recurring_show",
        "series_title": "APS Board Work Session",
        "frequency": "monthly",
    },
}

# Month abbreviation → number
_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _parse_compact_date(text: str) -> Optional[str]:
    """
    Parse Finalsite compact date format into YYYY-MM-DD.

    Examples:
        'Mar102026'  -> '2026-03-10'
        'Apr22026'   -> '2026-04-02'
        'Apr92026'   -> '2026-04-09'
    """
    text = text.strip()
    m = re.match(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{1,2})(\d{4})",
        text,
        re.IGNORECASE,
    )
    if not m:
        return None
    month_str, day_str, year_str = m.groups()
    month = _MONTH_MAP.get(month_str.lower())
    if not month:
        return None
    try:
        day = int(day_str)
        year = int(year_str)
        # Validate date
        d = datetime(year, month, day)
        return d.strftime("%Y-%m-%d")
    except (ValueError, OverflowError):
        return None


def _parse_time(text: str) -> Optional[str]:
    """Extract start time from '12:00PM-2:00PM' or '9:00AM-5:00PM'."""
    if not text or text.strip().lower() == "all day":
        return None
    m = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", text.upper())
    if not m:
        return None
    hour = int(m.group(1))
    minute = m.group(2)
    period = m.group(3)
    if period == "PM" and hour != 12:
        hour += 12
    elif period == "AM" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute}"


def _should_skip(title: str) -> bool:
    """Return True if this title matches an academic-calendar entry."""
    lower = title.lower()
    return any(kw in lower for kw in SKIP_KEYWORDS)


def _is_board_meeting(title: str) -> bool:
    """Return True if this title looks like a board or committee meeting."""
    lower = title.lower()
    return any(kw in lower for kw in MEETING_KEYWORDS)


def _clean_title(raw: str) -> str:
    """
    Clean raw slideshow title.

    Titles come as 'Board of EducationBudget Commission Meeting'
    (no separator between calendar name and event title).
    """
    # Strip 'Board of Education' prefix
    raw = re.sub(r"^Board of Education\s*", "", raw, flags=re.IGNORECASE).strip()
    # Strip 'APS District Calendar' prefix
    raw = re.sub(r"^APS District Calendar\s*", "", raw, flags=re.IGNORECASE).strip()

    if not raw:
        return raw

    # Add APS prefix if not present
    lower = raw.lower()
    if "atlanta public schools" not in lower and "aps" not in lower.split():
        return f"APS {raw}"
    return raw


def _description_for(title: str) -> str:
    """Return an appropriate description based on the meeting title."""
    lower = title.lower()
    for keyword, desc in _MEETING_DESCRIPTIONS.items():
        if keyword in lower:
            return desc
    return _DEFAULT_DESCRIPTION


def _series_hint_for(title: str) -> Optional[dict]:
    """Return series_hint dict or None for one-off meetings."""
    lower = title.lower()
    for keyword, hint in _SERIES_HINTS.items():
        if keyword in lower:
            return hint
    return None


def _is_virtual(title: str) -> bool:
    """Return True if the meeting appears to be virtual/online."""
    lower = title.lower()
    return any(kw in lower for kw in ("virtual", "online", "zoom", "teams", "webinar"))


def _fetch_boe_page() -> Optional[str]:
    """Fetch the APS Board of Education page using Playwright."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
            locale="en-US",
        )
        page = context.new_page()

        try:
            logger.info("APS Board: loading BOE page: %s", BOE_URL)
            response = page.goto(BOE_URL, wait_until="domcontentloaded", timeout=30000)

            if not response:
                logger.error("APS Board: no response from BOE page")
                return None

            if response.status >= 400:
                logger.error("APS Board: BOE page returned HTTP %d", response.status)
                return None

            # Wait for calendar slideshow to render
            page.wait_for_timeout(5000)

            return page.content()

        except Exception as exc:
            logger.error("APS Board: Playwright error loading BOE page: %s", exc)
            return None

        finally:
            browser.close()


def _parse_calendar_slides(html: str) -> list[dict]:
    """
    Parse the Finalsite calendar slideshow from the BOE page.

    The calendar uses a slick.js carousel with .slick-slide elements.
    Each slide contains:
    - A date element with compact format (e.g., 'Mar102026')
    - A title element (e.g., 'Board of EducationAudit Committee Meeting')
    - A time/detail element (e.g., '12:00PM-2:00PM' or 'all day')

    Returns list of dicts: {title, date_str, time_str, source_url}
    """
    soup = BeautifulSoup(html, "lxml")
    meetings: list[dict] = []
    seen: set[str] = set()

    # Find calendar slides — skip clones (slick-cloned)
    calendar = soup.find(class_=re.compile(r"fsCalendar"))
    if not calendar:
        logger.warning("APS Board: no fsCalendar element found on BOE page")
        return []

    slides = calendar.find_all(class_="slick-slide")
    if not slides:
        logger.warning("APS Board: no slick-slide elements found in calendar")
        return []

    for slide in slides:
        # Skip cloned slides (duplicates for carousel looping)
        classes = slide.get("class", [])
        if "slick-cloned" in classes:
            continue

        # Extract date
        date_el = slide.find(class_=re.compile(r"date|Date"))
        if not date_el:
            continue
        raw_date = date_el.get_text(strip=True)
        date_str = _parse_compact_date(raw_date)
        if not date_str:
            continue

        # Extract title
        title_el = slide.find(class_=re.compile(r"EventLink|Title|title"))
        if not title_el:
            # Fallback: try any link
            title_el = slide.find("a")
        if not title_el:
            continue
        raw_title = title_el.get_text(strip=True)
        if not raw_title:
            continue

        # Extract time
        time_el = slide.find(class_=re.compile(r"Details|time|Time"))
        time_str = None
        if time_el:
            time_str = _parse_time(time_el.get_text(strip=True))

        # Dedupe within this parse
        dedup_key = f"{raw_title}|{date_str}"
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        # Extract URL if available
        link = slide.find("a", href=True)
        source_url = BOE_URL
        if link and link.get("href", "").startswith("/"):
            source_url = f"https://www.atlantapublicschools.us{link['href']}"
        elif link and link.get("href", "").startswith("http"):
            source_url = link["href"]

        meetings.append(
            {
                "title": raw_title,
                "date_str": date_str,
                "time_str": time_str,
                "source_url": source_url,
            }
        )

    logger.info("APS Board: parsed %d calendar entries from BOE slideshow", len(meetings))
    return meetings


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Public Schools Board of Education meeting calendar.

    Fetches the BOE page, parses the Finalsite calendar slideshow,
    filters for board and committee meetings, and upserts events.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Ensure the venue record exists
    venue_id = get_or_create_place(PLACE_DATA)

    # Fetch the page
    html = _fetch_boe_page()
    if not html:
        logger.error("APS Board: could not fetch BOE page — aborting")
        return 0, 0, 0

    # Parse calendar slides
    raw_entries = _parse_calendar_slides(html)
    if not raw_entries:
        logger.warning("APS Board: no calendar entries parsed from BOE page")
        return 0, 0, 0

    today = datetime.now().date()
    seen: set[str] = set()

    for entry in raw_entries:
        try:
            raw_title = entry["title"]
            date_str = entry["date_str"]
            time_str = entry.get("time_str")
            source_url = entry.get("source_url") or BOE_URL

            # Skip academic-calendar entries
            if _should_skip(raw_title):
                logger.debug("APS Board: skipping (academic): %r", raw_title)
                continue

            # Only keep board/committee meeting entries
            if not _is_board_meeting(raw_title):
                logger.debug("APS Board: skipping (not a board meeting): %r", raw_title)
                continue

            # Parse date
            try:
                event_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                continue

            if event_date < today:
                continue

            # Clean title
            title = _clean_title(raw_title)
            if not title:
                continue

            # Within-run dedupe
            dedup_key = f"{title.lower()}|{date_str}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            events_found += 1

            # Tags
            tags = list(EVENT_TAGS)
            if _is_virtual(raw_title):
                tags.append("virtual")

            description = _description_for(raw_title)
            series_hint = _series_hint_for(raw_title)

            content_hash = generate_content_hash(title, PLACE_DATA["name"], date_str)

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": description,
                "start_date": date_str,
                "start_time": time_str,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "community",
                "subcategory": None,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": source_url,
                "ticket_url": None,
                "image_url": None,
                "raw_text": raw_title,
                "extraction_confidence": 0.90,
                "is_recurring": bool(series_hint),
                "recurrence_rule": "FREQ=MONTHLY" if series_hint else None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                logger.debug("APS Board: updated: %s on %s", title, date_str)
                continue

            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info("APS Board: added: %s on %s", title, date_str)

        except Exception as exc:
            logger.warning("APS Board: error processing entry %r: %s", entry, exc)
            continue

    logger.info(
        "APS Board crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
