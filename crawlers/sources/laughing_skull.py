"""
Crawler for Laughing Skull Lounge (laughingskulllounge.com).
Atlanta's dedicated comedy club since 2009.
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

BASE_URL = "https://laughingskulllounge.com"

VENUE_DATA = {
    "name": "Laughing Skull Lounge",
    "slug": "laughing-skull-lounge",
    "address": "878 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "comedy_club",
    "website": BASE_URL,
}


def parse_calendar_date(date_text: str) -> Optional[str]:
    """Parse date from 'Tuesday, January 13, 8:00 pm' format."""
    try:
        # "Tuesday, January 13, 8:00 pm"
        match = re.match(
            r"(\w+),\s+(\w+)\s+(\d+),\s+(\d+):(\d+)\s*(am|pm)", date_text, re.IGNORECASE
        )
        if match:
            _, month, day, hour, minute, period = match.groups()
            current_year = datetime.now().year

            for fmt in ["%B %d %Y", "%b %d %Y"]:
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


def parse_calendar_time(date_text: str) -> Optional[str]:
    """Parse time from 'Tuesday, January 13, 8:00 pm' format."""
    try:
        match = re.search(r"(\d+):(\d+)\s*(am|pm)", date_text, re.IGNORECASE)
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


def parse_price(price_text: str) -> tuple[Optional[float], Optional[float]]:
    """Parse price from '$25.00 – $35.00' or '$15.00' format."""
    try:
        prices = re.findall(r"\$(\d+(?:\.\d{2})?)", price_text)
        if len(prices) >= 2:
            return float(prices[0]), float(prices[1])
        elif len(prices) == 1:
            return float(prices[0]), float(prices[0])
        return None, None
    except Exception:
        return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Laughing Skull events."""
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

            logger.info(f"Fetching Laughing Skull: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            venue_id = get_or_create_venue(VENUE_DATA)

            body_text = page.inner_text("body")

            # Calendar format:
            # TUE
            # 13
            # Open Mic Night Every Monday - Wednesday
            # Tuesday, January 13, 8:00 pm
            # Description...
            # Get Tickets $15.00

            # Split by day markers (MON, TUE, WED, etc.)
            day_pattern = r"\n(MON|TUE|WED|THU|FRI|SAT|SUN)\n(\d{1,2})\n"
            parts = re.split(day_pattern, body_text)

            # Skip the first part (before first day marker)
            # Then process in groups of 3: day_abbrev, day_num, content
            i = 1
            while i + 2 < len(parts):
                day_abbrev = parts[i]
                day_num = parts[i + 1]
                content = parts[i + 2]
                i += 3

                lines = [l.strip() for l in content.split("\n") if l.strip()]
                if not lines:
                    continue

                # First line is typically the event title
                title = lines[0]

                # Skip navigation/header items
                skip_words = ["PAST EVENT", "View All", "Select date", "Event Views"]
                if any(w.lower() in title.lower() for w in skip_words):
                    continue

                # Look for date/time line: "Tuesday, January 13, 8:00 pm"
                date_line = None
                price_line = None
                description = None

                for line in lines[1:]:
                    if re.match(
                        r"\w+,\s+\w+\s+\d+,\s+\d+:\d+\s*(am|pm)", line, re.IGNORECASE
                    ):
                        date_line = line
                    elif "Get Tickets" in line or "$" in line:
                        price_line = line
                    elif len(line) > 20 and not description:
                        # Likely description
                        description = line

                if not date_line:
                    continue

                start_date = parse_calendar_date(date_line)
                if not start_date:
                    continue

                start_time = parse_calendar_time(date_line)
                price_min, price_max = parse_price(price_line or "")

                events_found += 1

                content_hash = generate_content_hash(
                    title, "Laughing Skull Lounge", start_date + (start_time or "")
                )

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "comedy",
                    "subcategory": "standup",
                    "tags": ["comedy", "standup", "laughing-skull"],
                    "price_min": price_min,
                    "price_max": price_max,
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
                    logger.info(f"Added: {title} on {start_date} at {start_time}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            browser.close()

        logger.info(
            f"Laughing Skull crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Laughing Skull: {e}")
        raise

    return events_found, events_new, events_updated
