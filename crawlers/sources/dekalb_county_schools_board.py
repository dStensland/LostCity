"""
Crawler for DeKalb County School District (DCSD) Board of Education meetings.

Primary source: https://www.dekalbschoolsga.org/board/meeting-calendar
  Finalsite calendar widget (data-calendar-ids=7) showing upcoming Board of
  Education meetings. Events appear as structured HTML with ISO 8601 datetime
  attributes — no Playwright required.

Note: The Simbli eBoard URL previously used (S=36030443) was incorrect — the
actual DeKalb Simbli ID is S=4054 (per the official board page). However,
Simbli eBoard for this district only shows past meeting records (agenda/minutes)
not future scheduled meetings. We use the official DCSD website instead.

Meeting types:
- BOARD OF EDUCATION MEETING (~monthly, open to public)

Venue: DCSD Administrative & Instructional Complex (AIC)
       1701 Mountain Industrial Blvd, Stone Mountain, GA 30083

All DCSD meetings include a standing "Community Input Session" agenda item,
so every meeting gets the public-comment tag.
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

# Primary source: DCSD official board meeting calendar
MEETING_CALENDAR_URL = "https://www.dekalbschoolsga.org/board/meeting-calendar"
# Canonical source URL for event records
SOURCE_URL = MEETING_CALENDAR_URL

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

PLACE_DATA = {
    "name": "DCSD Administrative & Instructional Complex",
    "slug": "dcsd-administrative-center",
    "address": "1701 Mountain Industrial Blvd",
    "neighborhood": "Stone Mountain",
    "city": "Stone Mountain",
    "state": "GA",
    "zip": "30083",
    "lat": 33.8081,
    "lng": -84.1468,
    "place_type": "community_center",
    "spot_type": "community_center",
    "website": "https://www.dekalbschoolsga.org",
}

EVENT_TAGS = [
    "education",
    "school-board",
    "dekalb-schools",
    "attend",
    "public-comment",
    "government",
    "civic",
]

DESCRIPTION = (
    "DeKalb County Schools Board of Education meeting. "
    "Free and open to the public. "
    "Each meeting includes a Community Input Session for public comment."
)

SERIES_HINT_REGULAR = {
    "series_type": "recurring_show",
    "series_title": "DeKalb County School Board Meeting",
    "frequency": "monthly",
}

# Keywords for identifying board meetings in the calendar
BOARD_MEETING_KEYWORDS = [
    "board of education meeting",
    "board of education",
    "boe meeting",
    "board meeting",
    "special board meeting",
    "special called",
    "public hearing",
]


def _fetch_html(url: str) -> Optional[str]:
    """Fetch a page with a realistic browser user-agent."""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        logger.error(f"DeKalb County Schools Board: HTTP fetch error for {url}: {exc}")
        return None


def _parse_board_events_from_html(html: str) -> list[dict]:
    """
    Extract board meeting events from the DCSD Finalsite calendar page.

    The page uses:
    - <article> elements containing one meeting event each
    - <time class="fsDate" datetime="ISO8601"> for the event date
    - <time class="fsStartTime" datetime="ISO8601"> for the start time
    - <a class="fsCalendarEventLink"> with the event title
    - <div class="fsLocation"> for the venue address

    Returns a list of dicts with keys: title, iso_datetime, source_url.
    """
    soup = BeautifulSoup(html, "lxml")
    events: list[dict] = []

    # Find the Finalsite calendar element (data-calendar-ids=7)
    cal = soup.find("div", attrs={"data-calendar-ids": True})
    if not cal:
        # Fall back to any calendar element
        cal = soup.find(class_=re.compile(r"fsCalendar", re.IGNORECASE)) or soup

    articles = cal.find_all("article")
    if not articles:
        # Some Finalsite layouts don't use <article> — try event link approach
        event_links = cal.find_all("a", class_=re.compile(r"fsCalendarEventLink", re.IGNORECASE))
        for link in event_links:
            raw_title = (link.get("title") or link.get_text(strip=True)).strip()
            if not raw_title:
                continue
            if not any(kw in raw_title.lower() for kw in BOARD_MEETING_KEYWORDS):
                continue

            outer = link.find_parent("article") or link.find_parent()
            start_time_el = outer.find("time", class_="fsStartTime") if outer else None
            iso_datetime = (
                start_time_el.get("datetime")
                if start_time_el
                else None
            )
            if not iso_datetime:
                date_el = link.find_previous("time", class_="fsDate")
                if date_el:
                    iso_datetime = date_el.get("datetime")
            if iso_datetime:
                events.append({
                    "title": raw_title,
                    "iso_datetime": iso_datetime,
                    "source_url": SOURCE_URL,
                })
        return events

    for article in articles:
        # Get event title from the calendar link
        link = article.find("a", class_=re.compile(r"fsCalendarEventLink", re.IGNORECASE))
        raw_title = ""
        if link:
            raw_title = (link.get("title") or link.get_text(strip=True)).strip()

        if not raw_title:
            # Try fsTitle div
            title_div = article.find(class_="fsTitle")
            if title_div:
                raw_title = title_div.get_text(strip=True)

        if not raw_title:
            continue

        # Filter to board meetings only (skip school holidays, sports events, etc.)
        if not any(kw in raw_title.lower() for kw in BOARD_MEETING_KEYWORDS):
            continue

        # Get start datetime from fsStartTime or fsDate
        start_time_el = article.find("time", class_="fsStartTime")
        date_el = article.find("time", class_="fsDate")

        iso_datetime: Optional[str] = None
        if start_time_el and start_time_el.get("datetime"):
            iso_datetime = start_time_el["datetime"]
        elif date_el and date_el.get("datetime"):
            iso_datetime = date_el["datetime"]

        if not iso_datetime:
            logger.debug(
                f"DeKalb County Schools Board: no datetime for event: {raw_title!r}"
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
    - '2026-04-20T11:30:00-04:00' -> ('2026-04-20', '11:30')
    - '2026-04-20' -> ('2026-04-20', None)
    """
    if not iso_str:
        return None, None

    # Try full ISO with time (strip timezone suffix for strptime)
    try:
        dt = datetime.strptime(iso_str[:19], "%Y-%m-%dT%H:%M:%S")
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


