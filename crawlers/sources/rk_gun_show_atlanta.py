"""
Crawler for R.K. Atlanta Gun Show.

Official source:
- The R.K. Shows site search exposes the current Atlanta gun-show event pages.
- Each event page includes structured event data, venue, public show hours, and
  current ticket pricing.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime, timedelta
from typing import Any

import requests
from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SEARCH_URL = "https://rkshows.com/?s=Atlanta+GA+Gun+Show"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def extract_event_urls(search_html: str) -> list[str]:
    """Return unique official Atlanta gun-show event URLs from the site search page."""
    matches = re.findall(r"https://rkshows\.com/event/atlanta-ga-gun-show-\d{6}/", search_html)
    seen: set[str] = set()
    urls: list[str] = []
    for url in matches:
        if url in seen:
            continue
        seen.add(url)
        urls.append(url)
    return urls


def _extract_event_jsonld(html: str, source_url: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.find_all("script", type="application/ld+json"):
        payload = script.string or script.get_text()
        if not payload:
            continue
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            continue
        graph = data.get("@graph") if isinstance(data, dict) else None
        if not isinstance(graph, list):
            continue
        for entry in graph:
            if isinstance(entry, dict) and entry.get("@type") == "Event":
                return entry
    raise ValueError(f"{source_url} did not expose structured Event data")


def _to_24h(hour: str, minute: str, period: str) -> str:
    value = int(hour)
    normalized = period.lower()
    if normalized == "pm" and value != 12:
        value += 12
    if normalized == "am" and value == 12:
        value = 0
    return f"{value:02d}:{minute}"


def _parse_time_range(text: str) -> tuple[str | None, str | None]:
    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)",
        text,
        re.IGNORECASE,
    )
    if not match:
        return None, None
    start_hour, start_minute, start_period, end_hour, end_minute, end_period = match.groups()
    return (
        _to_24h(start_hour, start_minute or "00", start_period),
        _to_24h(end_hour, end_minute or "00", end_period),
    )


def parse_event_page(html: str, source_url: str, today: date | None = None) -> dict:
    """Parse one official Atlanta R.K. Shows event page."""
    today = today or datetime.now().date()
    event = _extract_event_jsonld(html, source_url)
    soup = BeautifulSoup(html, "html.parser")
    page_text = _clean_text(soup.get_text(" ", strip=True))

    start_date = datetime.fromisoformat(event["startDate"]).date()
    end_date = datetime.fromisoformat(event["endDate"]).date()
    if end_date < today:
        raise ValueError(f"{source_url} only exposes a past-dated Atlanta gun-show cycle")

    saturday_match = re.search(r"Saturday:\s*(\d{1,2}\s*AM\s*[–-]\s*\d{1,2}\s*PM)", page_text, re.IGNORECASE)
    sunday_match = re.search(r"Sunday:\s*(\d{1,2}\s*AM\s*[–-]\s*\d{1,2}\s*PM)", page_text, re.IGNORECASE)
    if not saturday_match or not sunday_match:
        raise ValueError(f"{source_url} did not expose the expected Saturday/Sunday public hours")

    saturday_start, saturday_end = _parse_time_range(saturday_match.group(1))
    sunday_start, sunday_end = _parse_time_range(sunday_match.group(1))
    if not saturday_start or not saturday_end or not sunday_start or not sunday_end:
        raise ValueError(f"{source_url} public-hour parsing failed")

    adult_match = re.search(r"Adults?\s*\(Ages 13 & up\):\s*\$([0-9]+(?:\.[0-9]{2})?)", page_text, re.IGNORECASE)
    vip_match = re.search(r"VIP:\s*\$([0-9]+(?:\.[0-9]{2})?)", page_text, re.IGNORECASE)
    child_match = re.search(r"Children\s*\(Ages 6-12\):\s*\$([0-9]+(?:\.[0-9]{2})?)", page_text, re.IGNORECASE)

    location = event.get("location") or {}
    address = location.get("address") or {}
    venue = {
        "name": location.get("name") or "Atlanta Expo Center",
        "slug": "atlanta-expo-center",
        "address": address.get("streetAddress") or "3650 Jonesboro Rd SE",
        "city": address.get("addressLocality") or "Atlanta",
        "state": address.get("addressRegion") or "GA",
        "zip": address.get("postalCode") or "30354",
        "place_type": "convention_center",
        "spot_type": "convention_center",
        "website": "https://rkshows.com/",
    }

    return {
        "title": "R.K. Atlanta Gun Show",
        "source_url": source_url,
        "image_url": event.get("image", {}).get("@id") if isinstance(event.get("image"), dict) else None,
        "description": _clean_text(event.get("description") or ""),
        "venue": venue,
        "price_min": float(adult_match.group(1)) if adult_match else 16.0,
        "price_max": float(vip_match.group(1)) if vip_match else 18.5,
        "price_note": (
            f"Adults 13+ ${adult_match.group(1) if adult_match else '16'}; "
            f"VIP ${vip_match.group(1) if vip_match else '18.50'}; "
            f"Children 6-12 ${child_match.group(1) if child_match else '6'}."
        ),
        "sessions": [
            {
                "title": "R.K. Atlanta Gun Show",
                "start_date": start_date.isoformat(),
                "start_time": saturday_start,
                "end_time": saturday_end,
            },
            {
                "title": "R.K. Atlanta Gun Show",
                "start_date": (start_date + timedelta(days=1)).isoformat(),
                "start_time": sunday_start,
                "end_time": sunday_end,
            },
        ],
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl all current official Atlanta R.K. gun-show pages."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    search_response = requests.get(
        SEARCH_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    search_response.raise_for_status()
    event_urls = extract_event_urls(search_response.text)
    if not event_urls:
        raise ValueError("R.K. Shows search page did not yield any Atlanta gun-show URLs")

    parsed_events: list[dict] = []
    for event_url in event_urls:
        response = requests.get(
            event_url,
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        response.raise_for_status()
        try:
            parsed = parse_event_page(response.text, event_url)
        except ValueError as exc:
            if "past-dated Atlanta gun-show cycle" in str(exc):
                logger.info("Skipping stale R.K. Atlanta Gun Show page: %s", event_url)
                continue
            raise
        parsed_events.append(parsed)

    if not parsed_events:
        raise ValueError("R.K. Shows search page did not yield any future Atlanta gun-show pages")

    parsed_events.sort(key=lambda item: item["sessions"][0]["start_date"])
    venue_ids: dict[str, int] = {}

    for parsed in parsed_events:
        venue = parsed["venue"]
        venue_slug = venue["slug"]
        if venue_slug not in venue_ids:
            venue_ids[venue_slug] = get_or_create_place(venue)

        description = parsed["description"] or (
            "R.K. Atlanta Gun Show brings firearms, knives, outdoor gear, accessories, "
            "and collector vendors to Atlanta Expo Center."
        )

        for session in parsed["sessions"]:
            content_hash = generate_content_hash(session["title"], venue["name"], session["start_date"])
            current_hashes.add(content_hash)
            events_found += 1

            event_record = {
                "source_id": source_id,
                "place_id": venue_ids[venue_slug],
                "title": session["title"],
                "description": description,
                "start_date": session["start_date"],
                "start_time": session["start_time"],
                "end_date": None,
                "end_time": session["end_time"],
                "is_all_day": False,
                "category": "community",
                "subcategory": "expo",
                "tags": ["collectibles", "outdoors", "shopping", "show"],
                "price_min": parsed["price_min"],
                "price_max": parsed["price_max"],
                "price_note": parsed["price_note"],
                "is_free": False,
                "source_url": parsed["source_url"],
                "ticket_url": parsed["source_url"],
                "image_url": parsed["image_url"],
                "raw_text": (
                    f"{session['title']} | {session['start_date']} | "
                    f"{session['start_time']}-{session['end_time']} | {venue['name']}"
                ),
                "extraction_confidence": 0.97,
                "content_hash": content_hash,
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
            else:
                insert_event(event_record)
                events_new += 1

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale R.K. Atlanta Gun Show events after refresh", stale_removed)

    logger.info(
        "R.K. Atlanta Gun Show crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
