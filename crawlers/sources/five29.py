"""
Crawler for 529 (529atlanta.com).

Site uses JavaScript rendering - must use Playwright.
Events are displayed in .event-card or .event-card-condensed elements.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://529atlanta.com"
EVENTS_URL = "https://529atlanta.com"

VENUE_DATA = {
    "name": "529",
    "slug": "529",
    "address": "529 Flat Shoals Ave SE",
    "neighborhood": "East Atlanta Village",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from format like 'Thursday Feb 05, 2026'.

    Returns YYYY-MM-DD string or None.
    """
    # Match patterns like "Thursday Feb 05, 2026" or "Feb 05, 2026"
    date_match = re.search(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+"
        r"(\d{1,2})(?:,?\s+(\d{4}))?",
        date_text,
        re.IGNORECASE
    )

    if not date_match:
        return None

    month = date_match.group(1)
    day = date_match.group(2)
    year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

    try:
        # Normalize month to 3-letter abbreviation
        month_str = month[:3].capitalize()
        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")

        # If date is in the past, assume next year
        if dt.date() < datetime.now().date():
            dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")

        return dt.strftime("%Y-%m-%d")
    except ValueError as e:
        logger.warning(f"Failed to parse date '{date_text}': {e}")
        return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format to 24-hour HH:MM."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl 529 events using Playwright with DOM selectors."""
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

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching 529: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract images for matching with events
            image_map = extract_images_from_page(page)
            logger.info(f"Found {len(image_map)} images on page")

            # Query for event cards using proper selectors
            event_cards = page.query_selector_all(".event-card, .event-card-condensed")
            logger.info(f"Found {len(event_cards)} event cards")

            for card in event_cards:
                try:
                    # Extract title from h3 inside the card
                    title_element = card.query_selector("h3")
                    if not title_element:
                        logger.debug("Skipping card with no h3 title")
                        continue

                    title = title_element.inner_text().strip()
                    if not title:
                        logger.debug("Skipping card with empty title")
                        continue

                    # Get all text content from the card
                    card_text = card.inner_text()

                    # Parse date from card text
                    start_date = parse_date(card_text)
                    if not start_date:
                        logger.debug(f"Skipping '{title}' - no valid date found in: {card_text[:100]}")
                        continue

                    # Parse time if available
                    start_time = parse_time(card_text)

                    # Look for ticket/info links
                    ticket_url = None
                    links = card.query_selector_all("a")
                    for link in links:
                        link_text = link.inner_text().lower()
                        href = link.get_attribute("href")
                        if href and ("ticket" in link_text or "info" in link_text or "big" in href):
                            ticket_url = href if href.startswith("http") else BASE_URL + href
                            break

                    events_found += 1

                    content_hash = generate_content_hash(title, "529", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Find image for this event
                    event_image = None
                    title_lower = title.lower()
                    for img_title, img_url in image_map.items():
                        if img_title.lower() in title_lower or title_lower in img_title.lower():
                            event_image = img_url
                            break

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": f"Event at 529",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": start_time is None,
                        "category": "music",
                        "subcategory": "concert",
                        "tags": ["event"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": EVENTS_URL,
                        "ticket_url": ticket_url or EVENTS_URL,
                        "image_url": event_image,
                        "raw_text": card_text[:500],  # Store first 500 chars for debugging
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert '{title}': {e}")

                except Exception as e:
                    logger.error(f"Error processing event card: {e}")
                    continue

            browser.close()

        logger.info(
            f"529 crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl 529: {e}")
        raise

    return events_found, events_new, events_updated
