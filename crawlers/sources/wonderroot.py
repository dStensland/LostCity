"""
Crawler for WonderRoot (wonderroot.org).

WonderRoot is an arts and community development organization that produces
exhibitions, performances, workshops, and community programs focused on
social justice and youth empowerment.
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

BASE_URL = "https://www.wonderroot.org"
EVENTS_URL = f"{BASE_URL}/events"

# WonderRoot venue
WONDERROOT = {
    "name": "WonderRoot",
    "slug": "wonderroot",
    "address": "982 Memorial Dr SE",
    "neighborhood": "Reynoldstown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "arts",
    "website": BASE_URL,
}


def parse_date_string(date_str: str) -> Optional[str]:
    """
    Parse various date formats from WonderRoot events.
    Examples: 'February 15, 2026', 'Feb 15', 'Sat, Feb 15'
    """
    try:
        # Clean up the string
        date_str = date_str.strip()

        # Remove day name if present (e.g., "Sat, Feb 15")
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
    Examples: '6:00 PM', '7:30 PM', '6pm', '7:30pm'
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

    if any(word in text for word in ["exhibition", "exhibit", "gallery", "opening", "art show", "installation"]):
        return "art"
    if any(word in text for word in ["performance", "theater", "theatre", "show", "dance"]):
        return "theater"
    if any(word in text for word in ["concert", "music", "dj", "live music"]):
        return "music"
    if any(word in text for word in ["workshop", "class", "training", "seminar", "learn"]):
        return "education"
    if any(word in text for word in ["volunteer", "community", "neighborhood", "youth"]):
        return "community"
    if any(word in text for word in ["film", "screening", "movie", "documentary"]):
        return "film"

    # Default to art for WonderRoot
    return "art"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = []

    # Base tags
    tags.extend(["arts", "community"])

    if any(word in text for word in ["youth", "young adult", "teen"]):
        tags.append("youth")
    if any(word in text for word in ["volunteer", "service"]):
        tags.append("volunteer")
    if any(word in text for word in ["social justice", "activism", "equity", "justice"]):
        tags.append("social-justice")
    if any(word in text for word in ["music", "concert", "performance"]):
        tags.append("music")
    if any(word in text for word in ["art", "visual", "exhibition"]):
        tags.append("visual-arts")
    if any(word in text for word in ["workshop", "class", "education"]):
        tags.append("education")
    if any(word in text for word in ["family", "kid", "children", "all ages"]):
        tags.append("family-friendly")
    if any(word in text for word in ["opening", "reception"]):
        tags.append("opening-reception")
    if any(word in text for word in ["film", "screening", "movie"]):
        tags.append("film")
    if any(word in text for word in ["free", "no cost"]):
        tags.append("free")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:", "admission"]):
        # But some events say "free admission"
        if "free admission" in text or "free entry" in text:
            return True
        return False

    # Many WonderRoot events are free or donation-based
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl WonderRoot events using Playwright.

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
            venue_id = get_or_create_venue(WONDERROOT)

            logger.info(f"Fetching WonderRoot events: {EVENTS_URL}")
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
                ".summary",
                ".eventlist-event",
                ".sqs-block-summary-v2",
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
                        desc_elem = event_elem.query_selector(".description, .event-description, .excerpt, .summary-excerpt, p")
                        if desc_elem:
                            description = desc_elem.inner_text().strip()

                        events_found += 1

                        category = determine_category(title, description)
                        tags = extract_tags(title, description)
                        is_free = is_free_event(title, description)

                        content_hash = generate_content_hash(
                            title, "WonderRoot", start_date
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
            f"WonderRoot crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching WonderRoot: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl WonderRoot: {e}")
        raise

    return events_found, events_new, events_updated
