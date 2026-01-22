"""
Crawler for Marcia Wood Gallery.
Contemporary art gallery in Buckhead/Castleberry Hill.

Parses exhibition pages for current and upcoming shows with date ranges.
Example format: "5 DEC 2025 - 24 JAN 2026"
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

BASE_URL = "https://www.marciawoodgallery.com"
EVENTS_URL = f"{BASE_URL}/exhibitions"

VENUE_DATA = {
    "name": "Marcia Wood Gallery",
    "slug": "marcia-wood-gallery",
    "address": "761 Miami Circle NE, Suite D",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "venue_type": "gallery",
    "website": BASE_URL,
}

MONTH_MAP = {
    'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
    'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12,
    'JANUARY': 1, 'FEBRUARY': 2, 'MARCH': 3, 'APRIL': 4, 'JUNE': 6,
    'JULY': 7, 'AUGUST': 8, 'SEPTEMBER': 9, 'OCTOBER': 10, 'NOVEMBER': 11, 'DECEMBER': 12
}


def parse_exhibition_dates(text: str) -> Optional[tuple[datetime, datetime]]:
    """Parse exhibition date range like '5 DEC 2025 - 24 JAN 2026'.

    Returns tuple of (start_date, end_date) or None if not parseable.
    """
    # Pattern: "D MON YYYY - D MON YYYY" or variations
    pattern = r"(\d{1,2})\s+([A-Z]+)\s+(\d{4})\s*[-–]\s*(\d{1,2})\s+([A-Z]+)\s+(\d{4})"
    match = re.search(pattern, text.upper())

    if match:
        start_day = int(match.group(1))
        start_month_str = match.group(2)
        start_year = int(match.group(3))
        end_day = int(match.group(4))
        end_month_str = match.group(5)
        end_year = int(match.group(6))

        start_month = MONTH_MAP.get(start_month_str)
        end_month = MONTH_MAP.get(end_month_str)

        if start_month and end_month:
            try:
                start_date = datetime(start_year, start_month, start_day)
                end_date = datetime(end_year, end_month, end_day)
                return (start_date, end_date)
            except ValueError:
                pass

    return None


def crawl(source: dict) -> tuple[int, int, int]:
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

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Marcia Wood Gallery: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            body_text = page.inner_text("body")

            # Look for exhibition info
            # Pattern: ARTIST NAME\nEXHIBITION TITLE\nDATE RANGE
            lines = [l.strip() for l in body_text.split('\n') if l.strip()]

            i = 0
            while i < len(lines):
                line = lines[i]

                # Look for date range pattern
                dates = parse_exhibition_dates(line)
                if dates:
                    start_date, end_date = dates

                    # Skip past exhibitions
                    if end_date.date() < datetime.now().date():
                        i += 1
                        continue

                    # Look backwards for artist name and exhibition title
                    artist = None
                    title = None

                    for offset in range(1, 4):
                        if i - offset >= 0:
                            prev_line = lines[i - offset]
                            # Skip short lines, navigation, and addresses
                            if len(prev_line) < 3:
                                continue
                            if re.match(r'(MENU|EXHIBITIONS|CURRENT|PAST|UPCOMING)', prev_line.upper()):
                                continue
                            if re.match(r'\d+\s+\w+\s+(CIRCLE|STREET|AVE|ROAD)', prev_line.upper()):
                                continue

                            if title is None:
                                title = prev_line
                            elif artist is None:
                                artist = prev_line
                                break

                    if title:
                        events_found += 1

                        # Use start date for event
                        start_date_str = start_date.strftime("%Y-%m-%d")
                        end_date_str = end_date.strftime("%Y-%m-%d")

                        full_title = f"{artist}: {title}" if artist else title

                        content_hash = generate_content_hash(full_title, "Marcia Wood Gallery", start_date_str)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            i += 1
                            continue

                        description = f"Art exhibition at Marcia Wood Gallery"
                        if artist:
                            description = f"{title} - an exhibition by {artist} at Marcia Wood Gallery"
                        description += f". On view through {end_date.strftime('%B %d, %Y')}."

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": full_title,
                            "description": description,
                            "start_date": start_date_str,
                            "start_time": "11:00",  # Gallery opens 11am
                            "end_date": end_date_str,
                            "end_time": "17:00",  # Gallery closes 5pm
                            "is_all_day": True,
                            "category": "art",
                            "subcategory": "gallery",
                            "tags": ["art", "gallery", "contemporary-art", "exhibition", "buckhead"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Free admission",
                            "is_free": True,
                            "source_url": EVENTS_URL,
                            "ticket_url": None,
                            "image_url": image_map.get(full_title),
                            "raw_text": f"{full_title} - {start_date_str} to {end_date_str}",
                            "extraction_confidence": 0.90,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {full_title} ({start_date_str} - {end_date_str})")
                        except Exception as e:
                            logger.error(f"Failed to insert: {full_title}: {e}")

                i += 1

            browser.close()

        logger.info(f"Marcia Wood Gallery crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Marcia Wood Gallery: {e}")
        raise

    return events_found, events_new, events_updated
