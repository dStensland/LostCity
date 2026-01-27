"""
Crawler for City of Decatur (decaturga.com/calendar).

Government events calendar for Decatur, GA - community events, festivals, and public meetings.
Uses Playwright to handle Cloudflare protection and JavaScript rendering.
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

BASE_URL = "https://www.decaturga.com"
CALENDAR_URL = f"{BASE_URL}/calendar"

VENUE_DATA = {
    "name": "City of Decatur",
    "slug": "city-of-decatur",
    "address": "509 N McDonough St",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7747,
    "lng": -84.2956,
    "venue_type": "government",
    "spot_type": "community_center",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from various formats used on the calendar.

    Examples:
    - "January 28, 2026"
    - "Jan 28, 2026"
    - "Tuesday, February 4, 2026"
    """
    # Remove day of week if present
    date_text = re.sub(r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*", "", date_text, flags=re.IGNORECASE)

    # Try full month name format: "January 28, 2026"
    match = re.match(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            dt = datetime.strptime(f"{match.group(1)} {match.group(2)} {match.group(3)}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try abbreviated month format: "Jan 28, 2026"
    match = re.match(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            dt = datetime.strptime(f"{match.group(1)} {match.group(2)} {match.group(3)}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '19:00' format."""
    time_text = time_text.strip()

    # Handle "7:00 PM" or "7:00pm" format
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

    # Handle 24-hour format
    match = re.match(r"^(\d{1,2}):(\d{2})$", time_text)
    if match:
        hour = int(match.group(1))
        minute = match.group(2)
        return f"{hour:02d}:{minute}"

    return None


def categorize_event(title: str, description: str) -> tuple[str, list[str]]:
    """Determine category and tags based on title and description."""
    text = (title + " " + description).lower()
    tags = ["decatur", "community"]

    # Check for specific event types
    if any(w in text for w in ["festival", "celebration", "parade"]):
        tags.append("festival")
        return "community", tags

    if any(w in text for w in ["concert", "music", "band", "jazz", "orchestra"]):
        tags.append("music")
        return "music", tags

    if any(w in text for w in ["art", "gallery", "exhibition", "artist"]):
        tags.append("arts")
        return "arts", tags

    if any(w in text for w in ["kids", "children", "family", "youth"]):
        tags.append("family-friendly")
        return "family", tags

    if any(w in text for w in ["market", "farmers", "vendor"]):
        tags.append("farmers-market")
        return "food_drink", tags

    if any(w in text for w in ["meeting", "council", "commission", "board"]):
        tags.append("government")
        return "community", tags

    # Default to community events
    return "community", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City of Decatur calendar using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            # Use headless=False to pass Cloudflare challenge
            browser = p.chromium.launch(headless=False)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching City of Decatur calendar: {CALENDAR_URL}")

            # Navigate and wait for Cloudflare challenge to complete
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(10000)  # Wait longer for Cloudflare JS challenge

            # Try to wait for calendar content to load
            try:
                page.wait_for_selector(".calendar-event, .event-item, [class*='event']", timeout=10000)
            except Exception:
                logger.warning("Could not find event selectors, continuing anyway")

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all events
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page HTML for parsing
            html_content = page.content()

            # Check if still on Cloudflare challenge
            body_text = page.inner_text("body")
            if "cloudflare" in body_text.lower() or "checking your browser" in body_text.lower():
                logger.warning("Still blocked by Cloudflare challenge")
                browser.close()
                return 0, 0, 0

            # CivicPlus calendar uses .calendar-list or similar
            event_elements = page.query_selector_all(
                ".calendar-list-item, .event-item, .calendar-event, "
                "[class*='calendar-list'] li, [class*='event-list'] li"
            )

            if not event_elements:
                # Try finding event links directly
                event_links = page.query_selector_all('a[href*="/calendar/"]')
                logger.info(f"Found {len(event_links)} calendar links")

            if not event_elements:
                logger.warning("No event elements found, trying text extraction")
                # Fallback to text parsing
                body_text = page.inner_text("body")
                events_found, events_new, events_updated = parse_text_content(
                    body_text, source_id, venue_id, image_map
                )
            else:
                # Parse event elements
                for element in event_elements:
                    try:
                        title_elem = element.query_selector("h2, h3, .title, .event-title, [class*='title']")
                        date_elem = element.query_selector(".date, .event-date, [class*='date']")
                        time_elem = element.query_selector(".time, .event-time, [class*='time']")
                        desc_elem = element.query_selector(".description, .event-description, p")

                        if not title_elem:
                            continue

                        title = title_elem.inner_text().strip()
                        if not title or len(title) < 3:
                            continue

                        # Get date
                        date_text = date_elem.inner_text().strip() if date_elem else ""
                        start_date = parse_date(date_text)

                        if not start_date:
                            continue

                        events_found += 1

                        # Get time if available
                        time_text = time_elem.inner_text().strip() if time_elem else ""
                        start_time = parse_time(time_text) if time_text else None

                        # Get description
                        description = desc_elem.inner_text().strip() if desc_elem else ""
                        if len(description) > 500:
                            description = description[:497] + "..."

                        # Categorize event
                        category, tags = categorize_event(title, description)

                        # Generate content hash
                        content_hash = generate_content_hash(title, "City of Decatur", start_date)

                        # Check if exists
                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        # Build event record
                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description if description else "Event at City of Decatur",
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": start_time is None,
                            "category": category,
                            "subcategory": None,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": True,  # Most city events are free
                            "source_url": CALENDAR_URL,
                            "ticket_url": CALENDAR_URL,
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} - {start_date}",
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
                            logger.error(f"Failed to insert event '{title}': {e}")

                    except Exception as e:
                        logger.error(f"Error parsing event element: {e}")
                        continue

            browser.close()

        logger.info(
            f"City of Decatur crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl City of Decatur: {e}")
        raise

    return events_found, events_new, events_updated


def parse_text_content(
    body_text: str,
    source_id: int,
    venue_id: int,
    image_map: dict[str, str]
) -> tuple[int, int, int]:
    """Fallback parser for plain text content."""
    events_found = 0
    events_new = 0
    events_updated = 0

    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    i = 0
    while i < len(lines):
        line = lines[i]

        # Look for date patterns
        start_date = parse_date(line)

        if start_date:
            # Look for title in surrounding lines
            title = None
            start_time = None

            for offset in [-2, -1, 1, 2]:
                idx = i + offset
                if 0 <= idx < len(lines):
                    check_line = lines[idx]

                    # Try to parse as time
                    if not start_time:
                        start_time = parse_time(check_line)

                    # Look for title (not a date or time)
                    if not title and len(check_line) > 5:
                        if not parse_date(check_line) and not parse_time(check_line):
                            # Avoid common navigation text
                            if not re.match(r"^(home|about|contact|search|menu)", check_line, re.IGNORECASE):
                                title = check_line

            if title:
                events_found += 1

                content_hash = generate_content_hash(title, "City of Decatur", start_date)

                if find_event_by_hash(content_hash):
                    events_updated += 1
                else:
                    category, tags = categorize_event(title, "")

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": "Event at City of Decatur",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": start_time is None,
                        "category": category,
                        "subcategory": None,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": CALENDAR_URL,
                        "ticket_url": CALENDAR_URL,
                        "image_url": image_map.get(title),
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

    return events_found, events_new, events_updated
