"""
Crawler for Front Row Card Show Atlanta.

Official source:
- The Atlanta collection page publishes venue, public show-floor hours, trade
  night details, pricing, and the official ticket link.
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

SOURCE_URL = "https://frontrowcardshow.com/collections/atlanta"
TICKETS_URL = "https://www.showclix.com/event/front-row-card-show-atlanta-2026-mar-28-29"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

SHOW_VENUE = {
    "name": "Cobb Convention Center (Cobb Galleria Centre)",
    "slug": "cobb-convention-center-cobb-galleria-centre",
    "address": "2 Galleria Parkway",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "venue_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://cobbgalleria.com/",
}

TRADE_NIGHT_VENUE = {
    "name": "CardsHQ",
    "slug": "cardshq",
    "address": "3101 Cobb Pkwy SE, Suite 100",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "venue_type": "event_space",
    "spot_type": "event_space",
    "website": "https://cardshq.com/",
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
        r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*to\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)",
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


def parse_atlanta_page(html: str, today: date | None = None) -> list[dict]:
    """Extract the current Atlanta card show sessions from the official page."""
    today = today or datetime.now().date()
    page_text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)

    saturday_match = re.search(
        r"SATURDAY,\s*MARCH\s+(\d{1,2})\s+SHOW HOURS\s*-\s*(\d{1,2}:\d{2}\s*[AP]M\s*to\s*\d{1,2}:\d{2}\s*[AP]M)",
        page_text,
        re.IGNORECASE,
    )
    sunday_match = re.search(
        r"SUNDAY,\s*MARCH\s+(\d{1,2})\s+SHOW HOURS\s*-\s*(\d{1,2}:\d{2}\s*[AP]M\s*to\s*\d{1,2}:\d{2}\s*[AP]M)",
        page_text,
        re.IGNORECASE,
    )
    trade_match = re.search(
        r"TRADE NIGHT\s*-\s*(\d{1,2}:\d{2}\s*[AP]M\s*to\s*\d{1,2}:\d{2}\s*[AP]M)\s+at CardsHQ",
        page_text,
        re.IGNORECASE,
    )
    if not saturday_match or not sunday_match or not trade_match:
        raise ValueError("Front Row Card Show Atlanta page did not expose public schedule blocks")

    year = today.year
    saturday_date = date(year, 3, int(saturday_match.group(1)))
    sunday_date = date(year, 3, int(sunday_match.group(1)))
    if sunday_date < today:
        year += 1
        saturday_date = date(year, 3, int(saturday_match.group(1)))
        sunday_date = date(year, 3, int(sunday_match.group(1)))

    saturday_start, saturday_end = _parse_time_range(saturday_match.group(2))
    sunday_start, sunday_end = _parse_time_range(sunday_match.group(2))
    trade_start, trade_end = _parse_time_range(trade_match.group(1))
    if not all([saturday_start, saturday_end, sunday_start, sunday_end, trade_start, trade_end]):
        raise ValueError("Front Row Card Show Atlanta time parsing failed")

    return [
        {
            "title": "Front Row Card Show",
            "start_date": saturday_date.isoformat(),
            "start_time": saturday_start,
            "end_time": saturday_end,
            "venue": SHOW_VENUE,
            "price_min": 10.0,
            "price_max": 25.0,
            "price_note": "General admission $10 advance / $15 door. VIP early entry starts at 10:00 AM.",
            "is_free": False,
        },
        {
            "title": "Front Row Card Show Trade Night",
            "start_date": saturday_date.isoformat(),
            "start_time": trade_start,
            "end_time": trade_end,
            "venue": TRADE_NIGHT_VENUE,
            "price_min": 0.0,
            "price_max": 0.0,
            "price_note": "Official trade night at CardsHQ; entry is free.",
            "is_free": True,
        },
        {
            "title": "Front Row Card Show",
            "start_date": sunday_date.isoformat(),
            "start_time": sunday_start,
            "end_time": sunday_end,
            "venue": SHOW_VENUE,
            "price_min": 10.0,
            "price_max": 25.0,
            "price_note": "General admission $10 advance / $15 door. VIP early entry starts at 10:00 AM.",
            "is_free": False,
        },
    ]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Front Row Card Show Atlanta from the official Atlanta page."""
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

    sessions = parse_atlanta_page(response.text)
    description = (
        "Front Row Card Show brings sports cards, trading card games, comics, toys, "
        "autographs, memorabilia, grading services, and collector-focused vendors to Atlanta."
    )

    venue_ids: dict[str, int] = {}
    for session in sessions:
        venue = session["venue"]
        venue_slug = venue["slug"]
        if venue_slug not in venue_ids:
            venue_ids[venue_slug] = get_or_create_venue(venue)

        title = session["title"]
        content_hash = generate_content_hash(title, venue["name"], session["start_date"])
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "venue_id": venue_ids[venue_slug],
            "title": title,
            "description": description,
            "start_date": session["start_date"],
            "start_time": session["start_time"],
            "end_date": None,
            "end_time": session["end_time"],
            "is_all_day": False,
            "category": "community",
            "subcategory": "expo",
            "tags": [
                "collectibles",
                "trading-cards",
                "comics",
                "expo",
                "shopping",
            ],
            "price_min": session["price_min"],
            "price_max": session["price_max"],
            "price_note": session["price_note"],
            "is_free": session["is_free"],
            "source_url": SOURCE_URL,
            "ticket_url": TICKETS_URL,
            "image_url": None,
            "raw_text": f"{title} | {session['start_date']} | {session['start_time']}-{session['end_time']}",
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
        logger.info("Removed %s stale Front Row Card Show Atlanta events after refresh", stale_removed)

    logger.info(
        "Front Row Card Show Atlanta crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
