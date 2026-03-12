"""
Crawler for Cobb Galleria Centre public events (cobbgalleria.com/events).

The official calendar is server-rendered as event cards with explicit dates,
titles, descriptions, and outbound organizer links. This source should own the
long-tail trade shows and public expos that do not already have stronger
dedicated crawlers.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_venue,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://cobbgalleria.com"
EVENTS_URL = f"{BASE_URL}/events"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

VENUE_DATA = {
    "name": "Cobb Convention Center-Atlanta",
    "slug": "cobb-convention-center",
    "address": "2 Galleria Pkwy SE",
    "neighborhood": "Cumberland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "lat": 33.8853,
    "lng": -84.4647,
    "venue_type": "convention_center",
    "spot_type": "convention_center",
    "website": BASE_URL,
}

DEDICATED_SOURCE_TITLES = {
    "atlanta home show",
    "the blade show",
    "front row card show",
    "importexpo car show",
    "southern-fried gaming expo",
    "critical materials & minerals expo 2026 (north america)",
}

TAG_KEYWORDS = {
    "expo": "expo",
    "show": "show",
    "tradeshow": "trade-show",
    "trade show": "trade-show",
    "home": "home",
    "card": "collectibles",
    "gaming": "gaming",
    "knife": "collectibles",
    "minerals": "minerals",
    "materials": "industry",
    "car": "cars",
}


def normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", (title or "").strip())


def should_skip_dedicated_event(title: str) -> bool:
    return normalize_title(title).lower() in DEDICATED_SOURCE_TITLES


def parse_date_parts(month_text: str, day_text: str, year_text: str) -> tuple[str, Optional[str]]:
    """Parse Cobb calendar date blocks such as 'March' + '20-22' + '2026'."""
    month = datetime.strptime(month_text[:3], "%b").month
    year = int(year_text)

    if "-" not in day_text:
        start_date = date(year, month, int(day_text))
        return start_date.isoformat(), None

    start_day_str, end_day_str = day_text.split("-", 1)
    start_day = int(start_day_str)
    end_day = int(end_day_str)

    start_date = date(year, month, start_day)
    end_month = month + 1 if end_day < start_day else month
    end_year = year
    if end_month == 13:
        end_month = 1
        end_year += 1
    end_date = date(end_year, end_month, end_day)
    return start_date.isoformat(), end_date.isoformat()


def parse_time_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse a simple '5 to 10 p.m.' or '10 a.m. to 6 p.m.' range."""
    cleaned = re.sub(r"\s+", " ", (text or "").strip().lower())
    shorthand_match = re.search(
        r"(\d{1,2})(?::(\d{2}))?\s*to\s*(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)",
        cleaned,
    )
    if shorthand_match:
        start_hour, start_minute, end_hour, end_minute, end_period = shorthand_match.groups()
        normalized_end = end_period.replace(".", "")
        inferred_start = normalized_end
        if normalized_end == "pm" and int(start_hour) > int(end_hour):
            inferred_start = "am"
        return (
            _to_24h(start_hour, start_minute or "00", inferred_start),
            _to_24h(end_hour, end_minute or "00", normalized_end),
        )

    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)\s*to\s*(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)",
        cleaned,
    )
    if not match:
        return None, None

    start_hour, start_minute, start_period, end_hour, end_minute, end_period = match.groups()
    return (
        _to_24h(start_hour, start_minute or "00", start_period),
        _to_24h(end_hour, end_minute or "00", end_period),
    )


def _to_24h(hour: str, minute: str, period: str) -> str:
    value = int(hour)
    normalized = period.replace(".", "")
    if normalized == "pm" and value != 12:
        value += 12
    if normalized == "am" and value == 12:
        value = 0
    return f"{value:02d}:{minute}"


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def choose_external_url(excerpt: BeautifulSoup) -> Optional[str]:
    for anchor in excerpt.select("a[href]"):
        href = (anchor.get("href") or "").strip()
        if not href or href.startswith("mailto:"):
            continue
        lowered = href.lower()
        if any(domain in lowered for domain in ("facebook.com", "instagram.com", "bsky.app", "twitter.com", "x.com")):
            continue
        return href
    return None


