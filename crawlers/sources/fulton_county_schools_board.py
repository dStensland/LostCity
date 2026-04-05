"""
Crawler for Fulton County Schools Board of Education meetings.

Primary source: https://www.fultonschools.org/calendar01
  Finalsite calendar widget (data-calendar-ids=820) showing the FCS District &
  Board Calendar. Board meeting and Work Session events appear as structured
  HTML with ISO 8601 datetime attributes — no Playwright required.

Fallback URL (kept for reference): Simbli eBoard only shows past meetings for
this district, so we do not use it for upcoming event discovery.

Meeting venue mapping:
- FCS Board Work Session → North Learning Center (Sandy Springs)
- FCS Board Meeting      → South Learning Center (Union City)

All meetings are free and open to the public. Public comment opens at 6:00 PM.
"""

from __future__ import annotations

import logging
import re
import urllib.request
from datetime import date, datetime
from typing import Optional

from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# Primary source: FCS district calendar (Finalsite CMS, no WAF)
CALENDAR_BASE_URL = "https://www.fultonschools.org/calendar01"
# Finalsite element ID for the FCS District & Board Calendar widget
CALENDAR_ELEMENT_ID = "217572"
# Canonical source URL for event records
SOURCE_URL = "https://www.fultonschools.org/fcs-board-of-education/meeting-calendar"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Work Sessions alternate at the North Learning Center
VENUE_NORTH = {
    "name": "Fulton County Schools North Learning Center",
    "slug": "fulton-county-schools-north-learning-center",
    "address": "450 Northridge Parkway",
    "neighborhood": "Sandy Springs",
    "city": "Sandy Springs",
    "state": "GA",
    "zip": "30350",
    "lat": 33.9697,
    "lng": -84.3517,
    "place_type": "community_center",
    "spot_type": "community_center",
    "website": "https://www.fultonschools.org",
}

# Board Meetings (and default) at the South Learning Center
VENUE_SOUTH = {
    "name": "Fulton County Schools South Learning Center",
    "slug": "fulton-county-schools-south-learning-center",
    "address": "4025 Flat Shoals Road",
    "neighborhood": "Union City",
    "city": "Union City",
    "state": "GA",
    "zip": "30291",
    "lat": 33.5689,
    "lng": -84.3442,
    "place_type": "community_center",
    "spot_type": "community_center",
    "website": "https://www.fultonschools.org",
}

EVENT_TAGS = [
    "education",
    "school-board",
    "fulton-county-schools",
    "attend",
    "public-comment",
    "government",
    "civic",
]

DESCRIPTION_BOARD_MEETING = (
    "Fulton County Schools Board of Education meeting. "
    "Free and open to the public. "
    "Public comment period opens at 6:00 PM."
)

DESCRIPTION_WORK_SESSION = (
    "Fulton County Schools Board of Education Work Session. "
    "Free and open to the public. "
    "Recognitions and public comment open at 6:00 PM. "
    "Held at the North Learning Center in Sandy Springs."
)

SERIES_HINT_WORK_SESSION = {
    "series_type": "recurring_show",
    "series_title": "Fulton County Schools Board Work Session",
    "frequency": "monthly",
}

SERIES_HINT_BOARD_MEETING = {
    "series_type": "recurring_show",
    "series_title": "Fulton County Schools Board Meeting",
    "frequency": "monthly",
}

# Event title keywords from the Finalsite calendar
BOARD_MEETING_KEYWORDS = ["fcs board meeting", "board meeting"]
WORK_SESSION_KEYWORDS = ["fcs board work session", "work session", "board work session"]


def _fetch_html(url: str) -> Optional[str]:
    """Fetch a page with a realistic browser user-agent."""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        logger.error(f"Fulton County Schools Board: HTTP fetch error for {url}: {exc}")
        return None


def _month_url(year: int, month: int) -> str:
    """Return the FCS calendar URL for a specific month."""
    # The Finalsite calendar doesn't use URL params for month navigation in
    # the main calendar01 page — it uses JS. But the print endpoint exposes
    # the full month grid as static HTML.
    return (
        f"https://www.fultonschools.org/fs/elements/{CALENDAR_ELEMENT_ID}/print"
        f"?cal_date={year:04d}-{month:02d}-01"
    )


