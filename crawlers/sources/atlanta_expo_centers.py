"""
Crawler for Atlanta Expo Centers events calendar.

Official source:
- The public venue events page publishes a dated yearly schedule with event
  titles, venue-facility labels, and occasional organizer links.

This source intentionally owns only the long-tail public events that do not
already have stronger dedicated crawlers.
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

EVENTS_URL = "https://www.atlantaexpositioncenters.com/events/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"
MAX_EVENT_LEAD_DAYS = 270

VENUE_DATA_BY_LABEL = {
    "atlanta expo centers - north facility": {
        "name": "Atlanta Expo Center North",
        "slug": "atlanta-expo-center-north",
        "address": "3650 Jonesboro Rd SE",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30354",
        "venue_type": "event_space",
        "spot_type": "event_space",
        "website": "https://www.atlantaexpositioncenters.com/",
    },
    "atlanta expo centers - north facilities": {
        "name": "Atlanta Expo Center North",
        "slug": "atlanta-expo-center-north",
        "address": "3650 Jonesboro Rd SE",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30354",
        "venue_type": "event_space",
        "spot_type": "event_space",
        "website": "https://www.atlantaexpositioncenters.com/",
    },
    "atlanta expo centers - north facility only": {
        "name": "Atlanta Expo Center North",
        "slug": "atlanta-expo-center-north",
        "address": "3650 Jonesboro Rd SE",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30354",
        "venue_type": "event_space",
        "spot_type": "event_space",
        "website": "https://www.atlantaexpositioncenters.com/",
    },
    "atlanta expo centers - south facility": {
        "name": "Atlanta Exposition Center South",
        "slug": "atlanta-exposition-center-south",
        "address": "3850 Jonesboro Rd",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30354",
        "venue_type": "convention_center",
        "spot_type": "convention_center",
        "website": "https://www.atlantaexpositioncenters.com/",
    },
    "atlanta expo centers - south facilities": {
        "name": "Atlanta Exposition Center South",
        "slug": "atlanta-exposition-center-south",
        "address": "3850 Jonesboro Rd",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30354",
        "venue_type": "convention_center",
        "spot_type": "convention_center",
        "website": "https://www.atlantaexpositioncenters.com/",
    },
    "atlanta expo centers - north & south facilities": {
        "name": "Atlanta Expo Center",
        "slug": "atlanta-expo-center",
        "address": "3650 Jonesboro Rd SE, Atlanta, GA 30354, USA",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30354",
        "venue_type": "convention_center",
        "spot_type": "convention_center",
        "website": "https://www.atlantaexpositioncenters.com/",
    },
}

SKIP_TITLES = {
    "scott antique markets",
    "scott antique market",
    "atl camping & rv show",
    "atlanta camping & rv show",
    "atl streetwear market",
    "nationwide expo home show",
    "national arms show",
    "pdi ride & drive event",
}

TAG_KEYWORDS = {
    "arms": "weapons",
    "gun": "weapons",
    "knife": "collectibles",
    "dog": "pets",
    "kennel": "pets",
    "vintage": "vintage",
    "car": "cars",
    "home": "home",
    "expo": "expo",
    "show": "show",
    "market": "market",
}


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\u200b", "").strip())


def normalize_label(value: str) -> str:
    return normalize_text(value).lower()


def parse_schedule_year(text: str, today: date | None = None) -> int:
    match = re.search(r"(\d{4})\s+SCHEDULE", text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    today = today or datetime.now().date()
    return today.year


def should_skip_title(title: str) -> bool:
    lowered = normalize_label(title)
    if lowered in SKIP_TITLES:
        return True
    if "not open to the public" in lowered:
        return True
    return False


def looks_like_event_line(text: str) -> bool:
    return bool(
        re.match(r"^\d{1,2}/\d{1,2}(?:\s*-\s*\d{1,2}(?:/\d{1,2})?)?(?:\s*-\s*|\s+[A-Za-z])", text)
    )


def parse_date_span(raw: str, year: int) -> tuple[str, Optional[str]]:
    cleaned = normalize_text(raw)
    range_same_month = re.match(r"(\d{1,2})/(\d{1,2})\s*-\s*(\d{1,2})$", cleaned)
    if range_same_month:
        month, start_day, end_day = map(int, range_same_month.groups())
        start_dt = date(year, month, start_day)
        end_dt = date(year, month, end_day)
        return start_dt.isoformat(), end_dt.isoformat()

    range_cross_month = re.match(r"(\d{1,2})/(\d{1,2})\s*-\s*(\d{1,2})/(\d{1,2})$", cleaned)
    if range_cross_month:
        start_month, start_day, end_month, end_day = map(int, range_cross_month.groups())
        start_dt = date(year, start_month, start_day)
        end_dt = date(year, end_month, end_day)
        return start_dt.isoformat(), end_dt.isoformat()

    single = re.match(r"(\d{1,2})/(\d{1,2})$", cleaned)
    if single:
        month, day_value = map(int, single.groups())
        start_dt = date(year, month, day_value)
        return start_dt.isoformat(), None

    raise ValueError(f"Could not parse Atlanta Expo Centers date span: {raw}")


def infer_tags(title: str) -> list[str]:
    text = title.lower()
    tags = ["atlanta-expo-centers", "expo-center"]
    for keyword, tag in TAG_KEYWORDS.items():
        if re.search(r'\b' + re.escape(keyword) + r'\b', text) and tag not in tags:
            tags.append(tag)
    return tags


def infer_subcategory(title: str) -> str:
    lowered = title.lower()
    if any(token in lowered for token in ("market", "vintage")):
        return "market"
    if any(token in lowered for token in ("show", "expo")):
        return "expo"
    return "community"


def parse_event_blocks(html_text: str, today: date | None = None) -> list[dict]:
    """Parse the public Atlanta Expo Centers yearly schedule."""
    today = today or datetime.now().date()
    soup = BeautifulSoup(html_text, "html.parser")
    page_text = soup.get_text("\n", strip=True)
    year = parse_schedule_year(page_text, today=today)

    events: list[dict] = []
    elements = soup.find_all(["h2", "p"])
    for idx, element in enumerate(elements):
        if element.name != "p":
            continue

        text = normalize_text(element.get_text(" ", strip=True))
        if not text:
            continue

        anchor = element.find("a", href=True)
        link_url = anchor["href"].strip() if anchor and anchor.get("href") else None
        date_match = re.match(
            r"^(\d{1,2}/\d{1,2}\s*-\s*\d{1,2}/\d{1,2})\s+([A-Za-z].+)$",
            text,
        )
        if not date_match:
            date_match = re.match(
                r"^(\d{1,2}/\d{1,2}\s*-\s*\d{1,2}/\d{1,2})\s*-\s*([A-Za-z].+)$",
                text,
            )
        if not date_match:
            date_match = re.match(
                r"^(\d{1,2}/\d{1,2}\s*-\s*\d{1,2})\s*-\s*([A-Za-z].+)$",
                text,
            )
        if not date_match:
            date_match = re.match(r"^(\d{1,2}/\d{1,2})\s*-\s*([A-Za-z].+)$", text)
        if not date_match:
            date_match = re.match(r"^(\d{1,2}/\d{1,2})\s+([A-Za-z].+)$", text)
        if not date_match:
            continue

        raw_dates = normalize_text(date_match.group(1))
        title = normalize_text(date_match.group(2).lstrip("-").strip())
        if should_skip_title(title):
            continue

        try:
            start_date, end_date = parse_date_span(raw_dates, year)
        except ValueError:
            continue

        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        event_end = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else start_dt
        if event_end < today:
            continue
        if (start_dt - today).days > MAX_EVENT_LEAD_DAYS:
            continue

        facility_text = None
        note_text = None
        if idx + 1 < len(elements) and elements[idx + 1].name == "p":
            candidate = normalize_text(elements[idx + 1].get_text(" ", strip=True))
            if candidate.lower().startswith("atlanta expo centers"):
                facility_text = candidate
        if idx + 2 < len(elements) and elements[idx + 2].name == "p":
            note_candidate = normalize_text(elements[idx + 2].get_text(" ", strip=True))
            if (
                note_candidate
                and not note_candidate.lower().startswith("atlanta expo centers")
                and not looks_like_event_line(note_candidate)
            ):
                note_text = note_candidate

        if note_text and "not open to the public" in note_text.lower():
            continue

        if not facility_text:
            continue

        events.append(
            {
                "title": title,
                "start_date": start_date,
                "end_date": end_date,
                "facility": facility_text,
                "ticket_url": link_url,
                "source_url": link_url or EVENTS_URL,
                "note_text": note_text,
            }
        )

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the Atlanta Expo Centers public venue calendar."""
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

    events = parse_event_blocks(response.text)
    if not events:
        raise ValueError("Atlanta Expo Centers page did not yield any future non-dedicated events")

    for event in events:
        venue_data = VENUE_DATA_BY_LABEL.get(normalize_label(event["facility"]))
        if not venue_data:
            continue
        venue_id = get_or_create_venue(venue_data)

        content_hash = generate_content_hash(event["title"], venue_data["name"], event["start_date"])
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": event["title"],
            "description": event["note_text"] or f"{event['title']} at Atlanta Expo Centers.",
            "start_date": event["start_date"],
            "start_time": None,
            "end_date": event["end_date"],
            "end_time": None,
            "is_all_day": True,
            "category": "community",
            "subcategory": infer_subcategory(event["title"]),
            "tags": infer_tags(event["title"]),
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": False,
            "source_url": event["source_url"],
            "ticket_url": event["ticket_url"],
            "image_url": None,
            "raw_text": (
                f"{event['title']} | {event['start_date']} to {event['end_date'] or event['start_date']} | "
                f"{event['facility']}"
            ),
            "extraction_confidence": 0.9,
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
        logger.info("Removed %s stale Atlanta Expo Centers events after refresh", stale_removed)

    logger.info(
        "Atlanta Expo Centers crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
