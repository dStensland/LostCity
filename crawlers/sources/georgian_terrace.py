"""
Crawler for The Georgian Terrace Hotel (thegeorgianterrace.com/events).
Historic Midtown hotel across from the Fox Theatre with event spaces.
Hosts weddings, galas, and special events.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://thegeorgianterrace.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "The Georgian Terrace Hotel",
    "slug": "georgian-terrace-hotel",
    "address": "659 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "venue_type": "hotel",
    "website": BASE_URL,
}


def parse_date(date_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse various date formats from Georgian Terrace events."""
    try:
        current_year = datetime.now().year

        # Clean up the date string
        date_str = date_str.strip()

        # Try various formats
        formats = [
            "%B %d, %Y",  # January 31, 2026
            "%b %d, %Y",   # Jan 31, 2026
            "%m/%d/%Y",    # 01/31/2026
            "%Y-%m-%d",    # 2026-01-31
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime("%Y-%m-%d"), None
            except ValueError:
                continue

        # Try format with time
        match = re.search(
            r'(\w+\s+\d{1,2},?\s+\d{4})\s+(?:at\s+)?(\d{1,2}:\d{2}\s*(?:AM|PM)?)',
            date_str,
            re.IGNORECASE
        )
        if match:
            date_part, time_part = match.groups()
            for fmt in ["%B %d, %Y", "%b %d, %Y"]:
                try:
                    dt = datetime.strptime(date_part, fmt)
                    date_result = dt.strftime("%Y-%m-%d")

                    # Parse time
                    time_match = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)?', time_part, re.IGNORECASE)
                    if time_match:
                        hour = int(time_match.group(1))
                        minute = int(time_match.group(2))
                        period = time_match.group(3)

                        if period:
                            period = period.upper()
                            if period == 'PM' and hour != 12:
                                hour += 12
                            elif period == 'AM' and hour == 12:
                                hour = 0

                        time_result = f"{hour:02d}:{minute:02d}"
                        return date_result, time_result
                    return date_result, None
                except ValueError:
                    continue

        return None, None

    except Exception as e:
        logger.debug(f"Failed to parse date '{date_str}': {e}")
        return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgian Terrace events."""
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

            logger.info(f"Fetching Georgian Terrace: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images
            image_map = extract_images_from_page(page)

            # Scroll to load all events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Look for event elements - Georgian Terrace uses Divi/WordPress
            event_selectors = [
                ".et_pb_post",  # Divi posts
                "article[class*='event']",  # Event articles
                ".tribe-events-list-event-row",  # The Events Calendar plugin
                "[class*='upcoming-event']",
            ]

            event_items = []
            for selector in event_selectors:
                items = page.query_selector_all(selector)
                if items:
                    event_items = items
                    logger.info(f"Found {len(items)} events using selector: {selector}")
                    break

            if not event_items:
                logger.info("No structured events found on page")
                # Check if there's text content that mentions events
                body_text = page.inner_text("body").lower()
                if "event" not in body_text and "calendar" not in body_text:
                    logger.info("No event content found")
                else:
                    logger.info("Event content exists but structure not recognized")
                browser.close()
                return events_found, events_new, events_updated

            for item in event_items:
                try:
                    # Extract title
                    title_elem = item.query_selector("h1, h2, h3, h4, .entry-title, .tribe-events-list-event-title")
                    title = title_elem.inner_text().strip() if title_elem else None

                    if not title:
                        continue

                    # Skip generic/template content
                    if title.lower() in ["upcoming events", "past events", "no events", "events"]:
                        continue

                    # Extract date
                    date_elem = item.query_selector(
                        ".event-date, .tribe-event-date-start, time, [class*='date']"
                    )
                    date_text = date_elem.inner_text().strip() if date_elem else None

                    # Also check datetime attribute on time element
                    if not date_text and date_elem and date_elem.get_attribute("datetime"):
                        date_text = date_elem.get_attribute("datetime")

                    if date_text:
                        start_date, start_time = parse_date(date_text)
                        if not start_date:
                            continue
                    else:
                        # Skip events without dates
                        continue

                    # Extract description
                    desc_elem = item.query_selector(".entry-summary, .tribe-events-list-event-description, p")
                    description = desc_elem.inner_text().strip()[:500] if desc_elem else None

                    # Extract URL
                    link_elem = item.query_selector("a")
                    event_url = link_elem.get_attribute("href") if link_elem else EVENTS_URL
                    if event_url and not event_url.startswith("http"):
                        event_url = BASE_URL + event_url

                    events_found += 1

                    content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Categorize event
                    title_lower = (title + " " + (description or "")).lower()
                    if any(w in title_lower for w in ["wedding", "gala", "reception"]):
                        category, subcategory = "social", "private_event"
                        tags = ["social", "hotel", "private-event"]
                    elif any(w in title_lower for w in ["music", "concert", "live", "performance"]):
                        category, subcategory = "music", "live"
                        tags = ["music", "live-music", "hotel"]
                    elif any(w in title_lower for w in ["dinner", "brunch", "meal"]):
                        category, subcategory = "food", "dining"
                        tags = ["food", "dining", "hotel"]
                    else:
                        category, subcategory = "nightlife", "special_event"
                        tags = ["nightlife", "hotel", "midtown"]

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": None,
                        "image_url": image_map.get(title),
                        "raw_text": None,
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
                        logger.error(f"Failed to insert {title}: {e}")

                except Exception as e:
                    logger.debug(f"Failed to parse event item: {e}")
                    continue

            browser.close()

        logger.info(
            f"Georgian Terrace crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Georgian Terrace: {e}")
        raise

    return events_found, events_new, events_updated
