"""
Crawler for Hemophilia of Georgia (hog.org).

The public events page currently contains one concrete upcoming event inside a
plain article rather than a structured events feed. Parse that article directly.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://www.hog.org"
EVENTS_URL = f"{BASE_URL}/events"

PLACE_DATA = {
    "name": "Hemophilia of Georgia",
    "slug": "hemophilia-of-georgia",
    "address": "8800 Roswell Rd, Suite 170",
    "neighborhood": "Sandy Springs",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30350",
    "lat": 33.9530,
    "lng": -84.3570,
    "place_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["hemophilia", "blood-disorders", "support"],
    "description": (
        "Support organization for Georgians affected by bleeding disorders, with "
        "education, family programs, and fundraising events."
    ),
}


def determine_category_and_tags(title: str, description: str = "") -> tuple[str, list[str], bool]:
    text = f"{title} {description}".lower()
    tags = ["hemophilia", "blood-disorders"]

    if any(word in text for word in ["camp", "camp wannaklot", "summer camp"]):
        category = "community"
        tags.extend(["camp", "kids", "family-friendly"])
    elif any(word in text for word in ["workshop", "education", "training", "class", "seminar", "learning"]):
        category = "learning"
        tags.extend(["education", "workshop"])
    elif any(word in text for word in ["advocacy", "awareness", "capitol day", "legislative"]):
        category = "community"
        tags.extend(["advocacy", "awareness"])
    elif any(word in text for word in ["fundraiser", "gala", "benefit", "golf", "tournament"]):
        category = "community"
        tags.append("fundraiser")
    elif any(word in text for word in ["family", "parent", "caregiver"]):
        category = "community"
        tags.extend(["family-friendly", "support"])
    else:
        category = "community"
        tags.append("support")

    is_free = False
    if any(word in text for word in ["free", "no cost", "complimentary", "scholarship available"]):
        is_free = True
        tags.append("free")

    return category, list(set(tags)), is_free


def extract_upcoming_event(soup: BeautifulSoup) -> Optional[dict]:
    article = soup.select_one("article .article")
    if article is None:
        return None

    for paragraph in article.select("p"):
        text = " ".join(paragraph.get_text(" ", strip=True).split())
        if "Tee Off for Bleeding Disorders" not in text:
            continue
        if "March 23, 2026" not in text:
            continue

        title = "Tee Off for Bleeding Disorders"
        start_date = parse_human_date("March 23, 2026")
        if not start_date:
            return None

        event_url = f"{BASE_URL}/golf"
        return {
            "title": title,
            "description": text,
            "start_date": start_date,
            "start_time": None,
            "event_url": event_url,
            "image_url": None,
        }

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    response = requests.get(
        EVENTS_URL,
        timeout=20,
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    event_data = extract_upcoming_event(soup)
    if not event_data:
        logger.info("No concrete upcoming Hemophilia of Georgia event found")
        return events_found, events_new, events_updated

    events_found = 1
    category, tags, is_free = determine_category_and_tags(
        event_data["title"],
        event_data["description"],
    )
    content_hash = generate_content_hash(
        event_data["title"],
        "Hemophilia of Georgia",
        event_data["start_date"],
    )
    event_record = {
        "source_id": source_id,
        "place_id": venue_id,
        "title": event_data["title"],
        "description": event_data["description"],
        "start_date": event_data["start_date"],
        "start_time": event_data["start_time"],
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
        "source_url": event_data["event_url"],
        "ticket_url": event_data["event_url"],
        "image_url": event_data["image_url"],
        "raw_text": event_data["description"],
        "extraction_confidence": 0.95,
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
            logger.info("Added Hemophilia of Georgia event")
        except Exception as exc:
            logger.error(f"Failed to insert Hemophilia of Georgia event: {exc}")

    logger.info(
        "Hemophilia of Georgia crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
