"""
Crawler for the West End Comedy Fest (westendcomedyfest.com).

A 3-day annual comedy festival in Atlanta's West End neighborhood.
The 5th annual festival (2026) ran March 6-8 across three venues:
  - Wild Heaven Garden Room   (sub-room of Wild Heaven West End)
  - Wild Heaven Lounge        (sub-room of Wild Heaven West End)
  - Plywood Place             (933 Lee St SW, Atlanta, GA 30310)

Strategy: scrape the /schedule page with BeautifulSoup. The schedule
markup changes year to year, so we try two extraction approaches and
fall back to the known 2026 hardcoded schedule when live parsing yields
no results.
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

BASE_URL = "https://www.westendcomedyfest.com"
SCHEDULE_URL = f"{BASE_URL}/schedule"
TICKET_BASE_URL = f"{BASE_URL}/buytickets/p"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    )
}

# ---------------------------------------------------------------------------
# Venue definitions
# ---------------------------------------------------------------------------

# Wild Heaven West End already exists in the DB — reuse it.
WILD_HEAVEN_VENUE_DATA = {
    "name": "Wild Heaven West End",
    "slug": "wild-heaven-west-end",
    "address": "1010 White St SW",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "lat": 33.7396,
    "lng": -84.4125,
    "place_type": "brewery",
    "spot_type": "brewery",
    "website": "https://wildheavenbeer.com/west-end",
    "vibes": ["craft-beer", "brewery", "beltline", "west-end", "patio", "dog-friendly"],
}

# Plywood Place is a new venue — create it.
PLYWOOD_PLACE_VENUE_DATA = {
    "name": "Plywood Place",
    "slug": "plywood-place",
    "address": "933 Lee St SW",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "lat": 33.7370,
    "lng": -84.4120,
    "place_type": "event_space",
    "spot_type": "venue",
    "website": "https://www.plywoodpeople.com",
    "vibes": ["arts", "comedy", "community-space", "west-end"],
}

# ---------------------------------------------------------------------------
# Venue name → DB venue mapping
# Keys are lowercase fragments that appear in room/venue strings from the site.
# ---------------------------------------------------------------------------

VENUE_ROOM_MAP = {
    "garden room": "wild_heaven",
    "lounge": "wild_heaven",
    "wild heaven": "wild_heaven",
    "plywood": "plywood",
}

# ---------------------------------------------------------------------------
# Hardcoded 2026 schedule — fallback when live scraping returns nothing.
# Each entry: (date_str, title, start_time_24, venue_key, ticket_slug, sold_out)
# ---------------------------------------------------------------------------

SCHEDULE_2026 = [
    # Friday Mar 6
    ("2026-03-06", "Squids & Giggles", "18:00", "wild_heaven", "squids-giggles", False),
    (
        "2026-03-06",
        "Matthew Broussard",
        "19:00",
        "wild_heaven",
        "matthew-broussard",
        False,
    ),
    ("2026-03-06", "Debra DiGiovanni", "19:30", "plywood", "debra-digiovanni", False),
    (
        "2026-03-06",
        "Beer & Comedy Night",
        "20:00",
        "wild_heaven",
        "beer-comedy-night",
        False,
    ),
    ("2026-03-06", "Caitlin Peluffo", "21:30", "wild_heaven", "caitlin-peluffo", False),
    # Saturday Mar 7
    ("2026-03-07", "Rad Ole Opry", "16:00", "plywood", "rad-ole-opry", False),
    (
        "2026-03-07",
        "Dirty South Comedy",
        "18:00",
        "wild_heaven",
        "dirty-south-comedy",
        False,
    ),
    ("2026-03-07", "Heather Shaw", "19:00", "wild_heaven", "heather-shaw", False),
    ("2026-03-07", "Chris Higgins", "19:30", "plywood", "chris-higgins", False),
    (
        "2026-03-07",
        "Rotknee Presents",
        "20:00",
        "wild_heaven",
        "rotknee-presents",
        False,
    ),
    ("2026-03-07", "Ian Lara", "21:30", "wild_heaven", "ian-lara", False),
    # Sunday Mar 8
    ("2026-03-08", "ATL Hoedown", "15:00", "plywood", "atl-hoedown", False),
    ("2026-03-08", "Promedy", "16:30", "wild_heaven", "promedy", False),
    ("2026-03-08", "Sidequest", "17:00", "wild_heaven", "sidequest", False),
    ("2026-03-08", "Sweet Baby Kita", "17:30", "plywood", "sweet-baby-kita", False),
    ("2026-03-08", "Geoffrey Asmus", "19:00", "wild_heaven", "geoffrey-asmus", True),
    (
        "2026-03-08",
        "Geoffrey Asmus (2nd Show)",
        "21:30",
        "wild_heaven",
        "geoffrey-asmus-2",
        True,
    ),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MONTH_MAP = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}

_TIME_RE = re.compile(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", re.IGNORECASE)
_DATE_RE = re.compile(
    r"(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?"
    r"(January|February|March|April|May|June|July|August|September|October|November|December"
    r"|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
    r"\s+(\d{1,2})(?:,?\s+(\d{4}))?",
    re.IGNORECASE,
)


def _parse_time(text: str) -> Optional[str]:
    """Convert '7PM', '7:30PM', '9:30 pm' to 24-hour 'HH:MM' string."""
    m = _TIME_RE.search(text)
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2) or 0)
    period = m.group(3).lower()
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _parse_date(text: str, year: int) -> Optional[str]:
    """Parse a date string like 'Friday Mar 6' or 'March 6, 2026' to 'YYYY-MM-DD'."""
    m = _DATE_RE.search(text)
    if not m:
        return None
    month_name = m.group(1).lower()
    day = int(m.group(2))
    event_year = int(m.group(3)) if m.group(3) else year
    month_num = _MONTH_MAP.get(month_name)
    if not month_num:
        return None
    try:
        return datetime(event_year, month_num, day).strftime("%Y-%m-%d")
    except ValueError:
        return None


def _resolve_venue_key(text: str) -> str:
    """Map a venue/room name fragment to 'wild_heaven' or 'plywood'."""
    text_lower = text.lower()
    for fragment, key in VENUE_ROOM_MAP.items():
        if fragment in text_lower:
            return key
    # Default to Wild Heaven (the festival's primary venue)
    return "wild_heaven"


def _build_ticket_url(slug: str) -> Optional[str]:
    if not slug:
        return None
    return f"{TICKET_BASE_URL}/{slug}"


def _build_description(
    *,
    title: str,
    venue_label: str,
    start_date: str,
    start_time: Optional[str],
    ticket_url: Optional[str],
    sold_out: bool,
) -> str:
    time_label = ""
    if start_time:
        try:
            time_label = datetime.strptime(start_time, "%H:%M").strftime("%-I:%M %p")
        except ValueError:
            time_label = start_time

    parts = [
        f"{title} is a comedy show at the West End Comedy Fest,"
        f" held at {venue_label} in Atlanta's West End neighborhood."
    ]
    if start_date and time_label:
        parts.append(f"Scheduled {start_date} at {time_label}.")
    elif start_date:
        parts.append(f"Scheduled {start_date}.")
    if sold_out:
        parts.append("This show is SOLD OUT.")
    if ticket_url and not sold_out:
        parts.append(f"Tickets: {ticket_url}")
    return " ".join(parts)[:1200]


# ---------------------------------------------------------------------------
# Live scraping
# ---------------------------------------------------------------------------


def _fetch_html(url: str, timeout: int = 20) -> Optional[str]:
    try:
        resp = requests.get(url, headers=REQUEST_HEADERS, timeout=timeout)
        resp.raise_for_status()
        return resp.text
    except Exception as exc:
        logger.warning("West End Comedy Fest: failed to fetch %s — %s", url, exc)
        return None


def _parse_schedule_html(html: str, year: int) -> list[dict]:
    """
    Attempt to extract show data from the /schedule page.

    Tries two approaches:
    1. Look for structured event blocks (divs/articles with date + title + venue).
    2. Fall back to scanning raw text for date headers followed by show lines.

    Returns a list of raw show dicts with keys:
        title, start_date, start_time, venue_key, ticket_slug, sold_out
    """
    soup = BeautifulSoup(html, "lxml")
    shows: list[dict] = []

    # --- Approach 1: structured card/block elements ---
    # Many Squarespace / Wix / Webflow sites use repeating elements.
    # We look for any element containing both a time pattern and a venue hint.
    candidate_blocks = (
        soup.select(".eventlist-event")  # Squarespace
        or soup.select("[class*='event-block']")
        or soup.select("[class*='show-block']")
        or soup.select("article")
        or soup.select(".schedule-item")
        or soup.select("[class*='schedule']")
    )

    for block in candidate_blocks:
        text = block.get_text(" ", strip=True)
        if len(text) < 5:
            continue

        # Must have a time to be a show
        if not _TIME_RE.search(text):
            continue

        start_date = _parse_date(text, year)
        if not start_date:
            continue

        start_time = _parse_time(text)

        # Guess title: first non-date, non-time, non-venue line of meaningful length
        title = _guess_title_from_block(block)
        if not title:
            continue

        venue_key = _resolve_venue_key(text)
        sold_out = bool(re.search(r"sold.?out", text, re.IGNORECASE))

        # Try to find a ticket link slug in this block
        ticket_slug = _extract_ticket_slug(block)

        shows.append(
            {
                "title": title,
                "start_date": start_date,
                "start_time": start_time,
                "venue_key": venue_key,
                "ticket_slug": ticket_slug,
                "sold_out": sold_out,
            }
        )

    if len(shows) >= 5:
        logger.info(
            "West End Comedy Fest: extracted %d shows via structured blocks", len(shows)
        )
        return shows
    elif shows:
        logger.info(
            "West End Comedy Fest: structured blocks found only %d shows — trying text scan", len(shows)
        )

    # --- Approach 2: raw text scan ---
    text_shows = _parse_schedule_from_text(soup.get_text("\n", strip=True), year)
    if len(text_shows) > len(shows):
        logger.info(
            "West End Comedy Fest: extracted %d shows via text scan", len(text_shows)
        )
        return text_shows
    if shows:
        return shows
    return text_shows


def _guess_title_from_block(block) -> Optional[str]:
    """Heuristic: find the most prominent text fragment in a block that looks like a show title."""
    # Try heading tags first
    for tag in ("h1", "h2", "h3", "h4", "strong", "b"):
        el = block.find(tag)
        if el:
            text = el.get_text(" ", strip=True)
            if (
                text
                and len(text) >= 3
                and not _TIME_RE.search(text)
                and not _DATE_RE.search(text)
            ):
                return text

    # Fall back: first line of meaningful length that isn't a date or time
    for line in block.get_text("\n", strip=True).split("\n"):
        line = line.strip()
        if len(line) < 3:
            continue
        if _TIME_RE.fullmatch(line.strip()) or _DATE_RE.fullmatch(line.strip()):
            continue
        if re.match(
            r"^(garden room|lounge|plywood|wild heaven|venue|location)",
            line,
            re.IGNORECASE,
        ):
            continue
        return line
    return None


def _extract_ticket_slug(block) -> Optional[str]:
    """Extract the ticket slug from a /buytickets/p/{slug} link if present."""
    for anchor in block.find_all("a", href=True):
        href = anchor["href"]
        if "buytickets/p/" in href:
            slug = href.rstrip("/").split("/")[-1]
            if slug:
                return slug
    return None


def _parse_schedule_from_text(text: str, year: int) -> list[dict]:
    """
    Fallback text parser: look for date headers followed by 'TIME | Title | Venue' lines.
    This is a best-effort heuristic for when the page layout is unfamiliar.
    """
    shows: list[dict] = []
    current_date: Optional[str] = None
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    for line in lines:
        # Check if this line is a date header
        parsed_date = _parse_date(line, year)
        if parsed_date and not _TIME_RE.search(line):
            current_date = parsed_date
            continue

        if not current_date:
            continue

        # Check if this line has a time — treat it as a show line
        if not _TIME_RE.search(line):
            continue

        start_time = _parse_time(line)
        venue_key = _resolve_venue_key(line)
        sold_out = bool(re.search(r"sold.?out", line, re.IGNORECASE))

        # Extract title: remove time, venue, and sold-out tokens
        title = re.sub(_TIME_RE.pattern, "", line, flags=re.IGNORECASE)
        title = re.sub(
            r"\b(garden room|lounge|plywood place|plywood|wild heaven|sold.?out)\b",
            "",
            title,
            flags=re.IGNORECASE,
        )
        title = re.sub(r"[|\-–—,]+", " ", title)
        title = re.sub(r"\s{2,}", " ", title).strip()

        if len(title) < 3:
            continue

        shows.append(
            {
                "title": title,
                "start_date": current_date,
                "start_time": start_time,
                "venue_key": venue_key,
                "ticket_slug": None,  # Can't reliably extract from raw text
                "sold_out": sold_out,
            }
        )

    return shows


# ---------------------------------------------------------------------------
# Hardcoded fallback
# ---------------------------------------------------------------------------


def _get_hardcoded_2026_shows() -> list[dict]:
    shows = []
    for date_str, title, start_time, venue_key, ticket_slug, sold_out in SCHEDULE_2026:
        shows.append(
            {
                "title": title,
                "start_date": date_str,
                "start_time": start_time,
                "venue_key": venue_key,
                "ticket_slug": ticket_slug,
                "sold_out": sold_out,
            }
        )
    return shows


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl West End Comedy Fest shows."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Ensure venue records exist
    wild_heaven_venue_id = get_or_create_place(WILD_HEAVEN_VENUE_DATA)
    plywood_place_venue_id = get_or_create_place(PLYWOOD_PLACE_VENUE_DATA)

    venue_id_map = {
        "wild_heaven": wild_heaven_venue_id,
        "plywood": plywood_place_venue_id,
    }
    venue_label_map = {
        "wild_heaven": "Wild Heaven West End",
        "plywood": "Plywood Place",
    }

    logger.info("West End Comedy Fest: fetching schedule from %s", SCHEDULE_URL)

    # Try live scrape
    current_year = datetime.now().year
    html = _fetch_html(SCHEDULE_URL)
    shows: list[dict] = []

    if html:
        shows = _parse_schedule_html(html, current_year)

    if len(shows) < 5:
        logger.warning(
            "West End Comedy Fest: live scrape returned only %d shows — falling back to hardcoded 2026 schedule",
            len(shows),
        )
        shows = _get_hardcoded_2026_shows()

    logger.info("West End Comedy Fest: processing %d shows", len(shows))

    series_hint = {
        "series_type": "festival_program",
        "series_title": "West End Comedy Fest 2026",
        "frequency": "irregular",
    }

    for show in shows:
        title = show["title"]
        start_date = show["start_date"]
        start_time = show.get("start_time")
        venue_key = show.get("venue_key", "wild_heaven")
        ticket_slug = show.get("ticket_slug")
        sold_out = show.get("sold_out", False)

        if not title or not start_date:
            continue

        venue_id = venue_id_map.get(venue_key, wild_heaven_venue_id)
        venue_label = venue_label_map.get(venue_key, "Wild Heaven West End")

        ticket_url = _build_ticket_url(ticket_slug) if ticket_slug else None

        description = _build_description(
            title=title,
            venue_label=venue_label,
            start_date=start_date,
            start_time=start_time,
            ticket_url=ticket_url,
            sold_out=sold_out,
        )

        tags = ["comedy", "festival", "west-end-comedy-fest", "west-end", "atlanta"]
        if sold_out:
            tags.append("sold-out")

        price_note = "Sold Out" if sold_out else None

        content_hash = generate_content_hash(
            title,
            venue_label,
            f"{start_date}|{start_time}" if start_time else start_date,
        )

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
            "category": "comedy",
            "subcategory": "standup",
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": price_note,
            "is_free": False,
            "source_url": SCHEDULE_URL,
            "ticket_url": ticket_url,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.88,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        events_found += 1

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            logger.debug("Updated: %s on %s", title, start_date)
            continue

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(
                "Added: %s on %s at %s (%s)", title, start_date, start_time, venue_label
            )
        except Exception as exc:
            logger.error("Failed to insert %s on %s: %s", title, start_date, exc)

    logger.info(
        "West End Comedy Fest crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
