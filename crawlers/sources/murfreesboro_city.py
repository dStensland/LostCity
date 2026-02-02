"""
Crawler for City of Murfreesboro (murfreesborotn.gov/Calendar.aspx).
Official city calendar - community events, recreation, and public meetings.
Uses Playwright to handle ASP.NET calendar interface.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from utils import slugify
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.murfreesborotn.gov"
CALENDAR_URL = f"{BASE_URL}/Calendar.aspx"

VENUE_DATA = {
    "name": "City of Murfreesboro",
    "slug": "city-of-murfreesboro",
    "address": "111 W Vine St",
    "city": "Murfreesboro",
    "state": "TN",
    "zip": "37130",
    "venue_type": "government",
    "spot_type": "community_center",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    try:
        date_text = date_text.strip()

        # Try ISO datetime format
        if "T" in date_text:
            try:
                dt = datetime.fromisoformat(date_text.replace("Z", "+00:00"))
                return dt.strftime("%Y-%m-%d")
            except:
                pass

        # "January 28, 2026" or "Jan 28, 2026"
        match = re.match(r"(\w{3,9})\.?\s+(\d{1,2}),?\s*(\d{4})", date_text)
        if match:
            month, day, year = match.groups()
            for fmt in ["%B %d, %Y", "%b %d, %Y"]:
                try:
                    dt = datetime.strptime(f"{month} {day}, {year}", fmt)
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    continue

        # MM/DD/YYYY
        slash_match = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
        if slash_match:
            month, day, year = slash_match.groups()
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d")

        return None

    except Exception as e:
        logger.warning(f"Failed to parse date '{date_text}': {e}")
        return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time to HH:MM format."""
    try:
        time_text = time_text.lower().strip()

        # "7:00 PM" or "7:00pm"
        match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"

        # "7 PM" or "7pm"
        match = re.search(r"(\d{1,2})\s*(am|pm)", time_text)
        if match:
            hour, period = match.groups()
            hour = int(hour)
            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:00"

        return None
    except Exception:
        return None


def determine_category(text: str) -> str:
    """Determine category from event text."""
    text_lower = text.lower()

    if any(w in text_lower for w in ["concert", "music", "band"]):
        return "music"
    if any(w in text_lower for w in ["theater", "theatre", "play"]):
        return "theater"
    if any(w in text_lower for w in ["art", "gallery", "exhibit"]):
        return "art"
    if any(w in text_lower for w in ["sports", "recreation", "fitness"]):
        return "sports"
    if any(w in text_lower for w in ["market", "food", "festival"]):
        return "food_drink"
    if any(w in text_lower for w in ["family", "kids", "children"]):
        return "family"
    if any(w in text_lower for w in ["meeting", "council", "commission"]):
        return "community"

    return "community"


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl City of Murfreesboro calendar using Playwright.

    Args:
        source: Source record from database

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            page = context.new_page()

            logger.info(f"Fetching City of Murfreesboro calendar: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)  # Wait for ASP.NET calendar to render

            # Try to find calendar events
            event_elements = page.query_selector_all(".calendar-event, .event-item, [class*='event']")

            if not event_elements:
                logger.warning("No event elements found, trying text extraction")
                # Fallback to text parsing
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                i = 0
                while i < len(lines):
                    line = lines[i]
                    start_date = parse_date(line)

                    if start_date:
                        # Look for title in surrounding lines
                        title = None
                        start_time = None

                        for offset in [-2, -1, 1, 2]:
                            idx = i + offset
                            if 0 <= idx < len(lines):
                                check_line = lines[idx]

                                if not start_time:
                                    start_time = parse_time(check_line)

                                if not title and len(check_line) > 5:
                                    if not parse_date(check_line) and not parse_time(check_line):
                                        if not re.match(r"^(home|about|contact|search|menu)", check_line, re.IGNORECASE):
                                            title = check_line

                        if title:
                            events_found += 1
                            content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                            if find_event_by_hash(content_hash):
                                events_updated += 1
                            else:
                                category = determine_category(title)

                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": "Event at City of Murfreesboro",
                                    "start_date": start_date,
                                    "start_time": start_time,
                                    "end_date": None,
                                    "end_time": None,
                                    "is_all_day": start_time is None,
                                    "category": category,
                                    "subcategory": None,
                                    "tags": ["murfreesboro", "city-events"],
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": None,
                                    "is_free": True,
                                    "source_url": CALENDAR_URL,
                                    "ticket_url": None,
                                    "image_url": None,
                                    "raw_text": f"{title} - {start_date}",
                                    "extraction_confidence": 0.75,
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
            else:
                logger.info(f"Found {len(event_elements)} event elements")

                for element in event_elements:
                    try:
                        # Extract event details from element
                        element_text = element.inner_text().strip()
                        if not element_text or len(element_text) < 10:
                            continue

                        lines = [l.strip() for l in element_text.split("\n") if l.strip()]
                        if not lines:
                            continue

                        # First line is typically the title
                        title = lines[0]
                        if len(title) < 3:
                            continue

                        # Look for date in subsequent lines
                        start_date = None
                        start_time = None

                        for line in lines[1:]:
                            if not start_date:
                                start_date = parse_date(line)
                            if not start_time:
                                start_time = parse_time(line)

                        if not start_date:
                            continue

                        events_found += 1

                        # Get event URL if available
                        link = element.query_selector("a[href]")
                        event_url = None
                        if link:
                            href = link.get_attribute("href")
                            if href and not href.startswith("http"):
                                event_url = f"{BASE_URL}{href}"
                            else:
                                event_url = href

                        category = determine_category(element_text)
                        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": None,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": start_time is None,
                            "category": category,
                            "subcategory": None,
                            "tags": ["murfreesboro", "city-events"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": True,
                            "source_url": event_url or CALENDAR_URL,
                            "ticket_url": None,
                            "image_url": None,
                            "raw_text": element_text,
                            "extraction_confidence": 0.80,
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

                    except Exception as e:
                        logger.warning(f"Failed to parse event element: {e}")
                        continue

            browser.close()

        logger.info(
            f"City of Murfreesboro crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching City of Murfreesboro: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl City of Murfreesboro: {e}")
        raise

    return events_found, events_new, events_updated
