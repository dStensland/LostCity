"""
Crawler for REI Atlanta outdoor classes and workshops (rei.com/events).

REI offers outdoor recreation classes, workshops, and adventure programs.
Site uses JavaScript rendering - must use Playwright.
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

BASE_URL = "https://www.rei.com"
EVENTS_URL = f"{BASE_URL}/events?location=Atlanta%2C+GA"

VENUE_DATA = {
    "name": "REI Atlanta",
    "slug": "rei-atlanta",
    "address": "1800 Northeast Expy NE",
    "neighborhood": "Brookhaven",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30329",
    "lat": 33.8168,
    "lng": -84.3369,
    "venue_type": "retail",
    "spot_type": "outdoor_recreation",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various REI formats."""
    current_year = datetime.now().year

    # Try "Mon, Jan 20" format
    match = re.match(r"(?:\w{3}),?\s+(\w{3})\s+(\d+)", date_text, re.IGNORECASE)
    if match:
        month, day = match.groups()
        for fmt in ["%b %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", fmt)
                if dt.date() < datetime.now().date():
                    dt = datetime.strptime(f"{month} {day} {current_year + 1}", fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    # Try "January 20, 2026" format
    match = re.match(r"(\w+)\s+(\d+),?\s*(\d{4})?", date_text, re.IGNORECASE)
    if match:
        month, day, year = match.groups()
        year = year or str(current_year)
        for fmt in ["%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", fmt)
                if not year and dt.date() < datetime.now().date():
                    dt = datetime.strptime(f"{month} {day} {int(year) + 1}", fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7PM' format."""
    try:
        # "7:00 PM" or "7:00PM" or "7PM"
        match = re.search(r"(\d{1,2}):?(\d{2})?\s*(AM|PM)", time_text, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            minute = minute or "00"
            if period.upper() == "PM" and hour != 12:
                hour += 12
            elif period.upper() == "AM" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        return None
    except Exception:
        return None


def parse_price(price_text: str) -> tuple[Optional[float], Optional[float], bool]:
    """Parse price from REI price text."""
    if not price_text:
        return None, None, False

    price_lower = price_text.lower()
    if "free" in price_lower:
        return 0.0, 0.0, True

    # Find dollar amounts
    amounts = re.findall(r"\$?(\d+(?:\.\d{2})?)", price_text)
    if amounts:
        prices = [float(a) for a in amounts]
        return min(prices), max(prices), False

    return None, None, False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl REI Atlanta events using Playwright."""
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

            logger.info(f"Fetching REI Atlanta: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load more events (REI uses lazy loading)
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse events - look for date patterns followed by class info
            i = 0
            while i < len(lines):
                line = lines[i]

                # Skip very short lines
                if len(line) < 3:
                    i += 1
                    continue

                # Look for date patterns
                date_match = re.match(
                    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    month = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

                    # Look for title, time, price in surrounding lines
                    title = None
                    start_time = None
                    price_min = None
                    price_max = None
                    is_free = False
                    location_text = None

                    # Search context window around date
                    for offset in range(-3, 6):
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]

                            # Skip date lines
                            if re.match(r"(January|February|March|April|May|June|July|August|September|October|November|December)", check_line, re.IGNORECASE):
                                continue

                            # Look for time
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue

                            # Look for price
                            if re.search(r"\$\d+|free", check_line, re.IGNORECASE):
                                p_min, p_max, free = parse_price(check_line)
                                if p_min is not None or free:
                                    price_min = p_min
                                    price_max = p_max
                                    is_free = free
                                    continue

                            # Look for location mentions (filter for Atlanta area)
                            if re.search(r"atlanta|brookhaven|buckhead|perimeter|sandy springs", check_line, re.IGNORECASE):
                                location_text = check_line

                            # Look for title - longer lines that aren't navigation/metadata
                            if not title and len(check_line) > 8:
                                skip_patterns = [
                                    r"^(view|show|more|filter|sort|search|load|page|events?|classes?|register|sign up|book now|learn more|details)$",
                                    r"^\d+\s+(results?|events?|classes?)",
                                    r"^(location|date|time|price|category|type):?",
                                ]
                                if not any(re.match(p, check_line, re.IGNORECASE) for p in skip_patterns):
                                    title = check_line

                    # Must have title and valid Atlanta location
                    if not title:
                        i += 1
                        continue

                    # Parse date
                    try:
                        month_str = month[:3] if len(month) > 3 else month
                        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                        if dt.date() < datetime.now().date():
                            dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, "REI Atlanta", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        i += 1
                        continue

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": location_text or "Outdoor class at REI Atlanta",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "fitness",
                        "subcategory": "fitness.class",
                        "tags": [
                            "outdoor",
                            "workshop",
                            "recreation",
                            "hiking",
                            "adventure",
                            "rei",
                            "brookhaven",
                        ],
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.80,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                        "is_class": True,
                        "class_category": "fitness",
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
            f"REI Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl REI Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
