"""
Crawler for Stamp & Scrapbook Expo Duluth.

Official source:
- The Atlanta-area event page publishes the 2026 Duluth show dates, venue,
  daily show-floor hours, and special event ticket windows.
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

SOURCE_URL = "https://scrapbookexpo.com/2026-expo-show-list/at-26/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

VENUE_DATA = {
    "name": "Gas South Convention Center",
    "slug": "gas-south-convention-center",
    "address": "6400 Sugarloaf Parkway",
    "city": "Duluth",
    "state": "GA",
    "zip": "30097",
    "lat": 33.9748,
    "lng": -84.1427,
    "venue_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://www.gassouthdistrict.com/events/venue/convention-center",
}


def _to_24h(hour: str, minute: str, period: str) -> str:
    value = int(hour)
    normalized = period.lower()
    if normalized == "pm" and value != 12:
        value += 12
    if normalized == "am" and value == 12:
        value = 0
    return f"{value:02d}:{minute}"


def _parse_time_range(text: str) -> tuple[str | None, str | None]:
    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)",
        text,
        re.IGNORECASE,
    )
    if not match:
        return None, None
    start_hour, start_minute, start_period, end_hour, end_minute, end_period = match.groups()
    return (
        _to_24h(start_hour, start_minute or "00", start_period),
        _to_24h(end_hour, end_minute or "00", end_period),
    )


def parse_event_page(html: str, today: date | None = None) -> list[dict]:
    """Extract main show-floor sessions from the official Duluth event page."""
    today = today or datetime.now().date()
    page_text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)

    date_match = re.search(r"When:\s*July\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})", page_text, re.IGNORECASE)
    if not date_match:
        raise ValueError("Stamp & Scrapbook Expo page did not expose the Duluth 2026 date range")

    start_day = int(date_match.group(1))
    end_day = int(date_match.group(2))
    year = int(date_match.group(3))
    friday = date(year, 7, start_day)
    saturday = date(year, 7, end_day)
    if saturday < today:
        raise ValueError("Stamp & Scrapbook Expo page only exposes a past-dated cycle")

    friday_match = re.search(r"Friday:\s*(\d{1,2}(?::\d{2})?\s*am\s*-\s*\d{1,2}(?::\d{2})?\s*pm)", page_text, re.IGNORECASE)
    saturday_match = re.search(r"Saturday:\s*(\d{1,2}(?::\d{2})?\s*am\s*-\s*\d{1,2}(?::\d{2})?\s*pm)", page_text, re.IGNORECASE)
    if not friday_match or not saturday_match:
        raise ValueError("Stamp & Scrapbook Expo page missing main show-floor hours")

    friday_start, friday_end = _parse_time_range(friday_match.group(1))
    saturday_start, saturday_end = _parse_time_range(saturday_match.group(1))
    if not friday_start or not friday_end or not saturday_start or not saturday_end:
        raise ValueError("Stamp & Scrapbook Expo time parsing failed")

    return [
        {
            "title": "Stamp & Scrapbook Expo",
            "start_date": friday.isoformat(),
            "start_time": friday_start,
            "end_time": friday_end,
        },
        {
            "title": "Stamp & Scrapbook Expo",
            "start_date": saturday.isoformat(),
            "start_time": saturday_start,
            "end_time": saturday_end,
        },
    ]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the official Duluth Stamp & Scrapbook Expo page."""
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

    sessions = parse_event_page(response.text)
    venue_id = get_or_create_venue(VENUE_DATA)
    description = (
        "Stamp & Scrapbook Expo brings paper crafting, scrapbooking, stamping, workshops, "
        "shopping, and maker culture to the Gas South Convention Center in Duluth."
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
            "tags": ["crafts", "scrapbooking", "paper-crafts", "expo", "shopping"],
            "price_min": 12.0,
            "price_max": 12.0,
            "price_note": "Main show-floor admission is listed at $12 per day; workshops and special events are additional.",
            "is_free": False,
            "source_url": SOURCE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": f"{session['title']} | {session['start_date']} | {session['start_time']}-{session['end_time']}",
            "extraction_confidence": 0.95,
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
        logger.info("Removed %s stale Stamp & Scrapbook Expo events after refresh", stale_removed)

    logger.info(
        "Stamp & Scrapbook Expo crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
