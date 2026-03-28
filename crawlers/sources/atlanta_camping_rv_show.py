"""
Crawler for Atlanta Camping & RV Show.

Official source:
- The official show-details page publishes the next Atlanta show window, venue,
  daily public hours, and current admission guidance.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta

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

SOURCE_URL = "https://atlantarvshow.com/our-show/"
TICKETS_URL = "https://atlantarvshow.com/tickets-soon/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

PLACE_DATA = {
    "name": "Atlanta Exposition Center South",
    "slug": "atlanta-exposition-center-south",
    "address": "3850 Jonesboro Rd",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30354",
    "lat": 33.6466,
    "lng": -84.4187,
    "place_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://www.atlantaexpositioncenters.com/",
}


def _to_24h(hour: str, minute: str, period: str) -> str:
    value = int(hour)
    normalized = period.lower()
    if normalized == "a":
        normalized = "am"
    if normalized == "p":
        normalized = "pm"
    if normalized == "pm" and value != 12:
        value += 12
    if normalized == "am" and value == 12:
        value = 0
    return f"{value:02d}:{minute}"


def parse_show_details(text: str, today: date | None = None) -> dict:
    """Parse the current Atlanta Camping & RV Show details page."""
    today = today or datetime.now().date()

    range_match = re.search(
        r"([A-Za-z]+)\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})",
        text,
        re.IGNORECASE,
    )
    if not range_match:
        raise ValueError("Atlanta Camping & RV Show page did not expose the next show range")

    month_name, start_day_str, end_day_str, year_str = range_match.groups()
    month = datetime.strptime(month_name[:3], "%b").month
    year = int(year_str)
    start_date = date(year, month, int(start_day_str))
    end_date = date(year, month, int(end_day_str))
    if end_date < today:
        raise ValueError("Atlanta Camping & RV Show page only exposes a past-dated cycle")

    hours_matches = re.findall(
        r"(Thursday|Friday|Saturday|Sunday)(?:\s+[A-Za-z]+\s+\d{1,2}|:)\s+"
        r"(\d{1,2})(?::(\d{2}))?\s*(A(?:M)?|P(?:M)?)\s*-\s*"
        r"(\d{1,2})(?::(\d{2}))?\s*(A(?:M)?|P(?:M)?)",
        text,
        re.IGNORECASE,
    )
    if len(hours_matches) < 4:
        raise ValueError("Atlanta Camping & RV Show page missing expected daily hours")

    price_note_match = re.search(
        r"Thursday or Friday\s+Adult\s+\$([0-9.]+).*?Saturday or Sunday\s+Adult\s+\$([0-9.]+).*?Kids 16 and under Free",
        text,
        re.IGNORECASE,
    )
    weekday_price = float(price_note_match.group(1)) if price_note_match else 10.0
    weekend_price = float(price_note_match.group(2)) if price_note_match else 12.0

    sessions: list[dict] = []
    for offset, match in enumerate(hours_matches[:4]):
        weekday, start_hour, start_minute, start_period, end_hour, end_minute, end_period = match
        session_date = start_date + timedelta(days=offset)
        price = weekend_price if weekday.lower() in {"saturday", "sunday"} else weekday_price
        sessions.append(
            {
                "title": "Atlanta Camping & RV Show",
                "weekday": weekday.lower(),
                "start_date": session_date.isoformat(),
                "start_time": _to_24h(start_hour, start_minute or "00", start_period),
                "end_time": _to_24h(end_hour, end_minute or "00", end_period),
                "price": price,
            }
        )

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "sessions": sessions,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the official Atlanta Camping & RV Show details page."""
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
    show = parse_show_details(page_text)
    venue_id = get_or_create_place(PLACE_DATA)
    description = (
        "Atlanta Camping & RV Show is a large indoor consumer show for RVs, camping gear, "
        "outdoor travel planning, dealers, and recreation exhibitors at Atlanta Exposition Center South."
    )

    for session in show["sessions"]:
        content_hash = generate_content_hash(session["title"], PLACE_DATA["name"], session["start_date"])
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": session["title"],
            "description": description,
            "start_date": session["start_date"],
            "start_time": session["start_time"],
            "end_date": None,
            "end_time": session["end_time"],
            "is_all_day": False,
            "category": "community",
            "subcategory": "expo",
            "tags": ["rv", "camping", "outdoors", "travel", "shopping", "expo"],
            "price_min": session["price"],
            "price_max": session["price"],
            "price_note": "Kids 16 and under are free. See the official ticket page for updated online and at-the-door pricing.",
            "is_free": False,
            "source_url": SOURCE_URL,
            "ticket_url": TICKETS_URL,
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
        logger.info(
            "Removed %s stale Atlanta Camping & RV Show events after refresh",
            stale_removed,
        )

    logger.info(
        "Atlanta Camping & RV Show crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
