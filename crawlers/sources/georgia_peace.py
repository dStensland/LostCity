"""
Crawler for Georgia Peace and Justice Coalition (georgiapeace.org).

GPJC organizes peace education, anti-war activism, and social justice events
in the Atlanta area. Site uses JavaScript rendering - must use Playwright.
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

BASE_URL = "https://georgiapeace.org"
EVENTS_URL = f"{BASE_URL}/events"

# GPJC headquarters venue
GPJC_HQ = {
    "name": "Georgia Peace and Justice Coalition",
    "slug": "georgia-peace-justice-coalition",
    "city": "Atlanta",
    "state": "GA",
    "venue_type": "nonprofit",
    "website": BASE_URL,
}


def parse_date_string(date_str: str) -> Optional[dict]:
    """
    Parse various date formats found on GPJC events.
    Examples:
    - "February 15, 2026"
    - "Feb 15"
    - "2/15/2026"
    """
    if not date_str:
        return None

    date_str = date_str.strip()
    current_year = datetime.now().year

    # Try "Month DD, YYYY" format
    patterns = [
        (r'(\w+)\s+(\d{1,2}),?\s+(\d{4})', "%B %d %Y"),  # February 15, 2026
        (r'(\w+)\s+(\d{1,2})', "%B %d"),  # February 15 (current/next year)
        (r'(\d{1,2})/(\d{1,2})/(\d{4})', "%m/%d/%Y"),  # 2/15/2026
    ]

    for pattern, format_str in patterns:
        match = re.match(pattern, date_str, re.IGNORECASE)
        if match:
            try:
                if "%Y" not in format_str:
                    # Add current year
                    dt = datetime.strptime(date_str, format_str)
                    dt = dt.replace(year=current_year)
                    # If date is in the past, assume next year
                    if dt.date() < datetime.now().date():
                        dt = dt.replace(year=current_year + 1)
                else:
                    dt = datetime.strptime(date_str, format_str)

                return {
                    "start_date": dt.strftime("%Y-%m-%d"),
                }
            except ValueError:
                continue

    return None


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string into HH:MM format.
    Examples: "6:30pm", "6pm", "18:30"
    """
    if not time_str:
        return None

    time_str = time_str.strip()

    # Pattern for "6:30pm" or "6pm"
    match = re.search(r'(\d{1,2}):?(\d{2})?\s*(am|pm)?', time_str, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        minute = minute or "00"

        if period:
            period = period.lower()
            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0

        return f"{hour:02d}:{minute}"

    return None


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["workshop", "class", "training", "teach-in", "education"]):
        return "education"
    if any(word in text for word in ["film", "movie", "screening", "documentary"]):
        return "film"
    if any(word in text for word in ["music", "concert", "performance"]):
        return "music"
    if any(word in text for word in ["rally", "march", "protest", "demonstration"]):
        return "community"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["peace", "activism", "social-justice"]

    if any(word in text for word in ["anti-war", "antiwar", "war", "military"]):
        tags.append("anti-war")
    if any(word in text for word in ["climate", "environment", "justice"]):
        tags.append("environmental")
    if any(word in text for word in ["racial", "race", "racism"]):
        tags.append("racial-justice")
    if any(word in text for word in ["labor", "union", "worker"]):
        tags.append("labor")
    if any(word in text for word in ["palestine", "gaza", "israel"]):
        tags.append("palestine")
    if any(word in text for word in ["film", "movie", "screening"]):
        tags.append("film")
    if any(word in text for word in ["volunteer", "action", "organize"]):
        tags.append("volunteer")
    if any(word in text for word in ["meeting", "coalition"]):
        tags.append("meeting")

    # Most GPJC events are free
    if not any(word in text for word in ["$", "ticket", "cost", "fee", "donation"]):
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

    # Default to True for GPJC (most events are free)
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Georgia Peace and Justice Coalition events using Playwright.

    The site structure may vary, so this crawler attempts to find event
    listings in common formats (list items, articles, divs with event classes).
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

            # Get venue ID for GPJC HQ
            venue_id = get_or_create_venue(GPJC_HQ)

            logger.info(f"Fetching GPJC events: {EVENTS_URL}")

            try:
                page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(5000)
            except Exception as e:
                # Try alternate URLs if /events doesn't work
                logger.warning(f"Failed to load /events, trying /calendar: {e}")
                try:
                    page.goto(f"{BASE_URL}/calendar", wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(5000)
                except Exception as e2:
                    logger.error(f"Failed to load calendar page: {e2}")
                    browser.close()
                    return events_found, events_new, events_updated

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text for parsing
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Try to find event elements using common selectors
            event_selectors = [
                ".event",
                ".tribe-event",
                "article.event",
                ".upcoming-event",
                "[class*='event']",
            ]

            events_elements = []
            for selector in event_selectors:
                elements = page.query_selector_all(selector)
                if elements:
                    logger.info(f"Found {len(elements)} events using selector: {selector}")
                    events_elements = elements
                    break

            if events_elements:
                # Process structured event elements
                for elem in events_elements:
                    try:
                        elem_text = elem.inner_text()
                        elem_lines = [l.strip() for l in elem_text.split("\n") if l.strip()]

                        if len(elem_lines) < 2:
                            continue

                        # Assume first line is title
                        title = elem_lines[0]

                        # Look for date/time in subsequent lines
                        date_info = None
                        time_info = None
                        description = ""

                        for line in elem_lines[1:]:
                            if not date_info:
                                date_info = parse_date_string(line)
                            if not time_info:
                                time_info = parse_time_string(line)
                            if len(line) > 30 and not date_info and not time_info:
                                description = line
                                break

                        if not date_info:
                            continue

                        events_found += 1

                        category = determine_category(title, description)
                        tags = extract_tags(title, description)
                        is_free = is_free_event(title, description)

                        content_hash = generate_content_hash(
                            title, "Georgia Peace and Justice Coalition", date_info["start_date"]
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
                            "start_date": date_info["start_date"],
                            "start_time": time_info,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": time_info is None,
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
                            "raw_text": f"{title} | {elem_text[:400]}"[:500],
                            "extraction_confidence": 0.80,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {date_info['start_date']}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.error(f"Error processing event element: {e}")
                        continue

            else:
                # Fallback: parse text line-by-line
                logger.info("No structured events found, trying line-by-line parsing")

                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Skip very short lines
                    if len(line) < 10:
                        i += 1
                        continue

                    # Try to parse as date
                    date_info = parse_date_string(line)

                    if date_info:
                        # Look for title in previous or next line
                        title = None
                        description = ""
                        time_info = None

                        if i > 0 and len(lines[i-1]) > 10:
                            title = lines[i-1]
                        elif i + 1 < len(lines) and len(lines[i+1]) > 10:
                            title = lines[i+1]

                        # Look for time and description
                        for j in range(max(0, i-2), min(len(lines), i+3)):
                            if not time_info:
                                time_info = parse_time_string(lines[j])
                            if len(lines[j]) > 30 and lines[j] != title:
                                description = lines[j]

                        if title and len(title) > 10:
                            events_found += 1

                            category = determine_category(title, description)
                            tags = extract_tags(title, description)
                            is_free = is_free_event(title, description)

                            content_hash = generate_content_hash(
                                title, "Georgia Peace and Justice Coalition", date_info["start_date"]
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
                                "title": title,
                                "description": description if description else None,
                                "start_date": date_info["start_date"],
                                "start_time": time_info,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": time_info is None,
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
                                logger.info(f"Added: {title} on {date_info['start_date']}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {title}: {e}")

                    i += 1

            browser.close()

        logger.info(
            f"GPJC crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching GPJC: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl GPJC: {e}")
        raise

    return events_found, events_new, events_updated
