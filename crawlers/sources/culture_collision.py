"""
Crawler for Culture Collision Atlanta.

Official source:
- Homepage publishes the current Atlanta date range, venue, and daily public
  show hours.
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

SOURCE_URL = "https://www.culturecollisiontradeshow.com/"
TICKETS_URL = "https://www.eventbrite.com/e/culture-collision-trade-show-5-sports-cards-sneakers-3-v-3-game-more-tickets-828783382407?aff=ebdssbdestsearch"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

PLACE_DATA = {
    "name": "Georgia International Convention Center",
    "slug": "georgia-international-convention-center",
    "address": "2000 Convention Center Concourse",
    "city": "College Park",
    "state": "GA",
    "zip": "30337",
    "lat": 33.6410,
    "lng": -84.4361,
    "place_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://www.gicc.com/",
}


def _to_24h(hour: str, minute: str, period: str) -> str:
    value = int(hour)
    normalized = period.lower()
    if normalized == "pm" and value != 12:
        value += 12
    if normalized == "am" and value == 12:
        value = 0
    return f"{value:02d}:{minute}"


def _parse_time_token(text: str) -> str | None:
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)", text, re.IGNORECASE)
    if not match:
        return None
    hour, minute, period = match.groups()
    return _to_24h(hour, minute or "00", period)


def _normalize_public_start_time(start_text: str, end_time: str) -> str | None:
    """
    Normalize obviously bad public-start tokens from the source page.

    The current Sunday block on the official homepage renders "10 PM General
    Admission" while also listing a 4 PM close, which is clearly a typo.
    """
    normalized = _parse_time_token(start_text)
    if not normalized:
        return None

    if normalized > end_time and re.search(r"\b([7-9]|10|11)\s*PM\b", start_text, re.IGNORECASE):
        match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*PM", start_text, re.IGNORECASE)
        if match:
            hour = int(match.group(1))
            minute = match.group(2) or "00"
            if 7 <= hour <= 11:
                return f"{hour:02d}:{minute}"

    return normalized


def parse_homepage(html: str, today: date | None = None) -> list[dict]:
    """Extract Culture Collision daily sessions from the official homepage."""
    today = today or datetime.now().date()
    page_text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)

    range_match = re.search(
        r"June\s+(\d{1,2})(?:th|st|nd|rd)?-(\d{1,2})(?:th|st|nd|rd)?,\s*(\d{4})",
        page_text,
        re.IGNORECASE,
    )
    if not range_match:
        raise ValueError("Culture Collision homepage did not expose the 2026 Atlanta date range")

    start_day = int(range_match.group(1))
    int(range_match.group(2))
    year = int(range_match.group(3))
    start_date = date(year, 6, start_day)
    if start_date < today:
        raise ValueError("Culture Collision homepage only exposes a past-dated event")

    day_patterns = [
        ("Friday", r"Friday,\s*June\s+\d+(?:th|st|nd|rd)?\s*(\d+\s*PM)\s*VIP\s*Early Entry\s*(\d+\s*PM)\s*General Admission\s*(\d+\s*PM)\s*Show Ends"),
        ("Saturday", r"Saturday,\s*June\s+\d+(?:th|st|nd|rd)?\s*(\d+\s*AM)\s*VIP\s*Early Entry\s*(\d+\s*AM)\s*General Admission\s*(\d+\s*PM)\s*Show Ends"),
        ("Sunday", r"Sunday,\s*June\s+\d+(?:th|st|nd|rd)?\s*(\d+\s*AM)\s*VIP\s*Early Entry\s*(\d+\s*(?:AM|PM))\s*General Admission\s*(\d+\s*PM)\s*Show Ends"),
    ]

    sessions: list[dict] = []
    for offset, (label, pattern) in enumerate(day_patterns):
        match = re.search(pattern, page_text, re.IGNORECASE)
        if not match:
            raise ValueError(f"Culture Collision homepage missing schedule block for {label}")
        _vip, public_start_raw, end_raw = match.groups()
        end_time = _parse_time_token(end_raw)
        public_start = _normalize_public_start_time(public_start_raw, end_time) if end_time else None
        if not public_start or not end_time:
            raise ValueError(f"Culture Collision time parsing failed for {label}")
        sessions.append(
            {
                "title": "Culture Collision",
                "start_date": (start_date + timedelta(days=offset)).isoformat(),
                "start_time": public_start,
                "end_time": end_time,
            }
        )

    return sessions


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Culture Collision Atlanta from the official homepage."""
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

    sessions = parse_homepage(response.text)
    venue_id = get_or_create_place(PLACE_DATA)
    description = (
        "Culture Collision is a destination collectibles convention centered on sports cards, "
        "TCG, sneakers, merch, and pop-culture fandom at GICC in College Park."
    )

    for session in sessions:
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
            "subcategory": "convention",
            "tags": ["collectibles", "trading-cards", "sneakers", "pop-culture", "shopping"],
            "price_min": None,
            "price_max": None,
            "price_note": "See the official ticket page for current GA, VIP, and vendor pricing.",
            "is_free": False,
            "source_url": SOURCE_URL,
            "ticket_url": TICKETS_URL,
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
        logger.info("Removed %s stale Culture Collision events after refresh", stale_removed)

    logger.info(
        "Culture Collision crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
