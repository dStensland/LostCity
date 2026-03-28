"""
Crawler for Georgia International Convention Center (gicc.com).

Official source:
- The events archive exposes paginated Event JSON-LD with clean date ranges,
  titles, descriptions, and detail URLs.

This is intentionally deterministic because the previous body-text scraper
captured archive chrome like "This Month" instead of real events.
"""

from __future__ import annotations

import html
import json
import logging
import re
from datetime import date, datetime, time
from typing import Optional
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

BASE_URL = "https://www.gicc.com"
EVENTS_URL = f"{BASE_URL}/events/list/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"
MAX_PAGES = 10
MAX_EVENT_LEAD_DAYS = 270

PLACE_DATA = {
    "name": "Georgia International Convention Center",
    "slug": "georgia-international-convention-center",
    "address": "2000 Convention Center Concourse",
    "neighborhood": "College Park",
    "city": "College Park",
    "state": "GA",
    "zip": "30337",
    "lat": 33.6389,
    "lng": -84.4483,
    "place_type": "convention_center",
    "spot_type": "convention_center",
    "website": BASE_URL,
}

TAG_KEYWORDS = {
    "conference": "conference",
    "conferences": "conference",
    "expo": "expo",
    "show": "show",
    "shows": "show",
    "market": "market",
    "markets": "market",
    "summit": "summit",
    "championship": "sports",
    "championships": "sports",
    "tournament": "sports",
    "tournaments": "sports",
    "nationals": "sports",
    "cheer": "cheerleading",
    "dance": "dance",
    "gymnast": "gymnastics",
    "volleyball": "volleyball",
    "jiu-jitsu": "martial-arts",
    "tcg": "gaming",
    "technology": "technology",
    "pet": "pets",
    "groom": "grooming",
    "rv": "rv",
    "commencement": "graduation",
}

DEDICATED_SOURCE_TITLES = {
    "groom’d",
    "groom'd",
    "okecon tcg",
    "smu steel summit",
    "the georgia educational technology conference",
    "georgia educational technology conference",
}


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    text = BeautifulSoup(html.unescape(value), "html.parser").get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def _parse_event_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    normalized = value.strip().replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def _is_all_day_event(start_dt: datetime, end_dt: datetime) -> bool:
    end_time = end_dt.timetz().replace(tzinfo=None)
    return start_dt.timetz().replace(tzinfo=None) == time(0, 0) and end_time in {
        time(23, 59),
        time(23, 59, 59),
        time(0, 0),
    }


def _contains_keyword(text: str, keyword: str) -> bool:
    pattern = rf"(?<![a-z0-9]){re.escape(keyword)}(?![a-z0-9])"
    return re.search(pattern, text) is not None


def infer_subcategory(title: str, description: str) -> Optional[str]:
    text = f"{title} {description}".lower()
    if any(_contains_keyword(text, keyword) for keyword in ("conference", "summit", "forum")):
        return "conference"
    if any(_contains_keyword(text, keyword) for keyword in ("expo", "show", "market", "convention")):
        return "expo"
    return None


def infer_tags(title: str, description: str) -> list[str]:
    text = f"{title} {description}".lower()
    tags = ["convention-center"]
    for keyword, tag in TAG_KEYWORDS.items():
        if _contains_keyword(text, keyword) and tag not in tags:
            tags.append(tag)
    return tags


def parse_event_feed_page(html_text: str, today: date | None = None) -> tuple[list[dict], Optional[str]]:
    """Parse one official GICC event archive page and its next-page link."""
    today = today or datetime.now().date()
    soup = BeautifulSoup(html_text, "html.parser")

    next_url = None
    for anchor in soup.find_all("a", href=True):
        if anchor.get_text(" ", strip=True) == "Next Events":
            next_url = urljoin(BASE_URL, anchor["href"])
            break

    events: list[dict] = []

    for script in soup.select('script[type="application/ld+json"]'):
        raw = script.string or script.get_text()
        if not raw.strip():
            continue

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue

        if not isinstance(payload, list):
            continue

        for item in payload:
            if not isinstance(item, dict) or item.get("@type") != "Event":
                continue

            title = _clean_text(item.get("name"))
            description = _clean_text(item.get("description"))
            if not title or title.lower() == "this month":
                continue
            if title.lower() in DEDICATED_SOURCE_TITLES:
                continue

            start_dt = _parse_event_datetime(item.get("startDate"))
            end_dt = _parse_event_datetime(item.get("endDate")) or start_dt
            if not start_dt or not end_dt:
                continue
            if end_dt.date() < today:
                continue
            if (start_dt.date() - today).days > MAX_EVENT_LEAD_DAYS:
                continue

            is_all_day = _is_all_day_event(start_dt, end_dt)
            same_day = start_dt.date() == end_dt.date()

            events.append(
                {
                    "title": title,
                    "description": description or "Event at Georgia International Convention Center",
                    "start_date": start_dt.date().isoformat(),
                    "start_time": None if is_all_day else start_dt.strftime("%H:%M"),
                    "end_date": None if same_day else end_dt.date().isoformat(),
                    "end_time": None if is_all_day else end_dt.strftime("%H:%M"),
                    "is_all_day": is_all_day,
                    "source_url": item.get("url"),
                    "ticket_url": item.get("url"),
                    "subcategory": infer_subcategory(title, description),
                    "tags": infer_tags(title, description),
                    "raw_text": (
                        f"{title} | {start_dt.isoformat()} | {end_dt.isoformat()} | "
                        f"{description or 'GICC archive event'}"
                    ),
                }
            )

    return events, next_url


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia International Convention Center events from the official archive."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    venue_id = get_or_create_place(PLACE_DATA)
    page_url = EVENTS_URL
    seen_pages: set[str] = set()
    seen_event_keys: set[tuple[str, str]] = set()
    parsed_events: list[dict] = []

    while page_url and page_url not in seen_pages and len(seen_pages) < MAX_PAGES:
        seen_pages.add(page_url)
        logger.info("Fetching GICC events page: %s", page_url)

        response = requests.get(
            page_url,
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        response.raise_for_status()

        page_events, next_url = parse_event_feed_page(response.text)
        for event in page_events:
            event_key = (event["title"], event["start_date"])
            if event_key in seen_event_keys:
                continue
            seen_event_keys.add(event_key)
            parsed_events.append(event)

        page_url = next_url

    if not parsed_events:
        raise ValueError("GICC official event archive did not yield any future events")

    for event in parsed_events:
        title = event["title"]
        content_hash = generate_content_hash(title, PLACE_DATA["name"], event["start_date"])
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": event["description"],
            "start_date": event["start_date"],
            "start_time": event["start_time"],
            "end_date": event["end_date"],
            "end_time": event["end_time"],
            "is_all_day": event["is_all_day"],
            "category": "community",
            "subcategory": event["subcategory"],
            "tags": event["tags"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": False,
            "source_url": event["source_url"],
            "ticket_url": event["ticket_url"],
            "image_url": None,
            "raw_text": event["raw_text"],
            "extraction_confidence": 0.93,
            "content_hash": content_hash,
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
        else:
            insert_event(event_record)
            events_new += 1

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale GICC events after refresh", stale_removed)

    logger.info(
        "GICC crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
