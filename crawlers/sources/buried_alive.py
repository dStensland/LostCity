"""
Crawler for Buried Alive Film Festival (buriedalivefilmfest.com).
Underground horror and independent film festival in Atlanta.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://buriedalivefilmfest.com"

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
    range_match = re.search(
        r"(\w+)\s+(\d+)\s*[-–]\s*(\d+),?\s*(\d{4})",
        text
    )
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
    """Crawl Buried Alive Film Festival."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Buried Alive: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            venue_id = get_or_create_venue(VENUE_DATA)

            body_text = page.inner_text("body")

            # Look for festival dates in format "November 5-8, 2026"
            start_date, end_date = parse_dates(body_text)

            if start_date:
                events_found += 1

                title = "Buried Alive Film Festival 2026"
                content_hash = generate_content_hash(title, "Buried Alive Film Festival", start_date)

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                else:
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
                        "tags": ["film", "festival", "horror", "independent", "buried-alive"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": BASE_URL,
                        "ticket_url": None,
                        "image_url": None,
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

            browser.close()

        logger.info(f"Buried Alive crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Buried Alive: {e}")
        raise

    return events_found, events_new, events_updated
