"""
Crawler for MARTA (Metropolitan Atlanta Rapid Transit Authority) Board of Directors
and committee meetings.

Source: https://itsmarta.com/meeting-schedule.aspx

The MARTA Legistar instance (marta.legistar.com) does not expose the Calendar.aspx
page without ASP.NET session state, and the Legistar REST API is not enabled for
MARTA's client. The canonical schedule is maintained on the MARTA website directly.

Meeting types published:
- Board Working Session — monthly, noon
- Board Meeting (Board of Directors) — monthly, 1:30 p.m.
- Planning & Capital Programs Committee — monthly
- Operations & Safety Committee — monthly
- Business Management Committee — monthly
- External Relations Committee — bi-monthly
- Audit Committee — quarterly

All meetings are currently held via remote access. The venue record reflects MARTA
Headquarters where in-person meetings were historically held.

Venue: MARTA Headquarters
       2424 Piedmont Rd NE, Atlanta, GA 30324
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SCHEDULE_URL = "https://itsmarta.com/meeting-schedule.aspx"
PUBLIC_MEETING_URL = "https://bit.ly/MARTAPublicMeeting"
BASE_URL = "https://itsmarta.com"

PLACE_DATA = {
    "name": "MARTA Headquarters",
    "slug": "marta-headquarters",
    "address": "2424 Piedmont Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.8198,
    "lng": -84.3675,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": "https://www.itsmarta.com",
    "vibes": ["government", "civic", "transit"],
}

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Maps meeting name fragments to series metadata
_SERIES_MAP: dict[str, dict] = {
    "board working session": {
        "series_type": "recurring_show",
        "series_title": "MARTA Board Working Session",
        "frequency": "monthly",
    },
    "board meeting": {
        "series_type": "recurring_show",
        "series_title": "MARTA Board of Directors Meeting",
        "frequency": "monthly",
    },
    "planning & capital programs": {
        "series_type": "recurring_show",
        "series_title": "MARTA Planning & Capital Programs Committee",
        "frequency": "monthly",
    },
    "operations & safety": {
        "series_type": "recurring_show",
        "series_title": "MARTA Operations & Safety Committee",
        "frequency": "monthly",
    },
    "business management": {
        "series_type": "recurring_show",
        "series_title": "MARTA Business Management Committee",
        "frequency": "monthly",
    },
    "external relations": {
        "series_type": "recurring_show",
        "series_title": "MARTA External Relations Committee",
        "frequency": "monthly",
    },
    "audit": {
        "series_type": "recurring_show",
        "series_title": "MARTA Audit Committee",
        "frequency": "monthly",
    },
}


def _series_hint_for(meeting_name: str) -> Optional[dict]:
    """Return a series hint keyed to the meeting name."""
    name_lower = meeting_name.lower()
    for fragment, hint in _SERIES_MAP.items():
        if fragment in name_lower:
            return hint
    return None


def _description_for(meeting_name: str) -> str:
    """Return a context-appropriate description for the meeting type."""
    name_lower = meeting_name.lower()
    if "working session" in name_lower:
        return (
            "MARTA Board Working Session. Open to the public via remote access. "
            "The Board discusses transit operations, capital projects, and policy "
            "before the formal Board Meeting. "
            f"Join at {PUBLIC_MEETING_URL}"
        )
    if "board meeting" in name_lower:
        return (
            "MARTA Board of Directors Meeting. Open to the public via remote access. "
            "A public comment period allows riders and community members to address "
            "the Board on transit-related matters. "
            f"Join at {PUBLIC_MEETING_URL}"
        )
    # Committee meetings
    return (
        f"MARTA {meeting_name}. Open to the public via remote access. "
        "Committee reviews and makes recommendations on MARTA operations, "
        "capital programs, and policy. "
        f"Join at {PUBLIC_MEETING_URL}"
    )


def _parse_time(time_str: str) -> Optional[str]:
    """
    Convert time strings to 24-hour 'HH:MM'.

    Handles:
      'Noon'           -> '12:00'
      '1:30 p.m.'      -> '13:30'
      '9:30 a.m.'      -> '09:30'
      '10:00 a.m.'     -> '10:00'
    """
    if not time_str:
        return None
    s = time_str.strip()

    if re.search(r"\bnoon\b", s, re.IGNORECASE):
        return "12:00"

    # Normalise a.m./p.m. -> AM/PM
    s = re.sub(r"a\.m\.", "AM", s, flags=re.IGNORECASE)
    s = re.sub(r"p\.m\.?", "PM", s, flags=re.IGNORECASE)  # trailing dot optional

    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", s.upper())
    if match:
        hour = int(match.group(1))
        minute = match.group(2)
        period = match.group(3)
        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    return None


def _parse_li_text(li_text: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Parse a single <li> text into (date_str, time_str, meeting_type_suffix).

    Two formats occur:
      "March 12, 2026, at Noon — Board Working Session"
        -> ("2026-03-12", "12:00", "Board Working Session")
      "January 22, 2026, at 9:30 a.m."
        -> ("2026-01-22", "09:30", None)   # committee; name comes from section

    Returns (None, None, None) for unparseable or "No Meeting" items.
    """
    text = li_text.strip()

    # Skip "No Meeting" entries
    if re.search(r"no\s+meeting", text, re.IGNORECASE):
        return None, None, None

    # Extract optional meeting type suffix (after em dash or regular dash)
    meeting_type: Optional[str] = None
    dash_match = re.search(r"[—\-]\s*(.+)$", text)
    if dash_match:
        meeting_type = dash_match.group(1).strip()
        text = text[: dash_match.start()].strip()

    # Extract date: "Month [D]D[,][ ][,] YYYY"
    # The page sometimes has stray HTML entities or b-tags collapsed to spaces,
    # e.g. "April 9  , 2026" — normalise whitespace before and after day number.
    text = re.sub(r"\s{2,}", " ", text)
    date_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})\s*,?\s*(\d{4})",
        text,
        re.IGNORECASE,
    )
    if not date_match:
        return None, None, None

    month_s, day_s, year_s = date_match.groups()
    try:
        d = datetime.strptime(f"{month_s} {day_s} {year_s}", "%B %d %Y")
        date_str = d.strftime("%Y-%m-%d")
    except ValueError:
        return None, None, None

    # Extract time from the remaining text
    # "at Noon", "at 1:30 p.m.", "Noon", "9:30 a.m.", "(Friday)" etc.
    time_raw_match = re.search(
        r"(?:at\s+)?(Noon|\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.?|AM|PM))",
        text,
        re.IGNORECASE,
    )
    time_str: Optional[str] = None
    if time_raw_match:
        time_str = _parse_time(time_raw_match.group(1))

    return date_str, time_str, meeting_type