def _parse_board_events_from_html(html: str) -> list[dict]:
    """
    Extract board meeting and work session events from a Finalsite calendar page.

    Finalsite grid-view (print view) uses:
    - <div class="fsCalendarEventTitle [fsCalendarEventLink]"> for event titles
    - <time class="fsStartTime" datetime="ISO8601"> for start time
    - Both live inside a <div class="fsCalendarInfo"> within a <div class="fsCalendarDaybox">

    Finalsite list-view (calendar page) may also use:
    - <a class="fsCalendarEventTitle fsCalendarEventLink"> (anchor, not div)
    - <time class="fsDate" datetime="ISO8601"> on the article container

    Returns a list of dicts with keys: title, iso_datetime, source_url.
    """
    soup = BeautifulSoup(html, "lxml")
    events: list[dict] = []

    # Find all elements (div or a) with the fsCalendarEventTitle class.
    # The print/grid view uses <div>, the list view uses <a>.
    title_els = soup.find_all(
        True,
        class_=re.compile(r"\bfsCalendarEventTitle\b"),
    )

    for el in title_els:
        raw_title = el.get_text(strip=True)
        if not raw_title:
            continue

        title_lower = raw_title.lower()
        is_board_meeting = any(kw in title_lower for kw in BOARD_MEETING_KEYWORDS)
        is_work_session = any(kw in title_lower for kw in WORK_SESSION_KEYWORDS)

        if not (is_board_meeting or is_work_session):
            continue

        iso_datetime: Optional[str] = None

        # Strategy 1: look for fsStartTime in the nearby fsCalendarInfo div
        parent_info = el.find_parent("div", class_=re.compile(r"\bfsCalendarInfo\b"))
        if parent_info:
            start_time_el = parent_info.find("time", class_="fsStartTime")
            if start_time_el and start_time_el.get("datetime"):
                iso_datetime = start_time_el["datetime"]

        # Strategy 2: list-view article has fsDate as sibling/parent element
        if not iso_datetime:
            parent_article = el.find_parent("article")
            if parent_article:
                start_time_el = parent_article.find("time", class_="fsStartTime")
                if start_time_el and start_time_el.get("datetime"):
                    iso_datetime = start_time_el["datetime"]
                else:
                    date_el = parent_article.find("time", class_="fsDate")
                    if date_el and date_el.get("datetime"):
                        iso_datetime = date_el["datetime"]

        # Strategy 3: grid-view — read data-day/data-month/data-year from daybox
        if not iso_datetime:
            daybox = el.find_parent("div", class_=re.compile(r"\bfsCalendarDaybox\b"))
            if daybox:
                # Day number is in a header span; the date is in a time[datetime] or
                # can be reconstructed from the month picker data-month/data-year + day label
                day_el = daybox.find("time")
                if day_el and day_el.get("datetime"):
                    iso_datetime = day_el["datetime"]
                else:
                    # Read the day label text from the daybox header
                    # e.g. "Thursday, April 16" — need the month from page-level context
                    month_picker = soup.find(
                        "span", class_=re.compile(r"\bfsCalendarGridShowMonthPickerButton\b")
                    )
                    if month_picker:
                        year = month_picker.get("data-year", "")
                        month = month_picker.get("data-month", "")  # 1-indexed here
                        # Get day number from daybox header text
                        header = daybox.find(class_=re.compile(r"\bfsCalendarDayNumber\b"))
                        day_num = header.get_text(strip=True) if header else ""
                        # Alternative: parse from the aria-label or header span
                        if not day_num:
                            day_link = daybox.find("a")
                            if day_link:
                                day_num = re.search(r"\d+", day_link.get_text()).group()
                        if year and month and day_num:
                            try:
                                iso_datetime = (
                                    f"{year}-{int(month):02d}-{int(day_num):02d}"
                                )
                            except ValueError:
                                pass

        if not iso_datetime:
            logger.debug(
                f"Fulton County Schools Board: no datetime found for event: {raw_title!r}"
            )
            continue

        events.append(
            {
                "title": raw_title,
                "iso_datetime": iso_datetime,
                "source_url": SOURCE_URL,
            }
        )

    return events


