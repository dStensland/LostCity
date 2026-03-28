"""
Crawler for Sports & Social Atlanta at Live! at the Battery.

The old `/events` endpoint is gone. The current site exposes the venue's event
list through a hydrated Next.js page, while each detail page contains Event
JSON-LD we can trust for the final record.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any, Optional

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://liveatthebatteryatlanta.com"
EVENTS_URL = f"{BASE_URL}/events-and-entertainment/events"

PLACE_DATA = {
    "name": "Sports & Social Atlanta",
    "slug": "sports-social-battery",
    "address": "825 Battery Ave SE, Suite 600",
    "neighborhood": "The Battery",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "lat": 33.8903,
    "lng": -84.4673,
    "venue_type": "sports_bar",
    "spot_type": "sports_bar",
    "website": EVENTS_URL,
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}


def _is_timed_duplicate_conflict(exc: Exception) -> bool:
    text = str(exc)
    return (
        "duplicate key value violates unique constraint" in text
        and "idx_events_unique_source_venue_slot_norm_title_timed" in text
    )


def _parse_time_to_24h(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    value = value.strip()
    for fmt in ("%I:%M %p", "%I %p"):
        try:
            return datetime.strptime(value, fmt).strftime("%H:%M")
        except ValueError:
            continue
    return None


def parse_event_links_from_html(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: list[str] = []
    seen: set[str] = set()
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        if "/events-and-entertainment/events/" not in href:
            continue
        full_url = href if href.startswith("http") else f"{BASE_URL}{href}"
        if full_url in seen:
            continue
        seen.add(full_url)
        links.append(full_url)
    return links


def _extract_jsonld_event(soup: BeautifulSoup) -> Optional[dict[str, Any]]:
    for script in soup.find_all("script", type="application/ld+json"):
        raw = script.string or script.get_text(strip=True)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        candidates: list[dict[str, Any]] = []
        if isinstance(data, dict):
            if data.get("@type") == "Event":
                candidates.append(data)
            if isinstance(data.get("@graph"), list):
                candidates.extend(
                    item for item in data["@graph"] if isinstance(item, dict) and item.get("@type") == "Event"
                )
        elif isinstance(data, list):
            candidates.extend(item for item in data if isinstance(item, dict) and item.get("@type") == "Event")

        if candidates:
            return candidates[0]
    return None


def _extract_primary_cta(soup: BeautifulSoup) -> tuple[Optional[str], Optional[str]]:
    anchor = soup.select_one("div[class*='EventDetail_upper_button'] a[href]")
    if not anchor:
        return None, None
    return anchor.get("href"), " ".join(anchor.get_text(" ", strip=True).split())


def _derive_category(title: str, description: str) -> tuple[str, str, list[str]]:
    text = f"{title} {description}".lower()
    tags = ["sports", "sports-bar", "the-battery", "sports-social"]

    if any(word in text for word in ["mma", "fight", "ufc", "kickboxing", "muay thai", "bare knuckle"]):
        return "sports", "sports.mma", tags + ["mma", "fight-night", "combat-sports"]
    if any(word in text for word in ["watch party", "tip-off", "buzzer", "hoops", "basketball", "bracket", "championship"]):
        return "sports", "watch_party", tags + ["watch-party", "basketball"]
    return "sports", "watch_party", tags


def _parse_price_info(text: str, cta_label: Optional[str]) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    amounts = [float(match.replace(",", "")) for match in re.findall(r"\$([\d,]+(?:\.\d{2})?)", text)]
    if amounts:
        lo = min(amounts)
        hi = max(amounts)
        note = f"${int(lo) if lo.is_integer() else lo:g}" if lo == hi else f"${int(lo) if lo.is_integer() else lo:g}-${int(hi) if hi.is_integer() else hi:g}"
        return lo, hi, note, False

    label = (cta_label or "").lower()
    if "reserve" in label:
        return None, None, "Reservation recommended", False
    if "buy" in label:
        return None, None, "Tickets required", False
    return None, None, None, False


def parse_detail_page(html: str, source_url: str) -> Optional[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    event = _extract_jsonld_event(soup)
    if not event:
        return None

    location = event.get("location") or {}
    if isinstance(location, list):
        location = location[0] if location else {}
    location_name = str(location.get("name") or "").strip()
    if location_name != "Sports & Social Atlanta":
        return None

    start_dt = event.get("startDate")
    end_dt = event.get("endDate")
    if not start_dt:
        return None

    try:
        start = datetime.fromisoformat(start_dt.replace("Z", "+00:00"))
    except ValueError:
        return None

    end: Optional[datetime] = None
    if end_dt:
        try:
            end = datetime.fromisoformat(end_dt.replace("Z", "+00:00"))
        except ValueError:
            end = None

    title = str(event.get("name") or "").strip()
    description = BeautifulSoup(str(event.get("description") or ""), "html.parser").get_text(" ", strip=True)
    image_url = event.get("image")
    if isinstance(image_url, list):
        image_url = image_url[0] if image_url else None

    cta_url, cta_label = _extract_primary_cta(soup)
    price_min, price_max, price_note, is_free = _parse_price_info(soup.get_text(" ", strip=True), cta_label)
    category, subcategory, tags = _derive_category(title, description)

    return {
        "title": title,
        "description": description[:1000] if description else None,
        "location_name": location_name,
        "start_date": start.strftime("%Y-%m-%d"),
        "start_time": start.strftime("%H:%M"),
        "end_date": end.strftime("%Y-%m-%d") if end else None,
        "end_time": end.strftime("%H:%M") if end else None,
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
        "price_min": price_min,
        "price_max": price_max,
        "price_note": price_note,
        "is_free": is_free,
        "source_url": source_url,
        "ticket_url": cta_url,
        "image_url": image_url,
        "cta_label": cta_label,
    }


def _fetch_detail(url: str) -> Optional[dict[str, Any]]:
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    return parse_detail_page(response.text, url)


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    venue_id = get_or_create_place(PLACE_DATA)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 2200})
        page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(8000)
        listing_html = page.content()
        browser.close()

    detail_urls = parse_event_links_from_html(listing_html)
    logger.info("Sports & Social listing exposed %s detail URLs", len(detail_urls))

    for detail_url in detail_urls:
        try:
            item = _fetch_detail(detail_url)
        except Exception as exc:
            logger.warning("Failed to fetch Sports & Social detail %s: %s", detail_url, exc)
            continue

        if not item:
            continue

        events_found += 1
        content_hash = generate_content_hash(item["title"], item["location_name"], item["start_date"])
        current_hashes.add(content_hash)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": item["title"],
            "description": item["description"],
            "start_date": item["start_date"],
            "start_time": item["start_time"],
            "end_date": item["end_date"],
            "end_time": item["end_time"],
            "is_all_day": False,
            "category": item["category"],
            "subcategory": item["subcategory"],
            "tags": item["tags"],
            "price_min": item["price_min"],
            "price_max": item["price_max"],
            "price_note": item["price_note"],
            "is_free": item["is_free"],
            "source_url": item["source_url"],
            "ticket_url": item["ticket_url"],
            "image_url": item["image_url"],
            "raw_text": f"{item['title']} | {item['start_date']} {item['start_time']} | {item.get('cta_label') or ''}",
            "extraction_confidence": 0.94,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record)
            events_new += 1
            logger.info("Added Sports & Social event: %s", item["title"])
        except Exception as exc:
            if not _is_timed_duplicate_conflict(exc):
                raise
            existing = find_existing_event_for_insert(event_record)
            if not existing:
                raise
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            logger.info(
                "Resolved Sports & Social duplicate as update: %s",
                item["title"],
            )

    remove_stale_source_events(source_id, current_hashes)
    logger.info(
        "Sports & Social crawl complete: found=%s new=%s updated=%s",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
