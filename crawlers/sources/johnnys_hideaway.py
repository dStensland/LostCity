"""
Crawler for Johnny's Hideaway (johnnyshideaway.com).
Iconic Buckhead dance club open since 1979. Recurring trivia and ladies nights.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://johnnyshideaway.com"
EVENTS_URL = f"{BASE_URL}/atlanta-johnny-s-hideaway-events"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
    )
}

WEEKDAY_TO_RRULE = {
    "monday": "FREQ=WEEKLY;BYDAY=MO",
    "tuesday": "FREQ=WEEKLY;BYDAY=TU",
    "wednesday": "FREQ=WEEKLY;BYDAY=WE",
    "thursday": "FREQ=WEEKLY;BYDAY=TH",
    "friday": "FREQ=WEEKLY;BYDAY=FR",
    "saturday": "FREQ=WEEKLY;BYDAY=SA",
    "sunday": "FREQ=WEEKLY;BYDAY=SU",
}

PLACE_DATA = {
    "name": "Johnny's Hideaway",
    "slug": "johnnys-hideaway",
    "address": "3771 Roswell Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30342",
    "lat": 33.8476,
    "lng": -84.3762,
    "place_type": "nightclub",
    "spot_type": "nightclub",
    "website": BASE_URL,
    "vibes": ["dancing", "classic", "date-night", "late-night", "live-music"],
}


def _normalize_text(value: str | None) -> str:
    return " ".join((value or "").split())


def _normalize_url(url: str | None) -> str | None:
    if not url:
        return None
    if url.startswith("//"):
        return f"https:{url}"
    return urljoin(BASE_URL, url)


def _build_recurrence_rule(section: BeautifulSoup) -> str | None:
    info_text = _normalize_text(section.select_one(".event-info-text").get_text(" ", strip=True) if section.select_one(".event-info-text") else "")
    match = re.search(
        r"\bEvery\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b",
        info_text,
        re.IGNORECASE,
    )
    if not match:
        return None
    return WEEKDAY_TO_RRULE.get(match.group(1).lower())


def _parse_event_sections(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict[str, Any]] = []

    for section in soup.select("div.events-holder > section"):
        title_node = section.select_one("h2")
        start_node = section.select_one(".atc_date_start")
        end_node = section.select_one(".atc_date_end")
        if not title_node or not start_node:
            continue

        title = _normalize_text(title_node.get_text(" ", strip=True))
        if not title:
            continue

        try:
            start_dt = datetime.strptime(
                _normalize_text(start_node.get_text(" ", strip=True)),
                "%Y-%m-%d %H:%M:%S",
            )
        except ValueError:
            continue

        end_dt: datetime | None = None
        if end_node:
            try:
                end_dt = datetime.strptime(
                    _normalize_text(end_node.get_text(" ", strip=True)),
                    "%Y-%m-%d %H:%M:%S",
                )
            except ValueError:
                end_dt = None

        if end_dt and end_dt <= start_dt:
            end_dt = end_dt + timedelta(days=1)

        description = _normalize_text(
            " ".join(
                paragraph.get_text(" ", strip=True)
                for paragraph in section.select(".event-info-text p")
            )
        )
        image_url = _normalize_url(
            section.select_one("img.event-image").get("src")
            if section.select_one("img.event-image")
            else None
        )

        recurrence_rule = _build_recurrence_rule(section)
        rows.append(
            {
                "title": title,
                "description": description or None,
                "start_date": start_dt.strftime("%Y-%m-%d"),
                "start_time": start_dt.strftime("%H:%M"),
                "end_date": end_dt.strftime("%Y-%m-%d") if end_dt else None,
                "end_time": end_dt.strftime("%H:%M") if end_dt else None,
                "image_url": image_url,
                "source_url": f"{EVENTS_URL}#{section.get('id')}" if section.get("id") else EVENTS_URL,
                "is_recurring": bool(
                    section.select_one('[data-is-recurring="true"]')
                ),
                "recurrence_rule": recurrence_rule,
            }
        )

    return rows


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Johnny's Hideaway events from stable SpotHopper event sections."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        logger.info(f"Fetching Johnny's Hideaway: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()

        for parsed in _parse_event_sections(response.text):
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
                "end_date": parsed["end_date"],
                "end_time": parsed["end_time"],
                "is_all_day": False,
                "category": "nightlife",
                "tags": [
                    "johnnys-hideaway",
                    "dancing",
                    "buckhead",
                    "classic",
                ],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": parsed["source_url"],
                "ticket_url": parsed["source_url"],
                "image_url": parsed["image_url"],
                "raw_text": f"{parsed['title']} - {parsed['start_date']}",
                "extraction_confidence": 0.95,
                "is_recurring": parsed["is_recurring"],
                "recurrence_rule": parsed["recurrence_rule"],
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
            f"Johnny's Hideaway crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Johnny's Hideaway: {e}")
        raise

    return events_found, events_new, events_updated
