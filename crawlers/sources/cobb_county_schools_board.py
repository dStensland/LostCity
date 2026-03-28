"""
Crawler for Cobb County School District Board of Education meetings.

Primary source: https://www.cobbk12.org/board-meeting-schedule
  CommunityIQ CMS page with a plain HTML <table> listing the year's meeting
  schedule. No JavaScript rendering required — the table loads with the page.

Page structure (one row per date):
  Column 0 — plain-text date: "Thursday, January 22, 2026"
  Column 1 — description with times embedded in the text, e.g.:
    "3:00 p.m. Work Session – Public Comment
     Followed by Executive Session
     7:00 p.m. Board Meeting – Public Comment"

Each data row produces up to 2 events:
  - Work Session  (time extracted from column-1 text; typically 2:00–3:00 p.m.)
  - Board Meeting (typically 7:00 p.m.)

Special rows (Board Retreat, single-event rows) produce one event.

Venue: Cobb County School District Central Office, 514 Glover St SE, Marietta GA
Serving ~107,000 students — second-largest district in metro Atlanta.
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

SCHEDULE_URL = "https://www.cobbk12.org/board-meeting-schedule"

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
    "name": "Cobb County School District Central Office",
    "slug": "cobb-county-schools-central",
    "address": "514 Glover St SE",
    "neighborhood": "Downtown Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30060",
    "lat": 33.9501,
    "lng": -84.5502,
    "place_type": "organization",
    "spot_type": "organization",
    "website": "https://www.cobbk12.org",
}

EVENT_TAGS = [
    "school-board",
    "government",
    "public-meeting",
    "education",
    "civic",
]

# Regex patterns for extracting times from description text.
# Handles: "3:00 p.m.", "7:00 p.m.", "11:00 a.m.", "2:00 p.m."
_TIME_RE = re.compile(
    r"(\d{1,2}:\d{2})\s*([ap]\.?m\.?)",
    re.IGNORECASE,
)

# Markers that identify event types within the description cell.
_WORK_SESSION_RE = re.compile(r"work\s+session", re.IGNORECASE)
_BOARD_MEETING_RE = re.compile(r"board\s+meeting", re.IGNORECASE)
_BOARD_RETREAT_RE = re.compile(r"board\s+retreat", re.IGNORECASE)
_OFFICIAL_NOTICE_RE = re.compile(r"official\s+notice", re.IGNORECASE)

# Date format used in column 0: "Thursday, January 22, 2026"
# Strip leading asterisks/stars used as footnote markers on some rows.
_DATE_STRIP_RE = re.compile(r"^[*\s]+")
_DATE_FMT = "%A, %B %d, %Y"

SERIES_HINT_BOARD = {
    "series_type": "recurring_show",
    "series_title": "Cobb County Schools Board Meeting",
    "frequency": "monthly",
}

SERIES_HINT_WORK_SESSION = {
    "series_type": "recurring_show",
    "series_title": "Cobb County Schools Work Session",
    "frequency": "monthly",
}


def _fetch_html(url: str) -> Optional[str]:
    """Fetch the schedule page with a realistic browser user-agent."""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        logger.error(f"Cobb County Schools Board: HTTP fetch error for {url}: {exc}")
        return None


def _parse_time(text: str, am_pm: str) -> str:
    """Convert '3:00' + 'p.m.' to '15:00' (24-hour)."""
    h, m = text.split(":")
    hour = int(h)
    am_pm_clean = am_pm.replace(".", "").lower().strip()
    if am_pm_clean == "pm" and hour != 12:
        hour += 12
    elif am_pm_clean == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{m}"


def _extract_events_from_row(date_str: str, desc: str) -> list[dict]:
    """
    Given a date string and description cell text, return a list of event dicts.

    Each dict has: title, start_time, description_text, series_hint, is_retreat.
    """
    events: list[dict] = []

    # Find all times mentioned in the description with their positions.
    # We use this to associate each time with the text that follows it.
    time_matches = list(_TIME_RE.finditer(desc))

    is_retreat = bool(_BOARD_RETREAT_RE.search(desc))
    is_official_notice = bool(_OFFICIAL_NOTICE_RE.search(desc))
    has_work_session = bool(_WORK_SESSION_RE.search(desc))
    has_board_meeting = bool(_BOARD_MEETING_RE.search(desc))

    if is_retreat or (is_official_notice and not has_work_session and not has_board_meeting):
        # Single-event row: Board Retreat or other special notice.
        start_time = None
        if time_matches:
            t = time_matches[0]
            start_time = _parse_time(t.group(1), t.group(2))
        events.append({
            "title": "Cobb County Schools Board — Retreat / Special Session",
            "start_time": start_time,
            "description_text": (
                "Cobb County Schools Board of Education special session. "
                "Free and open to the public."
            ),
            "series_hint": None,
            "is_retreat": True,
        })
        return events

    # Normal pattern: work session + board meeting on the same day.
    # Walk through the time matches and assign each to an event type.
    for i, tm in enumerate(time_matches):
        parsed_time = _parse_time(tm.group(1), tm.group(2))
        # Get the text snippet after this time match.
        snippet_start = tm.end()
        snippet_end = time_matches[i + 1].start() if i + 1 < len(time_matches) else len(desc)
        snippet = desc[snippet_start:snippet_end].lower()

        if "work session" in snippet or (i == 0 and has_work_session and "board meeting" not in snippet):
            events.append({
                "title": "Cobb County Schools — Work Session",
                "start_time": parsed_time,
                "description_text": (
                    "Cobb County Schools Board of Education Work Session. "
                    "Free and open to the public. Includes public comment period."
                ),
                "series_hint": SERIES_HINT_WORK_SESSION,
                "is_retreat": False,
            })
        elif "board meeting" in snippet or (i > 0 and has_board_meeting):
            events.append({
                "title": "Cobb County Schools — Board Meeting",
                "start_time": parsed_time,
                "description_text": (
                    "Cobb County Schools Board of Education regular meeting. "
                    "Free and open to the public. Includes public comment period."
                ),
                "series_hint": SERIES_HINT_BOARD,
                "is_retreat": False,
            })

    # Safety fallback: if we found no structured events but keywords exist.
    if not events:
        if has_work_session:
            # Find the first time match; default to a reasonable work-session time
            t_str = None
            if time_matches:
                t = time_matches[0]
                t_str = _parse_time(t.group(1), t.group(2))
            events.append({
                "title": "Cobb County Schools — Work Session",
                "start_time": t_str,
                "description_text": (
                    "Cobb County Schools Board of Education Work Session. "
                    "Free and open to the public."
                ),
                "series_hint": SERIES_HINT_WORK_SESSION,
                "is_retreat": False,
            })
        if has_board_meeting:
            t_str = None
            if len(time_matches) > 1:
                t = time_matches[1]
                t_str = _parse_time(t.group(1), t.group(2))
            elif time_matches:
                t = time_matches[0]
                t_str = _parse_time(t.group(1), t.group(2))
            events.append({
                "title": "Cobb County Schools — Board Meeting",
                "start_time": t_str,
                "description_text": (
                    "Cobb County Schools Board of Education regular meeting. "
                    "Free and open to the public."
                ),
                "series_hint": SERIES_HINT_BOARD,
                "is_retreat": False,
            })

    return events


def _parse_schedule(html: str) -> list[dict]:
    """
    Parse the board meeting schedule table from the page HTML.

    Returns a list of raw event dicts with:
      date_str, title, start_time, description_text, series_hint
    """
    soup = BeautifulSoup(html, "lxml")
    table = soup.find("table")
    if not table:
        logger.warning("Cobb County Schools Board: no <table> found on schedule page")
        return []

    raw_events: list[dict] = []
    rows = table.find_all("tr")

    for row in rows:
        cells = row.find_all(["td", "th"])
        if len(cells) < 2:
            continue

        raw_date = cells[0].get_text(separator=" ", strip=True)
        raw_date = _DATE_STRIP_RE.sub("", raw_date).strip()

        # Skip the header row ("Cobb County Board of Education 2026 Meeting Schedule")
        if not raw_date or not any(ch.isdigit() for ch in raw_date):
            continue

        desc = cells[1].get_text(separator=" ", strip=True)

        # Parse the date
        try:
            event_date = datetime.strptime(raw_date, _DATE_FMT).date()
        except ValueError:
            # Some rows include footnote text in the date cell; try stripping
            # non-date trailing content (e.g. "**Thursday, January 21, 2027")
            cleaned = _DATE_STRIP_RE.sub("", raw_date)
            # Strip trailing asterisks too
            cleaned = re.sub(r"[*]+$", "", cleaned).strip()
            try:
                event_date = datetime.strptime(cleaned, _DATE_FMT).date()
            except ValueError:
                logger.debug(
                    f"Cobb County Schools Board: could not parse date {raw_date!r}, skipping"
                )
                continue

        if event_date < date.today():
            logger.debug(
                f"Cobb County Schools Board: skipping past row: {raw_date}"
            )
            continue

        row_events = _extract_events_from_row(raw_date, desc)
        for ev in row_events:
            raw_events.append({
                "date_str": event_date.strftime("%Y-%m-%d"),
                **ev,
            })

    return raw_events


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Cobb County Schools Board of Education meeting schedule.

    Fetches upcoming meeting events from the official CCSD schedule page
    (plain CommunityIQ HTML — no Playwright required).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)

    logger.info(f"Cobb County Schools Board: fetching {SCHEDULE_URL}")
    html = _fetch_html(SCHEDULE_URL)
    if not html:
        logger.error(
            "Cobb County Schools Board: could not fetch schedule page — aborting"
        )
        return 0, 0, 0

    raw_events = _parse_schedule(html)

    if not raw_events:
        logger.warning(
            "Cobb County Schools Board: no upcoming events parsed from schedule page"
        )
        return 0, 0, 0

    logger.info(
        f"Cobb County Schools Board: found {len(raw_events)} raw events"
    )

    seen: set[str] = set()

    for ev in raw_events:
        try:
            title = ev["title"]
            start_date = ev["date_str"]
            start_time = ev.get("start_time")
            desc = ev.get("description_text", "")
            series_hint = ev.get("series_hint")

            dedup_key = f"{title}|{start_date}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            events_found += 1

            content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": desc,
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
                "source_url": SCHEDULE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{title} — {start_date}",
                "extraction_confidence": 0.90,
                "is_recurring": series_hint is not None,
                "recurrence_rule": "FREQ=MONTHLY" if series_hint else None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                logger.debug(
                    f"Cobb County Schools Board: updated: {title} on {start_date}"
                )
                continue

            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(
                f"Cobb County Schools Board: added: {title} on {start_date}"
            )

        except Exception as exc:
            logger.warning(
                f"Cobb County Schools Board: error processing event {ev!r}: {exc}"
            )
            continue

    logger.info(
        f"Cobb County Schools Board crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
