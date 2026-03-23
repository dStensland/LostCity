"""
Crawler for Gas South District events (gassouthdistrict.com).

The public event calendar is server-rendered and exposes structured event cards
with date ranges, venue labels, times, and detail URLs. This source should
cover non-team district events such as conventions, expos, theater bookings,
and specialty shows without relying on brittle body-text parsing.
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

BASE_URL = "https://www.gassouthdistrict.com"
EVENTS_URL = f"{BASE_URL}/events"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

VENUE_DATA_BY_LABEL = {
    "gas south arena": {
        "name": "Gas South Arena",
        "slug": "gas-south-arena",
        "address": "6400 Sugarloaf Pkwy",
        "city": "Duluth",
        "state": "GA",
        "zip": "30097",
        "lat": 33.9618,
        "lng": -84.0965,
        "venue_type": "arena",
        "spot_type": "arena",
        "website": "https://www.gassouthdistrict.com/arena",
    },
    "gas south convention center": {
        "name": "Gas South Convention Center",
        "slug": "gas-south-convention-center",
        "address": "6400 Sugarloaf Pkwy",
        "city": "Duluth",
        "state": "GA",
        "zip": "30097",
        "lat": 33.9618,
        "lng": -84.0965,
        "venue_type": "convention_center",
        "spot_type": "convention_center",
        "website": "https://www.gassouthdistrict.com/convention-center",
    },
    "gas south theater": {
        "name": "Gas South Theater",
        "slug": "gas-south-theater",
        "address": "6400 Sugarloaf Pkwy",
        "city": "Duluth",
        "state": "GA",
        "zip": "30097",
        "lat": 33.9618,
        "lng": -84.0965,
        "venue_type": "theater",
        "spot_type": "theater",
        "website": "https://www.gassouthdistrict.com/theater",
    },
    "hudgens center for art & learning": {
        "name": "Hudgens Center for Art & Learning",
        "slug": "hudgens-center-for-art-and-learning",
        "address": "6400 Sugarloaf Pkwy",
        "city": "Duluth",
        "state": "GA",
        "zip": "30097",
        "lat": 33.9618,
        "lng": -84.0965,
        "venue_type": "arts_center",
        "spot_type": "arts_center",
        "website": "https://www.hudgens.org/",
    },
}

TEAM_SOURCE_TITLES = {
    "atlanta gladiators",
    "atlanta vibe",
    "georgia swarm",
}

TAG_KEYWORDS = {
    "expo": "expo",
    "show": "show",
    "festival": "festival",
    "market": "market",
    "quilt": "quilting",
    "sewing": "sewing",
    "craft": "crafts",
    "dance": "dance",
    "theater": "theater",
    "tribute": "music",
    "comedy": "comedy",
    "monster": "family",
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM', '7pm', '7:00pm', or '7:00PM'."""
    if not time_text:
        return None

    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if not match:
        return None

    hour, minute, period = match.groups()
    value = int(hour)
    if period.lower() == "pm" and value != 12:
        value += 12
    if period.lower() == "am" and value == 12:
        value = 0
    return f"{value:02d}:{minute or '00'}"


def parse_date_label(date_label: str, today: date | None = None) -> tuple[str, Optional[str]]:
    """Parse Gas South card date labels into ISO dates."""
    today = today or datetime.now().date()
    cleaned = re.sub(r"\s+", " ", (date_label or "").strip())

    range_match = re.match(
        r"([A-Za-z]+)\s+(\d{1,2})\s+to\s+([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})",
        cleaned,
        re.IGNORECASE,
    )
    if range_match:
        start_month, start_day, end_month, end_day, year_str = range_match.groups()
        start_dt = datetime.strptime(f"{start_month[:3]} {start_day} {year_str}", "%b %d %Y")
        end_dt = datetime.strptime(f"{end_month[:3]} {end_day} {year_str}", "%b %d %Y")
        return start_dt.date().isoformat(), end_dt.date().isoformat()

    single_match = re.match(r"([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})", cleaned, re.IGNORECASE)
    if not single_match:
        raise ValueError(f"Could not parse Gas South date label: {date_label}")

    month_name, day_str, year_str = single_match.groups()
    parsed = datetime.strptime(f"{month_name[:3]} {day_str} {year_str}", "%b %d %Y").date()

    # Guard against cards that drop the year, even though the current markup includes it.
    if parsed < today and str(today.year) == year_str and today.month >= 10 and parsed.month <= 3:
        parsed = parsed.replace(year=parsed.year + 1)

    return parsed.isoformat(), None


