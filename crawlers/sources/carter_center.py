"""
Crawler for The Carter Center (cartercenter.org).

The Carter Center is a human rights organization founded by President Jimmy Carter.
It hosts lectures, discussions, and educational events focused on human rights,
peace, democracy, and global health.
Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.cartercenter.org"
EVENTS_URL = f"{BASE_URL}/events"

# The Carter Center venue
CARTER_CENTER = {
    "name": "The Carter Center",
    "slug": "carter-center",
    "address": "453 John Lewis Freedom Pkwy NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "venue_type": "nonprofit",
    "website": BASE_URL,
}


def parse_date_string(date_str: str) -> Optional[str]:
    """
    Parse various date formats from Carter Center events.
    Examples: 'February 15, 2026', 'Feb 15, 2026', 'Tue, Feb 15'
    """
    try:
        # Clean up the string
        date_str = date_str.strip()

        # Remove day name if present (e.g., "Tue, Feb 15")
        date_str = re.sub(r'^[A-Za-z]+,?\s+', '', date_str)

        current_year = datetime.now().year

        # Try "Month DD, YYYY" format
        match = re.search(r'([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})', date_str)
        if match:
            month, day, year = match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")

        # Try "Month DD" format (no year)
        match = re.search(r'([A-Za-z]+)\s+(\d{1,2})', date_str)
        if match:
            month, day = match.groups()
            # Try full month name first
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
            except ValueError:
                # Try abbreviated month name
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            return dt.strftime("%Y-%m-%d")

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date '{date_str}': {e}")

    return None


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '6:00 PM', '12:30 PM', '6pm', '12:30pm'
    """
    try:
        time_str = time_str.strip().upper()

        # Pattern: H:MM AM/PM or H AM/PM or HAM/PM
        match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(AM|PM)', time_str)
        if match:
            hour = int(match.group(1))
            minute = match.group(2) or "00"
            period = match.group(3)

            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0

            return f"{hour:02d}:{minute}"

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse time '{time_str}': {e}")

    return None


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["lecture", "talk", "discussion", "panel", "speaker", "presentation"]):
        return "education"
    if any(word in text for word in ["workshop", "class", "training", "seminar"]):
        return "education"
    if any(word in text for word in ["exhibit", "exhibition", "gallery", "museum"]):
        return "art"
    if any(word in text for word in ["film", "screening", "movie", "documentary"]):
        return "film"
    if any(word in text for word in ["volunteer", "community service"]):
        return "community"
    if any(word in text for word in ["tour", "visit", "garden"]):
        return "education"

    # Default to community for Carter Center
    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = []

    # Base tags
    tags.extend(["human-rights", "education"])

    if any(word in text for word in ["peace", "conflict", "diplomacy", "democracy"]):
        tags.append("peace")
    if any(word in text for word in ["civil rights", "voting", "election", "democracy"]):
        tags.append("civil-rights")
    if any(word in text for word in ["health", "disease", "medicine", "guinea worm"]):
        tags.append("global-health")
    if any(word in text for word in ["lecture", "talk", "discussion", "speaker"]):
        tags.append("lecture")
    if any(word in text for word in ["workshop", "class", "training"]):
        tags.append("workshop")
    if any(word in text for word in ["exhibit", "exhibition", "museum"]):
        tags.append("exhibition")
    if any(word in text for word in ["film", "screening", "documentary"]):
        tags.append("film")
    if any(word in text for word in ["tour", "garden"]):
        tags.append("tour")
    if any(word in text for word in ["volunteer"]):
        tags.append("volunteer")
    if any(word in text for word in ["free", "no cost"]):
        tags.append("free")
    if any(word in text for word in ["carter", "president carter", "jimmy carter"]):
        tags.append("presidential-history")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary", "free admission"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:", "paid"]):
        # But some events say "free admission"
        if "free admission" in text or "free entry" in text:
            return True
        return False

    # Most Carter Center events are free
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl The Carter Center events using Playwright.

    The site has an events page with JavaScript-rendered event listings.
    Each event typically includes title, date, time, and description.
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

            # Get venue ID
            venue_id = get_or_create_venue(CARTER_CENTER)

            logger.info(f"Fetching Carter Center events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract images
            image_map = extract_images_from_page(page)

            # Try to find event containers - common patterns
            event_selectors = [
                ".event-item",
                ".event-card",
                "[class*='event']",
                "article",
                ".tribe-events-list-event",
                ".calendar-event",
                ".views-row",
            ]

            events = None
            for selector in event_selectors:
                events = page.query_selector_all(selector)
                if events and len(events) > 0:
                    logger.info(f"Found {len(events)} events using selector: {selector}")
                    break

            if not events:
                logger.warning("No event elements found on page")
                # Fallback: parse body text
                body_text = page.inner_text("body")
                logger.debug(f"Page text preview: {body_text[:500]}")

            # If we found event elements, parse them
            if events:
                for event_elem in events:
                    try:
                        event_text = event_elem.inner_text()
                        event_html = event_elem.inner_html()

                        # Extract title (usually first/largest text or h2/h3)
                        title_elem = event_elem.query_selector("h1, h2, h3, h4, .title, .event-title, [class*='title']")
                        if title_elem:
                            title = title_elem.inner_text().strip()
                        else:
                            # Fallback: first line
                            lines = [l.strip() for l in event_text.split("\n") if l.strip()]
                            title = lines[0] if lines else None

                        if not title or len(title) < 3:
                            continue

                        # Look for date and time in text
                        date_str = None
                        time_str = None

                        # Try to find date elements
                        date_elem = event_elem.query_selector(".date, .event-date, [class*='date'], time")
                        if date_elem:
                            date_str = date_elem.inner_text().strip()

                        # Try to find time elements
                        time_elem = event_elem.query_selector(".time, .event-time, [class*='time']")
                        if time_elem:
                            time_str = time_elem.inner_text().strip()

                        # If not found in elements, search in text
                        if not date_str:
                            # Look for date patterns in text
                            date_match = re.search(r'([A-Za-z]+\s+\d{1,2}(?:,\s+\d{4})?)', event_text)
                            if date_match:
                                date_str = date_match.group(1)

                        if not time_str:
                            # Look for time patterns
                            time_match = re.search(r'(\d{1,2}(?::\d{2})?\s*[AP]M)', event_text, re.IGNORECASE)
                            if time_match:
                                time_str = time_match.group(1)

                        # Parse dates and times
                        start_date = parse_date_string(date_str) if date_str else None
                        start_time = parse_time_string(time_str) if time_str else None

                        if not start_date:
                            logger.debug(f"No valid date found for: {title}")
                            continue

                        # Extract description
                        description = ""
                        desc_elem = event_elem.query_selector(".description, .event-description, .excerpt, .summary, p")
                        if desc_elem:
                            description = desc_elem.inner_text().strip()

                        events_found += 1

                        category = determine_category(title, description)
                        tags = extract_tags(title, description)
                        is_free = is_free_event(title, description)

                        content_hash = generate_content_hash(
                            title, "The Carter Center", start_date
                        )


                        # Look for event URL
                        link_elem = event_elem.query_selector("a[href]")
                        event_url = EVENTS_URL
                        if link_elem:
                            href = link_elem.get_attribute("href")
                            if href:
                                if href.startswith("http"):
                                    event_url = href
                                elif href.startswith("/"):
                                    event_url = BASE_URL + href

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
                            "ticket_url": None,
                            "image_url": image_map.get(title),
                            "raw_text": event_text[:500],
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
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.warning(f"Error parsing event element: {e}")
                        continue

            browser.close()

        logger.info(
            f"Carter Center crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Carter Center: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Carter Center: {e}")
        raise

    return events_found, events_new, events_updated
