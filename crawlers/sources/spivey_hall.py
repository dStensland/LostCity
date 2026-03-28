"""
Crawler for Spivey Hall (spiveyhall.org).

Acoustic concert hall at Clayton State University in Morrow, GA.
Known for exceptional acoustics and classical/chamber music performances.

Site runs WordPress + Event Organiser plugin with a FullCalendar AJAX JSON API.
No Playwright needed — plain HTTP requests.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
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

logger = logging.getLogger(__name__)

BASE_URL = "https://spiveyhall.org"
# Event Organiser FullCalendar AJAX endpoint
FULLCAL_API = f"{BASE_URL}/wp-admin/admin-ajax.php"
REQUEST_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"}

PLACE_DATA = {
    "name": "Spivey Hall",
    "slug": "spivey-hall",
    "address": "2000 Clayton State Blvd",
    "neighborhood": "Morrow",
    "city": "Morrow",
    "state": "GA",
    "zip": "30260",
    "lat": 33.5413,
    "lng": -84.3527,
    "place_type": "concert_hall",
    "spot_type": "concert_hall",
    "website": BASE_URL,
    "description": (
        "World-class 392-seat acoustic concert hall at Clayton State University. "
        "Known for exceptional acoustics and intimate performances of classical, "
        "chamber, choral, and jazz music."
    ),
    "vibes": ["classical", "acoustic", "performing-arts", "intimate"],
}

# Event Organiser category slug → our category
_CATEGORY_MAP = {
    "piano-concert": ("music", "classical"),
    "vocal": ("music", "classical"),
    "organ": ("music", "classical"),
    "choral": ("music", "choral"),
    "chamber-music": ("music", "chamber"),
    "string": ("music", "classical"),
    "educational-program": ("learning", None),
    "ypc": ("family", None),  # Young People's Concerts
}


def _parse_iso_local(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse ISO-ish datetime string like '2026-03-21T20:00:00' into (date, time)."""
    if not dt_str:
        return None, None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except ValueError:
        pass
    # Fallback: date only
    m = re.match(r"(\d{4}-\d{2}-\d{2})", dt_str)
    if m:
        return m.group(1), None
    return None, None


def _infer_category(categories: list[str], title: str) -> tuple[str, Optional[str], list[str]]:
    """Map Event Organiser categories to our taxonomy."""
    tags = ["spivey-hall", "clayton-state", "morrow", "performing-arts"]

    for cat_slug in categories:
        if cat_slug in _CATEGORY_MAP:
            category, subcategory = _CATEGORY_MAP[cat_slug]
            tags.append(cat_slug.replace("-", "-"))
            if cat_slug == "ypc":
                tags.extend(["kids", "family-friendly", "educational"])
            return category, subcategory, tags

    # Keyword fallback
    title_lower = title.lower()
    if any(w in title_lower for w in ("jazz", "quartet", "trio")):
        tags.append("jazz")
        return "music", "jazz", tags
    if any(w in title_lower for w in ("choir", "choral", "chorus")):
        tags.append("choral")
        return "music", "choral", tags

    # Default: classical music (Spivey Hall's bread and butter)
    tags.append("classical")
    return "music", "classical", tags


