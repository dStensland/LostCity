"""
Crawler for Scott Antique Markets.

Official source:
- Homepage announces the next Atlanta show weekend.
- Locations page provides the Atlanta venue, hours, and admission details.

This source is intentionally deterministic because the generic LLM profile path
produced junk shells and out-of-scope Ohio rows.
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

BASE_URL = "https://www.scottantiquemarket.com"
LOCATIONS_URL = f"{BASE_URL}/locations"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}

ATLANTA_VENUE = {
    "name": "Atlanta Expo Center",
    "slug": "atlanta-expo-center",
    "address": "3650 Jonesboro Rd SE",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30354",
    "place_type": "convention_center",
    "spot_type": "convention_center",
    "website": BASE_URL,
}

HOURS_BY_WEEKDAY = {
    "thursday": ("10:00", "17:00"),
    "friday": ("09:00", "18:00"),
    "saturday": ("09:00", "18:00"),
    "sunday": ("10:00", "16:00"),
}


def _clean_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    return soup.get_text("\n", strip=True)


def parse_next_atlanta_show_range(page_text: str, today: date | None = None) -> tuple[date, date]:
    """Return the next official Atlanta show weekend from homepage text."""
    today = today or datetime.now().date()
    match = re.search(
        r"Atlanta Show\s*:\s*([A-Za-z]{3,9})\s+(\d{1,2})\s*-\s*(\d{1,2})(?:st|nd|rd|th)?",
        page_text,
        re.IGNORECASE,
    )
    if not match:
        raise ValueError("Could not find the next Atlanta Scott Antique Markets date range")

    month_label, start_day_str, end_day_str = match.groups()
    month = MONTHS[month_label.strip().lower()]
    start_day = int(start_day_str)
    end_day = int(end_day_str)

    year = today.year
    start_date = date(year, month, start_day)
    end_date = date(year, month, end_day)

    if end_date < today:
        year += 1
        start_date = date(year, month, start_day)
        end_date = date(year, month, end_day)

    return start_date, end_date


def parse_atlanta_location_details(page_text: str) -> tuple[str, dict[str, tuple[str, str]], float, str]:
    """Parse the Atlanta venue block from the official locations page."""
    match = re.search(
        r"Atlanta Expo Centers\s+"
        r"3650\s*&\s*3850\s+Jonesboro\s+Rd\.\s*SE,\s*Atlanta,\s*Georgia\s+30354\s+"
        r"Thursday:\s*([0-9apm\-]+)\s+"
        r"Friday\s*&\s*Saturday:\s*([0-9apm\-]+)\s+"
        r"Sunday:\s*([0-9apm\-]+)\s+"
        r"Admission:\s*\$?(\d+(?:\.\d{2})?)\s+per person\s*\(([^)]+)\)",
        page_text,
        re.IGNORECASE,
    )
    if not match:
        raise ValueError("Could not parse Atlanta location details for Scott Antique Markets")

    thursday_hours, friday_saturday_hours, sunday_hours, admission_str, admission_note = match.groups()
    hours = {
        "thursday": _parse_hours_range(thursday_hours),
        "friday": _parse_hours_range(friday_saturday_hours),
        "saturday": _parse_hours_range(friday_saturday_hours),
        "sunday": _parse_hours_range(sunday_hours),
    }
    return (
        "Atlanta Expo Centers",
        hours,
        float(admission_str),
        admission_note.strip(),
    )


def _parse_hours_range(text: str) -> tuple[str, str]:
    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)",
        text,
        re.IGNORECASE,
    )
    if not match:
        raise ValueError(f"Could not parse Scott Antique Markets hours: {text}")

    start_hour, start_minute, start_period, end_hour, end_minute, end_period = match.groups()
    return (
        _to_24h(start_hour, start_minute or "00", start_period),
        _to_24h(end_hour, end_minute or "00", end_period),
    )


def _to_24h(hour: str, minute: str, period: str) -> str:
    value = int(hour)
    if period.lower() == "pm" and value != 12:
        value += 12
    if period.lower() == "am" and value == 12:
        value = 0
    return f"{value:02d}:{minute}"


def build_market_sessions(start_date: date, end_date: date, hours: dict[str, tuple[str, str]]) -> list[dict]:
    sessions = []
    current = start_date
    while current <= end_date:
        weekday = current.strftime("%A").lower()
        start_time, end_time = hours.get(weekday, HOURS_BY_WEEKDAY.get(weekday, ("10:00", "16:00")))
        sessions.append(
            {
                "start_date": current.strftime("%Y-%m-%d"),
                "start_time": start_time,
                "end_time": end_time,
            }
        )
        current += timedelta(days=1)
    return sessions


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the next official Atlanta Scott Antique Markets weekend."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    homepage = requests.get(
        BASE_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    homepage.raise_for_status()

    locations_page = requests.get(
        LOCATIONS_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    locations_page.raise_for_status()

    homepage_text = _clean_text(homepage.text)
    locations_text = _clean_text(locations_page.text)

    start_date, end_date = parse_next_atlanta_show_range(homepage_text)
    venue_label, hours, admission_price, admission_gate_note = parse_atlanta_location_details(locations_text)
    sessions = build_market_sessions(start_date, end_date, hours)
    if not sessions:
        raise ValueError("Scott Antique Markets did not yield any Atlanta daily sessions")

    venue_id = get_or_create_place(ATLANTA_VENUE)
    description = (
        "Scott Antique Markets is one of the Southeast's biggest recurring antique and vintage "
        "markets, filling Atlanta Expo Center with dealers, interiors, furniture, art, jewelry, "
        "collectibles, and design finds. Official Atlanta admission is $5 cash-only at the gate "
        "and parking is free."
    )

    for session in sessions:
        title = "Scott Antique Markets"
        content_hash = generate_content_hash(title, ATLANTA_VENUE["name"], session["start_date"])
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": description,
            "start_date": session["start_date"],
            "start_time": session["start_time"],
            "end_date": None,
            "end_time": session["end_time"],
            "is_all_day": False,
            "category": "community",
            "subcategory": "market",
            "tags": [
                "market",
                "antiques",
                "vintage",
                "collectibles",
                "shopping",
                "design",
            ],
            "price_min": admission_price,
            "price_max": admission_price,
            "price_note": f"${int(admission_price)} admission, {admission_gate_note.title()}; free parking",
            "is_free": False,
            "source_url": BASE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": f"{venue_label} | {session['start_date']} | {session['start_time']}-{session['end_time']}",
            "extraction_confidence": 0.95,
            "content_hash": content_hash,
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        insert_event(event_record)
        events_new += 1

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale Scott Antique Markets events after refresh", stale_removed)

    logger.info(
        "Scott Antique Markets crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
