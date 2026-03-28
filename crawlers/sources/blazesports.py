"""
Crawler for BlazeSports America (blazesports.org).

BlazeSports publishes events via The Events Calendar. The official JSON API
includes recurring instances directly, along with structured venue, image, and
category data. This crawler uses that API instead of the older first-page HTML
scrape so adaptive sports programs are surfaced consistently.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

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

BASE_URL = "https://blazesports.org"
API_URL = f"{BASE_URL}/wp-json/tribe/events/v1/events"
PER_PAGE = 50
HORIZON_DAYS = 120


def _text_from_html(value: str) -> str:
    return " ".join(BeautifulSoup(value or "", "html.parser").get_text(" ").split())


def _extract_price_range(cost_text: str) -> tuple[Optional[float], Optional[float], bool]:
    if not cost_text:
        return None, None, False

    text = cost_text.strip()
    if text.lower() == "free":
        return 0.0, 0.0, True

    prices: list[float] = []
    for token in text.replace("$", " $").split():
        if token.startswith("$"):
            try:
                prices.append(float(token[1:].replace(",", "")))
            except ValueError:
                continue

    if not prices:
        return None, None, False

    return min(prices), max(prices), all(price == 0 for price in prices)


def build_venue_data(api_venue: dict | None) -> dict:
    if not api_venue:
        return {
            "name": "BlazeSports America",
            "slug": "blazesports-america",
            "address": "1670 Oakbrook Dr, Suite 331",
            "neighborhood": "Norcross",
            "city": "Norcross",
            "state": "GA",
            "zip": "30093",
            "venue_type": "organization",
            "spot_type": "organization",
            "website": BASE_URL,
            "description": "Adaptive sports organization serving metro Atlanta.",
        }

    city = api_venue.get("city") or ""
    return {
        "name": api_venue.get("venue") or "BlazeSports America",
        "slug": api_venue.get("slug") or "blazesports-america",
        "address": api_venue.get("address") or "",
        "neighborhood": city or "Metro Atlanta",
        "city": city or "Atlanta",
        "state": api_venue.get("state") or "GA",
        "zip": api_venue.get("zip") or "",
        "venue_type": "fitness_center",
        "spot_type": "fitness",
        "website": api_venue.get("url") or BASE_URL,
        "description": "Venue hosting BlazeSports adaptive sports programming.",
    }


def categorize_event(title: str, description: str, category_slugs: list[str]) -> tuple[str, str, list[str]]:
    text = f"{title} {description}".lower()
    tags = ["adaptive-sports", "accessible", "family-friendly"]

    for slug in category_slugs:
        if slug and slug not in tags:
            tags.append(slug)

    if "veteran" in text:
        tags.append("veterans")

    if "wheelchair" in text:
        tags.append("wheelchair-sports")

    if any(slug in category_slugs for slug in ("yoga", "crossfit", "water-aerobics")):
        tags.append("community")
        return "fitness", "adaptive_fitness", tags

    if any(slug in category_slugs for slug in ("swimming", "learn-to-swim", "swim")) or "swim" in text:
        tags.append("swimming")
        return "sports", "swimming", tags

    if "rowing" in category_slugs or "rowing" in text:
        tags.append("rowing")
        return "sports", "rowing", tags

    if "bowling" in category_slugs or "bowling" in text:
        tags.append("bowling")
        return "sports", "bowling", tags

    if "track" in text or "field" in text:
        tags.append("track-and-field")
        return "sports", "track_field", tags

    if "basketball" in text or "ballers" in text:
        tags.append("basketball")
        return "sports", "basketball", tags

    if "archery" in text:
        tags.append("archery")
        return "sports", "archery", tags

    if "indoor sports" in text:
        tags.append("multi-sport")
        return "sports", "pickup_sports", tags

    if "train" in text or "clinic" in text or "camp" in text:
        tags.append("training")
        return "sports", "training", tags

    tags.append("community")
    return "sports", "adaptive_sports", tags


def parse_api_event(event: dict) -> Optional[dict]:
    title = (event.get("title") or "").strip()
    start_date_raw = event.get("start_date")
    end_date_raw = event.get("end_date")
    if not title or not start_date_raw:
        return None

    start_dt = datetime.strptime(start_date_raw, "%Y-%m-%d %H:%M:%S")
    end_dt = (
        datetime.strptime(end_date_raw, "%Y-%m-%d %H:%M:%S")
        if end_date_raw
        else None
    )

    description_text = _text_from_html(event.get("description") or "")
    place_data = build_venue_data(event.get("venue"))
    category_slugs = [
        category.get("slug")
        for category in (event.get("categories") or [])
        if category.get("slug")
    ]
    category, subcategory, tags = categorize_event(title, description_text, category_slugs)
    price_min, price_max, is_free = _extract_price_range(event.get("cost") or "")

    return {
        "title": title,
        "description": description_text,
        "start_date": start_dt.strftime("%Y-%m-%d"),
        "start_time": start_dt.strftime("%H:%M"),
        "end_time": end_dt.strftime("%H:%M") if end_dt else None,
        "venue_data": place_data,
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
        "price_min": price_min,
        "price_max": price_max,
        "is_free": is_free,
        "price_note": event.get("cost") or None,
        "source_url": event.get("url") or BASE_URL,
        "ticket_url": event.get("website") or event.get("url") or BASE_URL,
        "image_url": ((event.get("image") or {}).get("url") or None),
        "raw_text": description_text,
    }


def _fetch_events(start_date: str, end_date: str) -> list[dict]:
    events: list[dict] = []
    page = 1
    total_pages = 1

    while page <= total_pages:
        response = requests.get(
            API_URL,
            params={
                "start_date": start_date,
                "end_date": end_date,
                "per_page": PER_PAGE,
                "page": page,
            },
            headers={"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"},
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        total_pages = payload.get("total_pages", 1)
        events.extend(payload.get("events", []))
        page += 1

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    today = datetime.now().date()
    start_date = f"{today.isoformat()} 00:00:00"
    end_date = f"{(today + timedelta(days=HORIZON_DAYS)).isoformat()} 23:59:59"

    try:
        api_events = _fetch_events(start_date, end_date)
    except Exception as exc:
        logger.error("Failed to fetch BlazeSports API events: %s", exc)
        return 0, 0, 0

    logger.info("Fetched %s BlazeSports API events through %s", len(api_events), end_date)

    for event in api_events:
        parsed = parse_api_event(event)
        if not parsed:
            continue

        venue_id = get_or_create_place(parsed["venue_data"])
        events_found += 1

        content_hash = generate_content_hash(
            parsed["title"],
            parsed["venue_data"]["name"],
            parsed["start_date"],
        )
        current_hashes.add(content_hash)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": parsed["title"],
            "description": parsed["description"],
            "start_date": parsed["start_date"],
            "start_time": parsed["start_time"],
            "end_date": None,
            "end_time": parsed["end_time"],
            "is_all_day": False,
            "category": parsed["category"],
            "subcategory": parsed["subcategory"],
            "tags": parsed["tags"],
            "price_min": parsed["price_min"],
            "price_max": parsed["price_max"],
            "price_note": parsed["price_note"],
            "is_free": parsed["is_free"],
            "source_url": parsed["source_url"],
            "ticket_url": parsed["ticket_url"],
            "image_url": parsed["image_url"],
            "raw_text": parsed["raw_text"],
            "extraction_confidence": 0.97,
            "is_recurring": False,
            "recurrence_rule": None,
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
        logger.info("Removed %s stale BlazeSports rows after API refresh", stale_removed)

    logger.info(
        "BlazeSports crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
