"""
Crawler for Fulton County Schools Board of Education meetings.

Source: https://simbli.eboardsolutions.com/SB_Meetings/SB_MeetingListing.aspx?S=36031609
Platform: Simbli eBoard — protected by Incapsula WAF, requires Playwright.

Meeting types and venue mapping:
- Work Session        → Fulton County Schools North Learning Center (Sandy Springs)
- Board Meeting       → Fulton County Schools South Learning Center (Union City)
- Special Called Meeting → ad hoc; defaults to South Learning Center

All meetings are free and open to the public. Public comment opens at 6:00 PM.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from date_utils import parse_human_date
from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

MEETING_LIST_URL = (
    "https://simbli.eboardsolutions.com/SB_Meetings/SB_MeetingListing.aspx?S=36031609"
)
BASE_URL = "https://simbli.eboardsolutions.com"

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
    "venue_type": "community_center",
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
    "venue_type": "community_center",
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

DESCRIPTION = (
    "Fulton County Schools Board of Education meeting. "
    "The meeting is free and open to the public. "
    "Public comment period opens at 6:00 PM."
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


def parse_time_string(time_str: str) -> Optional[str]:
    """Convert '6:00 PM' or '6:30 p.m.' to 24-hour 'HH:MM'."""
    if not time_str:
        return None
    time_str = time_str.strip()

    # Normalize abbreviated periods: p.m. -> PM, a.m. -> AM
    time_str = re.sub(r"p\.m\.", "PM", time_str, flags=re.IGNORECASE)
    time_str = re.sub(r"a\.m\.", "AM", time_str, flags=re.IGNORECASE)

    # Handle ranges — take the start time only
    if "-" in time_str or "\u2013" in time_str:
        time_str = re.split(r"[-\u2013]", time_str)[0].strip()

    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_str.upper())
    if match:
        hour = int(match.group(1))
        minute = match.group(2)
        period = match.group(3)
        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    # Try H:MM without AM/PM — fall back to None rather than guess
    return None


def resolve_venue(raw_name: str) -> dict:
    """
    Return the appropriate venue dict based on meeting type.

    Work Sessions → North Learning Center (Sandy Springs)
    Board Meetings → South Learning Center (Union City)
    Special Called or unknown → South Learning Center (default)
    """
    name_lower = raw_name.lower()
    if "work session" in name_lower:
        return VENUE_NORTH
    # Board meetings, special called meetings, and anything else default south
    return VENUE_SOUTH


def build_event_title(raw_name: str) -> str:
    """
    Normalize meeting names scraped from the listing into clean event titles.

    Examples:
        'Work Session'            -> 'Fulton County Schools Board of Education — Work Session'
        'Board Meeting'           -> 'Fulton County Schools Board of Education — Board Meeting'
        'Special Called Meeting'  -> 'Fulton County Schools Board of Education — Special Called Meeting'
        'Fulton County ...'       -> kept as-is
    """
    raw = raw_name.strip()
    prefix = "Fulton County Schools Board of Education"

    if "fulton" in raw.lower():
        return raw

    return f"{prefix} \u2014 {raw}"


def determine_series_hint(raw_name: str) -> Optional[dict]:
    """Return the appropriate series hint based on meeting type."""
    name_lower = raw_name.lower()
    if "work session" in name_lower:
        return SERIES_HINT_WORK_SESSION
    if "board meeting" in name_lower or "regular" in name_lower:
        return SERIES_HINT_BOARD_MEETING
    # Special called meetings and one-offs get no series grouping
    return None


def _fetch_html_with_playwright() -> Optional[str]:
    """
    Load the Simbli eBoard meeting listing with Playwright.

    Simbli is behind Incapsula WAF. Using a full Chromium browser with a
    realistic user-agent is enough to pass the challenge for a static listing
    page. If the site starts returning a CAPTCHA page, we'll need to add a
    solved challenge cookie or switch to a residential proxy — but that hasn't
    been necessary historically.
    """
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
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )
        page = context.new_page()

        try:
            logger.info(f"Loading Simbli eBoard calendar: {MEETING_LIST_URL}")
            response = page.goto(
                MEETING_LIST_URL, wait_until="networkidle", timeout=45000
            )

            if not response:
                logger.error("Fulton County Schools Board: no response from Simbli eBoard")
                return None

            if response.status >= 400:
                logger.error(
                    f"Fulton County Schools Board: Simbli eBoard returned HTTP {response.status}"
                )
                return None

            # Wait a beat for any JS rendering to finish
            page.wait_for_timeout(3000)

            html = page.content()
            return html

        except Exception as exc:
            logger.error(f"Fulton County Schools Board: Playwright error: {exc}")
            return None

        finally:
            browser.close()


def parse_meeting_rows(html: str) -> list[dict]:
    """
    Parse the meeting listing table from Simbli eBoard HTML.

    Simbli renders a <table> (or <div>-based grid) with columns:
        Meeting Name | Date | Time | Location | Agenda | Minutes

    We try the table-row approach first, then fall back to scanning for
    date patterns if the layout is different.

    Returns a list of raw dicts with keys: name, date_str, time_str, detail_url.
    """
    soup = BeautifulSoup(html, "lxml")
    meetings: list[dict] = []

    # ------------------------------------------------------------------ #
    # Strategy 1: Standard <table> rows                                   #
    # ------------------------------------------------------------------ #
    table = soup.find(
        "table",
        id=re.compile(r"(MeetingList|grdMtg|MtgGrid|dgMeetings)", re.IGNORECASE),
    )
    if not table:
        # Some Simbli versions use a plain table without a specific id
        table = soup.find(
            "table", class_=re.compile(r"(meeting|grid|listing)", re.IGNORECASE)
        )
    if not table:
        # Last resort: pick the largest table on the page
        tables = soup.find_all("table")
        if tables:
            table = max(tables, key=lambda t: len(t.find_all("tr")))

    if table:
        rows = table.find_all("tr")
        # Skip the header row
        for row in rows[1:]:
            cells = row.find_all("td")
            if len(cells) < 2:
                continue

            # Cell 0 usually has the meeting name (sometimes as a link)
            name_cell = cells[0]
            name_link = name_cell.find("a")
            raw_name = (
                name_link.get_text(strip=True)
                if name_link
                else name_cell.get_text(strip=True)
            )

            if not raw_name or len(raw_name) < 3:
                continue

            # Grab the detail URL if present
            detail_url = MEETING_LIST_URL
            if name_link and name_link.get("href"):
                detail_url = urljoin(BASE_URL, name_link["href"])
            else:
                any_link = row.find(
                    "a", href=re.compile(r"MeetingDetail|Agenda", re.IGNORECASE)
                )
                if any_link and any_link.get("href"):
                    detail_url = urljoin(BASE_URL, any_link["href"])

            # Date — look through remaining cells for a date pattern
            date_str: Optional[str] = None
            time_str: Optional[str] = None

            for cell in cells[1:]:
                text = cell.get_text(strip=True)
                # Date patterns: MM/DD/YYYY, Month DD, YYYY, etc.
                if not date_str and re.search(r"\d{1,2}/\d{1,2}/\d{4}", text):
                    date_str = text
                    continue
                if not date_str and re.search(
                    r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}",
                    text,
                    re.IGNORECASE,
                ):
                    date_str = text
                    continue
                # Time patterns: H:MM AM/PM, H:MM p.m., etc.
                if not time_str and re.search(
                    r"\d{1,2}:\d{2}\s*(AM|PM|a\.m\.|p\.m\.)", text, re.IGNORECASE
                ):
                    time_str = text

            if not date_str:
                # Try to find a date in the full row text
                row_text = row.get_text()
                m = re.search(r"\d{1,2}/\d{1,2}/\d{4}", row_text)
                if m:
                    date_str = m.group(0)

            if not date_str:
                logger.debug(
                    f"Fulton County Schools Board: no date found for meeting: {raw_name!r}"
                )
                continue

            meetings.append(
                {
                    "name": raw_name,
                    "date_str": date_str,
                    "time_str": time_str,
                    "detail_url": detail_url,
                }
            )

        if meetings:
            logger.info(
                f"Fulton County Schools Board: parsed {len(meetings)} meeting rows from table"
            )
            return meetings

    # ------------------------------------------------------------------ #
    # Strategy 2: Scan full page text for date+name patterns              #
    # Simbli occasionally uses a div-based layout                         #
    # ------------------------------------------------------------------ #
    logger.warning(
        "Fulton County Schools Board: table strategy found no meetings — falling back to text scan"
    )
    body_text = soup.get_text(separator="\n")
    lines = [ln.strip() for ln in body_text.splitlines() if ln.strip()]

    date_pattern = re.compile(
        r"(\d{1,2}/\d{1,2}/\d{4}|"
        r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4})",
        re.IGNORECASE,
    )
    time_pattern = re.compile(
        r"\d{1,2}:\d{2}\s*(AM|PM|a\.m\.|p\.m\.)", re.IGNORECASE
    )
    meeting_type_pattern = re.compile(
        r"(board\s+meeting|work\s+session|special\s+call|regular\s+meeting|"
        r"public\s+hearing|budget\s+hearing)",
        re.IGNORECASE,
    )

    for i, line in enumerate(lines):
        dm = date_pattern.search(line)
        if not dm:
            continue

        date_str = dm.group(0)

        # Look for a meeting type in nearby lines (±3)
        raw_name = None
        time_str_candidate = None
        for offset in range(-3, 4):
            idx = i + offset
            if not (0 <= idx < len(lines)):
                continue
            check = lines[idx]
            if meeting_type_pattern.search(check) and not raw_name:
                raw_name = check
            tm = time_pattern.search(check)
            if tm and not time_str_candidate:
                time_str_candidate = check

        if not raw_name:
            continue

        meetings.append(
            {
                "name": raw_name,
                "date_str": date_str,
                "time_str": time_str_candidate,
                "detail_url": MEETING_LIST_URL,
            }
        )

    logger.info(
        f"Fulton County Schools Board: text-scan strategy found {len(meetings)} meetings"
    )
    return meetings


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Fulton County Schools Board of Education meeting calendar.

    Uses Playwright to bypass the Incapsula WAF on Simbli eBoard, then
    parses the meeting listing table for upcoming board meetings.

    Work Sessions are mapped to the North Learning Center (Sandy Springs);
    Board Meetings are mapped to the South Learning Center (Union City).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Pre-create both venues so they exist in the DB regardless of upcoming
    # meeting schedule — venue records have standalone value.
    venue_id_north = get_or_create_venue(VENUE_NORTH)
    venue_id_south = get_or_create_venue(VENUE_SOUTH)

    venue_id_map = {
        "north": venue_id_north,
        "south": venue_id_south,
    }

    # Fetch the page
    html = _fetch_html_with_playwright()
    if not html:
        logger.error("Fulton County Schools Board: could not fetch Simbli eBoard page — aborting")
        return 0, 0, 0

    # Parse meeting rows
    raw_meetings = parse_meeting_rows(html)
    if not raw_meetings:
        logger.warning(
            "Fulton County Schools Board: no meetings found on Simbli eBoard listing page"
        )
        return 0, 0, 0

    today = datetime.now().date()
    seen: set[str] = set()

    for meeting in raw_meetings:
        try:
            raw_name = meeting["name"]
            date_str = meeting["date_str"]
            time_str = meeting.get("time_str")
            detail_url = meeting.get("detail_url") or MEETING_LIST_URL

            # Parse and validate date
            start_date = parse_human_date(date_str)
            if not start_date:
                logger.debug(
                    f"Fulton County Schools Board: could not parse date {date_str!r} for {raw_name!r}"
                )
                continue

            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                continue

            if event_date < today:
                logger.debug(
                    f"Fulton County Schools Board: skipping past meeting: {raw_name} on {start_date}"
                )
                continue

            # Resolve venue and parse time
            venue_data = resolve_venue(raw_name)
            venue_id = (
                venue_id_map["north"]
                if venue_data is VENUE_NORTH
                else venue_id_map["south"]
            )

            # Default to 18:00 when the listing doesn't show a time — all
            # public comment periods open at 6:00 PM per the standing schedule.
            start_time = parse_time_string(time_str) if time_str else "18:00"

            # Build clean title
            title = build_event_title(raw_name)

            # Dedupe within this run
            dedup_key = f"{title}|{start_date}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            events_found += 1

            # Content hash for DB-level dedup
            content_hash = generate_content_hash(title, venue_data["name"], start_date)

            # Determine series grouping
            series_hint = determine_series_hint(raw_name)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
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
                "source_url": detail_url,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{raw_name} — {date_str}",
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
                f"Fulton County Schools Board: error processing meeting {meeting!r}: {exc}"
            )
            continue

    logger.info(
        f"Fulton County Schools Board crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
