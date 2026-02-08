"""
Crawler for Eddie's Attic (eddiesattic.com).

Eddie's Attic is an iconic acoustic music venue in Decatur, GA, known for
showcasing singer-songwriters and emerging artists. Site uses JavaScript
rendering - requires Playwright.
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

BASE_URL = "https://eddiesattic.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Eddie's Attic",
    "slug": "eddies-attic",
    "address": "515-B N McDonough St",
    "neighborhood": "Downtown Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_date_text(date_text: str) -> Optional[str]:
    """
    Parse date text from Eddie's Attic format.
    Examples: "Friday, Feb 7", "Saturday, February 15", "Sun, Mar 2"

    Returns:
        Date in YYYY-MM-DD format, or None if unparseable
    """
    try:
        current_year = datetime.now().year

        # Try "Day, Month DD" format - common on event listing sites
        # Examples: "Friday, Feb 7", "Saturday, February 15"
        match = re.search(
            r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+'
            r'([A-Za-z]+)\s+(\d{1,2})',
            date_text,
            re.IGNORECASE
        )

        if match:
            month_name, day = match.groups()
            try:
                # Try full month name first
                start_dt = datetime.strptime(f"{month_name} {day} {current_year}", "%B %d %Y")
            except ValueError:
                # Try abbreviated month name
                start_dt = datetime.strptime(f"{month_name} {day} {current_year}", "%b %d %Y")

            # If date is in the past, assume it's next year
            if start_dt.date() < datetime.now().date():
                start_dt = start_dt.replace(year=current_year + 1)

            return start_dt.strftime("%Y-%m-%d")

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date text '{date_text}': {e}")

    return None


def parse_time_text(time_text: str) -> Optional[str]:
    """Parse time from event text. Prefers show time over doors time."""
    if not time_text:
        return None

    def _parse_single_time(t: str) -> Optional[str]:
        """Convert a time string like '7pm', '7:00 PM', '8:30pm' to HH:MM."""
        t = t.strip()
        # Match "7:00 PM", "7:00PM", "7:00 pm"
        m = re.match(r'(\d{1,2}):(\d{2})\s*(am|pm)', t, re.IGNORECASE)
        if m:
            hour, minute, period = int(m.group(1)), m.group(2), m.group(3)
            if period.lower() == 'pm' and hour != 12:
                hour += 12
            elif period.lower() == 'am' and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        # Match "7pm", "8PM", "10am" (no minutes)
        m = re.match(r'(\d{1,2})\s*(am|pm)', t, re.IGNORECASE)
        if m:
            hour, period = int(m.group(1)), m.group(2)
            if period.lower() == 'pm' and hour != 12:
                hour += 12
            elif period.lower() == 'am' and hour == 12:
                hour = 0
            return f"{hour:02d}:00"
        return None

    # 1. Prefer "Show" time
    show_match = re.search(r'(?:Show|Music|Starts?)(?:\s+at)?[:\s]+(\d{1,2}(?::\d{2})?\s*[ap]m)', time_text, re.IGNORECASE)
    if show_match:
        result = _parse_single_time(show_match.group(1))
        if result:
            return result

    # 2. Try "Doors" time as fallback
    doors_match = re.search(r'(?:Doors?)(?:\s+at)?[:\s]+(\d{1,2}(?::\d{2})?\s*[ap]m)', time_text, re.IGNORECASE)
    if doors_match:
        result = _parse_single_time(doors_match.group(1))
        if result:
            return result

    # 3. Find any time in the text
    any_time = re.search(r'(\d{1,2}(?::\d{2})?\s*[ap]m)', time_text, re.IGNORECASE)
    if any_time:
        result = _parse_single_time(any_time.group(1))
        if result:
            return result

    return None


def extract_price_info(text: str) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """
    Extract price information from text.

    Returns:
        Tuple of (price_min, price_max, price_note, is_free)
    """
    text_lower = text.lower()

    # Check for free
    if "free" in text_lower:
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


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Eddie's Attic events using Playwright.

    The site uses JavaScript rendering to load event listings,
    so we must use Playwright to render the page.
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
            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Eddie's Attic events: {EVENTS_URL}")

            try:
                page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # Scroll to load all events (lazy loading)
                for _ in range(5):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1000)

                # Extract images from page
                image_map = extract_images_from_page(page)

                # Look for event elements - try multiple selectors
                event_selectors = [
                    '.blockLink',  # Main listing container used on this site
                    '.listing',
                    'article',
                    '.event, .eo-event',
                    '[class*="listing"]',
                ]

                event_elements = []
                for selector in event_selectors:
                    elements = page.query_selector_all(selector)
                    if elements and len(elements) > 2:  # Need more than just header elements
                        event_elements = elements
                        logger.info(f"Found {len(elements)} events using selector: {selector}")
                        break

                if not event_elements:
                    logger.warning(f"No event elements found on {EVENTS_URL}")
                    browser.close()
                    return 0, 0, 0

                for element in event_elements:
                    try:
                        # Get all text from element
                        element_text = element.inner_text()

                        # Skip very short elements (likely headers/nav)
                        if len(element_text) < 20:
                            continue

                        # Extract title - try multiple selectors
                        title_elem = element.query_selector('h1, h2, h3, h4, .listing__title, .event-title, [class*="title"]')
                        if not title_elem:
                            # Try getting first substantial line
                            lines = [l.strip() for l in element_text.split("\n") if l.strip() and len(l.strip()) > 3]
                            if not lines:
                                continue
                            title = lines[0]
                        else:
                            title = title_elem.inner_text().strip()

                        if not title or len(title) < 3:
                            continue

                        # Skip navigation/header elements
                        if title.lower() in ["events", "upcoming shows", "what's on", "calendar", "upcoming events"]:
                            continue

                        # Parse date
                        start_date = parse_date_text(element_text)
                        if not start_date:
                            logger.debug(f"Could not parse date for: {title}")
                            continue

                        # Skip past events
                        try:
                            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                                continue
                        except ValueError:
                            continue

                        # Try to parse time
                        start_time = parse_time_text(element_text)

                        # Extract price info
                        price_min, price_max, price_note, is_free = extract_price_info(element_text)

                        # Extract description if available
                        desc_elem = element.query_selector('p, .description, .event-description, .listing__description')
                        description = desc_elem.inner_text().strip() if desc_elem else None

                        # If no description, create one from title
                        if not description or len(description) < 10:
                            description = f"Live music at Eddie's Attic featuring {title}"

                        # Get event URL if available
                        link_elem = element.query_selector('a')
                        event_url = link_elem.get_attribute('href') if link_elem else EVENTS_URL
                        if event_url and not event_url.startswith('http'):
                            event_url = BASE_URL + event_url

                        # Get ticket URL (might be different)
                        ticket_elem = element.query_selector('a[href*="ticket"], a.listing__button, a.plotButton')
                        ticket_url = ticket_elem.get_attribute('href') if ticket_elem else event_url
                        if ticket_url and not ticket_url.startswith('http'):
                            ticket_url = BASE_URL + ticket_url

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, "Eddie's Attic", start_date
                        )

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        # Get image
                        img_elem = element.query_selector('img')
                        image_url = None
                        if img_elem:
                            image_url = img_elem.get_attribute('src') or img_elem.get_attribute('data-src') or img_elem.get_attribute('srcset')
                            if image_url:
                                # Handle srcset - take first image
                                if ',' in image_url:
                                    image_url = image_url.split(',')[0].strip().split(' ')[0]
                                # Make absolute URL
                                if not image_url.startswith('http'):
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
                            "description": description,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "music",
                            "subcategory": "concert",
                            "tags": ["acoustic", "singer-songwriter", "live-music", "decatur"],
                            "price_min": price_min,
                            "price_max": price_max,
                            "price_note": price_note,
                            "is_free": is_free,
                            "source_url": event_url,
                            "ticket_url": ticket_url,
                            "image_url": image_url,
                            "raw_text": f"{title} | {element_text[:300]}"[:500],
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

            except PlaywrightTimeout as e:
                logger.error(f"Timeout fetching Eddie's Attic events: {e}")
                raise
            except Exception as e:
                logger.error(f"Error fetching Eddie's Attic events: {e}")
                raise

            browser.close()

        logger.info(
            f"Eddie's Attic crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Eddie's Attic: {e}")
        raise

    return events_found, events_new, events_updated
