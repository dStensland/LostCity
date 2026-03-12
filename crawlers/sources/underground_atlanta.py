"""
Crawler for Underground Atlanta.

The current Wix events page exposes a canonical event detail URL and Event
JSON-LD directly in the page source, even though the visual listing shell is
mostly empty from this runtime.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_venue, insert_event, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

EVENTS_URL = "https://www.undergroundatl.com/events"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}

VENUE_DATA = {
    "name": "Underground Atlanta",
    "slug": "underground-atlanta",
    "address": "50 Upper Alabama St",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7529,
    "lng": -84.3915,
    "venue_type": "entertainment_complex",
    "spot_type": "entertainment_complex",
    "website": "https://www.undergroundatl.com",
}


def extract_detail_urls(html: str) -> list[str]:
    """Extract canonical Underground event detail URLs from the listing HTML."""
    soup = BeautifulSoup(html, "html.parser")
    urls: list[str] = []
    for link in soup.select('a[href*="https://www.undergroundatl.com/events/"], a[href*="/events/"]'):
        url = (link.get("href") or "").strip()
        if not url:
            continue
        if url.startswith("/events/"):
            url = f"https://www.undergroundatl.com{url}"
        if "quote=" in url or "text=" in url:
            continue
        clean = url.split("&", 1)[0]
        if clean not in urls:
            urls.append(clean)

    if urls:
        return urls

    matches = re.findall(r"https://www\.undergroundatl\.com/events/[^\"'\s<]+", html)
    for url in matches:
        if "quote=" in url or "text=" in url:
            continue
        clean = url.split("&", 1)[0]
        if clean not in urls:
            urls.append(clean)
    return urls


def parse_event_jsonld(html: str) -> Optional[dict]:
    """Extract the schema.org Event payload from a detail page."""
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.select('script[type="application/ld+json"]'):
        raw = script.get_text(strip=True)
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict) and payload.get("@type") == "Event":
            return payload
    return None


def parse_iso_datetime(value: str) -> tuple[str, Optional[str]]:
    """Parse ISO datetime into start_date and start_time."""
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt.date().isoformat(), dt.strftime("%H:%M")


def determine_category(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Map Underground event metadata into LostCity categories."""
    text = f"{title} {description}".lower()
    tags = ["underground-atlanta", "downtown", "atlanta"]
    if "comedy" in text or "open mic" in text:
        return "comedy", None, tags + ["comedy"]
    if any(word in text for word in ["dj", "music", "concert", "live"]):
        return "music", "live", tags + ["music"]
    return "nightlife", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Underground Atlanta events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    listing = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
    listing.raise_for_status()
    detail_urls = extract_detail_urls(listing.text)

    for detail_url in detail_urls:
        response = requests.get(detail_url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        event_json = parse_event_jsonld(response.text)
        if not event_json:
            logger.warning("Underground Atlanta detail page missing Event JSON-LD: %s", detail_url)
            continue

        title = event_json.get("name")
        start_raw = event_json.get("startDate")
        end_raw = event_json.get("endDate")
        if not title or not start_raw:
            continue

        start_date, start_time = parse_iso_datetime(start_raw)
        end_date, end_time = parse_iso_datetime(end_raw) if end_raw else (start_date, None)
        description = event_json.get("description", "")
        category, subcategory, tags = determine_category(title, description)
        image = event_json.get("image")
        image_url = image.get("url") if isinstance(image, dict) else image

        events_found += 1
        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date,
            "end_time": end_time,
            "is_all_day": False,
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": "free" in description.lower(),
            "source_url": detail_url,
            "ticket_url": detail_url,
            "image_url": image_url,
            "raw_text": None,
            "extraction_confidence": 0.9,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record)
            events_new += 1
            logger.info("Added Underground Atlanta event: %s on %s", title, start_date)
        except Exception as exc:
            logger.error("Failed to insert Underground Atlanta event %s: %s", title, exc)

    logger.info(
        "Underground Atlanta crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
