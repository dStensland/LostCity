"""
Crawler for Georgia STAND-UP public events.

Source: https://www.georgiastandup.org/event-list
Platform: Wix Events viewer

Georgia STAND-UP is a metro-Atlanta civic organizing group focused on worker
power, civic engagement, transit equity, and voter empowerment. The public
events surface is currently sparse, but this crawler keeps the source tracked
and ready whenever official events are published.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.georgiastandup.org"
EVENTS_URL = f"{BASE_URL}/event-list"
VOLUNTEER_URL = f"{BASE_URL}/volunteer"

PLACE_DATA = {
    "name": "Georgia STAND-UP",
    "slug": "georgia-stand-up",
    "address": "Atlanta, GA",
    "neighborhood": "Citywide",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7490,
    "lng": -84.3880,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "description": "Georgia STAND-UP civic organizing group focused on worker power, civic engagement, and community advocacy across metro Atlanta.",
}

BASE_TAGS = ["civic", "advocacy", "community-organizing", "attend"]

CARD_SELECTORS = [
    "[data-hook='event-list-item']",
    "[data-hook='list-item-root']",
    "[data-hook='event-container']",
    "article[class*='event']",
    "li[class*='event']",
    "div[class*='event'] article",
]

TAG_RULES: list[tuple[str, list[str]]] = [
    (r"canvass|phone bank|text bank|voter registration|letter writing", ["volunteer", "outreach"]),
    (r"worker power|labor|union", ["labor"]),
    (r"transit", ["transit"]),
    (r"training|workshop|academy", ["training", "education"]),
    (r"civic engagement|legislative advocacy|justice", ["civic-engagement"]),
]


def _clean_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _body_has_no_events(text: str) -> bool:
    normalized = _clean_text(text).lower()
    return "no events at the moment" in normalized


def _parse_date(value: str) -> Optional[str]:
    cleaned = _clean_text(value)
    if not cleaned:
        return None

    for fmt in (
        "%A, %B %d, %Y",
        "%B %d, %Y",
        "%b %d, %Y",
        "%m/%d/%Y",
    ):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def _parse_time(value: str) -> Optional[str]:
    cleaned = _clean_text(value)
    if not cleaned:
        return None

    match = re.search(r"(\d{1,2}:\d{2}\s*(?:AM|PM))", cleaned, re.IGNORECASE)
    if not match:
        return None

    try:
        return datetime.strptime(match.group(1).upper(), "%I:%M %p").strftime("%H:%M")
    except ValueError:
        return None


def _enrich_tags(text: str) -> list[str]:
    lowered = text.lower()
    tags: list[str] = []
    for pattern, extra in TAG_RULES:
        if re.search(pattern, lowered):
            tags.extend(extra)
    return list(dict.fromkeys(tags))


def _extract_cards(page) -> list[dict[str, str | None]]:
    cards: list[dict[str, str | None]] = []

    for selector in CARD_SELECTORS:
        elements = page.query_selector_all(selector)
        if not elements:
            continue

        for element in elements:
            try:
                text = _clean_text(element.inner_text())
                if len(text) < 8:
                    continue

                title = None
                start_date = None
                start_time = None
                description_parts: list[str] = []

                for line in [segment.strip() for segment in text.split("\n") if segment.strip()]:
                    if title is None and len(line) > 4 and line.lower() not in {"register", "read more"}:
                        title = line
                        continue
                    if start_date is None:
                        parsed_date = _parse_date(line)
                        if parsed_date:
                            start_date = parsed_date
                            continue
                    if start_time is None:
                        parsed_time = _parse_time(line)
                        if parsed_time:
                            start_time = parsed_time
                            continue
                    description_parts.append(line)

                anchor = element.query_selector("a[href]")
                href = anchor.get_attribute("href") if anchor else None
                event_url = urljoin(BASE_URL, href) if href else EVENTS_URL

                if title and start_date:
                    cards.append(
                        {
                            "title": title,
                            "start_date": start_date,
                            "start_time": start_time,
                            "description": _clean_text(" ".join(description_parts)) or None,
                            "event_url": event_url,
                        }
                    )
            except Exception as exc:  # pragma: no cover - per-card failures are non-fatal
                logger.debug("Georgia STAND-UP: failed to parse event card: %s", exc)

        if cards:
            return cards

    return cards


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    venue_id = get_or_create_place(PLACE_DATA)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={"width": 1600, "height": 2400},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
        )

        page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(5000)

        body_text = page.locator("body").inner_text()
        if _body_has_no_events(body_text):
            removed = remove_stale_source_events(source_id, current_hashes)
            logger.info("Georgia STAND-UP: no current public events; removed %s stale rows", removed)
            browser.close()
            return 0, 0, 0

        cards = _extract_cards(page)
        browser.close()

    today = datetime.now().date()
    for card in cards:
        title = _clean_text(card["title"])
        start_date = card["start_date"]
        start_time = card["start_time"]
        description = card["description"] or "Georgia STAND-UP civic action event."
        event_url = card["event_url"] or EVENTS_URL

        if not title or not start_date:
            continue

        try:
            if datetime.strptime(start_date, "%Y-%m-%d").date() < today:
                continue
        except ValueError:
            continue

        content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)
        current_hashes.add(content_hash)
        events_found += 1

        tags = list(dict.fromkeys(BASE_TAGS + _enrich_tags(f"{title} {description}")))

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title[:200],
            "description": description[:1200],
            "start_date": start_date,
            "start_time": start_time,
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "community",
            "subcategory": "activism",
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": event_url,
            "ticket_url": event_url,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.7,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
        else:
            insert_event(event_record)
            events_new += 1

    removed = remove_stale_source_events(source_id, current_hashes)
    if removed:
        logger.info("Georgia STAND-UP: removed %s stale future events", removed)

    logger.info(
        "Georgia STAND-UP crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
