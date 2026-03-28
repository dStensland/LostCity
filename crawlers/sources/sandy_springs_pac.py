"""
Crawler for Sandy Springs Performing Arts Center (sandyspringspac.com).

The site exposes server-rendered event cards and detail pages, so the crawler
should parse that structure directly instead of scraping noisy page text.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_place, insert_event, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.sandyspringspac.com"
EVENTS_URL = f"{BASE_URL}/events"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}

PLACE_DATA = {
    "name": "Sandy Springs Performing Arts Center",
    "slug": "sandy-springs-pac",
    "address": "1 Galambos Way",
    "neighborhood": "City Springs",
    "city": "Sandy Springs",
    "state": "GA",
    "zip": "30328",
    "lat": 33.9287,
    "lng": -84.3789,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7 PM' format."""
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    period = match.group(3).lower()
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def parse_date_range(date_text: str, now: Optional[datetime] = None) -> tuple[Optional[str], Optional[str]]:
    """Parse list/detail date text into start and end dates."""
    now = now or datetime.now()
    cleaned = " ".join(date_text.split()).replace("–", "-").replace(" ,", ",").strip()
    if not cleaned:
        return None, None

    single_match = re.search(
        r"^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$",
        cleaned,
        re.IGNORECASE,
    )
    if single_match:
        month, day, year = single_match.groups()
        event_year = int(year) if year else now.year
        start = datetime.strptime(f"{month[:3]} {day} {event_year}", "%b %d %Y")
        return start.strftime("%Y-%m-%d"), start.strftime("%Y-%m-%d")

    cross_month_range = re.search(
        r"^([A-Za-z]+)\s+(\d{1,2})\s*-\s*([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$",
        cleaned,
        re.IGNORECASE,
    )
    if cross_month_range:
        start_month, start_day, end_month, end_day, year = cross_month_range.groups()
        event_year = int(year) if year else now.year
        start = datetime.strptime(f"{start_month[:3]} {start_day} {event_year}", "%b %d %Y")
        end = datetime.strptime(f"{end_month[:3]} {end_day} {event_year}", "%b %d %Y")
        if end < start:
            end = end.replace(year=end.year + 1)
        return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")

    same_month_range = re.search(
        r"^([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2})(?:,\s*(\d{4}))?$",
        cleaned,
        re.IGNORECASE,
    )
    if same_month_range:
        month, start_day, end_day, year = same_month_range.groups()
        event_year = int(year) if year else now.year
        start = datetime.strptime(f"{month[:3]} {start_day} {event_year}", "%b %d %Y")
        end = datetime.strptime(f"{month[:3]} {end_day} {event_year}", "%b %d %Y")
        return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")

    logger.warning("Could not parse Sandy Springs PAC date text: %s", date_text)
    return None, None


def extract_detail_fields(soup: BeautifulSoup) -> dict[str, str]:
    """Map sidebar detail labels to values."""
    fields: dict[str, str] = {}
    for item in soup.select(".eventDetailList .item"):
        label = item.select_one(".label")
        value = item.find("span")
        if not label or not value:
            continue
        key = " ".join(label.get_text(" ", strip=True).split())
        val = " ".join(value.get_text(" ", strip=True).split())
        if key and val:
            fields[key] = val
    return fields


def determine_category(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on the event title/description."""
    text = f"{title} {description}".lower()
    tags = ["sandy-springs", "city-springs", "performing-arts"]

    if any(word in text for word in ["film festival", "screening", "cinema", "movie"]):
        return "film", "screening", tags + ["film"]
    if any(word in text for word in ["meditation", "sound bath", "pilates", "wellness", "yoga"]):
        return "wellness", None, tags + ["wellness"]
    if any(word in text for word in ["live", "concert", "symphony", "music", "orchestra"]):
        return "music", "live", tags + ["music"]
    if any(word in text for word in ["play", "musical", "theatre", "theater"]):
        return "theater", None, tags + ["theater"]

    return "community", None, tags


def parse_detail_page(detail_url: str) -> Optional[dict]:
    """Fetch and parse a Sandy Springs PAC detail page."""
    response = requests.get(detail_url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    description_node = soup.select_one(".event_description")
    description = description_node.get_text(" ", strip=True) if description_node else ""
    fields = extract_detail_fields(soup)

    ticket_link = soup.select_one(".details .buttons a.tickets[href]")
    ticket_url = None
    if ticket_link:
        href = ticket_link.get("href", "").strip()
        if href and href != "/events":
            ticket_url = urljoin(detail_url, href)

    image_node = soup.select_one(".hero_img img, .hero img, meta[property='og:image']")
    image_url = None
    if image_node:
        image_url = image_node.get("content") or image_node.get("src")
        if image_url:
            image_url = urljoin(detail_url, image_url)

    return {
        "description": description,
        "fields": fields,
        "ticket_url": ticket_url,
        "image_url": image_url,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Sandy Springs Performing Arts Center events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)

    response = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    for card in soup.select(".eventItem"):
        title_link = card.select_one(".title a[href]")
        if not title_link:
            continue

        title = title_link.get_text(" ", strip=True)
        if not title or title.lower() == "calendar":
            continue

        detail_url = urljoin(EVENTS_URL, title_link.get("href", ""))
        date_text = card.select_one(".date")
        listing_date_text = date_text.get_text(" ", strip=True) if date_text else ""
        image_node = card.select_one("img[src]")
        fallback_image = urljoin(EVENTS_URL, image_node.get("src")) if image_node else None

        detail = parse_detail_page(detail_url)
        if not detail:
            continue

        fields = detail["fields"]
        start_date, end_date = parse_date_range(fields.get("Date", listing_date_text))
        if not start_date:
            continue

        start_time = parse_time(fields.get("Event Starts", ""))
        description = detail["description"] or f"Event at {PLACE_DATA['name']}"
        category, subcategory, tags = determine_category(title, description)

        events_found += 1
        content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date,
            "end_time": None,
            "is_all_day": start_time is None,
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": False,
            "source_url": detail_url,
            "ticket_url": detail["ticket_url"],
            "image_url": detail["image_url"] or fallback_image,
            "raw_text": f"{title} | {fields.get('Date', listing_date_text)}",
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
            logger.info("Added Sandy Springs PAC event: %s on %s", title, start_date)
        except Exception as exc:
            logger.error("Failed to insert Sandy Springs PAC event %s: %s", title, exc)

    logger.info(
        "Sandy Springs Performing Arts Center crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
