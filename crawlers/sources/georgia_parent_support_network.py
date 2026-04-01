"""
Crawler for Georgia Parent Support Network (gpsn.org).

The public events page currently exposes one recurring support-group callout
rather than a structured calendar feed. Capture that card directly and project
it as a recurring weekly event.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gpsn.org"
EVENTS_URL = f"{BASE_URL}/events"

PLACE_DATA = {
    "name": "Georgia Parent Support Network",
    "slug": "georgia-parent-support-network",
    "address": "1381 Metropolitan Pkwy SW",
    "neighborhood": "Capitol View",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "lat": 33.7130,
    "lng": -84.4060,
    "place_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["childrens-mental-health", "family-support", "advocacy", "peer-support"],
    "description": (
        "Family support and advocacy organization offering parent education, peer support, "
        "and children's mental health resources."
    ),
}


def determine_category_and_tags(title: str, description: str = "") -> tuple[str, list[str], bool]:
    text = f"{title} {description}".lower()
    tags = ["childrens-mental-health", "family-support"]

    if any(word in text for word in ["support group", "parent support", "peer support", "family support"]):
        category = "support_group"
        tags.extend(["peer-support", "community"])
    elif any(word in text for word in ["advocacy", "class", "training", "workshop", "seminar"]):
        category = "learning"
        tags.extend(["advocacy", "parent-education"])
    elif any(word in text for word in ["awareness day", "awareness event", "mental health awareness"]):
        category = "community"
        tags.extend(["awareness", "advocacy"])
    else:
        category = "support_group"
        tags.append("community")

    is_free = "free" in text or "no cost" in text or "no charge" in text
    if is_free:
        tags.append("free")

    return category, list(set(tags)), is_free


def _next_tuesday() -> datetime:
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    days_ahead = (1 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return today + timedelta(days=days_ahead)


def _fetch_events_page() -> Optional[BeautifulSoup]:
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    try:
        response = requests.get(EVENTS_URL, headers=headers, timeout=20)
        response.raise_for_status()
        return BeautifulSoup(response.text, "html.parser")
    except Exception as exc:
        logger.debug(f"Simple request failed for GPSN events page: {exc}")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=headers["User-Agent"],
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)
            html_content = page.content()
            browser.close()
        return BeautifulSoup(html_content, "html.parser")
    except Exception as exc:
        logger.warning(f"Failed to fetch GPSN events page with Playwright: {exc}")
        return None


def extract_weekly_support_group(soup: BeautifulSoup) -> Optional[dict]:
    callout = soup.select_one(".fl-callout")
    if callout is None:
        return None

    title_elem = callout.select_one(".fl-callout-title")
    text_elem = callout.select_one(".fl-callout-text")
    link_elem = callout.select_one("a[href]")
    img_elem = callout.select_one("img")

    title = title_elem.get_text(" ", strip=True) if title_elem else ""
    description = text_elem.get_text(" ", strip=True) if text_elem else ""
    lowered = f"{title} {description}".lower()
    if "weekly" not in lowered or "support group" not in lowered:
        return None

    start_time = "14:00"
    time_match = re.search(r"every\s+tuesday\s+from\s+(\d{1,2})\s*-\s*(\d)\s*pm", lowered)
    if time_match:
        start_hour = int(time_match.group(1))
        start_time = f"{start_hour + 12:02d}:00" if start_hour < 12 else f"{start_hour:02d}:00"

    event_url = EVENTS_URL
    if link_elem and link_elem.get("href"):
        href = link_elem.get("href")
        event_url = href if href.startswith("http") else BASE_URL + href

    image_url = None
    if img_elem and img_elem.get("src"):
        image_url = img_elem.get("src")
        if image_url.startswith("/"):
            image_url = BASE_URL + image_url

    return {
        "title": title,
        "description": description,
        "start_date": _next_tuesday().strftime("%Y-%m-%d"),
        "start_time": start_time,
        "event_url": event_url,
        "image_url": image_url,
        "recurrence_rule": "FREQ=WEEKLY;BYDAY=TU",
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    soup = _fetch_events_page()
    if soup is None:
        return events_found, events_new, events_updated

    event_data = extract_weekly_support_group(soup)
    if not event_data:
        logger.info("No recurring support-group card found on GPSN events page")
        return events_found, events_new, events_updated

    events_found = 1
    category, tags, is_free = determine_category_and_tags(
        event_data["title"],
        event_data["description"],
    )
    content_hash = generate_content_hash(
        event_data["title"],
        "Georgia Parent Support Network",
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
        "price_note": "Free" if is_free else None,
        "is_free": is_free,
        "source_url": event_data["event_url"],
        "ticket_url": None,
        "image_url": event_data["image_url"],
        "raw_text": event_data["description"],
        "extraction_confidence": 0.95,
        "is_recurring": True,
        "recurrence_rule": event_data["recurrence_rule"],
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
            logger.info("Added recurring GPSN support group event")
        except Exception as exc:
            logger.error(f"Failed to insert GPSN recurring event: {exc}")

    logger.info(
        "Georgia Parent Support Network crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
