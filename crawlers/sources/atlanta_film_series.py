"""
Crawler for Atlanta Film Series (atlantafilmseries.com).
Hosts multiple film festivals throughout the year including:
- ATL DOC (Documentary Film Festival)
- Atlanta Micro Short Film Festival
- Atlanta Experimental Fest
- Atlanta Shortsfest
- Atlanta Underground Film Festival
- Atlanta Horror Film Festival
- Atlanta Spotlight Film Festival
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantafilmseries.com"

VENUE_DATA = {
    "name": "Atlanta Film Series",
    "slug": "atlanta-film-series",
    "address": "349 Decatur St SE",  # Limelight Theater
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "venue_type": "festival",
    "website": BASE_URL,
}

# Known festivals with their typical dates (will be parsed from site)
FESTIVALS = [
    "ATLANTA DOCUMENTARY FILM FESTIVAL",
    "ATLANTA MICRO SHORT FILM FESTIVAL",
    "ATLANTA EXPERIMENTAL FEST",
    "ATLANTA SHORTSFEST",
    "ATLANTA UNDERGROUND FILM FESTIVAL",
    "ATLANTA HORROR FILM FESTIVAL",
    "ATLANTA SPOTLIGHT FILM FESTIVAL",
]


def parse_festival_dates(text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse dates from festival description text."""
    # Range: "March 20 - 22, 2026" or "August 7–9, 2026"
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

    # Single date: "May 16, 2026" or "December 5, 2026"
    single_match = re.search(r"(\w+)\s+(\d+),?\s*(\d{4})", text)
    if single_match:
        month, day, year = single_match.groups()
        for fmt in ["%B %d, %Y", "%b %d, %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day}, {year}", fmt)
                return dt.strftime("%Y-%m-%d"), None
            except ValueError:
                continue

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Film Series festivals."""
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

            logger.info(f"Fetching Atlanta Film Series: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            venue_id = get_or_create_venue(VENUE_DATA)

            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse festivals from page
            current_festival = None
            current_description = []

            for i, line in enumerate(lines):
                # Check if this is a festival header
                is_festival = any(f.lower() in line.lower() for f in FESTIVALS)

                if is_festival and len(line) > 10:
                    # Save previous festival if we have one
                    if current_festival:
                        desc_text = " ".join(current_description)
                        start_date, end_date = parse_festival_dates(desc_text)

                        if start_date:
                            events_found += 1
                            content_hash = generate_content_hash(
                                current_festival, "Atlanta Film Series", start_date
                            )

                            existing = find_event_by_hash(content_hash)
                            if existing:
                                events_updated += 1
                            else:
                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": current_festival,
                                    "description": (
                                        desc_text[:500] if desc_text else None
                                    ),
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
                                        "independent",
                                        "atlanta-film-series",
                                    ],
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": None,
                                    "is_free": False,
                                    "source_url": BASE_URL,
                                    "ticket_url": None,
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
                                    logger.info(
                                        f"Added: {current_festival} on {start_date}"
                                    )
                                except Exception as e:
                                    logger.error(
                                        f"Failed to insert: {current_festival}: {e}"
                                    )

                    # Start new festival
                    current_festival = line
                    current_description = []
                elif current_festival:
                    # Accumulate description
                    current_description.append(line)

            # Process last festival
            if current_festival and current_description:
                desc_text = " ".join(current_description)
                start_date, end_date = parse_festival_dates(desc_text)

                if start_date:
                    events_found += 1
                    content_hash = generate_content_hash(
                        current_festival, "Atlanta Film Series", start_date
                    )

                    existing = find_event_by_hash(content_hash)
                    if not existing:
                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": current_festival,
                            "description": desc_text[:500] if desc_text else None,
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
                                "independent",
                                "atlanta-film-series",
                            ],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": BASE_URL,
                            "ticket_url": None,
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
                            logger.info(f"Added: {current_festival} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {current_festival}: {e}")

            browser.close()

        logger.info(
            f"Atlanta Film Series crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Film Series: {e}")
        raise

    return events_found, events_new, events_updated
