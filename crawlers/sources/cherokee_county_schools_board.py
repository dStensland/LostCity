"""
Crawler for Cherokee County School District Board of Education meetings.

Primary source: https://www.cherokeek12.net
  Finalsite CMS homepage with calendar widget (data-calendar-ids=364).
  Events appear as structured HTML <article> elements with ISO 8601 datetime
  attributes — no Playwright required.

Note: The /print endpoint is blocked. We crawl the homepage calendar directly.

Board events are mixed with district-wide events (athletic events, school
holidays, etc.). We filter by "Board" keyword in the title to isolate
board-level meetings.

Meeting types:
  - Board of Education Meeting (~monthly, open to public)
  - Board Work Session (pre-meeting)
  - Special Called Meeting (as needed)

Venue: Cherokee County School District Administrative Office
       110 Academy St, Canton, GA 30114

~43,000 students — fast-growing district north of Atlanta.
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
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

CALENDAR_URL = "https://www.cherokeek12.net"
SOURCE_URL = CALENDAR_URL

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

VENUE_DATA = {
    "name": "Cherokee County School District Administrative Office",
    "slug": "cherokee-county-schools-office",
    "address": "110 Academy St",
    "neighborhood": "Downtown Canton",
    "city": "Canton",
    "state": "GA",
    "zip": "30114",
    "lat": 34.2368,
    "lng": -84.4930,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": "https://www.cherokeek12.net",
}

EVENT_TAGS = [
    "school-board",
    "government",
    "public-meeting",
    "education",
    "civic",
]

# Keywords that identify board-level events in the mixed district calendar.
# Cherokee's calendar mixes board events with athletics and school events,
# so we require "board" in the title plus one of these keywords.
# Cherokee uses "school board meeting" rather than "board of education meeting".
BOARD_MEETING_KEYWORDS = [
    "board of education",
    "board meeting",
    "board work session",
    "school board",
    "work session",
    "special called",
    "special board",
    "public hearing",
]

SERIES_HINT_BOARD = {
    "series_type": "recurring_show",
    "series_title": "Cherokee County Schools Board Meeting",
    "frequency": "monthly",
}

SERIES_HINT_WORK_SESSION = {
    "series_type": "recurring_show",
    "series_title": "Cherokee County Schools Board Work Session",
    "frequency": "monthly",
}


def _fetch_html(url: str) -> Optional[str]:
    """Fetch a page with a realistic browser user-agent."""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        logger.error(f"Cherokee County Schools Board: HTTP fetch error for {url}: {exc}")
        return None


def _is_board_event(title: str) -> bool:
    """
    Return True if this event title is a board-level meeting.

    Cherokee's calendar mixes board events with all district calendar events.
    We require "board" in the title plus at least one board-meeting keyword phrase.
    """
    title_lower = title.lower()
    if "board" not in title_lower:
        return False
    return any(kw in title_lower for kw in BOARD_MEETING_KEYWORDS)


def _parse_board_events_from_html(html: str) -> list[dict]:
    """
    Extract board meeting events from the Cherokee County Finalsite calendar.

    The Finalsite calendar widget renders:
      <article>
        <time class="fsDate" datetime="2026-04-13T00:00:00-04:00">Apr 13</time>
        <time class="fsStartTime" datetime="2026-04-13T18:00:00-04:00">6:00 PM</time>
        <a class="fsCalendarEventLink" ...>Board of Education Meeting</a>
      </article>

    Returns a list of dicts with keys: title, iso_datetime, source_url.
    """
    soup = BeautifulSoup(html, "lxml")
    events: list[dict] = []

    # Find the Finalsite calendar container (data-calendar-ids=364 on Cherokee site)
    cal = soup.find("div", attrs={"data-calendar-ids": True})
    if not cal:
        cal = soup.find(class_=re.compile(r"fsCalendar", re.IGNORECASE)) or soup

    articles = cal.find_all("article")
    if not articles:
        # Fallback: look for calendar event links directly
        event_links = cal.find_all("a", class_=re.compile(r"fsCalendarEventLink", re.IGNORECASE))
        for link in event_links:
            raw_title = (link.get("title") or link.get_text(strip=True)).strip()
            if not raw_title or not _is_board_event(raw_title):
                continue

            outer = link.find_parent("article") or link.find_parent()
            start_time_el = outer.find("time", class_="fsStartTime") if outer else None
            date_el = outer.find("time", class_="fsDate") if outer else None
            iso_datetime = None
            if start_time_el and start_time_el.get("datetime"):
                iso_datetime = start_time_el["datetime"]
            elif date_el and date_el.get("datetime"):
                iso_datetime = date_el["datetime"]

            if iso_datetime:
                events.append({
                    "title": raw_title,
                    "iso_datetime": iso_datetime,
                    "source_url": SOURCE_URL,
                })
        return events

    for article in articles:
        # Get title from the calendar link
        link = article.find("a", class_=re.compile(r"fsCalendarEventLink", re.IGNORECASE))
        raw_title = ""
        if link:
            raw_title = (link.get("title") or link.get_text(strip=True)).strip()

        if not raw_title:
            title_div = article.find(class_="fsTitle")
            if title_div:
                raw_title = title_div.get_text(strip=True)

        if not raw_title:
            continue

        # Filter: board events only (skip athletics, holidays, school events)
        if not _is_board_event(raw_title):
            continue

        # Prefer fsStartTime (date + time), fall back to fsDate (date only)
        start_time_el = article.find("time", class_="fsStartTime")
        date_el = article.find("time", class_="fsDate")

        iso_datetime: Optional[str] = None
        if start_time_el and start_time_el.get("datetime"):
            iso_datetime = start_time_el["datetime"]
        elif date_el and date_el.get("datetime"):
            iso_datetime = date_el["datetime"]

        if not iso_datetime:
            logger.debug(
                f"Cherokee County Schools Board: no datetime for event: {raw_title!r}"
            )
            continue

        events.append({
            "title": raw_title,
            "iso_datetime": iso_datetime,
            "source_url": SOURCE_URL,
        })

    return events


def _iso_to_date_time(iso_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Convert ISO 8601 datetime string to (YYYY-MM-DD, HH:MM) tuple.

    Handles:
      '2026-04-13T18:00:00-04:00' -> ('2026-04-13', '18:00')
      '2026-04-13T00:00:00-04:00' -> ('2026-04-13', None)  [midnight = date-only]
      '2026-04-13'                 -> ('2026-04-13', None)
    """
    if not iso_str:
        return None, None

    try:
        dt = datetime.strptime(iso_str[:19], "%Y-%m-%dT%H:%M:%S")
        start_time = dt.strftime("%H:%M") if dt.hour != 0 or dt.minute != 0 else None
        return dt.strftime("%Y-%m-%d"), start_time
    except ValueError:
        pass

    try:
        dt = datetime.strptime(iso_str[:10], "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d"), None
    except ValueError:
        pass

    return None, None