def build_event_title(raw_title: str) -> str:
    """
    Normalize calendar titles into clean event titles.

    'BOARD OF EDUCATION MEETING' -> 'DeKalb County Schools Board of Education — Regular Meeting'
    'SPECIAL BOARD MEETING - ...' -> 'DeKalb County Schools Board of Education — Special Meeting'
    """
    raw = raw_title.strip()
    prefix = "DeKalb County Schools Board of Education"

    # Already has district name
    if "dekalb" in raw.lower():
        return raw.title()

    # Normalize all-caps titles
    raw_lower = raw.lower()

    if "special" in raw_lower and "meeting" in raw_lower:
        return f"{prefix} \u2014 Special Called Meeting"
    if "public hearing" in raw_lower:
        return f"{prefix} \u2014 Public Hearing"
    if "work session" in raw_lower:
        return f"{prefix} \u2014 Work Session"
    if "board of education meeting" in raw_lower or "boe meeting" in raw_lower:
        return f"{prefix} \u2014 Regular Meeting"
    if "board meeting" in raw_lower:
        return f"{prefix} \u2014 Regular Meeting"

    # Fallback: prefix + title-cased original
    return f"{prefix} \u2014 {raw.title()}"


def determine_series_hint(raw_title: str) -> Optional[dict]:
    """Return the appropriate series hint based on meeting type."""
    title_lower = raw_title.lower()
    # Special called meetings and hearings are one-offs
    if "special" in title_lower or "hearing" in title_lower:
        return None
    # Regular monthly meetings get series grouping
    return SERIES_HINT_REGULAR


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl DeKalb County Schools Board of Education meeting calendar.

    Fetches upcoming meeting events from the official DCSD board calendar
    page (plain Finalsite HTML — no Playwright required).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Ensure venue exists
    venue_id = get_or_create_place(PLACE_DATA)

    # Fetch the meeting calendar page
    logger.info(f"DeKalb County Schools Board: fetching {MEETING_CALENDAR_URL}")
    html = _fetch_html(MEETING_CALENDAR_URL)
    if not html:
        logger.error(
            "DeKalb County Schools Board: could not fetch meeting calendar page — aborting"
        )
        return 0, 0, 0

    # Parse board meeting events
    raw_events = _parse_board_events_from_html(html)

    if not raw_events:
        logger.warning(
            "DeKalb County Schools Board: no board meeting events found on calendar page"
        )
        return 0, 0, 0

    logger.info(
        f"DeKalb County Schools Board: found {len(raw_events)} raw events on calendar"
    )

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
                    f"DeKalb County Schools Board: could not parse datetime {iso_datetime!r}"
                )
                continue

            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                continue

            if event_date < today:
                logger.debug(
                    f"DeKalb County Schools Board: skipping past meeting: {raw_title} on {start_date}"
                )
                continue

            # Build clean title
            title = build_event_title(raw_title)

            # Dedupe within this run
            dedup_key = f"{title}|{start_date}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            events_found += 1

            # Content hash for DB-level dedup
            content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)

            # Series grouping
            series_hint = determine_series_hint(raw_title)

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": DESCRIPTION,
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
                logger.debug(f"DeKalb County Schools Board: updated: {title} on {start_date}")
                continue

            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"DeKalb County Schools Board: added: {title} on {start_date}")

        except Exception as exc:
            logger.warning(
                f"DeKalb County Schools Board: error processing event {event!r}: {exc}"
            )
            continue

    logger.info(
        f"DeKalb County Schools Board crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
