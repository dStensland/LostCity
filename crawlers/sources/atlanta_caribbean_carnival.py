"""
Crawler for Atlanta Caribbean Carnival (atlantacarnival.org).

This source currently needs one reliable annual container row for horizon coverage.
Use the official site as primary and fall back to known official 2026 timing.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

import requests

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantacarnival.org"
CANDIDATE_URLS = (
    f"{BASE_URL}/event-list",
    f"{BASE_URL}/carnival",
    BASE_URL,
)
DEFAULT_IMAGE_URL = (
    "https://static.wixstatic.com/media/"
    "f9ea57_3b2030c8b42949c78a30204aac051d1d~mv2.png"
)
KNOWN_DATES = {
    2026: ("2026-05-23", "2026-05-23"),
}

PLACE_DATA = {
    "name": "Atlanta Caribbean Carnival",
    "slug": "atlanta-caribbean-carnival",
    "address": "Various Locations",
    "neighborhood": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "place_type": "festival",
    "spot_type": "festival",
    "website": BASE_URL,
}


def _extract_image_url(html: str) -> str:
    og_match = re.search(
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if og_match:
        return og_match.group(1)

    wix_match = re.search(
        r'https://static\.wixstatic\.com/media/[^"\')\s]+',
        html,
        re.IGNORECASE,
    )
    if wix_match:
        return wix_match.group(0)

    return DEFAULT_IMAGE_URL


def _memorial_day_weekend_window(year: int) -> tuple[str, str]:
    memorial_day = date(year, 5, 31)
    while memorial_day.weekday() != 0:
        memorial_day -= timedelta(days=1)
    parade_day = memorial_day - timedelta(days=2)
    return parade_day.isoformat(), parade_day.isoformat()


def _resolve_window(today: date) -> tuple[str, str]:
    for candidate_year in (today.year, today.year + 1):
        if candidate_year in KNOWN_DATES:
            start_date, end_date = KNOWN_DATES[candidate_year]
            if date.fromisoformat(start_date) >= today:
                return start_date, end_date

    candidate_year = today.year if today.month < 5 else today.year + 1
    return _memorial_day_weekend_window(candidate_year)


def _fetch_source_page() -> tuple[str, str]:
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})

    for url in CANDIDATE_URLS:
        try:
            response = session.get(url, timeout=20)
            response.raise_for_status()
            html = response.text or ""
            if len(html) < 200:
                continue
            return response.url or url, html
        except Exception as err:
            logger.warning("Failed Atlanta Caribbean Carnival candidate %s: %s", url, err)

    return BASE_URL, ""


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Caribbean Carnival as a canonical annual container event."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    selected_url, html = _fetch_source_page()
    image_url = _extract_image_url(html)
    start_str, end_str = _resolve_window(datetime.now().date())
    start_date = date.fromisoformat(start_str)
    end_date = date.fromisoformat(end_str)

    title = f"Atlanta Caribbean Carnival {start_date.year}"
    content_hash = generate_content_hash(
        title, "Atlanta Caribbean Carnival", start_date.isoformat()
    )
    events_found = 1

    event_record = {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": (
            "Annual Atlanta Caribbean Carnival celebration featuring masquerade bands, "
            "parade energy, Caribbean music, and community programming. Surrounding "
            "schedule details may publish closer to the event."
        ),
        "start_date": start_date.isoformat(),
        "start_time": None,
        "end_date": end_date.isoformat() if end_date > start_date else None,
        "end_time": None,
        "is_all_day": True,
        "category": "community",
        "subcategory": "festival",
        "tags": [
            "caribbean-carnival",
            "carnival",
            "parade",
            "community",
            "atlanta",
        ],
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "is_free": False,
        "is_tentpole": True,
        "source_url": selected_url,
        "ticket_url": selected_url,
        "image_url": image_url,
        "raw_text": f"{title} - {start_date.isoformat()} to {end_date.isoformat()}",
        "extraction_confidence": 0.8,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=5",
        "content_hash": content_hash,
    }

    existing = find_event_by_hash(content_hash)
    if existing:
        smart_update_existing_event(existing, event_record)
        events_updated = 1
        logger.info("Updated: %s", title)
        return events_found, events_new, events_updated

    try:
        insert_event(event_record)
        events_new = 1
        logger.info("Added: %s", title)
    except Exception as err:
        logger.error("Failed to insert Atlanta Caribbean Carnival: %s", err)

    return events_found, events_new, events_updated