def _build_event_title(raw_title: str) -> str:
    """
    Normalize calendar titles into clean event titles.

    Cherokee uses a compound title pattern for meeting nights:
    "School Board Meeting - Work Session 5:30 pm, Business Meeting 7 pm"
    These represent a single event block; we title them as "Board Meeting Night".
    """
    raw_lower = raw_title.lower().strip()
    prefix = "Cherokee County Schools Board"

    # Compound: work session + business/board meeting combined in one entry
    has_work_session = "work session" in raw_lower
    has_business_meeting = "business meeting" in raw_lower or "board meeting" in raw_lower

    if has_work_session and has_business_meeting:
        return f"{prefix} — Meeting Night (Work Session + Board Meeting)"

    if "special" in raw_lower and ("meeting" in raw_lower or "called" in raw_lower):
        return f"{prefix} — Special Called Meeting"
    if "public hearing" in raw_lower:
        return f"{prefix} — Public Hearing"
    if "work session" in raw_lower:
        return f"{prefix} — Work Session"
    if "board of education meeting" in raw_lower or "school board meeting" in raw_lower:
        return f"{prefix} — Regular Meeting"

    return f"{prefix} — {raw_title.title()}"


def _determine_series_hint(raw_title: str) -> Optional[dict]:
    """Return appropriate series hint based on meeting type."""
    title_lower = raw_title.lower()
    if "special" in title_lower or "hearing" in title_lower:
        return None
    # Compound (work session + board meeting in one entry) -> use board series
    if "work session" in title_lower and "business meeting" in title_lower:
        return SERIES_HINT_BOARD
    if "work session" in title_lower:
        return SERIES_HINT_WORK_SESSION
    return SERIES_HINT_BOARD


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Cherokee County School District Board of Education meeting calendar.

    Fetches upcoming board meeting events from the official district Finalsite
    homepage (plain HTML — no Playwright required). Board events are filtered
    from the mixed district calendar by keyword.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    logger.info(f"Cherokee County Schools Board: fetching {CALENDAR_URL}")
    html = _fetch_html(CALENDAR_URL)
    if not html:
        logger.error(
            "Cherokee County Schools Board: could not fetch calendar page — aborting"
        )
        return 0, 0, 0

    raw_events = _parse_board_events_from_html(html)

    if not raw_events:
        logger.warning(
            "Cherokee County Schools Board: no board meeting events found on calendar page"
        )
        return 0, 0, 0

    logger.info(
        f"Cherokee County Schools Board: found {len(raw_events)} raw events on calendar"
    )

    today = date.today()
    seen: set[str] = set()

    for event in raw_events:
        try:
            raw_title = event["title"]
            iso_datetime = event["iso_datetime"]
            event_source_url = event.get("source_url") or SOURCE_URL

            start_date, start_time = _iso_to_date_time(iso_datetime)
            if not start_date:
                logger.debug(
                    f"Cherokee County Schools Board: could not parse datetime {iso_datetime!r}"
                )
                continue

            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                continue

            if event_date < today:
                logger.debug(
                    f"Cherokee County Schools Board: skipping past event: {raw_title} on {start_date}"
                )
                continue

            title = _build_event_title(raw_title)

            dedup_key = f"{title}|{start_date}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            events_found += 1

            content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
            series_hint = _determine_series_hint(raw_title)

            raw_lower = raw_title.lower()
            if "work session" in raw_lower and "business meeting" in raw_lower:
                description = (
                    "Cherokee County School District Board of Education meeting night. "
                    "Includes a Work Session followed by the regular Board Meeting. "
                    "Free and open to the public. "
                    "Community members may address the board during the public comment period."
                )
            elif "work session" in raw_lower:
                description = (
                    "Cherokee County School District Board of Education Work Session. "
                    "Free and open to the public."
                )
            else:
                description = (
                    "Cherokee County School District Board of Education meeting. "
                    "Free and open to the public. "
                    "Community members may address the board during the public comment period."
                )

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
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
                    f"Cherokee County Schools Board: updated: {title} on {start_date}"
                )
                continue

            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(
                f"Cherokee County Schools Board: added: {title} on {start_date}"
            )

        except Exception as exc:
            logger.warning(
                f"Cherokee County Schools Board: error processing event {event!r}: {exc}"
            )
            continue

    logger.info(
        f"Cherokee County Schools Board crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
