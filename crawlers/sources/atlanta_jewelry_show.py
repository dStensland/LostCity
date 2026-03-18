"""
Crawler for Atlanta Jewelry Show.

Official source:
- Homepage announces the current season's dates and venue.

This is intentionally modeled as an industry expo with qualified-buyer gating,
not as a general-public festival.
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

SOURCE_URL = "https://www.atlantajewelryshow.com/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

VENUE_DATA = {
    "name": "Cobb Convention Center (Cobb Galleria Centre)",
    "slug": "cobb-convention-center-cobb-galleria-centre",
    "address": "2 Galleria Parkway Southeast",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "venue_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://cobbgalleria.com/",
}


class NoCurrentCycleError(ValueError):
    """The official site is reachable, but only a past Atlanta Jewelry Show season is posted."""


def parse_show_window(page_text: str, today: date | None = None) -> dict:
    """Extract the announced current Atlanta Jewelry Show season from homepage text."""
    today = today or datetime.now().date()
    match = re.search(
        r"(AJS\s+(Spring|Fall)\s+(\d{4}))\s*\|\s*([A-Za-z]+\s+\d{1,2}-\d{1,2},\s*\d{4})\s*\|\s*Cobb Convention Center,\s*Atlanta",
        page_text,
        re.IGNORECASE,
    )
    if not match:
        raise ValueError("Could not find Atlanta Jewelry Show date window on official homepage")

    full_title, season, year_str, date_range = match.groups()
    year = int(year_str)
    date_match = re.search(
        r"([A-Za-z]+)\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})",
        date_range,
        re.IGNORECASE,
    )
    if not date_match:
        raise ValueError("Could not parse Atlanta Jewelry Show date range")

    month_name, start_day_str, end_day_str, parsed_year_str = date_match.groups()
    month = datetime.strptime(month_name[:3], "%b").month
    parsed_year = int(parsed_year_str)
    start_date = date(parsed_year, month, int(start_day_str))
    end_date = date(parsed_year, month, int(end_day_str))

    if end_date < today:
        raise NoCurrentCycleError("Atlanta Jewelry Show official homepage only exposes a past-dated season")

    return {
        "title": full_title,
        "season": season.lower(),
        "year": year,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the current official Atlanta Jewelry Show season."""
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
    page_text = BeautifulSoup(response.text, "html.parser").get_text("\n", strip=True)
    try:
        show = parse_show_window(page_text)
    except NoCurrentCycleError as exc:
        stale_removed = remove_stale_source_events(source_id, current_hashes)
        if stale_removed:
            logger.info("Removed %s stale Atlanta Jewelry Show events after refresh", stale_removed)
        logger.info("Atlanta Jewelry Show crawl complete: no current season published (%s)", exc)
        return 0, 0, 0

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
            "Atlanta Jewelry Show is a jewelry-industry trade expo focused on qualified buyers, "
            "exhibitors, education, and professional networking. The official show highlights "
            "new collections, expert-led learning, BenchFusion, and broader jewelry-business programming."
        ),
        "start_date": show["start_date"],
        "start_time": None,
        "end_date": show["end_date"],
        "end_time": None,
        "is_all_day": True,
        "category": "community",
        "subcategory": "expo",
        "tags": [
            "jewelry",
            "trade-show",
            "business",
            "expo",
            "shopping",
            "industry",
        ],
        "price_min": None,
        "price_max": None,
        "price_note": "Qualified-buyer registration and exhibitor participation; see the official show site for access details.",
        "is_free": False,
        "source_url": SOURCE_URL,
        "ticket_url": None,
        "image_url": None,
        "raw_text": f"{title} | {show['start_date']} to {show['end_date']} | Cobb Convention Center, Atlanta",
        "extraction_confidence": 0.92,
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
        logger.info("Removed %s stale Atlanta Jewelry Show events after refresh", stale_removed)

    logger.info(
        "Atlanta Jewelry Show crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
