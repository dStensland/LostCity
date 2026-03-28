"""
Crawler for Georgia Technology Summit.

Official source:
- The summit homepage ships Event JSON-LD with the 2026 single-day schedule,
  venue, and registration path.
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

SOURCE_URL = "https://www.georgiatechnologysummit.com/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

PLACE_DATA = {
    "name": "Cobb Convention Center (Cobb Galleria Centre)",
    "slug": "cobb-convention-center-cobb-galleria-centre",
    "address": "2 Galleria Pkwy SE",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "lat": 33.8842,
    "lng": -84.4716,
    "place_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://cobbgalleria.com/",
}


def parse_homepage(html: str, today: date | None = None) -> dict:
    """Extract the current Georgia Technology Summit event from homepage JSON-LD."""
    today = today or datetime.now().date()
    soup = BeautifulSoup(html, "html.parser")

    payload = None
    for script in soup.find_all("script", type="application/ld+json"):
        raw = (script.string or script.get_text() or "").strip()
        if not raw:
            continue
        try:
            candidate = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(candidate, dict) and candidate.get("name") == "2026 Georgia Technology Summit":
            payload = candidate
            break

    if not payload:
        raise ValueError("Georgia Technology Summit homepage missing official event JSON-LD")

    start_value = str(payload.get("startDate") or "").strip()
    end_value = str(payload.get("endDate") or "").strip()
    if not start_value or not end_value:
        raise ValueError("Georgia Technology Summit JSON-LD missing start/end datetime")

    start_dt = datetime.strptime(start_value, "%Y-%m-%d %H:%M")
    end_dt = datetime.strptime(end_value, "%Y-%m-%d %H:%M")
    if start_dt.date() < today:
        raise ValueError("Georgia Technology Summit homepage only exposes a past-dated cycle")

    register_url = None
    for anchor in soup.find_all("a", href=True):
        text = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True)).lower()
        if text == "register here":
            register_url = urljoin(SOURCE_URL, anchor["href"])
            break

    description = BeautifulSoup(str(payload.get("description") or ""), "html.parser").get_text(" ", strip=True)

    return {
        "title": "Georgia Technology Summit",
        "start_date": start_dt.date().isoformat(),
        "start_time": start_dt.strftime("%H:%M"),
        "end_time": end_dt.strftime("%H:%M"),
        "ticket_url": register_url or payload.get("offers", {}).get("url") or SOURCE_URL,
        "source_url": SOURCE_URL,
        "description": description or (
            "Georgia Technology Summit convenes Georgia technology leaders for a full day of insight, "
            "networking, and innovation-focused conference programming."
        ),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Technology Summit from the official homepage."""
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
        "start_time": event["start_time"],
        "end_date": None,
        "end_time": event["end_time"],
        "is_all_day": False,
        "category": "community",
        "subcategory": "conference",
        "tags": ["technology", "conference", "innovation", "business", "networking"],
        "price_min": None,
        "price_max": None,
        "price_note": "See the official registration page for current summit ticketing and sponsor details.",
        "is_free": False,
        "source_url": event["source_url"],
        "ticket_url": event["ticket_url"],
        "image_url": None,
        "raw_text": (
            f"{event['title']} | {event['start_date']} | "
            f"{event['start_time']}-{event['end_time']} | Cobb Convention Center"
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
        logger.info("Removed %s stale Georgia Technology Summit events after refresh", stale_removed)

    logger.info(
        "Georgia Technology Summit crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
