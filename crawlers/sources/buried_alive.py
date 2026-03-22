"""
Crawler for Buried Alive Film Festival (buriedalivefilmfest.com).
Underground horror and independent film festival in Atlanta.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://buriedalivefilmfest.com"
EVENTS_URL = BASE_URL

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
}

VENUE_DATA = {
    "name": "Buried Alive Film Festival",
    "slug": "buried-alive-film-fest",
    "address": "349 Decatur St SE",  # Various venues
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "venue_type": "festival",
    "website": BASE_URL,
}


def parse_dates(text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse dates from 'November 5-8, 2026' format."""
    # Range: "November 5-8, 2026"
    range_match = re.search(r"(\w+)\s+(\d+)\s*[-–]\s*(\d+),?\s*(\d{4})", text)
    if range_match:
        month, day1, day2, year = range_match.groups()
        for fmt in ["%B %d, %Y", "%b %d, %Y"]:
            try:
                start = datetime.strptime(f"{month} {day1}, {year}", fmt)
                end = datetime.strptime(f"{month} {day2}, {year}", fmt)
                return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
            except ValueError:
                continue
    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Buried Alive Film Festival using requests + BeautifulSoup."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        logger.info(f"Fetching Buried Alive: {BASE_URL}")
        response = requests.get(BASE_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        # Extract event links
        event_links: dict[str, str] = {}
        for a in soup.find_all("a", href=True):
            href = a["href"]
            text = a.get_text(strip=True)
            if text and len(text) > 3:
                if not href.startswith("http"):
                    href = BASE_URL + href if href.startswith("/") else href
                if text.lower() not in event_links:
                    event_links[text.lower()] = href

        # Extract images
        image_map: dict[str, str] = {}
        for img in soup.find_all("img", src=True):
            alt = img.get("alt", "").strip()
            src = img["src"]
            if alt and src and not src.endswith(".svg"):
                if not src.startswith("http"):
                    src = BASE_URL + src if src.startswith("/") else src
                image_map[alt] = src

        venue_id = get_or_create_venue(VENUE_DATA)

        body_text = soup.get_text(separator="\n")

        # Look for festival dates in format "November 5-8, 2026"
        start_date, end_date = parse_dates(body_text)

        if start_date:
            events_found += 1

            title = "Buried Alive Film Festival 2026"
            content_hash = generate_content_hash(
                title, "Buried Alive Film Festival", start_date
            )

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
            else:
                event_url = find_event_url(title, event_links, EVENTS_URL)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": "Underground filmmaking and independent horror film festival. Features screenings, awards, and filmmaker events.",
                    "start_date": start_date,
                    "start_time": None,
                    "end_date": end_date,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "film",
                    "subcategory": "festival",
                    "tags": [
                        "film",
                        "festival",
                        "horror",
                        "independent",
                        "buried-alive",
                    ],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": event_url,
                    "ticket_url": event_url if event_url != EVENTS_URL else None,
                    "image_url": image_map.get(title),
                    "raw_text": None,
                    "extraction_confidence": 0.95,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date} - {end_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

        logger.info(
            f"Buried Alive crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Buried Alive: {e}")
        raise

    return events_found, events_new, events_updated
