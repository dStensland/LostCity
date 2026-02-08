"""
Crawler for Punchline Comedy Club (punchline.com).
National touring comedy acts in Atlanta.
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

BASE_URL = "https://punchline.com"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Punchline Comedy Club",
    "slug": "punchline-comedy-club",
    "address": "3652 Roswell Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30342",
    "venue_type": "comedy_club",
    "website": BASE_URL,
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date from 'Jan 15 - 17' or 'Jan 15' format."""
    try:
        current_year = datetime.now().year

        # Range: "Jan 15 - 17"
        range_match = re.match(r"(\w{3})\s+(\d+)\s*[-–]\s*(\d+)", date_text)
        if range_match:
            month, day1, day2 = range_match.groups()
            for fmt in ["%b %d %Y"]:
                try:
                    start = datetime.strptime(f"{month} {day1} {current_year}", fmt)
                    end = datetime.strptime(f"{month} {day2} {current_year}", fmt)
                    if start < datetime.now():
                        start = datetime.strptime(
                            f"{month} {day1} {current_year + 1}", fmt
                        )
                        end = datetime.strptime(
                            f"{month} {day2} {current_year + 1}", fmt
                        )
                    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
                except ValueError:
                    continue

        # Single: "Jan 15"
        single_match = re.match(r"(\w{3})\s+(\d+)", date_text)
        if single_match:
            month, day = single_match.groups()
            for fmt in ["%b %d %Y"]:
                try:
                    dt = datetime.strptime(f"{month} {day} {current_year}", fmt)
                    if dt < datetime.now():
                        dt = datetime.strptime(f"{month} {day} {current_year + 1}", fmt)
                    return dt.strftime("%Y-%m-%d"), None
                except ValueError:
                    continue

        return None, None
    except Exception:
        return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Punchline events."""
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

            logger.info(f"Fetching Punchline: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            venue_id = get_or_create_venue(VENUE_DATA)

            body_text = page.inner_text("body")

            # Pattern: "Jan 15 - 17 | Atlanta\nComedian Name - Description\nBUY TICKETS"
            # Split by "BUY TICKETS"
            blocks = re.split(r"BUY TICKETS", body_text, flags=re.IGNORECASE)

            for block in blocks:
                lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
                if len(lines) < 2:
                    continue

                title = None
                date_text = None

                for line in lines:
                    # Date pattern with location: "Jan 15 - 17 | Atlanta"
                    date_match = re.match(
                        r"(\w{3}\s+\d+(?:\s*[-–]\s*\d+)?)\s*\|\s*Atlanta", line
                    )
                    if date_match:
                        date_text = date_match.group(1)
                        continue

                    # Title - comedian name (may have description after dash)
                    skip_words = [
                        "Upcoming Shows",
                        "HOME",
                        "SHOWS",
                        "COMEDIANS",
                        "GIFT CARDS",
                    ]
                    if (
                        not title
                        and len(line) > 3
                        and not any(w in line for w in skip_words)
                    ):
                        # Clean up - often format is "Name - Description"
                        title = line.split(" - ")[0].strip() if " - " in line else line
                        if len(title) < 3:
                            title = None

                if not title or not date_text:
                    continue

                start_date, end_date = parse_date_range(date_text)
                if not start_date:
                    continue

                events_found += 1

                content_hash = generate_content_hash(
                    title, "Punchline Comedy Club", start_date
                )

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                # Get specific event URL


                event_url = find_event_url(title, event_links, EVENTS_URL)



                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": None,
                    "start_date": start_date,
                    "start_time": None,
                    "end_date": end_date,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "comedy",
                    "subcategory": "standup",
                    "tags": ["comedy", "standup", "punchline"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": event_url,
                    "ticket_url": event_url if event_url != EVENTS_URL else None,
                    "image_url": image_map.get(title),
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

            browser.close()

        logger.info(f"Punchline crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Punchline: {e}")
        raise

    return events_found, events_new, events_updated
