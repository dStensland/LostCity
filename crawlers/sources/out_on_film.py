"""
Crawler for Out on Film (outonfilm.org).
Atlanta's LGBTQ film festival running for over 35 years.
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

BASE_URL = "https://outonfilm.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Out on Film Festival",
    "slug": "out-on-film",
    "address": "931 Monroe Drive NE",  # Often at Landmark Midtown
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "venue_type": "festival",
    "website": BASE_URL,
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    current_year = datetime.now().year
    months = {
        "JAN": 1,
        "FEB": 2,
        "MAR": 3,
        "APR": 4,
        "MAY": 5,
        "JUN": 6,
        "JUL": 7,
        "AUG": 8,
        "SEP": 9,
        "OCT": 10,
        "NOV": 11,
        "DEC": 12,
    }

    # Format: "FEB 4"
    match = re.match(r"([A-Z]{3})\s*(\d{1,2})", date_str.upper())
    if match:
        month_abbr, day = match.groups()
        if month_abbr in months:
            month = months[month_abbr]
            year = current_year
            # If date is in past, use next year
            dt = datetime(year, month, int(day))
            if dt.date() < datetime.now().date():
                dt = datetime(year + 1, month, int(day))
            return dt.strftime("%Y-%m-%d")
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Out on Film events."""
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

            logger.info(f"Fetching Out on Film: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            venue_id = get_or_create_venue(VENUE_DATA)

            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Look for event pattern: "FEB\n4\n\"Event Title\"..."
            i = 0
            while i < len(lines):
                line = lines[i]

                # Month abbreviation
                if re.match(
                    r"^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$", line.upper()
                ):
                    if i + 2 < len(lines):
                        day_line = lines[i + 1]
                        title_line = lines[i + 2]

                        # Check if next line is a day number
                        if re.match(r"^\d{1,2}$", day_line):
                            date_str = f"{line} {day_line}"
                            start_date = parse_date(date_str)

                            if start_date and len(title_line) > 3:
                                # Clean up title (remove quotes if present)
                                title = title_line.strip('"').strip("'")

                                # Skip navigation items
                                skip_words = [
                                    "VIEW MORE",
                                    "LEARN MORE",
                                    "SUBMIT",
                                    "UPCOMING",
                                ]
                                if any(w.lower() in title.lower() for w in skip_words):
                                    i += 1
                                    continue

                                events_found += 1

                                content_hash = generate_content_hash(
                                    title, "Out on Film", start_date
                                )

                                existing = find_event_by_hash(content_hash)
                                if existing:
                                    events_updated += 1
                                else:
                                    event_record = {
                                        "source_id": source_id,
                                        "venue_id": venue_id,
                                        "title": title,
                                        "description": "Out on Film LGBTQ film festival screening",
                                        "start_date": start_date,
                                        "start_time": None,
                                        "end_date": None,
                                        "end_time": None,
                                        "is_all_day": False,
                                        "category": "film",
                                        "subcategory": "festival",
                                        "tags": [
                                            "film",
                                            "festival",
                                            "lgbtq",
                                            "out-on-film",
                                        ],
                                        "price_min": None,
                                        "price_max": None,
                                        "price_note": None,
                                        "is_free": False,
                                        "source_url": BASE_URL,
                                        "ticket_url": None,
                                        "image_url": None,
                                        "raw_text": None,
                                        "extraction_confidence": 0.85,
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
            f"Out on Film crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Out on Film: {e}")
        raise

    return events_found, events_new, events_updated
