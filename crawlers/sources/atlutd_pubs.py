"""Crawler for Atlanta United Pub Partners watch parties."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlutd.com"
EVENTS_URL = f"{BASE_URL}/fans/pub-partner-program"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

NETWORK_VENUE_DATA = {
    "name": "Atlanta United Pub Partners",
    "slug": "atlutd-pubs",
    "address": "Various locations",
    "neighborhood": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7490,
    "lng": -84.3880,
    "venue_type": "network",
    "spot_type": "sports_bar",
    "website": BASE_URL,
    "description": "Official Atlanta United Pub Partner network for away-match watch parties across metro Atlanta.",
}

VENUE_OVERRIDES = {
    "Brewhouse Cafe": {
        "name": "Brewhouse Cafe",
        "slug": "brewhouse-cafe",
        "address": "401 Moreland Ave NE",
        "neighborhood": "Candler Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7644,
        "lng": -84.3481,
        "venue_type": "bar",
        "spot_type": "sports_bar",
        "website": "https://www.brewhousecafe.com",
    },
    "Fado Irish Pub - Buckhead": {
        "name": "Fado Irish Pub",
        "slug": "fado-irish-pub",
        "address": "273 Buckhead Avenue NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "lat": 33.8407,
        "lng": -84.3794,
        "venue_type": "bar",
        "spot_type": "sports_bar",
        "website": "https://fadoirishpub.com/atlanta",
    },
    "Der Biergarten": {
        "name": "Der Biergarten",
        "slug": "der-biergarten",
        "address": "300 Marietta St NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "venue_type": "bar",
        "spot_type": "sports_bar",
        "website": "https://derbiergarten.com",
    },
    "El Tesoro": {
        "name": "El Tesoro",
        "slug": "el-tesoro",
        "address": "1374 Arkwright Pl SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30317",
        "venue_type": "restaurant",
        "spot_type": "restaurant",
        "website": "https://www.eltesoroatl.com",
    },
    "Willie B's": {
        "name": "Willie B's",
        "slug": "willie-b-s",
        "address": "3200 Atlanta Silverbacks Way",
        "neighborhood": "Northeast Atlanta",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30340",
        "venue_type": "bar",
        "spot_type": "sports_bar",
        "website": "https://silverbackspark.com/willie-bs/",
    },
    "Park Tavern": {
        "name": "Park Tavern",
        "slug": "park-tavern",
        "address": "500 10th St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "bar",
        "spot_type": "sports_bar",
        "website": "https://www.parktavern.com",
    },
    "The Tavern @ Live!": {
        "name": "The Tavern @ Live!",
        "slug": "the-tavern-live",
        "address": "825 Battery Ave SE Suite 600",
        "neighborhood": "Cumberland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30339",
        "venue_type": "bar",
        "spot_type": "sports_bar",
        "website": "https://liveatthebatteryatlanta.com",
    },
}

MONTH_MAP = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


def slugify(value: str) -> str:
    """Return a stable slug for pub partner venue names."""
    return re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9]+", "-", value.lower())).strip("-")


def normalize_text(value: str) -> str:
    """Collapse whitespace and non-breaking spaces."""
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def parse_clock_time(value: str) -> Optional[str]:
    """Convert 12-hour times like 6pm or 7:30pm into HH:MM."""
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", value.lower())
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or "0")
    period = match.group(3)

    if period == "pm" and hour != 12:
        hour += 12
    if period == "am" and hour == 12:
        hour = 0

    return f"{hour:02d}:{minute:02d}"


def parse_schedule_date(value: str, year: int) -> Optional[str]:
    """Parse schedule dates like Saturday, Feb. 28 into YYYY-MM-DD."""
    match = re.search(r"([A-Za-z]+)\.?\s+(\d{1,2})", normalize_text(value))
    if not match:
        return None

    month_key = match.group(1).lower()[:4].rstrip(".")
    month = MONTH_MAP.get(month_key[:3]) or MONTH_MAP.get(month_key)
    if month is None:
        return None

    day = int(match.group(2))
    return datetime(year, month, day).strftime("%Y-%m-%d")


def build_watch_party_title(opponent: str, location: str) -> str:
    """Build a deterministic event title."""
    return f"Atlanta United Watch Party vs {opponent} at {location}"


def build_matchup_participants(opponent: str) -> list[dict]:
    """Return structured home/opponent participants for watch parties."""
    return [
        {"name": "Atlanta United FC", "role": "team", "billing_order": 1},
        {"name": opponent, "role": "team", "billing_order": 2},
    ]


def build_venue_data(location: str) -> dict:
    """Return best-known venue metadata for a pub partner location."""
    override = VENUE_OVERRIDES.get(location)
    if override:
        return override

    city = "Roswell" if "roswell" in location.lower() else "Atlanta"
    return {
        "name": location,
        "slug": slugify(location),
        "city": city,
        "state": "GA",
        "venue_type": "bar",
        "spot_type": "sports_bar",
        "website": EVENTS_URL,
        "description": "Atlanta United official Pub Partner watch-party location.",
    }


def parse_watch_party_schedule(html: str, year: Optional[int] = None) -> list[dict]:
    """Extract scheduled watch parties from the official Pub Partners table."""
    schedule_year = year or datetime.now().year
    soup = BeautifulSoup(html, "html.parser")
    title_node = soup.find("div", class_="tabletitle", string=re.compile(r"Watch Party Schedule", re.I))
    if title_node is None:
        return []

    table = title_node.find_parent("div", class_="tab-title")
    if table is None:
        return []

    body = table.find_next_sibling("div", class_="fo-table")
    if body is None:
        return []

    rows = body.select("table tr")
    events: list[dict] = []

    for row in rows[1:]:
        cells = [normalize_text(cell.get_text(" ", strip=True)) for cell in row.find_all("td")]
        if len(cells) != 5:
            continue

        start_date = parse_schedule_date(cells[0], schedule_year)
        if not start_date:
            continue

        location = cells[1]
        event_window = cells[2]
        kickoff = cells[3]
        opponent = cells[4]

        events.append(
            {
                "title": build_watch_party_title(opponent, location),
                "start_date": start_date,
                "start_time": parse_clock_time(event_window) or parse_clock_time(kickoff),
                "location": location,
                "event_window": event_window,
                "kickoff": kickoff,
                "opponent": opponent,
                "venue_data": build_venue_data(location),
            }
        )

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl official Atlanta United away-match watch parties."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    get_or_create_place(NETWORK_VENUE_DATA)

    response = requests.get(
        EVENTS_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    response.raise_for_status()

    today = datetime.now().date()
    schedule = parse_watch_party_schedule(response.text)

    for item in schedule:
        event_date = datetime.strptime(item["start_date"], "%Y-%m-%d").date()
        if event_date < today:
            continue

        venue_id = get_or_create_place(item["venue_data"])
        events_found += 1

        description = (
            f"Official Atlanta United away-match watch party at {item['location']} for the {item['opponent']} "
            f"match. Atlanta United says these watch parties are open to anyone. "
            f"Event window: {item['event_window']}. Kickoff: {item['kickoff']}."
        )

        content_hash = generate_content_hash(item["title"], item["location"], item["start_date"])
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": item["title"],
            "description": description,
            "start_date": item["start_date"],
            "start_time": item["start_time"],
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "sports",
            "subcategory": "watch_party",
            "tags": [
                "atlutd",
                "atlanta-united",
                "soccer",
                "watch-party",
                "sports-bar",
                "public",
            ],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": EVENTS_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": f"{item['title']} | {item['event_window']} | kickoff {item['kickoff']}",
            "extraction_confidence": 0.92,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
            "_parsed_artists": build_matchup_participants(item["opponent"]),
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        insert_event(event_record)
        events_new += 1
        logger.info("Added Atlanta United watch party: %s", item["title"])

    logger.info(
        "Atlanta United Pub Partners crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