def _fetch_schedule_html() -> Optional[str]:
    """Fetch the MARTA meeting schedule page. Returns raw HTML or None on failure."""
    try:
        response = requests.get(SCHEDULE_URL, headers=_HEADERS, timeout=20)
        response.raise_for_status()
        return response.text
    except requests.RequestException as exc:
        logger.error("Failed to fetch MARTA meeting schedule: %s", exc)
        return None


def _parse_meetings(html: str) -> list[dict]:
    """
    Parse the itsmarta.com/meeting-schedule.aspx page into raw meeting dicts.

    Page structure inside #ctl00_ContentPlaceHolder1_cntpolice:

      <h2>2026 Board Meeting Schedule</h2>
      <ul>
        <li>March 12, 2026, at Noon — Board Working Session</li>
        <li>March 12, 2026, at 1:30 p.m. — Board Meeting</li>
        ...
      </ul>

      <h2>Committee Meetings</h2>
      <p><b>Planning & Capital Programs Committee</b><br>2026 Meeting Schedule:</p>
      <ul>
        <li>January 22, 2026, at 9:30 a.m.</li>
        ...
      </ul>
      <hr>
      <p><b>Operations & Safety Committee</b>...</p>
      <ul>...</ul>
      ...

    Returns list of dicts: {name, date_str, time_str}.
    """
    soup = BeautifulSoup(html, "lxml")

    # Try the known ID first; fall back to searching for the content block.
    block = soup.find("div", id="ctl00_ContentPlaceHolder1_cntpolice")
    if not block:
        block = soup.find("div", class_="introduction__content")
    if not block:
        # Last resort: find the h1 that says "Board Meeting Schedule"
        h1 = soup.find(
            "h1", string=re.compile(r"Board Meeting Schedule", re.IGNORECASE)
        )
        if h1:
            block = h1.find_parent("div")
    if not block:
        logger.warning("Could not locate meeting schedule content block on MARTA page")
        return []

    meetings: list[dict] = []
    current_committee: Optional[str] = None

    # Walk direct children of the content area (or the block itself)
    content = block.find("div", class_="introduction__content") or block

    # We'll iterate over all elements in document order
    for element in content.descendants:
        tag = getattr(element, "name", None)
        if tag is None:
            continue

        if tag == "h2":
            h2_text = element.get_text(strip=True)
            if "committee" in h2_text.lower():
                current_committee = None  # will be set by subsequent <p><b>
            else:
                current_committee = None  # board meeting section — no committee prefix
            continue

        if tag == "p":
            # Committee name is inside a <b> within a <p>
            b_tag = element.find("b")
            if b_tag:
                b_text = b_tag.get_text(strip=True)
                # Filter out footnote-style text and "2026 Meeting Schedule" labels
                if b_text and "schedule" not in b_text.lower() and "*" not in b_text:
                    # Normalise bare "Audit" -> "Audit Committee" for clarity
                    if b_text.lower() == "audit":
                        b_text = "Audit Committee"
                    current_committee = b_text
            continue

        if tag == "li":
            li_text = element.get_text(separator=" ", strip=True)
            date_str, time_str, meeting_type_suffix = _parse_li_text(li_text)
            if not date_str:
                continue

            # Determine the meeting name:
            # - Board section items embed the type after em dash ("— Board Meeting")
            # - Committee section items carry the committee name from the section context
            if meeting_type_suffix:
                name = meeting_type_suffix
            elif current_committee:
                name = current_committee
            else:
                name = "MARTA Board Meeting"

            meetings.append(
                {
                    "name": name,
                    "date_str": date_str,
                    "time_str": time_str,
                }
            )

    logger.info("Parsed %d MARTA meetings from schedule page", len(meetings))
    return meetings


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl MARTA Board and committee meeting schedule from itsmarta.com.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)

    html = _fetch_schedule_html()
    if not html:
        logger.error("Could not fetch MARTA meeting schedule — aborting")
        return 0, 0, 0

    raw_meetings = _parse_meetings(html)
    if not raw_meetings:
        logger.warning("No MARTA meetings parsed from schedule page")
        return 0, 0, 0

    today = datetime.now().date()
    seen: set[str] = set()

    for meeting in raw_meetings:
        try:
            name = meeting["name"]
            date_str = meeting["date_str"]
            time_str = meeting.get("time_str")

            try:
                event_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                logger.debug("Bad date format in MARTA meeting: %r", date_str)
                continue

            if event_date < today:
                logger.debug("Skipping past MARTA meeting: %s on %s", name, date_str)
                continue

            title = f"MARTA {name}" if not name.lower().startswith("marta") else name

            dedup_key = f"{title}|{date_str}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            events_found += 1

            tags = ["transit", "attend", "public-comment", "government", "civic"]
            series_hint = _series_hint_for(name)
            description = _description_for(name)

            content_hash = generate_content_hash(title, PLACE_DATA["name"], date_str)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": date_str,
                "start_time": time_str,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "civic",
                "subcategory": None,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": SCHEDULE_URL,
                "ticket_url": PUBLIC_MEETING_URL,
                "image_url": None,
                "raw_text": f"{title} — {date_str}",
                "extraction_confidence": 0.92,
                "is_recurring": bool(series_hint),
                "recurrence_rule": "FREQ=MONTHLY" if series_hint else None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                logger.debug("Updated: %s on %s", title, date_str)
                continue

            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info("Added: %s on %s", title, date_str)

        except Exception as exc:
            logger.warning("Error processing MARTA meeting %r: %s", meeting, exc)
            continue

    logger.info(
        "MARTA Board crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
