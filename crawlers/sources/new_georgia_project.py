"""
Crawler for New Georgia Project (newgeorgiaproject.org).

New Georgia Project is a nonpartisan effort to register and civically engage
voters, with a focus on voter registration, civic engagement, and activism.
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
from utils import extract_images_from_page, normalize_time_format, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://newgeorgiaproject.org"
EVENTS_URL = f"{BASE_URL}/events"

# New Georgia Project HQ venue
NEW_GEORGIA_PROJECT_HQ = {
    "name": "New Georgia Project",
    "slug": "new-georgia-project",
    "address": "230 John Wesley Dobbs Ave NE",
    "neighborhood": "Sweet Auburn",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "nonprofit",
    "website": BASE_URL,
}


def parse_date(date_str: str) -> Optional[str]:
    """
    Parse various date formats to YYYY-MM-DD.

    Handles formats like:
    - January 15, 2026
    - Jan 15, 2026
    - 1/15/2026
    - Monday, January 15
    """
    if not date_str:
        return None

    date_str = date_str.strip()
    current_year = datetime.now().year

    # Try "Month DD, YYYY" or "Month DD"
    match = re.match(r'(?:\w+,?\s+)?(\w+)\s+(\d{1,2})(?:,?\s+(\d{4}))?', date_str, re.IGNORECASE)
    if match:
        month_str, day, year = match.groups()
        year = year or str(current_year)
        try:
            # Handle full month name or abbreviation
            dt = datetime.strptime(f"{month_str} {day} {year}", "%B %d %Y")
        except ValueError:
            try:
                dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
            except ValueError:
                return None

        # If date is in the past, assume next year
        if dt.date() < datetime.now().date():
            dt = datetime.strptime(f"{month_str} {day} {current_year + 1}", "%B %d %Y" if len(month_str) > 3 else "%b %d %Y")

        return dt.strftime("%Y-%m-%d")

    # Try MM/DD/YYYY
    match = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', date_str)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month}/{day}/{year}", "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            return None

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time string to HH:MM format."""
    if not time_str:
        return None

    normalized = normalize_time_format(time_str.strip())
    return normalized


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["voter registration", "register", "canvass", "door knock", "phone bank", "gotv", "get out the vote"]):
        return "community"
    if any(word in text for word in ["town hall", "community meeting", "forum", "discussion"]):
        return "community"
    if any(word in text for word in ["rally", "march", "protest", "demonstration"]):
        return "community"
    if any(word in text for word in ["workshop", "training", "education", "seminar"]):
        return "education"
    if any(word in text for word in ["fundraiser", "gala", "benefit", "donation"]):
        return "community"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = []

    if any(word in text for word in ["vote", "voter", "registration", "ballot", "election"]):
        tags.append("voting")
    if any(word in text for word in ["civic", "democracy", "rights"]):
        tags.append("civic-engagement")
    if any(word in text for word in ["activism", "activist", "organize", "canvass", "rally", "protest"]):
        tags.append("activism")
    if any(word in text for word in ["volunteer", "help", "join us"]):
        tags.append("volunteer")
    if any(word in text for word in ["community", "neighborhood"]):
        tags.append("community")
    if any(word in text for word in ["social justice", "justice", "equity", "rights"]):
        tags.append("social-justice")
    if any(word in text for word in ["training", "workshop", "education"]):
        tags.append("education")

    # Add free tag (most organizing events are free)
    if "free" in text or "volunteer" in tags:
        tags.append("free")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Most organizing/volunteer events are free
    if any(word in text for word in ["volunteer", "canvass", "phone bank", "register", "community meeting"]):
        return True

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:", "donation required"]):
        return False

    # Default to True for civic engagement org (most events are free)
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl New Georgia Project events using Playwright.

    The events page typically has event cards with:
    - Title
    - Date and time
    - Location/description
    - Link to details
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

            # Get venue ID for New Georgia Project HQ
            venue_id = get_or_create_venue(NEW_GEORGIA_PROJECT_HQ)

            logger.info(f"Fetching New Georgia Project events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Try to find event containers (adjust selectors based on actual site structure)
            # Common patterns: .event-card, .event-item, article, .tribe-event, etc.
            event_selectors = [
                ".event-card",
                ".event-item",
                ".tribe-events-list-event-row",
                "article[class*='event']",
                "[class*='event-listing'] > div",
                ".calendar-event",
            ]

            events_found_on_page = False
            for selector in event_selectors:
                event_elements = page.query_selector_all(selector)
                if event_elements and len(event_elements) > 0:
                    logger.info(f"Found {len(event_elements)} events with selector: {selector}")

                    for event_elem in event_elements:
                        try:
                            # Extract text content
                            event_text = event_elem.inner_text()
                            lines = [l.strip() for l in event_text.split("\n") if l.strip()]

                            if len(lines) < 2:
                                continue

                            # Assume first substantial line is the title
                            title = lines[0] if len(lines[0]) > 5 else (lines[1] if len(lines) > 1 else None)
                            if not title or len(title) < 5:
                                continue

                            # Try to find date/time in the text
                            start_date = None
                            start_time = None
                            description = ""

                            for line in lines[1:]:
                                # Look for date patterns
                                if not start_date:
                                    parsed_date = parse_date(line)
                                    if parsed_date:
                                        start_date = parsed_date
                                        continue

                                # Look for time patterns
                                if not start_time and re.search(r'\d{1,2}:\d{2}|am|pm', line, re.IGNORECASE):
                                    parsed_time = parse_time(line)
                                    if parsed_time:
                                        start_time = parsed_time
                                        continue

                                # Accumulate description
                                if len(line) > 20 and line not in title:
                                    description += line + " "

                            # If no date found, skip
                            if not start_date:
                                continue

                            events_found += 1
                            events_found_on_page = True

                            description = description.strip()[:500]
                            category = determine_category(title, description)
                            tags = extract_tags(title, description)
                            is_free = is_free_event(title, description)

                            content_hash = generate_content_hash(
                                title, "New Georgia Project", start_date
                            )

                            if find_event_by_hash(content_hash):
                                events_updated += 1
                                continue

                            # Get specific event URL


                            event_url = find_event_url(title, event_links, EVENTS_URL)



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
                                "source_url": event_url,
                                "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
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
                            logger.warning(f"Error processing event element: {e}")
                            continue

                    # Found events with this selector, stop trying others
                    break

            # If no events found with structured selectors, try text parsing
            if not events_found_on_page:
                logger.info("No events found with standard selectors, trying text parsing")
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                # Look for patterns like date followed by event info
                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Try to parse as date
                    parsed_date = parse_date(line)
                    if parsed_date and i + 1 < len(lines):
                        # Next line might be title
                        potential_title = lines[i + 1]
                        if len(potential_title) > 10 and not potential_title.startswith("http"):
                            title = potential_title
                            description = ""
                            start_time = None

                            # Look ahead for time and description
                            if i + 2 < len(lines):
                                next_line = lines[i + 2]
                                parsed_time = parse_time(next_line)
                                if parsed_time:
                                    start_time = parsed_time
                                elif len(next_line) > 20:
                                    description = next_line[:500]

                            events_found += 1

                            category = determine_category(title, description)
                            tags = extract_tags(title, description)
                            is_free = is_free_event(title, description)

                            content_hash = generate_content_hash(
                                title, "New Georgia Project", parsed_date
                            )

                            if not find_event_by_hash(content_hash):
                                # Get specific event URL

                                event_url = find_event_url(title, event_links, EVENTS_URL)


                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": description if description else None,
                                    "start_date": parsed_date,
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
                                    "source_url": event_url,
                                    "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
                                    "image_url": image_map.get(title),
                                    "raw_text": f"{title} | {description[:200]}"[:500],
                                    "extraction_confidence": 0.75,
                                    "is_recurring": False,
                                    "recurrence_rule": None,
                                    "content_hash": content_hash,
                                }

                                try:
                                    insert_event(event_record)
                                    events_new += 1
                                    logger.info(f"Added: {title} on {parsed_date}")
                                except Exception as e:
                                    logger.error(f"Failed to insert: {title}: {e}")
                            else:
                                events_updated += 1

                    i += 1

            browser.close()

        logger.info(
            f"New Georgia Project crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching New Georgia Project: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl New Georgia Project: {e}")
        raise

    return events_found, events_new, events_updated
