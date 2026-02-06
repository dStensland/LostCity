"""
Crawler for Atlanta Film Society (atlantafilmsociety.org).
Year-round film screenings, events, and education programs.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantafilmsociety.org"
EVENTS_URL = f"{BASE_URL}/upcoming"

VENUE_DATA = {
    "name": "Atlanta Film Society",
    "slug": "atlanta-film-society",
    "address": "535 Means St NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "venue_type": "cinema",
    "website": BASE_URL,
}


def parse_date(date_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date from 'Jan 12, 2026' or 'Feb 7, 2026 – Feb 28, 2026' format."""
    current_year = datetime.now().year

    # Range format: "Feb 7, 2026 – Feb 28, 2026"
    range_match = re.match(
        r"(\w+)\s+(\d+),?\s*(\d{4})\s*[–-]\s*(\w+)\s+(\d+),?\s*(\d{4})", date_str
    )
    if range_match:
        m1, d1, y1, m2, d2, y2 = range_match.groups()
        for fmt in ["%b %d, %Y", "%B %d, %Y"]:
            try:
                start = datetime.strptime(f"{m1} {d1}, {y1}", fmt)
                end = datetime.strptime(f"{m2} {d2}, {y2}", fmt)
                return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
            except ValueError:
                continue

    # Single date: "Jan 12, 2026"
    single_match = re.match(r"(\w+)\s+(\d+),?\s*(\d{4})?", date_str)
    if single_match:
        month, day, year = single_match.groups()
        year = year or str(current_year)
        for fmt in ["%b %d, %Y", "%B %d, %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day}, {year}", fmt)
                return dt.strftime("%Y-%m-%d"), None
            except ValueError:
                continue

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Film Society events."""
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

            logger.info(f"Fetching Atlanta Film Society: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            venue_id = get_or_create_venue(VENUE_DATA)

            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Pattern: Date line followed by event title
            # "Jan 12, 2026" then "MEMBER Exclusive Screening: 28 YEARS LATER"
            i = 0
            while i < len(lines):
                line = lines[i]

                # Look for date patterns
                date_match = re.match(
                    r"^(\w{3}\s+\d+,?\s*\d{4}(?:\s*[–-]\s*\w{3}\s+\d+,?\s*\d{4})?)",
                    line,
                )
                if date_match and i + 1 < len(lines):
                    date_str = date_match.group(1)
                    title = lines[i + 1]

                    # Skip navigation items
                    skip_words = [
                        "SKIP TO",
                        "ABOUT",
                        "SCREENINGS",
                        "EDUCATION",
                        "SUPPORT",
                        "DONATE",
                        "LOGIN",
                        "ACCOUNT",
                        "UPCOMING",
                    ]
                    if any(w.lower() in title.lower() for w in skip_words):
                        i += 1
                        continue

                    if len(title) < 5:
                        i += 1
                        continue

                    start_date, end_date = parse_date(date_str)
                    if not start_date:
                        i += 1
                        continue

                    # Get description if available
                    description = None
                    if i + 2 < len(lines):
                        desc_line = lines[i + 2]
                        if len(desc_line) > 20 and not re.match(
                            r"^\w{3}\s+\d+", desc_line
                        ):
                            description = desc_line[:300]

                    events_found += 1

                    content_hash = generate_content_hash(
                        title, "Atlanta Film Society", start_date
                    )

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        continue

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": None,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "film",
                        "subcategory": "screening",
                        "tags": ["film", "screening", "atlanta-film-society"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
                        "image_url": image_map.get(title),
                        "raw_text": None,
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Atlanta Film Society crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Film Society: {e}")
        raise

    return events_found, events_new, events_updated
