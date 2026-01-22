"""
Crawler for Smith's Olde Bar (smithsoldebar.com).
Midtown music venue with multiple stages.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from utils import slugify
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.smithsoldebar.com"

VENUE_DATA = {
    "name": "Smith's Olde Bar",
    "slug": "smiths-olde-bar",
    "address": "1578 Piedmont Ave NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from 'Tue, Jan 13' format."""
    try:
        current_year = datetime.now().year
        match = re.match(r"(\w+),?\s+(\w+)\s+(\d+)", date_text)
        if match:
            _, month, day = match.groups()
            for fmt in ["%b %d %Y", "%B %d %Y"]:
                try:
                    dt = datetime.strptime(f"{month} {day} {current_year}", fmt)
                    if dt < datetime.now():
                        dt = datetime.strptime(f"{month} {day} {current_year + 1}", fmt)
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    continue
        return None
    except Exception:
        return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '8:00 pm' format."""
    try:
        match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        return None
    except Exception:
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Smith's Olde Bar events."""
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

            logger.info(f"Fetching Smith's Olde Bar: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Find event elements
            body_text = page.inner_text("body")

            # Events follow pattern: JAN\n13\nEVENT TITLE\nDay, Mon DD, Time
            # Split by JAN/FEB/etc markers
            months = [
                "JAN",
                "FEB",
                "MAR",
                "APR",
                "MAY",
                "JUN",
                "JUL",
                "AUG",
                "SEP",
                "OCT",
                "NOV",
                "DEC",
            ]

            # Find all month markers and their positions
            lines = body_text.split("\n")
            current_event = {}

            i = 0
            while i < len(lines):
                line = lines[i].strip()

                # Month marker
                if line in months:
                    # Next line should be day number
                    if i + 1 < len(lines):
                        day = lines[i + 1].strip()
                        if day.isdigit():
                            current_event = {"month": line, "day": day}
                            i += 2
                            continue

                # Event title (usually starts with SOBATL PRESENTS or similar)
                if current_event.get("month") and not current_event.get("title"):
                    if len(line) > 10 and line not in [
                        "ATLANTA ROOM",
                        "Tickets",
                        "MENU",
                    ]:
                        current_event["title"] = line
                        i += 1
                        continue

                # Date/time line
                if current_event.get("title"):
                    time_match = re.search(
                        r"(\d{1,2}):(\d{2})\s*(am|pm)", line, re.IGNORECASE
                    )
                    if time_match:
                        current_event["time"] = line

                        # Process this event
                        month = current_event["month"]
                        day = current_event["day"]
                        title = current_event["title"]

                        # Clean up title
                        title = re.sub(
                            r"^SOBATL PRESENTS\s*", "", title, flags=re.IGNORECASE
                        )

                        year = datetime.now().year
                        for fmt in ["%b %d %Y", "%B %d %Y"]:
                            try:
                                dt = datetime.strptime(f"{month} {day} {year}", fmt)
                                if dt < datetime.now():
                                    dt = datetime.strptime(
                                        f"{month} {day} {year + 1}", fmt
                                    )
                                start_date = dt.strftime("%Y-%m-%d")
                                break
                            except ValueError:
                                start_date = None

                        if start_date and title:
                            start_time = parse_time(current_event.get("time", ""))

                            events_found += 1

                            content_hash = generate_content_hash(
                                title, "Smith's Olde Bar", start_date
                            )

                            existing = find_event_by_hash(content_hash)
                            if existing:
                                events_updated += 1
                            else:
                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": None,
                                    "start_date": start_date,
                                    "start_time": start_time,
                                    "end_date": None,
                                    "end_time": None,
                                    "is_all_day": False,
                                    "category": "music",
                                    "subcategory": None,
                                    "tags": ["live-music", "smiths-olde-bar"],
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": None,
                                    "is_free": False,
                                    "source_url": BASE_URL,
                                    "ticket_url": None,
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

                        current_event = {}

                i += 1

            browser.close()

        logger.info(
            f"Smith's Olde Bar crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Smith's Olde Bar: {e}")
        raise

    return events_found, events_new, events_updated
