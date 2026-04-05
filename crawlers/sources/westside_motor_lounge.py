"""
Crawler for Westside Motor Lounge.

The happenings page renders a Shotgun widget client-side. We use Playwright to
let the widget load, then pull normalized event details from the Shotgun detail
page JSON-LD.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import find_event_by_hash, get_or_create_place, insert_event, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

EVENTS_URL = "https://www.westsidemotorlounge.com/happenings/"
CARD_SELECTOR = ".shotgun-event-card"
ATLANTA_TZ = ZoneInfo("America/New_York")

PLACE_DATA = {
    "name": "Westside Motor Lounge",
    "slug": "westside-motor-lounge",
    "address": "725 Echo St NW",
    "neighborhood": "English Avenue",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7738,
    "lng": -84.4100,
    "place_type": "bar",
    "spot_type": "bar",
    "website": "https://www.westsidemotorlounge.com",
}


def parse_shotgun_event_jsonld(html: str) -> Optional[dict]:
    """Parse the Event JSON-LD from a Shotgun detail page."""
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.select('script[type="application/ld+json"]'):
        raw = script.get_text(strip=True)
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if not isinstance(payload, dict):
            continue
        payload_type = payload.get("@type")
        if isinstance(payload_type, str) and payload_type.endswith("Event"):
            return payload
        if isinstance(payload_type, list) and any(
            isinstance(item, str) and item.endswith("Event") for item in payload_type
        ):
            return payload
    return None


def determine_category(title: str, description: str, tags: list[str]) -> tuple[str, Optional[str], list[str]]:
    """Map Westside event metadata into LostCity categories."""
    text = f"{title} {description} {' '.join(tags)}".lower()
    base_tags = ["westside-motor-lounge", "english-avenue", "echo-street"]
    cleaned_tags = [tag.lower() for tag in tags if tag]

    if any(word in text for word in ["jazz", "r&b", "soul", "house", "techno", "music", "vinyl", "dj"]):
        return "music", "live", base_tags + cleaned_tags
    if any(word in text for word in ["comedy", "open mic"]):
        return "comedy", None, base_tags + cleaned_tags

    return "nightlife", None, base_tags + cleaned_tags


def parse_price_fields(offers: list[dict]) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """Derive price fields from Shotgun offers."""
    prices = [offer.get("price") for offer in offers if isinstance(offer.get("price"), (int, float))]
    [offer.get("name") for offer in offers if offer.get("name")]
    price_note = ", ".join(
        f"{offer['name']} (${offer['price']})"
        for offer in offers
        if offer.get("name") and isinstance(offer.get("price"), (int, float))
    ) or None
    is_free = bool(prices) and max(prices) == 0
    return (
        min(prices) if prices else None,
        max(prices) if prices else None,
        price_note,
        is_free,
    )


def parse_datetime_fields(start_raw: str, end_raw: Optional[str]) -> tuple[str, Optional[str], Optional[str], Optional[str], bool]:
    """Parse ISO datetimes into event date/time fields."""
    start_dt = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(end_raw.replace("Z", "+00:00")) if end_raw else None
    if start_dt.tzinfo is not None:
        start_dt = start_dt.astimezone(ATLANTA_TZ)
    if end_dt and end_dt.tzinfo is not None:
        end_dt = end_dt.astimezone(ATLANTA_TZ)
    start_date = start_dt.date().isoformat()
    start_time = start_dt.strftime("%H:%M")

    if end_dt:
        end_date = end_dt.date().isoformat()
        end_time = end_dt.strftime("%H:%M")
    else:
        end_date = start_date
        end_time = None

    return start_date, end_date, start_time, end_time, False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Westside Motor Lounge happenings."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 2400})
        page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(8000)
        page.wait_for_selector(CARD_SELECTOR, timeout=30000)

        list_soup = BeautifulSoup(page.content(), "html.parser")
        cards = list_soup.select(CARD_SELECTOR)

        detail_page = browser.new_page(viewport={"width": 1440, "height": 2400})

        for card in cards:
            href = card.get("href")
            if not href:
                continue

            detail_url = href
            tag_nodes = card.select(".sg-uppercase")
            rendered_tags = [node.get_text(" ", strip=True) for node in tag_nodes if node.get_text(" ", strip=True)]

            detail_page.goto(detail_url, wait_until="domcontentloaded", timeout=60000)
            detail_page.wait_for_timeout(4000)
            event_json = parse_shotgun_event_jsonld(detail_page.content())
            if not event_json:
                logger.warning("Westside Motor Lounge detail page missing JSON-LD: %s", detail_url)
                continue

            title = event_json.get("name")
            start_raw = event_json.get("startDate")
            if not title or not start_raw:
                continue

            description = event_json.get("description", "")
            offers = event_json.get("offers", [])
            if isinstance(offers, dict):
                offers = [offers]

            start_date, end_date, start_time, end_time, is_all_day = parse_datetime_fields(
                start_raw,
                event_json.get("endDate"),
            )
            category, subcategory, tags = determine_category(title, description, rendered_tags)
            price_min, price_max, price_note, is_free = parse_price_fields(offers)
            image = event_json.get("image")
            if isinstance(image, dict):
                image_url = image.get("url")
            else:
                image_url = image

            events_found += 1
            content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": is_all_day,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": price_min,
                "price_max": price_max,
                "price_note": price_note,
                "is_free": is_free,
                "source_url": detail_url,
                "ticket_url": detail_url,
                "image_url": image_url,
                "raw_text": None,
                "extraction_confidence": 0.92,
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
                logger.info("Added Westside Motor Lounge event: %s on %s", title, start_date)
            except Exception as exc:
                logger.error("Failed to insert Westside Motor Lounge event %s: %s", title, exc)

        detail_page.close()
        browser.close()

    logger.info(
        "Westside Motor Lounge crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
