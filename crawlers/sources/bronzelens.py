"""
Crawler for BronzeLens Film Festival (bronzelens.com).
Film festival dedicated to showcasing films by and about people of color.
Uses Eventive platform for ticketing and schedule.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://bronzelens.com"
EVENTIVE_URL = "https://bronzelens.eventive.org"

VENUE_DATA = {
    "name": "BronzeLens Film Festival",
    "slug": "bronzelens",
    "address": "Various locations",
    "neighborhood": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "festival",
    "website": BASE_URL,
}

# BronzeLens is typically in August
KNOWN_DATES = {
    2025: ("2025-08-20", "2025-08-24"),  # Estimated
    2026: ("2026-08-19", "2026-08-23"),  # Estimated
}


def parse_dates(text: str) -> tuple[str | None, str | None]:
    """Parse dates from text like 'August 20-24, 2025'."""
    # Range: "August 20-24, 2025"
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
    """Crawl BronzeLens Film Festival."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    now = datetime.now()
    year = now.year

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching BronzeLens: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            body_text = page.inner_text("body")

            # Try to find dates on the page
            start_date, end_date = parse_dates(body_text)

            # Fall back to known dates
            if not start_date:
                if year in KNOWN_DATES:
                    start_date, end_date = KNOWN_DATES[year]
                elif year + 1 in KNOWN_DATES:
                    year = year + 1
                    start_date, end_date = KNOWN_DATES[year]

            if not start_date:
                logger.warning("Could not determine BronzeLens dates")
                browser.close()
                return 0, 0, 0

            # Check if past
            if datetime.strptime(end_date, "%Y-%m-%d") < now:
                year += 1
                if year in KNOWN_DATES:
                    start_date, end_date = KNOWN_DATES[year]
                else:
                    logger.warning(f"No known dates for BronzeLens {year}")
                    browser.close()
                    return 0, 0, 0

            browser.close()

        venue_id = get_or_create_venue(VENUE_DATA)
        events_found = 1

        title = f"BronzeLens Film Festival {year}"
        content_hash = generate_content_hash(title, "BronzeLens", start_date)

        if find_event_by_hash(content_hash):
            events_updated = 1
            logger.info(f"BronzeLens {year} already exists")
            return events_found, events_new, events_updated

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": "Film festival dedicated to showcasing films by and about people of color. Features screenings, workshops, industry panels, and the Filmmakers Ball.",
            "start_date": start_date,
            "start_time": None,
            "end_date": end_date,
            "end_time": None,
            "is_all_day": False,
            "category": "film",
            "subcategory": "festival",
            "tags": ["bronzelens", "film-festival", "black-cinema", "diversity", "filmmakers"],
            "price_min": None,
            "price_max": None,
            "price_note": "Various pass options available",
            "is_free": False,
            "source_url": BASE_URL,
            "ticket_url": EVENTIVE_URL,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.90,
            "is_recurring": True,
            "recurrence_rule": "FREQ=YEARLY;BYMONTH=8",
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new = 1
            logger.info(f"Added: {title}")
        except Exception as e:
            logger.error(f"Failed to insert BronzeLens: {e}")

    except Exception as e:
        logger.error(f"Failed to crawl BronzeLens: {e}")
        raise

    return events_found, events_new, events_updated
