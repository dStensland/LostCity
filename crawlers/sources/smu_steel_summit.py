"""
Crawler for SMU Steel Summit.

Official sources:
- The summit homepage publishes the 2026 date range and registration path.
- The venue page publishes the Georgia International Convention Center details.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from urllib.parse import urljoin

import requests
import urllib3
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

SOURCE_URL = "https://smusteelsummit.com/"
VENUE_URL = "http://www.events.crugroup.com/smusteelsummit/venue"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

VENUE_DATA = {
    "name": "Georgia International Convention Center",
    "slug": "georgia-international-convention-center",
    "address": "2000 Convention Center Concourse",
    "city": "College Park",
    "state": "GA",
    "zip": "30337",
    "lat": 33.6410,
    "lng": -84.4361,
    "venue_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://www.gicc.com/",
}


def parse_pages(home_html: str, venue_html: str, today: date | None = None) -> dict:
    """Extract the current SMU Steel Summit cycle from official pages."""
    today = today or datetime.now().date()
    home_soup = BeautifulSoup(home_html, "html.parser")
    home_text = re.sub(r"\s+", " ", home_soup.get_text(" ", strip=True))
    venue_text = re.sub(r"\s+", " ", BeautifulSoup(venue_html, "html.parser").get_text(" ", strip=True))

    date_match = re.search(r"August\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})", home_text, re.IGNORECASE)
    if not date_match:
        raise ValueError("SMU Steel Summit homepage did not expose the current date range")

    start_day = int(date_match.group(1))
    end_day = int(date_match.group(2))
    year = int(date_match.group(3))
    start_date = date(year, 8, start_day)
    end_date = date(year, 8, end_day)
    if end_date < today:
        raise ValueError("SMU Steel Summit homepage only exposes a past-dated cycle")

    if "Georgia International Convention Center" not in venue_text:
        raise ValueError("SMU Steel Summit venue page missing the official GICC venue block")

    ticket_url = None
    for anchor in home_soup.find_all("a", href=True):
        text = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True)).lower()
        href = urljoin(VENUE_URL, anchor["href"])
        if text == "register" or text == "register here":
            ticket_url = href
            break

    return {
        "title": "SMU Steel Summit",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "source_url": VENUE_URL,
        "ticket_url": ticket_url,
        "description": (
            "SMU Steel Summit is a major North American steel-industry conference focused on market analysis, "
            "networking, trade, manufacturing, and business strategy."
        ),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl SMU Steel Summit from official summit and venue pages."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    home_response = requests.get(
        SOURCE_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
        verify=False,
    )
    home_response.raise_for_status()

    venue_response = requests.get(
        VENUE_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
        verify=False,
    )
    venue_response.raise_for_status()

    event = parse_pages(home_response.text, venue_response.text)
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
        "start_time": None,
        "end_date": event["end_date"],
        "end_time": None,
        "is_all_day": True,
        "category": "community",
        "subcategory": "conference",
        "tags": ["industry", "steel", "manufacturing", "conference", "trade"],
        "price_min": None,
        "price_max": None,
        "price_note": "See the official summit registration page for current attendee, sponsor, and exhibitor pricing.",
        "is_free": False,
        "source_url": event["source_url"],
        "ticket_url": event["ticket_url"],
        "image_url": None,
        "raw_text": (
            f"{event['title']} | {event['start_date']} to {event['end_date']} | "
            "Georgia International Convention Center"
        ),
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
        logger.info("Removed %s stale SMU Steel Summit events after refresh", stale_removed)

    logger.info(
        "SMU Steel Summit crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
