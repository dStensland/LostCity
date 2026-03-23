"""
Crawler for Atlanta Streetwear Market.

Official sources:
- The organizer homepage publishes the next Atlanta cycle.
- The Atlanta Expo Centers events page confirms the facility for the current
  Atlanta stop.
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

SOURCE_URL = "https://www.atlantastreetwearmarket.com/"
TICKETS_URL = "https://www.eventbrite.com/o/atlanta-streetwear-market-13084332653"
VENUE_PAGE_URL = "https://www.atlantaexpositioncenters.com/events/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

VENUE_DATA = {
    "name": "Atlanta Expo Center North",
    "slug": "atlanta-expo-center-north",
    "address": "3650 Jonesboro Rd SE",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30354",
    "lat": 33.6530,
    "lng": -84.4170,
    "venue_type": "event_space",
    "spot_type": "event_space",
    "website": "https://www.atlantaexpositioncenters.com/",
}


def parse_official_homepage(text: str, today: date | None = None) -> dict:
    """Parse the organizer homepage for the current Atlanta Streetwear Market cycle."""
    today = today or datetime.now().date()
    match = re.search(
        r"([A-Za-z]+)\s+(\d{4}).*?Atlanta Streetwear Market on ([A-Za-z]+)\s+(\d{1,2})-(\d{1,2})",
        text,
        re.IGNORECASE,
    )
    if not match:
        raise ValueError("Atlanta Streetwear Market homepage did not expose the current cycle")

    _, year_str, month_name, start_day_str, end_day_str = match.groups()
    year = int(year_str)
    month = datetime.strptime(month_name[:3], "%b").month
    start_date = date(year, month, int(start_day_str))
    end_date = date(year, month, int(end_day_str))
    if end_date < today:
        raise ValueError("Atlanta Streetwear Market homepage only exposes a past-dated cycle")

    return {
        "title": "Atlanta Streetwear Market",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
    }


def parse_venue_listing(html: str, today: date | None = None) -> str | None:
    """Find the first future Atlanta Streetwear Market facility label from Atlanta Expo Centers."""
    today = today or datetime.now().date()
    soup = BeautifulSoup(html, "html.parser")
    page_text = soup.get_text("\n", strip=True)
    anchor_match = re.search(
        r"(\d{1,2})/(\d{1,2})(?:\s*-\s*(\d{1,2})/(\d{1,2})|\s*-\s*(\d{1,2}))?\s+ATL Streetwear Market",
        page_text,
        re.IGNORECASE,
    )
    if not anchor_match:
        return None

    month = int(anchor_match.group(1))
    start_day = int(anchor_match.group(2))
    candidate_date = date(today.year, month, start_day)
    if candidate_date < today and month < today.month:
        candidate_date = date(today.year + 1, month, start_day)
    if candidate_date < today:
        return None

    line_match = re.search(
        r"ATL Streetwear Market.*?(Atlanta Expo Centers\s*-\s*[A-Za-z\s&]+Facility)",
        page_text,
        re.IGNORECASE | re.DOTALL,
    )
    if not line_match:
        return None
    return line_match.group(1).strip()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the official Atlanta Streetwear Market organizer page."""
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
    page_text = BeautifulSoup(response.text, "html.parser").get_text(" ", strip=True)
    show = parse_official_homepage(page_text)

    venue_response = requests.get(
        VENUE_PAGE_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    venue_response.raise_for_status()
    facility_label = parse_venue_listing(venue_response.text) or "Atlanta Expo Centers - North Facility"

    venue_id = get_or_create_venue(VENUE_DATA)
    title = show["title"]
    content_hash = generate_content_hash(title, VENUE_DATA["name"], show["start_date"])
    current_hashes.add(content_hash)
    events_found = 1

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": (
            "Atlanta Streetwear Market is a destination streetwear, vintage, and creator marketplace "
            "bringing local brands, resale culture, shopping, and community energy to Atlanta Expo Centers."
        ),
        "start_date": show["start_date"],
        "start_time": None,
        "end_date": show["end_date"],
        "end_time": None,
        "is_all_day": True,
        "category": "community",
        "subcategory": "market",
        "tags": ["streetwear", "fashion", "vintage", "shopping", "market"],
        "price_min": None,
        "price_max": None,
        "price_note": "See the official ticket page for current GA and vendor access details.",
        "is_free": False,
        "source_url": SOURCE_URL,
        "ticket_url": TICKETS_URL,
        "image_url": None,
        "raw_text": (
            f"{title} | {show['start_date']} to {show['end_date']} | {facility_label}"
        ),
        "extraction_confidence": 0.91,
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
        logger.info("Removed %s stale Atlanta Streetwear Market events after refresh", stale_removed)

    logger.info(
        "Atlanta Streetwear Market crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
