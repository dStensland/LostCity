"""
API adapters for the pipeline.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any
from html.parser import HTMLParser

import requests

from sources import ticketmaster as tm
from sources import ticketmaster_nashville as tm_nash
from sources import eventbrite as eb
from sources import eventbrite_nashville as eb_nash

logger = logging.getLogger(__name__)

AEG_BASE_URL = "https://aegwebprod.blob.core.windows.net/json/events"


def discover_events(
    adapter: str,
    limit: int | None = None,
    params: dict | None = None,
) -> list[dict[str, Any]]:
    if adapter == "ticketmaster":
        return _discover_ticketmaster(limit=limit)
    if adapter == "ticketmaster-nashville":
        return _discover_ticketmaster_nashville(limit=limit)
    if adapter == "eventbrite":
        return _discover_eventbrite(limit=limit)
    if adapter == "eventbrite-nashville":
        return _discover_eventbrite_nashville(limit=limit)
    if adapter == "aeg":
        venue_id = (params or {}).get("venue_id", "211")
        return _discover_aeg(venue_id=venue_id, limit=limit)
    raise ValueError(f"Unknown API adapter: {adapter}")


# ---------------------------------------------------------------------------
# Ticketmaster (Atlanta)
# ---------------------------------------------------------------------------

def _discover_ticketmaster(limit: int | None = None) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    page = 0
    size = 200

    while True:
        try:
            data = tm.fetch_events(page=page, size=size)
        except requests.HTTPError as e:
            status = getattr(e.response, "status_code", None)
            if status == 400:
                logger.warning(
                    "Ticketmaster returned 400 on page %s; stopping pagination",
                    page,
                )
                break
            raise
        embedded = data.get("_embedded", {}) if isinstance(data, dict) else {}
        raw_events = embedded.get("events", []) if embedded else []

        for raw in raw_events:
            parsed = tm.parse_event(raw)
            if parsed:
                events.append(parsed)
                if limit and len(events) >= limit:
                    return events

        page_info = data.get("page", {}) if isinstance(data, dict) else {}
        total_pages = page_info.get("totalPages")
        if total_pages is None:
            break
        if page >= total_pages - 1:
            break
        page += 1

    return events


# ---------------------------------------------------------------------------
# Ticketmaster (Nashville)
# ---------------------------------------------------------------------------

def _discover_ticketmaster_nashville(limit: int | None = None) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    page = 0
    size = 200

    while True:
        try:
            data = tm_nash.fetch_events(page=page, size=size)
        except requests.HTTPError as e:
            status = getattr(e.response, "status_code", None)
            if status == 400:
                logger.warning(
                    "Ticketmaster Nashville returned 400 on page %s; stopping pagination",
                    page,
                )
                break
            raise
        embedded = data.get("_embedded", {}) if isinstance(data, dict) else {}
        raw_events = embedded.get("events", []) if embedded else []

        for raw in raw_events:
            parsed = tm_nash.parse_event(raw)
            if parsed:
                events.append(parsed)
                if limit and len(events) >= limit:
                    return events

        page_info = data.get("page", {}) if isinstance(data, dict) else {}
        total_pages = page_info.get("totalPages")
        if total_pages is None:
            break
        if page >= total_pages - 1:
            break
        page += 1

    return events


# ---------------------------------------------------------------------------
# Eventbrite (Atlanta)
# ---------------------------------------------------------------------------

def _discover_eventbrite(limit: int | None = None) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []

    event_ids = eb.discover_event_ids(max_events=limit or 500)
    if not event_ids:
        logger.warning("Eventbrite: no event IDs discovered")
        return events

    for event_id in event_ids:
        raw = eb.fetch_event_from_api(event_id)
        if not raw:
            continue
        parsed = eb.parse_event_for_pipeline(raw)
        if parsed:
            events.append(parsed)
            if limit and len(events) >= limit:
                return events
        time.sleep(0.2)

    return events


# ---------------------------------------------------------------------------
# Eventbrite (Nashville)
# ---------------------------------------------------------------------------

def _discover_eventbrite_nashville(limit: int | None = None) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []

    event_ids = eb_nash.discover_event_ids(max_events=limit or 500)
    if not event_ids:
        logger.warning("Eventbrite Nashville: no event IDs discovered")
        return events

    for event_id in event_ids:
        raw = eb_nash.fetch_event_from_api(event_id)
        if not raw:
            continue
        parsed = eb_nash.parse_event_for_pipeline(raw)
        if parsed:
            events.append(parsed)
            if limit and len(events) >= limit:
                return events
        time.sleep(0.2)

    return events


# ---------------------------------------------------------------------------
# AEG Presents (venue JSON feed)
# ---------------------------------------------------------------------------

class _HTMLTextExtractor(HTMLParser):
    """Minimal HTML-to-text converter for AEG bio fields."""

    def __init__(self):
        super().__init__()
        self._parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self._parts.append(data)

    def get_text(self) -> str:
        return " ".join(self._parts).strip()


def _strip_html(html: str) -> str:
    if not html:
        return ""
    extractor = _HTMLTextExtractor()
    extractor.feed(html)
    return extractor.get_text()[:2000]


def _parse_aeg_event(event: dict) -> dict[str, Any] | None:
    """Parse a single AEG JSON event into pipeline canonical format."""
    title_obj = event.get("title") or {}
    title = title_obj.get("headlinersText", "").strip()
    if not title:
        title = title_obj.get("text", "").strip()
    if not title:
        return None

    # Parse datetime
    dt_str = event.get("eventDateTime")
    if not dt_str:
        return None

    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        start_date = dt.strftime("%Y-%m-%d")
        start_time = dt.strftime("%H:%M")
    except Exception:
        return None

    if start_date < datetime.now().strftime("%Y-%m-%d"):
        return None

    # Description from bio (HTML)
    description = _strip_html(event.get("bio", ""))

    # Ticketing
    ticketing = event.get("ticketing") or {}
    ticket_url = ticketing.get("url", "")
    price_min = event.get("ticketPriceLow")
    price_max = event.get("ticketPriceHigh")

    # Image — pick largest available size
    media = event.get("media") or {}
    image_url = None
    for size_key in ("19", "18", "17", "16", "15", "14"):
        img = media.get(size_key)
        if img and img.get("file_name"):
            image_url = img["file_name"]
            break

    # Venue info
    venue_raw = event.get("venue") or {}
    venue_dict = None
    if venue_raw.get("title"):
        venue_dict = {
            "name": venue_raw["title"],
            "address": venue_raw.get("address"),
            "city": venue_raw.get("city"),
            "state": venue_raw.get("state"),
            "zip": venue_raw.get("zip"),
        }

    # Source URL — use ticket URL or construct from slug
    source_url = ticket_url or ""

    return {
        "title": title[:500],
        "description": description,
        "start_date": start_date,
        "start_time": start_time,
        "source_url": source_url,
        "ticket_url": ticket_url,
        "image_url": image_url,
        "category": "music",
        "subcategory": "concert",
        "price_min": price_min,
        "price_max": price_max,
        "venue": venue_dict,
    }


def _discover_aeg(venue_id: str, limit: int | None = None) -> list[dict[str, Any]]:
    url = f"{AEG_BASE_URL}/{venue_id}/events.json"
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error("AEG fetch failed for venue %s: %s", venue_id, e)
        return []

    events: list[dict[str, Any]] = []
    raw_events = data if isinstance(data, list) else data.get("events", [])

    for raw in raw_events:
        parsed = _parse_aeg_event(raw)
        if parsed:
            events.append(parsed)
            if limit and len(events) >= limit:
                break

    return events
