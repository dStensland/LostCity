"""
Crawler for Critical Materials & Minerals Expo (North America).

Official source:
- The official attend/register page publishes the daily conference and expo
  hours plus the Cobb Convention Center venue block for the 2026 Atlanta event.
"""

from __future__ import annotations

import logging
import re
from datetime import date

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

SOURCE_URL = "https://criticalmineralsexpona.com/register-attend"
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


def parse_attend_page(html: str, today: date | None = None) -> dict:
    """Extract daily expo sessions from the official attend page."""
    today = today or date.today()
    page_text = re.sub(r"\s+", " ", BeautifulSoup(html, "html.parser").get_text(" ", strip=True))

    if "Cobb Convention Center" not in page_text or "Atlanta, Georgia 30339" not in page_text:
        raise ValueError("Critical Materials page missing the official Cobb venue block")

    matches = re.findall(
        r"October\s+(28|29)\s+2026\s+Conference:\s+(\d{2}:\d{2})\s+[–-]\s+(\d{2}:\d{2})\s+Expo:\s+(\d{2}:\d{2})\s+[–-]\s+(\d{2}:\d{2})",
        page_text,
    )
    if len(matches) < 2:
        raise ValueError("Critical Materials page did not expose both 2026 daily schedule blocks")

    sessions = []
    for day_str, _conf_start, _conf_end, expo_start, expo_end in matches[:2]:
        session_date = date(2026, 10, int(day_str))
        if session_date < today:
            raise ValueError("Critical Materials page only exposes a past-dated cycle")
        sessions.append(
            {
                "title": "Critical Materials & Minerals Expo 2026 (North America)",
                "start_date": session_date.isoformat(),
                "start_time": expo_start,
                "end_time": expo_end,
            }
        )

    return {
        "title": "Critical Materials & Minerals Expo 2026 (North America)",
        "source_url": SOURCE_URL,
        "sessions": sessions,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the official Critical Materials & Minerals Expo attend page."""
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

    show = parse_attend_page(response.text)
    venue_id = get_or_create_venue(VENUE_DATA)
    description = (
        "Critical Materials & Minerals Expo North America is a specialty industry event focused on "
        "critical minerals, supply chains, battery materials, and industrial exhibition activity at Cobb Galleria."
    )

    for session in show["sessions"]:
        content_hash = generate_content_hash(session["title"], VENUE_DATA["name"], session["start_date"])
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
            "tags": ["industry", "minerals", "materials", "conference", "expo"],
            "price_min": None,
            "price_max": None,
            "price_note": "Registration is handled through the official attend page; check the organizer site for current attendee access.",
            "is_free": False,
            "source_url": show["source_url"],
            "ticket_url": show["source_url"],
            "image_url": None,
            "raw_text": (
                f"{session['title']} | {session['start_date']} | "
                f"{session['start_time']}-{session['end_time']} | Cobb Convention Center"
            ),
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
        logger.info("Removed %s stale Critical Materials Expo events after refresh", stale_removed)

    logger.info(
        "Critical Materials & Minerals Expo crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated

