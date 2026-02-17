"""
Crawler for MadLife Stage & Studios (madlifestage.com).
Premier music venue in Woodstock, GA.

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://madlifestageandstudios.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "MadLife Stage & Studios",
    "slug": "madlife-stage-studios",
    "address": "8722 Main St",
    "neighborhood": "Woodstock",
    "city": "Woodstock",
    "state": "GA",
    "zip": "30188",
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from various formats like '8:00 PM', '8pm', '8:00pm'."""
    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        minute = minute or "00"
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from various formats:
    - 'Jan 31, 2026'
    - 'January 31'
    - 'Sat Jan 31'
    - 'SAT, JAN 31, 2026'
    """
    # Try full format with year
    match = re.search(r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    # Try format with day name: SAT, JAN 31, 2026
    match = re.search(r"[A-Za-z]+,\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try without year (use current or next year)
    match = re.search(r"([A-Za-z]+)\s+(\d{1,2})", date_text)
    if match:
        month, day = match.groups()
        current_year = datetime.now().year
        try:
            dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
        except ValueError:
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")
            except ValueError:
                return None

        # If date is in the past, try next year
        if dt.date() < datetime.now().date():
            dt = dt.replace(year=current_year + 1)

        return dt.strftime("%Y-%m-%d")

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl MadLife Stage & Studios events using Playwright."""
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

            logger.info(f"Fetching MadLife Stage & Studios: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Try to find event elements using common selectors
            try:
                # Look for event containers - common patterns
                event_selectors = [
                    ".event-item",
                    ".show",
                    ".event",
                    "[class*='event']",
                    ".list-view-item",
                    "article.show",
                    "div[class*='show']",
                    ".rhino-event-item",
                    ".tw-event-item"
                ]

                event_elements = []
                for selector in event_selectors:
                    event_elements = page.query_selector_all(selector)
                    if event_elements and len(event_elements) > 2:
                        logger.info(f"Found {len(event_elements)} events with selector: {selector}")
                        break

                if event_elements:
                    # Parse structured event elements
                    for element in event_elements:
                        try:
                            # Extract text content
                            text = element.inner_text()
                            if not text or len(text) < 10:
                                continue

                            lines = [l.strip() for l in text.split("\n") if l.strip()]
                            if len(lines) < 2:
                                continue

                            # Try to extract title, date, time
                            title = lines[0]
                            date_str = None
                            time_str = None

                            # Look for date and time in subsequent lines
                            for line in lines[1:]:
                                if not date_str:
                                    date_str = parse_date(line)
                                if not time_str and re.search(r"\d{1,2}:?\d{0,2}\s*(am|pm)", line, re.IGNORECASE):
                                    time_str = parse_time(line)
                                if date_str and time_str:
                                    break

                            if not date_str:
                                continue

                            events_found += 1

                            # Generate content hash
                            content_hash = generate_content_hash(title, "MadLife Stage & Studios", date_str)

                            # Check for existing

                            # Build description from remaining lines
                            description = None
                            if len(lines) > 2:
                                desc_lines = [l for l in lines[1:] if l and not parse_date(l) and not re.search(r"\d{1,2}:?\d{0,2}\s*(am|pm)", l, re.IGNORECASE)]
                                if desc_lines:
                                    description = " ".join(desc_lines[:3])

                            # Get specific event URL


                            event_url = find_event_url(title, event_links, EVENTS_URL)



                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": description,
                                "start_date": date_str,
                                "start_time": time_str,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": time_str is None,
                                "category": "music",
                                "subcategory": "concert",
                                "tags": ["live-music", "woodstock", "concerts"],
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": False,
                                "source_url": event_url,
                                "ticket_url": event_url,
                                "image_url": image_map.get(title),
                                "raw_text": text[:500],
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
                                logger.info(f"Added: {title} on {date_str}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {title}: {e}")

                        except Exception as e:
                            logger.error(f"Error parsing event element: {e}")
                            continue

                else:
                    # Fallback: parse page text line by line
                    logger.info("No structured events found, parsing page text")
                    body_text = page.inner_text("body")
                    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                    i = 0
                    while i < len(lines):
                        line = lines[i]

                        # Skip navigation/header items
                        if len(line) < 3 or line.lower() in ["events", "shows", "calendar", "menu", "about", "contact"]:
                            i += 1
                            continue

                        # Try to find date patterns
                        date_str = parse_date(line)
                        if date_str:
                            # Look for title before and after
                            title = None
                            time_str = None

                            # Check previous line for title
                            if i > 0:
                                prev = lines[i - 1]
                                if len(prev) > 10 and not parse_date(prev):
                                    title = prev

                            # Check next line for title or time
                            if i + 1 < len(lines):
                                next_line = lines[i + 1]
                                if not title and len(next_line) > 10:
                                    title = next_line
                                time_str = parse_time(next_line)

                            if title:
                                events_found += 1

                                content_hash = generate_content_hash(title, "MadLife Stage & Studios", date_str)
                                existing = find_event_by_hash(content_hash)
                                if existing:
                                    smart_update_existing_event(existing, event_record)
                                    events_updated += 1
                                    i += 1
                                    continue

                                # Get specific event URL


                                event_url = find_event_url(title, event_links, EVENTS_URL)



                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": None,
                                    "start_date": date_str,
                                    "start_time": time_str,
                                    "end_date": None,
                                    "end_time": None,
                                    "is_all_day": time_str is None,
                                    "category": "music",
                                    "subcategory": "concert",
                                    "tags": ["live-music", "woodstock", "concerts"],
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": None,
                                    "is_free": False,
                                    "source_url": event_url,
                                    "ticket_url": event_url,
                                    "image_url": image_map.get(title),
                                    "raw_text": f"{title} - {line}",
                                    "extraction_confidence": 0.80,
                                    "is_recurring": False,
                                    "recurrence_rule": None,
                                    "content_hash": content_hash,
                                }

                                try:
                                    insert_event(event_record)
                                    events_new += 1
                                    logger.info(f"Added: {title} on {date_str}")
                                except Exception as e:
                                    logger.error(f"Failed to insert: {title}: {e}")

                        i += 1

            except Exception as e:
                logger.error(f"Error during event extraction: {e}")

            browser.close()

        logger.info(
            f"MadLife Stage & Studios crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl MadLife Stage & Studios: {e}")
        raise

    return events_found, events_new, events_updated
