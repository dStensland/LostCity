"""
Crawler for Gwinnett County Public Schools Board of Education meetings.

Primary source: https://www.gcpsk12.org/about-us/board/board-meeting-schedule
  Finalsite CMS page with plain-text <p> date entries (NOT Finalsite calendar
  widget elements). No JavaScript rendering required — the page loads as plain HTML.

Page structure (two <h2> sections):
  <h2>2026 Work Sessions</h2>
  <p><strong>Tuesday, January 13, 2026</strong></p>
  <p><strong>Wednesday, February 18, 2026 (3rd Wednesday)</strong></p>
  ...
  <h2>2026 Business Meetings</h2>
  <p><strong>Thursday, January 15, 2026</strong></p>
  ...

Each <p> with date text produces one event.
Work Sessions: held at 6:00 p.m. (per page intro text).
Business Meetings: held at 7:00 p.m. (per page intro text).

Venue: J. Alvin Wilbanks Instructional Support Center, Suwanee GA.
Serving ~180,000 students — largest school district in Georgia.
"""

from __future__ import annotations

import logging
import re
import unicodedata
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

SCHEDULE_URL = "https://www.gcpsk12.org/about-us/board/board-meeting-schedule"

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
    "name": "Gwinnett County Public Schools J. Alvin Wilbanks Instructional Support Center",
    "slug": "gwinnett-schools-isc",
    "address": "437 Old Peachtree Rd NW",
    "neighborhood": "Suwanee",
    "city": "Suwanee",
    "state": "GA",
    "zip": "30024",
    "lat": 34.0490,
    "lng": -84.0705,
    "place_type": "organization",
    "spot_type": "organization",
    "website": "https://www.gcpsk12.org",
}

EVENT_TAGS = [
    "school-board",
    "government",
    "public-meeting",
    "education",
    "civic",
]

# Sections detected by <h2> heading text patterns.
_WORK_SESSION_HEADING_RE = re.compile(r"work\s+session", re.IGNORECASE)
_BUSINESS_MEETING_HEADING_RE = re.compile(
    r"business\s+meeting|board\s+meeting", re.IGNORECASE
)

# Trim footnote qualifiers appended to dates: "(3rd Wednesday)", "(2nd Thursday)", etc.
_DATE_QUALIFIER_RE = re.compile(r"\s*\(.*?\)\s*$")

# Date formats we might encounter (after stripping qualifiers).
_DATE_FMTS = [
    "%A, %B %d, %Y",   # "Tuesday, January 13, 2026"
    "%A, %B %d,\xa0%Y",  # With non-breaking space before year
]

# Default meeting times per section type (24-hour format).
# Matches intro text: "Work Sessions at 6:00 p.m." / "Business Meetings at 7:00 p.m."
WORK_SESSION_TIME = "18:00"
BUSINESS_MEETING_TIME = "19:00"

SERIES_HINT_WORK_SESSION = {
    "series_type": "recurring_show",
    "series_title": "Gwinnett County Schools Work Session",
    "frequency": "monthly",
}

SERIES_HINT_BOARD_MEETING = {
    "series_type": "recurring_show",
    "series_title": "Gwinnett County Schools Board Meeting",
    "frequency": "monthly",
}


def _fetch_html(url: str) -> Optional[str]:
    """Fetch the schedule page with a realistic browser user-agent."""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        logger.error(f"Gwinnett County Schools Board: HTTP fetch error for {url}: {exc}")
        return None


def _normalize_text(text: str) -> str:
    """Normalize unicode whitespace and strip."""
    text = unicodedata.normalize("NFKD", text)
    return text.strip()


def _try_parse_date(raw: str) -> Optional[date]:
    """Attempt to parse a raw date string, trying multiple formats."""
    cleaned = _DATE_QUALIFIER_RE.sub("", raw).strip()
    # Replace non-breaking spaces with regular spaces
    cleaned = cleaned.replace("\xa0", " ")

    for fmt in _DATE_FMTS:
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue

    # Fallback: strip day-of-week and try month/day/year variants
    # e.g. "Wednesday" prefix might have extra cruft
    parts = cleaned.split(",")
    if len(parts) >= 3:
        # "Wednesday, February 18, 2026" -> try without day-of-week
        rejoined = ",".join(parts[1:]).strip()
        try:
            return datetime.strptime(rejoined, "%B %d, %Y").date()
        except ValueError:
            pass

    return None


