"""
Crawler for Atlanta Opera (atlantaopera.org).
Professional opera company performances.
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

BASE_URL = "https://www.atlantaopera.org"
PERFORMANCES_URL = f"{BASE_URL}/performances/"

VENUE_DATA = {
    "name": "Cobb Energy Performing Arts Centre",
    "slug": "cobb-energy-centre",
    "address": "2800 Cobb Galleria Pkwy",
    "neighborhood": "Galleria",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "venue_type": "performing_arts",
    "website": "https://www.cobbenergycentre.com",
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date from 'MARCH 14, 2026 - MARCH 22, 2026' format."""
    try:
        # Range: "MARCH 14, 2026 - MARCH 22, 2026"
        range_match = re.match(
            r"(\w+)\s+(\d+),?\s*(\d{4})\s*[-–]\s*(\w+)\s+(\d+),?\s*(\d{4})",
            date_text,
            re.IGNORECASE,
        )
        if range_match:
            m1, d1, y1, m2, d2, y2 = range_match.groups()
            for fmt in ["%B %d, %Y", "%b %d, %Y"]:
                try:
                    start = datetime.strptime(f"{m1} {d1}, {y1}", fmt)
                    end = datetime.strptime(f"{m2} {d2}, {y2}", fmt)
                    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
                except ValueError:
                    continue

        # Single: "MARCH 14, 2026"
        single_match = re.match(r"(\w+)\s+(\d+),?\s*(\d{4})", date_text, re.IGNORECASE)
        if single_match:
            month, day, year = single_match.groups()
            for fmt in ["%B %d, %Y", "%b %d, %Y"]:
                try:
                    dt = datetime.strptime(f"{month} {day}, {year}", fmt)
                    return dt.strftime("%Y-%m-%d"), None
                except ValueError:
                    continue

        return None, None
    except Exception:
        return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Opera performances."""
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

            logger.info(f"Fetching Atlanta Opera: {PERFORMANCES_URL}")
            page.goto(PERFORMANCES_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Accept cookies if popup appears
            try:
                accept_btn = page.query_selector(
                    "[class*='accept'], button:has-text('Accept')"
                )
                if accept_btn:
                    accept_btn.click()
                    page.wait_for_timeout(1000)
            except Exception:
                pass

            venue_id = get_or_create_venue(VENUE_DATA)

            body_text = page.inner_text("body")

            # Pattern: OPERA NAME\nDATE RANGE\nVENUE\nBUY TICKETS
            blocks = re.split(
                r"(?:BUY TICKETS|LEARN MORE)", body_text, flags=re.IGNORECASE
            )

            for block in blocks:
                lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
                if len(lines) < 2:
                    continue

                title = None
                date_text = None

                for line in lines:
                    # Date pattern
                    if re.search(r"\w+\s+\d+,?\s*\d{4}", line):
                        date_text = line
                        continue

                    # Title - usually all caps opera name
                    skip = ["PERFORMANCES", "UPCOMING", "PAST", "COBB ENERGY"]
                    if (
                        not title
                        and len(line) > 3
                        and not any(w in line.upper() for w in skip)
                    ):
                        title = line

                if not title or not date_text:
                    continue

                start_date, end_date = parse_date_range(date_text)
                if not start_date:
                    continue

                events_found += 1

                content_hash = generate_content_hash(title, "Atlanta Opera", start_date)

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": f"Atlanta Opera: {title}",
                    "description": None,
                    "start_date": start_date,
                    "start_time": None,
                    "end_date": end_date,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "theater",
                    "subcategory": "opera",
                    "tags": ["opera", "performing-arts", "atlanta-opera"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": PERFORMANCES_URL,
                    "ticket_url": None,
                    "image_url": image_map.get(f),
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

            browser.close()

        logger.info(
            f"Atlanta Opera crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Opera: {e}")
        raise

    return events_found, events_new, events_updated
