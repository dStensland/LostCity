"""
Crawler for The Thomas P. Hinman Dental Meeting.

Official sources:
- The Hinman homepage links the active 2026 prereg page.
- The official prereg page publishes the 2026 date range and registration link.
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

SOURCE_URL = "https://www.hinman.org/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

PLACE_DATA = {
    "name": "Georgia World Congress Center",
    "slug": "georgia-world-congress-center",
    "address": "285 Andrew Young International Blvd NW",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7607,
    "lng": -84.3976,
    "place_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://www.gwcca.org/",
}


class NoCurrentCycleError(ValueError):
    """The official site is reachable, but only a past Hinman cycle is posted."""


def parse_source_pages(homepage_html: str, prereg_html: str, today: date | None = None) -> dict:
    """Extract the current Hinman cycle from official organizer pages."""
    today = today or datetime.now().date()
    homepage_soup = BeautifulSoup(homepage_html, "html.parser")
    prereg_soup = BeautifulSoup(prereg_html, "html.parser")

    ticket_url = None
    for anchor in homepage_soup.find_all("a", href=True):
        text = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True)).lower()
        if "register now" in text or "prereg.net/2026/hd" in anchor["href"].lower():
            ticket_url = anchor["href"]
            break
    if not ticket_url:
        raise ValueError("Hinman homepage did not expose the official 2026 registration link")

    description = ""
    desc_tag = prereg_soup.find("meta", attrs={"name": "description"})
    if desc_tag and desc_tag.get("content"):
        description = str(desc_tag["content"]).strip()
    if not description:
        raise ValueError("Hinman prereg page did not expose the 2026 description metadata")

    date_match = re.search(
        r"March\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})\s+in\s+Atlanta",
        description,
        re.IGNORECASE,
    )
    if not date_match:
        raise ValueError("Hinman prereg page did not expose the 2026 Atlanta date range")

    start_day = int(date_match.group(1))
    end_day = int(date_match.group(2))
    year = int(date_match.group(3))
    start_date = date(year, 3, start_day)
    end_date = date(year, 3, end_day)
    if end_date < today:
        raise NoCurrentCycleError("Hinman prereg page only exposes a past-dated cycle")

    image_url = None
    og_image = prereg_soup.find("meta", attrs={"property": "og:image"})
    if og_image and og_image.get("content"):
        image_url = urljoin(ticket_url.rstrip("/") + "/", str(og_image["content"]).strip())

    normalized_description = (
        "The Thomas P. Hinman Dental Meeting is a destination dental convention for "
        "continuing education, exhibits, practice innovation, and professional networking in Atlanta."
    )

    return {
        "title": "The Thomas P. Hinman Dental Meeting 2026",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "ticket_url": ticket_url,
        "image_url": image_url,
        "description": normalized_description,
        "source_url": SOURCE_URL,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Hinman from the official homepage and prereg page."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    homepage_response = requests.get(
        SOURCE_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    homepage_response.raise_for_status()

    homepage_soup = BeautifulSoup(homepage_response.text, "html.parser")
    ticket_url = None
    for anchor in homepage_soup.find_all("a", href=True):
        text = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True)).lower()
        if "register now" in text or "prereg.net/2026/hd" in anchor["href"].lower():
            ticket_url = anchor["href"]
            break
    if not ticket_url:
        raise ValueError("Hinman homepage did not expose the official 2026 registration link")

    prereg_response = requests.get(
        ticket_url,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    prereg_response.raise_for_status()

    try:
        event = parse_source_pages(homepage_response.text, prereg_response.text)
    except NoCurrentCycleError as exc:
        stale_removed = remove_stale_source_events(source_id, current_hashes)
        if stale_removed:
            logger.info("Removed %s stale Hinman events after refresh", stale_removed)
        logger.info("Hinman crawl complete: no current cycle published (%s)", exc)
        return 0, 0, 0
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
        "tags": ["dental", "conference", "continuing-education", "expo", "healthcare"],
        "price_min": None,
        "price_max": None,
        "price_note": "See the official Hinman registration page for current attendee pricing and eligibility.",
        "is_free": False,
        "source_url": event["source_url"],
        "ticket_url": event["ticket_url"],
        "image_url": event["image_url"],
        "raw_text": (
            f"{event['title']} | {event['start_date']} to {event['end_date']} | "
            f"{PLACE_DATA['name']}"
        ),
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
        logger.info("Removed %s stale Hinman events after refresh", stale_removed)

    logger.info(
        "Hinman crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
