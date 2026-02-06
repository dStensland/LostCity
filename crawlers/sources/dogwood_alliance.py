"""
Crawler for Dogwood Alliance (dogwoodalliance.org/events).

Dogwood Alliance is a forest and climate justice organization working to protect
Southern forests and communities. Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.dogwoodalliance.org"
EVENTS_URL = f"{BASE_URL}/events"

# Dogwood Alliance HQ venue
DOGWOOD_ALLIANCE_HQ = {
    "name": "Dogwood Alliance",
    "slug": "dogwood-alliance",
    "address": "526 Howard Ave NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "venue_type": "nonprofit",
    "website": BASE_URL,
}


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["volunteer", "action", "cleanup", "rally", "march", "protest"]):
        return "community"
    if any(word in text for word in ["workshop", "class", "training", "education", "webinar"]):
        return "education"
    if any(word in text for word in ["fundraiser", "gala", "benefit"]):
        return "community"
    if any(word in text for word in ["tour", "hike", "walk"]):
        return "outdoor"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["environmental", "forests", "activism", "climate"]

    if any(word in text for word in ["volunteer", "action"]):
        tags.append("volunteer")
    if any(word in text for word in ["justice", "equity"]):
        tags.append("social-justice")
    if any(word in text for word in ["community", "organizing"]):
        tags.append("community")
    if any(word in text for word in ["education", "training", "learn", "webinar"]):
        tags.append("education")
    if any(word in text for word in ["outdoor", "nature", "forest", "tree"]):
        tags.append("outdoor")
    if any(word in text for word in ["family", "kid", "children", "all ages"]):
        tags.append("family-friendly")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:", "donation"]):
        return False

    # Default to True for community/activist events
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Dogwood Alliance events using Playwright.

    The events page structure may vary, so we'll extract all event-like content
    and let the patterns determine what's valid.
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

            # Get venue ID for Dogwood Alliance HQ
            venue_id = get_or_create_venue(DOGWOOD_ALLIANCE_HQ)

            logger.info(f"Fetching Dogwood Alliance events: {EVENTS_URL}")
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

            # Try to find event cards/items - common patterns
            event_selectors = [
                ".event-item",
                ".event-card",
                "article",
                "[class*='event']",
                ".tribe-events-list-event",  # Common WP events plugin
            ]

            events = []
            for selector in event_selectors:
                try:
                    elements = page.query_selector_all(selector)
                    if elements and len(elements) > 0:
                        logger.info(f"Found {len(elements)} elements with selector: {selector}")
                        events = elements
                        break
                except Exception as e:
                    continue

            # If no structured events found, parse body text
            if not events:
                logger.info("No structured events found, parsing body text")
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                # Look for date patterns in text
                date_pattern = re.compile(
                    r'(\w+day,?\s+\w+\s+\d+|\w+\s+\d+,?\s+\d{4})',
                    re.IGNORECASE
                )

                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Skip navigation, headers, short lines
                    if len(line) < 10 or line.lower() in ["events", "upcoming", "past events"]:
                        i += 1
                        continue

                    # Check if line contains a date
                    if date_pattern.search(line):
                        # Potential event found
                        title = line if len(line) < 100 else lines[i - 1] if i > 0 else line
                        description = ""

                        # Look for description in next few lines
                        for j in range(i + 1, min(i + 4, len(lines))):
                            if len(lines[j]) > 30 and not date_pattern.search(lines[j]):
                                description = lines[j]
                                break

                        if title:
                            try:
                                # Try to parse the date
                                date_match = date_pattern.search(line)
                                date_str = date_match.group(1)

                                # Try common date formats
                                current_year = datetime.now().year
                                start_date = None

                                for fmt in ["%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y",
                                           "%A, %B %d", "%A %B %d", "%a, %b %d", "%a %b %d"]:
                                    try:
                                        if "%Y" not in fmt:
                                            date_str_with_year = f"{date_str} {current_year}"
                                            dt = datetime.strptime(date_str_with_year, f"{fmt} %Y")
                                        else:
                                            dt = datetime.strptime(date_str, fmt)

                                        # If date is in the past, try next year
                                        if dt.date() < datetime.now().date():
                                            dt = dt.replace(year=current_year + 1)

                                        start_date = dt.strftime("%Y-%m-%d")
                                        break
                                    except ValueError:
                                        continue

                                if start_date:
                                    events_found += 1

                                    category = determine_category(title, description)
                                    tags = extract_tags(title, description)
                                    is_free = is_free_event(title, description)

                                    content_hash = generate_content_hash(
                                        title, "Dogwood Alliance", start_date
                                    )

                                    if find_event_by_hash(content_hash):
                                        events_updated += 1
                                        i += 1
                                        continue

                                    # Get specific event URL


                                    event_url = find_event_url(title, event_links, EVENTS_URL)



                                    event_record = {
                                        "source_id": source_id,
                                        "venue_id": venue_id,
                                        "title": title[:200],
                                        "description": description[:500] if description else None,
                                        "start_date": start_date,
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
                                        "source_url": event_url,
                                        "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
                                        "image_url": image_map.get(title[:100]),
                                        "raw_text": f"{title} | {line} | {description[:200]}"[:500],
                                        "extraction_confidence": 0.75,
                                        "is_recurring": False,
                                        "recurrence_rule": None,
                                        "content_hash": content_hash,
                                    }

                                    try:
                                        insert_event(event_record)
                                        events_new += 1
                                        logger.info(f"Added: {title[:50]} on {start_date}")
                                    except Exception as e:
                                        logger.error(f"Failed to insert: {title[:50]}: {e}")

                            except Exception as e:
                                logger.debug(f"Could not parse event from line: {line[:50]}: {e}")

                    i += 1

            else:
                # Process structured events
                for event_elem in events:
                    try:
                        text = event_elem.inner_text()

                        # Extract title (usually first line or h2/h3)
                        title_elem = event_elem.query_selector("h2, h3, .event-title, .title")
                        title = title_elem.inner_text() if title_elem else text.split("\n")[0]

                        # Extract description
                        desc_elem = event_elem.query_selector(".description, .event-description, p")
                        description = desc_elem.inner_text() if desc_elem else ""

                        # Extract date
                        date_elem = event_elem.query_selector(".date, .event-date, time")
                        date_text = date_elem.inner_text() if date_elem else text

                        # Try to parse date from text
                        date_pattern = re.compile(
                            r'(\w+day,?\s+\w+\s+\d+|\w+\s+\d+,?\s+\d{4})',
                            re.IGNORECASE
                        )
                        date_match = date_pattern.search(date_text)

                        if not date_match:
                            continue

                        date_str = date_match.group(1)
                        current_year = datetime.now().year
                        start_date = None

                        for fmt in ["%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y",
                                   "%A, %B %d", "%A %B %d"]:
                            try:
                                if "%Y" not in fmt:
                                    date_str_with_year = f"{date_str} {current_year}"
                                    dt = datetime.strptime(date_str_with_year, f"{fmt} %Y")
                                else:
                                    dt = datetime.strptime(date_str, fmt)

                                if dt.date() < datetime.now().date():
                                    dt = dt.replace(year=current_year + 1)

                                start_date = dt.strftime("%Y-%m-%d")
                                break
                            except ValueError:
                                continue

                        if not start_date or not title:
                            continue

                        events_found += 1

                        category = determine_category(title, description)
                        tags = extract_tags(title, description)
                        is_free = is_free_event(title, description)

                        content_hash = generate_content_hash(
                            title, "Dogwood Alliance", start_date
                        )

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        # Get specific event URL


                        event_url = find_event_url(title, event_links, EVENTS_URL)



                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title[:200],
                            "description": description[:500] if description else None,
                            "start_date": start_date,
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
                            "source_url": event_url,
                            "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
                            "image_url": image_map.get(title[:100]),
                            "raw_text": text[:500],
                            "extraction_confidence": 0.80,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title[:50]} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title[:50]}: {e}")

                    except Exception as e:
                        logger.debug(f"Error processing event element: {e}")
                        continue

            browser.close()

        logger.info(
            f"Dogwood Alliance crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Dogwood Alliance: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Dogwood Alliance: {e}")
        raise

    return events_found, events_new, events_updated
