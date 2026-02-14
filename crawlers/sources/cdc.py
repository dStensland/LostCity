"""
Crawler for CDC Museum tour opportunities (cdc.gov/museum).

This crawler is intentionally conservative:
- It only emits structured events when CDC's tour page indicates regular Friday tours.
- If the museum is marked temporarily closed, no events are emitted.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_venue, insert_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

TOURS_URL = "https://www.cdc.gov/museum/tours/"
FRIDAY_TOUR_URL = "https://www.cdc.gov/museum/tours/friday-tour/index.htm"

VENUE_DATA = {
    "name": "David J. Sencer CDC Museum",
    "slug": "cdc-museum-atlanta",
    "address": "1600 Clifton Rd NE",
    "neighborhood": "Clifton Corridor",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30329",
    "lat": 33.7967,
    "lng": -84.3238,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": "https://www.cdc.gov/museum/",
    "vibes": ["all-ages", "family-friendly"],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0; +https://lostcity.example)"
}

MAX_WEEKS_AHEAD = 10


def _fetch_html(url: str) -> Optional[str]:
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        return response.text
    except Exception as exc:
        logger.error(f"Failed to fetch CDC page {url}: {exc}")
        return None


def _is_temporarily_closed(page_text: str) -> bool:
    normalized = re.sub(r"\s+", " ", page_text).lower()
    return (
        "temporarily closed" in normalized
        and "when the museum reopens" in normalized
    )


def _next_weekday(base: date, weekday: int) -> date:
    days_ahead = (weekday - base.weekday()) % 7
    if days_ahead == 0:
        return base
    return base + timedelta(days=days_ahead)


def _build_description(page_text: str) -> str:
    condensed = re.sub(r"\s+", " ", page_text).strip()
    if len(condensed) > 440:
        condensed = condensed[:440].rstrip() + "..."
    if condensed:
        return condensed
    return (
        "Guided small-group public health museum tour at the David J. Sencer CDC Museum."
    )


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl CDC Museum Friday tour opportunities."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    tours_html = _fetch_html(TOURS_URL)
    if not tours_html:
        return events_found, events_new, events_updated

    tours_soup = BeautifulSoup(tours_html, "html.parser")
    tours_text = tours_soup.get_text(" ", strip=True)

    if _is_temporarily_closed(tours_text):
        logger.info(
            "CDC Museum page indicates temporary closure; skipping recurring tour event creation."
        )
        return events_found, events_new, events_updated

    # The tour page indicates weekly Friday tours at 12pm.
    # Keep this strict to avoid creating speculative events.
    if "fridays at 12pm" not in tours_text.lower():
        logger.info("CDC Friday tour schedule text not found; no events created.")
        return events_found, events_new, events_updated

    friday_html = _fetch_html(FRIDAY_TOUR_URL) or tours_html
    friday_soup = BeautifulSoup(friday_html, "html.parser")
    friday_text = friday_soup.get_text(" ", strip=True)

    venue_id = get_or_create_venue(VENUE_DATA)
    description = _build_description(friday_text)
    title = "CDC Museum Friday Tour (1-9 people)"

    today = datetime.now().date()
    first_friday = _next_weekday(today, weekday=4)  # Friday

    for week_offset in range(MAX_WEEKS_AHEAD):
        event_date = first_friday + timedelta(days=7 * week_offset)
        start_date = event_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
        events_found += 1

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "12:00",
            "end_date": start_date,
            "end_time": "13:00",
            "is_all_day": False,
            "category": "learning",
            "tags": ["public-health", "cdc", "museum", "tour", "family-friendly"],
            "price_min": 0,
            "price_max": 0,
            "price_note": "Free",
            "is_free": True,
            "source_url": FRIDAY_TOUR_URL,
            "ticket_url": FRIDAY_TOUR_URL,
            "image_url": None,
            "raw_text": (
                "Recurring Friday tour listing from CDC Museum tours page; "
                "generated for near-term scheduling visibility."
            ),
            "extraction_confidence": 0.78,
            "is_recurring": True,
            "recurrence_rule": "FREQ=WEEKLY;BYDAY=FR",
            "content_hash": content_hash,
        }
        insert_event(event_record)
        events_new += 1

    logger.info(
        "CDC crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
