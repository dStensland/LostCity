"""
Crawler for Ameris Bank Amphitheatre (encoreparkamphitheatre.com).

Uses JSON-LD event objects from encoreparkamphitheatre.com.
"""

from __future__ import annotations

import json
import html as html_lib
import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.encoreparkamphitheatre.com"
EVENTS_URL = "https://www.encoreparkamphitheatre.com"

VENUE_DATA = {
    "name": "Ameris Bank Amphitheatre",
    "slug": "ameris-bank-amphitheatre",
    "address": "2200 Encore Pkwy",
    "neighborhood": "Alpharetta",
    "city": "Alpharetta",
    "state": "GA",
    "zip": "30009",
    "lat": 34.0514,
    "lng": -84.2461,
    "venue_type": "amphitheater",
    "spot_type": "music_venue",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def parse_jsonld_events(html: str) -> list[dict]:
    events: list[dict] = []
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.select('script[type="application/ld+json"]'):
        raw = script.string or script.text or ""
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            event_type = item.get("@type")
            if event_type == "Event" or (isinstance(event_type, list) and "Event" in event_type):
                events.append(item)
    return events


def parse_iso_datetime(value: str | None) -> tuple[Optional[str], Optional[str]]:
    if not value:
        return None, None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except ValueError:
        if re.match(r"^\d{4}-\d{2}-\d{2}$", str(value)):
            return str(value), None
        return None, None


def clean_description(value: str | None) -> str:
    if not value:
        return ""
    text = html_lib.unescape(str(value))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Ameris Bank Amphitheatre events from structured JSON-LD."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        logger.info(f"Fetching Ameris Bank Amphitheatre: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
        jsonld_events = parse_jsonld_events(response.text)
        logger.info(f"Found {len(jsonld_events)} JSON-LD events")

        today = datetime.now().date()
        seen_keys = set()

        for event_data in jsonld_events:
            title = (event_data.get("name") or "").strip()
            if not title:
                continue

            start_date, start_time = parse_iso_datetime(event_data.get("startDate"))
            end_date, end_time = parse_iso_datetime(event_data.get("endDate"))
            if not start_date:
                continue

            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                continue

            if start_dt < today:
                continue

            key = f"{title}|{start_date}"
            if key in seen_keys:
                continue
            seen_keys.add(key)

            description = clean_description(event_data.get("description"))
            event_url = event_data.get("url") or EVENTS_URL

            image_url = event_data.get("image")
            if isinstance(image_url, list):
                image_url = image_url[0] if image_url else None
            if not image_url:
                image_url = None

            offers = event_data.get("offers")
            price_min = None
            price_max = None
            price_note = None
            is_free = False
            if isinstance(offers, dict):
                if offers.get("price") is not None:
                    try:
                        price_min = float(offers["price"])
                        price_max = price_min
                        is_free = price_min == 0
                    except Exception:
                        price_note = str(offers.get("price"))
                availability = offers.get("availability")
                if availability:
                    price_note = availability.split("/")[-1]

            events_found += 1
            hash_key = f"{start_date}|{start_time}" if start_time else start_date
            content_hash = generate_content_hash(title, "Ameris Bank Amphitheatre", hash_key)
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description or "Event at Ameris Bank Amphitheatre",
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": False,
                "category": "music",
                "subcategory": "concert",
                "tags": ["ameris-bank", "alpharetta", "outdoor-concert", "live-music"],
                "price_min": price_min,
                "price_max": price_max,
                "price_note": price_note,
                "is_free": is_free,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": image_url,
                "raw_text": f"{title} - {start_date}",
                "extraction_confidence": 0.91,
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
            except Exception as e:
                logger.error(f"Failed to insert: {title}: {e}")

        logger.info(
            f"Ameris Bank Amphitheatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Ameris Bank Amphitheatre: {e}")
        raise

    return events_found, events_new, events_updated