def _iso_to_date_time(iso_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Convert an ISO 8601 datetime string to (YYYY-MM-DD, HH:MM) tuple.

    Handles:
    - '2026-04-23T16:30:00-04:00' -> ('2026-04-23', '16:30')
    - '2026-04-23' -> ('2026-04-23', None)
    """
    if not iso_str:
        return None, None

    # Try full ISO with time
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(iso_str[:19], fmt[:19])
            return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
        except ValueError:
            pass

    # Try date-only
    try:
        dt = datetime.strptime(iso_str[:10], "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d"), None
    except ValueError:
        pass

    return None, None


def resolve_venue(raw_title: str) -> dict:
    """Return the appropriate venue dict based on meeting type."""
    title_lower = raw_title.lower()
    if "work session" in title_lower:
        return VENUE_NORTH
    return VENUE_SOUTH


def determine_series_hint(raw_title: str) -> Optional[dict]:
    """Return the appropriate series hint based on meeting type."""
    title_lower = raw_title.lower()
    if "work session" in title_lower:
        return SERIES_HINT_WORK_SESSION
    if "board meeting" in title_lower:
        return SERIES_HINT_BOARD_MEETING
    return None


def fetch_upcoming_meetings(months_ahead: int = 5) -> list[dict]:
    """
    Fetch board meeting events from the FCS district calendar for the next
    N months. Fetches each month's print view (static HTML, no JS required).

    Returns deduplicated list of event dicts.
    """
    all_events: list[dict] = []
    seen_keys: set[str] = set()

    today = date.today()

    # Start from today's month and look ahead
    for month_offset in range(months_ahead):
        # Calculate target month
        target_month = today.month + month_offset
        target_year = today.year + (target_month - 1) // 12
        target_month = ((target_month - 1) % 12) + 1

        url = _month_url(target_year, target_month)
        logger.debug(f"Fulton County Schools Board: fetching calendar for {target_year}-{target_month:02d}")

        html = _fetch_html(url)
        if not html:
            # Try the main calendar page for the current month as a fallback
            if month_offset == 0:
                logger.info("Fulton County Schools Board: print view failed, trying main calendar page")
                html = _fetch_html(CALENDAR_BASE_URL)
            if not html:
                continue

        month_events = _parse_board_events_from_html(html)
        for event in month_events:
            key = f"{event['title']}|{event['iso_datetime'][:10]}"
            if key not in seen_keys:
                seen_keys.add(key)
                all_events.append(event)

    logger.info(
        f"Fulton County Schools Board: found {len(all_events)} board events across {months_ahead} months"
    )
    return all_events


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Fulton County Schools Board of Education meeting calendar.

    Fetches upcoming board meeting and work session events from the FCS
    district calendar website (fultonschools.org/calendar01). This is a
    plain HTML Finalsite calendar — no Playwright or WAF bypass required.

    Work Sessions → North Learning Center (Sandy Springs)
    Board Meetings → South Learning Center (Union City)
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Pre-create both venues so they exist in the DB regardless of meeting schedule.
    venue_id_north = get_or_create_place(VENUE_NORTH)
    venue_id_south = get_or_create_place(VENUE_SOUTH)

    venue_id_map = {
        "north": venue_id_north,
        "south": venue_id_south,
    }

    # Fetch upcoming meetings (current month + 4 months ahead)
    raw_events = fetch_upcoming_meetings(months_ahead=5)

    if not raw_events:
        logger.warning(
            "Fulton County Schools Board: no upcoming board meetings found on FCS calendar"
        )
        return 0, 0, 0

    today = date.today()
    seen: set[str] = set()

    for event in raw_events:
        try:
            raw_title = event["title"]
            iso_datetime = event["iso_datetime"]
            event_source_url = event.get("source_url") or SOURCE_URL

            # Parse date and time from ISO string
            start_date, start_time = _iso_to_date_time(iso_datetime)
            if not start_date:
                logger.debug(
                    f"Fulton County Schools Board: could not parse datetime {iso_datetime!r}"
                )
                continue

            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                continue

            if event_date < today:
                logger.debug(
                    f"Fulton County Schools Board: skipping past event: {raw_title} on {start_date}"
                )
                continue

            # Resolve venue
            place_data = resolve_venue(raw_title)
            venue_id = (
                venue_id_map["north"]
                if place_data is VENUE_NORTH
                else venue_id_map["south"]
            )

            # Default to 18:00 when the calendar doesn't show a time —
            # public comment always opens at 6:00 PM per standing schedule.
            if not start_time:
                start_time = "18:00"

            # Build clean title from raw calendar title
            # FCS calendar labels are already clean: "FCS Board Meeting", "FCS Board Work Session"
            title = raw_title

            # Dedupe within this run
            dedup_key = f"{title}|{start_date}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            events_found += 1

            # Choose description based on meeting type
            description = (
                DESCRIPTION_WORK_SESSION
                if "work session" in title.lower()
                else DESCRIPTION_BOARD_MEETING
            )

            # Content hash for DB-level dedup
            content_hash = generate_content_hash(title, place_data["name"], start_date)

            # Series grouping
            series_hint = determine_series_hint(raw_title)

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "community",
                "subcategory": None,
                "tags": EVENT_TAGS,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": event_source_url,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{raw_title} — {iso_datetime}",
                "extraction_confidence": 0.90,
                "is_recurring": bool(series_hint),
                "recurrence_rule": "FREQ=MONTHLY" if series_hint else None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                logger.debug(
                    f"Fulton County Schools Board: updated: {title} on {start_date}"
                )
                continue

            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"Fulton County Schools Board: added: {title} on {start_date}")

        except Exception as exc:
            logger.warning(
                f"Fulton County Schools Board: error processing event {event!r}: {exc}"
            )
            continue

    logger.info(
        f"Fulton County Schools Board crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
