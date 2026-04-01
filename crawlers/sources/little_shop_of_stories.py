"""
Crawler for Little Shop of Stories (littleshopofstories.com/events).
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Any, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.littleshopofstories.com"
EVENTS_URL = f"{BASE_URL}/events"

PLACE_DATA = {
    "name": "Little Shop of Stories",
    "slug": "little-shop-of-stories",
    "address": "133A E Court Square",
    "neighborhood": "Downtown Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7754,
    "lng": -84.2958,
    "place_type": "bookstore",
    "website": BASE_URL,
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
    )
}


def _normalize_text(value: str | None) -> str:
    return " ".join((value or "").split())


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


def _parse_date(date_text: str) -> Optional[str]:
    cleaned = _normalize_text(date_text).replace("Date:", "").strip()
    for fmt in ("%a, %m/%d/%Y", "%A, %m/%d/%Y"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_event_articles(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict[str, Any]] = []

    for article in soup.select("article.event-list"):
        title_link = article.select_one("h3.event-list__title a")
        if not title_link:
            continue

        title = _normalize_text(title_link.get_text(" ", strip=True))
        if not title:
            continue

        details: dict[str, str] = {}
        for item in article.select(".event-list__details--item"):
            label_node = item.select_one(".event-list__details--label")
            if not label_node:
                continue
            label = _normalize_text(label_node.get_text(" ", strip=True)).rstrip(":").lower()
            label_node.extract()
            details[label] = _normalize_text(item.get_text(" ", strip=True))

        start_date = _parse_date(details.get("date", ""))
        if not start_date:
            continue

        time_text = details.get("time", "")
        time_match = re.search(
            r"(\d{1,2}:\d{2}\s*[ap]m)(?:\s*-\s*(\d{1,2}:\d{2}\s*[ap]m))?",
            time_text,
            re.IGNORECASE,
        )
        start_time = parse_time(time_match.group(1)) if time_match else None
        end_time = parse_time(time_match.group(2)) if time_match and time_match.group(2) else None

        image_node = article.select_one(".event-list__image img")
        rsvp_link = article.select_one("a.event-list__links--rsvp")
        event_url = urljoin(BASE_URL, title_link.get("href") or EVENTS_URL)

        rows.append(
            {
                "title": title,
                "description": _normalize_text(
                    article.select_one(".event-list__body").get_text(" ", strip=True)
                    if article.select_one(".event-list__body")
                    else ""
                )
                or None,
                "start_date": start_date,
                "start_time": start_time,
                "end_time": end_time,
                "source_url": event_url,
                "ticket_url": rsvp_link.get("href") if rsvp_link else event_url,
                "image_url": urljoin(BASE_URL, image_node.get("src")) if image_node else None,
                "tags": [
                    _normalize_text(tag.get_text(" ", strip=True)).lower()
                    for tag in article.select(".event-tag__term a")
                    if _normalize_text(tag.get_text(" ", strip=True))
                ],
            }
        )

    return rows


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Little Shop of Stories events from Drupal event-list articles."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        logger.info(f"Fetching Little Shop of Stories: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()

        for parsed in _parse_event_articles(response.text):
            events_found += 1
            content_hash = generate_content_hash(
                parsed["title"], PLACE_DATA["name"], parsed["start_date"]
            )
            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": parsed["title"],
                "description": parsed["description"],
                "start_date": parsed["start_date"],
                "start_time": parsed["start_time"],
                "end_date": None,
                "end_time": parsed["end_time"],
                "is_all_day": False,
                "category": "words",
                "subcategory": None,
                "tags": sorted(
                    {
                        "books",
                        "children",
                        "family",
                        "decatur",
                        *parsed["tags"],
                    }
                ),
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": parsed["source_url"],
                "ticket_url": parsed["ticket_url"],
                "image_url": parsed["image_url"],
                "raw_text": f"{parsed['title']} - {parsed['start_date']}",
                "extraction_confidence": 0.95,
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
                logger.info(f"Added: {parsed['title']} on {parsed['start_date']}")
            except Exception as e:
                logger.error(f"Failed to insert: {parsed['title']}: {e}")

        logger.info(
            f"Little Shop of Stories crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Little Shop of Stories: {e}")
        raise

    return events_found, events_new, events_updated
