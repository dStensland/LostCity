"""
Crawler for Georgia Educational Technology Conference (GaETC).

Official source:
- The conference homepage publishes the 2026 date range, venue, and official
  attendee path.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from urllib.parse import urljoin

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

SOURCE_URL = "https://conference.gaetc.org/"
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


def parse_homepage(html: str, today: date | None = None) -> dict:
    """Extract the current GaETC cycle from the official conference homepage."""
    today = today or datetime.now().date()
    soup = BeautifulSoup(html, "html.parser")
    page_text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))

    date_match = re.search(r"November\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})", page_text, re.IGNORECASE)
    if not date_match:
        raise ValueError("GaETC homepage did not expose the official 2026 conference date range")

    start_day = int(date_match.group(1))
    end_day = int(date_match.group(2))
    year = int(date_match.group(3))
    start_date = date(year, 11, start_day)
    end_date = date(year, 11, end_day)
    if end_date < today:
        raise ValueError("GaETC homepage only exposes a past-dated cycle")

    if "Georgia International Convention Center" not in page_text:
        raise ValueError("GaETC homepage missing the official GICC venue block")

    ticket_url = None
    for anchor in soup.find_all("a", href=True):
        text = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True)).lower()
        href = urljoin(SOURCE_URL, anchor["href"])
        if text in {"attend", "attend gaetc"} and not ticket_url:
            ticket_url = href
            break

    return {
        "title": "Georgia Educational Technology Conference",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "source_url": SOURCE_URL,
        "ticket_url": ticket_url,
        "description": (
            "GaETC is Georgia’s flagship educational technology conference, bringing educators, "
            "school leaders, exhibitors, and EdTech practitioners together for sessions, workshops, "
            "and statewide professional learning."
        ),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl GaETC from the official conference homepage."""
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

    event = parse_homepage(response.text)
    venue_id = get_or_create_place(PLACE_DATA)
    content_hash = generate_content_hash(event["title"], PLACE_DATA["name"], event["start_date"])
    current_hashes.add(content_hash)
    events_found = 1

    event_record = {
        "source_id": source_id,
        "place_id": venue_id,
        "title": event["title"],
        "description": event["description"],
        "start_date": event["start_date"],
        "start_time": None,
        "end_date": event["end_date"],
        "end_time": None,
        "is_all_day": True,
        "category": "community",
        "subcategory": "conference",
        "tags": ["education", "technology", "conference", "teachers", "professional-learning"],
        "price_min": None,
        "price_max": None,
        "price_note": "See the official attendee page for current conference registration tiers and exhibitor details.",
        "is_free": False,
        "source_url": event["source_url"],
        "ticket_url": event["ticket_url"],
        "image_url": None,
        "raw_text": (
            f"{event['title']} | {event['start_date']} to {event['end_date']} | "
            "Georgia International Convention Center"
        ),
        "extraction_confidence": 0.96,
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
        logger.info("Removed %s stale GaETC events after refresh", stale_removed)

    logger.info(
        "GaETC crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