def _fetch_detail(event_url: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Fetch event detail page for description, price, and ticket URL."""
    description = None
    price_note = None
    ticket_url = None
    try:
        resp = requests.get(event_url, timeout=15, headers=REQUEST_HEADERS)
        if not resp.ok:
            return None, None, None
        soup = BeautifulSoup(resp.text, "html.parser")

        # Description from first substantial paragraph
        for p in soup.find_all("p"):
            text = p.get_text(strip=True)
            if len(text) > 80:
                description = text[:500]
                break

        # Price from "Starting at $XX" pattern
        body_text = soup.get_text()
        price_match = re.search(r"(?:starting at|tickets?:?)\s*\$(\d+)", body_text, re.I)
        if price_match:
            price_note = f"Starting at ${price_match.group(1)}"

        # Ticket URL from Salesforce link
        ticket_link = soup.find("a", href=re.compile(r"salesforce-sites\.com/ticket"))
        if ticket_link:
            ticket_url = ticket_link["href"]
    except Exception as e:
        logger.debug("Failed to fetch detail %s: %s", event_url, e)

    return description, price_note, ticket_url


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Spivey Hall events via Event Organiser FullCalendar AJAX API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()
    today = datetime.now()

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        # Fetch 6-month window from the FullCalendar API
        start_date = today.strftime("%Y-%m-%d")
        end_date = (today + timedelta(days=180)).strftime("%Y-%m-%d")

        logger.info("Fetching Spivey Hall events: %s → %s", start_date, end_date)
        resp = requests.get(
            FULLCAL_API,
            params={
                "action": "eventorganiser-fullcal",
                "start": start_date,
                "end": end_date,
            },
            timeout=30,
            headers=REQUEST_HEADERS,
        )
        resp.raise_for_status()
        events_data = resp.json()

        if not isinstance(events_data, list):
            logger.warning("Unexpected API response type: %s", type(events_data))
            return 0, 0, 0

        logger.info("Found %d events from FullCalendar API", len(events_data))

        for event in events_data:
            title = (event.get("title") or "").strip()
            if not title or len(title) < 3:
                continue

            # Skip past events (className includes eo-event-past)
            class_names = event.get("className", [])
            if "eo-event-past" in class_names:
                continue

            start_date_str, start_time = _parse_iso_local(event.get("start", ""))
            end_date_str, end_time = _parse_iso_local(event.get("end", ""))

            if not start_date_str:
                continue

            # Skip past
            try:
                if datetime.strptime(start_date_str, "%Y-%m-%d").date() < today.date():
                    continue
            except ValueError:
                continue

            is_all_day = event.get("allDay", False)

            # Categories from the API
            cat_slugs = event.get("category", []) or []
            category, subcategory, tags = _infer_category(cat_slugs, title)

            # Event detail URL
            event_url = event.get("url", "")
            if event_url and not event_url.startswith("http"):
                event_url = BASE_URL + event_url

            # Fetch detail page for description, price, ticket URL
            description = None
            price_note = None
            ticket_url = None
            if event_url:
                description, price_note, ticket_url = _fetch_detail(event_url)

            # Parse price
            price_min = None
            price_max = None
            is_free = False
            if price_note:
                m = re.search(r"\$(\d+)", price_note)
                if m:
                    price_min = float(m.group(1))

            events_found += 1

            hash_key = f"{start_date_str}|{start_time}" if start_time else start_date_str
            content_hash = generate_content_hash(title, "Spivey Hall", hash_key)
            seen_hashes.add(content_hash)

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": description or f"{title} at Spivey Hall",
                "start_date": start_date_str,
                "start_time": start_time if not is_all_day else None,
                "end_date": end_date_str,
                "end_time": end_time if not is_all_day else None,
                "is_all_day": is_all_day,
                "category": category,
                "subcategory": subcategory,
                "tags": sorted(set(tags)),
                "price_min": price_min,
                "price_max": price_max,
                "price_note": price_note,
                "is_free": is_free,
                "source_url": event_url or BASE_URL,
                "ticket_url": ticket_url or event_url,
                "image_url": None,  # FullCalendar API doesn't include images
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
                logger.info("Added: %s (%s)", title, start_date_str)
            except Exception as e:
                logger.error("Failed to insert: %s: %s", title, e)

        if seen_hashes:
            stale_removed = remove_stale_source_events(source_id, seen_hashes)
            if stale_removed:
                logger.info("Removed %d stale Spivey Hall events", stale_removed)

        logger.info(
            "Spivey Hall crawl complete: %d found, %d new, %d updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Spivey Hall: %s", exc)
        raise

    return events_found, events_new, events_updated