def normalize_venue_label(label: str) -> str:
    text = re.sub(r"[®™]", "", label or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def venue_data_for_label(label: str) -> dict:
    normalized = normalize_venue_label(label)
    return VENUE_DATA_BY_LABEL.get(normalized, VENUE_DATA_BY_LABEL["gas south arena"])


def should_skip_official_gladiators_event(title: str) -> bool:
    lowered = title.lower().strip()
    return (
        lowered == "atlanta gladiators"
        or lowered.startswith("atlanta gladiators vs")
        or lowered.startswith("gladiators vs ")
    )


def should_skip_dedicated_team_event(title: str) -> bool:
    lowered = title.lower().strip()
    return lowered in TEAM_SOURCE_TITLES or should_skip_official_gladiators_event(title)


def infer_category(title: str, venue_label: str) -> str:
    text = f"{title} {venue_label}".lower()
    if any(token in text for token in ("concert", "tribute", "symphony", "tour")):
        return "music"
    if any(token in text for token in ("comedy", "garage")):
        return "nightlife"
    if any(token in text for token in ("expo", "show", "market", "convention")):
        return "community"
    if any(token in text for token in ("dance", "theater")):
        return "arts"
    return "community"


def infer_tags(title: str, venue_label: str) -> list[str]:
    text = f"{title} {venue_label}".lower()
    tags = ["gas-south", "duluth"]
    for keyword, tag in TAG_KEYWORDS.items():
        if re.search(r'\b' + re.escape(keyword) + r'\b', text) and tag not in tags:
            tags.append(tag)
    normalized_venue = normalize_venue_label(venue_label)
    if "arena" in normalized_venue:
        tags.append("arena")
    elif "convention center" in normalized_venue:
        tags.append("convention-center")
    elif "theater" in normalized_venue:
        tags.append("theater")
    elif "hudgens" in normalized_venue:
        tags.append("arts-center")
    return tags


def clean_description(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return None
    if "gas south district" in cleaned.lower() and len(cleaned) < 80:
        return None
    return cleaned[:1000]


def fetch_detail_description(detail_url: str) -> Optional[str]:
    try:
        response = requests.get(
            detail_url,
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        if response.status_code != 200:
            return None
    except Exception:
        return None

    soup = BeautifulSoup(response.text, "html.parser")
    meta = soup.select_one('meta[name="description"]')
    if meta and meta.get("content"):
        description = clean_description(meta["content"])
        if description and description.lower() != "gas south district":
            return description
    return None


def parse_event_cards(html_text: str, today: date | None = None) -> list[dict]:
    """Extract district event cards from the public events page."""
    today = today or datetime.now().date()
    soup = BeautifulSoup(html_text, "html.parser")
    events: list[dict] = []

    for card in soup.select(".eventItem"):
        title_link = card.select_one("h3.title a")
        if not title_link:
            continue

        title = title_link.get_text(" ", strip=True)
        if not title or should_skip_dedicated_team_event(title):
            continue

        href = title_link.get("href") or ""
        detail_url = href if href.startswith("http") else f"{BASE_URL}{href}"

        location_el = card.select_one(".meta .location")
        date_el = card.select_one(".date")
        time_el = card.select_one(".date .time")
        image_el = card.select_one(".thumb img")
        tagline_el = card.select_one("h4.tagline")

        if not location_el or not date_el:
            continue

        start_date, end_date = parse_date_label(date_el.get("aria-label", ""), today=today)
        if datetime.strptime(start_date, "%Y-%m-%d").date() < today:
            continue

        location_label = location_el.get_text(" ", strip=True)
        start_time = parse_time(time_el.get_text(" ", strip=True)) if time_el else None
        is_all_day = start_time is None
        description = clean_description(tagline_el.get_text(" ", strip=True) if tagline_el else None)
        image_url = image_el.get("src") if image_el else None
        if image_url and not image_url.startswith("http"):
            image_url = f"{BASE_URL}{image_url}"

        events.append(
            {
                "title": title,
                "location_label": location_label,
                "start_date": start_date,
                "end_date": end_date,
                "start_time": start_time,
                "end_time": None,
                "is_all_day": is_all_day,
                "detail_url": detail_url,
                "image_url": image_url,
                "description": description,
            }
        )

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Gas South District events from the official event cards."""
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
        raise ValueError("Gas South District event page did not yield any non-team future events")

    for event in events:
        title = event["title"]
        venue_data = venue_data_for_label(event["location_label"])
        venue_id = get_or_create_venue(venue_data)
        content_hash = generate_content_hash(title, venue_data["name"], event["start_date"])
        current_hashes.add(content_hash)
        events_found += 1

        description = event["description"] or fetch_detail_description(event["detail_url"])
        category = infer_category(title, event["location_label"])
        tags = infer_tags(title, event["location_label"])

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": event["start_date"],
            "start_time": event["start_time"],
            "end_date": event["end_date"],
            "end_time": event["end_time"],
            "is_all_day": event["is_all_day"],
            "category": category,
            "subcategory": "expo" if "convention-center" in tags else None,
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": False,
            "source_url": event["detail_url"],
            "ticket_url": event["detail_url"],
            "image_url": event["image_url"],
            "raw_text": (
                f"{title} | {event['location_label']} | {event['start_date']} | "
                f"{event.get('start_time') or 'all-day'}"
            ),
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
    logger.info("Removed %s stale Gas South District events", removed)
    logger.info(
        "Gas South District crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
