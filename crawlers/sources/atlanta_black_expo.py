"""
Crawler for Atlanta Black Expo.

Official source:
- Homepage announces the next Atlanta Black Expo date window, venue, and the
  day-by-day session blocks for the upcoming event.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

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

SOURCE_URL = "https://atlblackexpo.com/"
TICKETS_URL = "https://atlblackexpo.com/tickets"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

PLACE_DATA = {
    "name": "Georgia World Congress Center",
    "slug": "georgia-world-congress-center",
    "address": "285 Andrew Young International Blvd NW",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "neighborhood": "Downtown",
    "venue_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://www.gwcca.org/",
}

WEEKDAY_BLOCKS = [
    ("Friday", ["Saturday", "Sunday", "Our Economic Impact Goal"]),
    ("Saturday", ["Sunday", "Our Economic Impact Goal"]),
    ("Sunday", ["Our Economic Impact Goal"]),
]


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def parse_time_range(text: str) -> tuple[Optional[str], Optional[str]]:
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


def _to_24h(hour: str, minute: str, period: str) -> str:
    value = int(hour)
    normalized = period.upper()
    if normalized == "PM" and value != 12:
        value += 12
    if normalized == "AM" and value == 12:
        value = 0
    return f"{value:02d}:{minute}"


def parse_next_event_range(page_text: str, today: date | None = None) -> dict:
    match = re.search(
        r"Next Event\s+([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2})\s+(\d{4})",
        page_text,
        re.IGNORECASE,
    )
    if not match:
        raise ValueError("Could not find Atlanta Black Expo next-event date range on official homepage")

    month_name, start_day_str, end_day_str, year_str = match.groups()
    month = datetime.strptime(month_name[:3], "%b").month
    year = int(year_str)
    start_date = date(year, month, int(start_day_str))
    end_date = date(year, month, int(end_day_str))

    return {
        "start_date": start_date,
        "end_date": end_date,
    }


def extract_weekday_section(page_text: str, weekday: str, end_markers: list[str]) -> str:
    start_match = re.search(rf"{weekday}\s+\d{{1,2}}\w*", page_text, re.IGNORECASE)
    if not start_match:
        return ""
    start = start_match.end()
    end = len(page_text)
    for marker in end_markers:
        marker_match = re.search(rf"{re.escape(marker)}", page_text[start:], re.IGNORECASE)
        if marker_match:
            end = min(end, start + marker_match.start())
    return clean_text(page_text[start:end])


def parse_session_blocks(page_text: str, start_date: date) -> list[dict]:
    sessions: list[dict] = []
    day_map = {
        "Friday": start_date,
        "Saturday": start_date + timedelta(days=1),
        "Sunday": start_date + timedelta(days=2),
    }

    session_pattern = re.compile(
        r"([A-Za-z][A-Za-z &'/-]+):\s*([^()]*?)\((\d{1,2}(?::\d{2})?[AP]M-\d{1,2}(?::\d{2})?[AP]M)\)",
        re.IGNORECASE,
    )

    for weekday, end_markers in WEEKDAY_BLOCKS:
        section = extract_weekday_section(page_text, weekday, end_markers)
        if not section:
            continue

        for match in session_pattern.finditer(section):
            label, description, time_text = match.groups()
            start_time, end_time = parse_time_range(time_text)
            session_date = day_map[weekday]
            title = f"Atlanta Black Expo: {clean_text(label)}"
            description_text = clean_text(description)
            if not description_text:
                description_text = "Official Atlanta Black Expo program block."

            sessions.append(
                {
                    "title": title,
                    "description": description_text,
                    "start_date": session_date.isoformat(),
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": end_time,
                    "is_all_day": False,
                }
            )

    if not sessions:
        raise ValueError("Atlanta Black Expo homepage did not yield any session blocks")

    return sessions


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Black Expo sessions from the official homepage."""
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
    soup = BeautifulSoup(response.text, "html.parser")
    page_text = soup.get_text("\n", strip=True)
    meta_description = clean_text((soup.select_one('meta[name="description"]') or {}).get("content", ""))
    image_url = clean_text((soup.select_one('meta[property="og:image"]') or {}).get("content", "")) or None

    event_window = parse_next_event_range(page_text)
    if event_window["end_date"] < datetime.now().date():
        raise ValueError("Atlanta Black Expo homepage only exposes a past-dated event window")
    sessions = parse_session_blocks(page_text, event_window["start_date"])
    venue_id = get_or_create_place(PLACE_DATA)

    for session in sessions:
        title = session["title"]
        content_hash = generate_content_hash(title, PLACE_DATA["name"], session["start_date"])
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                f"{session['description']} Atlanta Black Expo is a three-day celebration of Black businesses, "
                "speakers, exhibitors, culture, and community at Georgia World Congress Center."
            ),
            "start_date": session["start_date"],
            "start_time": session["start_time"],
            "end_date": session["end_date"],
            "end_time": session["end_time"],
            "is_all_day": session["is_all_day"],
            "category": "community",
            "subcategory": "expo",
            "tags": [
                "expo",
                "black-business",
                "marketplace",
                "speakers",
                "community",
                "shopping",
                "culture",
            ],
            "price_min": 15.0,
            "price_max": 35.0,
            "price_note": "Official ticket options currently start at $15 for entry and $35 for VIP access.",
            "is_free": False,
            "source_url": SOURCE_URL,
            "ticket_url": TICKETS_URL,
            "image_url": image_url,
            "raw_text": f"{title} | {session['start_date']} | {session['start_time']}-{session['end_time']} | {meta_description[:300]}",
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
        logger.info("Removed %s stale Atlanta Black Expo events after refresh", stale_removed)

    logger.info(
        "Atlanta Black Expo crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
