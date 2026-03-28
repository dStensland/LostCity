"""
Crawler for Rialto Center for the Arts at Georgia State.

Uses official Georgia State calendar JSON-LD event data rather than scraping the
old dead events page.
"""

from __future__ import annotations

import json
import html as html_lib
import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from utils import parse_price

logger = logging.getLogger(__name__)

BASE_URL = "https://rialto.gsu.edu"
EVENTS_URL = "https://calendar.gsu.edu/rialto"
REQUEST_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"}

PLACE_DATA = {
    "name": "Rialto Center for the Arts",
    "slug": "rialto-center",
    "address": "80 Forsyth St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7536,
    "lng": -84.3909,
    "place_type": "theater",
    "spot_type": "theater",
    "website": EVENTS_URL,
}


def parse_jsonld_events(html: str) -> list[dict]:
    """Extract Event JSON-LD blocks from the official calendar page."""
    events: list[dict] = []
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.select('script[type="application/ld+json"]'):
        raw = (script.string or script.get_text() or "").strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            event_type = item.get("@type")
            if event_type == "Event" or (
                isinstance(event_type, list) and "Event" in event_type
            ):
                events.append(item)
    return events


def parse_iso_datetime(value: str | None) -> tuple[Optional[str], Optional[str]]:
    if not value:
        return None, None
    text = str(value).strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        return text, None
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except ValueError:
        return None, None


def clean_description(value: str | None) -> str:
    if not value:
        return ""
    text = html_lib.unescape(str(value))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_offer_fields(
    offers: dict | list | None,
) -> tuple[Optional[float], Optional[float], Optional[str], Optional[str], bool]:
    """Extract price range, note, ticket URL, and free flag from schema offers."""
    if not offers:
        return None, None, None, None, False

    ticket_url: Optional[str] = None
    if isinstance(offers, dict):
        ticket_url = offers.get("url") or None
        raw_price = str(offers.get("price") or "").strip()
        if not raw_price:
            return None, None, None, ticket_url, False
        price_min, price_max, price_note = parse_price(raw_price)
        return price_min, price_max, price_note or raw_price, ticket_url, (
            price_min == 0 and price_max == 0
        )

    normalized_names: list[str] = []
    mins: list[float] = []
    maxes: list[float] = []
    is_free = False
    for offer in offers:
        if not isinstance(offer, dict):
            continue
        ticket_url = ticket_url or offer.get("url") or None
        label = str(offer.get("name") or "").strip()
        price_value = offer.get("price")
        display = label
        if price_value not in (None, ""):
            try:
                price_num = float(price_value)
                mins.append(price_num)
                maxes.append(price_num)
                display = f"{label} (${price_num:g})" if label else f"${price_num:g}"
                if price_num == 0 and label.lower().startswith("free"):
                    is_free = False
                elif price_num == 0 and not label:
                    is_free = True
            except Exception:
                display = f"{label} ({price_value})" if label else str(price_value)
        if display:
            normalized_names.append(display)

    price_note = ", ".join(normalized_names) if normalized_names else None
    if mins and maxes:
        return min(mins), max(maxes), price_note, ticket_url, is_free
    return None, None, price_note, ticket_url, False


def determine_category(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    combined = f"{title} {description}".lower()
    tags = ["rialto-center", "georgia-state", "gsu", "downtown", "performing-arts"]

    if any(word in combined for word in ("jazz", "band", "orchestra", "music", "concert", "trio", "quartet", "choir")):
        tags.extend(["music", "live-music"])
        return "music", "live", sorted(set(tags))

    if "dance" in combined or "ballet" in combined:
        tags.append("dance")
        return "dance", None, sorted(set(tags))

    if any(word in combined for word in ("opera", "theater", "theatre", "play", "comedy")):
        tags.append("theater")
        return "theater", None, sorted(set(tags))

    if any(word in combined for word in ("film", "screening", "documentary")):
        tags.append("film")
        return "film", None, sorted(set(tags))

    if "free and open to the public" in combined or "student showcase" in combined:
        tags.append("community")
        return "community", None, sorted(set(tags))

    return "art", None, sorted(set(tags))


def _normalize_image_url(image: object) -> Optional[str]:
    if isinstance(image, str):
        return image.strip() or None
    if isinstance(image, list):
        for item in image:
            normalized = _normalize_image_url(item)
            if normalized:
                return normalized
        return None
    if isinstance(image, dict):
        return str(image.get("url") or image.get("contentUrl") or "").strip() or None
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Rialto events from the official GSU calendar page."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    try:
        venue_id = get_or_create_place(PLACE_DATA)
        logger.info("Fetching Rialto Center for the Arts: %s", EVENTS_URL)
        response = requests.get(EVENTS_URL, timeout=30, headers=REQUEST_HEADERS)
        response.raise_for_status()

        jsonld_events = parse_jsonld_events(response.text)
        logger.info("Found %s JSON-LD events", len(jsonld_events))

        today = datetime.now().date()

        for event_data in jsonld_events:
            title = str(event_data.get("name") or "").strip()
            if not title:
                continue

            start_date, start_time = parse_iso_datetime(event_data.get("startDate"))
            end_date, end_time = parse_iso_datetime(event_data.get("endDate"))
            if not start_date:
                continue

            try:
                if datetime.strptime(start_date, "%Y-%m-%d").date() < today:
                    continue
            except ValueError:
                continue

            description = clean_description(event_data.get("description"))
            category, subcategory, tags = determine_category(title, description)

            price_min, price_max, price_note, ticket_url, is_free = parse_offer_fields(
                event_data.get("offers")
            )
            if is_free:
                tags.append("free")
            elif "free and open to the public" in description.lower():
                is_free = True
                tags.append("free")

            source_url = str(event_data.get("url") or EVENTS_URL).strip() or EVENTS_URL
            image_url = _normalize_image_url(event_data.get("image"))

            hash_key = f"{start_date}|{start_time}" if start_time else start_date
            content_hash = generate_content_hash(
                title,
                "Rialto Center for the Arts",
                hash_key,
            )
            seen_hashes.add(content_hash)
            events_found += 1

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": description or f"{title} at Rialto Center for the Arts",
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": sorted(set(tags)),
                "price_min": price_min,
                "price_max": price_max,
                "price_note": price_note,
                "is_free": is_free,
                "source_url": source_url,
                "ticket_url": ticket_url,
                "image_url": image_url,
                "raw_text": None,
                "extraction_confidence": 0.94,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            insert_event(event_record)
            events_new += 1

        if seen_hashes:
            stale_removed = remove_stale_source_events(source_id, seen_hashes)
            if stale_removed:
                logger.info("Removed %s stale Rialto events", stale_removed)

        logger.info(
            "Rialto Center crawl complete: %s found, %s new, %s updated",
            events_found,
            events_new,
            events_updated,
        )
    except Exception as exc:
        logger.error("Failed to crawl Rialto Center for the Arts: %s", exc)
        raise

    return events_found, events_new, events_updated
