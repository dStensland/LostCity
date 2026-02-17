"""
Crawler for United Way of Greater Atlanta (volunteer.unitedwayatlanta.org/calendar).

United Way of Greater Atlanta's volunteer calendar featuring volunteer opportunities
and community service events. Site uses JavaScript rendering - must use Playwright.
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

BASE_URL = "https://volunteer.unitedwayatlanta.org"
CALENDAR_URL = f"{BASE_URL}/calendar"

# United Way of Greater Atlanta venue
UNITED_WAY_ATLANTA = {
    "name": "United Way of Greater Atlanta",
    "slug": "united-way-atlanta",
    "address": "100 Edgewood Ave NE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "nonprofit",
    "website": "https://www.unitedwayatlanta.org",
}


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    # Most United Way events are volunteer/community service
    if any(word in text for word in ["volunteer", "service", "cleanup", "food bank", "charity", "help", "serve"]):
        return "community"
    if any(word in text for word in ["workshop", "class", "training", "education"]):
        return "education"
    if any(word in text for word in ["fundraiser", "gala", "benefit", "campaign"]):
        return "community"
    if any(word in text for word in ["walk", "run", "5k", "race"]):
        return "outdoor"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["volunteer", "nonprofit", "charity"]

    if any(word in text for word in ["food", "hunger", "meal", "food bank"]):
        tags.append("food-security")
    if any(word in text for word in ["education", "tutoring", "reading", "school"]):
        tags.append("education")
    if any(word in text for word in ["youth", "children", "kids"]):
        tags.append("youth")
    if any(word in text for word in ["senior", "elderly", "aging"]):
        tags.append("seniors")
    if any(word in text for word in ["health", "wellness", "medical"]):
        tags.append("health")
    if any(word in text for word in ["housing", "homeless", "shelter"]):
        tags.append("housing")
    if any(word in text for word in ["environment", "cleanup", "park", "trail"]):
        tags.append("environmental")
    if any(word in text for word in ["family", "all ages"]):
        tags.append("family-friendly")
    if any(word in text for word in ["community", "neighborhood"]):
        tags.append("community")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Volunteer events are typically free
    if any(word in text for word in ["volunteer", "service"]):
        return True

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:"]):
        return False

    # Default to True for volunteer/charity events
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl United Way of Greater Atlanta volunteer calendar using Playwright.

    The calendar page may use various formats - we'll try to extract structured
    event data from calendar widgets or fall back to text parsing.
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

            # Get venue ID for United Way
            venue_id = get_or_create_venue(UNITED_WAY_ATLANTA)

            logger.info(f"Fetching United Way Atlanta calendar: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Try to find event cards/items - common volunteer platform patterns
            event_selectors = [
                ".event-item",
                ".event-card",
                ".opportunity",
                ".volunteer-opportunity",
                "article",
                "[class*='event']",
                "[class*='opportunity']",
                ".calendar-event",
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
                    r'(\w+day,?\s+\w+\s+\d+|\w+\s+\d+,?\s+\d{4}|\d{1,2}/\d{1,2}/\d{2,4})',
                    re.IGNORECASE
                )

                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Skip navigation, headers, short lines
                    if len(line) < 10 or line.lower() in ["calendar", "events", "upcoming", "volunteer"]:
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
                                           "%A, %B %d", "%A %B %d", "%a, %b %d", "%a %b %d",
                                           "%m/%d/%Y", "%m/%d/%y"]:
                                    try:
                                        if "%Y" not in fmt and "%y" not in fmt:
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
                                        title, "United Way Atlanta", start_date
                                    )


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
                                        "source_url": CALENDAR_URL,
                                        "ticket_url": None,
                                        "image_url": image_map.get(title[:100]),
                                        "raw_text": f"{title} | {line} | {description[:200]}"[:500],
                                        "extraction_confidence": 0.75,
                                        "is_recurring": False,
                                        "recurrence_rule": None,
                                        "content_hash": content_hash,
                                    }

                                    existing = find_event_by_hash(content_hash)
                                    if existing:
                                        smart_update_existing_event(existing, event_record)
                                        events_updated += 1
                                        i += 1
                                        continue

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
                        title_elem = event_elem.query_selector("h2, h3, h4, .event-title, .title, .opportunity-title")
                        title = title_elem.inner_text() if title_elem else text.split("\n")[0]

                        # Extract description
                        desc_elem = event_elem.query_selector(".description, .event-description, .details, p")
                        description = desc_elem.inner_text() if desc_elem else ""

                        # Extract date
                        date_elem = event_elem.query_selector(".date, .event-date, time, .datetime")
                        date_text = date_elem.inner_text() if date_elem else text

                        # Try to parse date from text
                        date_pattern = re.compile(
                            r'(\w+day,?\s+\w+\s+\d+|\w+\s+\d+,?\s+\d{4}|\d{1,2}/\d{1,2}/\d{2,4})',
                            re.IGNORECASE
                        )
                        date_match = date_pattern.search(date_text)

                        if not date_match:
                            continue

                        date_str = date_match.group(1)
                        current_year = datetime.now().year
                        start_date = None

                        for fmt in ["%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y",
                                   "%A, %B %d", "%A %B %d", "%m/%d/%Y", "%m/%d/%y"]:
                            try:
                                if "%Y" not in fmt and "%y" not in fmt:
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
                            title, "United Way Atlanta", start_date
                        )

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            continue

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
                            "source_url": CALENDAR_URL,
                            "ticket_url": None,
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
            f"United Way Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching United Way Atlanta: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl United Way Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
