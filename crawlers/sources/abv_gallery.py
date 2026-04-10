"""
Crawler for ABV Gallery (abvgallery.com).

The homepage (not /exhibitions) shows current exhibitions with
"On View: Month DD - Month DD" date ranges beneath each title.
Static HTML — no Playwright needed.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.abvgallery.com"
HOME_URL = BASE_URL  # Current exhibitions live on the homepage

PLACE_DATA = {
    "name": "ABV Gallery",
    "slug": "abv-gallery",
    "address": "1206 Metropolitan Ave SE",
    "neighborhood": "East Atlanta Village",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7568,
    "lng": -84.3659,
    "place_type": "gallery",
    "spot_type": "gallery",
    "website": BASE_URL,
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# "March 21 - April 19" or "March 21 – April 19" (en-dash)
DATE_RANGE_RE = re.compile(
    r"On View:\s*"
    r"(?P<sm>January|February|March|April|May|June|July|August|September|October|November|December)\s+(?P<sd>\d{1,2})"
    r"\s*[-–]\s*"
    r"(?P<em>January|February|March|April|May|June|July|August|September|October|November|December)\s+(?P<ed>\d{1,2})"
    r"(?:,?\s*(?P<year>\d{4}))?",
    re.IGNORECASE,
)


def _parse_month(month_str: str) -> int:
    return datetime.strptime(month_str[:3], "%b").month


def _resolve_year(month: int, day: int) -> int:
    """Pick year so date is not more than ~3 months in the past."""
    today = datetime.now()
    year = today.year
    candidate = datetime(year, month, day)
    if candidate < today.replace(month=max(1, today.month - 3), day=1):
        year += 1
    return year


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl ABV Gallery current exhibitions from the homepage."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        resp = requests.get(HOME_URL, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except Exception as e:
        logger.error(f"ABV Gallery: failed to fetch {HOME_URL}: {e}")
        return 0, 0, 0

    soup = BeautifulSoup(resp.text, "html.parser")
    lines = [ln.strip() for ln in soup.get_text(separator="\n").split("\n") if ln.strip()]

    venue_id = get_or_create_place(PLACE_DATA)

    seen_titles: set[str] = set()

    for i, line in enumerate(lines):
        m = DATE_RANGE_RE.search(line)
        if not m:
            continue

        # Title is the line immediately before "On View:"
        title: Optional[str] = None
        if i > 0:
            candidate = lines[i - 1]
            # Skip section headers like "CURRENT EXHIBITIONS" or nav items
            if candidate and not candidate.isupper() and len(candidate) > 5:
                title = candidate

        if not title:
            logger.debug(f"ABV Gallery: found date range but no title near line {i}: {repr(line)}")
            continue

        # Dedupe within a single run (same title may appear twice from duplicate nav text)
        if title in seen_titles:
            continue
        seen_titles.add(title)

        start_month = _parse_month(m.group("sm"))
        start_day = int(m.group("sd"))
        end_month = _parse_month(m.group("em"))
        end_day = int(m.group("ed"))
        explicit_year = int(m.group("year")) if m.group("year") else None
        year = explicit_year if explicit_year else _resolve_year(start_month, start_day)

        try:
            start_dt = datetime(year, start_month, start_day)
            # End month may roll over into next year (e.g. Dec–Jan)
            end_year = year if end_month >= start_month else year + 1
            end_dt = datetime(end_year, end_month, end_day)
        except ValueError as e:
            logger.warning(f"ABV Gallery: bad date near '{title}': {e}")
            continue

        # Skip exhibitions that have already closed
        if end_dt.date() < datetime.now().date():
            logger.debug(f"ABV Gallery: skipping past exhibition '{title}' (ended {end_dt.date()})")
            continue

        start_date = start_dt.strftime("%Y-%m-%d")
        end_date = end_dt.strftime("%Y-%m-%d")

        events_found += 1
        content_hash = generate_content_hash(title, "ABV Gallery", start_date)

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": f"Exhibition at ABV Gallery, on view {m.group('sm')} {start_day} – {m.group('em')} {end_day}.",
            "start_date": start_date,
            "start_time": None,
            "end_date": end_date,
            "end_time": None,
            "is_all_day": True,
            "category": "art",
            "subcategory": "exhibition",
            "tags": ["gallery", "contemporary-art", "eav", "abv", "east-atlanta"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": HOME_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": line,
            "extraction_confidence": 0.90,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            logger.info(f"ABV Gallery: updated '{title}' ({start_date} – {end_date})")
        else:
            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"ABV Gallery: added '{title}' ({start_date} – {end_date})")
            except Exception as e:
                logger.error(f"ABV Gallery: failed to insert '{title}': {e}")

    logger.info(
        f"ABV Gallery crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