def _looks_like_date(text: str) -> bool:
    """Quick heuristic: does this text look like a date entry?"""
    # Must contain a 4-digit year and a month name.
    has_year = bool(re.search(r"\b20\d{2}\b", text))
    has_month = bool(
        re.search(
            r"\b(january|february|march|april|may|june|july|august|"
            r"september|october|november|december)\b",
            text,
            re.IGNORECASE,
        )
    )
    return has_year and has_month


def _parse_schedule(html: str) -> list[dict]:
    """
    Parse the board meeting schedule from the page HTML.

    Walks the document top-to-bottom, tracking the current section
    (work session vs. business meeting) as each <h2> is encountered.
    Date entries are <p> elements following each section heading.

    Returns a list of dicts with: date_str, title, start_time,
    description_text, series_hint.
    """
    soup = BeautifulSoup(html, "lxml")

    # Find the main content area (Finalsite uses fsPageContent or similar).
    content = (
        soup.find(class_="fsPageContent")
        or soup.find(class_="fsBody")
        or soup.find("main")
        or soup
    )

    raw_events: list[dict] = []
    current_section: Optional[str] = None  # "work_session" | "board_meeting"

    for el in content.find_all(["h2", "h3", "p"]):
        tag_name = el.name
        text = _normalize_text(el.get_text(separator=" "))

        if not text:
            continue

        if tag_name in ("h2", "h3"):
            # Detect section transitions.
            if _WORK_SESSION_HEADING_RE.search(text):
                current_section = "work_session"
                logger.debug("Gwinnett County Schools Board: entering Work Sessions section")
            elif _BUSINESS_MEETING_HEADING_RE.search(text):
                current_section = "board_meeting"
                logger.debug("Gwinnett County Schools Board: entering Business Meetings section")
            else:
                # Non-relevant heading (e.g., "Board of Education Meeting Stream")
                current_section = None
            continue

        if current_section is None:
            continue

        if not _looks_like_date(text):
            continue

        parsed_date = _try_parse_date(text)
        if not parsed_date:
            logger.debug(
                f"Gwinnett County Schools Board: could not parse date from {text!r}"
            )
            continue

        if parsed_date < date.today():
            logger.debug(
                f"Gwinnett County Schools Board: skipping past date: {parsed_date}"
            )
            continue

        if current_section == "work_session":
            raw_events.append({
                "date_str": parsed_date.strftime("%Y-%m-%d"),
                "title": "Gwinnett County Schools — Work Session",
                "start_time": WORK_SESSION_TIME,
                "description_text": (
                    "Gwinnett County Public Schools Board of Education Work Session. "
                    "Free and open to the public."
                ),
                "series_hint": SERIES_HINT_WORK_SESSION,
            })
        else:
            raw_events.append({
                "date_str": parsed_date.strftime("%Y-%m-%d"),
                "title": "Gwinnett County Schools — Board Meeting",
                "start_time": BUSINESS_MEETING_TIME,
                "description_text": (
                    "Gwinnett County Public Schools Board of Education regular business meeting. "
                    "Free and open to the public."
                ),
                "series_hint": SERIES_HINT_BOARD_MEETING,
            })

    return raw_events


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Gwinnett County Schools Board of Education meeting schedule.

    Fetches upcoming meeting events from the official GCPS schedule page
    (plain Finalsite HTML — no Playwright required).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)

    logger.info(f"Gwinnett County Schools Board: fetching {SCHEDULE_URL}")
    html = _fetch_html(SCHEDULE_URL)
    if not html:
        logger.error(
            "Gwinnett County Schools Board: could not fetch schedule page — aborting"
        )
        return 0, 0, 0

    raw_events = _parse_schedule(html)

    if not raw_events:
        logger.warning(
            "Gwinnett County Schools Board: no upcoming events parsed from schedule page"
        )
        return 0, 0, 0

    logger.info(
        f"Gwinnett County Schools Board: found {len(raw_events)} raw events"
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
                    f"Gwinnett County Schools Board: updated: {title} on {start_date}"
                )
                continue

            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(
                f"Gwinnett County Schools Board: added: {title} on {start_date}"
            )

        except Exception as exc:
            logger.warning(
                f"Gwinnett County Schools Board: error processing event {ev!r}: {exc}"
            )
            continue

    logger.info(
        f"Gwinnett County Schools Board crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
