"""
Crawler for Clark Atlanta University Events.

Uses the public idfive calendar API behind cau.edu/events.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime
from typing import Any, Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)


# Keywords that indicate student/alumni-only events (not public)
STUDENT_ONLY_KEYWORDS = [
    "orientation",
    "new student",
    "prospective",
    "open house",
    "registration",
    "enrollment",
    "advising",
    "deadline",
    "reunion",
    "alumni weekend",
    "homecoming weekend",
    "virtual info session",
    "info session",
    "staff meeting",
    "faculty meeting",
    "commencement rehearsal",
    "graduation rehearsal",
    "student only",
    "students only",
    "for students",
    "admitted students",
    "accepted students",
    "parent weekend",
    "family weekend",
    "preview day",
    "admitted student",
    "career fair",
    "graduate school fair",
    "job fair",
]

# Calendar placeholders/academic milestones that are typically not consumer events.
NON_EVENT_CALENDAR_KEYWORDS = [
    "spring break",
    "final exams",
    "last day of classes",
    "good friday",
    "classes begin",
    "classes end",
    "registration period",
]


def is_public_event(title: str, description: str = "") -> bool:
    """Check if event appears to be open to the public (not student/alumni only)."""
    text = f"{title} {description}".lower()

    for keyword in STUDENT_ONLY_KEYWORDS:
        if keyword in text:
            return False

    title_lower = (title or "").lower()
    for keyword in NON_EVENT_CALENDAR_KEYWORDS:
        if keyword in title_lower:
            return False

    return True


BASE_URL = "https://www.cau.edu"
EVENTS_URL = f"{BASE_URL}/events"
EVENTS_API_URL = f"{BASE_URL}/api/idfive_calendar/events"

VENUES = {
    "museum": {
        "name": "Clark Atlanta University Art Museum",
        "slug": "cau-art-museum",
        "address": "223 James P. Brawley Drive SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30314",
        "venue_type": "museum",
        "website": "https://cau.edu/museum",
    },
    "default": {
        "name": "Clark Atlanta University",
        "slug": "clark-atlanta-university",
        "address": "223 James P. Brawley Drive SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30314",
        "venue_type": "university",
        "website": "https://cau.edu",
    },
}


def _normalize_time(value: Optional[str]) -> Optional[str]:
    """Convert API time labels like '3:30 PM' to 24h HH:MM."""
    if not value:
        return None

    text = " ".join(value.split())
    if text.lower() == "all day":
        return None

    for fmt in ("%I:%M %p", "%I %p"):
        try:
            return datetime.strptime(text, fmt).strftime("%H:%M")
        except ValueError:
            continue

    return None


def _strip_html(value: Optional[str]) -> str:
    if not value:
        return ""
    return BeautifulSoup(value, "html.parser").get_text(" ", strip=True)


def _extract_api_image_url(image_blob: Any) -> Optional[str]:
    if not isinstance(image_blob, dict):
        return None

    sizes = image_blob.get("image_sizes")
    if not isinstance(sizes, dict):
        return None

    for key in ("large", "medium_large", "medium", "thumbnail"):
        candidate = sizes.get(key)
        if candidate:
            return candidate
    return None


def _extract_tags(event_data: dict, title: str, description: str) -> list[str]:
    tags = {"college", "hbcu", "clark-atlanta", "auc"}

    for category_key in ("category_1", "category_2", "category_3", "category_4", "category_5"):
        categories = event_data.get(category_key)
        if not isinstance(categories, list):
            continue
        for cat in categories:
            name = (cat or {}).get("name")
            if not name:
                continue
            normalized = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
            if normalized:
                tags.add(normalized)

    text = f"{title} {description}".lower()
    if "virtual" in text:
        tags.add("virtual")
    if "athletics" in text or "game" in text:
        tags.add("athletics")
    if "museum" in text or "exhibition" in text:
        tags.add("museum")

    return sorted(tags)


def _determine_category(title: str, description: str = "") -> tuple[str, str]:
    text = f"{title} {description}".lower()
    if "art" in text or "museum" in text or "exhibition" in text:
        return "museums", "exhibition"
    if "concert" in text or "music" in text:
        return "music", "concert"
    if "athletics" in text or "game" in text:
        return "sports", "college"
    return "community", "campus"


def _fetch_calendar_events(headers: dict, start_date: date) -> list[dict]:
    params = {
        "range_start": 0,
        "range_total": 100,
        "start_date": start_date.isoformat(),
    }
    response = requests.get(EVENTS_API_URL, headers=headers, params=params, timeout=30)
    response.raise_for_status()

    payload = response.json()
    if not isinstance(payload, dict):
        return []

    data = payload.get("data")
    if isinstance(data, list):
        return data
    return []


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Clark Atlanta University events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    venue_data = VENUES["default"]
    venue_id = get_or_create_venue(venue_data)

    try:
        calendar_events = _fetch_calendar_events(headers, date.today())

        for event_data in calendar_events:
            title = (event_data.get("title") or "").strip()
            if not title:
                continue

            date_blob = event_data.get("date") or {}
            start_blob = date_blob.get("start") or {}
            end_blob = date_blob.get("end") or {}

            start_date = start_blob.get("date")
            if not start_date:
                continue

            all_day = str(date_blob.get("all_day", "0")).lower() in {"1", "true"}
            start_time = None if all_day else _normalize_time(start_blob.get("time"))
            end_date = end_blob.get("date")
            end_time = None if all_day else _normalize_time(end_blob.get("time"))

            summary = (event_data.get("summary") or "").strip()
            details = _strip_html(event_data.get("details"))
            description = details or summary or "Event at Clark Atlanta University"

            if not is_public_event(title, description):
                logger.debug("Skipping non-public event: %s", title)
                continue

            category, subcategory = _determine_category(title, description)
            source_url = (event_data.get("url") or EVENTS_URL).strip()
            image_url = _extract_api_image_url(event_data.get("image"))

            content_hash = generate_content_hash(
                title,
                venue_data["name"],
                f"{start_date}|{start_time or ''}|{source_url}",
            )

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description[:500],
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": all_day,
                "category": category,
                "subcategory": subcategory,
                "tags": _extract_tags(event_data, title, description),
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": source_url,
                "ticket_url": source_url,
                "image_url": image_url,
                "raw_text": json.dumps(event_data)[:2000],
                "extraction_confidence": 0.9,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            events_found += 1

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record)
                events_new += 1
            except Exception as e:
                logger.error("Failed to insert %s: %s", title, e)

        logger.info(
            "Clark Atlanta University: Found %s events, %s new, %s existing",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as e:
        logger.error("Failed to crawl Clark Atlanta University: %s", e)
        raise

    return events_found, events_new, events_updated
