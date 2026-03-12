"""
Crawler for Atlanta Shoe Market.

Official source:
- The show-dates page publishes the current Atlanta date range, venue, and
  daily public show hours for the next footwear market.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime

import requests
from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_venue,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SOURCE_URL = "https://atlantashoemarket.com/show-dates/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

VENUE_DATA = {
    "name": "Cobb Convention Center (Cobb Galleria Centre)",
    "slug": "cobb-convention-center-cobb-galleria-centre",
    "address": "2 Galleria Parkway Southeast",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "venue_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://cobbgalleria.com/",
}


def _to_24h(hour: str, minute: str, period: str) -> str:
    value = int(hour)
    normalized = period.lower()
    if normalized == "pm" and value != 12:
        value += 12
    if normalized == "am" and value == 12:
        value = 0
    return f"{value:02d}:{minute}"


def parse_show_dates(text: str, today: date | None = None) -> list[dict]:
    """Parse the next current Atlanta Shoe Market sessions from the show-dates page."""
    today = today or datetime.now().date()

    range_match = re.search(
        r"([A-Za-z]+)\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})",
        text,
        re.IGNORECASE,
    )
    if not range_match:
        raise ValueError("Atlanta Shoe Market page did not expose the current show date range")

    month_name, start_day_str, end_day_str, year_str = range_match.groups()
    month = datetime.strptime(month_name[:3], "%b").month
    year = int(year_str)
    start_date = date(year, month, int(start_day_str))
    end_date = date(year, month, int(end_day_str))
    if end_date < today:
        raise ValueError("Atlanta Shoe Market page only exposes a past-dated show")

    day_matches = re.findall(
        r"(Saturday|Sunday|Monday),\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)",
        text,
        re.IGNORECASE,
    )
    if len(day_matches) < 3:
        raise ValueError("Atlanta Shoe Market page missing expected daily show-hour rows")

    sessions: list[dict] = []
    for weekday, month_token, day_str, session_year, start_hour, start_minute, start_period, end_hour, end_minute, end_period in day_matches:
        session_date = date(int(session_year), datetime.strptime(month_token[:3], "%b").month, int(day_str))
        if session_date < today:
            continue
        sessions.append(
            {
                "title": "Atlanta Shoe Market",
                "weekday": weekday.lower(),
                "start_date": session_date.isoformat(),
                "start_time": _to_24h(start_hour, start_minute, start_period),
                "end_time": _to_24h(end_hour, end_minute, end_period),
            }
        )

    if not sessions:
        raise ValueError("Atlanta Shoe Market page only exposed past-dated sessions")

    return sessions


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the official Atlanta Shoe Market show-dates page."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    response = requests.get(
        SOURCE_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    response.raise_for_status()

    page_text = BeautifulSoup(response.text, "html.parser").get_text(" ", strip=True)
    sessions = parse_show_dates(page_text)
    venue_id = get_or_create_venue(VENUE_DATA)
    description = (
        "Atlanta Shoe Market is a destination footwear trade market for retailers, buyers, "
        "brands, and fashion-industry professionals at Cobb Convention Center and the "
        "Renaissance Waverly complex."
    )

    for session in sessions:
        content_hash = generate_content_hash(session["title"], VENUE_DATA["name"], session["start_date"])
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": session["title"],
            "description": description,
            "start_date": session["start_date"],
            "start_time": session["start_time"],
            "end_date": None,
            "end_time": session["end_time"],
            "is_all_day": False,
            "category": "community",
            "subcategory": "expo",
            "tags": ["fashion", "footwear", "trade-show", "shopping", "expo"],
            "price_min": None,
            "price_max": None,
            "price_note": "Buyer and visitor registration details are handled through the official Atlanta Shoe Market site.",
            "is_free": False,
            "source_url": SOURCE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": (
                f"{session['title']} | {session['start_date']} | "
                f"{session['start_time']}-{session['end_time']}"
            ),
            "extraction_confidence": 0.96,
            "content_hash": content_hash,
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
        else:
            insert_event(event_record)
            events_new += 1

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale Atlanta Shoe Market events after refresh", stale_removed)

    logger.info(
        "Atlanta Shoe Market crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
