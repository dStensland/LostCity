"""
Crawler for International Woodworking Fair.

Official sources:
- The homepage and Attend page publish the 2026 date range, venue, and
  registration link.
- The official show schedule page publishes daily show-floor hours.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime

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

HOME_URL = "https://iwfatlanta.com/"
ATTEND_URL = "https://iwfatlanta.com/attend-iwf/"
SCHEDULE_URL = "https://iwfatlanta.com/about-iwf/show-schedule/"
REGISTRATION_URL = "https://registration.experientevent.com/ShowIWF261/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

PLACE_DATA = {
    "name": "Georgia World Congress Center",
    "slug": "georgia-world-congress-center",
    "address": "285 Andrew Young International Blvd NW",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7607,
    "lng": -84.3976,
    "place_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://www.gwcca.org/",
}

_MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


def _to_24h(hour: str, minute: str, period: str) -> str:
    value = int(hour)
    normalized = period.lower()
    if normalized == "pm" and value != 12:
        value += 12
    if normalized == "am" and value == 12:
        value = 0
    return f"{value:02d}:{minute}"


def _parse_time_range(value: str) -> tuple[str | None, str | None]:
    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?\s*am\*?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*pm",
        value,
        re.IGNORECASE,
    )
    if not match:
        return None, None
    start_hour, start_minute, end_hour, end_minute = match.groups()
    return (
        _to_24h(start_hour, start_minute or "00", "am"),
        _to_24h(end_hour, end_minute or "00", "pm"),
    )


def parse_source_pages(
    homepage_html: str,
    attend_html: str,
    schedule_html: str,
    today: date | None = None,
) -> dict:
    """Extract IWF 2026 dates, venue, registration, and daily sessions."""
    today = today or datetime.now().date()
    homepage_soup = BeautifulSoup(homepage_html, "html.parser")
    attend_text = re.sub(r"\s+", " ", BeautifulSoup(attend_html, "html.parser").get_text(" ", strip=True))
    schedule_text = re.sub(r"\s+", " ", BeautifulSoup(schedule_html, "html.parser").get_text(" ", strip=True))

    combined_text = " ".join([homepage_soup.get_text(" ", strip=True), attend_text, schedule_text])
    date_match = re.search(
        r"August\s+(\d{1,2})[–-](\d{1,2}),\s*(\d{4})",
        combined_text,
        re.IGNORECASE,
    )
    if not date_match:
        raise ValueError("IWF pages did not expose the 2026 date range")

    start_day = int(date_match.group(1))
    end_day = int(date_match.group(2))
    year = int(date_match.group(3))
    date(year, 8, start_day)
    end_date = date(year, 8, end_day)
    if end_date < today:
        raise ValueError("IWF pages only expose a past-dated cycle")

    if "Georgia World Congress Center" not in combined_text or "285 Andrew Young International" not in combined_text:
        raise ValueError("IWF pages did not expose the official Georgia World Congress Center venue")

    ticket_url = REGISTRATION_URL
    for anchor in BeautifulSoup(attend_html, "html.parser").find_all("a", href=True):
        text = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True)).lower()
        href = anchor["href"]
        if "register" in text and "experientevent" in href:
            ticket_url = href
            break

    image_url = None
    og_image = homepage_soup.find("meta", attrs={"property": "og:image"})
    if og_image and og_image.get("content"):
        image_url = str(og_image["content"]).strip()

    session_matches = re.findall(
        r"(Tuesday|Wednesday|Thursday|Friday),\s+August\s+(\d{1,2})\s+(\d{1,2}(?::\d{2})?\s*am\*?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*pm)",
        schedule_text,
        re.IGNORECASE,
    )
    if len(session_matches) < 4:
        raise ValueError("IWF show schedule page did not expose the four daily show-floor sessions")

    sessions = []
    for weekday, day_text, time_text in session_matches[:4]:
        month = 8
        day_value = int(day_text)
        session_date = date(year, month, day_value)
        start_time, end_time = _parse_time_range(time_text)
        if not start_time or not end_time:
            raise ValueError(f"IWF time parsing failed for {weekday}")
        sessions.append(
            {
                "title": "International Woodworking Fair",
                "weekday": weekday.lower(),
                "start_date": session_date.isoformat(),
                "start_time": start_time,
                "end_time": end_time,
            }
        )

    description = (
        "International Woodworking Fair is a destination trade show for woodworking machinery, "
        "materials, design, fabrication, and shop-floor innovation at Georgia World Congress Center."
    )

    return {
        "title": "International Woodworking Fair",
        "source_url": SCHEDULE_URL,
        "ticket_url": ticket_url,
        "image_url": image_url,
        "description": description,
        "sessions": sessions,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl International Woodworking Fair from official IWF pages."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    homepage_response = requests.get(
        HOME_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    homepage_response.raise_for_status()

    attend_response = requests.get(
        ATTEND_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    attend_response.raise_for_status()

    schedule_response = requests.get(
        SCHEDULE_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    schedule_response.raise_for_status()

    event = parse_source_pages(
        homepage_response.text,
        attend_response.text,
        schedule_response.text,
    )
    venue_id = get_or_create_place(PLACE_DATA)

    for session in event["sessions"]:
        content_hash = generate_content_hash(session["title"], PLACE_DATA["name"], session["start_date"])
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": session["title"],
            "description": event["description"],
            "start_date": session["start_date"],
            "start_time": session["start_time"],
            "end_date": None,
            "end_time": session["end_time"],
            "is_all_day": False,
            "category": "community",
            "subcategory": "expo",
            "tags": ["woodworking", "design", "trade-show", "manufacturing", "expo"],
            "price_min": 25.0,
            "price_max": 50.0,
            "price_note": "Early registration is listed at $25 through July 31, 2026; show-floor admission rises to $50 starting August 1, 2026.",
            "is_free": False,
            "source_url": event["source_url"],
            "ticket_url": event["ticket_url"],
            "image_url": event["image_url"],
            "raw_text": (
                f"{session['title']} | {session['start_date']} | "
                f"{session['start_time']}-{session['end_time']} | {PLACE_DATA['name']}"
            ),
            "extraction_confidence": 0.97,
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
        logger.info("Removed %s stale International Woodworking Fair events after refresh", stale_removed)

    logger.info(
        "International Woodworking Fair crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