def infer_category(title: str, description: str) -> str:
    text = f"{title} {description}".lower()
    if any(token in text for token in ("home show", "expo", "trade show", "tradeshow", "collector", "convention")):
        return "community"
    if any(token in text for token in ("car show", "importexpo")):
        return "community"
    return "community"


def infer_tags(title: str, description: str) -> list[str]:
    text = f"{title} {description}".lower()
    tags = ["cobb-galleria", "convention-center"]
    for keyword, tag in TAG_KEYWORDS.items():
        if keyword in text and tag not in tags:
            tags.append(tag)
    return tags


def parse_event_cards(html_text: str, today: date | None = None) -> list[dict]:
    today = today or datetime.now().date()
    soup = BeautifulSoup(html_text, "html.parser")
    events: list[dict] = []

    for item in soup.select(".item[data-event-id]"):
        title_el = item.select_one(".title h4")
        excerpt_el = item.select_one(".excerpt")
        month_el = item.select_one(".date .month")
        day_el = item.select_one(".date .day")
        year_el = item.select_one(".date .year")

        if not title_el or not excerpt_el or not month_el or not day_el or not year_el:
            continue

        title = normalize_title(title_el.get_text(" ", strip=True))
        if not title or should_skip_dedicated_event(title):
            continue

        start_date, end_date = parse_date_parts(
            month_el.get_text(" ", strip=True),
            day_el.get_text(" ", strip=True),
            year_el.get_text(" ", strip=True),
        )
        if datetime.strptime(start_date, "%Y-%m-%d").date() < today:
            continue

        description = clean_text(excerpt_el.get_text(" ", strip=True))
        first_line = clean_text(excerpt_el.get_text("\n", strip=True).split("\n", 1)[0])
        start_time, end_time = parse_time_range(first_line)
        external_url = choose_external_url(excerpt_el)
        image_url = None
        image_container = item.select_one(".image")
        if image_container:
            style = image_container.get("style") or ""
            match = re.search(r"url\(([^)]+)\)", style)
            if match:
                image_url = match.group(1).strip().strip("'\"")

        event_id = item.get("data-event-id")
        source_url = f"{EVENTS_URL}#{event_id}" if event_id else EVENTS_URL

        events.append(
            {
                "title": title,
                "start_date": start_date,
                "end_date": end_date,
                "start_time": start_time,
                "end_time": end_time,
                "is_all_day": start_time is None,
                "description": description[:1000],
                "source_url": source_url,
                "ticket_url": external_url,
                "image_url": image_url,
            }
        )

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the public Cobb Galleria Centre events calendar."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    response = requests.get(
        EVENTS_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    response.raise_for_status()

    events = parse_event_cards(response.text)
    if not events:
        raise ValueError("Cobb Galleria public events page did not yield any future non-dedicated events")

    venue_id = get_or_create_venue(VENUE_DATA)

    for event in events:
        title = event["title"]
        content_hash = generate_content_hash(title, VENUE_DATA["name"], event["start_date"])
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": event["description"],
            "start_date": event["start_date"],
            "start_time": event["start_time"],
            "end_date": event["end_date"],
            "end_time": event["end_time"],
            "is_all_day": event["is_all_day"],
            "category": infer_category(title, event["description"]),
            "subcategory": "expo",
            "tags": infer_tags(title, event["description"]),
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": False,
            "source_url": event["source_url"],
            "ticket_url": event["ticket_url"],
            "image_url": event["image_url"],
            "raw_text": f"{title} | {event['start_date']} | {event['description']}",
            "extraction_confidence": 0.93,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
        else:
            insert_event(event_record)
            events_new += 1

    removed = remove_stale_source_events(source_id, current_hashes)
    logger.info("Removed %s stale Cobb Galleria events", removed)
    logger.info(
        "Cobb Galleria crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
