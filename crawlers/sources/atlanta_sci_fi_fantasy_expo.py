"""
Crawler for Atlanta Sci-Fi & Fantasy Expo.

Official sources:
- The homepage and schedule page publish the current Atlanta date range, venue,
  and official free-ticket link.
- The linked Eventbrite page provides structured ticket metadata and the lead
  day's public hours.
"""

from __future__ import annotations

import json
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

SOURCE_URL = "https://atlantascifiexpo.com/"
SCHEDULE_URL = "https://atlantascifiexpo.com/schedule/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

PLACE_DATA = {
    "name": "Northlake Mall",
    "slug": "northlake-mall",
    "address": "4800 Briarcliff Road Northeast",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30345",
    "lat": 33.8174,
    "lng": -84.2862,
    "venue_type": "event_space",
    "spot_type": "event_space",
    "website": "https://northlakemall.com/",
}


class NoCurrentCycleError(ValueError):
    """The official site is reachable, but only a past Atlanta Sci-Fi Expo cycle is posted."""


def _extract_ticket_url(soup: BeautifulSoup) -> str | None:
    for anchor in soup.find_all("a", href=True):
        text = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True)).lower()
        if "free ticket" in text or "unlock free entry" in text:
            return urljoin(SOURCE_URL, anchor["href"])
    return None


def _parse_eventbrite_jsonld(html: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.find_all("script", type="application/ld+json"):
        raw = (script.string or script.get_text() or "").strip()
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict) and payload.get("name") == "Atlanta Sci-Fi and Fantasy Expo":
            return payload
    return None


def parse_source_pages(
    homepage_html: str,
    schedule_html: str,
    ticket_html: str,
    today: date | None = None,
) -> dict:
    """Extract the current Atlanta Sci-Fi & Fantasy Expo cycle from official pages."""
    today = today or datetime.now().date()
    homepage_soup = BeautifulSoup(homepage_html, "html.parser")
    schedule_text = re.sub(r"\s+", " ", BeautifulSoup(schedule_html, "html.parser").get_text(" ", strip=True))

    page_text = re.sub(r"\s+", " ", homepage_soup.get_text(" ", strip=True))
    date_match = re.search(r"March\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})", page_text, re.IGNORECASE)
    if not date_match:
        raise ValueError("Atlanta Sci-Fi & Fantasy Expo homepage did not expose the current Atlanta date range")

    start_day = int(date_match.group(1))
    end_day = int(date_match.group(2))
    year = int(date_match.group(3))
    start_date = date(year, 3, start_day)
    end_date = date(year, 3, end_day)
    if end_date < today:
        raise NoCurrentCycleError("Atlanta Sci-Fi & Fantasy Expo homepage only exposes a past-dated cycle")

    if "Northlake Mall" not in page_text and "Northlake Mall" not in schedule_text:
        raise ValueError("Atlanta Sci-Fi & Fantasy Expo pages did not expose the official venue")

    ticket_url = _extract_ticket_url(homepage_soup)
    if not ticket_url:
        raise ValueError("Atlanta Sci-Fi & Fantasy Expo homepage missing official ticket link")

    ticket_payload = _parse_eventbrite_jsonld(ticket_html)
    image_url = None
    saturday_start = None
    saturday_end = None
    if ticket_payload:
        image_url = ticket_payload.get("image")
        start_value = str(ticket_payload.get("startDate") or "").strip()
        end_value = str(ticket_payload.get("endDate") or "").strip()
        if start_value:
            saturday_start = datetime.fromisoformat(start_value).strftime("%H:%M")
        if end_value:
            saturday_end = datetime.fromisoformat(end_value).strftime("%H:%M")

    description = (
        "Atlanta Sci-Fi & Fantasy Expo is a free fan convention built around creators, panels, "
        "gaming, workshops, vendors, cosplay, and community fandom at Northlake Mall."
    )

    return {
        "title": "Atlanta Sci-Fi & Fantasy Expo",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "ticket_url": ticket_url,
        "image_url": image_url,
        "source_url": SCHEDULE_URL,
        "description": description,
        "saturday_start_time": saturday_start,
        "saturday_end_time": saturday_end,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Sci-Fi & Fantasy Expo from its official site."""
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

    schedule_response = requests.get(
        SCHEDULE_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    schedule_response.raise_for_status()

    ticket_html = ""
    ticket_url = _extract_ticket_url(BeautifulSoup(homepage_response.text, "html.parser"))
    if ticket_url:
        ticket_response = requests.get(
            ticket_url,
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        ticket_response.raise_for_status()
        ticket_html = ticket_response.text

    try:
        event = parse_source_pages(homepage_response.text, schedule_response.text, ticket_html)
    except NoCurrentCycleError as exc:
        stale_removed = remove_stale_source_events(source_id, current_hashes)
        if stale_removed:
            logger.info("Removed %s stale Atlanta Sci-Fi & Fantasy Expo events after refresh", stale_removed)
        logger.info("Atlanta Sci-Fi & Fantasy Expo crawl complete: no current cycle published (%s)", exc)
        return 0, 0, 0
    venue_id = get_or_create_place(PLACE_DATA)
    content_hash = generate_content_hash(event["title"], PLACE_DATA["name"], event["start_date"])
    current_hashes.add(content_hash)
    events_found = 1

    price_note = "General admission is free; some workshops or tournaments may carry separate costs."
    if event["saturday_start_time"] and event["saturday_end_time"]:
        price_note += (
            f" The official Eventbrite page currently lists Saturday hours as "
            f"{event['saturday_start_time']}-{event['saturday_end_time']}."
        )

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
        "subcategory": "convention",
        "tags": ["sci-fi", "fantasy", "fandom", "cosplay", "gaming", "free"],
        "price_min": 0.0,
        "price_max": 0.0,
        "price_note": price_note,
        "is_free": True,
        "source_url": event["source_url"],
        "ticket_url": event["ticket_url"],
        "image_url": event["image_url"],
        "raw_text": (
            f"{event['title']} | {event['start_date']} to {event['end_date']} | "
            "Northlake Mall"
        ),
        "extraction_confidence": 0.94,
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
        logger.info("Removed %s stale Atlanta Sci-Fi & Fantasy Expo events after refresh", stale_removed)

    logger.info(
        "Atlanta Sci-Fi & Fantasy Expo crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
