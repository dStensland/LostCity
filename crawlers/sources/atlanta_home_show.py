"""
Crawler for Atlanta Home Show.

Official source:
- The attendee show-info page publishes the current March 20-22, 2026 date
  range, daily public hours, venue, and the official ticket path.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SOURCE_URL = "https://www.atlantahomeshow.com/attendee-info/show-info"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

PLACE_DATA = {
    "name": "Cobb Convention Center (Cobb Galleria Centre)",
    "slug": "cobb-convention-center-cobb-galleria-centre",
    "address": "2 Galleria Pkwy SE",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "lat": 33.8842,
    "lng": -84.4716,
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


def _parse_time_range(text: str) -> tuple[str | None, str | None]:
    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)",
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


def parse_show_info_page(html: str, today: date | None = None) -> dict:
    """Extract Atlanta Home Show daily sessions from the official show-info page."""
    today = today or datetime.now().date()
    soup = BeautifulSoup(html, "html.parser")
    page_text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))

    date_match = re.search(r"March\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})", page_text, re.IGNORECASE)
    if not date_match:
        raise ValueError("Atlanta Home Show page did not expose the official 2026 date range")
    start_day = int(date_match.group(1))
    end_day = int(date_match.group(2))
    year = int(date_match.group(3))
    start_date = date(year, 3, start_day)
    end_date = date(year, 3, end_day)
    if end_date < today:
        raise ValueError("Atlanta Home Show page only exposes a past-dated cycle")

    hours_matches = re.findall(
        r"(Friday|Saturday|Sunday)\s+March\s+\d{1,2},\s+\d{4}\s+(\d{1,2}:\d{2}AM\s*-\s*\d{1,2}:\d{2}PM)",
        page_text,
        re.IGNORECASE,
    )
    if len(hours_matches) < 3:
        raise ValueError("Atlanta Home Show page did not expose the expected daily public hours")

    if "Cobb Convention Center Atlanta" not in page_text or "Two Galleria Parkway Atlanta, GA 30339" not in page_text:
        raise ValueError("Atlanta Home Show page missing the official Cobb venue block")

    ticket_url = None
    for anchor in soup.find_all("a", href=True):
        text = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True))
        if "buy tickets" in text.lower():
            ticket_url = urljoin(SOURCE_URL, anchor["href"])
            if "mpetickets.com" in ticket_url:
                break

    sessions: list[dict] = []
    for offset, (weekday, time_range) in enumerate(hours_matches[:3]):
        start_time, end_time = _parse_time_range(time_range)
        if not start_time or not end_time:
            raise ValueError(f"Atlanta Home Show time parsing failed for {weekday}")
        sessions.append(
            {
                "title": "Atlanta Home Show",
                "weekday": weekday.lower(),
                "start_date": (start_date + timedelta(days=offset)).isoformat(),
                "start_time": start_time,
                "end_time": end_time,
            }
        )

    return {
        "title": "Atlanta Home Show",
        "source_url": SOURCE_URL,
        "ticket_url": ticket_url,
        "sessions": sessions,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Home Show from the official show-info page."""
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

    show = parse_show_info_page(response.text)
    venue_id = get_or_create_place(PLACE_DATA)
    description = (
        "Atlanta Home Show is a large consumer home-improvement market focused on remodeling, "
        "design inspiration, contractors, products, and in-person project discovery at Cobb Galleria."
    )

    for session in show["sessions"]:
        content_hash = generate_content_hash(session["title"], PLACE_DATA["name"], session["start_date"])
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
            "tags": ["home", "home-improvement", "remodeling", "shopping", "show"],
            "price_min": None,
            "price_max": None,
            "price_note": "Buy tickets online for discount pricing on the official ticket page.",
            "is_free": False,
            "source_url": show["source_url"],
            "ticket_url": show["ticket_url"],
            "image_url": None,
            "raw_text": (
                f"{session['title']} | {session['start_date']} | "
                f"{session['start_time']}-{session['end_time']} | Cobb Galleria"
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
        logger.info("Removed %s stale Atlanta Home Show events after refresh", stale_removed)

    logger.info(
        "Atlanta Home Show crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated

