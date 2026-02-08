"""
Crawler for Perfect Note Atlanta (perfectnoteatlanta.com).

Perfect Note Atlanta is a dinner and live music venue featuring jazz, R&B,
and soul performances. Site uses JavaScript rendering - requires Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, normalize_time_format

logger = logging.getLogger(__name__)

BASE_URL = "https://perfectnoteatlanta.com"
EVENTS_URL = f"{BASE_URL}/events"
CALENDAR_URL = f"{BASE_URL}/calendar"

# Perfect Note Atlanta venue
PERFECT_NOTE_VENUE = {
    "name": "Perfect Note Atlanta",
    "slug": "perfect-note-atlanta",
    "address": "785 Old Roswell Rd",
    "neighborhood": "Roswell",
    "city": "Roswell",
    "state": "GA",
    "zip": "30076",
    "venue_type": "music-venue",
    "website": BASE_URL,
}


def parse_date_text(date_text: str) -> Optional[tuple[str, str]]:
    """
    Parse date text from Perfect Note Atlanta format.
    Examples: "March 15, 2026", "March 15-17, 2026", "Friday, March 15"

    Returns:
        Tuple of (start_date, end_date) in YYYY-MM-DD format, or None if unparseable
    """
    try:
        current_year = datetime.now().year

        # Match "Month DD, YYYY" or "Month DD-DD, YYYY"
        match = re.search(
            r'([A-Za-z]+)\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?,?\s+(\d{4})',
            date_text
        )

        if match:
            month_name, start_day, end_day, year = match.groups()

            # Parse start date
            start_dt = datetime.strptime(f"{month_name} {start_day} {year}", "%B %d %Y")
            start_date = start_dt.strftime("%Y-%m-%d")

            # Parse end date if range
            end_date = None
            if end_day:
                end_dt = datetime.strptime(f"{month_name} {end_day} {year}", "%B %d %Y")
                end_date = end_dt.strftime("%Y-%m-%d")

            return start_date, end_date

        # Try "Day, Month DD" without year
        match = re.search(
            r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Za-z]+)\s+(\d{1,2})',
            date_text
        )

        if match:
            month_name, day = match.groups()
            start_dt = datetime.strptime(f"{month_name} {day} {current_year}", "%B %d %Y")

            # If date is in the past, assume next year
            if start_dt.date() < datetime.now().date():
                start_dt = datetime.strptime(f"{month_name} {day} {current_year + 1}", "%B %d %Y")

            start_date = start_dt.strftime("%Y-%m-%d")
            return start_date, None

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date text '{date_text}': {e}")

    return None


def parse_time_text(time_text: str) -> Optional[str]:
    """
    Parse time text from event listings.
    Examples: "8:00 PM", "7:30pm", "9:00 PM"

    Returns:
        Time in HH:MM format (24-hour), or None if unparseable
    """
    if not time_text:
        return None

    return normalize_time_format(time_text)


def extract_price_info(text: str) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """
    Extract price information from text.

    Returns:
        Tuple of (price_min, price_max, price_note, is_free)
    """
    text_lower = text.lower()

    # Check for free
    if "free" in text_lower or "no admission" in text_lower:
        return 0, 0, "Free", True

    # Check for "no cover" - means no door charge but not free (food/drink expected)
    if "no cover" in text_lower:
        return None, None, "No cover", False

    # Find dollar amounts
    amounts = re.findall(r'\$(\d+(?:\.\d{2})?)', text)

    if not amounts:
        return None, None, None, False

    amounts = [float(a) for a in amounts]

    return min(amounts), max(amounts), None, False


def determine_subcategory(title: str, description: str = "") -> Optional[str]:
    """Determine music subcategory based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["jazz", "quartet", "trio"]):
        return "jazz"
    if any(word in text for word in ["r&b", "r and b", "soul", "motown"]):
        return "r-and-b"
    if any(word in text for word in ["blues"]):
        return "blues"
    if any(word in text for word in ["gospel"]):
        return "gospel"

    # Default to jazz for Perfect Note
    return "jazz"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["live-music", "jazz", "r-and-b", "dinner-theater"]

    if any(word in text for word in ["jazz"]):
        tags.append("jazz-music")
    if any(word in text for word in ["r&b", "soul"]):
        tags.append("soul")
    if any(word in text for word in ["blues"]):
        tags.append("blues")
    if any(word in text for word in ["gospel"]):
        tags.append("gospel")
    if any(word in text for word in ["dinner", "dining", "food"]):
        tags.append("dinner")
    if any(word in text for word in ["brunch"]):
        tags.append("brunch")
    if any(word in text for word in ["tribute", "celebrating"]):
        tags.append("tribute")

    return list(set(tags))


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Perfect Note Atlanta events using Playwright.

    The site requires JavaScript rendering to load event information.
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

            # Get venue ID for Perfect Note Atlanta
            venue_id = get_or_create_venue(PERFECT_NOTE_VENUE)

            # Try events page first, fallback to calendar
            for url in [EVENTS_URL, CALENDAR_URL, BASE_URL]:
                logger.info(f"Fetching Perfect Note Atlanta events: {url}")

                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)

                    # Scroll to load content
                    for _ in range(3):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(1000)

                    # Extract images from page
                    image_map = extract_images_from_page(page)

                    # Look for event elements - try multiple selectors
                    event_selectors = [
                        '.event',
                        '[class*="event"]',
                        'article',
                        '.event-item',
                        '.calendar-event',
                        '.show',
                        '[class*="show"]',
                    ]

                    event_elements = []
                    for selector in event_selectors:
                        elements = page.query_selector_all(selector)
                        if elements:
                            event_elements = elements
                            logger.info(f"Found {len(elements)} events using selector: {selector}")
                            break

                    if not event_elements:
                        logger.warning(f"No event elements found on {url}")
                        continue

                    for element in event_elements:
                        try:
                            # Extract title
                            title_elem = element.query_selector('h1, h2, h3, h4, .title, [class*="title"]')
                            if not title_elem:
                                continue

                            title = title_elem.inner_text().strip()

                            if not title or len(title) < 3:
                                continue

                            # Skip navigation/header elements
                            if title.lower() in ["events", "calendar", "upcoming events", "shows", "menu", "about"]:
                                continue

                            # Extract description
                            desc_elem = element.query_selector('p, .description, [class*="description"], [class*="excerpt"]')
                            description = desc_elem.inner_text().strip() if desc_elem else ""

                            # Get all text from the element for date/time parsing
                            element_text = element.inner_text()

                            # Parse dates
                            date_info = parse_date_text(element_text)
                            if not date_info:
                                logger.debug(f"Could not parse date for: {title}")
                                continue

                            start_date, end_date = date_info

                            # Try to parse time
                            start_time = parse_time_text(element_text)

                            # Extract price info
                            price_min, price_max, price_note, is_free = extract_price_info(element_text)

                            # Get event URL if available
                            link_elem = element.query_selector('a')
                            event_url = link_elem.get_attribute('href') if link_elem else url
                            if event_url and not event_url.startswith('http'):
                                event_url = BASE_URL + event_url

                            events_found += 1

                            # Determine subcategory and tags
                            subcategory = determine_subcategory(title, description)
                            tags = extract_tags(title, description)

                            # Generate content hash
                            content_hash = generate_content_hash(
                                title, "Perfect Note Atlanta", start_date
                            )

                            if find_event_by_hash(content_hash):
                                events_updated += 1
                                continue

                            # Get image
                            img_elem = element.query_selector('img')
                            image_url = None
                            if img_elem:
                                image_url = img_elem.get_attribute('src') or img_elem.get_attribute('data-src')
                                if image_url and not image_url.startswith('http'):
                                    if image_url.startswith('//'):
                                        image_url = 'https:' + image_url
                                    else:
                                        image_url = BASE_URL + image_url

                            # Fallback to image map
                            if not image_url and title in image_map:
                                image_url = image_map[title]

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": description if description else None,
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": end_date,
                                "end_time": None,
                                "is_all_day": False,
                                "category": "music",
                                "subcategory": subcategory,
                                "tags": tags,
                                "price_min": price_min,
                                "price_max": price_max,
                                "price_note": price_note,
                                "is_free": is_free,
                                "source_url": event_url,
                                "ticket_url": event_url,
                                "image_url": image_url,
                                "raw_text": f"{title} | {element_text[:200]}"[:500],
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
                                logger.error(f"Failed to insert: {title}: {e}")

                        except Exception as e:
                            logger.debug(f"Error processing event element: {e}")
                            continue

                    # If we found events, no need to try other URLs
                    if events_found > 0:
                        break

                except Exception as e:
                    logger.warning(f"Error fetching {url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Perfect Note Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Perfect Note Atlanta: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Perfect Note Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
