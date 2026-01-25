"""
Crawler for College Football Hall of Fame (cfbhall.com).

Site uses JavaScript rendering - must use Playwright.
Events are on /happenings/ page, not /events.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.cfbhall.com"
HAPPENINGS_URL = f"{BASE_URL}/happenings/"

VENUE_DATA = {
    "name": "College Football Hall of Fame",
    "slug": "college-football-hof",
    "address": "250 Marietta St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7609,
    "lng": -84.3935,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date ranges like:
    - "Saturday, February 28 - Sunday, March 1"
    - "Now Open"

    Returns (start_date, end_date) or (None, None) if unparseable.
    """
    # Handle ongoing exhibitions
    if "now open" in date_text.lower() or "follow" in date_text.lower() or "now available" in date_text.lower():
        return None, None

    # Try to parse date range like "Saturday, February 28 - Sunday, March 1"
    # Pattern: Day, Month DD - Day, Month DD
    range_match = re.search(
        r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+'
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+'
        r'(\d{1,2})\s*-\s*'
        r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+'
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+'
        r'(\d{1,2})',
        date_text,
        re.IGNORECASE
    )

    if range_match:
        start_month, start_day, end_month, end_day = range_match.groups()
        current_year = datetime.now().year

        try:
            # Parse start date
            start_dt = datetime.strptime(f"{start_month} {start_day} {current_year}", "%B %d %Y")
            # If start date is in the past, assume next year
            if start_dt.date() < datetime.now().date():
                start_dt = datetime.strptime(f"{start_month} {start_day} {current_year + 1}", "%B %d %Y")

            # Parse end date
            end_year = start_dt.year
            # Handle year rollover (e.g., Dec 31 - Jan 1)
            end_dt = datetime.strptime(f"{end_month} {end_day} {end_year}", "%B %d %Y")
            if end_dt < start_dt:
                end_dt = datetime.strptime(f"{end_month} {end_day} {end_year + 1}", "%B %d %Y")

            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try single date format
    single_match = re.search(
        r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+'
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+'
        r'(\d{1,2})(?:,?\s+(\d{4}))?',
        date_text,
        re.IGNORECASE
    )

    if single_match:
        month, day, year = single_match.groups()
        year = year or str(datetime.now().year)

        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month} {day} {int(year) + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl College Football Hall of Fame events using Playwright."""
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

            logger.info(f"Fetching College Football Hall of Fame: {HAPPENINGS_URL}")
            page.goto(HAPPENINGS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Find all event cards - they have class "event card-zoom"
            event_cards = page.query_selector_all('.event.card-zoom')

            logger.info(f"Found {len(event_cards)} event cards")

            for card in event_cards:
                try:
                    # Get the event URL from the link inside the card
                    link_elem = card.query_selector('a[href*="/happenings/"]')
                    if not link_elem:
                        continue

                    event_url = link_elem.get_attribute("href")
                    if not event_url or event_url == "/happenings/":
                        continue

                    if not event_url.startswith("http"):
                        event_url = BASE_URL + event_url

                    # Get title from h2
                    title_elem = card.query_selector("h2")
                    if not title_elem:
                        continue

                    title = title_elem.inner_text().strip()
                    if not title or len(title) < 5:
                        continue

                    # Skip navigation items
                    if title.lower() in ["happenings", "news", "blog", "events and happenings"]:
                        continue

                    # Get date from happening-date div
                    date_elem = card.query_selector(".happening-date, .happenings-date")
                    date_text = ""
                    if date_elem:
                        date_text = date_elem.inner_text().strip()

                    # Parse the date
                    start_date, end_date = parse_date_range(date_text)

                    # Skip if we couldn't parse a date or it's an ongoing exhibition
                    if not start_date:
                        logger.info(f"Skipping '{title}' - no parseable date (text: '{date_text}')")
                        continue

                    # Get description from p tag
                    description = "Event at College Football Hall of Fame"
                    desc_elem = card.query_selector("p")
                    if desc_elem:
                        desc_text = desc_elem.inner_text().strip()
                        if desc_text and len(desc_text) > 20:
                            description = desc_text

                    # Get image URL
                    image_url = None
                    img_elem = card.query_selector("img")
                    if img_elem:
                        image_url = img_elem.get_attribute("src")
                        if image_url and not image_url.startswith("http"):
                            if image_url.startswith("//"):
                                image_url = "https:" + image_url
                            elif image_url.startswith("/"):
                                image_url = BASE_URL + image_url

                    events_found += 1

                    content_hash = generate_content_hash(title, "College Football Hall of Fame", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        logger.info(f"Event already exists: {title}")
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": None,  # No specific times on the happenings page
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": True,
                        "category": "community",
                        "subcategory": None,
                        "tags": [
                            "college-football",
                            "hall-of-fame",
                            "football",
                            "downtown",
                            "sports",
                        ],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {date_text}",
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}" + (f" - {end_date}" if end_date else ""))
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.error(f"Error processing event card: {e}")
                    continue

            browser.close()

        logger.info(
            f"College Football Hall of Fame crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl College Football Hall of Fame: {e}")
        raise

    return events_found, events_new, events_updated
