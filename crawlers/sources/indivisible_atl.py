"""
Crawler for Indivisible ATL (indivisibleatl.com/events).
Progressive political action and organizing events.
Squarespace-based event listings with eventlist-* CSS classes.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.indivisibleatl.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Indivisible ATL",
    "slug": "indivisible-atl",
    "city": "Atlanta",
    "state": "GA",
    "venue_type": "organization",
    "spot_type": "nonprofit",
    "website": BASE_URL,
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date or date range from various formats.

    Examples:
    - "February 21, 2026"
    - "Monday, February 21, 2026"
    - "Feb 21 - Feb 23, 2026"
    - "Jan 15-17, 2026"
    """
    current_year = datetime.now().year

    # Single date with optional day of week: "Monday, February 21, 2026"
    match = re.match(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,\s]*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            month_name = match.group(1)
            day = match.group(2)
            year = match.group(3)
            if len(month_name) > 3:
                dt = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y")
            else:
                dt = datetime.strptime(f"{month_name} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    # Date range: "Feb 21 - Feb 23, 2026"
    match = re.match(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*-\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            start_month = match.group(1)
            start_day = match.group(2)
            end_month = match.group(3) if match.group(3) else start_month
            end_day = match.group(4)
            year = match.group(5)

            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%b %d %Y")

            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Date without year
    match = re.match(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,\s]*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            month_name = match.group(1)
            day = match.group(2)
            if len(month_name) > 3:
                dt = datetime.strptime(f"{month_name} {day} {current_year}", "%B %d %Y")
            else:
                dt = datetime.strptime(f"{month_name} {day} {current_year}", "%b %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    return None, None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '10:00 AM' or similar format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2)
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Indivisible ATL events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Indivisible ATL events: {EVENTS_URL}")

            # Navigate to events page - use networkidle for Squarespace's JS
            page.goto(EVENTS_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(2000)

            # Scroll to load all events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Parse Squarespace eventlist structure
            # Each event is in a .eventlist-event article with:
            # - .eventlist-title a (title and link)
            # - .eventlist-meta li (date, time, calendar links)
            # - .eventlist-event--past class indicates past events
            event_containers = page.query_selector_all('.eventlist-event')

            # Count past vs upcoming
            past_count = sum(1 for c in event_containers if 'eventlist-event--past' in (c.get_attribute('class') or ''))
            upcoming_count = len(event_containers) - past_count
            logger.info(f"Found {len(event_containers)} events ({upcoming_count} upcoming, {past_count} past)")

            for container in event_containers:
                try:
                    # Skip past events (marked with eventlist-event--past class)
                    container_class = container.get_attribute('class') or ''
                    if 'eventlist-event--past' in container_class:
                        continue

                    # Get title and link
                    title_link = container.query_selector('.eventlist-title a')
                    if not title_link:
                        continue

                    title = title_link.inner_text().strip()
                    href = title_link.get_attribute('href') or ''

                    if not title or not href:
                        continue

                    # Build full URL
                    if href.startswith('/'):
                        event_url = BASE_URL + href
                    else:
                        event_url = href

                    # Get date and time from .eventlist-meta li elements
                    meta_items = container.query_selector_all('.eventlist-meta li')
                    date_text = ""
                    time_text = ""

                    for li in meta_items:
                        li_text = li.inner_text().strip()
                        # Lines with full date format like "Thursday, January 22, 2026"
                        if re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}', li_text):
                            date_text = li_text
                        # Lines with time like "7:30 PM 9:30 PM"
                        elif re.search(r'\d{1,2}:\d{2}\s*(AM|PM)', li_text, re.IGNORECASE):
                            time_text = li_text

                    # Parse date
                    start_date, end_date = parse_date_range(date_text)

                    if not start_date:
                        logger.debug(f"Could not parse date '{date_text}' for: {title}")
                        continue

                    events_found += 1

                    # Parse time
                    start_time = parse_time(time_text) if time_text else None

                    # Get image from thumbnail column
                    img = container.query_selector('.eventlist-column-thumbnail img, img')
                    image_url = None
                    if img:
                        image_url = img.get_attribute('src') or img.get_attribute('data-src')
                        # Convert relative URLs
                        if image_url and image_url.startswith('/'):
                            image_url = BASE_URL + image_url

                    # Generate content hash
                    content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                    # Check if exists

                    # Default description (we could fetch detail page, but this is faster)
                    description = f"{title} - Indivisible ATL organizing event"

                    # Check for free events
                    is_free = any(word in title.lower() for word in ["free", "no cost"])

                    # Build event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "activism",
                        "subcategory": None,
                        "tags": ["activism", "progressive", "politics", "organizing"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {date_text}",
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.debug(f"Error processing event container: {e}")
                    continue

            browser.close()

        logger.info(
            f"Indivisible ATL crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Indivisible ATL: {e}")
        raise

    return events_found, events_new, events_updated
