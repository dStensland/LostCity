"""
Crawler for Huntington's Disease Society of America Georgia Chapter.

The page exposes event cards, but the top wrapper node and the "Date TBD"
fundraiser placeholders confuse the generic parser. Parse only concrete dated
event cards.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from playwright.sync_api import sync_playwright

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://georgia.hdsa.org"
EVENTS_URL = f"{BASE_URL}/events"

PLACE_DATA = {
    "name": "Huntington's Disease Society of America Georgia",
    "slug": "hdsa-georgia",
    "address": "12 Executive Park Dr NE",
    "neighborhood": "Executive Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30329",
    "lat": 33.8090,
    "lng": -84.3290,
    "place_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["huntingtons", "neurological", "support"],
    "description": (
        "Georgia chapter of HDSA providing education, support, and fundraising "
        "events for families affected by Huntington's disease."
    ),
}


def parse_date_string(date_str: str) -> Optional[str]:
    date_str = (date_str or "").strip()
    match = re.search(r"(\d{2}/\d{2}/\d{4})", date_str)
    if not match:
        return None
    month, day, year = match.group(1).split("/")
    return f"{year}-{month}-{day}"


def parse_time_string(time_str: str) -> Optional[str]:
    match = re.search(r"(\d{1,2}):(\d{2})\s*([AP]M)", time_str or "", re.IGNORECASE)
    if not match:
        return None
    hour = int(match.group(1))
    minute = match.group(2)
    period = match.group(3).upper()
    if period == "PM" and hour != 12:
        hour += 12
    elif period == "AM" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute}"


def determine_category(title: str, description: str = "") -> str:
    text = f"{title} {description}".lower()
    if any(word in text for word in ["support group", "family support", "caregiver support"]):
        return "support_group"
    if any(word in text for word in ["team hope walk", "walk", "run", "5k"]):
        return "fitness"
    if any(word in text for word in ["workshop", "seminar", "education", "conference"]):
        return "learning"
    if any(word in text for word in ["gala", "fundraiser", "benefit"]):
        return "community"
    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    text = f"{title} {description}".lower()
    tags = ["huntingtons", "neurological"]
    if "support group" in text:
        tags.append("support-group")
    if "family" in text or "caregiver" in text:
        tags.append("family-friendly")
    if "walk" in text or "run" in text:
        tags.extend(["outdoor", "activism"])
    if any(word in text for word in ["workshop", "education"]):
        tags.append("educational")
    if "free" in text or "no cost" in text:
        tags.append("free")
    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    text = f"{title} {description}".lower()
    if any(word in text for word in ["free", "no cost", "complimentary"]):
        return True
    if "support group" in text:
        return True
    if any(word in text for word in ["registration fee", "ticket", "$", "fundrais"]):
        return False
    return True


def extract_event_rows(page) -> list[dict]:
    nodes = page.query_selector_all('[class*="event"]')
    extracted: list[dict] = []
    for node in nodes:
        text = " ".join(node.inner_text().split())
        if not text or text == "Events" or text.startswith("Events "):
            continue
        if "Date TBD" in text:
            continue
        if len(re.findall(r"\d{2}/\d{2}/\d{4}\s+@", text)) > 1:
            continue
        match = re.match(
            r"^(.*?)\s+(\d{2}/\d{2}/\d{4})\s+@\s+(\d{1,2}:\d{2}\s*[AP]M)\s+(.*)$",
            text,
            re.IGNORECASE,
        )
        if not match:
            continue
        title, date_str, time_str, description = match.groups()
        extracted.append(
            {
                "title": title.strip(),
                "start_date": parse_date_string(date_str),
                "start_time": parse_time_string(time_str),
                "description": description.strip(),
            }
        )
    unique = []
    seen = set()
    for row in extracted:
        key = (row["title"], row["start_date"])
        if key in seen or not row["start_date"]:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)
        rows = extract_event_rows(page)
        browser.close()

    for row in rows:
        events_found += 1
        title = row["title"]
        description = row["description"]
        category = determine_category(title, description)
        tags = extract_tags(title, description)
        is_free = is_free_event(title, description)
        content_hash = generate_content_hash(title, "HDSA Georgia", row["start_date"])
        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": description,
            "start_date": row["start_date"],
            "start_time": row["start_time"],
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": category,
            "subcategory": None,
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": is_free,
            "source_url": EVENTS_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": description,
            "extraction_confidence": 0.9,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
        else:
            try:
                insert_event(event_record)
                events_new += 1
            except Exception as exc:
                logger.error(f"Failed to insert HDSA Georgia event '{title}': {exc}")

    logger.info(
        "HDSA Georgia crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
