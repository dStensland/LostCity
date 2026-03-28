"""
Crawler for Atlanta Model Train Show.

Official source:
- Golden Spike Enterprises show schedule page, which lists Atlanta (Duluth)
  dates and the Gas South venue block directly in an HTML table.
"""

from __future__ import annotations

import logging
from datetime import date, datetime

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

SOURCE_URL = "https://gserr.com/shows.htm"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

PLACE_DATA = {
    "name": "Gas South Convention Center",
    "slug": "gas-south-convention-center",
    "address": "6400 Sugarloaf Pkwy",
    "city": "Duluth",
    "state": "GA",
    "zip": "30097",
    "lat": 33.9748,
    "lng": -84.1427,
    "venue_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://www.gassouthdistrict.com/events/venue/convention-center",
}


def parse_future_atlanta_shows(html: str, today: date | None = None) -> list[dict]:
    """Parse future Atlanta/Duluth rows from the official GSERR schedule table."""
    today = today or datetime.now().date()
    soup = BeautifulSoup(html, "html.parser")

    future_rows: list[dict] = []
    for row in soup.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 3:
            continue

        location = cells[0].get_text(" ", strip=True)
        date_text = cells[1].get_text(" ", strip=True)
        facility = cells[2].get_text(" ", strip=True)

        if "Atlanta, GA" not in location or "Duluth" not in location:
            continue
        if "Gas South" not in facility:
            continue

        try:
            show_date = datetime.strptime(date_text, "%m/%d/%y").date()
        except ValueError:
            continue

        if show_date < today:
            continue

        future_rows.append(
            {
                "date": show_date.isoformat(),
                "location": location,
                "facility": facility,
            }
        )

    return future_rows


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the official GSERR schedule and keep only future Atlanta/Duluth shows."""
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

    shows = parse_future_atlanta_shows(response.text)
    if not shows:
        raise ValueError("GSERR schedule did not yield any future Atlanta model train show rows")

    venue_id = get_or_create_place(PLACE_DATA)
    description = (
        "Golden Spike Enterprises' Atlanta-area model train show at Gas South Convention Center "
        "featuring model trains and railroad artifacts."
    )

    for show in shows:
        title = "Atlanta Model Train Show"
        content_hash = generate_content_hash(title, PLACE_DATA["name"], show["date"])
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": show["date"],
            "start_time": None,
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "community",
            "subcategory": "expo",
            "tags": [
                "model-trains",
                "railroad",
                "collectibles",
                "expo",
                "family-friendly",
            ],
            "price_min": None,
            "price_max": None,
            "price_note": "See the official Golden Spike Enterprises show schedule for current admission details.",
            "is_free": False,
            "source_url": SOURCE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": f"{show['location']} | {show['date']} | {show['facility']}",
            "extraction_confidence": 0.93,
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
        logger.info("Removed %s stale Atlanta Model Train Show events after refresh", stale_removed)

    logger.info(
        "Atlanta Model Train Show crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
