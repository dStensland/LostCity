"""
Crawler for GROOM'D.

Official source:
- The registration page publishes the current event window, venue, and access
  guidance for the next Atlanta grooming trade show.
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

SOURCE_URL = "https://www.groomd.org/registration/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

VENUE_DATA = {
    "name": "Georgia International Convention Center",
    "slug": "georgia-international-convention-center",
    "address": "2000 Convention Center Concourse",
    "city": "College Park",
    "state": "GA",
    "zip": "30337",
    "venue_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://www.gicc.com/",
}


class NoCurrentCycleError(ValueError):
    """The source is reachable, but no current GROOM'D cycle is published."""


def parse_registration_page(text: str, today: date | None = None) -> dict:
    """Extract the current official GROOM'D event details."""
    today = today or datetime.now().date()

    date_match = re.search(
        r"GROOM[’']D 2026 takes place Friday,\s*([A-Za-z]+)\s+(\d{1,2})\s*[–-]\s*Sunday,\s*[A-Za-z]+\s+(\d{1,2}),\s*(\d{4})",
        text,
        re.IGNORECASE,
    )
    if not date_match:
        raise ValueError("GROOM'D registration page did not expose the 2026 event window")

    month_name, start_day_str, end_day_str, year_str = date_match.groups()
    month = datetime.strptime(month_name[:3], "%b").month
    year = int(year_str)
    start_date = date(year, month, int(start_day_str))
    end_date = date(year, month, int(end_day_str))
    if end_date < today:
        raise NoCurrentCycleError("GROOM'D registration page only exposes a past-dated cycle")

    venue_match = re.search(
        r"Georgia International Convention Center,\s*2000 Convention Center Concourse,\s*College Park,\s*GA\s*30337",
        text,
        re.IGNORECASE,
    )
    if not venue_match:
        raise ValueError("GROOM'D registration page missing the official venue block")

    trade_only = bool(re.search(r"trade-only event", text, re.IGNORECASE))

    return {
        "title": "Groom'd",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "trade_only": trade_only,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the official GROOM'D registration page."""
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
    try:
        event = parse_registration_page(page_text)
    except NoCurrentCycleError as exc:
        stale_removed = remove_stale_source_events(source_id, current_hashes)
        if stale_removed:
            logger.info("Removed %s stale GROOM'D events after refresh", stale_removed)
        logger.info("GROOM'D crawl complete: no current cycle published (%s)", exc)
        return 0, 0, 0

    venue_id = get_or_create_venue(VENUE_DATA)

    content_hash = generate_content_hash(event["title"], VENUE_DATA["name"], event["start_date"])
    current_hashes.add(content_hash)
    events_found = 1

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": event["title"],
        "description": (
            "GROOM'D is a pet-grooming trade show focused on competitions, education, exhibitors, "
            "and grooming-industry networking at the Georgia International Convention Center."
        ),
        "start_date": event["start_date"],
        "start_time": None,
        "end_date": event["end_date"],
        "end_time": None,
        "is_all_day": True,
        "category": "community",
        "subcategory": "expo",
        "tags": ["pets", "grooming", "trade-show", "expo", "business"],
        "price_min": None,
        "price_max": None,
        "price_note": (
            "Trade-only registration. The official site offers 3-day, weekend, and Sunday floor passes, "
            "with education and special sessions priced separately."
        ),
        "is_free": False,
        "source_url": SOURCE_URL,
        "ticket_url": SOURCE_URL,
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
        logger.info("Removed %s stale GROOM'D events after refresh", stale_removed)

    logger.info(
        "GROOM'D crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
