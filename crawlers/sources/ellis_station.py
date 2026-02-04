"""
Crawler for Ellis Station Candle Co (ellisstation.com).

Atlanta-based Black-owned soy candle company offering candle-making classes.
Site uses Appointly booking widget (JavaScript-rendered) - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://ellisstation.com"
CLASS_URL = f"{BASE_URL}/products/candle-making-class"

VENUE_DATA = {
    "name": "Ellis Station Candle Co",
    "slug": "ellis-station-candle-co",
    "address": "250 Peters St SW",  # Located in the Castleberry Hill area
    "neighborhood": "Castleberry Hill",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7497,
    "lng": -84.3963,
    "venue_type": "studio",
    "spot_type": "studio",
    "website": BASE_URL,
    "vibes": ["black-owned", "craft", "creative", "workshop", "byob"],
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '3:30 PM' or '15:30' format."""
    # Try 12-hour format first
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    # Try 24-hour format
    match = re.search(r"(\d{1,2}):(\d{2})", time_text)
    if match:
        hour, minute = match.groups()
        return f"{int(hour):02d}:{minute}"

    return None


def parse_date_from_text(text: str) -> Optional[str]:
    """Parse date from text like 'February 8, 2025' or 'Feb 8'."""
    # Try full format with year
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        text,
        re.IGNORECASE
    )
    if match:
        month = match.group(1)
        day = match.group(2)
        year = match.group(3) if match.group(3) else str(datetime.now().year)

        try:
            # Normalize month to 3-letter abbreviation
            month_str = month[:3].capitalize()
            dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")

            # If date is in the past, assume it's next year
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")

            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Ellis Station Candle Co classes using Playwright."""
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

            logger.info(f"Fetching Ellis Station Candle Co: {CLASS_URL}")

            try:
                page.goto(CLASS_URL, wait_until="domcontentloaded", timeout=30000)

                # Wait for Appointly widget to load
                # The widget inserts booking options dynamically
                page.wait_for_timeout(5000)

                # Scroll to ensure content loads
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1500)

                # Get all text content
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                # Look for appointment slots - Appointly typically shows dates and times
                # We'll parse line by line looking for date/time patterns
                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Skip very short lines
                    if len(line) < 3:
                        i += 1
                        continue

                    # Look for date patterns
                    start_date = parse_date_from_text(line)

                    if start_date:
                        # Found a date, look for time slots nearby
                        start_time = None
                        title = "Candle Making Class in Atlanta"

                        # Check next few lines for time information
                        for offset in range(1, 6):
                            if i + offset < len(lines):
                                check_line = lines[i + offset]

                                # Look for time
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    break

                        # If we found a valid date (with or without time), create an event
                        if start_date:
                            events_found += 1

                            content_hash = generate_content_hash(
                                title,
                                "Ellis Station Candle Co",
                                start_date + (start_time or "")
                            )

                            if find_event_by_hash(content_hash):
                                events_updated += 1
                                i += 1
                                continue

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": "Learn how to make your own soy candle in an 8oz tin, create your custom scent, and choose crystals to add to the top. Includes wax melts. BYOB welcome with complimentary drinks provided.",
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": "arts",
                                "subcategory": "workshop",
                                "tags": [
                                    "candle-making",
                                    "craft",
                                    "diy",
                                    "workshop",
                                    "class",
                                    "black-owned",
                                    "byob",
                                    "creative",
                                ],
                                "price_min": 45.00,
                                "price_max": 45.00,
                                "price_note": "Upgradeable candle vessels available on site",
                                "is_free": False,
                                "source_url": CLASS_URL,
                                "ticket_url": CLASS_URL,
                                "image_url": f"{BASE_URL}/cdn/shop/files/crystaljarsandtins.jpg",
                                "raw_text": f"{title} - {start_date} {start_time or ''}",
                                "extraction_confidence": 0.85,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(f"Added: {title} on {start_date} {start_time or 'TBD'}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {title}: {e}")

                    i += 1

                # If no events found via text parsing, create a generic placeholder
                # This ensures the venue is still in the system even if no specific dates are available
                if events_found == 0:
                    logger.info("No specific class dates found, creating generic class entry")

                    # Create a placeholder for the next week
                    from datetime import timedelta
                    placeholder_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")

                    title = "Candle Making Class in Atlanta"
                    content_hash = generate_content_hash(title, "Ellis Station Candle Co", "ongoing")

                    if not find_event_by_hash(content_hash):
                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": "Learn how to make your own soy candle. Check website for available class times.",
                            "start_date": placeholder_date,
                            "start_time": None,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": True,
                            "category": "arts",
                            "subcategory": "workshop",
                            "tags": [
                                "candle-making",
                                "craft",
                                "diy",
                                "workshop",
                                "class",
                                "black-owned",
                            ],
                            "price_min": 45.00,
                            "price_max": 45.00,
                            "price_note": "Book online for specific dates",
                            "is_free": False,
                            "source_url": CLASS_URL,
                            "ticket_url": CLASS_URL,
                            "image_url": f"{BASE_URL}/cdn/shop/files/crystaljarsandtins.jpg",
                            "raw_text": "Check website for class schedule",
                            "extraction_confidence": 0.70,
                            "is_recurring": True,
                            "recurrence_rule": "Weekly classes available",
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            events_found += 1
                        except Exception as e:
                            logger.error(f"Failed to insert placeholder: {e}")

            except PlaywrightTimeout:
                logger.error(f"Timeout loading {CLASS_URL}")
            except Exception as e:
                logger.error(f"Error crawling page: {e}")
            finally:
                browser.close()

        logger.info(
            f"Ellis Station crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Ellis Station Candle Co: {e}")
        raise

    return events_found, events_new, events_updated
