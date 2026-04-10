"""
Crawler for Reformation Brewery — three Atlanta-area locations.

Reformation operates separate WordPress/TEC subdomain sites per location:
  - woodstock.reformationbrewery.com  (Woodstock, GA)
  - canton.reformationbrewery.com     (Canton, GA)
  - smyrna.reformationbrewery.com     (Smyrna, GA)

Each exposes The Events Calendar REST API at /wp-json/tribe/events/v1/events.
The main reformationbrewery.com/events page renders 0 events — all event data
lives on the subdomains. We crawl all three via API and deduplicate by
content_hash (title + location + date) to avoid re-inserting recurring events
that appear across multiple crawl runs.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from html import unescape
from typing import Optional

import requests

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}

# Per-location config: TEC API base, place slug, and place metadata
LOCATIONS = [
    {
        "api_base": "https://woodstock.reformationbrewery.com/wp-json/tribe/events/v1/events",
        "place": {
            "name": "Reformation Brewery (Woodstock)",
            "slug": "reformation-brewery-woodstock",
            "address": "105 Elm St",
            "neighborhood": "Downtown Woodstock",
            "city": "Woodstock",
            "state": "GA",
            "zip": "30188",
            "lat": 34.1003,
            "lng": -84.5210,
            "place_type": "brewery",
            "spot_type": "brewery",
            "website": "https://woodstock.reformationbrewery.com",
        },
    },
    {
        "api_base": "https://canton.reformationbrewery.com/wp-json/tribe/events/v1/events",
        "place": {
            "name": "Reformation Brewery (Canton)",
            "slug": "reformation-brewery-canton",
            "address": "2 Reinhardt College Pkwy",
            "neighborhood": "Downtown Canton",
            "city": "Canton",
            "state": "GA",
            "zip": "30114",
            "lat": 34.2368,
            "lng": -84.4911,
            "place_type": "brewery",
            "spot_type": "brewery",
            "website": "https://canton.reformationbrewery.com",
        },
    },
    {
        "api_base": "https://smyrna.reformationbrewery.com/wp-json/tribe/events/v1/events",
        "place": {
            "name": "Reformation Brewery (Smyrna)",
            "slug": "reformation-brewery-smyrna",
            "address": "2415 Dallas Hwy SW",
            "neighborhood": "Smyrna",
            "city": "Smyrna",
            "state": "GA",
            "zip": "30080",
            "lat": 33.8554,
            "lng": -84.5463,
            "place_type": "brewery",
            "spot_type": "brewery",
            "website": "https://smyrna.reformationbrewery.com",
        },
    },
]

SHARED_TAGS = ["reformation-brewery", "craft-beer", "brewery", "cherokee-county"]


def strip_html(text: Optional[str]) -> str:
    """Remove HTML tags and decode entities."""
    if not text:
        return ""
    cleaned = re.sub(r"<[^>]+>", " ", text)
    cleaned = unescape(cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


CRAWL_WINDOW_DAYS = 60


def fetch_events_page(api_base: str, page: int = 1, per_page: int = 50, end_date: str | None = None) -> dict:
    """Fetch one page of events from TEC REST API."""
    params: dict = {"per_page": per_page, "page": page, "status": "publish"}
    if end_date:
        params["end_date"] = end_date
    resp = requests.get(api_base, params=params, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    return resp.json()


def crawl_location(
    source_id: int, location: dict
) -> tuple[int, int, int]:
    """Crawl a single Reformation Brewery location via TEC API."""
    api_base = location["api_base"]
    place_data = location["place"]

    events_found = 0
    events_new = 0
    events_updated = 0

    place_id = get_or_create_place(place_data)
    location_name = place_data["name"]

    page = 1
    per_page = 50
    end_date = (datetime.now() + timedelta(days=CRAWL_WINDOW_DAYS)).strftime("%Y-%m-%d")

    while True:
        try:
            data = fetch_events_page(api_base, page=page, per_page=per_page, end_date=end_date)
        except requests.RequestException as e:
            logger.error(f"Failed to fetch {location_name} page {page}: {e}")
            break

        raw_events = data.get("events", [])
        total_pages = data.get("total_pages", 1)

        logger.info(
            f"{location_name}: page {page}/{total_pages}, "
            f"{len(raw_events)} events"
        )

        for ev in raw_events:
            title = strip_html(ev.get("title", "")).strip()
            if not title:
                continue

            start_raw = ev.get("start_date", "")
            end_raw = ev.get("end_date", "")

            try:
                start_dt = datetime.strptime(start_raw, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                logger.warning(f"Bad start_date '{start_raw}' for '{title}' — skipping")
                continue

            # Skip past events
            if start_dt.date() < datetime.now().date():
                continue

            start_date = start_dt.strftime("%Y-%m-%d")
            start_time = start_dt.strftime("%H:%M")

            end_date = None
            end_time = None
            if end_raw:
                try:
                    end_dt = datetime.strptime(end_raw, "%Y-%m-%d %H:%M:%S")
                    end_date = end_dt.strftime("%Y-%m-%d")
                    end_time = end_dt.strftime("%H:%M")
                except ValueError:
                    pass

            is_all_day = ev.get("all_day", False)
            if is_all_day:
                start_time = None
                end_time = None

            # Cost / pricing
            cost_details = ev.get("cost_details", {})
            cost_values = cost_details.get("values", [])
            cost_str = ev.get("cost", "")
            price_min: Optional[float] = None
            price_max: Optional[float] = None
            is_free = False

            if cost_values:
                nums = [float(v) for v in cost_values if v is not None]
                if nums:
                    price_min = min(nums)
                    price_max = max(nums)
                    is_free = price_min == 0
            elif cost_str:
                if re.search(r"\bfree\b", cost_str, re.IGNORECASE):
                    is_free = True
                else:
                    found = re.findall(r"\d+\.?\d*", cost_str)
                    if found:
                        nums = [float(x) for x in found]
                        price_min = min(nums)
                        price_max = max(nums)

            image_url = None
            image_data = ev.get("image")
            if image_data and isinstance(image_data, dict):
                image_url = image_data.get("url")

            source_url = ev.get("url", api_base)
            description = strip_html(ev.get("description", ""))

            # Determine is_recurring from event slug — TEC recurring events
            # share a slug and get unique dated URLs
            slug = ev.get("slug", "")
            is_recurring = bool(re.search(r"/(20\d{2}-\d{2}-\d{2})/?$", source_url))

            events_found += 1
            content_hash = generate_content_hash(title, location_name, start_date)

            event_record = {
                "source_id": source_id,
                "place_id": place_id,
                "title": title,
                "description": description or f"{title} at {location_name}",
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": is_all_day,
                "category": "food_drink",
                "tags": SHARED_TAGS + [place_data["city"].lower()],
                "price_min": price_min,
                "price_max": price_max,
                "price_note": cost_str or None,
                "is_free": is_free,
                "source_url": source_url,
                "ticket_url": source_url,
                "image_url": image_url,
                "raw_text": f"{title} - {start_date}",
                "extraction_confidence": 0.92,
                "is_recurring": is_recurring,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            series_hint = None
            if is_recurring:
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "frequency": "weekly",
                }

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info(f"Added: {title} on {start_date} @ {location_name}")
            except Exception as e:
                logger.error(f"Failed to insert '{title}': {e}")

        if page >= total_pages:
            break
        page += 1

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl all three Reformation Brewery locations."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    for location in LOCATIONS:
        try:
            found, new, updated = crawl_location(source_id, location)
            total_found += found
            total_new += new
            total_updated += updated
        except Exception as e:
            logger.error(f"Failed to crawl {location['place']['name']}: {e}")

    logger.info(
        f"Reformation Brewery crawl complete: {total_found} found, "
        f"{total_new} new, {total_updated} updated"
    )
    return total_found, total_new, total_updated
