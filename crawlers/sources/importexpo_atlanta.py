"""
Crawler for IMPORTEXPO Atlanta.

Official source:
- The Atlanta page publishes the exact venue, date, hours, and admission
  details for the current Atlanta stop.
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

SOURCE_URL = "https://www.importexpo.net/atlanta"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

VENUE_DATA = {
    "name": "Cobb Convention Center (Cobb Galleria Centre)",
    "slug": "cobb-convention-center-cobb-galleria-centre",
    "address": "2 Galleria Pkwy SE",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "venue_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://cobbgalleria.com/",
}


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


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
        r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)",
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


def parse_atlanta_page(html: str, today: date | None = None) -> dict:
    """Extract the current Atlanta IMPORTEXPO event from the official page."""
    today = today or datetime.now().date()
    page_text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)

    venue_match = re.search(
        r"COBB CONVENTION CENTER\s+COBB CONVENTION CENTER\s+2 GALLERIA PKWY SE\s+ATLANTA,\s*GA\s*(\d{5})",
        page_text,
        re.IGNORECASE,
    )
    date_match = re.search(
        r"SATURDAY\s+([A-Z]+)\s+(\d{1,2}),\s*(\d{4})",
        page_text,
        re.IGNORECASE,
    )
    time_match = re.search(r"(\d{1,2}(?::\d{2})?\s*[AP]M\s*[-–]\s*\d{1,2}(?::\d{2})?\s*[AP]M)", page_text)
    presale_match = re.search(r"GENERAL ADMISSION\s+\$([0-9]+(?:\.[0-9]{2})?)\s*\+\s*SERVICE FEES\s*\(PRE-SALE\)", page_text, re.IGNORECASE)
    door_match = re.search(r"\$([0-9]+(?:\.[0-9]{2})?)\s*\+\s*SERVICE FEES\s*\(DAY OF SHOW\)", page_text, re.IGNORECASE)

    if not venue_match or not date_match or not time_match:
        raise ValueError("IMPORTEXPO Atlanta page did not expose the expected event details")

    month = datetime.strptime(date_match.group(1)[:3], "%b").month
    event_date = date(int(date_match.group(3)), month, int(date_match.group(2)))
    if event_date < today:
        raise ValueError("IMPORTEXPO Atlanta official page only exposes a past-dated event")

    start_time, end_time = _parse_time_range(time_match.group(1))
    if not start_time or not end_time:
        raise ValueError("IMPORTEXPO Atlanta time parsing failed")

    return {
        "title": "ImportExpo Car Show",
        "start_date": event_date.isoformat(),
        "start_time": start_time,
        "end_time": end_time,
        "postal_code": venue_match.group(1),
        "price_min": float(presale_match.group(1)) if presale_match else 25.0,
        "price_max": float(door_match.group(1)) if door_match else 35.0,
        "price_note": "General admission $25 presale / $35 day-of-show. Kids under 12 free with accompanied adult.",
        "description": (
            "IMPORTEXPO Atlanta is an indoor automotive and car-culture show featuring modified vehicles, "
            "music, vendors, and enthusiast showcase entries at Cobb Convention Center."
        ),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the official IMPORTEXPO Atlanta page."""
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

    event = parse_atlanta_page(response.text)
    venue_id = get_or_create_venue(VENUE_DATA)
    content_hash = generate_content_hash(event["title"], VENUE_DATA["name"], event["start_date"])
    current_hashes.add(content_hash)
    events_found = 1

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": event["title"],
        "description": event["description"],
        "start_date": event["start_date"],
        "start_time": event["start_time"],
        "end_date": None,
        "end_time": event["end_time"],
        "is_all_day": False,
        "category": "community",
        "subcategory": "expo",
        "tags": [
            "cars",
            "car-show",
            "expo",
            "modified-cars",
            "shopping",
        ],
        "price_min": event["price_min"],
        "price_max": event["price_max"],
        "price_note": event["price_note"],
        "is_free": False,
        "source_url": SOURCE_URL,
        "ticket_url": None,
        "image_url": None,
        "raw_text": f"{event['title']} | {event['start_date']} | {event['start_time']}-{event['end_time']} | Cobb Convention Center",
        "extraction_confidence": 0.95,
        "content_hash": content_hash,
    }

    existing = find_existing_event_for_insert(event_record)
    if existing:
        smart_update_existing_event(existing, event_record)
        events_updated = 1
    else:
        insert_event(event_record)
        events_new = 1

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale IMPORTEXPO Atlanta events after refresh", stale_removed)

    logger.info(
        "IMPORTEXPO Atlanta crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
