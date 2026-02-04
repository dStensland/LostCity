"""
Crawler for Food Well Alliance (foodwellalliance.org/events).

Food Well Alliance is a local food systems builder that connects farmers,
chefs, and communities. They organize farm tours, workshops, and food events.
Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://foodwellalliance.org"
EVENTS_URL = f"{BASE_URL}/events"

# Food Well Alliance HQ venue
FOOD_WELL_ALLIANCE_HQ = {
    "name": "Food Well Alliance",
    "slug": "food-well-alliance",
    "city": "Atlanta",
    "state": "GA",
    "venue_type": "nonprofit",
    "website": BASE_URL,
}


def parse_event_date(date_text: str) -> Optional[dict]:
    """
    Parse various date formats from Food Well Alliance events.

    Examples:
    - 'February 15, 2026'
    - 'Feb 15, 2026'
    - 'February 15'
    - 'Sat, Feb 15'
    """
    try:
        # Try full date with year
        for fmt in ["%B %d, %Y", "%b %d, %Y", "%A, %B %d, %Y", "%a, %b %d, %Y"]:
            try:
                dt = datetime.strptime(date_text.strip(), fmt)
                return {
                    "start_date": dt.strftime("%Y-%m-%d"),
                }
            except ValueError:
                continue

        # Try without year (assume current or next year)
        for fmt in ["%B %d", "%b %d", "%A, %B %d", "%a, %b %d"]:
            try:
                current_year = datetime.now().year
                dt = datetime.strptime(date_text.strip(), fmt)
                dt = dt.replace(year=current_year)

                # If date is in the past, assume next year
                if dt.date() < datetime.now().date():
                    dt = dt.replace(year=current_year + 1)

                return {
                    "start_date": dt.strftime("%Y-%m-%d"),
                }
            except ValueError:
                continue

    except Exception as e:
        logger.warning(f"Failed to parse date '{date_text}': {e}")

    return None


def parse_time(time_text: str) -> Optional[str]:
    """
    Parse time from various formats.

    Examples:
    - '7:00 PM'
    - '7pm'
    - '7:30pm'
    """
    time_match = re.search(r'(\d{1,2}):?(\d{2})?\s*(am|pm)', time_text, re.IGNORECASE)
    if time_match:
        hour, minute, period = time_match.groups()
        hour = int(hour)
        minute = minute or "00"
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["workshop", "class", "training", "education", "learning"]):
        return "education"
    if any(word in text for word in ["tour", "farm tour", "farm visit"]):
        return "outdoor"
    if any(word in text for word in ["volunteer", "service", "planting"]):
        return "community"
    if any(word in text for word in ["market", "farmers market"]):
        return "community"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["food", "sustainability"]

    if any(word in text for word in ["farm", "farming", "agriculture"]):
        tags.append("urban-farming")
    if any(word in text for word in ["organic", "local food"]):
        tags.append("organic")
    if any(word in text for word in ["volunteer", "service"]):
        tags.append("volunteer")
    if any(word in text for word in ["tour", "visit"]):
        tags.append("tour")
    if any(word in text for word in ["workshop", "class", "training"]):
        tags.append("education")
    if any(word in text for word in ["family", "kid", "children", "all ages"]):
        tags.append("family-friendly")
    if any(word in text for word in ["garden", "gardening", "planting"]):
        tags.append("gardening")
    if "free" in text or "no cost" in text:
        tags.append("free")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:"]):
        return False

    # Many community events are free
    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Food Well Alliance events using Playwright.

    Event format on page varies - site is JavaScript-rendered.
    """
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

            # Get venue ID for Food Well Alliance HQ
            venue_id = get_or_create_venue(FOOD_WELL_ALLIANCE_HQ)

            logger.info(f"Fetching Food Well Alliance events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Try to find event containers
            event_selectors = [
                ".event-item",
                ".event",
                "article",
                "[class*='event']",
                ".list-item",
                ".calendar-event",
            ]

            events = []
            for selector in event_selectors:
                try:
                    elements = page.query_selector_all(selector)
                    if elements and len(elements) > 0:
                        events = elements
                        logger.info(f"Found {len(events)} events using selector: {selector}")
                        break
                except:
                    continue

            if not events:
                # Fallback: parse body text
                logger.warning("No event elements found, parsing body text")
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                # Look for date patterns in text
                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Try to parse as date
                    date_data = parse_event_date(line)

                    if date_data:
                        # Previous line might be title
                        title = None
                        if i > 0:
                            potential_title = lines[i - 1]
                            if len(potential_title) > 10 and not potential_title.startswith("http"):
                                title = potential_title

                        # Next lines might be description
                        description = ""
                        if i + 1 < len(lines):
                            potential_desc = lines[i + 1]
                            if len(potential_desc) > 20:
                                description = potential_desc

                        if title:
                            events_found += 1

                            category = determine_category(title, description)
                            tags = extract_tags(title, description)
                            is_free = is_free_event(title, description)

                            content_hash = generate_content_hash(
                                title, "Food Well Alliance", date_data["start_date"]
                            )

                            if find_event_by_hash(content_hash):
                                events_updated += 1
                                i += 1
                                continue

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": description if description else None,
                                "start_date": date_data["start_date"],
                                "start_time": None,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": True,
                                "category": category,
                                "subcategory": None,
                                "tags": tags,
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": is_free,
                                "source_url": EVENTS_URL,
                                "ticket_url": None,
                                "image_url": image_map.get(title),
                                "raw_text": f"{title} | {line} | {description[:200]}"[:500],
                                "extraction_confidence": 0.75,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(f"Added: {title} on {date_data['start_date']}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {title}: {e}")

                    i += 1
            else:
                # Parse event elements
                for event_el in events:
                    try:
                        title = None
                        description = ""
                        start_date = None
                        start_time = None

                        # Extract text content
                        event_text = event_el.inner_text()
                        lines = [l.strip() for l in event_text.split("\n") if l.strip()]

                        if lines:
                            # First line is usually title
                            title = lines[0]

                            # Look for date in remaining lines
                            for line in lines[1:]:
                                date_data = parse_event_date(line)
                                if date_data:
                                    start_date = date_data["start_date"]
                                    break

                                # Check for time
                                if not start_time:
                                    time_parsed = parse_time(line)
                                    if time_parsed:
                                        start_time = time_parsed

                                # Collect description
                                if len(line) > 30 and not start_date:
                                    description = line

                        if title and start_date:
                            events_found += 1

                            category = determine_category(title, description)
                            tags = extract_tags(title, description)
                            is_free = is_free_event(title, description)

                            content_hash = generate_content_hash(
                                title, "Food Well Alliance", start_date
                            )

                            if find_event_by_hash(content_hash):
                                events_updated += 1
                                continue

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": description if description else None,
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": category,
                                "subcategory": None,
                                "tags": tags,
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": is_free,
                                "source_url": EVENTS_URL,
                                "ticket_url": None,
                                "image_url": image_map.get(title),
                                "raw_text": f"{title} | {event_text[:300]}"[:500],
                                "extraction_confidence": 0.8,
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
                        logger.warning(f"Error parsing event element: {e}")
                        continue

            browser.close()

        logger.info(
            f"Food Well Alliance crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Food Well Alliance: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Food Well Alliance: {e}")
        raise

    return events_found, events_new, events_updated
