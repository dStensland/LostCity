"""
Crawler for Atlanta Home and Remodeling Show.

Official source:
- The Nationwide Expos Atlanta category page lists the current Atlanta product
  pages.
- Each Atlanta product page publishes the official date range, venue, and
  daily public show hours.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime, timedelta

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

CATEGORY_URL = "https://nationwideexpos.com/product-category/east-coast/georgia/atlanta/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

PLACE_DATA = {
    "name": "Atlanta Exposition Center South",
    "slug": "atlanta-exposition-center-south",
    "address": "3850 Jonesboro Rd",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30354",
    "lat": 33.6466,
    "lng": -84.4187,
    "place_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://www.atlantaexpositioncenters.com/",
}


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


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
        r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)",
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


def extract_product_urls(category_html: str) -> list[str]:
    """Return the current Atlanta product pages from the official category page."""
    soup = BeautifulSoup(category_html, "html.parser")
    urls: list[str] = []
    seen: set[str] = set()

    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if "/product/atlanta-" not in href:
            continue
        normalized = href.split("#", 1)[0].split("?", 1)[0]
        if normalized in seen:
            continue
        seen.add(normalized)
        urls.append(normalized)

    return urls


def _extract_product_metadata(html: str) -> tuple[str | None, str | None]:
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.find_all("script", type="application/ld+json"):
        payload = script.string or script.get_text()
        if not payload or '"@type":"Product"' not in payload.replace(" ", ""):
            continue
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            continue
        graph = data.get("@graph") if isinstance(data, dict) else None
        if not isinstance(graph, list):
            continue
        for entry in graph:
            if not isinstance(entry, dict) or entry.get("@type") != "Product":
                continue
            return entry.get("description"), entry.get("image")
    return None, None


def parse_product_page(html: str, source_url: str, today: date | None = None) -> dict:
    """Parse one official Atlanta Nationwide Expos product page."""
    today = today or datetime.now().date()
    description, image_url = _extract_product_metadata(html)
    page_text = _clean_text((description or "") + " " + BeautifulSoup(html, "html.parser").get_text(" ", strip=True))

    title_match = re.search(
        r"Atlanta Home(?:\s+and)?\s+Remodeling Show",
        page_text,
        re.IGNORECASE,
    )
    if not title_match:
        raise ValueError(f"{source_url} did not expose the official Atlanta Home and Remodeling Show title")

    date_match = re.search(
        r"([A-Za-z]+)\s+(\d{1,2})\s*[–-]\s*(?:(?:([A-Za-z]+)\s+)?(\d{1,2})),\s*(\d{4})",
        page_text,
        re.IGNORECASE,
    )
    if not date_match:
        raise ValueError(f"{source_url} did not expose an Atlanta Home and Remodeling Show date range")

    start_month_name, start_day_str, end_month_name, end_day_str, year_str = date_match.groups()
    year = int(year_str)
    start_month = datetime.strptime(start_month_name[:3], "%b").month
    end_month = datetime.strptime((end_month_name or start_month_name)[:3], "%b").month
    start_date = date(year, start_month, int(start_day_str))
    end_date = date(year, end_month, int(end_day_str))
    if end_date < today:
        raise ValueError(f"{source_url} only exposes a past-dated Atlanta Home and Remodeling Show cycle")

    hours_matches = re.findall(
        r"(Friday|Saturday|Sunday)\s+(\d{1,2}:\d{2}\s*(?:am|pm)\s*[–-]\s*\d{1,2}:\d{2}\s*(?:am|pm))",
        page_text,
        re.IGNORECASE,
    )
    if len(hours_matches) < 3:
        raise ValueError(f"{source_url} did not expose the expected Friday-Sunday public hours")

    if "Atlanta Expo Center South" not in page_text or "3850 Jonesboro Rd" not in page_text:
        raise ValueError(f"{source_url} did not expose the expected Atlanta Expo Center South venue text")

    sessions: list[dict] = []
    for offset, (weekday, time_range) in enumerate(hours_matches[:3]):
        start_time, end_time = _parse_time_range(time_range)
        if not start_time or not end_time:
            raise ValueError(f"{source_url} time parsing failed for {weekday}")
        session_date = start_date + timedelta(days=offset)
        sessions.append(
            {
                "title": "Atlanta Home and Remodeling Show",
                "weekday": weekday.lower(),
                "start_date": session_date.isoformat(),
                "start_time": start_time,
                "end_time": end_time,
            }
        )

    return {
        "title": "Atlanta Home and Remodeling Show",
        "image_url": image_url,
        "source_url": source_url,
        "sessions": sessions,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the official Nationwide Expos Atlanta category and product pages."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    category_response = requests.get(
        CATEGORY_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    category_response.raise_for_status()
    product_urls = extract_product_urls(category_response.text)
    if not product_urls:
        raise ValueError("Nationwide Expos Atlanta category page did not yield any Atlanta product URLs")

    venue_id = get_or_create_place(PLACE_DATA)
    description = (
        "Atlanta Home and Remodeling Show brings home-improvement vendors, remodeling specialists, "
        "design inspiration, and consumer shopping to Atlanta Exposition Center South."
    )

    parsed_shows: list[dict] = []
    for product_url in product_urls:
        response = requests.get(
            product_url,
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        response.raise_for_status()
        parsed = parse_product_page(response.text, product_url)
        parsed_shows.append(parsed)

    parsed_shows.sort(key=lambda item: item["sessions"][0]["start_date"])

    for show in parsed_shows:
        for session in show["sessions"]:
            content_hash = generate_content_hash(session["title"], PLACE_DATA["name"], session["start_date"])
            current_hashes.add(content_hash)
            events_found += 1

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": session["title"],
                "description": description,
                "start_date": session["start_date"],
                "start_time": session["start_time"],
                "end_date": None,
                "end_time": session["end_time"],
                "is_all_day": False,
                "category": "community",
                "subcategory": "expo",
                "tags": ["home", "home-improvement", "remodeling", "shopping", "expo"],
                "price_min": None,
                "price_max": None,
                "price_note": "See the official show page for current exhibitor and attendance details.",
                "is_free": False,
                "source_url": show["source_url"],
                "ticket_url": None,
                "image_url": show["image_url"],
                "raw_text": (
                    f"{session['title']} | {session['start_date']} | "
                    f"{session['start_time']}-{session['end_time']} | Atlanta Expo Center South"
                ),
                "extraction_confidence": 0.95,
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
        logger.info(
            "Removed %s stale Atlanta Home and Remodeling Show events after refresh",
            stale_removed,
        )

    logger.info(
        "Atlanta Home and Remodeling Show crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
