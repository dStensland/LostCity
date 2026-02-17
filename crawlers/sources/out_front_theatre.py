"""
Crawler for Out Front Theatre Company (outfronttheatre.com).

Out Front Theatre Company is Georgia's LGBTQIA+ theater company, presenting
plays, musicals, and performances that tell LGBTQIA+ stories. Site uses
JavaScript rendering - requires Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, normalize_time_format

logger = logging.getLogger(__name__)

BASE_URL = "https://outfronttheatre.com"
SHOWS_URL = f"{BASE_URL}/shows"

# Out Front Theatre Company venue
OUT_FRONT_THEATRE_VENUE = {
    "name": "Out Front Theatre Company",
    "slug": "out-front-theatre-company",
    "address": "999 Brady Ave NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "venue_type": "theater",
    "website": BASE_URL,
}


def parse_date_text(date_text: str) -> Optional[tuple[str, str]]:
    """
    Parse date text from Out Front Theatre format.
    Examples: "March 15, 2026", "March 15-17, 2026", "Ongoing through April 2026"

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

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date text '{date_text}': {e}")

    return None


def parse_time_text(time_text: str) -> Optional[str]:
    """
    Parse time text from theater shows.
    Examples: "8:00 PM", "7:30pm", "2:00 PM"

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

    # Find dollar amounts
    amounts = re.findall(r'\$(\d+(?:\.\d{2})?)', text)

    if not amounts:
        return None, None, None, False

    amounts = [float(a) for a in amounts]

    return min(amounts), max(amounts), None, False


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Out Front Theatre Company shows using Playwright.

    The site requires JavaScript rendering to load show information.
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

            # Get venue ID for Out Front Theatre
            venue_id = get_or_create_venue(OUT_FRONT_THEATRE_VENUE)

            logger.info(f"Fetching Out Front Theatre shows: {SHOWS_URL}")
            page.goto(SHOWS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Get page HTML for parsing
            html = page.content()

            # Try to find show elements - common patterns for WordPress theater sites
            show_elements = page.query_selector_all('[class*="show"], [class*="event"], article')

            if not show_elements:
                logger.warning("No show elements found on page")

            for element in show_elements:
                try:
                    # Extract title
                    title_elem = element.query_selector('h1, h2, h3, h4, .title, [class*="title"]')
                    if not title_elem:
                        continue

                    title = title_elem.inner_text().strip()

                    if not title or len(title) < 3:
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
                    event_url = link_elem.get_attribute('href') if link_elem else SHOWS_URL
                    if event_url and not event_url.startswith('http'):
                        event_url = BASE_URL + event_url

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Out Front Theatre Company", start_date
                    )


                    # Get image
                    img_elem = element.query_selector('img')
                    image_url = None
                    if img_elem:
                        image_url = img_elem.get_attribute('src') or img_elem.get_attribute('data-src')
                        if image_url and not image_url.startswith('http'):
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
                        "category": "theater",
                        "subcategory": None,
                        "tags": ["theater", "lgbtq", "performing-arts"],
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
                    logger.debug(f"Error processing show element: {e}")
                    continue

            browser.close()

        logger.info(
            f"Out Front Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Out Front Theatre: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Out Front Theatre: {e}")
        raise

    return events_found, events_new, events_updated
